import { existsSync } from "node:fs";
import path from "node:path";
import {
  app,
  BrowserWindow,
  WebContentsView,
  dialog,
  ipcMain,
  safeStorage,
  session,
  shell,
} from "electron";
import { startDshRuntime } from "./dsh-runtime.mjs";
import { migratePiOnFirstRun } from "../migrations/auto-pi.mjs";
import { registerDesktopDomains } from "./register-desktop-domains.mjs";

app.setName("劳博士");

let mainWindow;
let runtime;
let runtimeUrl;
let isQuitting = false;
let disposeDesktopDomains;
let dshHome;
let workspace;

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
  });
  runtimeUrl = await runtime.ready;

  if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) {
    throw new Error("DSH 本地运行时在桌面窗口创建前退出。");
  }

  runtime.child.once("exit", (code, signal) => {
    if (isQuitting) return;
    dialog.showErrorBox(
      "劳博士运行时已停止",
      `DSH 运行时意外退出（code=${String(code)}, signal=${String(signal)}）。`,
    );
    app.quit();
  });
}

function installPermissionPolicy() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
}

function createWindow() {
  const preload = path.join(app.getAppPath(), "desktop", "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: "劳博士",
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
    mainWindow?.setTitle("劳博士");
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
  void mainWindow.loadURL(runtimeUrl);
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
      await bootRuntime();
      installPermissionPolicy();
      disposeDesktopDomains = registerDesktopDomains({
        ipcMain,
        BrowserWindow,
        WebContentsView,
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

app.on("before-quit", () => {
  isQuitting = true;
  disposeDesktopDomains?.();
  disposeDesktopDomains = undefined;
  void runtime?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
