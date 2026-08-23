#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function verifyPackagedExecutables(appExecutableInput, appAsarInput) {
  const appExecutable = path.resolve(appExecutableInput);
  const appAsar = path.resolve(appAsarInput);
  const probe = fileURLToPath(new URL("./probe-packaged-executables.cjs", import.meta.url));
  const result = spawnSync(appExecutable, [probe, appAsar], {
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    windowsHide: true,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `打包可执行组件启动校验失败（status=${String(result.status)}）\n`
      + `${result.stdout || ""}${result.stderr || ""}`,
    );
  }
  return result.stdout.trim();
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const [appExecutable, appAsar] = process.argv.slice(2);
  if (!appExecutable || !appAsar) {
    throw new Error(
      "用法：node scripts/verify-packaged-executables.mjs <应用可执行文件> <resources/app.asar>",
    );
  }
  console.log(verifyPackagedExecutables(appExecutable, appAsar));
}
