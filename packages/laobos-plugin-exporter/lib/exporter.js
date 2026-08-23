import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

export const PLUGIN_PACKAGE_LIMITS = Object.freeze({
  compressedBytes: 8 * 1024 * 1024,
  uncompressedBytes: 64 * 1024 * 1024,
  entries: 2_000,
  packageJsonBytes: 1024 * 1024,
});

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".laobos-exports",
  ".next",
  ".svn",
  ".turbo",
  "__macosx",
  "coverage",
  "node_modules",
]);
const SENSITIVE_FILENAMES = new Set([
  ".npmrc",
  ".pypirc",
  "credentials",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
  "pass.txt",
  "password.txt",
  "secrets.json",
]);
const SENSITIVE_EXTENSIONS = new Set([
  ".db",
  ".key",
  ".log",
  ".p12",
  ".pem",
  ".pfx",
  ".sqlite",
  ".sqlite3",
]);
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const outputQueues = new Map();

export class PluginExporterError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "PluginExporterError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, status = 400, details) {
  throw new PluginExporterError(code, message, status, details);
}

function lexical(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function abortIfNeeded(signal) {
  if (!signal?.aborted) return;
  const error = new Error("插件包导出已取消。");
  error.name = "AbortError";
  throw error;
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safePackageName(value) {
  const packageName = String(value || "").trim();
  const segments = packageName.startsWith("@")
    ? [packageName.slice(1).split("/")[0], packageName.split("/")[1]]
    : [packageName];
  if (!/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/u.test(packageName)
    || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail("PACKAGE_NAME_INVALID", "package.json 的 name 无效；请使用合法的 npm 包名。");
  }
  return packageName;
}

function safeVersion(value) {
  const version = String(value || "").trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/u.test(version)) {
    fail("PACKAGE_VERSION_INVALID", "package.json 的 version 无效；建议使用 SemVer，例如 1.0.0。");
  }
  return version;
}

function exportedPath(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  for (const condition of ["default", "import", "node", "require"]) {
    if (typeof value[condition] === "string") return value[condition];
  }
  return "";
}

function safeRelativePath(value, label) {
  const source = String(value || "").trim();
  if (!source || source.includes("\\") || source.includes("\0")
    || source.startsWith("/") || /^[a-z]:/iu.test(source)
    || /[\u0000-\u001f\u007f]/u.test(source)) {
    fail("PACKAGE_STRUCTURE_INVALID", `${label}声明无效。`);
  }
  const normalized = path.posix.normalize(source.replace(/^\.\//u, ""));
  const segments = normalized.split("/");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")
    || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail("PACKAGE_STRUCTURE_INVALID", `${label}不能指向插件目录之外。`);
  }
  validatePortablePath(normalized);
  return normalized;
}

function validatePortablePath(relative) {
  const segments = relative.split("/");
  for (const segment of segments) {
    if (/^[\s.]*$/u.test(segment) || /[<>:"|?*]/u.test(segment)
      || /[. ]$/u.test(segment) || WINDOWS_RESERVED.test(segment)) {
      fail(
        "PACKAGE_PATH_NOT_PORTABLE",
        `插件文件路径不能在 Windows/macOS/Linux 间安全使用：${relative}`,
      );
    }
  }
  splitTarPath(`package/${relative}`);
}

function exclusionFor(relative, directory) {
  const normalized = relative.replaceAll(path.sep, "/");
  const basename = path.posix.basename(normalized);
  const lower = basename.toLowerCase();
  if (directory && EXCLUDED_DIRECTORIES.has(lower)) return "开发或依赖目录";
  if (lower === ".ds_store" || lower === "thumbs.db" || lower === "desktop.ini" || lower.startsWith("._")) {
    return "操作系统元数据";
  }
  if (lower === ".env" || lower.startsWith(".env.")) return "环境变量/凭据文件";
  if (SENSITIVE_FILENAMES.has(lower) || SENSITIVE_EXTENSIONS.has(path.posix.extname(lower))) {
    return "敏感或运行时数据";
  }
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".zip")) {
    return "已有归档文件";
  }
  return "";
}

async function readManifest(sourceRoot) {
  const manifestPath = path.join(sourceRoot, "package.json");
  let info;
  try {
    info = await lstat(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") fail("PACKAGE_JSON_MISSING", "插件目录根部缺少 package.json。");
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    fail("PACKAGE_JSON_INVALID", "package.json 必须是普通文件，不能是目录或符号链接。");
  }
  if (info.size > PLUGIN_PACKAGE_LIMITS.packageJsonBytes) {
    fail("PACKAGE_JSON_LIMIT", "package.json 超过 1 MiB 上限。", 413);
  }
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail("PACKAGE_JSON_INVALID", "package.json 不是有效 JSON。");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    fail("PACKAGE_JSON_INVALID", "package.json 必须是 JSON 对象。");
  }
  return manifest;
}

async function enumerateSource(sourceRoot, signal) {
  const files = [];
  const excluded = [];
  const canonicalPaths = new Set();
  let sourceBytes = 0;

  async function visit(directory, relativeDirectory = "") {
    abortIfNeeded(signal);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => lexical(left.name, right.name));
    for (const entry of entries) {
      abortIfNeeded(signal);
      const relative = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const reason = exclusionFor(relative, entry.isDirectory());
      if (reason) {
        excluded.push({ path: relative, reason });
        continue;
      }
      validatePortablePath(relative);
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        fail("PACKAGE_SYMLINK_UNSUPPORTED", `插件包不能包含符号链接：${relative}`);
      }
      if (info.isDirectory()) {
        await visit(absolute, relative);
        continue;
      }
      if (!info.isFile()) {
        fail("PACKAGE_ENTRY_UNSAFE", `插件包不能包含设备、FIFO 或其他特殊条目：${relative}`);
      }
      const resolved = await realpath(absolute);
      if (!isInside(sourceRoot, resolved)) {
        fail("PACKAGE_PATH_OUTSIDE", `插件文件离开了源目录：${relative}`);
      }
      const canonical = relative.normalize("NFC").toLowerCase();
      if (canonicalPaths.has(canonical)) {
        fail("PACKAGE_ENTRY_DUPLICATE", `插件目录包含跨平台冲突路径：${relative}`);
      }
      canonicalPaths.add(canonical);
      sourceBytes += info.size;
      if (sourceBytes > PLUGIN_PACKAGE_LIMITS.uncompressedBytes) {
        fail("PACKAGE_UNPACKED_LIMIT", "插件文件总大小超过 64 MiB 上限。", 413);
      }
      files.push({
        absolute: resolved,
        relative,
        size: info.size,
        mode: info.mode,
        mtimeMs: info.mtimeMs,
        ino: info.ino,
        dev: info.dev,
      });
    }
  }

  await visit(sourceRoot);
  const directories = new Set(["package"]);
  for (const file of files) {
    const segments = file.relative.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(`package/${segments.slice(0, index).join("/")}`);
    }
  }
  const directoryList = [...directories].sort((left, right) => {
    const depth = left.split("/").length - right.split("/").length;
    return depth || lexical(left, right);
  });
  const archivePaths = [
    ...directoryList,
    ...files.map((file) => `package/${file.relative}`),
  ];
  const canonicalArchivePaths = new Set();
  for (const archivePath of archivePaths) {
    const canonical = archivePath.normalize("NFC").toLowerCase();
    if (canonicalArchivePaths.has(canonical)) {
      fail("PACKAGE_ENTRY_DUPLICATE", `插件目录包含文件与目录的跨平台冲突：${archivePath}`);
    }
    canonicalArchivePaths.add(canonical);
  }
  const entryCount = archivePaths.length;
  if (entryCount > PLUGIN_PACKAGE_LIMITS.entries) {
    fail("PACKAGE_ENTRIES_LIMIT", `插件包条目不能超过 ${PLUGIN_PACKAGE_LIMITS.entries} 个。`, 413);
  }
  return {
    directories: directoryList,
    entryCount,
    excluded,
    files,
    sourceBytes,
  };
}

function literalPattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function validatePlugin(sourceRoot, manifest, scanned) {
  const packageName = safePackageName(manifest.name);
  const version = safeVersion(manifest.version);
  const filePaths = new Set(scanned.files.map((file) => file.relative));
  const hostDeclaration = typeof manifest.exports === "string"
    ? manifest.exports
    : manifest.exports?.["."] ?? manifest.main;
  const hostEntry = safeRelativePath(exportedPath(hostDeclaration), "Host 入口");
  if (!filePaths.has(hostEntry)) {
    fail("PACKAGE_HOST_MISSING", `插件包缺少 Host 入口文件：${hostEntry}`);
  }

  let clientEntry = "";
  const client = manifest.dsh?.client;
  if (client !== undefined) {
    if (!client || typeof client !== "object" || Array.isArray(client)
      || typeof client.platform !== "string" || !client.platform.trim()) {
      fail("PACKAGE_CLIENT_INVALID", "dsh.client.platform 必须是非空字符串。");
    }
    if (client.inject !== undefined
      && (!Array.isArray(client.inject) || client.inject.some((item) => typeof item !== "string"))) {
      fail("PACKAGE_CLIENT_INVALID", "dsh.client.inject 必须是字符串数组。");
    }
    if (client.immediately !== undefined && typeof client.immediately !== "boolean") {
      fail("PACKAGE_CLIENT_INVALID", "dsh.client.immediately 必须是布尔值。");
    }
    if (client.platform === "web") {
      clientEntry = safeRelativePath(exportedPath(manifest.exports?.["./client"]), "Client 入口");
      if (!filePaths.has(clientEntry)) {
        fail("PACKAGE_CLIENT_MISSING", `Web 插件缺少 Client 入口文件：${clientEntry}`);
      }
      const clientFile = scanned.files.find((file) => file.relative === clientEntry);
      const source = await readFile(clientFile.absolute, "utf8");
      const hasLoaderCall = /(?:window|globalThis)\s*\.\s*__ModuleLoader__\s*\.\s*load\s*\(/u.test(source);
      const hasMatchingId = new RegExp(`\\bid\\s*:\\s*(["'])${literalPattern(packageName)}\\1`, "u").test(source);
      if (!hasLoaderCall || !hasMatchingId) {
        fail(
          "CLIENT_REGISTRATION_MISMATCH",
          `Client bundle 必须通过 __ModuleLoader__.load 注册同名模块 ${packageName}。`,
        );
      }
    }
  }

  return {
    clientEntry: clientEntry || null,
    description: typeof manifest.description === "string" ? manifest.description.trim().slice(0, 500) : "",
    hostEntry,
    packageName,
    sourceRoot,
    version,
  };
}

async function buildInspection(sourceDirectory, signal, allowedRoot) {
  abortIfNeeded(signal);
  const requested = path.resolve(String(sourceDirectory || "."));
  const boundaryRoot = allowedRoot ? await realpath(path.resolve(allowedRoot)) : "";
  let sourceRoot;
  try {
    sourceRoot = await realpath(requested);
    const info = await lstat(sourceRoot);
    if (!info.isDirectory()) fail("SOURCE_NOT_DIRECTORY", "插件源路径不是目录。");
  } catch (error) {
    if (error instanceof PluginExporterError) throw error;
    if (error?.code === "ENOENT") fail("SOURCE_NOT_FOUND", `插件源目录不存在：${requested}`);
    throw error;
  }
  if (boundaryRoot && !isInside(boundaryRoot, sourceRoot)) {
    fail("WORKSPACE_BOUNDARY", "插件源目录必须位于当前工作区。", 403);
  }
  const manifest = await readManifest(sourceRoot);
  const scanned = await enumerateSource(sourceRoot, signal);
  const plugin = await validatePlugin(sourceRoot, manifest, scanned);
  const warnings = [];
  if (scanned.excluded.length) {
    warnings.push(`已自动排除 ${scanned.excluded.length} 个依赖、归档、系统元数据或敏感路径。`);
  }
  if (!manifest.license) warnings.push("package.json 未声明 license；不影响上传，但建议补充授权信息。");
  if (!manifest.description) warnings.push("package.json 未声明 description；市场卡片将依赖上传时填写的说明。");
  return {
    internal: { ...scanned, ...plugin },
    public: {
      schema: 1,
      sourceDir: sourceRoot,
      packageName: plugin.packageName,
      version: plugin.version,
      description: plugin.description,
      hostEntry: plugin.hostEntry,
      clientEntry: plugin.clientEntry,
      fileCount: scanned.files.length,
      entryCount: scanned.entryCount,
      sourceBytes: scanned.sourceBytes,
      excludedCount: scanned.excluded.length,
      excluded: scanned.excluded.slice(0, 100),
      warnings,
      ready: true,
    },
  };
}

export async function inspectPluginDirectory(sourceDirectory, options = {}) {
  return (await buildInspection(sourceDirectory, options.signal, options.allowedRoot)).public;
}

function splitTarPath(value) {
  const text = String(value).replace(/\/+$/u, "");
  if (Buffer.byteLength(text) <= 100) return { name: text, prefix: "" };
  const separators = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "/") separators.push(index);
  }
  for (const index of separators.reverse()) {
    const prefix = text.slice(0, index);
    const name = text.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      return { name, prefix };
    }
  }
  fail("PACKAGE_PATH_TOO_LONG", `插件路径超过可移植 TAR 上限：${value}`);
}

function writeText(header, offset, length, value, label) {
  const bytes = Buffer.from(String(value), "utf8");
  if (bytes.length > length) fail("PACKAGE_PATH_TOO_LONG", `${label}超过 TAR 字段上限。`);
  bytes.copy(header, offset);
}

function writeOctal(header, offset, length, value, label) {
  const text = Number(value).toString(8);
  if (text.length > length - 1) fail("PACKAGE_ARCHIVE_LIMIT", `${label}超出 TAR 数值范围。`, 413);
  header.write(`${text.padStart(length - 1, "0")}\0`, offset, length, "ascii");
}

function tarHeader(name, { directory = false, mode = 0o644, size = 0 } = {}) {
  const header = Buffer.alloc(512);
  const fields = splitTarPath(name);
  writeText(header, 0, 100, fields.name, "文件名");
  writeOctal(header, 100, 8, directory ? 0o755 : mode, "文件模式");
  writeOctal(header, 108, 8, 0, "UID");
  writeOctal(header, 116, 8, 0, "GID");
  writeOctal(header, 124, 12, directory ? 0 : size, "文件大小");
  writeOctal(header, 136, 12, 0, "修改时间");
  header.fill(32, 148, 156);
  header[156] = directory ? 53 : 48;
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  writeText(header, 345, 155, fields.prefix, "路径前缀");
  let checksum = 0;
  for (const byte of header) checksum += byte;
  const checksumText = checksum.toString(8);
  if (checksumText.length > 6) fail("PACKAGE_ARCHIVE_LIMIT", "TAR 校验和超出范围。", 500);
  header.write(`${checksumText.padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

async function* tarContents(inspection, signal) {
  for (const directory of inspection.directories) {
    abortIfNeeded(signal);
    yield tarHeader(directory, { directory: true });
  }
  for (const file of inspection.files) {
    abortIfNeeded(signal);
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
    const handle = await open(file.absolute, flags);
    try {
      const current = await handle.stat();
      if (!current.isFile() || current.size !== file.size || current.mtimeMs !== file.mtimeMs
        || (file.ino && current.ino && current.ino !== file.ino)
        || (file.dev && current.dev && current.dev !== file.dev)) {
        fail("SOURCE_CHANGED", `检查后文件已变化，请重新检查再导出：${file.relative}`, 409);
      }
      const mode = current.mode & 0o111 ? 0o755 : 0o644;
      yield tarHeader(`package/${file.relative}`, { mode, size: current.size });
      let offset = 0;
      while (offset < current.size) {
        abortIfNeeded(signal);
        const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, current.size - offset));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
        if (!bytesRead) fail("SOURCE_CHANGED", `读取插件文件时内容发生变化：${file.relative}`, 409);
        offset += bytesRead;
        yield bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead);
      }
      const padding = (512 - (current.size % 512)) % 512;
      if (padding) yield Buffer.alloc(padding);
    } finally {
      await handle.close().catch(() => {});
    }
  }
  yield Buffer.alloc(1024);
}

function defaultArchiveName(packageName, version) {
  const base = packageName.replace(/^@/u, "").replaceAll("/", "-")
    .replace(/[^a-z0-9._+-]/giu, "-");
  return `${base}-${version}.tar.gz`;
}

function safeArchiveName(value, packageName, version) {
  const name = String(value || defaultArchiveName(packageName, version)).trim();
  if (!name || name !== path.basename(name) || name.includes("\\")
    || /[\u0000-\u001f\u007f<>:"|?*]/u.test(name)
    || !name.toLowerCase().endsWith(".tar.gz") || name.length > 180
    || name === "." || name === "..") {
    fail("OUTPUT_NAME_INVALID", "导出文件名必须是安全的 .tar.gz 文件名，且不能包含目录。");
  }
  return name;
}

async function sha256File(filePath, signal) {
  const digest = createHash("sha256");
  const handle = await open(filePath, "r");
  try {
    const info = await handle.stat();
    let offset = 0;
    while (offset < info.size) {
      abortIfNeeded(signal);
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, info.size - offset));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (!bytesRead) break;
      offset += bytesRead;
      digest.update(buffer.subarray(0, bytesRead));
    }
    return { sha256: digest.digest("hex"), sizeBytes: info.size };
  } finally {
    await handle.close().catch(() => {});
  }
}

async function commitArchive(temporaryPath, outputPath, overwrite) {
  if (!overwrite) {
    try {
      await link(temporaryPath, outputPath);
      await rm(temporaryPath, { force: true });
      return;
    } catch (error) {
      if (error?.code === "EEXIST") {
        fail("OUTPUT_EXISTS", `导出文件已存在：${outputPath}`, 409);
      }
      throw error;
    }
  }

  let existing;
  try { existing = await lstat(outputPath); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (!existing) {
    await rename(temporaryPath, outputPath);
    return;
  }
  if (!existing.isFile() || existing.isSymbolicLink()) {
    fail("OUTPUT_UNSAFE", "不能覆盖目录、符号链接或其他非普通文件。", 409);
  }
  const backupPath = `${outputPath}.backup-${randomUUID()}`;
  await rename(outputPath, backupPath);
  try {
    await rename(temporaryPath, outputPath);
  } catch (error) {
    try { await rename(backupPath, outputPath); }
    catch {
      fail(
        "OUTPUT_RESTORE_FAILED",
        `新包提交失败，旧文件保留在恢复备份：${backupPath}`,
        500,
        { backupPath },
      );
    }
    throw error;
  }
  await rm(backupPath, { force: true }).catch(() => {});
}

async function prepareOutputDirectory(destinationDirectory, boundaryRoot) {
  const target = path.resolve(destinationDirectory);
  if (!boundaryRoot) {
    await mkdir(target, { recursive: true, mode: 0o700 });
    return realpath(target);
  }
  if (!isInside(boundaryRoot, target)) {
    fail("WORKSPACE_BOUNDARY", "插件包导出目录必须位于当前工作区。", 403);
  }
  const relative = path.relative(boundaryRoot, target);
  let current = boundaryRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let info;
    try { info = await lstat(current); }
    catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current, { recursive: true, mode: 0o700 });
      break;
    }
    if (info.isSymbolicLink() || !info.isDirectory()) {
      fail("OUTPUT_UNSAFE", `导出目录不能穿过符号链接或普通文件：${current}`, 409);
    }
    const resolved = await realpath(current);
    if (!isInside(boundaryRoot, resolved)) {
      fail("WORKSPACE_BOUNDARY", "插件包导出目录通过链接离开了当前工作区。", 403);
    }
  }
  await mkdir(target, { recursive: true, mode: 0o700 });
  const resolved = await realpath(target);
  if (!isInside(boundaryRoot, resolved)) {
    fail("WORKSPACE_BOUNDARY", "插件包导出目录通过链接离开了当前工作区。", 403);
  }
  return resolved;
}

async function withOutputQueue(outputPath, action) {
  const previous = outputQueues.get(outputPath) || Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  outputQueues.set(outputPath, current);
  try {
    return await current;
  } finally {
    if (outputQueues.get(outputPath) === current) outputQueues.delete(outputPath);
  }
}

export async function exportPluginPackage({
  sourceDir,
  outputDir,
  outputName,
  overwrite = false,
  allowedRoot,
  signal,
} = {}) {
  const boundaryRoot = allowedRoot ? await realpath(path.resolve(allowedRoot)) : "";
  const inspected = await buildInspection(sourceDir, signal, boundaryRoot);
  const destinationDirectory = path.resolve(
    String(outputDir || path.join(inspected.internal.sourceRoot, ".laobos-exports")),
  );
  const archiveName = safeArchiveName(
    outputName,
    inspected.internal.packageName,
    inspected.internal.version,
  );
  const outputPath = path.join(destinationDirectory, archiveName);

  return withOutputQueue(outputPath, async () => {
    abortIfNeeded(signal);
    const destinationRoot = await prepareOutputDirectory(destinationDirectory, boundaryRoot);
    if (!isInside(destinationRoot, outputPath)) fail("OUTPUT_PATH_INVALID", "导出路径离开了目标目录。");
    const temporaryPath = path.join(destinationRoot, `.${archiveName}.${randomUUID()}.exporting`);
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await pipeline(
        Readable.from(tarContents(inspected.internal, signal)),
        createGzip({ level: 9, mtime: 0 }),
        handle.createWriteStream(),
        ...(signal ? [{ signal }] : []),
      );
    } catch (error) {
      await handle.close().catch(() => {});
      await rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
    await handle.close().catch(() => {});
    const syncHandle = await open(temporaryPath, "r");
    try { await syncHandle.sync(); }
    finally { await syncHandle.close(); }

    try {
      const artifact = await sha256File(temporaryPath, signal);
      if (!artifact.sizeBytes) fail("PACKAGE_EMPTY", "导出的插件包为空。", 500);
      if (artifact.sizeBytes > PLUGIN_PACKAGE_LIMITS.compressedBytes) {
        fail("PACKAGE_COMPRESSED_LIMIT", "导出的压缩包超过市场 8 MiB 上限；请移除不必要资源。", 413);
      }
      await commitArchive(temporaryPath, outputPath, overwrite === true);
      await chmod(outputPath, 0o600).catch(() => {});
      return {
        ...inspected.public,
        exported: true,
        outputPath,
        outputDir: destinationRoot,
        outputName: archiveName,
        sizeBytes: artifact.sizeBytes,
        sha256: artifact.sha256,
      };
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      throw error;
    }
  });
}
