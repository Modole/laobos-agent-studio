import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { boundedString } from "../ipc-security.mjs";
import {
  BROWSER_ELEMENT_HIGHLIGHT,
  collectBrowserElementContext,
} from "./browser-element-inspector.mjs";

const BROWSEROPS_PORT = 57_321;
const require = createRequire(import.meta.url);
const BROWSER_HOME_URL = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>浏览器</title><style>html,body{height:100%;margin:0}body{align-items:center;background:#f6f7f9;color:#4b5563;display:flex;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;justify-content:center}.card{max-width:440px;padding:32px;text-align:center}.mark{align-items:center;background:#e8ecf6;border-radius:18px;color:#5c75ff;display:inline-flex;font-size:26px;height:58px;justify-content:center;margin-bottom:14px;width:58px}h1{color:#20242c;font-size:18px;margin:0 0 8px}p{line-height:1.65;margin:0}@media(prefers-color-scheme:dark){body{background:#121418;color:#9299a5}h1{color:#edf0f5}.mark{background:#20263a}}</style><div class="card"><div class="mark">⌁</div><h1>内置浏览器已就绪</h1><p>在上方输入 HTTP(S) 地址。预览本地项目时，请先启动对应的开发服务，再打开它实际监听的端口。</p></div>`)}`;

export function registerBrowserIpc({
  ipcMain,
  WebContentsView,
  app,
  authorize,
  getMainWindow,
}) {
  let view;
  let visible = false;
  let browserOpsChild;
  let browserOpsState = { state: "stopped", message: "" };
  let navigationError = "";
  let currentAddress = "";
  let inspectActive = false;
  let inspectBusy = false;
  let inspectError = "";
  let inspectGeneration = 0;
  let inspectDebugger;
  let inspectMessageListener;
  let inspectDetachListener;
  let inspectCleanupPromise;

  ipcMain.handle("laobos:browser:show", async (event, input = {}) => {
    authorize(event);
    visible = input.visible === true;
    if (visible) ensureView();
    else await stopElementInspect();
    syncVisibility();
    return browserState();
  });

  ipcMain.handle("laobos:browser:set-bounds", (event, input = {}) => {
    authorize(event);
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return { applied: false };
    const [contentWidth, contentHeight] = window.getContentSize();
    const x = clampDimension(input.x, 0, contentWidth);
    const y = clampDimension(input.y, 0, contentHeight);
    const width = clampDimension(input.width, 100, contentWidth - x);
    const height = clampDimension(input.height, 80, contentHeight - y);
    ensureView().setBounds({ x, y, width, height });
    return { applied: true };
  });

  ipcMain.handle("laobos:browser:navigate", async (event, input = {}) => {
    authorize(event);
    await stopElementInspect();
    const url = normalizeBrowserUrl(input.url);
    currentAddress = url;
    navigationError = "";
    try {
      await ensureView().webContents.loadURL(url);
    } catch (error) {
      navigationError = friendlyNavigationError(error, url);
      sendState();
    }
    return browserState();
  });

  ipcMain.handle("laobos:browser:action", async (event, input = {}) => {
    authorize(event);
    await stopElementInspect();
    const contents = ensureView().webContents;
    const history = contents.navigationHistory;
    if (input.action === "back" && history.canGoBack()) history.goBack();
    else if (input.action === "forward" && history.canGoForward()) history.goForward();
    else if (input.action === "reload") contents.reload();
    else if (input.action === "stop") contents.stop();
    return browserState();
  });

  ipcMain.handle("laobos:browser:inspect-start", async (event) => {
    authorize(event);
    await startElementInspect();
    return browserState();
  });

  ipcMain.handle("laobos:browser:inspect-stop", async (event) => {
    authorize(event);
    await stopElementInspect();
    return browserState();
  });

  ipcMain.handle("laobos:browserops:status", async (event) => {
    authorize(event);
    if (!browserOpsChild && await canConnect(BROWSEROPS_PORT)) {
      browserOpsState = { state: "external", message: `已连接外部 BrowserOps daemon（端口 ${BROWSEROPS_PORT}）` };
    }
    return { ...browserOpsState };
  });

  ipcMain.handle("laobos:browserops:start", async (event) => {
    authorize(event);
    if (browserOpsChild) return { ...browserOpsState };
    if (await canConnect(BROWSEROPS_PORT)) {
      browserOpsState = { state: "external", message: `正在使用本机已有 daemon（端口 ${BROWSEROPS_PORT}）` };
      return { ...browserOpsState };
    }
    const daemon = resolveBrowserOpsDaemon(app.getAppPath());
    browserOpsState = { state: "starting", message: "正在启动 BrowserOps daemon…" };
    sendBrowserOpsState();
    const child = spawn(process.execPath, [daemon], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    browserOpsChild = child;
    let recent = "";
    const collect = (chunk) => {
      recent = `${recent}${String(chunk)}`.slice(-2_000);
      if (browserOpsState.state === "starting") {
        const detail = recent.trim().split("\n").at(-1);
        browserOpsState = { state: "starting", message: detail ? `正在启动：${detail}` : "正在启动 BrowserOps daemon…" };
      }
      sendBrowserOpsState();
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      if (browserOpsChild === child) browserOpsChild = undefined;
      browserOpsState = { state: "error", message: error.message };
      sendBrowserOpsState();
    });
    child.once("exit", (code, signal) => {
      if (browserOpsChild !== child) return;
      browserOpsChild = undefined;
      if (browserOpsState.state === "stopping") browserOpsState = { state: "stopped", message: "BrowserOps daemon 已停止" };
      else if (browserOpsState.state !== "error") browserOpsState = { state: code === 0 ? "stopped" : "error", message: `daemon 已退出（code=${String(code)}, signal=${String(signal)}）` };
      sendBrowserOpsState();
    });
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await canConnect(BROWSEROPS_PORT)) {
        browserOpsState = { state: "running", message: `BrowserOps daemon 已就绪（端口 ${BROWSEROPS_PORT}）` };
        sendBrowserOpsState();
        return { ...browserOpsState };
      }
      if (!browserOpsChild) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (browserOpsChild === child) {
      browserOpsState = { state: "error", message: recent.trim().split("\n").at(-1) || "BrowserOps daemon 启动超时，请检查安装或端口占用。" };
      child.kill("SIGTERM");
      sendBrowserOpsState();
    }
    return { ...browserOpsState };
  });

  ipcMain.handle("laobos:browserops:stop", (event) => {
    authorize(event);
    if (!browserOpsChild) return { stopped: false, ...browserOpsState };
    browserOpsState = { state: "stopping", message: "正在停止 BrowserOps daemon…" };
    sendBrowserOpsState();
    browserOpsChild.kill("SIGTERM");
    return { stopped: true, ...browserOpsState };
  });

  function ensureView() {
    if (view && !view.webContents.isDestroyed()) return view;
    const window = getMainWindow();
    if (!window || window.isDestroyed()) throw new Error("主窗口尚未就绪。 ");
    view = new WebContentsView({
      webPreferences: {
        partition: "persist:laobos-browser-preview",
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.contentView.addChildView(view);
    view.setBackgroundColor("#ffffff");
    void view.webContents.loadURL(BROWSER_HOME_URL);
    view.webContents.setWindowOpenHandler(({ url }) => {
      try { void view.webContents.loadURL(normalizeBrowserUrl(url)); } catch {}
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, url) => {
      try { normalizeBrowserUrl(url); } catch { event.preventDefault(); }
    });
    view.webContents.on("did-start-loading", () => { navigationError = ""; sendState(); });
    view.webContents.on("did-start-navigation", (_event, _url, _inPlace, isMainFrame) => {
      if (isMainFrame) void stopElementInspect();
    });
    view.webContents.on("did-stop-loading", sendState);
    view.webContents.on("did-navigate", (_event, url) => { if (!url.startsWith("data:")) currentAddress = url; sendState(); });
    view.webContents.on("did-navigate-in-page", (_event, url) => { currentAddress = url; sendState(); });
    view.webContents.on("page-title-updated", sendState);
    view.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      navigationError = friendlyNavigationError({ code: errorCode, message: errorDescription }, validatedURL || currentAddress);
      sendState();
    });
    view.webContents.on("render-process-gone", () => { void stopElementInspect(); });
    view.webContents.on("destroyed", () => { void stopElementInspect(); });
    syncVisibility();
    return view;
  }

  async function startElementInspect() {
    if (inspectCleanupPromise) await inspectCleanupPromise;
    if (inspectActive || inspectBusy) return;
    const contents = ensureView().webContents;
    if (!visible) throw new Error("请先打开内置浏览器，再点选网页元素。 ");
    if (!currentAddress || contents.isLoading()) throw new Error("请等待网页加载完成后再点选元素。 ");
    if (navigationError) throw new Error("当前页面加载失败，请先修正地址并重新打开。 ");
    if (contents.isDevToolsOpened?.() || contents.debugger.isAttached()) {
      throw new Error("页面调试器正被 DevTools 占用，请关闭 DevTools 后重试。 ");
    }
    inspectGeneration += 1;
    inspectError = "";
    inspectBusy = true;
    sendState();
    const generation = inspectGeneration;
    const debuggerApi = contents.debugger;
    try {
      debuggerApi.attach("1.3");
      inspectDebugger = debuggerApi;
      inspectMessageListener = (_event, method, params = {}, sessionId) => {
        if (method === "Overlay.inspectNodeRequested") {
          void captureInspectedElement(params.backendNodeId, sessionId, generation);
        } else if (method === "Overlay.inspectModeCanceled") {
          void stopElementInspect();
        }
      };
      inspectDetachListener = (_event, reason) => {
        if (inspectDebugger !== debuggerApi) return;
        inspectGeneration += 1;
        removeInspectListeners(debuggerApi);
        inspectDebugger = undefined;
        inspectActive = false;
        inspectBusy = false;
        if (reason && reason !== "target closed") inspectError = "网页元素点选已结束，请重试。";
        sendState();
      };
      debuggerApi.on("message", inspectMessageListener);
      debuggerApi.on("detach", inspectDetachListener);
      const command = (method, params = {}) => debuggerApi.sendCommand(method, params);
      await command("DOM.enable");
      await command("DOM.getDocument", { depth: 0, pierce: true });
      await command("CSS.enable");
      await command("Overlay.enable");
      await command("Accessibility.enable");
      await command("Runtime.enable");
      await command("Overlay.setInspectMode", { mode: "searchForNode", highlightConfig: BROWSER_ELEMENT_HIGHLIGHT });
      if (generation !== inspectGeneration) return;
      inspectActive = true;
      inspectBusy = false;
      sendState();
    } catch (error) {
      if (generation !== inspectGeneration) return;
      inspectError = friendlyInspectError(error);
      await stopElementInspect({ preserveError: true });
      throw new Error(inspectError);
    }
  }

  async function captureInspectedElement(backendNodeId, sessionId, generation) {
    if (!inspectActive || inspectBusy || generation !== inspectGeneration || !inspectDebugger) return;
    inspectActive = false;
    inspectBusy = true;
    sendState();
    const debuggerApi = inspectDebugger;
    const command = (method, params = {}, targetSessionId) => debuggerApi.sendCommand(method, params, targetSessionId);
    try {
      await command("Overlay.setInspectMode", {
        mode: "none",
        highlightConfig: BROWSER_ELEMENT_HIGHLIGHT,
      }, sessionId || undefined);
      await command("Overlay.highlightNode", {
        backendNodeId: Number(backendNodeId),
        highlightConfig: BROWSER_ELEMENT_HIGHLIGHT,
      }, sessionId || undefined).catch(() => {});
      const element = await collectBrowserElementContext({
        sendCommand: command,
        backendNodeId: Number(backendNodeId),
        sessionId,
        fallbackPage: { url: currentAddress, title: contentsTitle() },
      });
      if (generation !== inspectGeneration || debuggerApi !== inspectDebugger) return;
      sendElementSelected(element);
    } catch (error) {
      if (generation === inspectGeneration) inspectError = friendlyInspectError(error);
    } finally {
      if (generation === inspectGeneration) await stopElementInspect({ preserveError: Boolean(inspectError) });
    }
  }

  function stopElementInspect({ preserveError = false } = {}) {
    if (inspectCleanupPromise) return inspectCleanupPromise;
    inspectCleanupPromise = (async () => {
      inspectGeneration += 1;
      inspectActive = false;
      inspectBusy = false;
      if (!preserveError) inspectError = "";
      const debuggerApi = inspectDebugger;
      inspectDebugger = undefined;
      if (!debuggerApi) {
        sendState();
        return;
      }
      if (debuggerApi.isAttached()) {
        for (const [method, params] of [
          ["Overlay.setInspectMode", { mode: "none", highlightConfig: BROWSER_ELEMENT_HIGHLIGHT }],
          ["Overlay.hideHighlight", {}],
          ["Accessibility.disable", {}],
          ["CSS.disable", {}],
          ["Overlay.disable", {}],
          ["DOM.disable", {}],
          ["Runtime.disable", {}],
        ]) {
          try { await debuggerApi.sendCommand(method, params); } catch {}
        }
      }
      removeInspectListeners(debuggerApi);
      try { if (debuggerApi.isAttached()) debuggerApi.detach(); } catch {}
      sendState();
    })().finally(() => { inspectCleanupPromise = undefined; });
    return inspectCleanupPromise;
  }

  function removeInspectListeners(debuggerApi) {
    if (inspectMessageListener) debuggerApi.off("message", inspectMessageListener);
    if (inspectDetachListener) debuggerApi.off("detach", inspectDetachListener);
    inspectMessageListener = undefined;
    inspectDetachListener = undefined;
  }

  function syncVisibility() {
    if (!view) return;
    view.setVisible(visible);
    if (!visible) view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  function browserState() {
    const contents = view?.webContents;
    const history = contents?.navigationHistory;
    return {
      visible,
      url: currentAddress,
      title: contents?.getTitle() || "",
      error: navigationError,
      loading: contents?.isLoading() || false,
      canGoBack: history?.canGoBack() || false,
      canGoForward: history?.canGoForward() || false,
      inspecting: inspectActive,
      inspectBusy,
      inspectError,
    };
  }

  function sendState() {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send("laobos:browser:state", browserState());
  }

  function sendBrowserOpsState() {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send("laobos:browserops:state", browserOpsState);
  }

  function sendElementSelected(element) {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send("laobos:browser:element-selected", element);
  }

  function contentsTitle() {
    return view && !view.webContents.isDestroyed() ? view.webContents.getTitle() : "";
  }

  return () => {
    void stopElementInspect();
    if (browserOpsChild) browserOpsChild.kill("SIGTERM");
    browserOpsChild = undefined;
    if (view) {
      const window = getMainWindow();
      if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close();
      view = undefined;
    }
    for (const channel of ["laobos:browser:show", "laobos:browser:set-bounds", "laobos:browser:navigate", "laobos:browser:action", "laobos:browser:inspect-start", "laobos:browser:inspect-stop", "laobos:browserops:status", "laobos:browserops:start", "laobos:browserops:stop"]) ipcMain.removeHandler(channel);
  };
}

export function normalizeBrowserUrl(value) {
  let input = boundedString(value, "浏览器地址", 8_192).trim();
  if (!input) throw new Error("请输入要打开的 HTTP(S) 地址。");
  if (!/^[a-z][a-z\d+.-]*:\/\//iu.test(input)) input = `http://${input}`;
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("浏览器预览只允许 HTTP(S) 地址。");
  if (url.username || url.password) throw new Error("浏览器地址不能包含用户名或密码。");
  return url.toString();
}

export function friendlyNavigationError(error, url) {
  const message = String(error?.message || error || "");
  const target = (() => { try { return new URL(url).host; } catch { return url || "该地址"; } })();
  if (Number(error?.code) === -102 || /ERR_CONNECTION_REFUSED/iu.test(message)) {
    return `无法连接到 ${target}。如果这是本地项目，请先启动开发服务并确认端口。`;
  }
  if (Number(error?.code) === -105 || /ERR_NAME_NOT_RESOLVED/iu.test(message)) return `找不到 ${target}，请检查地址是否正确。`;
  if (Number(error?.code) === -106 || /ERR_INTERNET_DISCONNECTED/iu.test(message)) return "当前网络不可用，请检查网络连接。";
  return `页面加载失败：${message.replace(/^Error:\s*/u, "") || "未知错误"}`;
}

export function friendlyInspectError(error) {
  const message = String(error?.message || error || "").replace(/^Error:\s*/u, "");
  if (/Another debugger is already attached|DevTools|already attached/iu.test(message)) {
    return "页面调试器正被 DevTools 占用，请关闭 DevTools 后重试。";
  }
  if (/highlight configuration parameter is missing/iu.test(message)) return "网页元素高亮配置无效，请重新点选。";
  if (/Could not find node|No node with given id|元素已经/iu.test(message)) return "选中的网页元素已经变化，请重新选择。";
  return message || "无法点选网页元素，请重试。";
}

export function resolveBrowserOpsDaemon(appPath) {
  try {
    return path.join(path.dirname(require.resolve("@browserops/bridge/package.json")), "dist", "daemon.js");
  } catch {
    return path.join(appPath, "node_modules", "@browserops", "bridge", "dist", "daemon.js");
  }
}

function clampDimension(value, minimum, maximum) {
  const number = Number(value);
  return Math.min(Math.max(minimum, Number.isFinite(number) ? Math.round(number) : minimum), Math.max(minimum, maximum));
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(250);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
