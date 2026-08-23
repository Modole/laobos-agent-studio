import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

test("the public client excludes private account and cloud-login runtime", async () => {
  assert.equal(await exists("packages/laobos-cloud-auth"), false);
  assert.equal(await exists("desktop/domains/cloud-auth-profile.mjs"), false);

  const protectedFiles = [
    "config/laobos.cordis.patch.yml",
    "desktop/local-plugins.mjs",
    "desktop/preload.cjs",
    "desktop/register-desktop-domains.mjs",
    "scripts/build-desktop-plugins.mjs",
    "package.json",
  ];
  for (const relativePath of protectedFiles) {
    const source = await text(relativePath);
    assert.doesNotMatch(source, /laobos-cloud-auth|cloudAuth|laobos-cloud/u, relativePath);
    assert.doesNotMatch(source, /leaplab\.deepseek\.com|cyberedu\.deepseek\.com/u, relativePath);
  }

  const manifest = JSON.parse(await text("package.json"));
  const dependencyNames = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
    ...manifest.overrides,
  });
  assert.equal(dependencyNames.includes("@deepseek-ai/dsh-llm-pi-ai"), false);
  assert.equal(dependencyNames.includes("@deepseek-ai/dsh-web"), false);
  assert.equal(dependencyNames.includes("@earendil-works/pi-ai"), false);
});

test("the public client keeps local 0.3.17 feature plugins", async () => {
  const localPlugins = await text("desktop/local-plugins.mjs");
  const composedConfig = await text("config/laobos.cordis.patch.yml");
  const buildScript = await text("scripts/build-desktop-plugins.mjs");
  for (const pluginName of [
    "laobos-context-window",
    "laobos-platform-bridge",
    "laobos-plugin-exporter",
  ]) {
    assert.match(localPlugins, new RegExp(`\\b${pluginName}\\b`, "u"), pluginName);
    assert.match(composedConfig, new RegExp(`\\b${pluginName}\\b`, "u"), pluginName);
  }
  assert.match(buildScript, /laobos-context-window/u);
  assert.match(buildScript, /laobos-platform-bridge/u);
});
