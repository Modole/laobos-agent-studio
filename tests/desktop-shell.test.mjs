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

  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /startDshRuntime/);
  assert.match(mainSource, /migratePiOnFirstRun/);
  assert.match(mainSource, /setPermissionRequestHandler/);
  assert.match(mainSource, /app\.setPath\("userData", path\.join\(app\.getPath\("appData"\), "劳博士 Dev"\)\)/);
  assert.match(mainSource, /const productName = isDevelopment \? "劳博士（开发版）" : "劳博士"/);
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

test("desktop development starts Electron without the legacy Pi renderer bridge", async () => {
  const packageJson = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );

  assert.match(packageJson, /"desktop:dev": "npm run build:desktop-plugins && electron \."/);
  assert.match(packageJson, /"dev": "npm run build:desktop-plugins && node scripts\/start-dsh\.mjs"/);
});

test("desktop release configuration builds native macOS and Windows installers", async () => {
  const [packageJson, builderConfig, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../electron-builder.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/installers.yml", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"desktop:installer": "npm run build:desktop-plugins && electron-builder --publish never"/);
  assert.match(builderConfig, /target: dmg[\s\S]*arch:\n\s+- arm64/);
  assert.match(builderConfig, /artifactName: "laobos-studio-\$\{version\}-macos-\$\{arch\}\.\$\{ext\}"/);
  assert.match(builderConfig, /target: nsis[\s\S]*arch:\n\s+- x64/);
  assert.match(builderConfig, /artifactName: "laobos-studio-\$\{version\}-windows-\$\{arch\}-setup\.\$\{ext\}"/);
  assert.match(builderConfig, /asar: true/);
  assert.match(builderConfig, /asarUnpack:[\s\S]*"packages\/\*\*"/);
  assert.match(builderConfig, /compression: normal/);
  assert.match(builderConfig, /npmRebuild: false/);
  assert.match(builderConfig, /!node_modules\/cpu-features/);
  assert.match(builderConfig, /!node_modules\/node-pty\/prebuilds\/darwin-/);
  assert.equal(builderConfig.match(/!resources\/pi/g)?.length, 2);
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.equal(workflow.match(/npm run audit:public/g)?.length, 2);
  assert.equal(workflow.match(/verify-packaged-runtime\.mjs/g)?.length, 2);
  assert.equal(workflow.match(/app\.asar/g)?.length, 2);
  assert.equal(workflow.match(/actions\/upload-artifact@v7/g)?.length, 2);
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
