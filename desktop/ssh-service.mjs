import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ssh2 from "ssh2";
import { boundedString } from "./ipc-security.mjs";

const { Client, utils: sshUtils } = ssh2;
const MAX_CONNECTIONS = 6;
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_REMOTE_FILE_BYTES = 2 * 1024 * 1024;

export class SshService extends EventEmitter {
  constructor({ app, safeStorage, homeDirectory = os.homedir() }) {
    super();
    this.safeStorage = safeStorage;
    this.homeDirectory = homeDirectory;
    this.root = path.join(app.getPath("userData"), "ssh");
    this.profilesFile = path.join(this.root, "profiles.json");
    this.vaultFile = path.join(this.root, "vault.json");
    this.knownHostsFile = path.join(this.root, "known-hosts.json");
    this.connections = new Map();
  }

  async list() {
    const [profiles, vault, knownHosts] = await Promise.all([
      readJson(this.profilesFile, []),
      readJson(this.vaultFile, []),
      readJson(this.knownHostsFile, {}),
    ]);
    return {
      profiles: profiles.map((profile) => normalizeStoredProfile(profile, knownHosts)),
      credentials: vault.map(({ id, name, type, updatedAt }) => ({ id, name, type, updatedAt })),
      encryptionAvailable: this.safeStorage.isEncryptionAvailable(),
    };
  }

  async listAgentProfiles() {
    const { profiles } = await this.list();
    return profiles.map((profile) => {
      const publicValue = { ...profile };
      delete publicValue.credentialId;
      delete publicValue.identityFile;
      return {
        ...publicValue,
        authentication: profile.authMode === "credential" ? "stored credential" : profile.authMode,
        trusted: Boolean(profile.fingerprint),
      };
    });
  }

  async saveCredential(input = {}) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，不能保存 SSH 凭据。 ");
    const id = optionalId(input.id) || crypto.randomUUID();
    const type = input.type === "privateKey" ? "privateKey" : "password";
    const secret = type === "privateKey"
      ? { privateKey: boundedString(input.privateKey, "SSH 私钥", 1024 * 1024), passphrase: optionalSecret(input.passphrase, 16_384) }
      : { password: boundedString(input.password, "SSH 密码", 16_384) };
    if (type === "privateKey" && !secret.privateKey.trim()) throw new Error("SSH 私钥不能为空。 ");
    if (type === "password" && !secret.password) throw new Error("SSH 密码不能为空。 ");
    const vault = await readJson(this.vaultFile, []);
    const record = {
      id,
      name: boundedString(input.name || "SSH 凭据", "凭据名称", 120).trim() || "SSH 凭据",
      type,
      encrypted: this.safeStorage.encryptString(JSON.stringify(secret)).toString("base64"),
      updatedAt: new Date().toISOString(),
    };
    const index = vault.findIndex((item) => item.id === id);
    if (index === -1) vault.push(record); else vault[index] = record;
    await writeJsonAtomic(this.vaultFile, vault);
    return { id, name: record.name, type, updatedAt: record.updatedAt };
  }

  async saveProfile(input = {}) {
    const [profiles, vault] = await Promise.all([readJson(this.profilesFile, []), readJson(this.vaultFile, [])]);
    const id = optionalId(input.id) || crypto.randomUUID();
    const host = normalizeHost(input.host);
    const authMode = authModeValue(input.authMode);
    const credentialId = optionalId(input.credentialId);
    if (authMode === "credential" && (!credentialId || !vault.some((item) => item.id === credentialId))) {
      throw new Error("请选择有效的 SSH 登录凭据。 ");
    }
    const identityFile = authMode === "identityFile"
      ? boundedString(input.identityFile, "SSH 私钥路径", 4096).trim()
      : "";
    if (authMode === "identityFile" && !identityFile) throw new Error("SSH 私钥路径不能为空。 ");
    const profile = {
      id,
      name: boundedString(input.name || host, "连接名称", 120).trim() || host,
      host,
      port: portNumber(input.port),
      username: boundedString(input.username, "SSH 用户名", 256).trim(),
      authMode,
      credentialId: authMode === "credential" ? credentialId : "",
      identityFile,
      proxyJump: boundedString(input.proxyJump || "", "SSH 跳板机", 256).trim(),
      group: boundedString(input.group || "", "SSH 分组", 120).trim(),
      favorite: input.favorite === true,
      configAlias: boundedString(input.configAlias || "", "SSH Config 别名", 256).trim(),
      source: input.source === "openssh" ? "openssh" : "manual",
      updatedAt: new Date().toISOString(),
    };
    if (!profile.username) throw new Error("SSH 用户名不能为空。 ");
    const index = profiles.findIndex((item) => item.id === id);
    if (index === -1) profiles.push(profile); else profiles[index] = profile;
    await writeJsonAtomic(this.profilesFile, profiles);
    return profile;
  }

  async importOpenSshConfig() {
    const configPath = path.join(os.homedir(), ".ssh", "config");
    let content;
    try { content = await readFile(configPath, "utf8"); }
    catch (error) {
      if (error?.code === "ENOENT") return { imported: 0, skipped: 0, configPath, profiles: [] };
      throw error;
    }
    const candidates = parseOpenSshConfig(content);
    const profiles = await readJson(this.profilesFile, []);
    let imported = 0;
    let skipped = 0;
    const changed = [];
    for (const candidate of candidates) {
      if (!candidate.host || !candidate.username) { skipped += 1; continue; }
      const existing = profiles.findIndex((profile) => profile.source === "openssh" && profile.configAlias === candidate.configAlias);
      const profile = {
        ...(existing >= 0 ? profiles[existing] : { id: crypto.randomUUID() }),
        ...candidate,
        updatedAt: new Date().toISOString(),
      };
      if (existing >= 0) profiles[existing] = profile; else profiles.push(profile);
      changed.push(profile);
      imported += 1;
    }
    if (imported) await writeJsonAtomic(this.profilesFile, profiles);
    return { imported, skipped, configPath, profiles: changed };
  }

  async deleteProfile(input = {}) {
    const id = boundedString(input.id, "SSH 配置 ID", 128);
    const profiles = await readJson(this.profilesFile, []);
    const next = profiles.filter((item) => item.id !== id);
    await writeJsonAtomic(this.profilesFile, next);
    return { deleted: next.length !== profiles.length };
  }

  async deleteCredential(input = {}) {
    const id = boundedString(input.id, "SSH 凭据 ID", 128);
    const [profiles, vault] = await Promise.all([readJson(this.profilesFile, []), readJson(this.vaultFile, [])]);
    if (profiles.some((profile) => profile.credentialId === id)) throw new Error("该凭据仍被 SSH 连接使用，请先修改或删除相关连接。 ");
    const next = vault.filter((item) => item.id !== id);
    await writeJsonAtomic(this.vaultFile, next);
    return { deleted: next.length !== vault.length };
  }

  async forgetHostKey(input = {}) {
    const id = boundedString(input.id, "SSH 配置 ID", 128);
    const [profiles, knownHosts] = await Promise.all([readJson(this.profilesFile, []), readJson(this.knownHostsFile, {})]);
    const profile = profiles.find((item) => item.id === id);
    if (!profile) throw new Error("SSH 连接配置不存在。 ");
    const key = hostKey(profile);
    const forgotten = Boolean(knownHosts[key]);
    delete knownHosts[key];
    await writeJsonAtomic(this.knownHostsFile, knownHosts);
    return { forgotten };
  }

  async connect(input = {}) {
    if (this.connections.size >= MAX_CONNECTIONS) throw new Error(`SSH 连接数量已达到上限（${MAX_CONNECTIONS}）。`);
    const prepared = await this.#prepareConnection(input.profileId, {
      acceptUnknownHostKey: input.acceptUnknownHostKey === true,
    });
    const connectionId = crypto.randomUUID();
    try {
      const stream = await openShell(prepared.client, {
        cols: dimension(input.cols, 80, 20, 500),
        rows: dimension(input.rows, 24, 5, 200),
      });
      const record = { id: connectionId, ...prepared, stream, closing: false };
      this.connections.set(connectionId, record);
      stream.on("data", (data) => this.emit("data", { id: connectionId, data: Buffer.from(data).toString("utf8") }));
      stream.on("close", () => this.close(connectionId, "stream-closed"));
      return {
        id: connectionId,
        profile: publicProfile(prepared.profile),
        fingerprint: prepared.fingerprint,
      };
    } catch (error) {
      closeClients(prepared.clients);
      throw error;
    }
  }

  write(input = {}) {
    const connection = requireConnection(this.connections, input.id);
    const data = boundedString(input.data, "SSH 输入", MAX_INPUT_BYTES);
    if (Buffer.byteLength(data, "utf8") > MAX_INPUT_BYTES) throw new Error("SSH 输入过长。 ");
    connection.stream.write(data);
    return { accepted: true };
  }

  resize(input = {}) {
    const connection = requireConnection(this.connections, input.id);
    connection.stream.setWindow(dimension(input.rows, 24, 5, 200), dimension(input.cols, 80, 20, 500), 0, 0);
    return { accepted: true };
  }

  close(idValue, reason = "user") {
    const id = boundedString(idValue, "SSH 连接 ID", 128);
    const connection = this.connections.get(id);
    if (!connection || connection.closing) return false;
    connection.closing = true;
    this.connections.delete(id);
    connection.stream.end();
    closeClients(connection.clients);
    this.emit("exit", { id, reason });
    return true;
  }

  async executeCommand(input = {}) {
    const command = boundedString(input.command, "远程命令", 65_536).trim();
    if (!command) throw new Error("远程命令不能为空。 ");
    const prepared = await this.#prepareConnection(input.profileId, { acceptUnknownHostKey: false });
    const timeoutMs = Math.min(120_000, Math.max(1_000, Number(input.timeoutMs) || 30_000));
    try {
      return await execRemote(prepared.client, command, timeoutMs);
    } finally {
      closeClients(prepared.clients);
    }
  }

  async sftpProfile(input = {}) {
    const prepared = await this.#prepareConnection(input.profileId, { acceptUnknownHostKey: false });
    try {
      return await withSftp(prepared.client, (sftp) => performSftpAction(sftp, input));
    } finally {
      closeClients(prepared.clients);
    }
  }

  async sftpConnection(input = {}) {
    const connection = requireConnection(this.connections, input.id);
    return withSftp(connection.client, (sftp) => performSftpAction(sftp, input));
  }

  async uploadLocal(input = {}) {
    const connection = requireConnection(this.connections, input.id);
    const localPath = path.resolve(boundedString(input.localPath, "本地文件路径", 4096));
    const remotePath = remotePathValue(input.remotePath);
    await withSftp(connection.client, (sftp) => sftpCall(sftp, "fastPut", localPath, remotePath));
    return { uploaded: true, localPath, remotePath };
  }

  async downloadLocal(input = {}) {
    const connection = requireConnection(this.connections, input.id);
    const localPath = path.resolve(boundedString(input.localPath, "本地文件路径", 4096));
    const remotePath = remotePathValue(input.remotePath);
    await withSftp(connection.client, (sftp) => sftpCall(sftp, "fastGet", remotePath, localPath));
    return { downloaded: true, localPath, remotePath };
  }

  dispose() {
    for (const id of [...this.connections.keys()]) this.close(id, "shutdown");
    this.removeAllListeners();
  }

  async #prepareConnection(profileIdValue, { acceptUnknownHostKey }) {
    const profileId = boundedString(profileIdValue, "SSH 配置 ID", 128);
    const [profiles, vault, knownHosts] = await Promise.all([
      readJson(this.profilesFile, []),
      readJson(this.vaultFile, []),
      readJson(this.knownHostsFile, {}),
    ]);
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("SSH 连接配置不存在。 ");
    const clients = [];
    try {
      const prepared = await this.#connectProfile(profile, {
        profiles,
        vault,
        knownHosts,
        acceptUnknownHostKey,
        targetIdentity: profile.id || `${profile.username}@${profile.host}:${profile.port}`,
        clients,
        visited: new Set(),
      });
      return { ...prepared, clients };
    } catch (error) {
      closeClients(clients);
      throw error;
    }
  }

  async #connectProfile(profile, context) {
    const identity = profile.id || `${profile.username}@${profile.host}:${profile.port}`;
    if (context.visited.has(identity)) throw new Error("SSH 跳板机配置存在循环引用。 ");
    context.visited.add(identity);
    let sock;
    if (profile.proxyJump) {
      const jump = resolveJumpProfile(profile.proxyJump, context.profiles, profile);
      const jumpPrepared = await this.#connectProfile(jump, context);
      sock = await forwardOut(jumpPrepared.client, profile.host, portNumber(profile.port));
    }
    const auth = await this.#authenticationOptions(profile, context.vault);
    const key = hostKey(profile);
    const remembered = context.knownHosts[key];
    let result;
    try {
      result = await connectClient({
        profile,
        sock,
        auth,
        remembered,
        acceptUnknownHostKey: context.acceptUnknownHostKey && identity === context.targetIdentity,
      });
    } catch (error) {
      if (identity !== context.targetIdentity && error?.message?.startsWith("HOST_KEY_UNKNOWN:")) {
        throw new Error(`跳板机“${profile.name || profile.host}”的主机指纹尚未信任。请先在 SSH 页面中单独连接并核验该跳板机。`);
      }
      throw error;
    }
    context.clients.push(result.client);
    if (!remembered && result.fingerprint) {
      context.knownHosts[key] = { fingerprint: result.fingerprint, firstSeenAt: new Date().toISOString() };
      await writeJsonAtomic(this.knownHostsFile, context.knownHosts);
    }
    context.visited.delete(identity);
    return { ...result, profile: normalizeStoredProfile(profile, context.knownHosts) };
  }

  async #authenticationOptions(profile, vault) {
    const authMode = authModeValue(profile.authMode || (profile.credentialId ? "credential" : "agent"));
    if (authMode === "agent") {
      const agent = process.env.SSH_AUTH_SOCK || (process.platform === "win32" ? "pageant" : "");
      const privateKey = await readDefaultIdentity(this.homeDirectory);
      if (!agent && !privateKey) throw new Error("未检测到可用的 ssh-agent 或 OpenSSH 默认私钥，请在连接设置中指定认证方式。 ");
      return { ...(privateKey ? { privateKey } : {}), ...(agent ? { agent } : {}) };
    }
    if (authMode === "identityFile") {
      const identityFile = expandHome(profile.identityFile, this.homeDirectory);
      if (!identityFile) throw new Error("SSH 私钥路径为空。 ");
      let privateKey;
      try {
        privateKey = await readFile(identityFile);
      } catch {
        throw new Error("无法读取 SSH 私钥文件，请在 SSH 页面检查路径和文件权限。 ");
      }
      const parsed = sshUtils.parseKey(privateKey);
      if (parsed instanceof Error) {
        const agent = process.env.SSH_AUTH_SOCK || (process.platform === "win32" ? "pageant" : "");
        if (agent) return { agent };
        throw new Error("SSH 私钥需要口令或格式不受支持，请将密钥加入 ssh-agent，或改用应用安全凭据。 ");
      }
      return { privateKey, agent: process.env.SSH_AUTH_SOCK || undefined };
    }
    const credential = vault.find((item) => item.id === profile.credentialId);
    if (!credential) throw new Error("SSH 凭据不存在，请重新配置。 ");
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，不能读取 SSH 凭据。 ");
    let secret;
    try { secret = JSON.parse(this.safeStorage.decryptString(Buffer.from(credential.encrypted, "base64"))); }
    catch { throw new Error("SSH 凭据无法解密，请重新保存。 "); }
    return credential.type === "privateKey"
      ? { privateKey: secret.privateKey, ...(secret.passphrase ? { passphrase: secret.passphrase } : {}), agent: process.env.SSH_AUTH_SOCK || undefined }
      : { password: secret.password, tryKeyboard: true };
  }
}

export function parseOpenSshConfig(content) {
  const blocks = [];
  let aliases = [];
  let values = {};
  const flush = () => {
    for (const alias of aliases) {
      if (/[*?!]/u.test(alias)) continue;
      const identityFile = expandHome(values.identityfile || "");
      blocks.push({
        name: alias,
        configAlias: alias,
        host: values.hostname || alias,
        port: portNumber(values.port || 22),
        username: values.user || os.userInfo().username,
        authMode: identityFile ? "identityFile" : "agent",
        credentialId: "",
        identityFile,
        proxyJump: values.proxyjump && values.proxyjump !== "none" ? values.proxyjump : "",
        group: "OpenSSH Config",
        favorite: false,
        source: "openssh",
      });
    }
  };
  for (const rawLine of String(content).split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, "").trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?<key>\S+)\s+(?<value>.+)$/u.exec(line);
    if (!match) continue;
    const key = match.groups.key.toLowerCase();
    const value = match.groups.value.trim();
    if (key === "host") {
      flush();
      aliases = value.split(/\s+/u).filter(Boolean);
      values = {};
    } else if (aliases.length && values[key] === undefined) {
      values[key] = value;
    }
  }
  flush();
  return blocks;
}

export function fingerprint(key) {
  const data = Buffer.isBuffer(key) ? key : Buffer.from(key);
  return `SHA256:${crypto.createHash("sha256").update(data).digest("base64").replace(/=+$/u, "")}`;
}

function normalizeStoredProfile(profile, knownHosts) {
  const normalized = {
    group: "",
    favorite: false,
    authMode: profile.credentialId ? "credential" : "agent",
    identityFile: "",
    proxyJump: "",
    configAlias: "",
    source: "manual",
    ...profile,
  };
  normalized.authMode = authModeValue(profile.authMode || (profile.credentialId ? "credential" : "agent"));
  return { ...normalized, fingerprint: knownHosts[hostKey(normalized)]?.fingerprint || "" };
}

function publicProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    group: profile.group || "",
    configAlias: profile.configAlias || "",
  };
}

function authModeValue(value) {
  return ["credential", "agent", "identityFile"].includes(value) ? value : "credential";
}

function hostKey(profile) {
  return `${profile.host}:${portNumber(profile.port)}`;
}

function resolveJumpProfile(value, profiles, target) {
  const requested = String(value || "").trim();
  const existing = profiles.find((profile) => profile.id === requested || profile.configAlias === requested || profile.name === requested);
  if (existing) return existing;
  const match = /^(?:(?<username>[^@\s]+)@)?(?<host>\[[^\]]+\]|[^:\s]+)(?::(?<port>\d+))?$/u.exec(requested);
  if (!match) throw new Error(`无法解析 SSH 跳板机：${requested}`);
  return {
    id: `jump:${requested}`,
    name: requested,
    host: match.groups.host.replace(/^\[|\]$/gu, ""),
    port: portNumber(match.groups.port || 22),
    username: match.groups.username || target.username,
    authMode: "agent",
    proxyJump: "",
  };
}

function connectClient({ profile, sock, auth, remembered, acceptUnknownHostKey }) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let offeredFingerprint = "";
    let keyChanged = false;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.end();
      if (keyChanged) reject(new Error(`HOST_KEY_CHANGED:${offeredFingerprint}`));
      else if (offeredFingerprint && !remembered && !acceptUnknownHostKey) reject(new Error(`HOST_KEY_UNKNOWN:${offeredFingerprint}`));
      else reject(error instanceof Error ? error : new Error(String(error)));
    };
    const timer = setTimeout(() => fail(new Error("SSH 连接超时。 ")), 15_000);
    client.once("error", fail);
    client.once("ready", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ client, fingerprint: offeredFingerprint });
    });
    if (auth.password) {
      client.on("keyboard-interactive", (_name, _instructions, _language, prompts, finish) => {
        const canAnswer = prompts.length === 1 && prompts[0]?.echo === false;
        finish(canAnswer ? [auth.password] : []);
      });
    }
    client.connect({
      host: profile.host,
      port: portNumber(profile.port),
      username: profile.username,
      readyTimeout: 15_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      ...(sock ? { sock } : {}),
      hostVerifier: (key) => {
        offeredFingerprint = fingerprint(key);
        if (remembered) {
          keyChanged = remembered.fingerprint !== offeredFingerprint;
          return !keyChanged;
        }
        return acceptUnknownHostKey;
      },
      ...auth,
    });
  });
}

function openShell(client, { cols, rows }) {
  return new Promise((resolve, reject) => {
    client.shell({ term: "xterm-256color", cols, rows }, (error, stream) => error ? reject(error) : resolve(stream));
  });
}

function forwardOut(client, host, port) {
  return new Promise((resolve, reject) => {
    client.forwardOut("127.0.0.1", 0, host, port, (error, stream) => error ? reject(error) : resolve(stream));
  });
}

function execRemote(client, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) { reject(error); return; }
      const stdout = [];
      const stderr = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let truncated = false;
      const collect = (chunks, kind) => (data) => {
        const buffer = Buffer.from(data);
        const current = kind === "stdout" ? stdoutBytes : stderrBytes;
        const remaining = Math.max(0, MAX_COMMAND_OUTPUT_BYTES - current);
        if (remaining) chunks.push(buffer.subarray(0, remaining));
        if (kind === "stdout") stdoutBytes += Math.min(buffer.length, remaining);
        else stderrBytes += Math.min(buffer.length, remaining);
        if (buffer.length > remaining) truncated = true;
      };
      stream.on("data", collect(stdout, "stdout"));
      stream.stderr.on("data", collect(stderr, "stderr"));
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`远程命令执行超时（${timeoutMs}ms）。`));
      }, timeoutMs);
      stream.once("close", (code, signal) => {
        clearTimeout(timer);
        resolve({
          command,
          exitCode: Number.isInteger(code) ? code : null,
          signal: signal || null,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          truncated,
        });
      });
      stream.once("error", (streamError) => { clearTimeout(timer); reject(streamError); });
    });
  });
}

function withSftp(client, action) {
  return new Promise((resolve, reject) => {
    client.sftp(async (error, sftp) => {
      if (error) { reject(error); return; }
      try { resolve(await action(sftp)); }
      catch (reason) { reject(reason); }
      finally { sftp.end(); }
    });
  });
}

async function performSftpAction(sftp, input) {
  const action = String(input.action || "list");
  const remotePath = remotePathValue(input.path || input.remotePath || ".");
  if (action === "list") {
    const entries = await sftpCall(sftp, "readdir", remotePath);
    return {
      path: remotePath,
      entries: entries.map((entry) => ({
        name: entry.filename,
        longname: entry.longname,
        size: entry.attrs.size,
        modifiedAt: entry.attrs.mtime ? new Date(entry.attrs.mtime * 1000).toISOString() : null,
        type: entry.attrs.isDirectory() ? "directory" : entry.attrs.isSymbolicLink() ? "symlink" : "file",
      })),
    };
  }
  if (action === "read") {
    const value = await sftpCall(sftp, "readFile", remotePath);
    if (value.length > MAX_REMOTE_FILE_BYTES) throw new Error("远程文件超过 2 MiB，不能在应用内直接读取。 ");
    return { path: remotePath, content: value.toString(input.encoding === "base64" ? "base64" : "utf8"), encoding: input.encoding === "base64" ? "base64" : "utf8", size: value.length };
  }
  if (action === "write") {
    const contentLimit = input.encoding === "base64" ? Math.ceil(MAX_REMOTE_FILE_BYTES * 4 / 3) + 4 : MAX_REMOTE_FILE_BYTES;
    const content = boundedString(input.content, "远程文件内容", contentLimit);
    const value = input.encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf8");
    if (value.length > MAX_REMOTE_FILE_BYTES) throw new Error("远程文件内容超过 2 MiB。 ");
    await sftpCall(sftp, "writeFile", remotePath, value);
    return { written: true, path: remotePath, size: value.length };
  }
  if (action === "mkdir") {
    await sftpCall(sftp, "mkdir", remotePath);
    return { created: true, path: remotePath };
  }
  if (action === "rename") {
    const destination = remotePathValue(input.destination);
    await sftpCall(sftp, "rename", remotePath, destination);
    return { renamed: true, path: remotePath, destination };
  }
  if (action === "remove") {
    if (input.resourceType === "directory") await sftpCall(sftp, "rmdir", remotePath);
    else await sftpCall(sftp, "unlink", remotePath);
    return { removed: true, path: remotePath };
  }
  throw new Error(`不支持的 SFTP 操作：${action}`);
}

function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (error, value) => error ? reject(error) : resolve(value));
  });
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) { if (error?.code === "ENOENT" || error instanceof SyntaxError) return structuredClone(fallback); throw error; }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

function normalizeHost(value) {
  const host = boundedString(value, "SSH 主机", 253).trim();
  if (!host || /[\s/@]/u.test(host) || host.includes("://")) throw new Error("SSH 主机地址无效。 ");
  return host;
}

function optionalId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/u.test(value) ? value : undefined;
}

function optionalSecret(value, maxLength) {
  return typeof value === "string" ? boundedString(value, "SSH 密钥口令", maxLength) : "";
}

function portNumber(value) {
  const port = Number(value || 22);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("SSH 端口无效。 ");
  return port;
}

function dimension(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.floor(number))) : fallback;
}

function requireConnection(connections, value) {
  const id = boundedString(value, "SSH 连接 ID", 128);
  const connection = connections.get(id);
  if (!connection) throw new Error("SSH 连接已经关闭。 ");
  return connection;
}

function remotePathValue(value) {
  const remotePath = boundedString(value, "远程路径", 4096).trim();
  if (!remotePath || remotePath.includes("\0")) throw new Error("远程路径无效。 ");
  return remotePath;
}

async function readDefaultIdentity(homeDirectory) {
  const names = ["id_rsa", "id_ecdsa", "id_ecdsa_sk", "id_ed25519", "id_ed25519_sk", "id_xmss", "id_dsa"];
  for (const name of names) {
    try {
      const privateKey = await readFile(path.join(homeDirectory, ".ssh", name));
      if (!(sshUtils.parseKey(privateKey) instanceof Error)) return privateKey;
    } catch {}
  }
  return undefined;
}

function expandHome(value, homeDirectory = os.homedir()) {
  const text = String(value || "").trim().replace(/^['"]|['"]$/gu, "");
  if (!text) return "";
  if (text === "~") return homeDirectory;
  if (text.startsWith("~/") || text.startsWith("~\\")) return path.join(homeDirectory, text.slice(2));
  return path.resolve(text.replaceAll("%d", homeDirectory));
}

function closeClients(clients) {
  for (const client of [...clients].reverse()) {
    try { client.end(); } catch {}
  }
}
