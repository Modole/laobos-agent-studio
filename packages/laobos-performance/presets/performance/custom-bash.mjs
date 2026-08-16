import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

export const name = "laobos-shell-router";
export const inject = ["subprocess", "tools"];

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_BYTES = 64_000;

const commandSchema = {
  type: "object",
  properties: {
    command: {
      type: "string",
      description: "The shell command to execute.",
    },
    workdir: {
      type: "string",
      description: "Optional working directory; defaults to the session cwd.",
    },
  },
  required: ["command"],
  additionalProperties: false,
};

export async function readShellRouterState(statePath) {
  if (!statePath) return undefined;
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    return parsed?.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function shellPlans(state, platform = process.platform) {
  if (platform !== "win32") {
    return [{
      backend: "native-bash",
      executable: "/bin/bash",
      launchArgs: ["--noprofile", "--norc"],
      persistent: true,
    }];
  }

  const plans = [];
  if (state?.wsl?.ready && state.wsl.executable && state.wsl.distribution) {
    plans.push({
      backend: "wsl",
      executable: state.wsl.executable,
      launchArgs: [
        "-d",
        state.wsl.distribution,
        "--exec",
        "bash",
        "--noprofile",
        "--norc",
      ],
      persistent: true,
    });
  }
  if (state?.gitBash?.executable) {
    plans.push({
      backend: "git-bash",
      executable: state.gitBash.executable,
      launchArgs: ["--noprofile", "--norc"],
      persistent: true,
    });
  }
  plans.push({
    backend: "powershell",
    executable: state?.powershell?.executable || "powershell.exe",
    prefix: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"],
    persistent: false,
  });
  return plans;
}

function appendBounded(current, chunk, maximumBytes) {
  const next = `${current}${chunk}`;
  if (Buffer.byteLength(next) <= maximumBytes) return next;
  const characters = Array.from(next);
  let bytes = 0;
  let index = characters.length;
  while (index > 0) {
    const size = Buffer.byteLength(characters[index - 1]);
    if (bytes + size > maximumBytes) break;
    bytes += size;
    index -= 1;
  }
  return `[output truncated]\n${characters.slice(index).join("")}`;
}

class ShellCommandError extends Error {
  constructor(message, commandStarted, options) {
    super(message, options);
    this.commandStarted = commandStarted;
  }
}

class PersistentPipeShell {
  constructor(handle, backend, maximumBytes) {
    this.handle = handle;
    this.backend = backend;
    this.maximumBytes = maximumBytes;
    this.alive = true;
    this.carryStdout = "";
    this.carryStderr = "";
    this.queue = Promise.resolve();
    handle.stdout?.on("data", (chunk) => this.onStdout(String(chunk)));
    handle.stderr?.on("data", (chunk) => this.onStderr(String(chunk)));
    handle.done.then(
      (outcome) => this.onExit(`shell exited (code=${String(outcome.exitCode)}, signal=${String(outcome.signal)})`),
      (error) => this.onExit(error instanceof Error ? error.message : String(error)),
    );
  }

  async initialize(signal) {
    const marker = `LAOBOS_READY_${randomUUID()}`;
    await this.request(`printf '\\036${marker}:0\\037\\n'\n`, marker, signal, false);
  }

  execute(command, signal) {
    const run = () => {
      const marker = `LAOBOS_DONE_${randomUUID()}`;
      const payload = Buffer.from(command, "utf8").toString("base64");
      const script = [
        `eval "$(printf '%s' '${payload}' | base64 -d)"`,
        "__laobos_exit_code=$?",
        `printf '\\036${marker}:%s\\037\\n' "$__laobos_exit_code"`,
        "unset __laobos_exit_code",
        "",
      ].join("\n");
      return this.request(script, marker, signal, true);
    };
    const queued = this.queue.then(run, run);
    this.queue = queued.catch(() => {});
    return queued;
  }

  request(script, marker, signal, commandStarted) {
    if (!this.alive || !this.handle.stdin) {
      throw new ShellCommandError("persistent shell is not running", false);
    }
    if (this.waiter) {
      throw new ShellCommandError("persistent shell already has an active command", false);
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.terminate();
        this.settleWaiter(new ShellCommandError("shell command cancelled or timed out", commandStarted));
      };
      this.waiter = {
        marker,
        commandStarted,
        stdout: this.carryStdout,
        stderr: this.carryStderr,
        resolve,
        reject,
        signal,
        onAbort,
      };
      this.carryStdout = "";
      this.carryStderr = "";
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }
      this.handle.stdin.write(script, (error) => {
        if (!error) return;
        this.settleWaiter(new ShellCommandError(error.message, false, { cause: error }));
      });
    });
  }

  onStdout(chunk) {
    const waiter = this.waiter;
    if (!waiter) {
      this.carryStdout = appendBounded(this.carryStdout, chunk, this.maximumBytes);
      return;
    }
    waiter.stdout = appendBounded(waiter.stdout, chunk, this.maximumBytes);
    const control = `\x1e${waiter.marker}:`;
    const begin = waiter.stdout.indexOf(control);
    if (begin < 0) return;
    const end = waiter.stdout.indexOf("\x1f", begin + control.length);
    if (end < 0) return;
    const codeText = waiter.stdout.slice(begin + control.length, end);
    const exitCode = Number(codeText);
    const output = waiter.stdout.slice(0, begin).replace(/\n$/u, "");
    this.carryStdout = waiter.stdout.slice(end + 1).replace(/^\r?\n/u, "");
    const stderr = waiter.stderr.replace(/\n$/u, "");
    this.settleWaiter(undefined, {
      exitCode: Number.isInteger(exitCode) ? exitCode : 1,
      text: [output, stderr].filter(Boolean).join("\n"),
    });
  }

  onStderr(chunk) {
    if (this.waiter) {
      this.waiter.stderr = appendBounded(
        this.waiter.stderr,
        chunk,
        this.maximumBytes,
      );
    } else {
      this.carryStderr = appendBounded(this.carryStderr, chunk, this.maximumBytes);
    }
  }

  onExit(message) {
    this.alive = false;
    if (this.waiter) {
      this.settleWaiter(new ShellCommandError(message, this.waiter.commandStarted));
    }
  }

  settleWaiter(error, value) {
    const waiter = this.waiter;
    if (!waiter) return;
    this.waiter = undefined;
    waiter.signal?.removeEventListener("abort", waiter.onAbort);
    if (error) waiter.reject(error);
    else waiter.resolve(value);
  }

  async terminate() {
    if (!this.alive) return;
    this.alive = false;
    await this.handle.terminate().catch(() => {});
  }
}

function collectedText(handle) {
  let stdout = "";
  let stderr = "";
  try {
    stdout = handle.collected.stdout?.readFrom(0).text || "";
    stderr = handle.collected.stderr?.readFrom(0).text || "";
  } catch {
    // A provider may omit collected readers; the exit marker remains useful.
  }
  return [stdout, stderr].filter(Boolean).join("\n");
}

async function createPersistentShell(ctx, plan, options) {
  const executable = await ctx.subprocess.resolveExecutable(
    plan.executable,
    undefined,
    options.signal,
  );
  const handle = ctx.subprocess.spawn({
    argv: [executable, ...plan.launchArgs],
    ...(options.workdir ? { cwd: options.workdir } : {}),
    stdio: { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    ...(options.signal ? { signal: options.signal } : {}),
    graceMs: 3_000,
  });
  const shell = new PersistentPipeShell(handle, plan.backend, options.maxOutputBytes);
  try {
    await shell.initialize(options.signal);
    return shell;
  } catch (error) {
    await shell.terminate();
    throw new ShellCommandError(
      error instanceof Error ? error.message : String(error),
      false,
      { cause: error },
    );
  }
}

async function runOneShot(ctx, plan, command, options) {
  const executable = await ctx.subprocess.resolveExecutable(
    plan.executable,
    undefined,
    options.signal,
  );
  const handle = ctx.subprocess.spawn({
    argv: [executable, ...plan.prefix, command],
    ...(options.workdir ? { cwd: options.workdir } : {}),
    stdio: {
      stdin: "ignore",
      stdout: { maxBytes: options.maxOutputBytes },
      stderr: { maxBytes: options.maxOutputBytes },
    },
    ...(options.signal ? { signal: options.signal } : {}),
    graceMs: 3_000,
  });
  const outcome = await handle.done;
  return { exitCode: outcome.exitCode ?? 1, signal: outcome.signal, text: collectedText(handle) };
}

export function apply(ctx, config = {}) {
  const timeoutMs = Number.isSafeInteger(config.timeoutMs) && config.timeoutMs > 0
    ? config.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = Number.isSafeInteger(config.maxOutputBytes) && config.maxOutputBytes > 0
    ? config.maxOutputBytes
    : DEFAULT_MAX_OUTPUT_BYTES;
  const sessions = new WeakMap();

  ctx.tools.register({
    name: "bash",
    description: [
      "Run commands through the 劳博士 shell router.",
      "* Windows prefers a persistent WSL Bash, then persistent Git Bash; PowerShell is a compatibility fallback while Bash is unavailable.",
      "* Bash state (working directory, variables, and background jobs) persists across calls for the same session.",
      "* Do not assume Bash syntax after output reports a PowerShell fallback.",
      "* Commands that started are never replayed on another backend.",
      "* Please avoid commands that may produce a very large amount of output.",
    ].join("\n"),
    parameters: commandSchema,
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    async execute(args, exec) {
      const routerState = await readShellRouterState(
        config.statePath || process.env.LAOBOS_SHELL_STATE_PATH,
      );
      const plans = shellPlans(routerState, config.platform || process.platform);
      const workdir = typeof args.workdir === "string" && args.workdir
        ? args.workdir
        : exec?.agent?.session?.header?.cwd;
      const deadline = AbortSignal.timeout(timeoutMs);
      const signal = exec?.signal
        ? AbortSignal.any([exec.signal, deadline])
        : deadline;
      let lastInfrastructureError;

      for (const plan of plans) {
        try {
          let result;
          if (plan.persistent) {
            const key = `${plan.backend}\0${plan.executable}\0${plan.launchArgs.join("\0")}\0${workdir || ""}`;
            let record = exec?.agent ? sessions.get(exec.agent) : undefined;
            if (record && (record.key !== key || !record.shell.alive)) {
              await record.shell.terminate();
              if (exec?.agent) sessions.delete(exec.agent);
              record = undefined;
            }
            if (!record) {
              const shell = await createPersistentShell(ctx, plan, {
                signal,
                workdir,
                maxOutputBytes,
              });
              record = { key, shell };
              if (exec?.agent) {
                sessions.set(exec.agent, record);
                exec.agent.ctx.effect(
                  () => () => shell.terminate(),
                  `laobos-shell: ${plan.backend} cleanup`,
                );
              }
            }
            result = await record.shell.execute(args.command, signal);
          } else {
            result = await runOneShot(ctx, plan, args.command, {
              signal,
              workdir,
              maxOutputBytes,
            });
          }

          const marker = result.signal
            ? `[killed by signal: ${result.signal}]`
            : result.exitCode === 0
              ? ""
              : `[exit code: ${String(result.exitCode)}]`;
          const backendNotice = plan.backend === "powershell"
            ? "[laobos-shell: PowerShell compatibility fallback]"
            : "";
          return {
            text: [backendNotice, result.text, marker].filter(Boolean).join("\n") || "(no output)",
          };
        } catch (error) {
          if (error?.commandStarted) throw error;
          lastInfrastructureError = error;
        }
      }

      throw new Error(
        `No usable shell backend is available: ${String(lastInfrastructureError?.message || lastInfrastructureError || "unknown error")}`,
      );
    },
  });
}
