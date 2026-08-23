import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { bundledPluginNames } from "../desktop/local-plugins.mjs";
import {
  apply,
  createPluginExporterRuntime,
  inject,
} from "../packages/laobos-plugin-exporter/lib/index.js";
import {
  exportPluginPackage,
  inspectPluginDirectory,
  PluginExporterError,
} from "../packages/laobos-plugin-exporter/lib/exporter.js";

async function fixture(root, {
  name = "@example/dsh-weather",
  version = "1.2.3",
  clientId = name,
} = {}) {
  const plugin = path.join(root, "weather-plugin");
  await mkdir(path.join(plugin, "lib"), { recursive: true });
  await writeFile(path.join(plugin, "package.json"), `${JSON.stringify({
    name,
    version,
    description: "Weather test plugin",
    license: "MIT",
    type: "module",
    exports: {
      ".": "./lib/index.js",
      "./client": "./lib/client.js",
    },
    dsh: { client: { platform: "web", inject: ["@deepseek-ai/dsh-client-runtime"] } },
  }, null, 2)}\n`);
  await writeFile(path.join(plugin, "lib", "index.js"), "export function apply() {}\n");
  await writeFile(
    path.join(plugin, "lib", "client.js"),
    `window.__ModuleLoader__.load({ id: ${JSON.stringify(clientId)}, factory: () => ({ apply() {}, inject: [] }) });\n`,
  );
  await writeFile(path.join(plugin, "README.md"), "# Weather\n");
  return plugin;
}

function tarEntries(archive) {
  const data = gunzipSync(archive);
  const entries = [];
  for (let offset = 0; offset + 512 <= data.length;) {
    const header = data.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) break;
    const text = (start, end) => {
      const buffer = header.subarray(start, end);
      const zero = buffer.indexOf(0);
      return buffer.subarray(0, zero < 0 ? buffer.length : zero).toString("utf8");
    };
    const name = text(0, 100);
    const prefix = text(345, 500);
    const size = Number.parseInt(text(124, 136).trim() || "0", 8);
    entries.push(prefix ? `${prefix}/${name}` : name);
    offset += size + ((512 - (size % 512)) % 512);
  }
  return entries;
}

test("plugin exporter creates a deterministic market-compatible package and excludes secrets", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugin = await fixture(root);
  await mkdir(path.join(plugin, "node_modules", "ignored"), { recursive: true });
  await writeFile(path.join(plugin, "node_modules", "ignored", "index.js"), "secret dependency");
  await writeFile(path.join(plugin, ".env.local"), "TOKEN=do-not-package\n");
  await writeFile(path.join(plugin, "pass.txt"), "do-not-package\n");

  const inspection = await inspectPluginDirectory(plugin, { allowedRoot: root });
  assert.equal(inspection.ready, true);
  assert.equal(inspection.packageName, "@example/dsh-weather");
  assert.equal(inspection.hostEntry, "lib/index.js");
  assert.equal(inspection.clientEntry, "lib/client.js");
  assert.equal(inspection.excludedCount, 3);

  const first = await exportPluginPackage({ sourceDir: plugin, allowedRoot: root });
  const second = await exportPluginPackage({
    sourceDir: plugin,
    outputName: "repeat.tar.gz",
    allowedRoot: root,
  });
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.outputName, "example-dsh-weather-1.2.3.tar.gz");
  assert.equal(first.sizeBytes > 0, true);

  const entries = tarEntries(await readFile(first.outputPath));
  assert.equal(entries.includes("package/package.json"), true);
  assert.equal(entries.includes("package/lib/index.js"), true);
  assert.equal(entries.includes("package/lib/client.js"), true);
  assert.equal(entries.some((entry) => entry.includes("node_modules")), false);
  assert.equal(entries.some((entry) => entry.includes(".env")), false);
  assert.equal(entries.some((entry) => entry.includes("pass.txt")), false);
  assert.equal(entries.some((entry) => entry.includes(".laobos-exports")), false);
});

test("plugin exporter rejects mismatched client ids, symlinks, and workspace escapes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-invalid-"));
  const outside = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-outside-"));
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));
  const mismatch = await fixture(root, { clientId: "@example/not-the-package" });
  await assert.rejects(
    inspectPluginDirectory(mismatch),
    (error) => error instanceof PluginExporterError && error.code === "CLIENT_REGISTRATION_MISMATCH",
  );

  const valid = await fixture(outside, { name: "@example/outside" });
  await assert.rejects(
    inspectPluginDirectory(valid, { allowedRoot: root }),
    (error) => error instanceof PluginExporterError && error.code === "WORKSPACE_BOUNDARY",
  );

  const linkedRoot = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-link-"));
  t.after(() => rm(linkedRoot, { recursive: true, force: true }));
  const linked = await fixture(linkedRoot, { name: "@example/linked" });
  try {
    await symlink(path.join(linked, "README.md"), path.join(linked, "linked-readme"));
    await assert.rejects(
      inspectPluginDirectory(linked),
      (error) => error instanceof PluginExporterError && error.code === "PACKAGE_SYMLINK_UNSUPPORTED",
    );
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "EPERM") throw error;
  }

  const boundaryRoot = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-boundary-"));
  const boundaryOutside = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-destination-"));
  t.after(() => Promise.all([
    rm(boundaryRoot, { recursive: true, force: true }),
    rm(boundaryOutside, { recursive: true, force: true }),
  ]));
  await fixture(boundaryRoot, { name: "@example/boundary" });
  try {
    await symlink(boundaryOutside, path.join(boundaryRoot, "linked-output"), "dir");
    const runtime = createPluginExporterRuntime({ workspace: boundaryRoot });
    await assert.rejects(
      runtime.exportPackage({ sourceDir: "weather-plugin", outputDir: "linked-output/packages" }),
      (error) => error instanceof PluginExporterError && error.code === "OUTPUT_UNSAFE",
    );
    await assert.rejects(access(path.join(boundaryOutside, "packages")), { code: "ENOENT" });
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "EPERM") throw error;
  }
});

test("plugin exporter refuses accidental overwrite and supports explicit transactional replacement", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-overwrite-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugin = await fixture(root);
  const first = await exportPluginPackage({ sourceDir: plugin });
  await assert.rejects(
    exportPluginPackage({ sourceDir: plugin }),
    (error) => error instanceof PluginExporterError && error.code === "OUTPUT_EXISTS",
  );
  await writeFile(path.join(plugin, "README.md"), `# Updated\n${randomBytes(64).toString("hex")}\n`);
  const replacement = await exportPluginPackage({ sourceDir: plugin, overwrite: true });
  assert.equal(replacement.outputPath, first.outputPath);
  assert.notEqual(replacement.sha256, first.sha256);
  assert.equal(tarEntries(await readFile(replacement.outputPath)).includes("package/package.json"), true);
});

test("plugin exporter removes temporary output when compressed market limits are exceeded", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-limit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plugin = await fixture(root);
  await writeFile(path.join(plugin, "large-random.bin"), randomBytes(8 * 1024 * 1024 + 128 * 1024));
  await assert.rejects(
    exportPluginPackage({ sourceDir: plugin }),
    (error) => error instanceof PluginExporterError && error.code === "PACKAGE_COMPRESSED_LIMIT",
  );
  assert.deepEqual(await readdir(path.join(plugin, ".laobos-exports")), []);
});

test("plugin exporter stays a bundled Host-only Agent tool with approval", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-plugin-exporter-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await fixture(root);
  const runtime = createPluginExporterRuntime({ workspace: root });
  assert.equal((await runtime.inspect({ sourceDir: "weather-plugin" })).ready, true);
  const result = await runtime.exportPackage({ sourceDir: "weather-plugin" });
  assert.equal(result.outputRelative.startsWith("weather-plugin/.laobos-exports/"), true);
  await assert.rejects(
    runtime.inspect({ sourceDir: "../" }),
    (error) => error instanceof PluginExporterError && error.code === "WORKSPACE_BOUNDARY",
  );

  const tools = [];
  const hooks = [];
  apply({
    on(name, listener) { hooks.push({ name, listener }); },
    systemPrompt: { section() {} },
    tools: { register(tool) { tools.push(tool); return () => {}; } },
  });
  assert.deepEqual(inject, ["tools", "systemPrompt"]);
  assert.equal(tools.some((tool) => tool.name === "plugin_package_export"), true);
  const approval = hooks.find((hook) => hook.name === "tools/pre-execute");
  assert.equal((await approval.listener({
    name: "plugin_package_export",
    arguments: { action: "export", sourceDir: "weather-plugin", reason: "manual market upload" },
  }, async () => ({ kind: "allow" }))).kind, "ask");

  const [manifestText, host, buildScript, config] = await Promise.all([
    readFile(new URL("../packages/laobos-plugin-exporter/package.json", import.meta.url), "utf8"),
    readFile(new URL("../packages/laobos-plugin-exporter/lib/index.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-desktop-plugins.mjs", import.meta.url), "utf8"),
    readFile(new URL("../config/laobos.cordis.patch.yml", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(bundledPluginNames.includes("laobos-plugin-exporter"), true);
  assert.match(config, /@laobos\/dsh-plugin-exporter/u);
  assert.equal(manifest.exports["./client"], undefined);
  assert.equal(manifest.dsh, undefined);
  assert.doesNotMatch(buildScript, /laobos-plugin-exporter/u);
  assert.doesNotMatch(host, /webServer|laobos\.project\.integration|\/laobos\/api\/plugin-exporter/u);
  await assert.rejects(
    access(new URL("../packages/laobos-plugin-exporter/src/client.jsx", import.meta.url)),
    { code: "ENOENT" },
  );
  await assert.rejects(
    access(new URL("../packages/laobos-plugin-exporter/lib/client.js", import.meta.url)),
    { code: "ENOENT" },
  );
});
