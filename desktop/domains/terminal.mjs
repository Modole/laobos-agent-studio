import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as pty from "node-pty";
import { boundedString, resolveAuthorizedPath } from "../ipc-security.mjs";

const MAX_TERMINALS = 8;
const MAX_WRITE_BYTES = 64 * 1024;

export function registerTerminalIpc({
  ipcMain,
  workspace,
  authorize,
  getMainWindow,
}) {
  const terminals = new Map();

  ipcMain.handle("laobos:terminal:create", async (event, input = {}) => {
    authorize(event);
    if (terminals.size >= MAX_TERMINALS) throw new Error(`终端数量已达到上限（${MAX_TERMINALS}）。`);
    const cwd = await terminalCwd(workspace, input.cwd);
    const cols = dimension(input.cols, 80, 20, 500);
    const rows = dimension(input.rows, 24, 5, 200);
    const tmuxRequested = input.tmux === true && process.platform !== "win32";
    const tmuxExecutable = tmuxRequested ? findExecutable("tmux") : undefined;
    const useTmux = Boolean(tmuxExecutable);
    const tmuxKey = useTmux ? terminalTmuxKey(input.tmuxKey) : "";
    const tmuxSession = useTmux ? tmuxSessionName(cwd, tmuxKey) : undefined;
    const tmuxPreparation = useTmux
      ? prepareTmuxWorkspace(tmuxExecutable, tmuxSession, cwd)
      : undefined;
    const command = useTmux ? tmuxExecutable : defaultShell();
    const args = useTmux
      ? ["new-session", "-A", "-s", tmuxSession, "-c", cwd]
      : defaultShellArgs(command);
    const id = crypto.randomUUID();
    let terminal;
    try {
      terminal = pty.spawn(command, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
      });
    } catch (error) {
      if (useTmux) throw new Error(`无法启动 tmux：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    terminals.set(id, terminal);
    terminal.onData((data) => send("laobos:terminal:data", { id, data }));
    terminal.onExit(({ exitCode, signal }) => {
      terminals.delete(id);
      send("laobos:terminal:exit", { id, exitCode, signal });
    });
    return {
      id,
      cwd,
      tmux: useTmux,
      tmuxSession,
      warning: tmuxRequested && !useTmux
        ? "当前系统未安装 tmux，已自动回退到登录 Shell。安装 tmux 后重新连接即可启用会话保持。"
        : tmuxPreparation?.warning,
    };
  });

  ipcMain.handle("laobos:terminal:write", (event, input = {}) => {
    authorize(event);
    const terminal = requireTerminal(terminals, input.id);
    const data = boundedString(input.data, "终端输入", MAX_WRITE_BYTES);
    if (Buffer.byteLength(data, "utf8") > MAX_WRITE_BYTES) throw new Error("终端输入过长。 ");
    terminal.write(data);
    return { accepted: true };
  });

  ipcMain.handle("laobos:terminal:resize", (event, input = {}) => {
    authorize(event);
    const terminal = requireTerminal(terminals, input.id);
    terminal.resize(dimension(input.cols, 80, 20, 500), dimension(input.rows, 24, 5, 200));
    return { accepted: true };
  });

  ipcMain.handle("laobos:terminal:close", (event, input = {}) => {
    authorize(event);
    const id = boundedString(input.id, "终端 ID", 128);
    const terminal = terminals.get(id);
    if (terminal) {
      terminals.delete(id);
      terminal.kill();
    }
    return { closed: Boolean(terminal) };
  });

  function send(channel, payload) {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
  }

  return () => {
    for (const terminal of terminals.values()) terminal.kill();
    terminals.clear();
    for (const channel of ["laobos:terminal:create", "laobos:terminal:write", "laobos:terminal:resize", "laobos:terminal:close"]) {
      ipcMain.removeHandler(channel);
    }
  };
}

export function tmuxSessionName(cwd, key = "") {
  const identity = key ? `${path.resolve(cwd)}\0${key}` : path.resolve(cwd);
  return `laobos-${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
}

/**
 * Reusing `tmux new-session -A` does not apply `-c` to an existing pane. Move
 * an idle shell back to the workspace by respawning it there; if that pane is
 * busy, preserve its process and make a fresh workspace window active instead.
 */
export function prepareTmuxWorkspace(tmuxExecutable, sessionName, cwd, run = runTmuxCommand) {
  const sessionTarget = `=${sessionName}`;
  if (!tmuxSucceeded(run(tmuxExecutable, ["has-session", "-t", sessionTarget]))) {
    return { action: "create" };
  }

  const pane = run(tmuxExecutable, [
    "display-message",
    "-p",
    "-t",
    `${sessionTarget}:`,
    "#{pane_id}\t#{pane_current_command}",
  ]);
  const [paneId = "", paneCommand = ""] = tmuxSucceeded(pane)
    ? String(pane.stdout || "").trim().split("\t", 2)
    : [];

  if (paneId && isShellCommand(paneCommand)) {
    const respawn = run(tmuxExecutable, ["respawn-pane", "-k", "-t", paneId, "-c", cwd]);
    if (tmuxSucceeded(respawn)) {
      return { action: "respawn" };
    }
  }

  const newWindow = run(tmuxExecutable, ["new-window", "-t", sessionTarget, "-c", cwd]);
  if (tmuxSucceeded(newWindow)) {
    return {
      action: "new-window",
      warning: "原 tmux 窗口正在运行任务，已保留任务并在当前工作区打开新窗口。",
    };
  }

  return {
    action: "attach",
    warning: "已连接既有 tmux 会话，但无法自动切换到当前工作区目录。",
  };
}

export function findExecutable(command, envPath = process.env.PATH || "") {
  if (!command || command.includes(path.sep)) return undefined;
  for (const directory of envPath.split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return undefined;
}

async function terminalCwd(workspace, requested) {
  const value = requested ? boundedString(requested, "终端目录", 4096) : workspace;
  const relative = path.relative(workspace, path.resolve(value));
  return (await resolveAuthorizedPath(workspace, relative, { kind: "directory" })).path;
}

function terminalTmuxKey(value) {
  if (value === undefined) return "";
  const key = boundedString(value, "tmux 会话键", 128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(key)) {
    throw new Error("tmux 会话键格式无效。 ");
  }
  return key;
}

function defaultShell() {
  if (process.platform === "win32") return process.env.COMSPEC || "powershell.exe";
  return process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
}

function defaultShellArgs(command) {
  if (process.platform === "win32") return [];
  return path.basename(command) === "zsh" || path.basename(command) === "bash" ? ["-l"] : [];
}

function runTmuxCommand(executable, args) {
  return spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 2_000,
    windowsHide: true,
  });
}

function tmuxSucceeded(result) {
  return result?.status === 0 && !result.error;
}

function isShellCommand(command) {
  const name = path.basename(String(command || "")).replace(/^-+/u, "");
  return new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh", "fish", "nu", "elvish", "xonsh"]).has(name);
}

function dimension(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function requireTerminal(terminals, value) {
  const id = boundedString(value, "终端 ID", 128);
  const terminal = terminals.get(id);
  if (!terminal) throw new Error("终端已经关闭。 ");
  return terminal;
}
