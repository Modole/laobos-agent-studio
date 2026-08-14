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
