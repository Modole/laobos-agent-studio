#!/usr/bin/env node

import { access, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDshHome, migratePiOnFirstRun } from "../migrations/auto-pi.mjs";
import { ensureNodePtySpawnHelper } from "./ensure-node-pty-helper.mjs";
import { bundledPluginMode, ensureBundledPlugins } from "../desktop/local-plugins.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
process.env.LAOBOS_STUDIO_ROOT ??= projectRoot;
const dshBin = join(projectRoot, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
const patchFile = join(projectRoot, "config", "laobos.cordis.patch.yml");
const platformPatchFile = process.platform === "win32"
  ? join(projectRoot, "config", "laobos.windows.cordis.patch.yml")
  : undefined;

function readWorkspace(arguments_) {
  const forwarded = [];
  let workspace = process.env.LAOBOS_WORKSPACE
    ? resolve(process.env.LAOBOS_WORKSPACE)
    : resolve(projectRoot, "..");

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (argument === "--workspace") {
      const value = arguments_[index + 1];
      if (!value) {
        throw new Error("--workspace 需要一个目录路径");
      }
      workspace = resolve(value);
      index += 1;
      continue;
    }

    if (argument.startsWith("--workspace=")) {
      workspace = resolve(argument.slice("--workspace=".length));
      continue;
    }

    forwarded.push(argument);
  }

  return { forwarded, workspace };
}

async function main() {
  const { forwarded, workspace } = readWorkspace(process.argv.slice(2));

  await access(dshBin).catch(() => {
    throw new Error("尚未安装 DSH 依赖，请先运行 npm install");
  });
  ensureNodePtySpawnHelper(projectRoot);

  const workspaceStat = await stat(workspace).catch(() => undefined);
  if (!workspaceStat?.isDirectory()) {
    throw new Error(`工作区不存在或不是目录：${workspace}`);
  }

  const dshHome = defaultDshHome();
  try {
    await migratePiOnFirstRun({ dshHome });
  } catch (error) {
    console.warn(
      `Pi 数据自动迁移失败，DSH 将继续启动；可稍后运行 npm run migrate:pi -- --apply。\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
  ensureBundledPlugins({
    studioRoot: projectRoot,
    dshHome,
    mode: bundledPluginMode(),
  });
  const dshArguments = [
    "--profile",
    "web",
    "--patch",
    patchFile,
    ...(platformPatchFile ? ["--patch", platformPatchFile] : []),
    ...forwarded,
  ];
  const child = spawn(
    process.execPath,
    ["--expose-internals", dshBin, ...dshArguments],
    {
      cwd: workspace,
      env: {
        ...process.env,
        LAOBOS_SHELL_STATE_PATH: join(dshHome, "data", "laobos-shell-state.json"),
        DSH_HOME: dshHome,
        DSH_TELEMETRY_DISABLED:
          process.env.DSH_TELEMETRY_DISABLED || "1",
      },
      stdio: "inherit",
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);

  child.once("error", (error) => {
    console.error(`无法启动 DSH：${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code, signal) => {
    process.removeListener("SIGINT", forwardSignal);
    process.removeListener("SIGTERM", forwardSignal);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
