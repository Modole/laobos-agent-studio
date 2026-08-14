import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { boundedString, isPathInside, resolveAuthorizedPath } from "../ipc-security.mjs";

const MAX_DIRECTORY_ENTRIES = 2_000;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_BINARY_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BATCH_BYTES = 50 * 1024 * 1024;
const SENSITIVE_NAMES = new Set([
  ".env",
  ".env.local",
  ".npmrc",
  ".pypirc",
  "credentials",
  "credentials.json",
  "id_rsa",
  "id_ed25519",
]);

export function registerWorkspaceFilesIpc({
  ipcMain,
  dialog,
  shell,
  workspace,
  dshHome,
  getMainWindow,
  settings,
  authorize,
}) {
  ipcMain.handle("laobos:workspace:context", async (event) => {
    authorize(event);
    return { root: workspace, settings: await settings.get() };
  });

  ipcMain.handle("laobos:workspace:list", async (event, input = {}) => {
    authorize(event);
    const root = await authorizedRoot(workspace, input.root);
    const relative = boundedString(input.path || ".", "目录路径", 4096);
    const directory = await resolveAuthorizedPath(root, relative, { kind: "directory" });
    const entries = await readdir(directory.path, { withFileTypes: true });
    if (entries.length > MAX_DIRECTORY_ENTRIES) {
      throw new Error(`目录项目过多（上限 ${MAX_DIRECTORY_ENTRIES}）。`);
    }
    const values = await Promise.all(entries
      .filter((entry) => !entry.isSymbolicLink())
      .map(async (entry) => {
        const child = await resolveAuthorizedPath(root, path.relative(root, path.join(directory.path, entry.name)));
        return {
          name: entry.name,
          path: path.relative(root, child.path) || ".",
          type: child.stat.isDirectory() ? "directory" : "file",
          size: child.stat.isFile() ? child.stat.size : 0,
          modifiedAt: child.stat.mtimeMs,
        };
      }));
    values.sort((left, right) => left.type === right.type
      ? left.name.localeCompare(right.name, "zh-CN", { numeric: true })
      : left.type === "directory" ? -1 : 1);
    return { root, path: path.relative(root, directory.path) || ".", entries: values };
  });

  ipcMain.handle("laobos:workspace:read", async (event, input = {}) => {
    authorize(event);
    const root = await authorizedRoot(workspace, input.root);
    const relative = boundedString(input.path, "文件路径", 4096);
    assertPreviewAllowed(relative);
    const file = await resolveAuthorizedPath(root, relative, { kind: "file" });
    const mediaType = mediaTypeFor(file.path);
    const isText = mediaType.startsWith("text/") || mediaType === "application/json";
    const limit = isText ? MAX_TEXT_BYTES : MAX_BINARY_BYTES;
    if (file.stat.size > limit) throw new Error(`文件超过预览上限（${Math.round(limit / 1024 / 1024)} MB）。`);
    const data = await readFile(file.path);
    if (isText && data.includes(0)) throw new Error("文件包含二进制数据，不能作为文本预览。 ");
    return isText
      ? { kind: "text", mediaType, content: data.toString("utf8"), size: data.byteLength }
      : { kind: mediaType === "application/pdf" ? "pdf" : mediaType.startsWith("image/") ? "image" : mediaType.startsWith("audio/") || mediaType.startsWith("video/") ? "media" : "binary", mediaType, base64: data.toString("base64"), size: data.byteLength };
  });

  ipcMain.handle("laobos:workspace:reveal", async (event, input = {}) => {
    authorize(event);
    const root = await authorizedRoot(workspace, input.root);
    const target = await resolveAuthorizedPath(root, boundedString(input.path || ".", "路径", 4096));
    if (target.stat.isDirectory()) await shell.openPath(target.path);
    else shell.showItemInFolder(target.path);
    return { opened: true };
  });

  ipcMain.handle("laobos:uploads:set-location", async (event, input = {}) => {
    authorize(event);
    const location = input.location === "workspace" ? "workspace" : "default";
    if (location === "workspace") {
      await mkdir(path.join(workspace, "update"), {
        recursive: true,
        mode: 0o700,
      });
    }
    return settings.update({ uploadLocation: location });
  });

  ipcMain.handle("laobos:uploads:pick-files", async (event, input = {}) => {
    authorize(event);
    const sessionId = boundedString(input.sessionId || "shared", "会话标识", 256);
    const options = {
      title: "添加图片或文件",
      buttonLabel: "添加",
      properties: ["openFile", "multiSelections"],
    };
    const owner = getMainWindow?.();
    const selection = owner && !owner.isDestroyed()
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (selection.canceled || selection.filePaths.length === 0) {
      return { canceled: true, images: [], files: [] };
    }
    const routed = await readPickedAttachments(selection.filePaths);
    return {
      canceled: false,
      images: routed.images,
      files: await copyManagedUploadFiles({
        sourcePaths: routed.filePaths,
        sessionId,
        workspace,
        dshHome,
        settings,
      }),
    };
  });

  ipcMain.handle("laobos:uploads:paste-files", async (event, input = {}) => {
    authorize(event);
    const sessionId = boundedString(input.sessionId || "shared", "会话标识", 256);
    return {
      files: await storeManagedPastedFiles({
        files: input.files,
        sessionId,
        workspace,
        dshHome,
        settings,
      }),
    };
  });

  ipcMain.handle("laobos:uploads:reveal", async (event, input = {}) => {
    authorize(event);
    const requested = boundedString(input.path, "文件路径", 4096);
    if (!path.isAbsolute(requested)) throw new Error("文件路径必须是绝对路径。 ");
    const roots = [
      path.join(workspace, "update"),
      path.join(dshHome, "uploads", "v1"),
    ];
    for (const root of roots) {
      try {
        const target = await resolveAuthorizedPath(root, path.relative(root, requested), { kind: "file" });
        shell.showItemInFolder(target.path);
        return { opened: true };
      } catch {}
    }
    throw new Error("该文件不在受管上传目录中。 ");
  });

  return () => {
    for (const channel of [
      "laobos:workspace:context",
      "laobos:workspace:list",
      "laobos:workspace:read",
      "laobos:workspace:reveal",
      "laobos:uploads:set-location",
      "laobos:uploads:pick-files",
      "laobos:uploads:paste-files",
      "laobos:uploads:reveal",
    ]) ipcMain.removeHandler(channel);
  };
}

const MULTIMODAL_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function readPickedAttachments(sourcePaths) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) {
    return { images: [], filePaths: [] };
  }
  if (sourcePaths.length > MAX_UPLOAD_FILES) {
    throw new Error(`一次最多添加 ${MAX_UPLOAD_FILES} 个附件。`);
  }
  const images = [];
  const filePaths = [];
  let totalBytes = 0;
  for (const sourcePath of sourcePaths) {
    const source = boundedString(sourcePath, "源文件路径", 4096);
    if (!path.isAbsolute(source)) throw new Error("源文件路径必须是绝对路径。 ");
    const info = await lstat(source);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`只能添加普通文件：${path.basename(source)}`);
    if (info.size > MAX_UPLOAD_FILE_BYTES) {
      throw new Error(`附件“${path.basename(source)}”超过 ${MAX_UPLOAD_FILE_BYTES / 1024 / 1024} MB 上限。`);
    }
    totalBytes += info.size;
    if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
      throw new Error(`本次附件总大小超过 ${MAX_UPLOAD_BATCH_BYTES / 1024 / 1024} MB 上限。`);
    }
    const mediaType = mediaTypeFor(source);
    if (!MULTIMODAL_IMAGE_TYPES.has(mediaType)) {
      filePaths.push(source);
      continue;
    }
    const bytes = await readFile(source);
    if (bytes.byteLength !== info.size) throw new Error(`读取过程中源文件发生变化：${path.basename(source)}`);
    images.push({
      id: randomUUID(),
      name: safeUploadFileName(source),
      mediaType,
      size: info.size,
      bytes,
    });
  }
  return { images, filePaths };
}

export function safeUploadFileName(value) {
  const normalized = path.basename(String(value || "").replaceAll("\\", "/"))
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim()
    .slice(0, 180);
  return normalized && normalized !== "." && normalized !== ".." ? normalized : "file";
}

export function managedUploadRoot({ workspace, dshHome, location, sessionId }) {
  if (location === "workspace") return path.join(path.resolve(workspace), "update");
  const safeSession = String(sessionId || "shared").replace(/[^a-zA-Z0-9._-]/gu, "-").slice(0, 80) || "shared";
  return path.join(path.resolve(dshHome), "uploads", "v1", safeSession);
}

export async function storeManagedPastedFiles({
  files,
  sessionId = "shared",
  workspace,
  dshHome,
  settings,
}) {
  if (!Array.isArray(files) || files.length === 0) return [];
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`一次最多粘贴 ${MAX_UPLOAD_FILES} 个文件。`);
  const inspected = [];
  let totalBytes = 0;
  for (const value of files) {
    const name = safeUploadFileName(value?.name);
    const source = value?.bytes?.type === "Buffer" ? value.bytes.data : value?.bytes;
    if (!(source instanceof Uint8Array) && !Array.isArray(source)) {
      throw new Error(`文件“${name}”的剪贴板内容无效。`);
    }
    const bytes = Buffer.from(source);
    if (bytes.byteLength > MAX_UPLOAD_FILE_BYTES) {
      throw new Error(`文件“${name}”超过 ${MAX_UPLOAD_FILE_BYTES / 1024 / 1024} MB 上限。`);
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
      throw new Error(`本次文件总大小超过 ${MAX_UPLOAD_BATCH_BYTES / 1024 / 1024} MB 上限。`);
    }
    inspected.push({
      name,
      bytes,
      mimeType: String(value?.mimeType || mediaTypeFor(name)).slice(0, 255),
    });
  }
  const currentSettings = await settings.get();
  const location = currentSettings.uploadLocation === "workspace" ? "workspace" : "default";
  const root = managedUploadRoot({ workspace, dshHome, location, sessionId });
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (location === "default") await chmod(root, 0o700);
  const storedFiles = [];
  try {
    for (const file of inspected) {
      const id = randomUUID();
      const storedName = `${Date.now()}-${id.slice(0, 8)}-${file.name}`;
      const destination = path.join(root, storedName);
      const temporary = path.join(root, `.upload-${id}.tmp`);
      try {
        await writeFile(temporary, file.bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, destination);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      storedFiles.push({
        id,
        name: file.name,
        storedName,
        path: destination,
        mimeType: file.mimeType,
        size: file.bytes.byteLength,
        location,
      });
    }
    return storedFiles;
  } catch (error) {
    await Promise.all(storedFiles.map((file) => unlink(file.path).catch(() => {})));
    throw error;
  }
}

export async function copyManagedUploadFiles({
  sourcePaths,
  sessionId = "shared",
  workspace,
  dshHome,
  settings,
}) {
  if (!Array.isArray(sourcePaths) || sourcePaths.length === 0) return [];
  if (sourcePaths.length > MAX_UPLOAD_FILES) {
    throw new Error(`一次最多添加 ${MAX_UPLOAD_FILES} 个文件。`);
  }

  const inspected = [];
  let totalBytes = 0;
  for (const sourcePath of sourcePaths) {
    const source = boundedString(sourcePath, "源文件路径", 4096);
    if (!path.isAbsolute(source)) throw new Error("源文件路径必须是绝对路径。 ");
    const info = await lstat(source);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`只能添加普通文件：${path.basename(source)}`);
    if (info.size > MAX_UPLOAD_FILE_BYTES) {
      throw new Error(`文件“${path.basename(source)}”超过 ${MAX_UPLOAD_FILE_BYTES / 1024 / 1024} MB 上限。`);
    }
    totalBytes += info.size;
    if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
      throw new Error(`本次文件总大小超过 ${MAX_UPLOAD_BATCH_BYTES / 1024 / 1024} MB 上限。`);
    }
    inspected.push({ source, info });
  }

  const currentSettings = await settings.get();
  const location = currentSettings.uploadLocation === "workspace" ? "workspace" : "default";
  const root = managedUploadRoot({ workspace, dshHome, location, sessionId });
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (location === "default") await chmod(root, 0o700);
  const copied = [];
  try {
    for (const { source, info } of inspected) {
      const name = safeUploadFileName(source);
      const unique = randomUUID();
      const storedName = `${Date.now()}-${unique.slice(0, 8)}-${name}`;
      const destination = path.join(root, storedName);
      const temporary = path.join(root, `.upload-${unique}.tmp`);
      try {
        await copyFile(source, temporary, constants.COPYFILE_EXCL);
        await chmod(temporary, 0o600);
        await rename(temporary, destination);
        const stored = await lstat(destination);
        if (!stored.isFile() || stored.size !== info.size) {
          await unlink(destination).catch(() => {});
          throw new Error(`复制过程中源文件发生变化：${name}`);
        }
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      copied.push({
        id: unique,
        name,
        storedName,
        path: destination,
        mimeType: mediaTypeFor(name),
        size: info.size,
        location,
      });
    }
    return copied;
  } catch (error) {
    await Promise.all(copied.map((file) => unlink(file.path).catch(() => {})));
    throw error;
  }
}

async function authorizedRoot(defaultRoot, requested) {
  if (requested === undefined || requested === "") {
    return (await resolveAuthorizedPath(defaultRoot, ".", { kind: "directory" })).path;
  }
  const root = boundedString(requested, "工作区路径", 4096);
  if (!path.isAbsolute(root)) throw new Error("工作区路径必须是绝对路径。 ");
  const defaultResolved = await resolveAuthorizedPath(defaultRoot, ".", { kind: "directory" });
  const requestedResolved = await resolveAuthorizedPath(root, ".", { kind: "directory" });
  if (!isPathInside(defaultResolved.path, requestedResolved.path)) {
    throw new Error("该工作区不在桌面应用启动时授权的范围内。 ");
  }
  return requestedResolved.path;
}

function assertPreviewAllowed(relative) {
  const name = path.basename(relative).toLowerCase();
  if (SENSITIVE_NAMES.has(name) || name.startsWith(".env.")) {
    throw new Error("出于安全考虑，该敏感文件不能在应用内预览。 ");
  }
}

export function mediaTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".md": "text/markdown", ".mdx": "text/markdown", ".txt": "text/plain",
    ".js": "text/javascript", ".mjs": "text/javascript", ".cjs": "text/javascript",
    ".ts": "text/typescript", ".tsx": "text/typescript", ".jsx": "text/javascript",
    ".css": "text/css", ".html": "text/html", ".htm": "text/html",
    ".json": "application/json", ".yaml": "text/yaml", ".yml": "text/yaml",
    ".xml": "text/xml", ".csv": "text/csv", ".tsv": "text/tab-separated-values", ".log": "text/plain",
    ".py": "text/x-python", ".rb": "text/x-ruby", ".rs": "text/x-rust",
    ".go": "text/x-go", ".java": "text/x-java", ".sh": "text/x-shellscript",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip", ".gz": "application/gzip", ".tar": "application/x-tar",
    ".7z": "application/x-7z-compressed", ".rar": "application/vnd.rar",
    ".mp3": "audio/mpeg", ".wav": "audio/wav",
    ".mp4": "video/mp4", ".webm": "video/webm",
  })[extension] || "application/octet-stream";
}
