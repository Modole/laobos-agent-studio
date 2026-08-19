import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  pendingPluginFileName,
  pluginRecoveryFileName,
  profileEntryStates,
  quarantineUserPlugins,
  restoreLastPluginRecovery,
} from "../desktop/plugin-recovery.mjs";
import {
  MarketError,
  validatePluginPackage,
} from "../packages/laobos-market/lib/market.js";

async function createPluginFixture(root, registrationId = "@fixture/dsh-plugin") {
  const pluginDirectory = path.join(root, "plugin");
  await mkdir(path.join(pluginDirectory, "lib"), { recursive: true });
  await writeFile(path.join(pluginDirectory, "lib", "index.js"), "export function apply() {}\n");
  await writeFile(
    path.join(pluginDirectory, "lib", "client.js"),
    `window.__ModuleLoader__.load({ id: ${JSON.stringify(registrationId)}, factory: () => ({}) });\n`,
  );
  return pluginDirectory;
}

test("market preflight rejects a client bundle that registers the wrong module id", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-preflight-"));
  try {
    const pluginDirectory = await createPluginFixture(root, "@fixture/wrong-id");
    const pkg = {
      name: "@fixture/dsh-plugin",
      main: "./lib/index.js",
      exports: {
        ".": "./lib/index.js",
        "./client": "./lib/client.js",
      },
      dsh: { client: { platform: "web", inject: [] } },
    };

    assert.throws(
      () => validatePluginPackage(pkg, pluginDirectory),
      (error) => error instanceof MarketError && error.code === "CLIENT_REGISTRATION_MISMATCH",
    );

    await writeFile(
      path.join(pluginDirectory, "lib", "client.js"),
      "window.__ModuleLoader__.load({ id: '@fixture/dsh-plugin', factory: () => ({}) });\n",
    );
    const result = validatePluginPackage(pkg, pluginDirectory);
    assert.equal(result.packageName, "@fixture/dsh-plugin");
    assert.equal(result.hostEntry, path.join(pluginDirectory, "lib", "index.js"));
    assert.equal(result.clientEntry, path.join(pluginDirectory, "lib", "client.js"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("safe mode quarantines only the pending user plugin and preserves core overrides", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-recovery-"));
  const profile = path.join(root, "profiles", "web");
  const patchPath = path.join(profile, "cordis.patch.yml");
  const originalPatch = [
    "- id: web",
    "  config:",
    "    searchProvider: fixture",
    "- insert:",
    "    - id: plugin-a",
    "      name: '@fixture/plugin-a'",
    "    - id: plugin-b",
    "      name: '@fixture/plugin-b'",
    "- id: plugin-b",
    "  disabled: true",
    "",
  ].join("\n");

  try {
    await mkdir(profile, { recursive: true });
    await writeFile(patchPath, originalPatch);
    await writeFile(
      path.join(profile, pendingPluginFileName),
      `${JSON.stringify({ schema: 1, entryId: "plugin-a", packageName: "@fixture/plugin-a" })}\n`,
    );

    assert.deepEqual(
      [...profileEntryStates(originalPatch)],
      [["plugin-a", false], ["plugin-b", true]],
    );
    const recovery = await quarantineUserPlugins(root, "client import failed");
    assert.deepEqual(recovery.entryIds, ["plugin-a"]);
    const quarantined = await readFile(patchPath, "utf8");
    assert.match(quarantined, /- id: 'plugin-a'\n  disabled: true/u);
    assert.doesNotMatch(quarantined, /- id: 'web'\n  disabled: true/u);
    await assert.rejects(readFile(path.join(profile, pendingPluginFileName)), /ENOENT/u);
    assert.equal(JSON.parse(await readFile(path.join(profile, pluginRecoveryFileName))).reason, "client import failed");

    assert.equal(await restoreLastPluginRecovery(root), true);
    assert.equal(await readFile(patchPath, "utf8"), originalPatch);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("safe mode without a pending marker disables every active inserted plugin", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-safe-mode-"));
  const profile = path.join(root, "profiles", "web");
  const patchPath = path.join(profile, "cordis.patch.yml");
  try {
    await mkdir(profile, { recursive: true });
    await writeFile(patchPath, [
      "- id: core-setting",
      "  config: {}",
      "- insert:",
      "    - id: plugin-a",
      "      name: '@fixture/plugin-a'",
      "    - id: plugin-b",
      "      name: '@fixture/plugin-b'",
      "- id: plugin-b",
      "  disabled: true",
      "",
    ].join("\n"));

    const recovery = await quarantineUserPlugins(root, "host boot failed");
    assert.deepEqual(recovery.entryIds, ["plugin-a"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
