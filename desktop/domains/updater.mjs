import electronUpdater from "electron-updater";
const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_CHECK_DELAY_MS = 15_000;
const MAX_RELEASE_NOTES_LENGTH = 20_000;

function text(value, maximum = 512) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function releaseNotes(value) {
  if (typeof value === "string") {
    return value
      .replace(/<\s*br\s*\/?\s*>/giu, "\n")
      .replace(/<\s*\/p\s*>/giu, "\n\n")
      .replace(/<\s*li(?:\s[^>]*)?>/giu, "- ")
      .replace(/<[^>]+>/gu, "")
      .replace(/&nbsp;/giu, " ")
      .replace(/&amp;/giu, "&")
      .replace(/&lt;/giu, "<")
      .replace(/&gt;/giu, ">")
      .replace(/&quot;/giu, '"')
      .replace(/&#39;/giu, "'")
      .trim()
      .slice(0, MAX_RELEASE_NOTES_LENGTH);
  }
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => `${text(item?.version, 64)}\n${releaseNotes(item?.note).slice(0, 5_000)}`.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_RELEASE_NOTES_LENGTH);
}

function updateInfo(info = {}) {
  return {
    availableVersion: text(info.version, 64),
    releaseName: text(info.releaseName, 256),
    releaseNotes: releaseNotes(info.releaseNotes),
    releaseDate: text(info.releaseDate, 64),
  };
}

function errorInfo(error) {
  return {
    code: text(error?.code, 128),
    message: text(error instanceof Error ? error.message : String(error), 2_000),
  };
}

function compareVersions(left, right) {
  const leftParts = String(left).split(/[.+-]/u).slice(0, 3).map(Number);
  const rightParts = String(right).split(/[.+-]/u).slice(0, 3).map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return String(left).localeCompare(String(right), "en", { numeric: true });
}

export class DesktopUpdater {
  constructor({
    updater,
    app,
    settings,
    getMainWindow,
    platform = process.platform,
    logger = console,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    this.updater = updater;
    this.app = app;
    this.settings = settings;
    this.getMainWindow = getMainWindow;
    this.logger = logger;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timer = undefined;
    this.listeners = [];
    this.pendingWrite = Promise.resolve();
    this.restoring = false;
    this.supported = app.isPackaged && ["darwin", "win32"].includes(platform);
    this.state = {
      schema: 1,
      supported: this.supported,
      phase: this.supported ? "idle" : "disabled",
      currentVersion: app.getVersion(),
      availableVersion: "",
      releaseName: "",
      releaseNotes: "",
      releaseDate: "",
      progress: null,
      cached: false,
      error: null,
    };

    if (this.supported && !this.updater) {
      throw new Error("当前平台缺少 Electron 更新器。");
    }
    if (this.supported) this.configure();
  }

  configure() {
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowPrerelease = false;
    this.updater.logger = this.logger;

    this.listen("checking-for-update", () => {
      this.publish({ phase: "checking", progress: null, error: null });
    });
    this.listen("update-available", (info) => {
      this.publish({
        phase: "available",
        ...updateInfo(info),
        progress: null,
        cached: this.restoring,
        error: null,
      });
    });
    this.listen("update-not-available", () => {
      void this.clearPendingUpdate();
      this.publish({
        phase: "up-to-date",
        availableVersion: "",
        releaseName: "",
        releaseNotes: "",
        releaseDate: "",
        progress: null,
        cached: false,
        error: null,
      });
    });
    this.listen("download-progress", (progress = {}) => {
      this.publish({
        phase: "downloading",
        progress: {
          percent: Number.isFinite(progress.percent) ? progress.percent : 0,
          bytesPerSecond: Number.isFinite(progress.bytesPerSecond) ? progress.bytesPerSecond : 0,
          transferred: Number.isFinite(progress.transferred) ? progress.transferred : 0,
          total: Number.isFinite(progress.total) ? progress.total : 0,
        },
        error: null,
      });
    });
    this.listen("update-downloaded", (info) => {
      const received = updateInfo(info);
      const next = {
        availableVersion: received.availableVersion || this.state.availableVersion,
        releaseName: received.releaseName || this.state.releaseName,
        releaseNotes: received.releaseNotes || this.state.releaseNotes,
        releaseDate: received.releaseDate || this.state.releaseDate,
      };
      this.persistPendingUpdate(next);
      this.publish({
        phase: "downloaded",
        ...next,
        progress: null,
        cached: true,
        error: null,
      });
    });
    this.listen("error", (error) => {
      this.publish({
        phase: this.state.phase === "installing" ? "downloaded" : "error",
        progress: null,
        error: errorInfo(error),
      });
    });
  }

  persistPendingUpdate(info) {
    const pendingUpdate = {
      version: info.availableVersion,
      releaseName: info.releaseName,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
      downloadedAt: new Date(this.now()).toISOString(),
    };
    this.pendingWrite = this.pendingWrite
      .then(() => this.settings.update({ pendingUpdate }))
      .catch((error) => this.logger.warn?.("无法保存更新缓存状态：", error));
    return this.pendingWrite;
  }

  clearPendingUpdate() {
    this.pendingWrite = this.pendingWrite
      .then(() => this.settings.update({ pendingUpdate: null }))
      .catch((error) => this.logger.warn?.("无法清除更新缓存状态：", error));
    return this.pendingWrite;
  }

  async initialize() {
    if (!this.supported) return this.snapshot();
    const preferences = await this.settings.get();
    const pending = preferences.pendingUpdate;
    if (!pending) return this.snapshot();
    if (compareVersions(pending.version, this.state.currentVersion) <= 0) {
      await this.clearPendingUpdate();
      return this.snapshot();
    }

    this.restoring = true;
    this.publish({
      phase: "restoring",
      availableVersion: pending.version,
      releaseName: pending.releaseName,
      releaseNotes: pending.releaseNotes,
      releaseDate: pending.releaseDate,
      progress: null,
      cached: true,
      error: null,
    });
    try {
      const result = await this.updater.checkForUpdates();
      const latestVersion = result?.updateInfo?.version || this.state.availableVersion;
      if (latestVersion !== pending.version) {
        await this.clearPendingUpdate();
        this.publish({ cached: false });
        return this.snapshot();
      }
      await this.updater.downloadUpdate();
      await this.pendingWrite;
    } catch (error) {
      if (!this.state.error) this.publish({ phase: "error", cached: true, error: errorInfo(error) });
    } finally {
      this.restoring = false;
    }
    return this.snapshot();
  }

  listen(event, listener) {
    this.updater.on(event, listener);
    this.listeners.push([event, listener]);
  }

  snapshot() {
    return structuredClone(this.state);
  }

  publish(patch) {
    this.state = { ...this.state, ...patch };
    const snapshot = this.snapshot();
    const window = this.getMainWindow?.();
    if (window && !window.isDestroyed()) {
      window.webContents.send("laobos:updates:state", snapshot);
    }
    return snapshot;
  }

  async preferences() {
    const value = await this.settings.get();
    return {
      autoCheckUpdates: value.autoCheckUpdates !== false,
      lastUpdateCheckAt: value.lastUpdateCheckAt || null,
    };
  }

  async setPreferences(input = {}) {
    if (typeof input.autoCheckUpdates !== "boolean") {
      throw new TypeError("自动检查更新设置必须是布尔值。");
    }
    const value = await this.settings.update({
      autoCheckUpdates: input.autoCheckUpdates,
    });
    return {
      autoCheckUpdates: value.autoCheckUpdates,
      lastUpdateCheckAt: value.lastUpdateCheckAt,
    };
  }

  async check({ automatic = false } = {}) {
    if (!this.supported) return this.snapshot();
    if (["restoring", "checking", "downloading", "downloaded", "installing"].includes(this.state.phase)) {
      return this.snapshot();
    }

    if (automatic) {
      const preferences = await this.preferences();
      if (!preferences.autoCheckUpdates) return this.snapshot();
      const lastCheck = preferences.lastUpdateCheckAt
        ? Date.parse(preferences.lastUpdateCheckAt)
        : 0;
      if (Number.isFinite(lastCheck) && this.now() - lastCheck < AUTO_CHECK_INTERVAL_MS) {
        return this.snapshot();
      }
    }

    this.publish({ phase: "checking", progress: null, error: null });
    try {
      await this.updater.checkForUpdates();
      await this.settings.update({ lastUpdateCheckAt: new Date(this.now()).toISOString() });
    } catch (error) {
      if (this.state.phase !== "error") {
        this.publish({ phase: "error", progress: null, error: errorInfo(error) });
      }
    }
    return this.snapshot();
  }

  async download() {
    if (!this.supported) return this.snapshot();
    if (this.state.phase !== "available") {
      throw new Error("当前没有可以下载的软件更新。");
    }
    this.publish({ phase: "downloading", progress: null, error: null });
    try {
      await this.updater.downloadUpdate();
      await this.pendingWrite;
    } catch (error) {
      if (this.state.phase !== "error") {
        this.publish({ phase: "error", progress: null, error: errorInfo(error) });
      }
    }
    return this.snapshot();
  }

  async install() {
    if (!this.supported) return this.snapshot();
    if (this.state.phase !== "downloaded") {
      throw new Error("软件更新尚未下载完成。");
    }
    this.publish({ phase: "installing", progress: null, error: null });
    try {
      await this.pendingWrite;
      this.updater.quitAndInstall(false, true);
    } catch (error) {
      this.publish({ phase: "downloaded", progress: null, cached: true, error: errorInfo(error) });
    }
    return this.snapshot();
  }

  scheduleAutoCheck() {
    if (!this.supported || this.timer) return;
    this.timer = this.setTimer(() => {
      this.timer = undefined;
      void this.check({ automatic: true });
    }, AUTO_CHECK_DELAY_MS);
    this.timer?.unref?.();
  }

  dispose() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = undefined;
    for (const [event, listener] of this.listeners) {
      this.updater.removeListener(event, listener);
    }
    this.listeners = [];
  }
}

export function registerUpdaterIpc({ ipcMain, authorize, ...options }) {
  const useNativeUpdater =
    options.app.isPackaged && ["darwin", "win32"].includes(process.platform);
  const service = new DesktopUpdater({
    ...options,
    updater: options.updater || (useNativeUpdater ? electronUpdater.autoUpdater : undefined),
  });
  const channels = [
    ["laobos:updates:status", () => service.snapshot()],
    ["laobos:updates:preferences", () => service.preferences()],
    ["laobos:updates:set-preferences", (_event, input) => service.setPreferences(input)],
    ["laobos:updates:check", () => service.check()],
    ["laobos:updates:download", () => service.download()],
    ["laobos:updates:install", () => service.install()],
  ];

  for (const [channel, handler] of channels) {
    ipcMain.handle(channel, (event, input) => {
      authorize(event);
      return handler(event, input);
    });
  }
  void service.initialize().finally(() => service.scheduleAutoCheck());

  return () => {
    service.dispose();
    for (const [channel] of channels) ipcMain.removeHandler(channel);
  };
}
