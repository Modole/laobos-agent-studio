import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  bundledPluginNames,
  bundledPluginMode,
  ensureBundledPlugins,
} from "../desktop/local-plugins.mjs";

test("the public client bundles local features without private account plugins", () => {
  assert.equal(bundledPluginNames.includes("laobos-updater"), true);
  assert.equal(bundledPluginNames.includes("laobos-cloud-auth"), false);
  assert.equal(bundledPluginNames.includes("laobos-context-window"), false);
});

test("Windows and packaged clients deploy bundled plugins without privileged symlinks", () => {
  assert.equal(bundledPluginMode({ platform: "win32" }), "copy");
  assert.equal(bundledPluginMode({ packaged: true, platform: "darwin" }), "copy");
  assert.equal(bundledPluginMode({ packaged: false, platform: "darwin" }), "link");
});

test("copied bundled plugins update by content fingerprint and reject unmanaged collisions", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-plugin-copy-test-"));
  const studioRoot = path.join(temporary, "studio");
  const dshHome = path.join(temporary, "dsh");
  const pluginName = "laobos-fixture";
  const source = path.join(studioRoot, "packages", pluginName);
  const installed = path.join(dshHome, "node_modules", "@laobos", "dsh-fixture");

  try {
    await mkdir(path.join(source, "lib"), { recursive: true });
    await mkdir(path.join(source, "assets"), { recursive: true });
    await writeFile(path.join(source, "package.json"), JSON.stringify({
      name: "@laobos/dsh-fixture",
      version: "1.0.0",
    }));
    await writeFile(path.join(source, "lib", "index.js"), "export default 1;\n");
    await writeFile(path.join(source, "assets", "logo.png"), "fixture-logo");

    ensureBundledPlugins({
      studioRoot,
      dshHome,
      mode: "copy",
      pluginNames: [pluginName],
    });
    assert.equal((await lstat(installed)).isSymbolicLink(), false);
    assert.equal(await readFile(path.join(installed, "lib", "index.js"), "utf8"), "export default 1;\n");
    assert.equal(await readFile(path.join(installed, "assets", "logo.png"), "utf8"), "fixture-logo");

    await writeFile(path.join(source, "lib", "index.js"), "export default 2;\n");
    ensureBundledPlugins({
      studioRoot,
      dshHome,
      mode: "copy",
      pluginNames: [pluginName],
    });
    assert.equal(await readFile(path.join(installed, "lib", "index.js"), "utf8"), "export default 2;\n");

    await rm(installed, { recursive: true });
    await mkdir(installed, { recursive: true });
    assert.throws(
      () => ensureBundledPlugins({
        studioRoot,
        dshHome,
        mode: "copy",
        pluginNames: [pluginName],
      }),
      /本地插件位置已被其他文件占用/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("packaged plugins copy from the physical ASAR unpack directory", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-asar-plugin-copy-test-"));
  const studioRoot = path.join(temporary, "resources", "app.asar");
  const dshHome = path.join(temporary, "dsh");
  const pluginName = "laobos-fixture";
  const source = path.join(
    temporary,
    "resources",
    "app.asar.unpacked",
    "packages",
    pluginName,
  );
  const installed = path.join(dshHome, "node_modules", "@laobos", "dsh-fixture");

  try {
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, "package.json"), JSON.stringify({
      name: "@laobos/dsh-fixture",
      version: "1.0.0",
    }));
    ensureBundledPlugins({
      studioRoot,
      dshHome,
      mode: "copy",
      pluginNames: [pluginName],
    });
    assert.equal((await lstat(installed)).isDirectory(), true);
    assert.equal(
      JSON.parse(await readFile(path.join(installed, "package.json"), "utf8")).name,
      "@laobos/dsh-fixture",
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
