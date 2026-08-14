#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const electronCommand = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);
const rendererHost = "127.0.0.1";
const preferredRendererPort = parsePort(
  process.env.PI_STUDIO_RENDERER_PORT || "4317",
);
const rendererPort = await findAvailablePort(preferredRendererPort, rendererHost);
const rendererUrl = `http://${rendererHost}:${rendererPort}`;
const children = [];
let shuttingDown = false;

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PI_STUDIO_RENDERER_PORT 必须是 1–65535 的整数。");
  }
  return port;
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

async function findAvailablePort(start, host) {
  for (let port = start; port < Math.min(65_536, start + 50); port += 1) {
    if (await canListen(port, host)) return port;
  }
  throw new Error(`无法在 ${start} 附近找到可用的桌面界面端口。`);
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    detached: process.platform !== "win32",
    ...options,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
  return child;
}

function stop(child) {
  if (child.killed) return;
  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForRenderer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(rendererUrl, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      // Renderer is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("桌面界面启动超时。");
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stop(child);
  setTimeout(() => process.exit(code), 250).unref();
}

if (rendererPort !== preferredRendererPort) {
  console.log(
    `桌面界面端口 ${preferredRendererPort} 已被占用，自动改用 ${rendererPort}。`,
  );
}

const renderer = start(npmCommand, [
  "run",
  "desktop:renderer:dev",
  "--",
  "--host",
  rendererHost,
  "--port",
  String(rendererPort),
  "--strictPort",
]);
renderer.on("exit", (code, signal) => {
  if (!shuttingDown) shutdown(code || (signal ? 1 : 0));
});

try {
  await waitForRenderer();
  const electron = start(electronCommand, ["."], {
    env: {
      ...process.env,
      PI_STUDIO_RENDERER_URL: rendererUrl,
    },
  });
  electron.on("exit", (code) => shutdown(code || 0));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
