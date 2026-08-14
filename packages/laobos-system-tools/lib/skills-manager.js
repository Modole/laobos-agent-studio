import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse, stringify } from "yaml";
import { SystemToolsError } from "./store.js";

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_SKILL_CHARACTERS = 500_000;

function fail(code, message, status = 400) {
  throw new SystemToolsError(code, message, status);
}

function skillRoots({ dshHome, workspace }) {
  const candidates = [
    {
      id: "project-dsh",
      scope: "项目",
      source: "DSH",
      path: path.join(workspace, ".dsh", "skills"),
      writable: true,
      rank: 100,
    },
    {
      id: "project-agents",
      scope: "项目",
      source: "Agents",
      path: path.join(workspace, ".agents", "skills"),
      writable: true,
      rank: 200,
    },
    {
      id: "user-dsh",
      scope: "用户",
      source: "DSH",
      path: path.join(dshHome, "skills"),
      writable: true,
      rank: 400,
    },
    {
      id: "user-agents",
      scope: "用户",
      source: "Agents",
      path: path.join(
        process.env.DSH_AGENTS_HOME || path.join(os.homedir(), ".agents"),
        "skills",
      ),
      writable: true,
      rank: 500,
    },
  ];

  const seen = new Set();
  return candidates.filter((root) => {
    const normalized = path.resolve(root.path);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    root.path = normalized;
    return true;
  });
}

function splitMarkdown(text, fallbackName) {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(normalized);
  let metadata = {};
  let body = normalized;
  let warning;

  if (match) {
    try {
      metadata = parse(match[1]) || {};
      if (typeof metadata !== "object" || Array.isArray(metadata)) metadata = {};
      body = normalized.slice(match[0].length);
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }
  }

  const name =
    typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : fallbackName;
  const description =
    typeof metadata.description === "string" ? metadata.description.trim() : "";
  const whenToUse =
    typeof metadata.whenToUse === "string" ? metadata.whenToUse.trim() : "";

  return {
    name,
    description,
    whenToUse,
    disableModelInvocation:
      metadata["disable-model-invocation"] === true,
    userInvocable: metadata["user-invocable"] !== false,
    body,
    ...(warning ? { warning } : {}),
  };
}

function skillId(filePath) {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function decodeSkillId(id) {
  try {
    return path.resolve(Buffer.from(String(id), "base64url").toString("utf8"));
  } catch {
    fail("SKILL_ID_INVALID", "Skill ID 无效。");
  }
}

function inside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

async function candidateForFile(root, filePath, kind, enabled) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) return undefined;
  const text = await readFile(filePath, "utf8");
  const fallbackName =
    kind === "bundle"
      ? path.basename(path.dirname(filePath))
      : path.basename(filePath).replace(/\.md(?:\.disabled)?$/u, "");
  const parsed = splitMarkdown(text, fallbackName);
  return {
    id: skillId(filePath),
    rootId: root.id,
    rootPath: root.path,
    scope: root.scope,
    source: root.source,
    rank: root.rank,
    writable: root.writable,
    path: filePath,
    kind,
    enabled,
    revision: `${Math.trunc(info.mtimeMs)}:${info.size}`,
    ...parsed,
  };
}

export class SkillsManager {
  constructor({ dshHome, workspace }) {
    this.roots = skillRoots({
      dshHome: path.resolve(dshHome),
      workspace: path.resolve(workspace),
    });
  }

  async list() {
    const skills = [];
    for (const root of this.roots) {
      const entries = await readdir(root.path, { withFileTypes: true }).catch(
        (error) => (error?.code === "ENOENT" ? [] : Promise.reject(error)),
      );
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          const enabledPath = path.join(root.path, entry.name, "SKILL.md");
          const disabledPath = path.join(
            root.path,
            entry.name,
            "SKILL.md.disabled",
          );
          const enabled = await stat(enabledPath).catch(() => undefined);
          const disabled = enabled
            ? undefined
            : await stat(disabledPath).catch(() => undefined);
          const filePath = enabled ? enabledPath : disabled ? disabledPath : "";
          if (!filePath) continue;
          const candidate = await candidateForFile(
            root,
            filePath,
            "bundle",
            Boolean(enabled),
          );
          if (candidate) skills.push(candidate);
          continue;
        }

        if (
          entry.isFile() &&
          /\.md(?:\.disabled)?$/u.test(entry.name) &&
          !/^SKILL\.md/u.test(entry.name)
        ) {
          const candidate = await candidateForFile(
            root,
            path.join(root.path, entry.name),
            "file",
            !entry.name.endsWith(".disabled"),
          );
          if (candidate) skills.push(candidate);
        }
      }
    }

    skills.sort(
      (left, right) =>
        left.rank - right.rank ||
        left.name.localeCompare(right.name, "zh-CN"),
    );
    return {
      roots: this.roots.map((root) => ({
        id: root.id,
        scope: root.scope,
        source: root.source,
        path: root.path,
        rank: root.rank,
        writable: root.writable,
      })),
      skills,
    };
  }

  root(rootId) {
    const root = this.roots.find((candidate) => candidate.id === rootId);
    if (!root) fail("SKILL_ROOT_INVALID", "Skill 作用域不存在。");
    if (!root.writable) fail("SKILL_ROOT_READ_ONLY", "该 Skill 来源只读。", 403);
    return root;
  }

  existing(id) {
    const filePath = decodeSkillId(id);
    const root = this.roots.find((candidate) => inside(candidate.path, filePath));
    if (!root) fail("SKILL_PATH_REJECTED", "Skill 不在允许的目录中。", 403);
    return { filePath, root };
  }

  async save(input) {
    const name = String(input.name || "").trim();
    if (!SKILL_NAME.test(name)) {
      fail("SKILL_NAME_INVALID", "Skill 名称必须使用 kebab-case。");
    }
    const description = String(input.description || "").trim();
    if (!description || description.length > 500) {
      fail("SKILL_DESCRIPTION_INVALID", "Skill 说明必须为 1–500 个字符。");
    }
    const whenToUse = String(input.whenToUse || "").trim().slice(0, 2_000);
    const body = String(input.body || "").replace(/\r\n?/gu, "\n").trim();
    if (body.length > MAX_SKILL_CHARACTERS) {
      fail("SKILL_TOO_LARGE", "Skill 内容不能超过 500,000 个字符。");
    }

    let root;
    let currentPath;
    let kind = "bundle";
    if (input.id) {
      ({ root, filePath: currentPath } = this.existing(input.id));
      const info = await lstat(currentPath).catch((error) =>
        error?.code === "ENOENT" ? undefined : Promise.reject(error),
      );
      if (!info?.isFile() || info.isSymbolicLink()) {
        fail("SKILL_NOT_FOUND", "Skill 不存在或不可编辑。", 404);
      }
      const revision = `${Math.trunc(info.mtimeMs)}:${info.size}`;
      if (input.expectedRevision && input.expectedRevision !== revision) {
        fail("REVISION_CONFLICT", "Skill 已被其他操作修改。", 409);
      }
      kind = path.basename(currentPath).startsWith("SKILL.md")
        ? "bundle"
        : "file";
    } else {
      root = this.root(input.rootId || "project-dsh");
    }

    const enabled = input.enabled !== false;
    let targetPath;
    if (currentPath) {
      targetPath =
        kind === "bundle"
          ? path.join(
              path.dirname(currentPath),
              enabled ? "SKILL.md" : "SKILL.md.disabled",
            )
          : currentPath.replace(
              /\.md(?:\.disabled)?$/u,
              enabled ? ".md" : ".md.disabled",
            );
    } else {
      targetPath = path.join(
        root.path,
        name,
        enabled ? "SKILL.md" : "SKILL.md.disabled",
      );
    }

    if (!inside(root.path, path.resolve(targetPath))) {
      fail("SKILL_PATH_REJECTED", "Skill 写入路径越界。", 403);
    }

    const metadata = {
      name,
      description,
      ...(whenToUse ? { whenToUse } : {}),
      "disable-model-invocation": input.disableModelInvocation === true,
      "user-invocable": input.userInvocable !== false,
    };
    const text = `---\n${stringify(metadata).trim()}\n---\n\n${body}\n`;
    await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, targetPath);
    if (process.platform !== "win32") await chmod(targetPath, 0o600);
    if (currentPath && currentPath !== targetPath) {
      await unlink(currentPath).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }

    const result = await this.list();
    return result.skills.find((skill) => skill.path === targetPath);
  }

  async remove(id, expectedRevision) {
    const { filePath } = this.existing(id);
    const info = await lstat(filePath).catch((error) =>
      error?.code === "ENOENT" ? undefined : Promise.reject(error),
    );
    if (!info?.isFile() || info.isSymbolicLink()) {
      fail("SKILL_NOT_FOUND", "Skill 不存在或不可删除。", 404);
    }
    const revision = `${Math.trunc(info.mtimeMs)}:${info.size}`;
    if (expectedRevision && expectedRevision !== revision) {
      fail("REVISION_CONFLICT", "Skill 已被其他操作修改。", 409);
    }
    await unlink(filePath);
    return { deleted: true, id };
  }
}
