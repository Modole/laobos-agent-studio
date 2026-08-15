#!/usr/bin/env node

import { access, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAll } from "@electron/asar";

const platformProvidedPackages = new Set(["electron"]);

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function packageDirectories(nodeModulesDirectory, result, visited) {
  if (visited.has(nodeModulesDirectory)) return;
  visited.add(nodeModulesDirectory);

  const entries = await readdir(nodeModulesDirectory, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(nodeModulesDirectory, entry.name);
    if (entry.name.startsWith("@")) {
      const scopedEntries = await readdir(entryPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory() && !scopedEntry.isSymbolicLink()) continue;
        const packageDirectory = path.join(entryPath, scopedEntry.name);
        result.add(packageDirectory);
        await packageDirectories(path.join(packageDirectory, "node_modules"), result, visited);
      }
      continue;
    }

    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    result.add(entryPath);
    await packageDirectories(path.join(entryPath, "node_modules"), result, visited);
  }
}

function requiredDependencies(manifest) {
  const optional = new Set(Object.keys(manifest.optionalDependencies || {}));
  const required = new Set(
    Object.keys(manifest.dependencies || {}).filter((name) => !optional.has(name)),
  );

  for (const name of Object.keys(manifest.peerDependencies || {})) {
    if (manifest.peerDependenciesMeta?.[name]?.optional !== true) required.add(name);
  }
  return [...required].sort();
}

async function resolvesInsideApp(appDirectory, packageDirectory, dependency) {
  if (platformProvidedPackages.has(dependency)) return true;
  let current = packageDirectory;
  while (current === appDirectory || current.startsWith(`${appDirectory}${path.sep}`)) {
    if (await exists(path.join(current, "node_modules", dependency, "package.json"))) return true;
    if (current === appDirectory) break;
    current = path.dirname(current);
  }
  return false;
}

async function verifyAppDirectory(appDirectory) {
  const rootManifestPath = path.join(appDirectory, "package.json");
  if (!(await exists(rootManifestPath))) {
    throw new Error(`安装包应用目录无效，缺少 package.json：${appDirectory}`);
  }

  const packageRoots = new Set([appDirectory]);
  await packageDirectories(path.join(appDirectory, "node_modules"), packageRoots, new Set());
  const missing = [];

  for (const packageDirectory of [...packageRoots].sort()) {
    const manifestPath = path.join(packageDirectory, "package.json");
    if (!(await exists(manifestPath))) continue;
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const owner = manifest.name || path.relative(appDirectory, packageDirectory) || "<app>";
    for (const dependency of requiredDependencies(manifest)) {
      if (!(await resolvesInsideApp(appDirectory, packageDirectory, dependency))) {
        missing.push({ dependency, owner });
      }
    }
  }

  if (missing.length > 0) {
    const rows = missing
      .map(({ dependency, owner }) => `- ${owner} -> ${dependency}`)
      .join("\n");
    throw new Error(`安装包缺少 ${missing.length} 项必需运行时依赖：\n${rows}`);
  }

  return { packageCount: packageRoots.size };
}

export async function verifyPackagedRuntime(appPathInput) {
  const appPath = path.resolve(appPathInput);
  const appInfo = await stat(appPath).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });
  if (!appInfo) throw new Error(`安装包应用路径不存在：${appPath}`);
  if (appInfo.isDirectory()) return verifyAppDirectory(appPath);
  if (!appInfo.isFile() || path.extname(appPath) !== ".asar") {
    throw new Error(`安装包应用路径必须是 resources/app 目录或 app.asar 文件：${appPath}`);
  }

  const extractedDirectory = await mkdtemp(path.join(tmpdir(), "laobos-runtime-verify-"));
  try {
    extractAll(appPath, extractedDirectory);
    return await verifyAppDirectory(extractedDirectory);
  } finally {
    await rm(extractedDirectory, { recursive: true, force: true });
  }
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const appPath = process.argv[2];
  if (!appPath) {
    throw new Error("用法：node scripts/verify-packaged-runtime.mjs <resources/app|resources/app.asar>");
  }
  const result = await verifyPackagedRuntime(appPath);
  console.log(`安装包运行时依赖完整：已检查 ${result.packageCount} 个包。`);
}
