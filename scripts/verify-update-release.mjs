#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function parseScalar(value) {
  const scalar = value.trim();
  if (scalar.startsWith('"') && scalar.endsWith('"')) return JSON.parse(scalar);
  if (scalar.startsWith("'") && scalar.endsWith("'")) {
    return scalar.slice(1, -1).replaceAll("''", "'");
  }
  return scalar;
}

function parseUpdateMetadata(source, name) {
  const lines = source.split(/\r?\n/u);
  const versionLine = lines.find((line) => /^version\s*:/u.test(line));
  const version = versionLine ? parseScalar(versionLine.replace(/^version\s*:/u, "")) : undefined;
  const files = [];
  let inFiles = false;
  let currentFile;

  for (const line of lines) {
    if (/^files\s*:\s*$/u.test(line)) {
      inFiles = true;
      continue;
    }
    if (!inFiles) continue;
    if (line.trim() && !/^\s/u.test(line)) break;

    const url = line.match(/^\s*-\s+url\s*:\s*(.+?)\s*$/u);
    if (url) {
      currentFile = { url: parseScalar(url[1]) };
      files.push(currentFile);
      continue;
    }
    const sha512 = line.match(/^\s+sha512\s*:\s*(.+?)\s*$/u);
    if (sha512 && currentFile) currentFile.sha512 = parseScalar(sha512[1]);
  }

  if (version === undefined) throw new Error(`${name} 缺少版本号。`);
  return { version, files };
}

const directory = path.resolve(process.argv[2] || "out/installers");
const expectedVersion = process.argv[3] || "";
const names = new Set(await readdir(directory));

for (const name of ["latest.yml", "latest-mac.yml"]) {
  if (!names.has(name)) throw new Error(`缺少更新元数据：${name}`);
  const document = parseUpdateMetadata(await readFile(path.join(directory, name), "utf8"), name);
  if (expectedVersion && document?.version !== expectedVersion) {
    throw new Error(`${name} 版本 ${String(document?.version)} 与 ${expectedVersion} 不一致。`);
  }
  const files = Array.isArray(document?.files) ? document.files : [];
  if (files.length === 0) throw new Error(`${name} 没有声明更新文件。`);
  for (const file of files) {
    const artifact = path.basename(String(file?.url || ""));
    if (!artifact || !names.has(artifact)) {
      throw new Error(`${name} 引用了不存在的文件：${String(file?.url || "")}`);
    }
    if (typeof file?.sha512 !== "string" || file.sha512.length < 80) {
      throw new Error(`${name} 中 ${artifact} 缺少有效的 SHA-512。`);
    }
    if (!names.has(`${artifact}.blockmap`)) {
      throw new Error(`${name} 中 ${artifact} 缺少对应的 blockmap。`);
    }
  }
}

const hasMacInstaller = [...names].some((name) => /macos-arm64\.dmg$/u.test(name));
const hasWindowsInstaller = [...names].some((name) => /windows-x64-setup\.exe$/u.test(name));
if (!hasMacInstaller) throw new Error("缺少 macOS ARM64 DMG。");
if (!hasWindowsInstaller) throw new Error("缺少 Windows x64 安装器。");

console.log(`更新 Release 校验通过：${names.size} 个文件。`);
