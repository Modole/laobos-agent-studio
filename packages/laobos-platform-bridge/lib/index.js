import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const name = "laobos-platform-bridge";
export const inject = ["webServer"];

const API_PREFIX = "/laobos/api/platform";
const MAX_RPC_BODY_BYTES = 70 * 1024 * 1024;
const MAX_TRANSFER_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TRANSFER_BATCH_BYTES = 50 * 1024 * 1024;
const PLATFORM_CAPABILITIES = Object.freeze({
  conversationHtml: false,
  sessionTrash: false,
  workspaceFiles: true,
  gitReview: true,
  uploadSettings: true,
  fileAttachments: true,
  terminal: true,
  browserPreview: false,
  browserOps: false,
  ssh: true,
  apps: true,
  cloudAuth: false,
  clipboard: true,
  shellManager: false,
  softwareUpdate: false,
});

const RPC_CHANNELS = new Map([
  ["workspace.context", "laobos:workspace:context"],
  ["workspace.list", "laobos:workspace:list"],
  ["workspace.read", "laobos:workspace:read"],
  ["workspace.write", "laobos:workspace:write"],
  ["workspace.create", "laobos:workspace:create"],
  ["workspace.rename", "laobos:workspace:rename"],
  ["workspace.remove", "laobos:workspace:remove"],
  ["workspace.reveal", "laobos:workspace:reveal"],
  ["workspace.open", "laobos:workspace:open"],
  ["git.inspect", "laobos:git:inspect"],
  ["git.status", "laobos:git:status"],
  ["git.summary", "laobos:git:summary"],
  ["git.diff", "laobos:git:diff"],
  ["git.log", "laobos:git:log"],
  ["git.init", "laobos:git:init"],
  ["git.stage", "laobos:git:stage"],
  ["git.unstage", "laobos:git:unstage"],
  ["git.commit", "laobos:git:commit"],
  ["git.branch", "laobos:git:branch"],
  ["git.restore", "laobos:git:restore"],
  ["git.sync", "laobos:git:sync"],
  ["uploads.setLocation", "laobos:uploads:set-location"],
  ["uploads.pasteFiles", "laobos:uploads:paste-files"],
  ["uploads.reveal", "laobos:uploads:reveal"],
  ["terminal.create", "laobos:terminal:create"],
  ["terminal.write", "laobos:terminal:write"],
  ["terminal.resize", "laobos:terminal:resize"],
  ["terminal.close", "laobos:terminal:close"],
  ["ssh.list", "laobos:ssh:list"],
  ["ssh.saveCredential", "laobos:ssh:save-credential"],
  ["ssh.saveProfile", "laobos:ssh:save-profile"],
  ["ssh.deleteProfile", "laobos:ssh:delete-profile"],
  ["ssh.deleteCredential", "laobos:ssh:delete-credential"],
  ["ssh.forgetHostKey", "laobos:ssh:forget-host-key"],
  ["ssh.importConfig", "laobos:ssh:import-config"],
  ["ssh.connect", "laobos:ssh:connect"],
  ["ssh.write", "laobos:ssh:write"],
  ["ssh.resize", "laobos:ssh:resize"],
  ["ssh.disconnect", "laobos:ssh:disconnect"],
  ["ssh.sftp", "laobos:ssh:sftp"],
  ["apps.list", "laobos:apps:list"],
  ["apps.detect", "laobos:apps:detect"],
  ["apps.findPort", "laobos:apps:find-port"],
  ["apps.save", "laobos:apps:save"],
  ["apps.start", "laobos:apps:start"],
  ["apps.stop", "laobos:apps:stop"],
  ["apps.logs", "laobos:apps:logs"],
  ["apps.apiDoc", "laobos:apps:api-doc"],
  ["apps.saveApiDoc", "laobos:apps:save-api-doc"],
  ["apps.remove", "laobos:apps:remove"],
  ["apps.open", "laobos:apps:open"],
]);

class PlatformBridgeError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class EventBuffer {
  constructor(limit = 4_000) {
    this.limit = limit;
    this.sequence = 0;
    this.events = [];
    this.waiters = new Set();
  }

  publish(channel, payload) {
    const event = { seq: ++this.sequence, channel, payload };
    this.events.push(event);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
    for (const wake of this.waiters) wake();
    this.waiters.clear();
  }

  after(value) {
    const sequence = Number.isSafeInteger(Number(value)) ? Number(value) : 0;
    return this.events.filter((event) => event.seq > sequence).slice(0, 500);
  }

  async wait(after, timeoutMs) {
    const ready = this.after(after);
    if (ready.length) return ready;
    await new Promise((resolve) => {
      let timer;
      const wake = () => {
        clearTimeout(timer);
        this.waiters.delete(wake);
        resolve();
      };
      timer = setTimeout(wake, timeoutMs);
      this.waiters.add(wake);
    });
    return this.after(after);
  }

  dispose() {
    for (const wake of this.waiters) wake();
    this.waiters.clear();
    this.events.length = 0;
  }
}

function createIpcAdapter(events) {
  const handlers = new Map();
  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        if (handlers.has(channel)) throw new Error(`重复注册平台调用：${channel}`);
        handlers.set(channel, handler);
      },
      removeHandler(channel) {
        handlers.delete(channel);
      },
    },
    getMainWindow: () => ({
      isDestroyed: () => false,
      webContents: { send: (channel, payload) => events.publish(channel, payload) },
    }),
  };
}

async function studioModules(studioRoot) {
  if (!studioRoot) {
    throw new PlatformBridgeError(
      "STUDIO_ROOT_MISSING",
      "跨平台桥接缺少 LAOBOS_STUDIO_ROOT，请通过劳博士启动脚本运行 DSH。",
      503,
    );
  }
  const load = (relative) => import(pathToFileURL(path.join(studioRoot, relative)).href);
  const [workspaceFiles, gitReview, terminal, sshDomain, sshRuntime, apps, settings, sshAgentBridge] = await Promise.all([
    load("desktop/domains/workspace-files.mjs"),
    load("desktop/domains/git-review.mjs"),
    load("desktop/domains/terminal.mjs"),
    load("desktop/domains/ssh.mjs"),
    load("desktop/ssh-service.mjs"),
    load("desktop/domains/apps.mjs"),
    load("desktop/domains/desktop-settings.mjs"),
    load("desktop/ssh-agent-bridge.mjs"),
  ]);
  return { workspaceFiles, gitReview, terminal, sshDomain, sshRuntime, apps, settings, sshAgentBridge };
}

async function encryptedFileStorage(root) {
  const keyFile = path.join(root, "vault.key");
  await mkdir(root, { recursive: true, mode: 0o700 });
  let key;
  try {
    key = await readFile(keyFile);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const candidate = crypto.randomBytes(32);
    try {
      await writeFile(keyFile, candidate, { flag: "wx", mode: 0o600 });
      key = candidate;
    } catch (writeError) {
      if (writeError?.code !== "EEXIST") throw writeError;
      key = await readFile(keyFile);
    }
  }
  if (key.byteLength !== 32) throw new Error("浏览器 SSH 凭据密钥无效，请删除 platform/vault.key 后重新配置。 ");
  return Object.freeze({
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
      return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(value) {
      const payload = Buffer.from(value);
      if (payload[0] !== 1 || payload.byteLength < 30) throw new Error("SSH 凭据密文格式无效。 ");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, payload.subarray(1, 13));
      decipher.setAuthTag(payload.subarray(13, 29));
      return Buffer.concat([decipher.update(payload.subarray(29)), decipher.final()]).toString("utf8");
    },
  });
}

function launch(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { detached: true, stdio: "ignore", windowsHide: true });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve("");
    });
  });
}

function platformShell() {
  const open = async (target, reveal = false) => {
    const value = String(target || "");
    if (process.platform === "darwin") return launch("open", reveal ? ["-R", value] : [value]);
    if (process.platform === "win32") return launch("explorer.exe", reveal ? [`/select,${value}`] : [value]);
    return launch("xdg-open", [reveal ? path.dirname(value) : value]);
  };
  return {
    openExternal: async (value) => {
      const target = new URL(String(value));
      if (!new Set(["http:", "https:"]).has(target.protocol)) throw new Error("只允许打开 HTTP(S) 地址。 ");
      return open(target.href);
    },
    openPath: (value) => open(path.resolve(String(value))),
    showItemInFolder: (value) => { void open(path.resolve(String(value)), true).catch(() => {}); },
  };
}

function decodeRpcValue(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(decodeRpcValue);
  if (!value || typeof value !== "object") return value;
  if (typeof value.__laobosBytes === "string") return Uint8Array.from(Buffer.from(value.__laobosBytes, "base64"));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeRpcValue(child)]));
}

function safeTransferName(value) {
  const name = path.basename(String(value || "file").replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/gu, "_")
    .trim()
    .slice(0, 180);
  return name && name !== "." && name !== ".." ? name : "file";
}

async function writeTransferFiles(root, files) {
  if (!Array.isArray(files) || files.length === 0) return [];
  if (files.length > 10) throw new PlatformBridgeError("TOO_MANY_FILES", "一次最多传输 10 个文件。", 413);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const values = [];
  let total = 0;
  try {
    for (const file of files) {
      const name = safeTransferName(file?.name);
      const bytes = file?.bytes instanceof Uint8Array ? Buffer.from(file.bytes) : undefined;
      if (!bytes) throw new PlatformBridgeError("FILE_INVALID", `文件“${name}”内容无效。`);
      if (bytes.byteLength > MAX_TRANSFER_FILE_BYTES) throw new PlatformBridgeError("FILE_TOO_LARGE", `文件“${name}”超过 20 MB 上限。`, 413);
      total += bytes.byteLength;
      if (total > MAX_TRANSFER_BATCH_BYTES) throw new PlatformBridgeError("BATCH_TOO_LARGE", "本次文件总大小超过 50 MB 上限。", 413);
      const localPath = path.join(root, `${crypto.randomUUID()}-${name}`);
      await writeFile(localPath, bytes, { flag: "wx", mode: 0o600 });
      values.push({ name, localPath, size: bytes.byteLength });
    }
    return values;
  } catch (error) {
    await Promise.all(values.map((file) => rm(file.localPath, { force: true })));
    throw error;
  }
}

export async function createPlatformRuntime({
  studioRoot = process.env.LAOBOS_STUDIO_ROOT,
  dshHome = process.env.DSH_HOME || path.join(process.cwd(), ".dsh"),
  workspace = process.cwd(),
} = {}) {
  const modules = await studioModules(studioRoot);
  const platformRoot = path.join(dshHome, "platform");
  const transferRoot = path.join(platformRoot, "transfers");
  const events = new EventBuffer();
  const adapter = createIpcAdapter(events);
  const settings = new modules.settings.DesktopSettingsStore(path.join(platformRoot, "settings.json"));
  const safeStorage = await encryptedFileStorage(platformRoot);
  const app = { getPath: (key) => key === "userData" ? platformRoot : platformRoot };
  const dialog = {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showSaveDialog: async () => ({ canceled: true }),
  };
  const shell = platformShell();
  const authorize = () => {};
  const common = {
    ipcMain: adapter.ipcMain,
    app,
    dialog,
    shell,
    workspace: path.resolve(workspace),
    dshHome: path.resolve(dshHome),
    getMainWindow: adapter.getMainWindow,
    settings,
    workspaceAuthorizer: undefined,
    authorize,
  };
  const sshService = new modules.sshRuntime.SshService({ app, safeStorage });
  const disposers = [
    modules.workspaceFiles.registerWorkspaceFilesIpc(common),
    modules.gitReview.registerGitReviewIpc(common),
    modules.terminal.registerTerminalIpc(common),
    modules.sshDomain.registerSshIpc({ ...common, safeStorage, sshService }),
    modules.apps.registerAppsIpc(common),
  ];

  let agentBridge;
  if (!process.env.LAOBOS_SSH_BRIDGE_URL || !process.env.LAOBOS_SSH_BRIDGE_TOKEN) {
    agentBridge = await modules.sshAgentBridge.startSshAgentBridge({ service: sshService });
    process.env.LAOBOS_SSH_BRIDGE_URL = agentBridge.url;
    process.env.LAOBOS_SSH_BRIDGE_TOKEN = agentBridge.token;
  }

  return {
    capabilities: PLATFORM_CAPABILITIES,
    events,
    async invoke(method, rawInput = {}) {
      const input = decodeRpcValue(rawInput);
      if (method === "ssh.upload") {
        const temporary = await writeTransferFiles(transferRoot, input.files);
        try {
          const remoteDirectory = String(input.remoteDirectory || ".").replace(/\/+$/u, "") || "/";
          const uploaded = [];
          for (const file of temporary) {
            const remotePath = `${remoteDirectory === "/" ? "" : remoteDirectory}/${file.name}`;
            uploaded.push(await sshService.uploadLocal({ id: input.id, localPath: file.localPath, remotePath }));
          }
          return { canceled: false, files: uploaded };
        } finally {
          await Promise.all(temporary.map((file) => rm(file.localPath, { force: true })));
        }
      }
      if (method === "ssh.download") {
        const name = safeTransferName(input.remotePath);
        await mkdir(transferRoot, { recursive: true, mode: 0o700 });
        const localPath = path.join(transferRoot, `${crypto.randomUUID()}-${name}`);
        try {
          const result = await sshService.downloadLocal({ id: input.id, remotePath: input.remotePath, localPath });
          const bytes = await readFile(localPath);
          if (bytes.byteLength > MAX_TRANSFER_BATCH_BYTES) throw new PlatformBridgeError("FILE_TOO_LARGE", "下载文件超过 50 MB 上限。", 413);
          return { canceled: false, ...result, name, base64: bytes.toString("base64") };
        } finally {
          await rm(localPath, { force: true });
        }
      }
      const channel = RPC_CHANNELS.get(method);
      if (!channel) throw new PlatformBridgeError("METHOD_NOT_FOUND", `不支持的平台调用：${method}`, 404);
      const handler = adapter.handlers.get(channel);
      if (!handler) throw new PlatformBridgeError("METHOD_UNAVAILABLE", `平台调用尚未就绪：${method}`, 503);
      return handler({ sender: "laobos-platform-bridge" }, input);
    },
    async dispose() {
      for (const dispose of disposers.reverse()) dispose();
      events.dispose();
      await agentBridge?.close().catch(() => {});
      sshService.dispose();
      await rm(transferRoot, { recursive: true, force: true }).catch(() => {});
    },
  };
}

function json(res, status, value) {
  const payload = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
}

function assertTrustedRequest(req) {
  const address = req.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
    throw new PlatformBridgeError("LOOPBACK_REQUIRED", "跨平台工具接口仅允许本机访问。", 403);
  }
  const origin = req.headers.origin;
  if (origin) {
    let originUrl;
    try { originUrl = new URL(origin); }
    catch { throw new PlatformBridgeError("ORIGIN_REJECTED", "请求来源无效。", 403); }
    if (originUrl.host !== String(req.headers.host || "")) {
      throw new PlatformBridgeError("ORIGIN_REJECTED", "请求来源不受信任。", 403);
    }
  }
}

async function requestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_RPC_BODY_BYTES) throw new PlatformBridgeError("BODY_TOO_LARGE", "平台调用内容超过 70 MB 上限。", 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new PlatformBridgeError("JSON_INVALID", "平台调用 JSON 无效。", 400); }
}

function errorResponse(res, error) {
  json(res, error instanceof PlatformBridgeError ? error.status : 500, {
    error: {
      code: error?.code || "PLATFORM_BRIDGE_ERROR",
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

export async function apply(ctx) {
  const runtime = await createPlatformRuntime();
  ctx.effect(() => {
    const unregister = ctx.webServer.register({
      kind: "prefix",
      path: API_PREFIX,
      async handler(req, res) {
        try {
          assertTrustedRequest(req);
          const url = new URL(req.url || "/", "http://127.0.0.1");
          const route = url.pathname.slice(API_PREFIX.length) || "/";
          if (req.method === "GET" && route === "/status") {
            json(res, 200, {
              name,
              version: 1,
              transport: "same-origin-loopback-http",
              workspace: process.cwd(),
              capabilities: runtime.capabilities,
            });
            return;
          }
          if (req.method === "GET" && route === "/events") {
            const after = Number(url.searchParams.get("after")) || 0;
            const wait = Math.min(20_000, Math.max(0, Number(url.searchParams.get("wait")) || 0));
            const events = wait ? await runtime.events.wait(after, wait) : runtime.events.after(after);
            json(res, 200, { events, cursor: events.at(-1)?.seq || after });
            return;
          }
          if (req.method === "POST" && route === "/rpc") {
            const payload = await requestBody(req);
            if (typeof payload.method !== "string" || payload.method.length > 100) {
              throw new PlatformBridgeError("METHOD_INVALID", "平台调用方法无效。", 400);
            }
            json(res, 200, { result: await runtime.invoke(payload.method, payload.params || {}) });
            return;
          }
          throw new PlatformBridgeError("NOT_FOUND", "跨平台工具接口不存在。", 404);
        } catch (error) {
          errorResponse(res, error);
        }
      },
    });
    return () => {
      unregister();
      void runtime.dispose();
    };
  }, "laobos-platform-bridge: browser RPC and event transport");
  ctx.logger.info("跨平台工具桥接已启用：浏览器可调用工作区、Git、终端、SSH、附件与应用管理能力");
}
