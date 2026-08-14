import path from "node:path";
import { realpath, stat } from "node:fs/promises";

export function assertTrustedDesktopSender(event, { getMainWindow, getRuntimeUrl }) {
  const window = getMainWindow();
  if (!window || window.isDestroyed() || event.sender !== window.webContents) {
    throw new Error("未经授权的桌面调用。 ");
  }

  const runtimeUrl = getRuntimeUrl();
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (!runtimeUrl || !sameOrigin(senderUrl, runtimeUrl)) {
    throw new Error("桌面调用来源不受信任。 ");
  }
}

export async function resolveAuthorizedPath(root, requested = ".", options = {}) {
  const rootPath = await realpath(path.resolve(root));
  const candidate = path.resolve(rootPath, requested || ".");
  if (!isPathInside(rootPath, candidate)) {
    throw new Error("路径超出已授权工作区。 ");
  }

  const resolved = await realpath(candidate);
  if (!isPathInside(rootPath, resolved)) {
    throw new Error("路径通过符号链接离开了已授权工作区。 ");
  }

  const info = await stat(resolved);
  if (options.kind === "file" && !info.isFile()) {
    throw new Error("目标不是文件。 ");
  }
  if (options.kind === "directory" && !info.isDirectory()) {
    throw new Error("目标不是目录。 ");
  }
  return { path: resolved, root: rootPath, stat: info };
}

export function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function boundedString(value, label, maxLength = 4096) {
  if (typeof value !== "string") throw new TypeError(`${label} 必须是字符串。`);
  if (value.length > maxLength) throw new Error(`${label} 过长。`);
  return value;
}

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}
