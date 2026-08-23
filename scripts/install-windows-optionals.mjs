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
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(
  npmExecutable,
  [
    "install",
    "--no-save",
    "--ignore-scripts",
    "--force",
    "--legacy-peer-deps",
    ...specifications,
  ],
  { stdio: "inherit", env: process.env },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
