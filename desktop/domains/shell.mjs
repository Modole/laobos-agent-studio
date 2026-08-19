import { execFile } from "node:child_process";
import { access, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const READY_MARKER = "LAOBOS_WSL_READY";
const ALLOWED_DISTRIBUTIONS = new Set(["Ubuntu", "Ubuntu-24.04", "Debian"]);

export function laobosShellStatePath(dshHome) {
  return path.join(dshHome, "data", "laobos-shell-state.json");
}

export function parseWslDistributions(output) {
  return decodeWindowsNativeOutput(output)
    .replaceAll("\0", "")
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/^\*\s*/u, ""))
    .filter((line) => line
      && line.length <= 128
      && !/(?:未安装|没有安装|no installed|usage:|用法：|适用于 Linux)/iu.test(line));
}

export function decodeWindowsNativeOutput(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length === 0) return "";
    const hasUtf16Bom = value[0] === 0xff && value[1] === 0xfe;
    const utf8 = value.toString("utf8");
    const utf16 = value.toString("utf16le").replace(/^\uFEFF/u, "");
    let zeroes = 0;
    for (let index = 1; index < Math.min(value.length, 256); index += 2) {
      if (value[index] === 0) zeroes += 1;
    }
    const sampledPairs = Math.floor(Math.min(value.length, 256) / 2);
    const utf8LooksMisdecoded = utf8.includes("\0")
      || (utf8.match(/\uFFFD/gu)?.length || 0) > Math.max(1, utf8.length * 0.03);
    if (hasUtf16Bom
      || (sampledPairs > 2 && zeroes / sampledPairs > 0.35)
      || (value.length % 2 === 0 && utf8LooksMisdecoded && looksLikeText(utf16))) {
      return utf16;
    }
    return utf8.replace(/^\uFEFF/u, "");
  }
  return String(value || "").replace(/^\uFEFF/u, "");
}

function looksLikeText(value) {
  if (!value) return true;
  let controls = 0;
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code < 32 && ![9, 10, 13].includes(code)) controls += 1;
  }
  return controls / value.length < 0.02;
}

export function preferredWslDistribution(distributions, preferred) {
  if (preferred && distributions.includes(preferred)) return preferred;
  return distributions.find(
    (name) => !/^docker-desktop(?:-data)?$/iu.test(name),
  );
}

export function runFile(executable, args, options = {}) {
  return new Promise((resolve) => {
    execFile(executable, args, {
      encoding: options.outputEncoding === "windows-native" ? null : "utf8",
      windowsHide: true,
      timeout: options.timeoutMs ?? 10_000,
      maxBuffer: options.maxBuffer ?? 1024 * 1024,
    }, (error, stdout = "", stderr = "") => {
      resolve({
        code: error ? Number.isInteger(error.code) ? error.code : -1 : 0,
        signal: error?.signal || null,
        timedOut: error?.killed === true,
        stdout: options.outputEncoding === "windows-native"
          ? decodeWindowsNativeOutput(stdout)
          : String(stdout),
        stderr: options.outputEncoding === "windows-native"
          ? decodeWindowsNativeOutput(stderr) || String(error?.message || "")
          : String(stderr || error?.message || ""),
      });
    });
  });
}

async function firstAccessible(candidates, canAccess) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await canAccess(candidate);
      return candidate;
    } catch {
      // Continue to the next well-known installation location.
    }
  }
  return undefined;
}

function diagnosticText(result, maximumLength = 2_000) {
  const value = `${result?.stdout || ""}\n${result?.stderr || ""}`
    .replaceAll("\0", "")
    .trim();
  return value.slice(-maximumLength);
}

export async function detectShellEnvironment({
  platform = process.platform,
  env = process.env,
  execute = runFile,
  canAccess = access,
  preferredDistribution,
  now = () => new Date().toISOString(),
} = {}) {
  if (platform !== "win32") {
    return {
      version: 1,
      platform,
      phase: "ready",
      status: "ready",
      selectedBackend: "native-bash",
      message: "正在使用系统 Bash。",
      progress: { kind: "determinate", percent: 100 },
      updatedAt: now(),
    };
  }

  const systemRoot = env.SystemRoot || env.SYSTEMROOT || "C:\\Windows";
  const wslExecutable = await firstAccessible([
    path.join(systemRoot, "System32", "wsl.exe"),
  ], canAccess);
  let listResult;
  let statusResult;
  let distributions = [];
  let distribution;
  let wslReady = false;
  let healthResult;

  if (wslExecutable) {
    [statusResult, listResult] = await Promise.all([
      execute(wslExecutable, ["--status"], {
        timeoutMs: 10_000,
        outputEncoding: "windows-native",
      }),
      execute(wslExecutable, ["--list", "--quiet"], {
        timeoutMs: 10_000,
        outputEncoding: "windows-native",
      }),
    ]);
    if (listResult.code === 0) {
      distributions = parseWslDistributions(listResult.stdout);
      distribution = preferredWslDistribution(
        distributions,
        preferredDistribution,
      );
    }
    if (distribution) {
      healthResult = await execute(wslExecutable, [
        "-d",
        distribution,
        "--exec",
        "bash",
        "-lc",
        `printf '${READY_MARKER}:%s' "$(id -u)"`,
      ], { timeoutMs: 30_000, outputEncoding: "windows-native" });
      wslReady = healthResult.code === 0
        && healthResult.stdout.includes(READY_MARKER);
    }
  }

  const gitBashExecutable = await firstAccessible([
    env.ProgramFiles && path.join(env.ProgramFiles, "Git", "bin", "bash.exe"),
    env["ProgramFiles(x86)"] && path.join(env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ], canAccess);
  const powershellExecutable = await firstAccessible([
    path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
  ], canAccess) || "powershell.exe";
  const defaultUserIsRoot = wslReady
    && healthResult.stdout.includes(`${READY_MARKER}:0`);
  const restartRequired = !distribution && wslRestartRequired(statusResult, listResult);
  const phase = wslReady
    ? defaultUserIsRoot ? "user-setup-required" : "ready"
    : distribution
      ? "initialization-required"
      : restartRequired
        ? "restart-required"
        : wslExecutable
          ? "distribution-required"
          : "component-required";
  const selectedBackend = wslReady
    ? "wsl"
    : gitBashExecutable
      ? "git-bash"
      : "powershell";
  const status = wslReady && !defaultUserIsRoot ? "ready" : "attention";
  const message = wslReady
    ? defaultUserIsRoot
      ? `WSL ${distribution} 已可用，但默认登录用户仍是 root；建议完成普通 Linux 用户设置。`
      : `WSL ${distribution} 已就绪，性能模式将使用 Linux Bash。`
    : distribution
      ? healthResult?.timedOut
        ? `${distribution} 首次初始化超时，可能有初始化窗口或 OOBE 正在等待。`
        : `${distribution} 已安装，但 Bash 尚未通过健康检查。`
    : restartRequired
      ? "WSL 组件变更需要重启 Windows 后才能生效。"
    : selectedBackend === "git-bash"
      ? "WSL 尚未就绪，当前使用 Git Bash 兼容后端。"
      : "WSL 尚未就绪，当前使用 PowerShell 兼容模式。";

  return {
    version: 1,
    platform,
    phase,
    status,
    selectedBackend,
    message,
    progress: { kind: "determinate", percent: wslReady ? 100 : 0 },
    installAvailable: true,
    requiresRestart: restartRequired,
    wsl: {
      executable: wslExecutable,
      available: Boolean(wslExecutable),
      componentEnabled: statusResult?.code === 0 || listResult?.code === 0,
      installed: Boolean(distribution),
      ready: wslReady,
      defaultUserIsRoot,
      initializationBlocked: Boolean(distribution && healthResult?.timedOut),
      distributions,
      distribution,
    },
    gitBash: { executable: gitBashExecutable },
    powershell: { executable: powershellExecutable },
    diagnostics: {
      list: diagnosticText(listResult),
      status: diagnosticText(statusResult),
      health: diagnosticText(healthResult),
    },
    updatedAt: now(),
  };
}

function wslRestartRequired(...results) {
  const text = results.map((result) => diagnosticText(result)).join("\n");
  return [
    /restart|required.*reboot|reboot.*required/iu,
    /重启|重新启动/u,
    /virtualmachineplatform|virtual machine platform/iu,
    /虚拟机平台|未启用虚拟化/u,
  ].some((pattern) => pattern.test(text));
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function runElevatedWslInstall({
  state,
  distribution = "Ubuntu-24.04",
  execute = runFile,
}) {
  if (!ALLOWED_DISTRIBUTIONS.has(distribution)) {
    throw new Error("不支持的 WSL 发行版。 ");
  }
  const powershell = state.powershell?.executable || "powershell.exe";
  const wsl = state.wsl?.executable
    || path.join(process.env.SystemRoot || "C:\\Windows", "System32", "wsl.exe");
  const script = [
    `$process = Start-Process -FilePath ${quotePowerShellLiteral(wsl)}`,
    `-ArgumentList @('--install','--web-download','-d',${quotePowerShellLiteral(distribution)},'--no-launch')`,
    "-Verb RunAs -Wait -PassThru;",
    "exit $process.ExitCode",
  ].join(" ");
  return execute(powershell, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ], { timeoutMs: 30 * 60_000, maxBuffer: 4 * 1024 * 1024 });
}

export function buildShellRepairPrompt(state) {
  const diagnostics = JSON.stringify({
    platform: state.platform,
    phase: state.phase,
    status: state.status,
    selectedBackend: state.selectedBackend,
    message: state.message,
    requiresRestart: state.requiresRestart,
    wsl: state.wsl,
    gitBash: state.gitBash,
    diagnostics: state.diagnostics,
    lastError: state.lastError,
  }, null, 2);
  return `请帮助我诊断并修复劳博士的 WSL/Shell 环境。\n\n当前脱敏诊断数据：\n\n\`\`\`json\n${diagnostics}\n\`\`\`\n\n请先执行只读诊断，判断是 WSL 组件、Linux 发行版、虚拟化、待重启、首次初始化/OOBE、网络还是企业策略问题。给出结论和最小修复步骤。Windows 中文环境的 wsl.exe 输出可能是 UTF-16LE；乱码时应采集原始字节并显式解码，不要据乱码下结论。若功能状态与运行状态矛盾，请比较 DISM/CBS 功能变更时间与本次开机时间。若 wsl --install 已下载发行版但一直不退出，先查残留进程、发行版注册状态和 HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss 下的 RunOOBE；只有确认是 OOBE 门闩且获得用户许可后，才可提出修改注册表并配合 wsl --shutdown 的可逆方案。复杂 Linux 命令不要经 cmd.exe 二次转义。若默认 uid 为 0，还需引导创建普通 Linux 用户并设置为默认用户。任何需要管理员权限、启停 Windows 功能、安装软件、重启、结束进程或修改注册表/系统策略的动作，都必须先解释影响并征得我的明确确认；不要关闭安全软件，不要执行来源不明的脚本，也不要重复执行可能已经部分成功的安装命令。若 pwsh 等最小命令出现 0xC0000142，先对比沙箱内外启动，区分注入层兼容问题与系统损坏。修复后请使用 wsl.exe --status、wsl.exe --list --verbose 和一个无副作用的 Bash 命令验证。`;
}

export class LaobosShellManager {
  constructor({
    statePath,
    platform = process.platform,
    env = process.env,
    execute = runFile,
    canAccess = access,
    elevatedInstall = runElevatedWslInstall,
    logger = console,
  }) {
    this.statePath = statePath;
    this.platform = platform;
    this.env = env;
    this.execute = execute;
    this.canAccess = canAccess;
    this.elevatedInstall = elevatedInstall;
    this.logger = logger;
    this.listeners = new Set();
    this.state = {
      version: 1,
      platform,
      phase: "detecting",
      status: "detecting",
      selectedBackend: platform === "win32" ? "powershell" : "native-bash",
      message: "正在检测 Shell 环境…",
      progress: { kind: "indeterminate" },
      updatedAt: new Date().toISOString(),
    };
  }

  snapshot() {
    return structuredClone(this.state);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      this.update({
        ...this.state,
        phase: "detecting",
        status: "detecting",
        message: "正在检测 Shell 环境…",
        progress: { kind: "indeterminate" },
      });
      const detected = await detectShellEnvironment({
        platform: this.platform,
        env: this.env,
        execute: this.execute,
        canAccess: this.canAccess,
        preferredDistribution: this.state.wsl?.distribution,
      });
      await this.update(detected, true);
      return this.snapshot();
    })().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  async install(distribution = "Ubuntu-24.04") {
    if (this.platform !== "win32") throw new Error("当前系统不需要安装 WSL。 ");
    if (this.installing) return this.installing;
    if (!ALLOWED_DISTRIBUTIONS.has(distribution)) throw new Error("不支持的 WSL 发行版。 ");
    this.installing = (async () => {
      await this.update({
        ...this.state,
        phase: "installing",
        status: "installing",
        message: "等待 Windows 管理员授权并下载 WSL…",
        progress: { kind: "indeterminate", stage: 2, stages: 4 },
        lastError: undefined,
      }, true);
      const result = await this.elevatedInstall({
        state: this.state,
        distribution,
        execute: this.execute,
      });
      if (result.code !== 0) {
        const message = diagnosticText(result) || "用户取消授权或 WSL 安装程序返回失败。";
        await this.update({
          ...this.state,
          phase: "error",
          status: "error",
          message: "WSL 安装失败，可生成诊断对话进行修复。",
          progress: { kind: "determinate", percent: 0 },
          lastError: message,
        }, true);
        return this.snapshot();
      }
      await this.update({
        ...this.state,
        phase: "verifying",
        status: "installing",
        message: "安装程序已完成，正在验证 WSL…",
        progress: { kind: "determinate", percent: 85 },
      }, true);
      const detected = await detectShellEnvironment({
        platform: this.platform,
        env: this.env,
        execute: this.execute,
        canAccess: this.canAccess,
        preferredDistribution: distribution,
      });
      if (!detected.wsl?.ready) detected.progress = { kind: "determinate", percent: 90 };
      await this.update(detected, true);
      return this.snapshot();
    })().finally(() => {
      this.installing = undefined;
    });
    return this.installing;
  }

  async initialize() {
    if (this.platform !== "win32") throw new Error("当前系统不需要初始化 WSL。 ");
    const executable = this.state.wsl?.executable;
    const distribution = this.state.wsl?.distribution;
    if (!executable || !distribution) throw new Error("尚未检测到可初始化的 Linux 发行版。 ");
    const powershell = this.state.powershell?.executable || "powershell.exe";
    const script = [
      `Start-Process -FilePath ${quotePowerShellLiteral(executable)}`,
      `-ArgumentList @('-d',${quotePowerShellLiteral(distribution)})`,
    ].join(" ");
    const result = await this.execute(powershell, [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ], { timeoutMs: 15_000 });
    if (result.code !== 0) throw new Error(diagnosticText(result) || "无法打开 WSL 初始化窗口。 ");
    await this.update({
      ...this.state,
      phase: "initializing",
      status: "attention",
      message: `请在新窗口中完成 ${distribution} 首次初始化，完成后返回并重新检测。`,
      progress: { kind: "indeterminate", stage: 3, stages: 4 },
    }, true);
    return this.snapshot();
  }

  async update(next, persist = false) {
    this.state = { ...next, updatedAt: new Date().toISOString() };
    for (const listener of this.listeners) listener(this.snapshot());
    if (persist) await this.persist();
    return this.snapshot();
  }

  async persist() {
    try {
      await mkdir(path.dirname(this.statePath), { recursive: true, mode: 0o700 });
      const temporary = `${this.statePath}.${process.pid}.tmp`;
      await writeFile(temporary, `${JSON.stringify(this.state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporary, this.statePath);
    } catch (error) {
      this.logger.warn?.("劳博士 Shell 状态写入失败：", error);
    }
  }
}

export function registerShellIpc({
  ipcMain,
  authorize,
  dshHome,
  getMainWindow,
  shellManager,
}) {
  const manager = shellManager || new LaobosShellManager({
    statePath: laobosShellStatePath(dshHome),
  });
  const sendState = (state) => {
    const window = getMainWindow();
    if (!window || window.isDestroyed()) return;
    window.webContents.send("laobos:shell:state", state);
  };
  const unsubscribe = manager.subscribe(sendState);

  ipcMain.handle("laobos:shell:status", async (event) => {
    authorize(event);
    return manager.snapshot();
  });
  ipcMain.handle("laobos:shell:refresh", async (event) => {
    authorize(event);
    return manager.refresh();
  });
  ipcMain.handle("laobos:shell:install-wsl", async (event, input = {}) => {
    authorize(event);
    return manager.install(input.distribution || "Ubuntu-24.04");
  });
  ipcMain.handle("laobos:shell:initialize-wsl", async (event) => {
    authorize(event);
    return manager.initialize();
  });
  ipcMain.handle("laobos:shell:repair-prompt", (event) => {
    authorize(event);
    return { prompt: buildShellRepairPrompt(manager.snapshot()) };
  });

  void manager.refresh().catch(async (error) => {
    await manager.update({
      ...manager.state,
      phase: "error",
      status: "error",
      message: "Shell 环境检测失败。",
      lastError: error instanceof Error ? error.message : String(error),
    }, true);
  });

  return () => {
    unsubscribe();
    for (const channel of [
      "laobos:shell:status",
      "laobos:shell:refresh",
      "laobos:shell:install-wsl",
      "laobos:shell:initialize-wsl",
      "laobos:shell:repair-prompt",
    ]) ipcMain.removeHandler(channel);
  };
}
