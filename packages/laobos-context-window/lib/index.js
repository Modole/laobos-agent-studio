import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

export const name = "laobos-context-window";
export const inject = ["webServer"];

export const STANDARD_CONTEXT_WINDOW = 200_000;
export const EXTENDED_CONTEXT_WINDOW = 1_000_000;

export const Config = z.object({
  statePath: z.string().required(),
  standardContextWindow: z.number().min(1).default(STANDARD_CONTEXT_WINDOW),
  extendedContextWindow: z.number().min(1).default(EXTENDED_CONTEXT_WINDOW),
});

function assertLoopback(req) {
  const address = req.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
    throw Object.assign(new Error("该接口仅允许本机访问。"), { status: 403 });
  }
  const origin = req.headers.origin;
  if (origin) {
    const originUrl = new URL(origin);
    if (originUrl.host !== String(req.headers.host || "")) {
      throw Object.assign(new Error("请求来源不受信任。"), { status: 403 });
    }
  }
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 16 * 1024) {
      throw Object.assign(new Error("请求内容过大。"), { status: 413 });
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("请求 JSON 无效。"), { status: 400 });
  }
}

function sendJson(res, status, value) {
  const payload = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
    pragma: "no-cache",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

export class ContextWindowPolicy {
  constructor({
    statePath,
    standardContextWindow = STANDARD_CONTEXT_WINDOW,
    extendedContextWindow = EXTENDED_CONTEXT_WINDOW,
  }) {
    if (!Number.isSafeInteger(standardContextWindow) || standardContextWindow <= 0) {
      throw new TypeError("standardContextWindow 必须是正整数");
    }
    if (!Number.isSafeInteger(extendedContextWindow) || extendedContextWindow <= standardContextWindow) {
      throw new TypeError("extendedContextWindow 必须是大于标准窗口的正整数");
    }
    this.statePath = path.resolve(statePath);
    this.standardContextWindow = standardContextWindow;
    this.extendedContextWindow = extendedContextWindow;
    this.enabled = false;
    this.load();
  }

  load() {
    try {
      const stored = JSON.parse(readFileSync(this.statePath, "utf8"));
      this.enabled = stored?.schema === 1 && stored?.enabled === true;
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      this.enabled = false;
    }
  }

  snapshot() {
    return Object.freeze({
      schema: 1,
      enabled: this.enabled,
      standardContextWindow: this.standardContextWindow,
      extendedContextWindow: this.extendedContextWindow,
      effectiveContextWindow: this.resolve(),
    });
  }

  resolve() {
    return this.enabled ? this.extendedContextWindow : this.standardContextWindow;
  }

  setEnabled(enabled) {
    if (typeof enabled !== "boolean") {
      throw Object.assign(new TypeError("enabled 必须是布尔值"), { status: 400 });
    }
    this.enabled = enabled;
    this.persist();
    return this.snapshot();
  }

  persist() {
    mkdirSync(path.dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.statePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      writeFileSync(temporary, `${JSON.stringify({ schema: 1, enabled: this.enabled })}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      renameSync(temporary, this.statePath);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }
}

export function apply(ctx, config) {
  const policy = new ContextWindowPolicy(config);
  ctx.provide("contextWindowPolicy", policy);
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/laobos/api/context-window",
    async handler(req, res) {
      try {
        assertLoopback(req);
        const url = new URL(req.url || "/", "http://localhost");
        const route = url.pathname.slice("/laobos/api/context-window".length) || "/";
        if (req.method === "GET" && route === "/state") {
          sendJson(res, 200, policy.snapshot());
          return;
        }
        if (req.method === "PUT" && route === "/state") {
          const input = await readBody(req);
          sendJson(res, 200, policy.setEnabled(input.enabled));
          return;
        }
        sendJson(res, 404, { success: false, error: "接口不存在" });
      } catch (error) {
        sendJson(res, Number(error?.status) || 500, {
          success: false,
          error: error instanceof Error ? error.message : "上下文设置失败",
        });
      }
    },
  }), "laobos-context-window: HTTP API");
}
