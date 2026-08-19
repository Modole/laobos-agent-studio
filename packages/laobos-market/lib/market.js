/**
 * 劳博士 DSH 插件市场 — 核心逻辑（零依赖，仅 Node 内置模块）。
 *
 * 功能：
 *  1. 查询：GitHub `dsh-plugin` topic 搜索 + 正则筛选（name / full_name / description）。
 *  2. 安装：下载 GitHub 仓库 tarball → 解压到 profile 的 node_modules → 注册 cordis.patch.yml。
 *  3. 上传：把本地插件目录初始化为 git 仓库，通过 gh CLI 创建 GitHub 仓库并推送，
 *     自动打上 `dsh-plugin` topic，从而进入插件市场。
 */
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PENDING_PLUGIN_FILE = ".laobos-plugin-pending.json";

export class MarketError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "MarketError";
    this.code = code;
    this.status = status;
  }
}

/* ────────────────────────────── 网络（可选代理） ────────────────────────────── */

function parseProxy(proxyUrl) {
  if (!proxyUrl) return null;
  try {
    const url = new URL(proxyUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("仅支持 http/https 代理");
    }
    return { host: url.hostname, port: Number(url.port || 80), protocol: url.protocol };
  } catch (error) {
    throw new MarketError("PROXY_INVALID", `代理地址无效：${error.message}`, 400);
  }
}

/**
 * HTTPS 代理隧道 Agent：与代理建立 CONNECT 隧道，再把 TLS 包装在隧道上。
 */
class TunnelAgent extends https.Agent {
  constructor(proxy) {
    super({ keepAlive: false });
    this.proxy = proxy;
  }

  createConnection(options, callback) {
    const host = options.host || options.hostname;
    const port = Number(options.port || 443);
    const socket = net.connect({ host: this.proxy.host, port: this.proxy.port });
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback(error instanceof Error ? error : new Error(String(error)));
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
      let buffer = Buffer.alloc(0);
      const onData = (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const headEnd = buffer.indexOf("\r\n\r\n");
        if (headEnd === -1) return;
        socket.off("data", onData);
        socket.removeListener("error", fail);
        const head = buffer.slice(0, headEnd).toString("latin1");
        if (!/^HTTP\/1\.[01] 2\d\d/.test(head)) {
          fail(new Error(`代理 CONNECT 失败：${head.split("\r\n")[0]}`));
          return;
        }
        const remainder = buffer.slice(headEnd + 4);
        if (remainder.length > 0) socket.unshift(remainder);
        const tlsSocket = tls.connect({ socket, servername: host });
        tlsSocket.once("error", fail);
        tlsSocket.once("secureConnect", () => {
          if (settled) return;
          settled = true;
          callback(null, tlsSocket);
        });
      };
      socket.on("data", onData);
    });
  }
}

/**
 * 发起 HTTP(S) 请求：https 目标走代理时使用 CONNECT 隧道 Agent，
 * http 目标走代理时使用绝对 URI 形式。返回 { statusCode, headers, body: Buffer }，
 * 跟随最多 3 次重定向。
 */
export function requestBuffer(urlText, { method = "GET", headers = {}, body, proxyUrl, timeoutMs = 30000, redirects = 3 } = {}) {
  const url = new URL(urlText);
  if (!["http:", "https:"].includes(url.protocol)) {
    return Promise.reject(new MarketError("URL_UNSUPPORTED", `不支持的协议：${url.protocol}`, 400));
  }
  const payload = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(body);
  const baseHeaders = {
    "user-agent": "laoboshi-dsh-market/0.1.0",
    accept: "application/vnd.github+json",
    ...(payload ? { "content-length": String(payload.length) } : {}),
    ...headers,
  };
  const proxy = parseProxy(proxyUrl);

  const send = () =>
    new Promise((resolve, reject) => {
      const isHttps = url.protocol === "https:";
      let req;
      if (isHttps && proxy) {
        req = https.request({
          host: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method,
          headers: baseHeaders,
          agent: new TunnelAgent(proxy),
        });
      } else if (!isHttps && proxy) {
        req = http.request({
          host: proxy.host,
          port: proxy.port,
          path: urlText,
          method,
          headers: baseHeaders,
        });
      } else {
        const options = {
          host: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers: baseHeaders,
        };
        req = isHttps ? https.request(options) : http.request(options);
      }
      pump(req);

      function pump(request) {
        request.setTimeout(timeoutMs, () => request.destroy(new Error("请求超时")));
        request.once("error", reject);
        request.once("response", (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const result = { statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) };
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              if (redirects <= 0) {
                reject(new MarketError("REDIRECT_LIMIT", `重定向次数过多：${urlText}`, 502));
                return;
              }
              const next = new URL(res.headers.location, url).toString();
              resolve(requestBuffer(next, { method: res.statusCode === 303 ? "GET" : method, headers, proxyUrl, timeoutMs, redirects: redirects - 1 }));
              return;
            }
            resolve(result);
          });
          res.on("error", reject);
        });
        if (payload) request.write(payload);
        request.end();
      }
    });

  return send();
}

async function requestJson(urlText, options = {}) {
  const result = await requestBuffer(urlText, options);
  if (result.statusCode >= 400) {
    let message = `HTTP ${result.statusCode}`;
    try {
      const parsed = JSON.parse(result.body.toString("utf8"));
      message = parsed.message || message;
    } catch {}
    throw new MarketError("UPSTREAM_ERROR", `上游请求失败（${result.statusCode}）：${message}`, 502);
  }
  try {
    return JSON.parse(result.body.toString("utf8"));
  } catch {
    throw new MarketError("UPSTREAM_JSON", "上游返回了非 JSON 内容。", 502);
  }
}

/* ────────────────────────────── gh CLI 与令牌 ────────────────────────────── */

export async function ghToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], { timeout: 10000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function ghAvailable() {
  try {
    await execFileAsync("gh", ["--version"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

async function run(command, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 32 * 1024 * 1024,
      timeout: options.timeout || 120000,
      env: options.env,
      cwd: options.cwd,
    });
    return { ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") };
  } catch (error) {
    if (error.killed) throw new MarketError("EXEC_TIMEOUT", `命令超时：${command} ${args.join(" ")}`, 504);
    throw new MarketError("EXEC_FAILED", `${command} ${args.join(" ")} 执行失败：${error.stderr || error.message}`, 500);
  }
}

/* ────────────────────────────── 市场查询 ────────────────────────────── */

const SEARCH_API = "https://api.github.com/search/repositories";

/**
 * 查询 dsh-plugin 市场，返回全部命中结果（分页拉取，上限 maxResults）。
 * @param {object} options
 * @param {string}  [options.keywords] 附加关键词（空格分隔，会拼进 GitHub 搜索 q）
 * @param {string}  [options.regex]    正则表达式，用于服务端二次筛选
 * @param {string}  [options.field]    regex 作用字段：name | full_name | description | any
 * @param {string}  [options.sort]     stars | forks | updated
 * @param {number}  [options.maxResults]
 */
export async function searchMarket({
  keywords = "",
  regex = "",
  field = "any",
  sort = "stars",
  maxResults = 200,
  proxyUrl = "",
  registry = SEARCH_API,
} = {}) {
  const q = ["topic:dsh-plugin", ...keywords.trim().split(/\s+/).filter(Boolean)].join(" ");
  const perPage = 100;
  const maxPages = Math.min(10, Math.ceil(maxResults / perPage) || 1);
  let re = null;
  if (regex) {
    try {
      re = new RegExp(regex, "i");
    } catch (error) {
      throw new MarketError("REGEX_INVALID", `正则表达式无效：${error.message}`, 400);
    }
  }
  const token = await ghToken();
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  const items = [];
  let total = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(registry || SEARCH_API);
    url.searchParams.set("q", q);
    url.searchParams.set("sort", sort);
    url.searchParams.set("order", sort === "updated" ? "desc" : "desc");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    const data = await requestJson(url.toString(), { headers, proxyUrl });
    total = data.total_count ?? total;
    const list = Array.isArray(data.items) ? data.items : [];
    for (const item of list) {
      if (re) {
        const haystack = field === "name" ? item.name
          : field === "full_name" ? item.full_name
          : field === "description" ? (item.description || "")
          : `${item.name} ${item.full_name} ${item.description || ""}`;
        if (!re.test(haystack)) continue;
      }
      items.push({
        id: item.id,
        owner: item.owner?.login || item.full_name?.split("/")[0],
        repo: item.name,
        fullName: item.full_name,
        description: item.description || "",
        stars: item.stargazers_count ?? 0,
        forks: item.forks_count ?? 0,
        updatedAt: item.updated_at || "",
        defaultBranch: item.default_branch || "",
        htmlUrl: item.html_url || "",
        homepage: item.homepage || "",
        topics: item.topics || [],
        license: item.license?.spdx_id || "",
      });
      if (items.length >= maxResults) break;
    }
    if (list.length < perPage || items.length >= maxResults) break;
  }
  return { total, matched: items.length, keywordQuery: q, regex, field, sort, items };
}

/* ────────────────────────────── 安装状态 ────────────────────────────── */

export function readPatchEntries(patchFile) {
  let text = "";
  try {
    text = readFileSync(patchFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const entries = [];
  for (const match of text.matchAll(/-\s+id:\s*([^\s#]+)\s*\n\s*name:\s*['"]?([^'"\n]+)['"]?/g)) {
    entries.push({ id: match[1], name: match[2] });
  }
  return entries;
}

/**
 * 已安装插件 = 当前 loader 条目 + 已写入 profile patch 但尚未生效（待重启）的条目。
 */
export function installedOverview({ loaderEntries = [], patchFile }) {
  const active = loaderEntries.map((entry) => ({
    entryId: entry.entryId ?? entry.id,
    moduleName: entry.moduleName ?? entry.options?.name,
    enabled: entry.enabled !== false,
    fiberPhase: entry.fiberPhase ?? null,
    pending: false,
  }));
  const pendingIds = new Set(active.map((entry) => entry.entryId).filter(Boolean));
  const pending = readPatchEntries(patchFile)
    .filter((entry) => !pendingIds.has(entry.id))
    .map((entry) => ({ entryId: entry.id, moduleName: entry.name, enabled: true, fiberPhase: null, pending: true }));
  return [...active, ...pending];
}

/* ────────────────────────────── 下载安装 ────────────────────────────── */

function sanitizePackageName(name) {
  const value = String(name || "").trim();
  if (!/^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(value)) {
    throw new MarketError("PKG_NAME_INVALID", `package.json 中的 name 非法：${value}`, 400);
  }
  return value;
}

function exportedPath(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const condition of ["default", "import", "node", "require"]) {
    if (typeof value[condition] === "string") return value[condition];
  }
  return null;
}

function resolvePackageFile(packageDir, declaration, label) {
  const relative = exportedPath(declaration);
  if (!relative) return null;
  const resolved = path.resolve(packageDir, relative);
  const root = `${path.resolve(packageDir)}${path.sep}`;
  if (resolved !== path.resolve(packageDir) && !resolved.startsWith(root)) {
    throw new MarketError("PKG_ENTRY_OUTSIDE", `${label} 指向插件目录之外：${relative}`, 400);
  }
  return existsSync(resolved) ? resolved : null;
}

function literalPattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Validate the package surfaces DSH will import before changing the live profile. */
export function validatePluginPackage(pkg, packageDir) {
  const packageName = sanitizePackageName(pkg?.name);
  const hostDeclaration = typeof pkg.exports === "string"
    ? pkg.exports
    : pkg.exports?.["."] ?? pkg.main;
  const hostEntry = resolvePackageFile(packageDir, hostDeclaration, "Host 入口");
  if (!hostEntry) {
    throw new MarketError(
      "HOST_ENTRY_MISSING",
      `${packageName} 缺少可用的 Host 入口（exports[\".\"] 或 main）。`,
      400,
    );
  }

  const client = pkg.dsh?.client;
  let clientEntry = null;
  if (client !== undefined) {
    if (!client || typeof client !== "object" || typeof client.platform !== "string") {
      throw new MarketError("CLIENT_DECL_INVALID", `${packageName} 的 dsh.client.platform 必须为字符串。`, 400);
    }
    if (client.inject !== undefined && (
      !Array.isArray(client.inject)
      || client.inject.some((value) => typeof value !== "string")
    )) {
      throw new MarketError("CLIENT_DECL_INVALID", `${packageName} 的 dsh.client.inject 必须为字符串数组。`, 400);
    }
    if (client.immediately !== undefined && typeof client.immediately !== "boolean") {
      throw new MarketError("CLIENT_DECL_INVALID", `${packageName} 的 dsh.client.immediately 必须为布尔值。`, 400);
    }
    if (client.platform === "web") {
      clientEntry = resolvePackageFile(packageDir, pkg.exports?.["./client"], "Client 入口");
      if (!clientEntry) {
        throw new MarketError(
          "CLIENT_ENTRY_MISSING",
          `${packageName} 声明了 Web Client，但 exports[\"./client\"] 不存在。`,
          400,
        );
      }
      const source = readFileSync(clientEntry, "utf8");
      const hasLoaderCall = /(?:window|globalThis)\s*\.\s*__ModuleLoader__\s*\.\s*load\s*\(/u.test(source);
      const hasMatchingId = new RegExp(`\\bid\\s*:\\s*(["'])${literalPattern(packageName)}\\1`, "u").test(source);
      if (!hasLoaderCall || !hasMatchingId) {
        throw new MarketError(
          "CLIENT_REGISTRATION_MISMATCH",
          `${packageName} 的 Client bundle 未通过 __ModuleLoader__.load 注册同名模块。`,
          400,
        );
      }
    }
  }

  return { packageName, hostEntry, clientEntry };
}

function writeFileAtomicSync(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, contents, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, filePath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function markPluginPending(profileDir, plugin) {
  writeFileAtomicSync(
    path.join(profileDir, PENDING_PLUGIN_FILE),
    `${JSON.stringify({
      schema: 1,
      installedAt: new Date().toISOString(),
      ...plugin,
    }, null, 2)}\n`,
  );
}

export function profileDirOf(dshHome, profileName) {
  if (!dshHome) throw new MarketError("DSH_HOME_MISSING", "无法确定 DSH_HOME，安装需要主机环境。", 500);
  return path.join(dshHome, "profiles", profileName || "web");
}

/**
 * 从 GitHub 下载插件仓库并安装到 profile：
 *  1. 下载 codeload tarball；2. 解压到临时目录；3. 校验 package.json；
 *  4. 复制到 <profile>/node_modules/<name>；5. 注册 cordis.patch.yml。
 * 安装完成后需要重启 dsh web 才能生效。
 */
export async function installPlugin({
  owner,
  repo,
  ref,
  force = false,
  proxyUrl = "",
  profileDir,
}) {
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new MarketError("REPO_INVALID", "owner/repo 参数非法。", 400);
  }
  const candidateRef = ref || "main";
  const candidates = candidateRef.startsWith("v") || /^\d/.test(candidateRef)
    ? [`${candidateRef}`]
    : [candidateRef, "main", "master"];

  const workRoot = path.join(tmpdir(), `dsh-market-${randomUUID().slice(0, 8)}`);
  mkdirSync(workRoot, { recursive: true, mode: 0o700 });
  let lastError = null;
  try {
    for (const branch of candidates) {
      const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/${branch}`;
      const tarball = path.join(workRoot, "plugin.tar.gz");
      try {
        const response = await requestBuffer(tarballUrl, { proxyUrl, timeoutMs: 60000 });
        if (response.statusCode >= 400) {
          lastError = new MarketError("DOWNLOAD_FAILED", `下载失败（HTTP ${response.statusCode}），分支/标签：${branch}`, 502);
          continue;
        }
        writeFileSync(tarball, response.body);
      } catch (error) {
        lastError = error;
        continue;
      }
      await run("tar", ["-xzf", tarball, "-C", workRoot], { timeout: 60000 });
      const topDirs = readdirSync(workRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      const sourceDir = path.join(workRoot, topDirs[0]?.name || "");
      const pkgPath = path.join(sourceDir, "package.json");
      if (!existsSync(pkgPath)) {
        lastError = new MarketError("PKG_MISSING", `仓库 ${owner}/${repo}（${branch}）根目录没有 package.json，无法安装。`, 400);
        continue;
      }
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      } catch (error) {
        lastError = new MarketError("PKG_INVALID", `package.json 解析失败：${error.message}`, 400);
        continue;
      }
      const validation = validatePluginPackage(pkg, sourceDir);
      const packageName = validation.packageName;
      const targetDir = path.join(profileDir, "node_modules", ...packageName.split("/"));
      const targetExists = existsSync(targetDir);
      if (targetExists && !force) {
        throw new MarketError("ALREADY_INSTALLED", `${packageName} 已安装（${targetDir}），如需覆盖请使用 force。`, 409);
      }
      const patchFile = path.join(profileDir, "cordis.patch.yml");
      const entryId = packageName.replace(/^@/, "").replace(/\//g, "-");
      const stagingDir = `${targetDir}.installing-${randomUUID().slice(0, 8)}`;
      const backupDir = `${targetDir}.backup-${randomUUID().slice(0, 8)}`;
      const pendingFile = path.join(profileDir, PENDING_PLUGIN_FILE);
      const originalPatch = existsSync(patchFile) ? readFileSync(patchFile, "utf8") : null;
      const originalPending = existsSync(pendingFile) ? readFileSync(pendingFile, "utf8") : null;
      let targetBackedUp = false;
      let targetCommitted = false;

      mkdirSync(path.dirname(targetDir), { recursive: true, mode: 0o700 });
      rmSync(stagingDir, { recursive: true, force: true });
      rmSync(backupDir, { recursive: true, force: true });
      cpSync(sourceDir, stagingDir, { recursive: true, force: false, errorOnExist: true });

      try {
        if (targetExists) {
          renameSync(targetDir, backupDir);
          targetBackedUp = true;
        }
        renameSync(stagingDir, targetDir);
        targetCommitted = true;

        const patch = registerPatchEntry(patchFile, { id: entryId, name: packageName });
        markPluginPending(profileDir, { entryId, packageName, ref: branch });
        rmSync(backupDir, { recursive: true, force: true });
        return {
          installed: true,
          packageName,
          owner,
          repo,
          ref: branch,
          targetDir,
          patchFile,
          patch,
          entryFile: path.join(targetDir, path.relative(sourceDir, validation.hostEntry)),
          clientEntry: validation.clientEntry
            ? path.join(targetDir, path.relative(sourceDir, validation.clientEntry))
            : null,
          restartRequired: true,
          startupProtected: true,
          message: `已安装 ${packageName} 到 ${targetDir}；重启后若插件启动失败，劳博士会自动隔离并恢复。`,
        };
      } catch (error) {
        if (targetCommitted) rmSync(targetDir, { recursive: true, force: true });
        if (targetBackedUp && existsSync(backupDir)) renameSync(backupDir, targetDir);
        if (originalPatch === null) rmSync(patchFile, { force: true });
        else writeFileAtomicSync(patchFile, originalPatch);
        if (originalPending === null) rmSync(pendingFile, { force: true });
        else writeFileAtomicSync(pendingFile, originalPending);
        throw error;
      } finally {
        rmSync(stagingDir, { recursive: true, force: true });
        rmSync(backupDir, { recursive: true, force: true });
      }
    }
    throw lastError || new MarketError("INSTALL_FAILED", "安装失败：没有可用分支。", 500);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

/**
 * 把插件条目追加注册到 profile 的 cordis.patch.yml（幂等：按 id 去重）。
 */
export function registerPatchEntry(patchFile, entry) {
  let text = "";
  try {
    text = readFileSync(patchFile, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (new RegExp(`-\\s+id:\\s*${entry.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(text)) {
    return { already: true, id: entry.id };
  }
  let next = text;
  const trimmed = text.trim();
  const block = `- insert:\n    - id: ${entry.id}\n      name: '${entry.name}'\n`;
  // 空数组形式：文件末行（忽略注释与空行）是 "[]" 时整体替换为 insert 块
  const lines = text.split("\n");
  let emptyArrayAt = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (line === "") continue;
    if (line === "[]") emptyArrayAt = index;
    break;
  }
  if (trimmed === "[]" || emptyArrayAt >= 0) {
    const start = lines.slice(0, emptyArrayAt).join("\n");
    next = `${start}${start && !start.endsWith("\n") ? "\n" : ""}- insert:\n    - id: ${entry.id}\n      name: '${entry.name}'\n`;
  } else {
    next = `${text.replace(/\s+$/, "")}${text ? "\n" : ""}${block}`;
  }
  writeFileAtomicSync(patchFile, next);
  return { already: false, id: entry.id };
}

/* ────────────────────────────── 上传发布 ────────────────────────────── */

function defaultReadme(pkg, { repo }) {
  const name = pkg.name || repo;
  const description = pkg.description || `${repo} — 一个 DeepSeek Harness (DSH) 插件。`;
  return `# ${name}

${description}

## 安装

\`\`\`bash
dsh plugin --profile web add ${repo}
\`\`\`

或手动安装：把本仓库克隆到 \`$DSH_HOME/profiles/web/node_modules/${pkg.name || repo}\`，
并在 \`$DSH_HOME/profiles/web/cordis.patch.yml\` 中注册插件条目，然后重启 \`dsh web\`。

## 功能

- 详见代码与后续更新。

## 许可

${pkg.license || "MIT"}
`;
}

/**
 * 上传本地插件目录到 GitHub（gh CLI）：
 *  1. 校验目录（必须有 package.json）；2. git init/commit（缺 README 则生成）；
 *  3. gh repo create（已存在则直接 push）；4. 添加 topic（默认 dsh-plugin）。
 */
export async function uploadPlugin({
  dir,
  repo,
  owner = "Modole",
  description = "",
  isPrivate = false,
  topics = [],
  proxyUrl = "",
  force = false,
}) {
  const sourceDir = path.resolve(String(dir || ""));
  if (!existsSync(path.join(sourceDir, "package.json"))) {
    throw new MarketError("DIR_INVALID", `目录缺少 package.json：${sourceDir}`, 400);
  }
  if (!/^[\w.-]+$/.test(String(repo || ""))) {
    throw new MarketError("REPO_INVALID", "仓库名只能包含字母、数字、点、横线、下划线。", 400);
  }
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(path.join(sourceDir, "package.json"), "utf8"));
  } catch (error) {
    throw new MarketError("PKG_INVALID", `package.json 解析失败：${error.message}`, 400);
  }
  if (!pkg.name) {
    throw new MarketError("PKG_NAME_MISSING", "package.json 缺少 name 字段。", 400);
  }
  const proxyEnv = proxyUrl
    ? { ...process.env, https_proxy: proxyUrl, HTTPS_PROXY: proxyUrl, http_proxy: proxyUrl, HTTP_PROXY: proxyUrl }
    : process.env;

  const hasGit = existsSync(path.join(sourceDir, ".git"));
  if (!hasGit) await run("git", ["init", "-b", "main"], { cwd: sourceDir, env: proxyEnv });
  const userName = (await run("git", ["config", "user.name"], { cwd: sourceDir })).stdout.trim();
  if (!userName) {
    await run("git", ["config", "user.name", owner], { cwd: sourceDir });
    await run("git", ["config", "user.email", `${owner}@users.noreply.github.com`], { cwd: sourceDir });
  }
  const readmePath = path.join(sourceDir, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, defaultReadme(pkg, { owner, repo }), "utf8");
  }
  const licensePath = path.join(sourceDir, "LICENSE");
  if (!existsSync(licensePath) && pkg.license === "MIT") {
    writeFileSync(licensePath, "MIT License\n\nCopyright (c) 2026 " + owner + "\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n", "utf8");
  }

  await run("git", ["add", "-A"], { cwd: sourceDir });
  const commitResult = await run("git", ["commit", "-m", `chore: publish ${pkg.name}@${pkg.version || "0.1.0"} to dsh-plugin market`], { cwd: sourceDir, env: proxyEnv }).catch(() => ({ ok: false, stdout: "", stderr: "" }));
  if (!commitResult.ok && !/nothing to commit/i.test(commitResult.stderr)) {
    // 允许"无变更"（已有历史提交），其它错误按失败处理
    const headExists = await run("git", ["rev-parse", "HEAD"], { cwd: sourceDir }).then(() => true).catch(() => false);
    if (!headExists) throw new MarketError("GIT_COMMIT_FAILED", "git commit 失败：仓库没有任何提交。", 500);
  }

  const remoteUrl = `https://github.com/${owner}/${repo}.git`;
  const currentRemote = await run("git", ["remote", "get-url", "origin"], { cwd: sourceDir }).then((r) => r.stdout.trim()).catch(() => "");
  if (currentRemote && currentRemote !== remoteUrl) {
    if (!force) {
      throw new MarketError("REMOTE_CONFLICT", `origin 已指向 ${currentRemote}，与目标 ${remoteUrl} 不一致；如确认覆盖请使用 force。`, 409);
    }
    await run("git", ["remote", "set-url", "origin", remoteUrl], { cwd: sourceDir });
  }

  const visibility = isPrivate ? "--private" : "--public";
  const descriptionArg = description || pkg.description || `${pkg.name} — DeepSeek Harness (DSH) 插件。`;
  let repoExisted = false;
  try {
    const createArgs = ["repo", "create", `${owner}/${repo}`, visibility, "--source", ".", "--push", "--description", descriptionArg];
    if (!currentRemote) createArgs.push("--remote", "origin");
    await run("gh", createArgs, {
      cwd: sourceDir,
      env: proxyEnv,
      timeout: 180000,
    });
  } catch (error) {
    if (/already exists|name already exists/i.test(error.message)) {
      repoExisted = true;
    } else {
      throw error;
    }
  }
  if (repoExisted) {
    await run("git", ["push", "-u", "origin", "HEAD"], { cwd: sourceDir, env: proxyEnv, timeout: 180000 });
    await run("gh", ["repo", "edit", `${owner}/${repo}`, "--description", descriptionArg], { env: proxyEnv });
  }
  const finalTopics = [...new Set(["dsh-plugin", ...topics.map((topic) => String(topic).trim()).filter(Boolean)])];
  for (const topic of finalTopics) {
    await run("gh", ["repo", "edit", `${owner}/${repo}`, "--add-topic", topic], { env: proxyEnv });
  }

  const head = (await run("git", ["rev-parse", "HEAD"], { cwd: sourceDir })).stdout.trim();
  return {
    published: true,
    url: `https://github.com/${owner}/${repo}`,
    cloneUrl: remoteUrl,
    owner,
    repo,
    topics: finalTopics,
    commit: head,
    message: `已发布到 https://github.com/${owner}/${repo}（topic: ${finalTopics.join(", ")}）`,
  };
}

/* ────────────────────────────── 设置持久化 ────────────────────────────── */

export function settingsPath(dshHome) {
  return dshHome ? path.join(dshHome, "storages", "dsh-market-laoboshi.json") : null;
}

export function hasSettingsFile(dshHome) {
  const file = settingsPath(dshHome);
  return Boolean(file && existsSync(file));
}

const DEFAULT_SETTINGS = {
  proxyUrl: "",
  registry: SEARCH_API,
  uploadOwner: "Modole",
  profile: "web",
  maxResults: 200,
};

export function loadSettings(dshHome) {
  const file = settingsPath(dshHome);
  if (!file || !existsSync(file)) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(file, "utf8")) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(dshHome, next) {
  const file = settingsPath(dshHome);
  if (!file) throw new MarketError("DSH_HOME_MISSING", "无法确定 DSH_HOME。", 500);
  const merged = { ...DEFAULT_SETTINGS, ...next };
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged;
}

/* ────────────────────────────── 工具函数 ────────────────────────────── */

export function shaShort(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

export function homePath() {
  return process.env.DSH_HOME || path.join(homedir(), ".dsh");
}
