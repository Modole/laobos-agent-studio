import { spawn } from "node:child_process";
import { lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ensureNodePtySpawnHelper } from "../scripts/ensure-node-pty-helper.mjs";

const READY_PATTERN = /dsh web:\s+(http:\/\/[^\s]+)/;

export function extractDshUrl(output) {
  return READY_PATTERN.exec(output)?.[1];
}

export function startDshRuntime({
  nodeExecutable,
  dshBin,
  patchFile,
  workspace,
  dshHome,
  electronRunAsNode = false,
  startupTimeoutMs = 30_000,
}) {
  const studioRoot = resolve(dirname(patchFile), "..");
  ensureNodePtySpawnHelper(studioRoot);
  for (const pluginName of ["laobos-system-tools", "laobos-conversation-tools", "laobos-file-attachments", "laobos-workspace-tools", "laobos-terminal-ui", "laobos-browserops", "laobos-ssh", "laobos-app-manager", "laobos-market"]) {
    const pluginTarget = resolve(studioRoot, "packages", pluginName);
    const pluginLink = resolve(dshHome, "node_modules", "@laobos", pluginName.replace(/^laobos-/, "dsh-"));
    mkdirSync(dirname(pluginLink), { recursive: true, mode: 0o700 });
    let pluginInfo;
    try { pluginInfo = lstatSync(pluginLink); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    if (pluginInfo?.isSymbolicLink()) {
      const current = resolve(dirname(pluginLink), readlinkSync(pluginLink));
      if (current !== pluginTarget) unlinkSync(pluginLink);
      else pluginInfo = undefined;
    } else if (pluginInfo) {
      throw new Error(`DSH 本地插件位置已被其他文件占用：${pluginLink}`);
    }
    if (pluginInfo !== undefined || !lstatExists(pluginLink)) {
      symlinkSync(pluginTarget, pluginLink, "dir");
    }
  }
  const arguments_ = [
    "--expose-internals",
    dshBin,
    "--profile",
    "web",
    "--patch",
    patchFile,
    "--host",
    "127.0.0.1",
    "--port",
    "0",
  ];
  const child = spawn(nodeExecutable, arguments_, {
    cwd: workspace,
    env: {
      ...process.env,
      LAOBOS_STUDIO_ROOT: studioRoot,
      DSH_HOME: dshHome,
      DSH_TELEMETRY_DISABLED:
        process.env.DSH_TELEMETRY_DISABLED || "1",
      ...(electronRunAsNode ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let settled = false;
  let candidateUrl;
  let accumulatedOutput = "";

  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("DSH 本地运行时启动超时。"));
    }, startupTimeoutMs);

    async function confirmReady(url) {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(2_000),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          await new Promise((continueAfter) => setTimeout(continueAfter, 150));
          if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error("进程已经退出");
          }
        }

        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(url);
      } catch (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.kill("SIGTERM");
        reject(
          new Error(
            `DSH 本地运行时健康检查失败：${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }

    function acceptOutput(chunk, destination) {
      const text = String(chunk);
      destination.write(`[dsh] ${text}`);
      accumulatedOutput = `${accumulatedOutput}${text}`.slice(-16_384);
      const url = extractDshUrl(accumulatedOutput);
      if (!url || settled || candidateUrl) return;
      candidateUrl = url;
      void confirmReady(url);
    }

    child.stdout.on("data", (chunk) => acceptOutput(chunk, process.stdout));
    child.stderr.on("data", (chunk) => acceptOutput(chunk, process.stderr));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`无法启动 DSH 本地运行时：${error.message}`));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `DSH 本地运行时提前退出（code=${String(code)}, signal=${String(signal)}）。`,
        ),
      );
    });
  });

  async function close() {
    if (child.exitCode !== null || child.signalCode !== null) return;

    await new Promise((resolve) => {
      const forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, 5_000);
      child.once("exit", () => {
        clearTimeout(forceTimer);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }

  return { child, close, ready };
}

function lstatExists(filePath) {
  try { lstatSync(filePath); return true; }
  catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}
