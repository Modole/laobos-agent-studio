import { existsSync } from "node:fs";
import path from "node:path";
import {
  app,
  autoUpdater as nativeAutoUpdater,
  BrowserWindow,
  WebContentsView,
  clipboard,
  dialog,
  ipcMain,
  safeStorage,
  session,
  shell,
} from "electron";
import { startDshRuntime } from "./dsh-runtime.mjs";
import { bundledPluginMode } from "./local-plugins.mjs";
import {
  clearPendingPlugin,
  quarantineUserPlugins,
  readPendingPlugin,
  restoreLastPluginRecovery,
} from "./plugin-recovery.mjs";
import { migratePiOnFirstRun } from "../migrations/auto-pi.mjs";
import { registerDesktopDomains } from "./register-desktop-domains.mjs";
import { installPermissionPolicy } from "./permissions.mjs";

const isDevelopment = !app.isPackaged;
const productName = isDevelopment ? "劳博士（开发版）" : "劳博士";

app.setName(productName);
if (isDevelopment) {
  // Keep the development process independent from an installed release. Electron's
  // single-instance lock is scoped by userData, so sharing it silently focuses the
  // installed app and makes local code changes appear to be missing.
  app.setPath("userData", path.join(app.getPath("appData"), "劳博士 Dev"));
}

let mainWindow;
let runtime;
let runtimeUrl;
let isQuitting = false;
let disposeDesktopDomains;
let dshHome;
let workspace;
let shutdownPromise;
let quitReady = false;
let runtimeRestarting = false;
let rendererRecoveryAttempted = false;

const RENDERER_BOOT_TIMEOUT_MS = 20_000;
const RENDERER_BOOT_POLL_MS = 250;

function prepareToQuit() {
  isQuitting = true;
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      const dispose = disposeDesktopDomains;
      disposeDesktopDomains = undefined;
      dispose?.();
      const activeRuntime = runtime;
      runtime = undefined;
      await activeRuntime?.close();
    })();
  }
  return shutdownPromise;
}

function resolveRuntimeFiles() {
  const appRoot = app.getAppPath();
  const dshBin = path.join(
    appRoot,
    "node_modules",
    "@deepseek-ai",
    "dsh",
    "lib",
    "bin.js",
  );
  const patchFile = path.join(appRoot, "config", "laobos.cordis.patch.yml");

  if (!existsSync(dshBin) || !existsSync(patchFile)) {
    throw new Error("应用缺少 DSH 运行时或劳博士配置。请重新安装依赖。");
  }

  return { dshBin, patchFile };
}

function resolveWorkspace() {
  const requested = process.env.LAOBOS_WORKSPACE;
  if (requested && existsSync(requested)) return path.resolve(requested);
  return app.getPath("documents");
}

async function bootRuntime() {
  const { dshBin, patchFile } = resolveRuntimeFiles();
  dshHome = path.join(app.getPath("userData"), "dsh");
  workspace = resolveWorkspace();

  try {
    await migratePiOnFirstRun({
      dshHome,
      logger: {
        log(message) {
          console.log(`[migration] ${message}`);
        },
      },
    });
  } catch (error) {
    console.warn(
      "Pi 数据自动迁移失败，DSH 将继续启动：",
      error instanceof Error ? error.message : String(error),
    );
  }

  runtime = startDshRuntime({
    nodeExecutable: process.execPath,
    dshBin,
    patchFile,
    workspace,
    dshHome,
    electronRunAsNode: true,
    pluginMode: bundledPluginMode({ packaged: app.isPackaged }),
  });
  runtimeUrl = await runtime.ready;

  if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) {
    throw new Error("DSH 本地运行时在桌面窗口创建前退出。");
  }

  runtime.child.once("exit", (code, signal) => {
    if (isQuitting || runtimeRestarting) return;
    dialog.showErrorBox(
      "劳博士运行时已停止",
      `DSH 运行时意外退出（code=${String(code)}, signal=${String(signal)}）。`,
    );
    app.quit();
  });
}

function reasonMessage(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}

async function restartRuntimeAfterPluginFailure(reason) {
  if (runtimeRestarting) return { changed: false, entryIds: [] };
  runtimeRestarting = true;
  try {
    const recovery = await quarantineUserPlugins(dshHome, reasonMessage(reason));
    if (!recovery.changed) return recovery;
    const previousRuntime = runtime;
    runtime = undefined;
    runtimeUrl = undefined;
    await previousRuntime?.close();
    console.warn(
      `[plugins] 已进入安全模式并停用：${recovery.entryIds.join(", ")}`,
    );
    try {
      await bootRuntime();
      return recovery;
    } catch (retryError) {
      await restoreLastPluginRecovery(dshHome).catch(() => false);
      throw new AggregateError(
        [reason, retryError],
        `插件安全模式启动仍然失败：${reasonMessage(retryError)}`,
      );
    }
  } finally {
    runtimeRestarting = false;
  }
}

async function bootRuntimeWithPluginRecovery() {
  try {
    await bootRuntime();
  } catch (error) {
    const recovery = await restartRuntimeAfterPluginFailure(error);
    if (!recovery.changed) throw error;
  }
}

async function inspectRendererBoot(window) {
  const deadline = Date.now() + RENDERER_BOOT_TIMEOUT_MS;
  while (!window.isDestroyed() && Date.now() < deadline) {
    const state = await window.webContents.executeJavaScript(`(() => {
      const root = document.getElementById("root");
      const text = root?.innerText || "";
      if (text.includes("Failed to load plugins")) {
        return { state: "failed", detail: text.slice(0, 4000) };
      }
      if (globalThis.__DSH_MODULES__ && root?.childElementCount > 0 && !text.includes("Loading plugins")) {
        return { state: "ready" };
      }
      return { state: "loading" };
    })()`, true).catch((error) => ({ state: "failed", detail: reasonMessage(error) }));
    if (state.state !== "loading") return state;
    await new Promise((resolve) => setTimeout(resolve, RENDERER_BOOT_POLL_MS));
  }
  return { state: "timeout", detail: "DSH 前端插件启动超时。" };
}

async function loadRuntimePage(window) {
  await window.loadURL(runtimeUrl);
  const state = await inspectRendererBoot(window);
  if (state.state === "ready") {
    await clearPendingPlugin(dshHome);
    return;
  }

  const pending = await readPendingPlugin(dshHome);
  const shouldRecover = state.state === "failed" || pending !== undefined;
  if (!shouldRecover || rendererRecoveryAttempted) {
    if (state.state !== "timeout") {
      dialog.showErrorBox("插件启动失败", state.detail || "DSH 前端插件无法启动。");
    }
    return;
  }

  rendererRecoveryAttempted = true;
  const recovery = await restartRuntimeAfterPluginFailure(state.detail || state.state);
  if (!recovery.changed || !runtimeUrl || window.isDestroyed()) {
    dialog.showErrorBox("插件启动失败", state.detail || "没有可自动隔离的用户插件。");
    return;
  }
  await dialog.showMessageBox(window, {
    type: "warning",
    title: "已隔离故障插件",
    message: "检测到用户插件阻止应用启动，已自动进入安全模式。",
    detail: `已停用：${recovery.entryIds.join(", ")}\n恢复记录：${recovery.recoveryPath}`,
  });
  await loadRuntimePage(window);
}

function createWindow() {
  const preload = path.join(app.getAppPath(), "desktop", "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: productName,
    icon: path.join(app.getAppPath(), "public", "laobos-logo.png"),
    backgroundColor: "#f5f5f3",
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow?.setTitle(productName);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!runtimeUrl || !url.startsWith(`${runtimeUrl}/`)) {
      event.preventDefault();
    }
  });
  void loadRuntimePage(mainWindow).catch((error) => {
    console.error("劳博士页面启动失败：", error);
    dialog.showErrorBox("劳博士页面启动失败", reasonMessage(error));
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await bootRuntimeWithPluginRecovery();
      installPermissionPolicy({
        session: session.defaultSession,
        getRuntimeUrl: () => runtimeUrl,
      });
      disposeDesktopDomains = registerDesktopDomains({
        ipcMain,
        BrowserWindow,
        WebContentsView,
        clipboard,
        dialog,
        shell,
        safeStorage,
        app,
        dshHome,
        workspace,
        getMainWindow: () => mainWindow,
        getRuntimeUrl: () => runtimeUrl,
      });
      createWindow();
    } catch (error) {
      console.error("劳博士启动失败：", error);
      dialog.showErrorBox(
        "劳博士启动失败",
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && runtimeUrl) {
        createWindow();
      }
    });
  });
}

nativeAutoUpdater.on("before-quit-for-update", () => {
  void prepareToQuit();
});

app.on("before-quit", (event) => {
  if (quitReady) return;
  event.preventDefault();
  void prepareToQuit().finally(() => {
    quitReady = true;
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
