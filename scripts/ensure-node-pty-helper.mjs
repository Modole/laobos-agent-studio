#!/usr/bin/env node

import { chmodSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * node-pty uses a small executable helper for PTY creation on macOS. Some
 * package/install flows preserve the file contents but strip its executable
 * bit, which makes node-pty surface the unhelpful `posix_spawnp failed` error.
 */
export function ensureExecutableFile(filePath) {
  const currentMode = statSync(filePath).mode;
  if ((currentMode & 0o111) !== 0o111) {
    chmodSync(filePath, currentMode | 0o111);
    return true;
  }
  return false;
}

export function resolvePhysicalAsarPath(filePath) {
  const archiveBoundary = `.asar${path.sep}`;
  const archiveIndex = filePath.indexOf(archiveBoundary);
  if (archiveIndex === -1) return filePath;
  return `${filePath.slice(0, archiveIndex)}.asar.unpacked${path.sep}${filePath.slice(archiveIndex + archiveBoundary.length)}`;
}

export function ensureNodePtySpawnHelper(projectRoot) {
  if (process.platform !== "darwin") return undefined;

  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  let nodePtyEntry;
  try {
    nodePtyEntry = requireFromProject.resolve("node-pty");
  } catch (error) {
    throw new Error(
      `找不到 node-pty，无法准备 Bash 运行环境：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const nodePtyRoot = path.dirname(path.dirname(nodePtyEntry));
  const helperPath = resolvePhysicalAsarPath(path.join(
    nodePtyRoot,
    "prebuilds",
    `${process.platform}-${process.arch}`,
    "spawn-helper",
  ));

  try {
    ensureExecutableFile(helperPath);
  } catch (error) {
    throw new Error(
      `无法修复 Bash 运行助手的执行权限（${helperPath}）：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return helperPath;
}

const isCommandLineEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  ensureNodePtySpawnHelper(projectRoot);
}
