#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFile } from "@electron/asar";

const WINDOWS_X64_NATIVE_FILES = [
  [
    "Bundled MinGit Windows x64",
    ["git", "cmd", "git.exe"],
  ],
  [
    "Koffi Windows x64",
    ["app.asar.unpacked", "node_modules", "@koromix", "koffi-win32-x64", "win32_x64", "koffi.node"],
  ],
  [
    "Sharp Windows x64",
    ["app.asar.unpacked", "node_modules", "@img", "sharp-win32-x64", "lib", "sharp-win32-x64-0.35.3.node"],
  ],
  [
    "Sharp libvips Windows x64",
    ["app.asar.unpacked", "node_modules", "@img", "sharp-win32-x64", "lib", "libvips-42.dll"],
  ],
  [
    "Next SWC Windows x64",
    ["app.asar.unpacked", "node_modules", "@next", "swc-win32-x64-msvc", "next-swc.win32-x64-msvc.node"],
  ],
  [
    "ripgrep Windows x64",
    ["app.asar.unpacked", "node_modules", "@vscode", "ripgrep-win32-x64", "bin", "rg.exe"],
  ],
  [
    "Node builtin loader Windows x64",
    ["app.asar.unpacked", "node_modules", "node-addon-require-builtin-win32-x64-msvc", "prebuilt", "win32-x64-msvc-napi-v9.node"],
  ],
  [
    "node-pty ConPTY Windows x64",
    ["app.asar.unpacked", "node_modules", "node-pty", "prebuilds", "win32-x64", "conpty.node"],
  ],
  [
    "node-pty ConPTY process list Windows x64",
    ["app.asar.unpacked", "node_modules", "node-pty", "prebuilds", "win32-x64", "conpty_console_list.node"],
  ],
  [
    "node-pty ConPTY compatibility DLL Windows x64",
    ["app.asar.unpacked", "node_modules", "node-pty", "prebuilds", "win32-x64", "conpty", "conpty.dll"],
  ],
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function verifyKoffiNativeVersion(resourcesDirectoryInput) {
  const resourcesDirectory = path.resolve(resourcesDirectoryInput);
  const appArchive = path.join(resourcesDirectory, "app.asar");
  const nativeManifestPath = path.join(
    resourcesDirectory,
    "app.asar.unpacked",
    "node_modules",
    "@koromix",
    "koffi-win32-x64",
    "package.json",
  );

  let koffiManifest;
  try {
    koffiManifest = JSON.parse(
      extractFile(appArchive, "node_modules/koffi/package.json").toString("utf8"),
    );
  } catch (error) {
    throw new Error(`无法读取安装包中的 Koffi 主包版本：${appArchive}`, { cause: error });
  }

  let nativeManifest;
  try {
    nativeManifest = JSON.parse(await readFile(nativeManifestPath, "utf8"));
  } catch (error) {
    throw new Error(`无法读取 Koffi Windows 原生模块版本：${nativeManifestPath}`, { cause: error });
  }

  const nativePackageName = "@koromix/koffi-win32-x64";
  const declaredVersion = koffiManifest.optionalDependencies?.[nativePackageName];
  if (
    koffiManifest.version !== nativeManifest.version
    || declaredVersion !== nativeManifest.version
  ) {
    throw new Error(
      `Koffi Windows 原生模块版本不匹配：koffi=${koffiManifest.version ?? "未知"}，`
      + `${nativePackageName}=${nativeManifest.version ?? "未知"}，声明版本=${declaredVersion ?? "未声明"}`,
    );
  }

  return { version: koffiManifest.version };
}

export async function verifyWindowsPackagedRuntime(resourcesDirectoryInput) {
  const resourcesDirectory = path.resolve(resourcesDirectoryInput);
  const missing = [];

  for (const [label, segments] of WINDOWS_X64_NATIVE_FILES) {
    const target = path.join(resourcesDirectory, ...segments);
    if (!(await exists(target))) {
      missing.push(`${label}: ${target}`);
      continue;
    }
    const header = await readFile(target, { encoding: null, flag: "r" });
    if (header.length < 2 || header[0] !== 0x4d || header[1] !== 0x5a) {
      throw new Error(`${label} 不是有效的 Windows PE 文件：${target}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Windows 安装包缺少平台原生模块：\n- ${missing.join("\n- ")}`);
  }
  const koffi = await verifyKoffiNativeVersion(resourcesDirectory);
  return { nativeFileCount: WINDOWS_X64_NATIVE_FILES.length, koffiVersion: koffi.version };
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const resourcesDirectory = process.argv[2];
  if (!resourcesDirectory) {
    throw new Error("用法：node scripts/verify-windows-packaged-runtime.mjs <resources目录>");
  }
  const result = await verifyWindowsPackagedRuntime(resourcesDirectory);
  console.log(
    `Windows x64 原生运行时校验通过：${result.nativeFileCount} 个文件，Koffi ${result.koffiVersion}。`,
  );
}
