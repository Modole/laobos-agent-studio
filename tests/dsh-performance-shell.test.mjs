import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildShellRepairPrompt,
  detectShellEnvironment,
  LaobosShellManager,
  parseWslDistributions,
  preferredWslDistribution,
  runElevatedWslInstall,
} from "../desktop/domains/shell.mjs";
import { startDshRuntime } from "../desktop/dsh-runtime.mjs";
import { installPerformancePresetRoot } from "../packages/laobos-performance/lib/index.js";
import {
  apply as applyShellRouter,
  readShellRouterState,
  shellPlans,
} from "../packages/laobos-performance/presets/performance/custom-bash.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("performance preset root is system-owned and precedes user presets", () => {
  const agentPresets = {
    resolvedRoots: [
      { path: "/official", trust: "system" },
      { path: "/user", trust: "user" },
    ],
  };
  const dispose = installPerformancePresetRoot(agentPresets, "/performance");
  assert.deepEqual(agentPresets.resolvedRoots, [
    { path: "/official", trust: "system" },
    { path: "/performance", trust: "system" },
    { path: "/user", trust: "user" },
  ]);
  assert.doesNotThrow(() => installPerformancePresetRoot(agentPresets, "/performance"));
  assert.equal(agentPresets.resolvedRoots.length, 3);
  dispose();
  assert.deepEqual(agentPresets.resolvedRoots, [
    { path: "/official", trust: "system" },
    { path: "/user", trust: "user" },
  ]);
});

test("performance preset preserves the Minimal anchor and uses the shell router on Windows", async () => {
  const presetRoot = path.join(
    projectRoot,
    "packages",
    "laobos-performance",
    "presets",
    "performance",
  );
  const [metadata, composition] = await Promise.all([
    readFile(path.join(presetRoot, "preset.yml"), "utf8"),
    readFile(path.join(presetRoot, "agent.cordis.yml"), "utf8"),
  ]);
  assert.match(metadata, /name:\s*性能模式（实验）/u);
  assert.match(composition, /text: You are a helpful software engineer assistant\./u);
  assert.match(composition, /bootstrapTools:\s*\[bash, str_replace_editor\]/u);
  assert.match(composition, /statePath: !!js process\.env\.LAOBOS_SHELL_STATE_PATH/u);
  assert.match(composition, /name: '@deepseek-ai\/dsh-tool-bash-persistent'/u);
});

test("WSL distribution parsing ignores encoding residue and Docker helper distros", () => {
  const distributions = parseWslDistributions("\uFEFF* Ubuntu\0\r\nDocker-Desktop\0\r\nDebian\r\n");
  assert.deepEqual(distributions, ["Ubuntu", "Docker-Desktop", "Debian"]);
  assert.equal(preferredWslDistribution(distributions), "Ubuntu");
  assert.equal(preferredWslDistribution(distributions, "Debian"), "Debian");
  assert.equal(preferredWslDistribution(["docker-desktop"]), undefined);
});

test("Windows detection selects healthy WSL before Git Bash and PowerShell", async () => {
  const env = {
    SystemRoot: "C:\\Windows",
    ProgramFiles: "C:\\Program Files",
  };
  const accessible = new Set([
    path.join(env.SystemRoot, "System32", "wsl.exe"),
    path.join(env.ProgramFiles, "Git", "bin", "bash.exe"),
    path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
  ]);
  const calls = [];
  const state = await detectShellEnvironment({
    platform: "win32",
    env,
    canAccess: async (candidate) => {
      if (!accessible.has(candidate)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    execute: async (executable, args) => {
      calls.push([executable, args]);
      if (args.includes("--list")) return { code: 0, stdout: "Ubuntu\r\n", stderr: "" };
      return { code: 0, stdout: "LAOBOS_WSL_READY", stderr: "" };
    },
  });
  assert.equal(state.selectedBackend, "wsl");
  assert.equal(state.wsl.distribution, "Ubuntu");
  assert.equal(state.wsl.ready, true);
  assert.equal(calls.length, 2);
});

test("shell router keeps Bash fallbacks ahead of PowerShell", () => {
  const state = {
    wsl: { ready: true, executable: "wsl.exe", distribution: "Ubuntu" },
    gitBash: { executable: "git-bash.exe" },
    powershell: { executable: "powershell.exe" },
  };
  assert.deepEqual(
    shellPlans(state, "win32").map((plan) => [plan.backend, plan.persistent]),
    [["wsl", true], ["git-bash", true], ["powershell", false]],
  );
  assert.equal(shellPlans({}, "win32")[0].backend, "powershell");
});

test("WSL installation uses a fixed elevated command boundary", async () => {
  let invocation;
  const result = await runElevatedWslInstall({
    state: {
      powershell: { executable: "powershell.exe" },
      wsl: { executable: "wsl.exe" },
    },
    execute: async (...args) => {
      invocation = args;
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  assert.equal(result.code, 0);
  assert.equal(invocation[0], "powershell.exe");
  assert.match(invocation[1].at(-1), /wsl\.exe.*--install.*--web-download.*Ubuntu.*-PassThru; exit/u);
  await assert.rejects(
    runElevatedWslInstall({ state: {}, distribution: "untrusted" }),
    /不支持的 WSL 发行版/u,
  );
});

test("Windows Bash router preserves shell state across tool calls", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-persistent-shell-"));
  const statePath = path.join(temporary, "state.json");
  await writeFile(statePath, JSON.stringify({
    version: 1,
    gitBash: { executable: "/bin/bash" },
    powershell: { executable: "/bin/false" },
  }));
  let registered;
  const cleanups = [];
  const subprocess = {
    resolveExecutable: async (executable) => executable,
    spawn(spec) {
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const done = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
      });
      return {
        stdin: child.stdin,
        stdout: child.stdout,
        stderr: child.stderr,
        done,
        terminate: async () => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
          await done.catch(() => {});
        },
      };
    },
  };
  const ctx = {
    subprocess,
    tools: { register(tool) { registered = tool; } },
  };
  applyShellRouter(ctx, {
    statePath,
    platform: "win32",
    timeoutMs: 5_000,
  });
  const agent = {
    session: { header: { cwd: temporary } },
    ctx: { effect(factory) { cleanups.push(factory()); } },
  };
  try {
    const first = await registered.execute({ command: "export LAOBOS_ROUTER_STATE=kept" }, { agent });
    assert.doesNotMatch(first.text, /exit code/u);
    const second = await registered.execute({ command: "printf '%s' \"$LAOBOS_ROUTER_STATE\"" }, { agent });
    assert.match(second.text, /kept/u);
  } finally {
    for (const cleanup of cleanups) await cleanup();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("shell manager persists the detected route and exposes safe repair context", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-shell-manager-"));
  const statePath = path.join(temporary, "state.json");
  const env = { SystemRoot: "C:\\Windows", ProgramFiles: "C:\\Program Files" };
  const wsl = path.join(env.SystemRoot, "System32", "wsl.exe");
  const powershell = path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  try {
    const manager = new LaobosShellManager({
      statePath,
      platform: "win32",
      env,
      canAccess: async (candidate) => {
        if (![wsl, powershell].includes(candidate)) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
      execute: async (_executable, args) => args.includes("--list")
        ? { code: 0, stdout: "Ubuntu\r\n", stderr: "" }
        : { code: 0, stdout: "LAOBOS_WSL_READY", stderr: "" },
    });
    const state = await manager.refresh();
    assert.equal(state.selectedBackend, "wsl");
    assert.equal((await readShellRouterState(statePath)).wsl.ready, true);
    const prompt = buildShellRepairPrompt(state);
    assert.match(prompt, /先执行只读诊断/u);
    assert.match(prompt, /必须先解释影响并征得我的明确确认/u);
    assert.doesNotMatch(prompt, /process\.env/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("shell manager persists installation failures for conversational repair", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-shell-install-failure-"));
  const statePath = path.join(temporary, "state.json");
  try {
    const manager = new LaobosShellManager({
      statePath,
      platform: "win32",
      elevatedInstall: async () => ({ code: 1, stdout: "", stderr: "Access denied" }),
    });
    const state = await manager.install();
    assert.equal(state.phase, "error");
    assert.match(state.lastError, /Access denied/u);
    const persisted = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(persisted.status, "error");
    assert.match(buildShellRepairPrompt(persisted), /Access denied/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("desktop composition bundles the shell manager and its sandboxed client bridge", async () => {
  const [config, localPlugins, preload, registrar, client, buildScript] = await Promise.all([
    readFile(path.join(projectRoot, "config", "laobos.cordis.patch.yml"), "utf8"),
    readFile(path.join(projectRoot, "desktop", "local-plugins.mjs"), "utf8"),
    readFile(path.join(projectRoot, "desktop", "preload.cjs"), "utf8"),
    readFile(path.join(projectRoot, "desktop", "register-desktop-domains.mjs"), "utf8"),
    readFile(path.join(projectRoot, "packages", "laobos-shell", "lib", "client.js"), "utf8"),
    readFile(path.join(projectRoot, "scripts", "build-desktop-plugins.mjs"), "utf8"),
  ]);
  assert.match(config, /@laobos\/dsh-performance/u);
  assert.match(config, /@laobos\/dsh-shell/u);
  assert.match(localPlugins, /"laobos-performance"/u);
  assert.match(localPlugins, /"laobos-shell"/u);
  assert.match(preload, /shellManager: true/u);
  assert.match(preload, /laobos:shell:install-wsl/u);
  assert.match(registrar, /registerShellIpc/u);
  assert.match(client, /Shell 与 WSL/u);
  assert.match(client, /发送到新的标准模式对话/u);
  assert.match(buildScript, /laobos-shell\/src\/client\.jsx/u);
});

test("DSH lists performance as a system preset and can compose a session from it", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "laobos-performance-runtime-"));
  const workspace = path.join(temporary, "workspace");
  await mkdir(workspace);
  const runtime = startDshRuntime({
    nodeExecutable: process.execPath,
    dshBin: path.join(projectRoot, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    patchFile: path.join(projectRoot, "config", "laobos.cordis.patch.yml"),
    workspace,
    dshHome: path.join(temporary, "home"),
  });
  try {
    const url = await runtime.ready;
    const call = async (method, payload) => {
      const rpcId = randomUUID();
      const response = await fetch(`${url}/api/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "client-request", rpcId, method, payload }),
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(response.status, 200);
      const envelope = await response.json();
      assert.equal(envelope.result.ok, true, envelope.result.error?.message);
      return envelope.result.value;
    };
    const roster = await call("agentPreset.list", {});
    const performance = roster.presets.find((preset) => preset.id === "performance");
    assert.equal(performance?.trust, "system");
    assert.equal(performance?.name, "性能模式（实验）");
    const created = await call("session.create", {
      cwd: workspace,
      agentPreset: "performance",
    });
    assert.equal(created.agentPreset, "performance");
  } finally {
    await runtime.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
