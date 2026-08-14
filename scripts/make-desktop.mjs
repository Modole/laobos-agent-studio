#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageDesktop } from "./package-desktop.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${command} 失败（code=${String(code)}, signal=${String(signal)}）`,
          ),
        );
      }
    });
  });
}

if (process.platform !== "darwin") {
  throw new Error("当前安装器脚本只支持 macOS。");
}

const [outputDirectory] = await packageDesktop();
const appPath = path.join(outputDirectory, "劳博士.app");
const makeDirectory = path.join(projectRoot, "out", "make");
const artifactBase = path.join(
  makeDirectory,
  `laobos-studio-${packageJson.version}-${process.platform}-${process.arch}`,
);
await rm(makeDirectory, { recursive: true, force: true });
await mkdir(makeDirectory, { recursive: true });

const signingIdentity =
  process.env.LAOBOS_CODESIGN_IDENTITY ||
  process.env.PI_STUDIO_CODESIGN_IDENTITY ||
  "-";
await run("codesign", [
  "--force",
  "--deep",
  "--sign",
  signingIdentity,
  appPath,
]);

await run("ditto", [
  "-c",
  "-k",
  "--sequesterRsrc",
  "--keepParent",
  appPath,
  `${artifactBase}.zip`,
]);
await run("hdiutil", [
  "create",
  "-volname",
  "劳博士",
  "-srcfolder",
  appPath,
  "-ov",
  "-format",
  "UDZO",
  `${artifactBase}.dmg`,
]);

console.log(`ZIP 已生成：${path.relative(projectRoot, `${artifactBase}.zip`)}`);
console.log(`DMG 已生成：${path.relative(projectRoot, `${artifactBase}.dmg`)}`);
