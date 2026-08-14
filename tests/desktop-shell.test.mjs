import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.doesNotMatch(mainSource, /bridge-process|resolvePiBinary|PI_STUDIO_PI_BIN/);
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
  assert.match(workflow, /runs-on: macos-15/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.equal(workflow.match(/npm run audit:public/g)?.length, 2);
  assert.equal(workflow.match(/actions\/upload-artifact@v7/g)?.length, 2);
});
