import * as McpClient from "@deepseek-ai/dsh-mcp-client";
import { SystemToolsError } from "./store.js";

const MASK = "••••••";

function fail(code, message, status = 400) {
  throw new SystemToolsError(code, message, status);
}

function stringMap(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("MCP_CONFIG_INVALID", `${label} 必须是 JSON 对象。`);
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      fail("MCP_CONFIG_INVALID", `${label} 的值必须是字符串。`);
    }
    result[String(key)] = item;
  }
  return result;
}

function reconnectPolicy(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled !== false,
    initialDelayMs: Number(source.initialDelayMs) || 500,
    maxDelayMs: Number(source.maxDelayMs) || 30_000,
    maxAttempts: Number(source.maxAttempts) || 10,
  };
}

function normalizeConfig(serverName, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("MCP_CONFIG_INVALID", "MCP 配置必须是 JSON 对象。");
  }
  const transport = input.transport;
  const shared = {
    serverName,
    toolCallTimeoutMs: Number(input.toolCallTimeoutMs) || 60_000,
    failOnStartupError: input.failOnStartupError === true,
    reconnect: reconnectPolicy(input.reconnect),
  };

  if (transport === "stdio") {
    const command = String(input.command || "").trim();
    if (!command) fail("MCP_CONFIG_INVALID", "stdio MCP 必须填写 command。");
    const args = input.args === undefined ? [] : input.args;
    if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
      fail("MCP_CONFIG_INVALID", "stdio MCP 的 args 必须是字符串数组。");
    }
    return {
      ...shared,
      transport,
      command,
      args,
      env: stringMap(input.env, "env"),
      cwd: String(input.cwd || ""),
    };
  }

  if (transport === "streamable-http") {
    const url = String(input.url || "").trim();
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      fail("MCP_CONFIG_INVALID", "HTTP MCP URL 无效。");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      fail("MCP_CONFIG_INVALID", "HTTP MCP 仅支持 http/https URL。");
    }
    return {
      ...shared,
      transport,
      url: parsed.toString(),
      headers: stringMap(input.headers, "headers"),
    };
  }

  fail("MCP_CONFIG_INVALID", "transport 必须是 stdio 或 streamable-http。");
}

function preserveMasked(next, previous) {
  const result = { ...next };
  for (const key of ["env", "headers"]) {
    if (!result[key]) continue;
    const oldValues = previous?.[key] || {};
    result[key] = Object.fromEntries(
      Object.entries(result[key]).map(([name, value]) => [
        name,
        value === MASK && typeof oldValues[name] === "string"
          ? oldValues[name]
          : value,
      ]),
    );
  }
  return result;
}

function maskedConfig(config) {
  const result = structuredClone(config);
  for (const key of ["env", "headers"]) {
    if (!result[key]) continue;
    result[key] = Object.fromEntries(
      Object.entries(result[key]).map(([name, value]) => [
        name,
        value ? MASK : "",
      ]),
    );
  }
  return result;
}

export class McpManager {
  constructor(ctx, store) {
    this.ctx = ctx;
    this.store = store;
    this.fibers = new Map();
    this.status = new Map();
  }

  initialize() {
    for (const server of this.store.listMcpServers()) {
      if (server.enabled) this.start(server);
    }
  }

  start(server) {
    this.status.set(server.id, {
      state: "connecting",
      changedAt: new Date().toISOString(),
    });
    let fiber;
    try {
      fiber = this.ctx.plugin(McpClient, server.config);
    } catch (error) {
      this.status.set(server.id, {
        state: "error",
        message: error instanceof Error ? error.message : String(error),
        changedAt: new Date().toISOString(),
      });
      return;
    }
    this.fibers.set(server.id, fiber);
    Promise.resolve(fiber).then(
      () => {
        if (this.fibers.get(server.id) !== fiber) return;
        this.status.set(server.id, {
          state: "running",
          changedAt: new Date().toISOString(),
        });
      },
      (error) => {
        if (this.fibers.get(server.id) !== fiber) return;
        this.status.set(server.id, {
          state: "error",
          message: error instanceof Error ? error.message : String(error),
          changedAt: new Date().toISOString(),
        });
      },
    );
  }

  async stop(id, state = "disabled") {
    const fiber = this.fibers.get(id);
    this.fibers.delete(id);
    if (fiber) await fiber.dispose();
    this.status.set(id, {
      state,
      changedAt: new Date().toISOString(),
    });
  }

  toolNames(serverName) {
    const prefix = `mcp__${serverName}__`;
    return this.ctx.tools
      .schemas()
      .map((schema) => schema.name)
      .filter((name) => name.startsWith(prefix))
      .sort();
  }

  list() {
    return this.store.listMcpServers().map((server) => {
      const tools = this.toolNames(server.serverName);
      const status = this.status.get(server.id) || {
        state: server.enabled ? "pending" : "disabled",
      };
      return {
        ...server,
        config: maskedConfig(server.config),
        status: {
          ...status,
          toolCount: tools.length,
          tools,
        },
      };
    });
  }

  async save(input) {
    const existing = input.id
      ? this.store.listMcpServers().find((server) => server.id === input.id)
      : undefined;
    const serverName = String(input.serverName || "").trim();
    const restored = preserveMasked(input.config, existing?.config);
    const config = normalizeConfig(serverName, restored);
    const server = this.store.upsertMcpServer({
      id: input.id,
      expectedRevision: input.expectedRevision,
      serverName,
      enabled: input.enabled !== false,
      config,
    });
    await this.stop(server.id, server.enabled ? "restarting" : "disabled");
    if (server.enabled) this.start(server);
    return this.list().find((item) => item.id === server.id);
  }

  async remove(id, expectedRevision) {
    await this.stop(id, "removed");
    this.store.deleteMcpServer(id, expectedRevision);
    this.status.delete(id);
  }

  async restart(id) {
    const server = this.store
      .listMcpServers()
      .find((candidate) => candidate.id === id);
    if (!server) fail("MCP_NOT_FOUND", "MCP 配置不存在。", 404);
    if (!server.enabled) fail("MCP_DISABLED", "请先启用该 MCP。", 409);
    await this.stop(id, "restarting");
    this.start(server);
    return this.list().find((item) => item.id === id);
  }

  async close() {
    await Promise.all(
      [...this.fibers.keys()].map((id) => this.stop(id, "stopped")),
    );
  }
}

export { MASK as MCP_SECRET_MASK };
