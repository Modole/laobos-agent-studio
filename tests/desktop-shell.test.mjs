import assert from "node:assert/strict";
import { createPackage } from "@electron/asar";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanGeneratedFallback } from "../desktop/dsh-asar-bootstrap.mjs";
import {
  fileImportSpecifier,
  summarizeDshFailureOutput,
} from "../desktop/dsh-runtime.mjs";
import { verifyPackagedRuntime } from "../scripts/verify-packaged-runtime.mjs";
import { verifyDesktopResources } from "../scripts/verify-desktop-resources.mjs";
import { verifyWindowsPackagedRuntime } from "../scripts/verify-windows-packaged-runtime.mjs";

test("desktop runtime startup errors retain useful child-process output", () => {
  assert.equal(
    summarizeDshFailureOutput("\u001b[31mError: missing native package\u001b[0m\r\n"),
    "Error: missing native package",
  );
  assert.equal(summarizeDshFailureOutput("abcdef", 4), "…cdef");
});

test("desktop runtime passes ESM preloads as file URLs", () => {
  const specifier = fileImportSpecifier(path.resolve("resources", "app.asar", "desktop", "bootstrap.mjs"));
  assert.match(specifier, /^file:\/\//);
  assert.doesNotMatch(specifier, /^[a-zA-Z]:/);
});

test("packaged runtime removes stale generated profile links before healing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-fallback-cleanup-"));
  const fallback = path.join(root, "profiles", "node_modules");
  const target = path.join(root, "old-app.asar", "node_modules", "plugin");
  const link = path.join(fallback, "plugin");
  await mkdir(fallback, { recursive: true });
  await symlink(target, link);

  cleanGeneratedFallback(fallback);
  await assert.rejects(readFile(link), /ENOENT/);
  await rm(root, { recursive: true, force: true });
});

test("development runtime removes ASAR client proxies before DSH heals links", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "laobos-proxy-cleanup-"));
  const fallback = path.join(root, "profiles", "node_modules");
  const proxy = path.join(fallback, "@deepseek-ai", "dsh-cordis-client-runner");
  const regularPackage = path.join(fallback, "third-party-package");
  await mkdir(proxy, { recursive: true });
  await mkdir(regularPackage, { recursive: true });
  await writeFile(path.join(proxy, ".laobos-asar-client-proxy"), "@deepseek-ai/dsh-cordis-client-runner\n");
  await writeFile(path.join(regularPackage, "package.json"), "{}\n");

  cleanGeneratedFallback(fallback);
  await assert.rejects(readFile(path.join(proxy, ".laobos-asar-client-proxy")), /ENOENT/);
  assert.equal(await readFile(path.join(regularPackage, "package.json"), "utf8"), "{}\n");
  await rm(root, { recursive: true, force: true });
});

test("desktop shell boots DSH directly with a sandboxed renderer", async () => {
  const mainSource = await readFile(
    new URL("../desktop/main.mjs", import.meta.url),
    "utf8",
  );
  const permissionSource = await readFile(
    new URL("../desktop/permissions.mjs", import.meta.url),
    "utf8",
  );

  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /startDshRuntime/);
  assert.match(mainSource, /migratePiOnFirstRun/);
  assert.match(mainSource, /installPermissionPolicy/);
  assert.match(mainSource, /bootRuntimeWithPluginRecovery/);
  assert.match(mainSource, /quarantineUserPlugins/);
  assert.match(mainSource, /Failed to load plugins/);
  assert.match(permissionSource, /setPermissionCheckHandler/);
  assert.match(permissionSource, /setPermissionRequestHandler/);
  assert.match(permissionSource, /clipboard-sanitized-write/);
  assert.match(mainSource, /app\.setPath\("userData", path\.join\(app\.getPath\("appData"\), "劳博士 Dev"\)\)/);
  assert.match(mainSource, /const productName = isDevelopment \? "劳博士（开发版）" : "劳博士"/);
  assert.match(mainSource, /before-quit-for-update/);
  assert.match(mainSource, /event\.preventDefault\(\)[\s\S]*prepareToQuit\(\)[\s\S]*app\.quit\(\)/);
  assert.doesNotMatch(mainSource, /bridge-process|resolvePiBinary|PI_STUDIO_PI_BIN/);

  const runtimeSource = await readFile(
    new URL("../desktop/dsh-runtime.mjs", import.meta.url),
    "utf8",
  );
  assert.match(runtimeSource, /dsh-asar-bootstrap\.mjs/);
  assert.match(runtimeSource, /"--import"/);
  assert.match(runtimeSource, /fileImportSpecifier\(asarBootstrap\)/);
  assert.match(runtimeSource, /laobos\.windows\.cordis\.patch\.yml/);
});

test("desktop mode does not expose the manual Bridge connection dialog", async () => {
  const studioSource = await readFile(
    new URL("../app/studio.tsx", import.meta.url),
    "utf8",
  );

  assert.match(studioSource, /connectOpen && !desktopManaged/);
  assert.match(studioSource, /内置劳博士服务正在启动/);
  assert.match(studioSource, /劳博士已就绪/);
});

test("studio falls back to file uploads for images unsupported by the selected model", async () => {
  const studioSource = await readFile(
    new URL("../app/studio.tsx", import.meta.url),
    "utf8",
  );

  assert.match(studioSource, /const imagesAsFiles = Boolean\(/);
  assert.match(studioSource, /imageMode: imagesAsFiles \? "file" : "multimodal"/);
  assert.doesNotMatch(studioSource, /当前模型不支持图片，请切换到支持视觉输入的模型/);
});

test("desktop development starts Electron without the legacy Pi renderer bridge", async () => {
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );

  assert.match(packageJson, /"desktop:dev": "npm run build:desktop-plugins && electron \."/);
  assert.match(packageJson, /"dev": "npm run build:desktop-plugins && node scripts\/start-dsh\.mjs"/);
});

test("desktop release configuration builds native macOS and Windows installers", async () => {
  const [packageJson, builderConfig, testUpdateConfig, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../electron-builder.yml", import.meta.url), "utf8"),
    readFile(new URL("../electron-builder.test-update.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/installers.yml", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"desktop:installer": "npm run build:desktop-plugins && electron-builder --publish never"/);
  assert.match(packageJson, /"desktop:installer:test-update"/);
  assert.match(testUpdateConfig, /identity: "-"/);
  assert.match(testUpdateConfig, /hardenedRuntime: false/);
  assert.match(testUpdateConfig, /afterSign: \.\/scripts\/sign-test-update\.mjs/);
  assert.match(builderConfig, /target: dmg[\s\S]*arch:\n\s+- arm64/);
  assert.match(builderConfig, /artifactName: "laobos-studio-\$\{version\}-macos-\$\{arch\}\.\$\{ext\}"/);
  assert.match(builderConfig, /target: nsis[\s\S]*arch:\n\s+- x64/);
  assert.match(builderConfig, /artifactName: "laobos-studio-\$\{version\}-windows-\$\{arch\}-setup\.\$\{ext\}"/);
  assert.match(builderConfig, /asar: true/);
  assert.match(builderConfig, /asarUnpack:[\s\S]*"packages\/\*\*"/);
  assert.match(builderConfig, /compression: normal/);
  assert.match(builderConfig, /npmRebuild: false/);
  assert.match(builderConfig, /beforePack: \.\/scripts\/stage-windows-git\.mjs/);
  assert.match(builderConfig, /extraResources:[\s\S]*from: resources\/mingit-win32-x64[\s\S]*to: git/);
  assert.match(builderConfig, /!node_modules\/cpu-features/);
  assert.match(builderConfig, /!node_modules\/node-pty\/prebuilds\/darwin-/);
  assert.equal(builderConfig.match(/!resources\/pi/g)?.length, 2);
  assert.equal(builderConfig.match(/!resources\/mingit-win32-x64/g)?.length, 2);
  assert.equal(builderConfig.match(/!\.cache/g)?.length, 2);
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.equal(workflow.match(/npm run audit:public/g)?.length, 1);
  assert.match(workflow, /RELEASE_REPOSITORY: Modole\/laobos-agent-studio/);
  assert.equal(workflow.match(/verify-packaged-runtime\.mjs/g)?.length, 2);
  assert.equal(workflow.match(/verify-desktop-resources\.mjs/g)?.length, 2);
  assert.equal(workflow.match(/verify-windows-packaged-runtime\.mjs/g)?.length, 1);
  assert.equal(workflow.match(/app\.asar/g)?.length, 2);
  assert.equal(workflow.match(/actions\/upload-artifact@v7/g)?.length, 2);
  assert.match(builderConfig, /target: zip[\s\S]*arch:\n\s+- arm64/);
  assert.match(builderConfig, /repo: laobos-agent-studio/);
  assert.match(workflow, /latest-mac\.yml/);
  assert.match(workflow, /latest\.yml/);
  assert.match(workflow, /github\.ref_type == 'tag'/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(workflow, /RELEASES_TOKEN|production-release/);
  assert.match(workflow, /desktop:installer:test-update/);
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY: false/);
  assert.match(workflow, /sha256sum \* > SHA256SUMS/);
});

test("Windows packaged runtime verification rejects missing platform binaries", async () => {
  const resourcesDirectory = await mkdtemp(path.join(tmpdir(), "laobos-windows-runtime-test-"));
  try {
    await assert.rejects(
      verifyWindowsPackagedRuntime(resourcesDirectory),
      /Koffi Windows x64/,
    );
  } finally {
    await rm(resourcesDirectory, { recursive: true, force: true });
  }
});

test("desktop resource verification rejects a package without its local brand asset", async () => {
  const resourcesDirectory = await mkdtemp(path.join(tmpdir(), "laobos-desktop-resources-test-"));
  try {
    await assert.rejects(verifyDesktopResources(resourcesDirectory), /缺少插件品牌 Logo/);
  } finally {
    await rm(resourcesDirectory, { recursive: true, force: true });
  }
});

test("packaged runtime verification supports an ASAR application", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "laobos-asar-runtime-test-"));
  const appDirectory = path.join(fixtureRoot, "app");
  const archivePath = path.join(fixtureRoot, "app.asar");

  try {
    await mkdir(appDirectory, { recursive: true });
    await writeFile(path.join(appDirectory, "package.json"), JSON.stringify({
      name: "fixture-asar-app",
    }));
    await createPackage(appDirectory, archivePath);
    assert.deepEqual(await verifyPackagedRuntime(archivePath), { packageCount: 1 });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("packaged runtime verification rejects a missing required peer dependency", async () => {
  const appDirectory = await mkdtemp(path.join(tmpdir(), "laobos-packaged-runtime-test-"));
  const hostDirectory = path.join(appDirectory, "node_modules", "fixture-host");
  const peerDirectory = path.join(appDirectory, "node_modules", "fixture-peer");

  try {
    await mkdir(hostDirectory, { recursive: true });
    await writeFile(path.join(appDirectory, "package.json"), JSON.stringify({
      name: "fixture-app",
      dependencies: { "fixture-host": "1.0.0" },
    }));
    await writeFile(path.join(hostDirectory, "package.json"), JSON.stringify({
      name: "fixture-host",
      version: "1.0.0",
      peerDependencies: { "fixture-peer": "^1.0.0" },
    }));

    await assert.rejects(
      verifyPackagedRuntime(appDirectory),
      /fixture-host -> fixture-peer/,
    );

    await mkdir(peerDirectory, { recursive: true });
    await writeFile(path.join(peerDirectory, "package.json"), JSON.stringify({
      name: "fixture-peer",
      version: "1.0.0",
    }));
    assert.deepEqual(await verifyPackagedRuntime(appDirectory), { packageCount: 3 });
  } finally {
    await rm(appDirectory, { recursive: true, force: true });
  }
});
