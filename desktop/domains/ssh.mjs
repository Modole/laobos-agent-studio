import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import ssh2 from "ssh2";
import { boundedString } from "../ipc-security.mjs";

const { Client } = ssh2;
const MAX_CONNECTIONS = 6;
const MAX_INPUT_BYTES = 64 * 1024;

export function registerSshIpc({
  ipcMain,
  app,
  safeStorage,
  authorize,
  getMainWindow,
}) {
  const root = path.join(app.getPath("userData"), "ssh");
  const profilesFile = path.join(root, "profiles.json");
  const vaultFile = path.join(root, "vault.json");
  const knownHostsFile = path.join(root, "known-hosts.json");
  const connections = new Map();

  ipcMain.handle("laobos:ssh:list", async (event) => {
    authorize(event);
    const [profiles, vault, knownHosts] = await Promise.all([
      readJson(profilesFile, []),
      readJson(vaultFile, []),
      readJson(knownHostsFile, {}),
    ]);
    return {
      profiles: profiles.map((profile) => ({
        group: "",
        favorite: false,
        ...profile,
        fingerprint: knownHosts[`${profile.host}:${profile.port}`]?.fingerprint || "",
      })),
      credentials: vault.map(({ id, name, type, updatedAt }) => ({ id, name, type, updatedAt })),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    };
  });

  ipcMain.handle("laobos:ssh:save-credential", async (event, input = {}) => {
    authorize(event);
    if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，不能保存 SSH 凭据。 ");
    const id = optionalId(input.id) || crypto.randomUUID();
    const type = input.type === "privateKey" ? "privateKey" : "password";
    const secret = type === "privateKey"
      ? { privateKey: boundedString(input.privateKey, "SSH 私钥", 1024 * 1024), passphrase: optionalSecret(input.passphrase, 16_384) }
      : { password: boundedString(input.password, "SSH 密码", 16_384) };
    if (type === "privateKey" && !secret.privateKey.trim()) throw new Error("SSH 私钥不能为空。 ");
    if (type === "password" && !secret.password) throw new Error("SSH 密码不能为空。 ");
    const vault = await readJson(vaultFile, []);
    const record = {
      id,
      name: boundedString(input.name || "SSH 凭据", "凭据名称", 120).trim() || "SSH 凭据",
      type,
      encrypted: safeStorage.encryptString(JSON.stringify(secret)).toString("base64"),
      updatedAt: new Date().toISOString(),
    };
    const index = vault.findIndex((item) => item.id === id);
    if (index === -1) vault.push(record); else vault[index] = record;
    await writeJsonAtomic(vaultFile, vault);
    return { id, name: record.name, type, updatedAt: record.updatedAt };
  });

  ipcMain.handle("laobos:ssh:save-profile", async (event, input = {}) => {
    authorize(event);
    const [profiles, vault] = await Promise.all([readJson(profilesFile, []), readJson(vaultFile, [])]);
    const id = optionalId(input.id) || crypto.randomUUID();
    const host = normalizeHost(input.host);
    const credentialId = optionalId(input.credentialId);
    if (!credentialId || !vault.some((item) => item.id === credentialId)) throw new Error("请选择有效的 SSH 登录凭据。 ");
    const profile = {
      id,
      name: boundedString(input.name || host, "连接名称", 120).trim() || host,
      host,
      port: portNumber(input.port),
      username: boundedString(input.username, "SSH 用户名", 256).trim(),
      credentialId,
      group: boundedString(input.group || "", "SSH 分组", 120).trim(),
      favorite: input.favorite === true,
      updatedAt: new Date().toISOString(),
    };
    if (!profile.username) throw new Error("SSH 用户名不能为空。 ");
    const index = profiles.findIndex((item) => item.id === id);
    if (index === -1) profiles.push(profile); else profiles[index] = profile;
    await writeJsonAtomic(profilesFile, profiles);
    return profile;
  });

  ipcMain.handle("laobos:ssh:delete-profile", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "SSH 配置 ID", 128);
    const profiles = await readJson(profilesFile, []);
    const next = profiles.filter((item) => item.id !== id);
    await writeJsonAtomic(profilesFile, next);
    return { deleted: next.length !== profiles.length };
  });

  ipcMain.handle("laobos:ssh:delete-credential", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "SSH 凭据 ID", 128);
    const [profiles, vault] = await Promise.all([readJson(profilesFile, []), readJson(vaultFile, [])]);
    if (profiles.some((profile) => profile.credentialId === id)) throw new Error("该凭据仍被 SSH 连接使用，请先修改或删除相关连接。 ");
    const next = vault.filter((item) => item.id !== id);
    await writeJsonAtomic(vaultFile, next);
    return { deleted: next.length !== vault.length };
  });

  ipcMain.handle("laobos:ssh:forget-host-key", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "SSH 配置 ID", 128);
    const [profiles, knownHosts] = await Promise.all([readJson(profilesFile, []), readJson(knownHostsFile, {})]);
    const profile = profiles.find((item) => item.id === id);
    if (!profile) throw new Error("SSH 连接配置不存在。 ");
    const key = `${profile.host}:${profile.port}`;
    const forgotten = Boolean(knownHosts[key]);
    delete knownHosts[key];
    await writeJsonAtomic(knownHostsFile, knownHosts);
    return { forgotten };
  });

  ipcMain.handle("laobos:ssh:connect", async (event, input = {}) => {
    authorize(event);
    if (connections.size >= MAX_CONNECTIONS) throw new Error(`SSH 连接数量已达到上限（${MAX_CONNECTIONS}）。`);
    const profileId = boundedString(input.profileId, "SSH 配置 ID", 128);
    const [profiles, vault, knownHosts] = await Promise.all([
      readJson(profilesFile, []),
      readJson(vaultFile, []),
      readJson(knownHostsFile, {}),
    ]);
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("SSH 连接配置不存在。 ");
    const credential = vault.find((item) => item.id === profile.credentialId);
    if (!credential) throw new Error("SSH 凭据不存在，请重新配置。 ");
    if (!safeStorage.isEncryptionAvailable()) throw new Error("系统安全存储不可用，不能读取 SSH 凭据。 ");
    let secret;
    try {
      secret = JSON.parse(safeStorage.decryptString(Buffer.from(credential.encrypted, "base64")));
    } catch {
      throw new Error("SSH 凭据无法解密，请重新保存。 ");
    }
    const connectionId = crypto.randomUUID();
    const client = new Client();
    const knownKey = `${profile.host}:${profile.port}`;
    const remembered = knownHosts[knownKey];
    let offeredFingerprint = "";
    let keyChanged = false;

    const connected = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        client.end();
        if (keyChanged) reject(new Error(`HOST_KEY_CHANGED:${offeredFingerprint}`));
        else if (offeredFingerprint && !remembered && input.acceptUnknownHostKey !== true) reject(new Error(`HOST_KEY_UNKNOWN:${offeredFingerprint}`));
        else reject(error instanceof Error ? error : new Error(String(error)));
      };
      const timer = setTimeout(() => fail(new Error("SSH 连接超时。 ")), 15_000);
      client.once("error", fail);
      client.once("ready", () => {
        if (settled) return;
        client.shell({ term: "xterm-256color", cols: dimension(input.cols, 80, 20, 500), rows: dimension(input.rows, 24, 5, 200) }, async (error, stream) => {
          if (error) { clearTimeout(timer); fail(error); return; }
          settled = true; clearTimeout(timer);
          if (!remembered && offeredFingerprint) {
            knownHosts[knownKey] = { fingerprint: offeredFingerprint, firstSeenAt: new Date().toISOString() };
            await writeJsonAtomic(knownHostsFile, knownHosts);
          }
          const record = { id: connectionId, client, stream, profileId };
          connections.set(connectionId, record);
          stream.on("data", (data) => send("laobos:ssh:data", { id: connectionId, data: Buffer.from(data).toString("utf8") }));
          stream.on("close", () => closeConnection(connectionId, "stream-closed"));
          resolve({ id: connectionId, profile: { id: profile.id, name: profile.name, host: profile.host, port: profile.port, username: profile.username }, fingerprint: offeredFingerprint });
        });
      });
      client.connect({
        host: profile.host,
        port: profile.port,
        username: profile.username,
        readyTimeout: 15_000,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
        hostVerifier: (key) => {
          offeredFingerprint = fingerprint(key);
          if (remembered) {
            keyChanged = remembered.fingerprint !== offeredFingerprint;
            return !keyChanged;
          }
          return input.acceptUnknownHostKey === true;
        },
        ...(credential.type === "privateKey"
          ? { privateKey: secret.privateKey, ...(secret.passphrase ? { passphrase: secret.passphrase } : {}) }
          : { password: secret.password }),
      });
    });
    return connected;
  });

  ipcMain.handle("laobos:ssh:write", (event, input = {}) => {
    authorize(event);
    const connection = requireConnection(connections, input.id);
    const data = boundedString(input.data, "SSH 输入", MAX_INPUT_BYTES);
    if (Buffer.byteLength(data, "utf8") > MAX_INPUT_BYTES) throw new Error("SSH 输入过长。 ");
    connection.stream.write(data);
    return { accepted: true };
  });

  ipcMain.handle("laobos:ssh:resize", (event, input = {}) => {
    authorize(event);
    const connection = requireConnection(connections, input.id);
    connection.stream.setWindow(dimension(input.rows, 24, 5, 200), dimension(input.cols, 80, 20, 500), 0, 0);
    return { accepted: true };
  });

  ipcMain.handle("laobos:ssh:disconnect", (event, input = {}) => {
    authorize(event);
    return { disconnected: closeConnection(boundedString(input.id, "SSH 连接 ID", 128), "user") };
  });

  function closeConnection(id, reason) {
    const connection = connections.get(id);
    if (!connection) return false;
    connections.delete(id);
    connection.stream.end();
    connection.client.end();
    send("laobos:ssh:exit", { id, reason });
    return true;
  }

  function send(channel, payload) {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  }

  return () => {
    for (const id of [...connections.keys()]) closeConnection(id, "shutdown");
    for (const channel of ["laobos:ssh:list", "laobos:ssh:save-credential", "laobos:ssh:save-profile", "laobos:ssh:delete-profile", "laobos:ssh:delete-credential", "laobos:ssh:forget-host-key", "laobos:ssh:connect", "laobos:ssh:write", "laobos:ssh:resize", "laobos:ssh:disconnect"]) ipcMain.removeHandler(channel);
  };
}

export function fingerprint(key) {
  const data = Buffer.isBuffer(key) ? key : Buffer.from(key);
  return `SHA256:${crypto.createHash("sha256").update(data).digest("base64").replace(/=+$/u, "")}`;
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) { if (error?.code === "ENOENT" || error instanceof SyntaxError) return structuredClone(fallback); throw error; }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
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
