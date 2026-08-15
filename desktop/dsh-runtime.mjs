import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureNodePtySpawnHelper } from "../scripts/ensure-node-pty-helper.mjs";
import { ensureBundledPlugins } from "./local-plugins.mjs";

const READY_PATTERN = /dsh web:\s+(http:\/\/[^\s]+)/;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -\/]*[@-~]/g;

export function extractDshUrl(output) {
  return READY_PATTERN.exec(output)?.[1];
}

export function summarizeDshFailureOutput(output, maximumLength = 4_000) {
  const cleaned = String(output)
    .replace(ANSI_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!cleaned) return "";
  return cleaned.length <= maximumLength
    ? cleaned
    : `…${cleaned.slice(-maximumLength)}`;
}

export function fileImportSpecifier(filePath) {
  return pathToFileURL(filePath).href;
}

export function startDshRuntime({
  nodeExecutable,
  dshBin,
  patchFile,
  workspace,
  dshHome,
  electronRunAsNode = false,
  pluginMode = "link",
  platform = process.platform,
  startupTimeoutMs = 30_000,
}) {
  const studioRoot = resolve(dirname(patchFile), "..");
  ensureNodePtySpawnHelper(studioRoot);
  ensureBundledPlugins({ studioRoot, dshHome, mode: pluginMode });
  const asarBootstrap = resolve(studioRoot, "desktop", "dsh-asar-bootstrap.mjs");
  const asarBootstrapUrl = fileImportSpecifier(asarBootstrap);
  const platformPatchFile = platform === "win32"
    ? resolve(studioRoot, "config", "laobos.windows.cordis.patch.yml")
    : undefined;
  const arguments_ = [
    "--import",
    asarBootstrapUrl,
    "--expose-internals",
    dshBin,
    "--profile",
    "web",
    "--patch",
    patchFile,
    ...(platformPatchFile ? ["--patch", platformPatchFile] : []),
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
      const detail = summarizeDshFailureOutput(accumulatedOutput);
      reject(new Error(
        `DSH 本地运行时提前退出（code=${String(code)}, signal=${String(signal)}）。${
          detail ? `\n\n运行时输出：\n${detail}` : ""
        }`,
      ));
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
