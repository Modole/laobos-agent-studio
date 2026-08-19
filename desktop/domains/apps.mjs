import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { access, appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { boundedString } from "../ipc-security.mjs";
import { resolveWorkspaceDirectory } from "../workspace-authorization.mjs";

const MAX_APPS = 100;
const MAX_LOG_BYTES = 1_500_000;
const STARTUP_TIMEOUT_MS = 30_000;
export const MANAGED_APP_MIN_PORT = 40_000;
export const MANAGED_APP_MAX_PORT = 65_535;

export function registerAppsIpc({
  ipcMain,
  app,
  shell,
  workspace,
  workspaceAuthorizer,
  authorize,
  getMainWindow,
}) {
  const storageRoot = path.join(app.getPath("userData"), "apps");
  const registryFile = path.join(storageRoot, "registry.json");
  const logsRoot = path.join(storageRoot, "logs");
  const docsRoot = path.join(storageRoot, "api-docs");
  const runtime = new Map();

  const logFile = (id) => path.join(logsRoot, `${id}.log`);
  const apiDocFile = (id) => path.join(docsRoot, `${id}.md`);

  async function appendLog(id, value) {
    await mkdir(logsRoot, { recursive: true, mode: 0o700 });
    await appendFile(logFile(id), value, { encoding: "utf8", mode: 0o600 });
  }

  async function listPayload() {
    const registry = await readManagedRegistry(registryFile);
    return Promise.all(registry.map(async (entry) => ({
      ...entry,
      runtime: await applicationRuntime(entry, runtime.get(entry.id)),
    })));
  }

  async function startApplication(id) {
    const current = runtime.get(id);
    if (["starting", "running"].includes(current?.state)) return runtimeState(current);
    const registry = await readManagedRegistry(registryFile);
    const entry = registry.find((item) => item.id === id);
    if (!entry) throw new Error("应用不存在。 ");
    await appCwd(workspace, entry.cwd, workspaceAuthorizer);
    const port = normalizeManagedAppPort(entry.port);
    const observed = await applicationRuntime(entry, current);
    if (observed.state === "online") throw new Error(`端口 ${port} 当前在线，但进程不受本次应用管理器实例控制。请先释放端口或重启对应应用。`);
    await ensureApplicationPortAvailable(registry, port, id);

    const record = {
      state: "starting",
      source: "process",
      pid: undefined,
      startedAt: Date.now(),
      exitCode: undefined,
      signal: undefined,
      error: "",
      log: "",
    };
    runtime.set(id, record);
    sendState(id);
    const output = (chunk) => {
      const text = String(chunk);
      record.log = `${record.log}${text}`.slice(-MAX_LOG_BYTES);
      void appendLog(id, text).catch(() => {});
      send("laobos:apps:log", { id, chunk: text });
    };
    output(`\n[${new Date().toISOString()}] 启动应用，等待端口 ${port} 就绪\n`);

    let child;
    try {
      child = spawn(entry.command, expandPortArguments(entry.args, port), {
        cwd: entry.cwd,
        env: { ...process.env, PORT: String(port), FORCE_COLOR: "1" },
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      record.child = child;
      record.pid = child.pid;
      child.stdout.on("data", output);
      child.stderr.on("data", output);
      child.once("error", (error) => {
        record.error = error.message;
        record.state = "error";
        output(`\n[启动错误] ${error.message}\n`);
        sendState(id);
      });
      child.once("exit", (code, signal) => {
        record.exitCode = code;
        record.signal = signal;
        record.child = undefined;
        if (record.state !== "error") record.state = record.state === "stopping" || code === 0 ? "stopped" : "error";
        output(`\n[进程退出] code=${code ?? "null"} signal=${signal || "none"}\n`);
        sendState(id);
      });
      sendState(id);

      const deadline = Date.now() + STARTUP_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (record.state === "error") throw new Error(record.error || `应用进程在端口 ${port} 就绪前退出。`);
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`应用进程在端口 ${port} 就绪前退出。`);
        if (!(await isTcpPortFree(port))) {
          record.state = "running";
          sendState(id);
          output(`[${new Date().toISOString()}] 端口 ${port} 已就绪\n`);
          return runtimeState(record);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error(`应用未在 ${Math.round(STARTUP_TIMEOUT_MS / 1000)} 秒内监听端口 ${port}。`);
    } catch (error) {
      record.state = "error";
      record.error = error instanceof Error ? error.message : String(error);
      if (child?.exitCode === null) terminate(child, "SIGTERM");
      output(`\n[启动失败] ${record.error}\n`);
      sendState(id);
      throw error;
    }
  }

  async function stopApplication(id) {
    const record = runtime.get(id);
    if (!record?.child || record.child.exitCode !== null) {
      const entry = (await readManagedRegistry(registryFile)).find((item) => item.id === id);
      if (entry && !(await isTcpPortFree(entry.port))) throw new Error("应用端口仍在线，但没有可安全终止的受管进程。 ");
      return { stopped: false };
    }
    record.state = "stopping";
    sendState(id);
    const child = record.child;
    const exited = new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("exit", resolve);
    });
    terminate(child, "SIGTERM");
    let forceTimer;
    await Promise.race([
      exited,
      new Promise((resolve) => { forceTimer = setTimeout(resolve, 4_000); }),
    ]);
    clearTimeout(forceTimer);
    if (child.exitCode === null && child.signalCode === null) terminate(child, "SIGKILL");
    record.state = "stopped";
    void appendLog(id, `\n[${new Date().toISOString()}] 已由应用管理器停止\n`).catch(() => {});
    sendState(id);
    return { stopped: true };
  }

  ipcMain.handle("laobos:apps:list", async (event) => {
    authorize(event);
    return {
      apps: await listPayload(),
      portRange: { minimum: MANAGED_APP_MIN_PORT, maximum: MANAGED_APP_MAX_PORT },
    };
  });

  ipcMain.handle("laobos:apps:detect", async (event, input = {}) => {
    authorize(event);
    return detectApplication(await appCwd(workspace, input.cwd, workspaceAuthorizer));
  });

  ipcMain.handle("laobos:apps:find-port", async (event, input = {}) => {
    authorize(event);
    const registry = await readManagedRegistry(registryFile);
    const port = await findFreeApplicationPort(registry, input.start);
    return { port, url: `http://127.0.0.1:${port}` };
  });

  ipcMain.handle("laobos:apps:save", async (event, input = {}) => {
    authorize(event);
    const registry = await readManagedRegistry(registryFile);
    const id = validId(input.id) || crypto.randomUUID();
    const previous = registry.find((item) => item.id === id);
    if (["running", "starting", "stopping"].includes(runtime.get(id)?.state)) throw new Error("请先停止应用，再修改登记信息。 ");
    const cwd = await appCwd(workspace, input.cwd, workspaceAuthorizer);
    const command = normalizeCommand(input.command);
    const args = normalizeArgs(input.args);
    let port;
    if (input.port === undefined || input.port === null || input.port === "" || Number(input.port) === 0) {
      port = previous?.port ? normalizeManagedAppPort(previous.port) : await findFreeApplicationPort(registry, MANAGED_APP_MIN_PORT, id);
    } else {
      port = normalizeManagedAppPort(input.port);
    }
    const commandPort = extractConfiguredPort([command, ...args].join(" "));
    if (commandPort && commandPort !== port) throw new Error(`启动参数声明了端口 ${commandPort}，必须改为登记端口 ${port} 或使用 {PORT} 占位符。`);
    await ensureApplicationPortAvailable(registry, port, id);
    const entry = {
      id,
      name: boundedString(input.name || path.basename(cwd), "应用名称", 120).trim() || path.basename(cwd),
      cwd,
      command,
      args,
      kind: ["node", "python", "compose", "docker", "native"].includes(input.kind) ? input.kind : previous?.kind || "native",
      port,
      url: normalizeManagedUrl(input.url, port),
      autostart: input.autostart === true,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const index = registry.findIndex((item) => item.id === id);
    if (index === -1) {
      if (registry.length >= MAX_APPS) throw new Error(`应用数量已达到上限（${MAX_APPS}）。`);
      registry.push(entry);
    } else registry[index] = entry;
    await writeRegistry(registryFile, registry);
    return { ...entry, runtime: await applicationRuntime(entry, runtime.get(id)) };
  });

  ipcMain.handle("laobos:apps:start", async (event, input = {}) => {
    authorize(event);
    return startApplication(boundedString(input.id, "应用 ID", 128));
  });

  ipcMain.handle("laobos:apps:stop", async (event, input = {}) => {
    authorize(event);
    return stopApplication(boundedString(input.id, "应用 ID", 128));
  });

  ipcMain.handle("laobos:apps:logs", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "应用 ID", 128);
    try {
      const text = await readFile(logFile(id), "utf8");
      return { log: text.slice(-MAX_LOG_BYTES) };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return { log: runtime.get(id)?.log || "" };
    }
  });

  ipcMain.handle("laobos:apps:api-doc", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "应用 ID", 128);
    try { return { content: await readFile(apiDocFile(id), "utf8") }; }
    catch (error) { if (error?.code === "ENOENT") return { content: "" }; throw error; }
  });

  ipcMain.handle("laobos:apps:save-api-doc", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "应用 ID", 128);
    const content = boundedString(input.content || "", "API 文档", 500_000);
    if (!(await readManagedRegistry(registryFile)).some((item) => item.id === id)) throw new Error("应用不存在。 ");
    await mkdir(docsRoot, { recursive: true, mode: 0o700 });
    await writeFile(apiDocFile(id), content, { encoding: "utf8", mode: 0o600 });
    return { saved: true };
  });

  ipcMain.handle("laobos:apps:remove", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "应用 ID", 128);
    if (["running", "starting", "stopping"].includes(runtime.get(id)?.state)) await stopApplication(id);
    const registry = await readManagedRegistry(registryFile);
    const next = registry.filter((item) => item.id !== id);
    await writeRegistry(registryFile, next);
    runtime.delete(id);
    await Promise.all([
      rm(logFile(id), { force: true }),
      rm(apiDocFile(id), { force: true }),
    ]);
    return { removed: next.length !== registry.length };
  });

  ipcMain.handle("laobos:apps:open", async (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "应用 ID", 128);
    const entry = (await readManagedRegistry(registryFile)).find((item) => item.id === id);
    if (!entry) throw new Error("应用不存在。 ");
    await shell.openExternal(normalizeManagedUrl(entry.url, entry.port));
    return { opened: true };
  });

  function send(channel, value) {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, value);
  }
  function sendState(id) { send("laobos:apps:state", { id, runtime: runtimeState(runtime.get(id)) }); }

  return () => {
    for (const record of runtime.values()) if (record.child?.exitCode === null) terminate(record.child, "SIGTERM");
    runtime.clear();
    for (const channel of [
      "laobos:apps:list", "laobos:apps:detect", "laobos:apps:find-port", "laobos:apps:save",
      "laobos:apps:start", "laobos:apps:stop", "laobos:apps:logs", "laobos:apps:api-doc",
      "laobos:apps:save-api-doc", "laobos:apps:remove", "laobos:apps:open",
    ]) ipcMain.removeHandler(channel);
  };
}

export async function detectApplication(cwd) {
  const packageFile = path.join(cwd, "package.json");
  try {
    const pkg = JSON.parse(await readFile(packageFile, "utf8"));
    const script = pkg.scripts?.dev ? "dev" : pkg.scripts?.start ? "start" : undefined;
    if (script) {
      const scriptBody = String(pkg.scripts[script]);
      const args = ["run", script];
      if (/\bvite\b/u.test(scriptBody)) args.push("--", "--host", "127.0.0.1", "--port", "{PORT}");
      return { detected: true, kind: "node", name: pkg.name || path.basename(cwd), command: "npm", args, port: 0, url: "" };
    }
  } catch (error) { if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error; }
  for (const filename of ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"]) {
    try { await access(path.join(cwd, filename)); return { detected: true, kind: "compose", name: path.basename(cwd), command: "docker", args: ["compose", "up"], port: 0, url: "" }; }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  try {
    await access(path.join(cwd, "pyproject.toml"));
    return { detected: true, kind: "python", name: path.basename(cwd), command: "python3", args: ["-m", "http.server", "{PORT}", "--bind", "127.0.0.1"], port: 0, url: "" };
  } catch (error) { if (error?.code !== "ENOENT") throw error; }
  return { detected: false, kind: "unknown", name: path.basename(cwd), command: "", args: [], port: 0, url: "" };
}

export function normalizeManagedAppPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < MANAGED_APP_MIN_PORT || port > MANAGED_APP_MAX_PORT) {
    throw new Error(`应用端口必须是 ${MANAGED_APP_MIN_PORT}-${MANAGED_APP_MAX_PORT} 范围内的整数。`);
  }
  return port;
}

export async function findFreeApplicationPort(registry = [], start = MANAGED_APP_MIN_PORT, ignoreId) {
  const first = Math.max(MANAGED_APP_MIN_PORT, Math.min(MANAGED_APP_MAX_PORT, Number(start) || MANAGED_APP_MIN_PORT));
  const reserved = new Set(registry.filter((item) => item.id !== ignoreId).map((item) => Number(item.port)).filter(Number.isInteger));
  const count = MANAGED_APP_MAX_PORT - MANAGED_APP_MIN_PORT + 1;
  for (let offset = 0; offset < count; offset += 1) {
    const port = MANAGED_APP_MIN_PORT + ((first - MANAGED_APP_MIN_PORT + offset) % count);
    if (!reserved.has(port) && await isTcpPortFree(port)) return port;
  }
  throw new Error(`${MANAGED_APP_MIN_PORT}-${MANAGED_APP_MAX_PORT} 范围内没有可用端口。`);
}

export async function isTcpPortFree(port) {
  // Probe the loopback and the wildcard address separately. On macOS/BSD,
  // binding 127.0.0.1 can succeed while another socket already holds 0.0.0.0
  // (Flask-style `host="0.0.0.0"`), and the reverse is also true; a port is
  // free only when both addresses accept a new bind.
  for (const host of ["0.0.0.0", "127.0.0.1"]) {
    if (!(await probeTcpBind(host, port))) return false;
  }
  return true;
}

function probeTcpBind(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE" || error?.code === "EACCES") resolve(false);
      else reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

async function ensureApplicationPortAvailable(registry, port, ignoreId) {
  const registered = registry.find((item) => item.id !== ignoreId && Number(item.port) === port);
  if (registered) throw new Error(`端口 ${port} 已登记给应用“${registered.name}”。`);
  if (!(await isTcpPortFree(port))) throw new Error(`端口 ${port} 已被其他进程占用，请选择新的空闲端口。`);
}

async function appCwd(workspace, requested, workspaceAuthorizer) {
  const value = boundedString(requested || workspace, "应用目录", 4096);
  return resolveWorkspaceDirectory({
    authorizer: workspaceAuthorizer,
    defaultRoot: workspace,
    requested: value,
    label: "应用工作区",
  });
}

async function readRegistry(filePath) {
  try { const value = JSON.parse(await readFile(filePath, "utf8")); return Array.isArray(value) ? value : []; }
  catch (error) { if (error?.code === "ENOENT" || error instanceof SyntaxError) return []; throw error; }
}

async function readManagedRegistry(filePath) {
  const registry = await readRegistry(filePath);
  let changed = false;
  for (const entry of registry) {
    if (!entry || typeof entry !== "object") continue;
    let port;
    try { port = normalizeManagedAppPort(entry.port); }
    catch {
      port = await findFreeApplicationPort(registry, MANAGED_APP_MIN_PORT, entry.id);
      entry.port = port;
      changed = true;
    }
    let url;
    try { url = normalizeManagedUrl(entry.url, port); }
    catch { url = `http://127.0.0.1:${port}/`; }
    if (entry.url !== url) { entry.url = url; changed = true; }
    if (!entry.kind) { entry.kind = "native"; changed = true; }
  }
  if (changed) await writeRegistry(filePath, registry);
  return registry;
}

async function writeRegistry(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, filePath);
}

function normalizeCommand(value) {
  const command = boundedString(value, "启动命令", 4096).trim();
  if (!command || command.includes("\0") || /[\r\n]/u.test(command)) throw new Error("启动命令无效。 ");
  return command;
}

function normalizeArgs(value) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? splitArgs(value) : [];
  if (source.length > 64) throw new Error("启动参数过多。 ");
  return source.map((argument) => boundedString(String(argument), "启动参数", 4096));
}

export function splitArgs(value) {
  const result = []; let current = ""; let quote = "";
  for (const char of String(value || "")) {
    if (quote) { if (char === quote) quote = ""; else current += char; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (/\s/u.test(char)) { if (current) { result.push(current); current = ""; } continue; }
    current += char;
  }
  if (quote) throw new Error("启动参数的引号未闭合。 ");
  if (current) result.push(current);
  return result;
}

function extractConfiguredPort(commandLine) {
  const patterns = [
    /(?:--port|-p)(?:=|\s+)(\d{2,5})\b/iu,
    /\bPORT=(\d{2,5})\b/u,
    /\bhttp\.server\s+(\d{2,5})\b/iu,
  ];
  for (const pattern of patterns) {
    const match = commandLine.match(pattern);
    if (match) return Number(match[1]);
  }
  return 0;
}

function expandPortArguments(args, port) {
  return args.map((argument) => argument.replaceAll("{PORT}", String(port)));
}

function normalizeManagedUrl(value, port) {
  const managedPort = normalizeManagedAppPort(port);
  const url = new URL(value || `http://127.0.0.1:${managedPort}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("应用地址只允许 HTTP(S)。 ");
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) throw new Error("应用地址必须使用本机回环地址。 ");
  if (url.username || url.password) throw new Error("应用地址不能包含凭据。 ");
  const urlPort = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (urlPort !== managedPort) throw new Error("应用地址端口必须与登记端口一致。 ");
  return url.toString();
}

async function applicationRuntime(entry, record) {
  if (record && ["starting", "running", "stopping"].includes(record.state)) return runtimeState(record);
  if (entry.port && !(await isTcpPortFree(entry.port))) return { state: "online", source: "port" };
  return record ? runtimeState(record) : { state: "stopped", source: "registry" };
}

function runtimeState(record) {
  return record ? {
    state: record.state,
    source: record.source || "process",
    pid: record.pid,
    startedAt: record.startedAt,
    exitCode: record.exitCode,
    signal: record.signal,
    error: record.error || "",
  } : { state: "stopped", source: "registry" };
}

function validId(value) { return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/u.test(value) ? value : undefined; }

function terminate(child, signal) {
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) { if (error?.code !== "ESRCH") throw error; }
}
