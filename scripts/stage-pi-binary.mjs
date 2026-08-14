#!/usr/bin/env node

import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const executable = process.platform === "win32" ? "pi.exe" : "pi";
const platformDirectory = `${process.platform}-${process.arch}`;
const explicitBinary = process.env.PI_STUDIO_PACKAGE_PI_BIN;
const explicitDirectory = process.env.PI_STUDIO_PACKAGE_PI_DIR;
const siblingBinary = path.resolve(
  projectRoot,
  "..",
  "pi-mono",
  "packages",
  "coding-agent",
  "dist",
  executable,
);
const sourceDirectory = explicitDirectory
  ? path.resolve(explicitDirectory)
  : path.dirname(explicitBinary ? path.resolve(explicitBinary) : siblingBinary);
const source = explicitBinary
  ? path.resolve(explicitBinary)
  : path.join(sourceDirectory, executable);

if (!existsSync(source)) {
  throw new Error(
    [
      `找不到可打包的劳博士引擎：${source}`,
      "请先在相邻 pi-mono 中构建当前平台二进制，",
      "或设置 PI_STUDIO_PACKAGE_PI_BIN 指向已有的引擎可执行文件。",
    ].join("\n"),
  );
}

const destinationDirectory = path.join(
  projectRoot,
  "resources",
  "pi",
  platformDirectory,
);
const destination = path.join(destinationDirectory, executable);
await rm(destinationDirectory, { recursive: true, force: true });
await mkdir(destinationDirectory, { recursive: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true });
if (process.platform !== "win32") await chmod(destination, 0o755);
console.log(`已准备劳博士引擎：resources/pi/${platformDirectory}/${executable}`);
