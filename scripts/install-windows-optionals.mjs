#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const WINDOWS_X64_OPTIONAL_PACKAGES = [
  "@koromix/koffi-win32-x64",
  "@img/sharp-win32-x64",
  "@next/swc-win32-x64-msvc",
  "@vscode/ripgrep-win32-x64",
  "node-addon-require-builtin-win32-x64-msvc",
];

const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const specifications = WINDOWS_X64_OPTIONAL_PACKAGES.map((packageName) => {
  const version = packageLock.packages?.[`node_modules/${packageName}`]?.version;
  if (!version) throw new Error(`package-lock.json 中缺少 ${packageName} 的锁定版本`);
  return `${packageName}@${version}`;
});

console.log(`准备 Windows x64 原生依赖：\n- ${specifications.join("\n- ")}`);
const npmArguments = [
  "install",
  "--no-save",
  "--ignore-scripts",
  "--force",
  "--legacy-peer-deps",
  ...specifications,
];

// Windows cannot execute npm.cmd directly with spawnSync({ shell: false }) on
// every supported Node release. npm exposes the JavaScript CLI path to scripts
// through npm_execpath, so invoke that CLI with the current Node executable.
// Keep a cmd.exe fallback for users who run this file directly instead of via
// `npm run desktop:prepare-windows`.
const npmExecPath = process.env.npm_execpath;
const npmExecutable = npmExecPath
  ? process.execPath
  : process.platform === "win32"
    ? process.env.ComSpec || "cmd.exe"
    : "npm";
const npmExecutableArguments = npmExecPath
  ? [npmExecPath, ...npmArguments]
  : process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd", ...npmArguments]
    : npmArguments;
const result = spawnSync(
  npmExecutable,
  npmExecutableArguments,
  { stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
