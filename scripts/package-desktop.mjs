#!/usr/bin/env node

import { packager } from "@electron/packager";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
export async function packageDesktop() {
  const outputPaths = await packager({
    dir: projectRoot,
    out: path.join(projectRoot, "out"),
    name: "劳博士",
    executableName: "laobos-studio",
    appBundleId: "com.laobos.studio",
    icon: process.platform === "darwin"
      ? path.join(projectRoot, "build", "laobos-icon.icns")
      : path.join(projectRoot, "public", "laobos-logo.png"),
    appVersion: packageJson.version,
    electronVersion: packageJson.devDependencies.electron,
    platform: process.platform,
    arch: process.arch,
    asar: false,
    overwrite: true,
    prune: true,
    ignore: [
      /^\/\.dsh($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.next($|\/)/,
      /^\/\.vinext($|\/)/,
      /^\/\.wrangler($|\/)/,
      /^\/dist($|\/)/,
      /^\/dist-desktop($|\/)/,
      /^\/outputs($|\/)/,
      /^\/tests($|\/)/,
    ],
  });

  for (const outputPath of outputPaths) {
    console.log(`桌面应用已生成：${path.relative(projectRoot, outputPath)}`);
  }
  return outputPaths;
}

const isCommandLineEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCommandLineEntry) {
  await packageDesktop();
}
