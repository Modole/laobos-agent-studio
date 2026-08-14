#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const studioRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function printHelp() {
  console.log(`
Usage: npm run dev:full -- [options]

Options:
  --project-root <path>  Bind Studio, Bridge, history and project resources to this project
  --engine-dir <path>    Agent Engine source directory (default: <project>/services/pi-agent-engine)
  --bridge-port <port>   Preferred Bridge port (default: PI_STUDIO_PORT or 31415)
  -h, --help             Show this help
`);
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (
      argument === "--project-root" ||
      argument === "--engine-dir" ||
      argument === "--bridge-port"
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      options[
        argument === "--project-root"
          ? "projectRoot"
          : argument === "--engine-dir"
            ? "engineDir"
            : "bridgePort"
      ] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--bridge-port must be an integer between 1 and 65535.");
  }
  return port;
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(start, host) {
  for (let port = start; port < Math.min(65_535, start + 50); port += 1) {
    if (await canListen(port, host)) return port;
  }
  throw new Error(`No available Bridge port found near ${start}.`);
}

async function readToken(agentDir) {
  if (process.env.PI_STUDIO_TOKEN) return process.env.PI_STUDIO_TOKEN;
  try {
    const token = (await readFile(path.join(agentDir, "pi-studio-token"), "utf8")).trim();
    if (token) return token;
  } catch {
    // The Bridge will create this file on first launch.
  }
  return randomBytes(24).toString("base64url");
}

async function runningBridge(host, port) {
  const url = `http://${host}:${port}`;
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    const health = await response.json();
    return response.ok && health?.ok === true && health?.authRequired === true
      ? { url, health }
      : undefined;
  } catch {
    return undefined;
  }
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const host = process.env.PI_STUDIO_HOST || "127.0.0.1";
const preferredPort = parsePort(options.bridgePort || process.env.PI_STUDIO_PORT || "31415");
const configuredProjectRoot =
  options.projectRoot || process.env.PI_STUDIO_PROJECT_ROOT;
const projectRoot = configuredProjectRoot
  ? path.resolve(configuredProjectRoot)
  : path.dirname(studioRoot);
const projectBound = Boolean(configuredProjectRoot);
const agentDir = path.resolve(
  process.env.PI_STUDIO_AGENT_DIR ||
    process.env.PI_CODING_AGENT_DIR ||
    (projectBound
      ? path.join(projectRoot, ".pi", "state", "agent")
      : path.join(os.homedir(), ".pi", "agent")),
);
const engineRoot = path.resolve(
  options.engineDir ||
    process.env.PI_STUDIO_ENGINE_ROOT ||
    (projectBound
      ? path.join(projectRoot, "services", "pi-agent-engine")
      : path.join(projectRoot, "pi-mono")),
);
const engineCommand =
  process.env.PI_STUDIO_PI_BIN ||
  path.join(engineRoot, process.platform === "win32" ? "pi-test.bat" : "pi-test.sh");

let bridgePort = preferredPort;
let reuseBridge = false;
const existingBridge = await runningBridge(host, preferredPort);
if (existingBridge) {
  const sameProject =
    !projectBound ||
    (path.resolve(existingBridge.health.projectRoot || "") === projectRoot &&
      path.resolve(existingBridge.health.agentDir || "") === agentDir);
  if (sameProject) {
    reuseBridge = true;
  } else if (options.bridgePort || process.env.PI_STUDIO_PORT) {
    throw new Error(
      `${existingBridge.url} is already serving a different project. Choose another --bridge-port.`,
    );
  } else {
    bridgePort = await findAvailablePort(preferredPort + 1, host);
  }
}

const bridgeUrl = `http://${host}:${bridgePort}`;
const bridgeToken = await readToken(agentDir);
const childEnvironment = {
  ...process.env,
  PI_STUDIO_HOST: host,
  PI_STUDIO_PORT: String(bridgePort),
  PI_STUDIO_PROJECT_ROOT: projectRoot,
  PI_STUDIO_AGENT_DIR: agentDir,
  PI_STUDIO_MODELS_PATH: projectBound
    ? path.join(projectRoot, ".pi", "models.json")
    : path.join(agentDir, "models.json"),
  PI_STUDIO_ENGINE_ROOT: engineRoot,
  PI_STUDIO_PI_BIN: engineCommand,
  PI_STUDIO_TOKEN: bridgeToken,
  PI_STUDIO_LOCAL_AUTO_CONNECT: "1",
  PI_STUDIO_ALLOW_SHUTDOWN: "1",
  PI_STUDIO_BRIDGE_URL: bridgeUrl,
  NEXT_PUBLIC_PI_STUDIO_BRIDGE_URL: bridgeUrl,
  NEXT_PUBLIC_PI_STUDIO_BRIDGE_TOKEN: bridgeToken,
  VITE_PI_STUDIO_BRIDGE_URL: bridgeUrl,
  VITE_PI_STUDIO_BRIDGE_TOKEN: bridgeToken,
};

console.log("");
console.log("  劳博士 full development workspace");
console.log(`  Project: ${projectRoot}`);
console.log(`  Agent:   ${agentDir}`);
console.log(`  Bridge:  ${bridgeUrl}${reuseBridge ? " (reused)" : ""}`);
console.log(`  Engine:  ${engineCommand}`);
console.log("");

const scripts = reuseBridge ? ["site:dev"] : ["pi:bridge", "site:dev"];
const children = scripts.map((script) =>
  spawn(npmCommand, ["run", script], {
    cwd: studioRoot,
    env: childEnvironment,
    stdio: "inherit",
  }),
);

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 200).unref();
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) shutdown(code || 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
