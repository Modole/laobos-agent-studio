/**
 * @laobos/dsh-market — host 插件（劳博士专属 DSH 插件市场）。
 * 零依赖：HTTP API（/laobos/api/plugin-market）+ 三个对话工具。
 */
import { ghAvailable, ghToken, hasSettingsFile, installPlugin, installedOverview, loadSettings, MarketError, profileDirOf, saveSettings, searchMarket, uploadPlugin } from "./market.js";

export const name = "laobos-market";
export const inject = ["webServer", "loader", "tools"];

const FIBER_PHASE = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: "disposed", 5: "unloading" };

/* ────────────────────────────── HTTP 辅助 ────────────────────────────── */

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function assertLoopback(req) {
  const address = req.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
    throw new MarketError("LOOPBACK_REQUIRED", "该接口仅允许本机访问。", 403);
  }
  const origin = req.headers.origin;
  if (origin) {
    const originUrl = new URL(origin);
    if (originUrl.host !== String(req.headers.host || "")) {
      throw new MarketError("ORIGIN_REJECTED", "请求来源不受信任。", 403);
    }
  }
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_100_000) throw new MarketError("BODY_TOO_LARGE", "请求内容过大。", 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new MarketError("JSON_INVALID", "请求 JSON 无效。", 400);
  }
}

function errorResponse(res, error) {
  const status = error instanceof MarketError ? error.status : 500;
  json(res, status, {
    error: {
      code: error?.code || "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

/* ────────────────────────────── 工具定义（零依赖手写） ────────────────────────────── */

const jsonOutput = {
  schema: {},
  render: (_args, value) => [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
};

function defineMarketTool({ name, description, parameters, execute, timeoutMs }) {
  return {
    name,
    description,
    parameters,
    output: jsonOutput,
    async execute(args, exec) {
      return execute(args, exec);
    },
    ...(timeoutMs ? { timeoutMs } : {}),
    isConcurrencySafe: () => true,
  };
}

function textSummary(items) {
  return items.map((item) => (
    `- ${item.fullName} ⭐${item.stars} — ${(item.description || "").slice(0, 100)}\n  ${item.htmlUrl}`
  )).join("\n");
}

/* ────────────────────────────── apply ────────────────────────────── */

export function apply(ctx, rawConfig) {
  const dshHome = process.env.DSH_HOME || null;
  const patchConfig = (rawConfig && typeof rawConfig === "object" ? rawConfig : {});
  // patch 配置只作为首次种子写入存储；此后以存储（UI 可改）为准
  if (!hasSettingsFile(dshHome)) {
    const seed = {};
    for (const key of ["proxyUrl", "registry", "uploadOwner", "profile", "maxResults"]) {
      if (patchConfig[key] !== undefined) seed[key] = patchConfig[key];
    }
    saveSettings(dshHome, seed);
  }
  const readSettings = () => loadSettings(dshHome);
  const currentProfile = () => readSettings().profile || "web";
  const currentProfileDir = () => profileDirOf(dshHome, currentProfile());
  const loaderEntries = () => {
    const entries = [];
    try {
      for (const entry of ctx.loader.entries()) {
        if (entry.options?.group) continue;
        entries.push({
          entryId: entry.id,
          moduleName: entry.options?.name,
          enabled: !entry.disabled,
          fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
        });
      }
    } catch {}
    return entries;
  };

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/laobos/api/plugin-market",
    async handler(req, res) {
      try {
        assertLoopback(req);
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const route = url.pathname.slice("/laobos/api/plugin-market".length) || "/";
        const settings = readSettings();
        let value;

        if (req.method === "GET" && route === "/status") {
          value = {
            name,
            version: "0.1.0",
            dshHome,
            profile: currentProfile(),
            profileDir: dshHome ? currentProfileDir() : null,
            ghCli: await ghAvailable(),
            ghTokenConfigured: Boolean(await ghToken()),
            proxyUrl: settings.proxyUrl || "",
            registry: settings.registry,
            uploadOwner: settings.uploadOwner,
          };
        } else if (req.method === "GET" && route === "/settings") {
          value = settings;
        } else if (req.method === "PUT" && route === "/settings") {
          const next = await body(req);
          value = saveSettings(dshHome, {
            proxyUrl: next.proxyUrl !== undefined ? next.proxyUrl : settings.proxyUrl,
            registry: next.registry !== undefined ? next.registry : settings.registry,
            uploadOwner: next.uploadOwner !== undefined ? next.uploadOwner : settings.uploadOwner,
            profile: next.profile !== undefined ? next.profile : settings.profile,
            maxResults: next.maxResults !== undefined ? Number(next.maxResults) || 200 : settings.maxResults,
          });
        } else if (req.method === "GET" && route === "/search") {
          const keywords = url.searchParams.get("keywords") || url.searchParams.get("q") || "";
          const regex = url.searchParams.get("regex") || "";
          const field = url.searchParams.get("field") || "any";
          const sort = url.searchParams.get("sort") || "stars";
          const maxResults = Number(url.searchParams.get("maxResults")) || Math.min(settings.maxResults || 200, 500);
          value = await searchMarket({
            keywords,
            regex,
            field,
            sort,
            maxResults: Math.min(maxResults, 500),
            proxyUrl: settings.proxyUrl,
            registry: settings.registry,
          });
        } else if (req.method === "GET" && route === "/installed") {
          value = { items: installedOverview({ loaderEntries: loaderEntries(), patchFile: dshHome ? `${currentProfileDir()}/cordis.patch.yml` : null }) };
        } else if (req.method === "POST" && route === "/install") {
          const payload = await body(req);
          value = await installPlugin({
            owner: payload.owner,
            repo: payload.repo,
            ref: payload.ref,
            force: payload.force === true,
            proxyUrl: settings.proxyUrl,
            profileDir: currentProfileDir(),
          });
          ctx.logger.info(`[laobos-market] 安装插件：${value.packageName} → ${value.targetDir}`);
        } else if (req.method === "POST" && route === "/upload") {
          const payload = await body(req);
          value = await uploadPlugin({
            dir: payload.dir,
            repo: payload.repo,
            owner: payload.owner || settings.uploadOwner,
            description: payload.description || "",
            isPrivate: payload.isPrivate === true,
            topics: Array.isArray(payload.topics) ? payload.topics : [],
            proxyUrl: settings.proxyUrl,
            force: payload.force === true,
          });
          ctx.logger.info(`[laobos-market] 发布插件：${value.url}`);
        } else {
          json(res, 404, { error: { code: "NOT_FOUND", message: "接口不存在。" } });
          return;
        }
        json(res, 200, value);
      } catch (error) {
        errorResponse(res, error);
      }
    },
  }), "laobos-market: HTTP API");

  ctx.tools.register(defineMarketTool({
    name: "plugin_market_search",
    description: "搜索 DSH 插件市场（GitHub topic:dsh-plugin，共 2200+ 插件），支持关键词与正则表达式筛选。返回名称、星数、描述与链接。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "关键词（空格分隔，多个词全部匹配；留空则返回市场热门插件）" },
        regex: { type: "string", description: "可选正则表达式，对插件 name/full_name/description 做二次筛选（不区分大小写）" },
        field: { type: "string", description: "regex 作用字段：any（默认，全部字段）| name | full_name | description", enum: ["any", "name", "full_name", "description"] },
        sort: { type: "string", description: "排序：stars（默认）| forks | updated", enum: ["stars", "forks", "updated"] },
        maxResults: { type: "integer", description: "返回条数上限，默认 20，最大 100" },
      },
      required: ["query"],
    },
    timeoutMs: 120000,
    async execute(args) {
      const settings = readSettings();
      const result = await searchMarket({
        keywords: args.query,
        regex: args.regex,
        field: args.field || "any",
        sort: args.sort || "stars",
        maxResults: Math.min(Number(args.maxResults) || 20, 100),
        proxyUrl: settings.proxyUrl,
        registry: settings.registry,
      });
      return {
        total: result.total,
        matched: result.matched,
        items: result.items.map((item) => ({
          fullName: item.fullName,
          stars: item.stars,
          description: item.description,
          url: item.htmlUrl,
        })),
        summary: result.matched === 0 ? `市场共 ${result.total} 个插件，当前筛选无命中。` : `市场共 ${result.total} 个插件，当前筛选命中 ${result.matched} 个：\n${textSummary(result.items)}`,
      };
    },
  }));

  ctx.tools.register(defineMarketTool({
    name: "plugin_market_install",
    description: "从 DSH 插件市场下载并安装一个 GitHub 插件（topic:dsh-plugin）。会写入当前 profile 的 node_modules 与 cordis.patch.yml，安装后需重启 dsh web 才生效。",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "GitHub 仓库所有者，如 dsh-market" },
        repo: { type: "string", description: "仓库名，如 dsh-market" },
        ref: { type: "string", description: "分支或标签，默认 main（失败时自动尝试 main/master）" },
        force: { type: "boolean", description: "已安装同名插件时是否覆盖" },
      },
      required: ["owner", "repo"],
    },
    timeoutMs: 300000,
    async execute(args) {
      const settings = readSettings();
      return installPlugin({
        owner: args.owner,
        repo: args.repo,
        ref: args.ref,
        force: args.force === true,
        proxyUrl: settings.proxyUrl,
        profileDir: currentProfileDir(),
      });
    },
  }));

  ctx.tools.register(defineMarketTool({
    name: "plugin_market_upload",
    description: "把本地插件目录发布到 GitHub 插件市场：初始化 git 仓库、通过 gh CLI 创建公开/私有仓库并推送，自动添加 dsh-plugin topic。",
    parameters: {
      type: "object",
      properties: {
        dir: { type: "string", description: "本地插件目录的绝对路径（必须包含 package.json）" },
        repo: { type: "string", description: "要创建的 GitHub 仓库名" },
        description: { type: "string", description: "仓库简介（留空则用 package.json 的 description）" },
        isPrivate: { type: "boolean", description: "是否私有仓库；私有仓库不会出现在 dsh-plugin 市场搜索里" },
        topics: { type: "array", description: "额外 topic 列表（dsh-plugin 会自动添加）" },
      },
      required: ["dir", "repo"],
    },
    timeoutMs: 600000,
    async execute(args) {
      const settings = readSettings();
      return uploadPlugin({
        dir: args.dir,
        repo: args.repo,
        owner: settings.uploadOwner,
        description: args.description,
        isPrivate: args.isPrivate === true,
        topics: args.topics,
        proxyUrl: settings.proxyUrl,
        force: false,
      });
    },
  }));

  ctx.effect(() => () => {}, "laobos-market: noop");
}
