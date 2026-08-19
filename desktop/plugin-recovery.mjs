import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const pendingPluginFileName = ".laobos-plugin-pending.json";
export const pluginRecoveryFileName = ".laobos-plugin-recovery.json";

export function webProfileDirectory(dshHome) {
  return path.join(dshHome, "profiles", "web");
}

export function pendingPluginPath(dshHome) {
  return path.join(webProfileDirectory(dshHome), pendingPluginFileName);
}

export function pluginRecoveryPath(dshHome) {
  return path.join(webProfileDirectory(dshHome), pluginRecoveryFileName);
}

function patchPath(dshHome) {
  return path.join(webProfileDirectory(dshHome), "cordis.patch.yml");
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  }
}

async function writeFileAtomic(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2
    && ((trimmed.startsWith("'") && trimmed.endsWith("'"))
      || (trimmed.startsWith('"') && trimmed.endsWith('"')))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read the effective disabled flag for every entry touched by a profile patch.
 * The profile market emits a deliberately small YAML subset, so preserving the
 * original text is safer than parsing and serializing the whole file.
 */
export function profileEntryStates(patch) {
  const lines = String(patch).split(/\r?\n/u);
  const states = new Map();
  const inserted = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)-\s+id:\s*([^#]+?)\s*$/u.exec(lines[index]);
    if (!match) continue;
    const indentation = match[1].length;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const line = lines[cursor];
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      const leading = /^\s*/u.exec(line)?.[0].length ?? 0;
      if (leading >= indentation) continue;
      if (/^\s*-\s+insert:\s*$/u.test(line)) {
        inserted.add(unquoteYamlScalar(match[2]));
      }
      break;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)-\s+id:\s*([^#]+?)\s*$/u.exec(lines[index]);
    if (!match) continue;
    const indentation = match[1].length;
    const id = unquoteYamlScalar(match[2]);
    if (!inserted.has(id)) continue;
    let disabled;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (!line.trim() || line.trimStart().startsWith("#")) continue;
      const leading = /^\s*/u.exec(line)?.[0].length ?? 0;
      if (leading <= indentation && /^\s*-\s/u.test(line)) break;
      const disabledMatch = /^\s*disabled:\s*(true|false)\s*(?:#.*)?$/iu.exec(line);
      if (disabledMatch) disabled = disabledMatch[1].toLowerCase() === "true";
    }

    if (!states.has(id)) states.set(id, false);
    if (disabled !== undefined) states.set(id, disabled);
  }

  return states;
}

export async function readPendingPlugin(dshHome) {
  const pending = await readJsonIfPresent(pendingPluginPath(dshHome));
  if (
    pending?.schema !== 1
    || typeof pending.entryId !== "string"
    || typeof pending.packageName !== "string"
  ) return undefined;
  return pending;
}

export async function clearPendingPlugin(dshHome) {
  await rm(pendingPluginPath(dshHome), { force: true });
}

/**
 * Disable the pending market plugin, or every active user-profile plugin when
 * no pending marker exists. The original patch is retained for manual or
 * programmatic restoration.
 */
export async function quarantineUserPlugins(dshHome, reason) {
  const profilePatchPath = patchPath(dshHome);
  let originalPatch;
  try {
    originalPatch = await readFile(profilePatchPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { changed: false, entryIds: [] };
    throw error;
  }

  const states = profileEntryStates(originalPatch);
  const pending = await readPendingPlugin(dshHome);
  const requested = pending ? [pending.entryId] : [...states.keys()];
  const entryIds = [...new Set(requested)].filter((id) => states.get(id) !== true);
  if (entryIds.length === 0) return { changed: false, entryIds: [], pending };

  const recovery = {
    schema: 1,
    createdAt: new Date().toISOString(),
    reason: String(reason || "plugin startup failure"),
    entryIds,
    pending,
    originalPatch,
  };
  await writeFileAtomic(
    pluginRecoveryPath(dshHome),
    `${JSON.stringify(recovery, null, 2)}\n`,
  );

  const suffix = [
    "",
    "# 劳博士安全模式：以下用户插件因启动失败而自动停用。",
    ...entryIds.flatMap((id) => [
      `- id: '${id.replaceAll("'", "''")}'`,
      "  disabled: true",
    ]),
    "",
  ].join("\n");
  await writeFileAtomic(profilePatchPath, `${originalPatch.replace(/\s*$/u, "")}\n${suffix}`);
  await clearPendingPlugin(dshHome);
  return { changed: true, entryIds, pending, recoveryPath: pluginRecoveryPath(dshHome) };
}

export async function restoreLastPluginRecovery(dshHome) {
  const recoveryFile = pluginRecoveryPath(dshHome);
  const recovery = await readJsonIfPresent(recoveryFile);
  if (recovery?.schema !== 1 || typeof recovery.originalPatch !== "string") {
    return false;
  }
  await writeFileAtomic(patchPath(dshHome), recovery.originalPatch);
  await rm(recoveryFile, { force: true });
  return true;
}
