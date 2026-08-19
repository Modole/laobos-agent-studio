import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { bundledPluginNames } from "../desktop/local-plugins.mjs";
import { normalizeSettings } from "../desktop/domains/desktop-settings.mjs";
import { DesktopUpdater } from "../desktop/domains/updater.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..");

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checks = 0;
    this.downloads = 0;
    this.installs = 0;
  }

  async checkForUpdates() {
    this.checks += 1;
    this.emit("checking-for-update");
    this.emit("update-available", {
      version: "0.3.0",
      releaseName: "劳博士 0.3.0",
      releaseNotes: "<p>更新说明</p>",
      releaseDate: "2026-08-16T10:00:00Z",
    });
    return { updateInfo: { version: "0.3.0" } };
  }

  async downloadUpdate() {
    this.downloads += 1;
    this.emit("download-progress", {
      percent: 50,
      bytesPerSecond: 1024,
      transferred: 512,
      total: 1024,
    });
    this.emit("update-downloaded", { version: "0.3.0" });
  }

  quitAndInstall() {
    this.installs += 1;
  }
}

function createSettings(initial = {}) {
  let value = normalizeSettings({ version: 5, ...initial });
  return {
    async get() {
      return { ...value };
    },
    async update(patch) {
      value = normalizeSettings({ ...value, ...patch });
      return { ...value };
    },
  };
}

function createUpdater(overrides = {}) {
  const updater = overrides.updater || new FakeUpdater();
  const messages = [];
  const service = new DesktopUpdater({
    updater,
    app: { isPackaged: true, getVersion: () => "0.2.3" },
    settings: overrides.settings || createSettings(),
    platform: overrides.platform || "darwin",
    getMainWindow: () => ({
      isDestroyed: () => false,
      webContents: { send: (channel, payload) => messages.push([channel, payload]) },
    }),
    now: overrides.now || (() => Date.parse("2026-08-16T12:00:00Z")),
    setTimer: overrides.setTimer,
    clearTimer: overrides.clearTimer,
  });
  return { service, updater, messages };
}

test("desktop updater checks, downloads, and installs through a constrained state machine", async () => {
  const fixture = createUpdater();

  const available = await fixture.service.check();
  assert.equal(available.phase, "available");
  assert.equal(available.currentVersion, "0.2.3");
  assert.equal(available.availableVersion, "0.3.0");
  assert.equal(available.releaseNotes, "更新说明");

  const downloaded = await fixture.service.download();
  assert.equal(downloaded.phase, "downloaded");
  assert.equal(fixture.updater.downloads, 1);

  const installing = await fixture.service.install();
  assert.equal(installing.phase, "installing");
  assert.equal(fixture.updater.installs, 1);
  assert.ok(fixture.messages.every(([channel]) => channel === "laobos:updates:state"));

  fixture.service.dispose();
});

test("automatic update checks are throttled to once per day", async () => {
  const updater = new FakeUpdater();
  const settings = createSettings({
    autoCheckUpdates: true,
    lastUpdateCheckAt: "2026-08-16T11:30:00.000Z",
  });
  const fixture = createUpdater({ updater, settings });

  const state = await fixture.service.check({ automatic: true });
  assert.equal(state.phase, "idle");
  assert.equal(updater.checks, 0);

  fixture.service.dispose();
});

test("development builds expose a disabled updater without touching the update provider", async () => {
  const updater = new FakeUpdater();
  const service = new DesktopUpdater({
    updater,
    app: { isPackaged: false, getVersion: () => "0.2.3" },
    settings: createSettings(),
    getMainWindow: () => undefined,
  });

  assert.deepEqual(service.snapshot(), {
    schema: 1,
    supported: false,
    phase: "disabled",
    currentVersion: "0.2.3",
    availableVersion: "",
    releaseName: "",
    releaseNotes: "",
    releaseDate: "",
    progress: null,
    cached: false,
    error: null,
  });
  await service.check();
  assert.equal(updater.checks, 0);
});

test("desktop settings migrate old data and preserve update preferences", () => {
  assert.deepEqual(normalizeSettings({ version: 2, uploadLocation: "workspace" }), {
    version: 5,
    uploadLocation: "workspace",
    autoCheckUpdates: true,
    lastUpdateCheckAt: null,
    pendingUpdate: null,
    authorizedWorkspaces: [],
  });
  assert.equal(
    normalizeSettings({
      version: 5,
      autoCheckUpdates: false,
      lastUpdateCheckAt: "2026-08-16T11:30:00.000Z",
    }).autoCheckUpdates,
    false,
  );
});

test("downloaded updates are restored from the updater cache after restart", async () => {
  const settings = createSettings({
    pendingUpdate: {
      version: "0.3.0",
      releaseName: "劳博士 0.3.0",
      releaseNotes: "已缓存的更新",
      releaseDate: "2026-08-16T10:00:00Z",
      downloadedAt: "2026-08-16T11:00:00Z",
    },
  });
  const fixture = createUpdater({ settings });

  const restored = await fixture.service.initialize();
  assert.equal(restored.phase, "downloaded");
  assert.equal(restored.cached, true);
  assert.equal(fixture.updater.checks, 1);
  assert.equal(fixture.updater.downloads, 1);
  fixture.service.dispose();
});

test("macOS installation errors keep the cached update available for retry", async () => {
  const fixture = createUpdater();
  await fixture.service.check();
  await fixture.service.download();
  fixture.updater.quitAndInstall = function quitAndInstall() {
    this.installs += 1;
    this.emit("error", new Error("未签名更新无法安装"));
  };

  const result = await fixture.service.install();
  assert.equal(result.phase, "downloaded");
  assert.equal(result.cached, true);
  assert.match(result.error.message, /未签名/u);
  fixture.service.dispose();
});

test("updater is built and deployed as a bundled DSH settings plugin", async () => {
  const [config, buildScript, preload, source] = await Promise.all([
    readFile(path.join(projectRoot, "config/laobos.cordis.patch.yml"), "utf8"),
    readFile(path.join(projectRoot, "scripts/build-desktop-plugins.mjs"), "utf8"),
    readFile(path.join(projectRoot, "desktop/preload.cjs"), "utf8"),
    readFile(path.join(projectRoot, "packages/laobos-updater/src/client.jsx"), "utf8"),
  ]);
  assert.equal(bundledPluginNames.includes("laobos-updater"), true);
  assert.match(config, /name: '@laobos\/dsh-updater'/u);
  assert.match(buildScript, /laobos-updater\/src\/client\.jsx/u);
  assert.match(preload, /laobos:updates:install/u);
  assert.match(source, /id: "laobos-software-update"/u);
  assert.match(source, /重启并安装/u);
});

test("release validator rejects missing files and accepts complete update metadata", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-release-"));
  const sha512 = "a".repeat(88);
  try {
    const validatorSource = await readFile(
      path.join(projectRoot, "scripts/verify-update-release.mjs"),
      "utf8",
    );
    assert.doesNotMatch(validatorSource, /from ["']yaml["']/u);
    const artifacts = [
      "laobos-studio-0.3.0-macos-arm64.dmg",
      "laobos-studio-0.3.0-macos-arm64.zip",
      "laobos-studio-0.3.0-windows-x64-setup.exe",
    ];
    for (const artifact of artifacts) {
      await writeFile(path.join(temporary, artifact), "fixture");
      await writeFile(path.join(temporary, `${artifact}.blockmap`), "fixture blockmap");
    }
    await writeFile(
      path.join(temporary, "latest-mac.yml"),
      `version: 0.3.0\nfiles:\n  - url: ${artifacts[1]}\n    sha512: ${sha512}\n`,
    );
    await assert.rejects(
      execFileAsync(process.execPath, ["scripts/verify-update-release.mjs", temporary, "0.3.0"], { cwd: projectRoot }),
      /latest\.yml/u,
    );
    await writeFile(
      path.join(temporary, "latest.yml"),
      `version: 0.3.0\nfiles:\n  - url: ${artifacts[2]}\n    sha512: ${sha512}\n`,
    );
    const result = await execFileAsync(
      process.execPath,
      ["scripts/verify-update-release.mjs", temporary, "0.3.0"],
      { cwd: projectRoot },
    );
    assert.match(result.stdout, /更新 Release 校验通过/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
