import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { resolvePhysicalAsarPath } from "../scripts/ensure-node-pty-helper.mjs";

export const bundledPluginNames = [
  "laobos-performance",
  "laobos-shell",
  "laobos-system-tools",
  "laobos-conversation-tools",
  "laobos-file-attachments",
  "laobos-workspace-tools",
  "laobos-terminal-ui",
  "laobos-browserops",
  "laobos-ssh",
  "laobos-app-manager",
  "laobos-market",
];

const markerName = ".laobos-managed-plugin.json";

function lstatIfPresent(target) {
  try {
    return lstatSync(target);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function pluginFingerprint(pluginDirectory) {
  const hash = createHash("sha256");

  function appendDirectory(directory, relativeDirectory = "") {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = path.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      hash.update(relative);
      hash.update("\0");
      if (entry.isDirectory()) {
        appendDirectory(absolute, relative);
      } else if (entry.isSymbolicLink()) {
        hash.update(readlinkSync(absolute));
      } else {
        hash.update(readFileSync(absolute));
      }
      hash.update("\0");
    }
  }

  appendDirectory(pluginDirectory);
  return hash.digest("hex");
}

function readManagedMarker(pluginDirectory) {
  try {
    return JSON.parse(readFileSync(path.join(pluginDirectory, markerName), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function assertReplaceable(pluginLink, pluginName, info) {
  if (!info || info.isSymbolicLink()) return;
  const marker = info.isDirectory() ? readManagedMarker(pluginLink) : undefined;
  if (marker?.schema === 1 && marker?.pluginName === pluginName) return;
  throw new Error(`DSH 本地插件位置已被其他文件占用：${pluginLink}`);
}

function ensureCopiedPlugin(pluginTarget, pluginLink, pluginName) {
  const fingerprint = pluginFingerprint(pluginTarget);
  const info = lstatIfPresent(pluginLink);
  assertReplaceable(pluginLink, pluginName, info);

  if (!info?.isSymbolicLink()) {
    const currentMarker = info?.isDirectory() ? readManagedMarker(pluginLink) : undefined;
    if (currentMarker?.fingerprint === fingerprint) return;
  }

  const temporary = `${pluginLink}.tmp-${process.pid}-${Date.now()}`;
  rmSync(temporary, { recursive: true, force: true });
  try {
    cpSync(pluginTarget, temporary, { recursive: true, force: true });
    writeFileSync(
      path.join(temporary, markerName),
      `${JSON.stringify({ schema: 1, pluginName, fingerprint })}\n`,
      { mode: 0o600 },
    );
    if (info) rmSync(pluginLink, { recursive: true, force: true });
    renameSync(temporary, pluginLink);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function ensureLinkedPlugin(pluginTarget, pluginLink, pluginName) {
  const info = lstatIfPresent(pluginLink);
  assertReplaceable(pluginLink, pluginName, info);

  if (info?.isSymbolicLink()) {
    const current = path.resolve(path.dirname(pluginLink), readlinkSync(pluginLink));
    if (current === pluginTarget) return;
  }
  if (info) rmSync(pluginLink, { recursive: true, force: true });
  symlinkSync(pluginTarget, pluginLink, "dir");
}

export function bundledPluginMode({ packaged = false, platform = process.platform } = {}) {
  return packaged || platform === "win32" ? "copy" : "link";
}

export function ensureBundledPlugins({
  studioRoot,
  dshHome,
  mode = bundledPluginMode(),
  pluginNames = bundledPluginNames,
}) {
  if (mode !== "copy" && mode !== "link") {
    throw new Error(`未知的内置插件部署方式：${mode}`);
  }

  for (const pluginName of pluginNames) {
    const pluginTarget = resolvePhysicalAsarPath(
      path.resolve(studioRoot, "packages", pluginName),
    );
    const packageName = pluginName.replace(/^laobos-/, "dsh-");
    const pluginLink = path.resolve(dshHome, "node_modules", "@laobos", packageName);
    mkdirSync(path.dirname(pluginLink), { recursive: true, mode: 0o700 });
    if (mode === "copy") ensureCopiedPlugin(pluginTarget, pluginLink, pluginName);
    else ensureLinkedPlugin(pluginTarget, pluginLink, pluginName);
  }
}
