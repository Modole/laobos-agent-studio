#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyDesktopResources(resourcesDirectoryInput) {
  const resourcesDirectory = path.resolve(resourcesDirectoryInput);
  const logoPath = path.join(
    resourcesDirectory,
    "app.asar.unpacked",
    "packages",
    "laobos-system-tools",
    "assets",
    "laobos-logo.png",
  );
  const logo = await readFile(logoPath).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new Error(`桌面包缺少插件品牌 Logo：${logoPath}`);
    }
    throw error;
  });
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (logo.length < 100_000 || pngSignature.some((byte, index) => logo[index] !== byte)) {
    throw new Error(`桌面包品牌 Logo 不是预期的完整 PNG：${logoPath}`);
  }
  return { logoPath, logoBytes: logo.length };
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const resourcesDirectory = process.argv[2];
  if (!resourcesDirectory) {
    throw new Error("用法：node scripts/verify-desktop-resources.mjs <resources目录>");
  }
  const result = await verifyDesktopResources(resourcesDirectory);
  console.log(`桌面品牌资源校验通过：${result.logoBytes} 字节。`);
}
