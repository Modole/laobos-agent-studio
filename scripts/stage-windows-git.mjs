#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

const execFileAsync = promisify(execFile);
const openZip = promisify(yauzl.open);
const MINGIT_VERSION = "2.55.0.4";
const MINGIT_TAG = "v2.55.0.windows.4";
const MINGIT_ARCHIVE = `MinGit-${MINGIT_VERSION}-64-bit.zip`;
const MINGIT_SHA256 = "4e03f94c2ffbf70be337e005cee02661c732dbfc81031a078bda9299b9a7d644";
const MINGIT_URL = `https://github.com/git-for-windows/git/releases/download/${MINGIT_TAG}/${MINGIT_ARCHIVE}`;
const MAX_ENTRIES = 20_000;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

export default async function stageWindowsGitBeforePack(context) {
  if (context.electronPlatformName !== "win32") return;
  await stageWindowsGit(context.packager.projectDir);
}

export async function stageWindowsGit(projectDirectory) {
  const resourcesDirectory = path.join(projectDirectory, "resources", "mingit-win32-x64");
  const gitExecutable = path.join(resourcesDirectory, "cmd", "git.exe");
  if (await exists(gitExecutable)) return { resourcesDirectory, gitExecutable, cached: true };

  const cacheDirectory = path.join(projectDirectory, ".cache", "laobos-build");
  await mkdir(cacheDirectory, { recursive: true });
  const configuredArchive = process.env.LAOBOS_MINGIT_ARCHIVE?.trim();
  const archivePath = configuredArchive
    ? path.resolve(configuredArchive)
    : path.join(cacheDirectory, MINGIT_ARCHIVE);

  if (!(await validArchive(archivePath))) {
    if (configuredArchive) {
      throw new Error(`LAOBOS_MINGIT_ARCHIVE 的 SHA-256 不匹配：${archivePath}`);
    }
    await downloadArchive(archivePath);
    if (!(await validArchive(archivePath))) {
      throw new Error(`MinGit 下载校验失败：${archivePath}`);
    }
  }

  const resourcesRoot = path.dirname(resourcesDirectory);
  await mkdir(resourcesRoot, { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(resourcesRoot, ".mingit-win32-x64-"));
  try {
    await extractZipSafely(archivePath, temporaryDirectory);
    if (!(await exists(path.join(temporaryDirectory, "cmd", "git.exe")))) {
      throw new Error("MinGit 压缩包中缺少 cmd\\git.exe。");
    }
    await rm(resourcesDirectory, { recursive: true, force: true });
    await rename(temporaryDirectory, resourcesDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
  return { resourcesDirectory, gitExecutable, cached: false };
}

async function downloadArchive(archivePath) {
  const partialPath = `${archivePath}.partial-${process.pid}`;
  const curl = process.platform === "win32" ? "curl.exe" : "curl";
  await rm(partialPath, { force: true });
  try {
    await execFileAsync(curl, [
      "--fail",
      "--location",
      "--retry", "3",
      "--retry-all-errors",
      "--connect-timeout", "30",
      "--output", partialPath,
      MINGIT_URL,
    ], { timeout: 10 * 60_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    await rename(partialPath, archivePath);
  } catch (error) {
    await rm(partialPath, { force: true });
    throw new Error(`下载 Windows MinGit 失败：${error?.message || error}`);
  }
}

async function validArchive(archivePath) {
  try {
    const value = await readFile(archivePath);
    return createHash("sha256").update(value).digest("hex") === MINGIT_SHA256;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function extractZipSafely(archivePath, destination) {
  const zip = await openZip(archivePath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true });
  let entryCount = 0;
  let totalBytes = 0;
  try {
    await new Promise((resolve, reject) => {
      zip.once("error", reject);
      zip.once("end", resolve);
      zip.on("entry", async (entry) => {
        try {
          entryCount += 1;
          totalBytes += entry.uncompressedSize;
          if (entryCount > MAX_ENTRIES || totalBytes > MAX_UNCOMPRESSED_BYTES) {
            throw new Error("MinGit 压缩包超过安全解压限制。");
          }
          const relativePath = safeArchivePath(entry.fileName);
          const target = path.join(destination, ...relativePath.split("/"));
          const unixMode = entry.externalFileAttributes >>> 16;
          if ((unixMode & 0o170000) === 0o120000) throw new Error(`MinGit 压缩包包含符号链接：${entry.fileName}`);
          if (entry.fileName.endsWith("/")) {
            await mkdir(target, { recursive: true });
          } else {
            await mkdir(path.dirname(target), { recursive: true });
            const stream = await openEntryStream(zip, entry);
            await pipeline(stream, createWriteStream(target, { flags: "wx" }));
          }
          zip.readEntry();
        } catch (error) {
          reject(error);
        }
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

function safeArchivePath(fileName) {
  if (!fileName || fileName.includes("\\") || fileName.includes("\0") || fileName.startsWith("/")) {
    throw new Error(`MinGit 压缩包路径无效：${fileName}`);
  }
  const segments = fileName.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`MinGit 压缩包路径越界：${fileName}`);
  }
  return segments.join("/");
}

function openEntryStream(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => error ? reject(error) : resolve(stream));
  });
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const projectDirectory = path.resolve(process.argv[2] || ".");
  const result = await stageWindowsGit(projectDirectory);
  console.log(`Windows MinGit 已准备：${result.gitExecutable}${result.cached ? "（缓存）" : ""}`);
}
