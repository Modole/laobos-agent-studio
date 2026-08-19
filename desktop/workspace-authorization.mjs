import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { boundedString, isPathInside } from "./ipc-security.mjs";

const MAX_AUTHORIZED_WORKSPACES = 64;

/**
 * Desktop tools run in Electron's main process and therefore need a boundary
 * independent from the renderer. The startup workspace is trusted immediately;
 * a DSH session outside it receives one native, persistent approval instead of
 * being rejected merely because it lives on another Windows drive.
 */
export class WorkspaceAuthorization {
  constructor({ defaultRoot, settings, dialog, getMainWindow }) {
    this.defaultRoot = defaultRoot;
    this.settings = settings;
    this.dialog = dialog;
    this.getMainWindow = getMainWindow;
    this.pending = new Map();
  }

  async roots() {
    const initial = await canonicalDirectory(this.defaultRoot);
    const saved = (await this.settings.get()).authorizedWorkspaces || [];
    const roots = [initial];
    for (const entry of saved) {
      try {
        const canonical = await canonicalDirectory(entry);
        if (!roots.some((root) => samePath(root, canonical))) roots.push(canonical);
      } catch {
        // A removed or temporarily unavailable drive must not break the app.
      }
    }
    return roots;
  }

  async resolve(requested, { label = "工作区", prompt = true } = {}) {
    const value = requested
      ? boundedString(requested, `${label}路径`, 4096)
      : this.defaultRoot;
    const absolute = path.isAbsolute(value)
      ? value
      : path.resolve(this.defaultRoot, value);
    const candidate = await canonicalDirectory(absolute);
    const roots = await this.roots();
    if (roots.some((root) => isPathInside(root, candidate))) return candidate;
    if (!prompt) throw unauthorizedWorkspaceError(candidate);
    return this.approve(candidate, label);
  }

  async approve(candidate, label) {
    const key = normalizeForComparison(candidate);
    if (this.pending.has(key)) return this.pending.get(key);
    const approval = this.requestApproval(candidate, label).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, approval);
    return approval;
  }

  async requestApproval(candidate, label) {
    const options = {
      type: "question",
      title: "授权工作区",
      message: `是否允许劳博士访问这个${label}？`,
      detail: `${candidate}\n\n授权仅覆盖该目录及其子目录，可让终端、文件、Git 和应用管理功能在普通用户模式下工作。`,
      buttons: ["允许访问", "取消"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const owner = this.getMainWindow?.();
    const result = owner && !owner.isDestroyed()
      ? await this.dialog.showMessageBox(owner, options)
      : await this.dialog.showMessageBox(options);
    if (result.response !== 0) throw unauthorizedWorkspaceError(candidate);

    const current = await this.settings.get();
    const saved = current.authorizedWorkspaces || [];
    const next = [...saved.filter((root) => !samePath(root, candidate)), candidate]
      .slice(-MAX_AUTHORIZED_WORKSPACES);
    await this.settings.update({ authorizedWorkspaces: next });
    return candidate;
  }
}

export async function resolveWorkspaceDirectory({
  authorizer,
  defaultRoot,
  requested,
  label,
}) {
  if (authorizer) return authorizer.resolve(requested, { label });
  const value = requested || defaultRoot;
  const candidate = path.isAbsolute(value)
    ? value
    : path.resolve(defaultRoot, value);
  const canonicalRoot = await canonicalDirectory(defaultRoot);
  const canonical = await canonicalDirectory(candidate);
  if (!isPathInside(canonicalRoot, canonical)) throw unauthorizedWorkspaceError(canonical);
  return canonical;
}

async function canonicalDirectory(value) {
  const canonical = await realpath(path.resolve(value));
  const info = await stat(canonical);
  if (!info.isDirectory()) throw new Error("目标工作区不是目录。 ");
  return canonical;
}

function unauthorizedWorkspaceError(candidate) {
  return new Error(`工作区尚未授权：${candidate}。请在授权提示中选择“允许访问”。`);
}

function samePath(left, right) {
  return normalizeForComparison(left) === normalizeForComparison(right);
}

function normalizeForComparison(value) {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
