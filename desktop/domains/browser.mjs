import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { boundedString } from "../ipc-security.mjs";

const BROWSEROPS_PORT = 57_321;

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

  ipcMain.handle("laobos:browser:show", (event, input = {}) => {
    authorize(event);
    visible = input.visible === true;
    if (visible) ensureView();
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
    const url = normalizeBrowserUrl(input.url);
    await ensureView().webContents.loadURL(url);
    return browserState();
  });

  ipcMain.handle("laobos:browser:action", (event, input = {}) => {
    authorize(event);
    const contents = ensureView().webContents;
    const history = contents.navigationHistory;
    if (input.action === "back" && history.canGoBack()) history.goBack();
    else if (input.action === "forward" && history.canGoForward()) history.goForward();
    else if (input.action === "reload") contents.reload();
    else if (input.action === "stop") contents.stop();
    return browserState();
  });

  ipcMain.handle("laobos:browserops:status", async (event) => {
    authorize(event);
    if (!browserOpsChild && await canConnect(BROWSEROPS_PORT)) {
      return { state: "external", message: `已检测到本机 BrowserOps daemon（端口 ${BROWSEROPS_PORT}）` };
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
    const daemon = path.join(app.getAppPath(), "node_modules", "@browserops", "bridge", "dist", "daemon.js");
    browserOpsState = { state: "starting", message: "正在启动 BrowserOps daemon…" };
    browserOpsChild = spawn(process.execPath, [daemon], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let recent = "";
    const collect = (chunk) => {
      recent = `${recent}${String(chunk)}`.slice(-2_000);
      browserOpsState = { state: "running", message: recent.trim().split("\n").at(-1) || `端口 ${BROWSEROPS_PORT}` };
      sendBrowserOpsState();
    };
    browserOpsChild.stdout.on("data", collect);
    browserOpsChild.stderr.on("data", collect);
    browserOpsChild.once("error", (error) => {
      browserOpsChild = undefined;
      browserOpsState = { state: "error", message: error.message };
      sendBrowserOpsState();
    });
    browserOpsChild.once("exit", (code, signal) => {
      browserOpsChild = undefined;
      browserOpsState = { state: code === 0 ? "stopped" : "error", message: `daemon 已退出（code=${String(code)}, signal=${String(signal)}）` };
      sendBrowserOpsState();
    });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (await canConnect(BROWSEROPS_PORT)) {
        browserOpsState = { state: "running", message: `BrowserOps daemon 已就绪（端口 ${BROWSEROPS_PORT}）` };
        sendBrowserOpsState();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { ...browserOpsState };
  });

  ipcMain.handle("laobos:browserops:stop", (event) => {
    authorize(event);
    if (!browserOpsChild) return { stopped: false, state: browserOpsState.state };
    browserOpsChild.kill("SIGTERM");
    return { stopped: true, state: "stopping" };
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
    view.webContents.setWindowOpenHandler(({ url }) => {
      try { void view.webContents.loadURL(normalizeBrowserUrl(url)); } catch {}
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, url) => {
      try { normalizeBrowserUrl(url); } catch { event.preventDefault(); }
    });
    for (const eventName of ["did-start-loading", "did-stop-loading", "did-navigate", "did-navigate-in-page", "page-title-updated"]) {
      view.webContents.on(eventName, sendState);
    }
    syncVisibility();
    return view;
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
      url: contents?.getURL() || "",
      title: contents?.getTitle() || "",
      loading: contents?.isLoading() || false,
      canGoBack: history?.canGoBack() || false,
      canGoForward: history?.canGoForward() || false,
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

  return () => {
    if (browserOpsChild) browserOpsChild.kill("SIGTERM");
    browserOpsChild = undefined;
    if (view) {
      const window = getMainWindow();
      if (window && !window.isDestroyed()) window.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.close();
      view = undefined;
    }
    for (const channel of ["laobos:browser:show", "laobos:browser:set-bounds", "laobos:browser:navigate", "laobos:browser:action", "laobos:browserops:status", "laobos:browserops:start", "laobos:browserops:stop"]) ipcMain.removeHandler(channel);
  };
}

export function normalizeBrowserUrl(value) {
  let input = boundedString(value, "浏览器地址", 8_192).trim();
  if (!input) input = "http://127.0.0.1:3000";
  if (!/^[a-z][a-z\d+.-]*:\/\//iu.test(input)) input = `http://${input}`;
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("浏览器预览只允许 HTTP(S) 地址。 ");
  if (url.username || url.password) throw new Error("浏览器地址不能包含用户名或密码。 ");
  return url.toString();
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
