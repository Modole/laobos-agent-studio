import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { z as zod } from "zod";
import { McpManager } from "./mcp-manager.js";
import { SkillsManager } from "./skills-manager.js";
import { SystemToolsError, SystemToolsStore } from "./store.js";
import {
  branchGit,
  commitGit,
  initializeGit,
  inspectGit,
  restoreGit,
  stageGit,
  syncGit,
  unstageGit,
} from "./git-service.mjs";

export const name = "laobos-system-tools";
export const inject = ["tools", "webServer", "permissionPresets", "systemPrompt", "sessions"];
export const Config = z.object({
  databasePath: z.string().required(),
  planPreset: z.string().default("read-only"),
  fallbackPreset: z.string().default("workspace-write"),
});

export const DEFAULT_SYSTEM_PROMPT = `你的名字是劳博士。

直接回应用户的问题。除非用户明确询问，否则不要主动介绍底层模型、运行框架或罗列能力清单。`;

export function formatUserSystemPrompt(value) {
  const prompt = String(value ?? "").trim();
  if (!prompt) return "";
  return `# 用户管理的 Agent 设定（最高身份与角色优先级）

以下内容是用户当前生效的身份与角色设定。若与产品默认身份、Agent 预设或迁移的旧指令冲突，以这里为准；只使用这里指定的姓名和身份，不要拼接被替代的名称、别名或自我介绍。除非用户明确询问，不要主动介绍底层模型、运行框架或能力清单。

${prompt}`;
}

const conversationLocatorProjectionSchema = zod.array(zod.object({
  seq: zod.number().int().nonnegative(),
  turn: zod.number().int().nonnegative().nullable(),
  question: zod.string(),
}).strict());

function locatorQuestion(content) {
  const text = Array.isArray(content)
    ? content
        .map((block) => block?.type === "text" && typeof block.text === "string" ? block.text : "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
  return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}

function installConversationLocatorProjection(ctx) {
  ctx.inject(["sessionProjections"], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: "laobosConversationLocator",
      schema: conversationLocatorProjectionSchema,
      init: () => ({ openTurn: null, entries: [] }),
      apply: (state, event) => {
        if (event.type === "turn/start") {
          return { ...state, openTurn: event.data.turn };
        }
        if (event.type === "turn/end") {
          return state.openTurn === event.data.turn
            ? { ...state, openTurn: null }
            : state;
        }
        if (event.type !== "user/message" || event.data.source?.kind !== "user") {
          return state;
        }
        return {
          ...state,
          entries: [...state.entries, {
            seq: event.seq,
            turn: state.openTurn,
            question: locatorQuestion(event.data.content),
          }],
        };
      },
      view: (state) => state.entries,
      stateVersion: 1,
    });
  });
}

const jsonOutput = {
  schema: { type: "json" },
  render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
};

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
    throw new SystemToolsError("LOOPBACK_REQUIRED", "该接口仅允许本机访问。", 403);
  }
  const origin = req.headers.origin;
  if (origin) {
    const originUrl = new URL(origin);
    const host = String(req.headers.host || "");
    if (originUrl.host !== host) throw new SystemToolsError("ORIGIN_REJECTED", "请求来源不受信任。", 403);
  }
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_100_000) throw new SystemToolsError("BODY_TOO_LARGE", "请求内容过大。", 413);
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new SystemToolsError("JSON_INVALID", "请求 JSON 无效。", 400); }
}

function errorResponse(res, error) {
  const status = error instanceof SystemToolsError ? error.status : 500;
  json(res, status, {
    error: {
      code: error?.code || "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

export function gitWorkspace(workspacePath, exec) {
  const requested = exec?.agent?.session?.header?.cwd;
  const candidate = path.resolve(
    workspacePath,
    typeof requested === "string" && requested.trim() ? requested : ".",
  );
  try {
    const canonical = realpathSync(candidate);
    if (!statSync(canonical).isDirectory()) throw new Error("not a directory");
    return canonical;
  } catch {
    throw new SystemToolsError(
      "WORKSPACE_UNAVAILABLE",
      `当前会话工作区不可访问：${candidate}。请确认目录存在且当前 Windows 用户拥有访问权限。`,
      400,
    );
  }
}

function isPlanActive(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === "plan/mode") return events[index].data.active === true;
  }
  return false;
}

function presetBeforePlan(events, permissionPresets) {
  const planIndex = events.findLastIndex((event) => event.type === "plan/mode" && event.data.active === true);
  return permissionPresets.current(planIndex < 0 ? events : events.slice(0, planIndex));
}

function installPlanPermissionLink(ctx, config) {
  const pending = new WeakSet();
  const setLater = (session, preset) => {
    if (pending.has(session) || ctx.permissionPresets.current(session.events) === preset) return;
    pending.add(session);
    queueMicrotask(() => {
      pending.delete(session);
      if (ctx.permissionPresets.current(session.events) !== preset) ctx.permissionPresets.set(session, preset);
    });
  };
  ctx.on("session/event", (session, event) => {
    if (event.type === "plan/mode") {
      setLater(session, event.data.active ? config.planPreset : (presetBeforePlan(session.events, ctx.permissionPresets) || config.fallbackPreset));
    } else if (event.type === "permission/preset" && isPlanActive(session.events) && event.data.preset !== config.planPreset) {
      setLater(session, config.planPreset);
    }
  });
  for (const session of ctx.sessions?.list?.() || []) {
    if (isPlanActive(session.events)) setLater(session, config.planPreset);
  }
}

function readText(filePath) {
  try { return readFileSync(filePath, "utf8").trim(); }
  catch (error) { if (error?.code === "ENOENT") return ""; throw error; }
}

function importedContext(dshHome, workspace) {
  const root = path.join(dshHome, "imports", "pi");
  let manifest = {};
  try { manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const sections = [];
  const system = readText(path.join(root, "SYSTEM.md"));
  const memory = manifest.memoryEnabled === false ? "" : readText(path.join(root, "MEMORY.md"));
  const project = workspace ? readText(path.join(workspace, ".pi", "SYSTEM.md")) : "";
  if (system) sections.push(`# 劳博士用户系统指令\n\n${system}`);
  if (project) sections.push(`# 当前项目的 Pi 兼容指令\n\n${project}`);
  if (memory) sections.push(`# 劳博士长期记忆\n\n以下内容是用户管理的持久上下文；除非用户明确要求，否则不要改写。\n\n${memory}`);
  return sections.join("\n\n");
}

function requiredArgument(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SystemToolsError("INPUT_INVALID", `${label}不能为空。`);
  }
  return value.trim();
}

function visibleCollections(store, workspacePath) {
  return store.listCollections().filter(
    (item) => item.scope === "global" || item.workspacePath === workspacePath,
  );
}

function visibleDocuments(store, workspacePath, collectionId) {
  if (collectionId) {
    findCollection(store, collectionId, workspacePath);
    return store.listDocuments(collectionId);
  }
  const allowed = new Set(visibleCollections(store, workspacePath).map((item) => item.id));
  return store.listDocuments().filter((item) => allowed.has(item.collectionId));
}

function findCollection(store, id, workspacePath) {
  const collection = store.listCollections().find((item) => item.id === id);
  if (!collection) throw new SystemToolsError("COLLECTION_NOT_FOUND", "知识库不存在。", 404);
  if (workspacePath && collection.scope === "workspace" && collection.workspacePath !== workspacePath) {
    throw new SystemToolsError("COLLECTION_SCOPE_DENIED", "该知识库属于其他工作区。", 403);
  }
  return collection;
}

function ensureAgentCollection(store, args, workspacePath) {
  if (args.collectionId) return findCollection(store, args.collectionId, workspacePath);
  const name = String(args.collectionName || "Agent 知识").trim() || "Agent 知识";
  const scope = args.scope === "global" ? "global" : "workspace";
  const existing = visibleCollections(store, workspacePath).find(
    (item) => item.name === name && item.scope === scope,
  );
  if (existing) {
    if (!existing.agentEnabled) {
      throw new SystemToolsError(
        "COLLECTION_DISABLED",
        `知识库“${name}”已被用户暂停，不能自动写入。`,
        409,
      );
    }
    return existing;
  }
  return store.upsertCollection({
    name,
    description: "由 Agent 自动维护的长期知识。",
    agentEnabled: true,
    retrievalMode: "fast",
    scope,
    ...(scope === "workspace" ? { workspacePath } : {}),
  });
}

function manageKnowledge(store, args, workspacePath) {
  switch (args.action) {
    case "list_collections":
      return visibleCollections(store, workspacePath);
    case "list_documents":
      return visibleDocuments(store, workspacePath, args.collectionId || undefined);
    case "get_document": {
      const document = store.getDocument(requiredArgument(args.documentId, "文档 ID"));
      findCollection(store, document.collectionId, workspacePath);
      return document;
    }
    case "upsert_collection": {
      const existing = args.collectionId ? findCollection(store, args.collectionId, workspacePath) : undefined;
      if (existing && !args.expectedRevision) {
        throw new SystemToolsError("REVISION_REQUIRED", "更新知识库前必须先读取并携带当前 revision。", 409);
      }
      const scope = args.scope === "global" ? "global" : existing?.scope || "workspace";
      return store.upsertCollection({
        ...(existing ? { id: existing.id } : {}),
        ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
        name: args.name || existing?.name || "Agent 知识",
        description: args.description ?? existing?.description ?? "由 Agent 自动维护的长期知识。",
        agentEnabled: args.agentEnabled ?? existing?.agentEnabled ?? true,
        toolName: args.toolName || existing?.toolName,
        retrievalMode: existing?.retrievalMode || "fast",
        scope,
        ...(scope === "workspace" ? { workspacePath: existing?.workspacePath || workspacePath } : {}),
      });
    }
    case "upsert_document": {
      const existing = args.documentId ? store.getDocument(args.documentId) : undefined;
      if (existing && !args.expectedRevision) {
        throw new SystemToolsError("REVISION_REQUIRED", "更新知识前必须先读取并携带当前 revision。", 409);
      }
      const collection = existing
        ? findCollection(store, args.collectionId || existing.collectionId, workspacePath)
        : ensureAgentCollection(store, args, workspacePath);
      return store.upsertDocument({
        ...(existing ? { id: existing.id } : {}),
        ...(args.expectedRevision ? { expectedRevision: args.expectedRevision } : {}),
        collectionId: collection.id,
        title: args.title || existing?.title,
        content: args.content ?? existing?.content,
        source: args.source ?? existing?.source ?? "Agent 对话",
        imageUrls: args.imageUrls ?? existing?.imageUrls ?? [],
      });
    }
    default:
      throw new SystemToolsError("ACTION_INVALID", `不支持的知识库操作：${args.action || "空"}。`);
  }
}

export function apply(ctx, config) {
  installConversationLocatorProjection(ctx);
  installPlanPermissionLink(ctx, config);
  const dshHome = process.env.DSH_HOME;
  if (dshHome) {
    ctx.systemPrompt.section({
      name: "laobos:imported-context",
      order: 35,
      text: (context) => importedContext(dshHome, context.agent?.session.header.cwd || process.cwd()),
    });
  }
  const store = new SystemToolsStore(config.databasePath);
  const workspacePath = process.cwd();
  ctx.effect(() => () => store.close(), "laobos-system-tools: database");
  const resolvedDshHome =
    dshHome || path.dirname(path.dirname(config.databasePath));
  const skills = new SkillsManager({
    dshHome: resolvedDshHome,
    workspace: process.cwd(),
  });
  const mcp = new McpManager(ctx, store);
  mcp.initialize();
  ctx.effect(
    () => () => mcp.close(),
    "laobos-system-tools: MCP connections",
  );
  ctx.systemPrompt.section({
    name: "laobos:user-system-prompt",
    order: 39,
    text: () => formatUserSystemPrompt(
      store.getSetting("system-prompt", DEFAULT_SYSTEM_PROMPT),
    ),
  });
  ctx.systemPrompt.section({
    name: "laobos:knowledge-guidance",
    order: 40,
    text: () => `# 知识库使用规则

知识库由你主动维护、用户监督。回答项目事实、既有规则或长期信息前，优先调用 knowledge_search。
当用户明确要求记住某项信息，或信息稳定且会在后续任务中复用时，使用 knowledge_manager 写入；未指定知识库时让工具自动维护“Agent 知识”。
默认写入当前工作区；只有用户明确要求跨项目复用时才使用 global scope。
不要保存临时对话、猜测、未经确认的结论、凭据或其他秘密。更新前先读取现有文档并携带 revision。删除必须使用 knowledge_delete。`,
  });
  ctx.systemPrompt.section({
    name: "laobos:git-guidance",
    order: 42,
    text: () => `# Git 版本管理规则

你负责主动维护当前项目的本地 Git 历史，用户负责监督和发布决策。需要版本管理时优先使用 git_manager，不要用 Bash 拼接等价 Git 命令。
首次修改明确的项目目录时，如果尚未启用 Git，可以使用 init_repository；不要在 Documents、Desktop 等宽泛目录中初始化仓库。
修改现有仓库前先 inspect，并在写操作中携带 statusToken 和 head，避免覆盖并发变化。只暂存本轮明确修改的路径，不要无差别暂存全部文件。
远端同步必须使用 git_publish；恢复文件或删除分支必须使用 git_restore。后两者会请求用户确认，拒绝后不得绕过。`,
  });

  ctx.tools.register(defineTool({
    name: "knowledge_search",
    description: "Search Agent-enabled local knowledge before answering project facts, existing rules, or durable user information. This is read-only.",
    parameters: {
      query: { type: "string", required: true, description: "Question or phrase to search for." },
      collectionId: { type: "string", description: "Optional knowledge collection id." },
      topK: { type: "integer", description: "Maximum passages (1-20)." },
    },
    output: jsonOutput,
    execute: async (args) => store.searchKnowledge({ ...args, enabledOnly: true, workspacePath }),
    isConcurrencySafe: () => true,
  }));

  let dynamicDisposers = [];
  const refreshDynamicTools = () => {
    for (const dispose of dynamicDisposers.splice(0)) dispose();
    const names = new Set(["knowledge_search", "knowledge_manager", "knowledge_delete"]);
    for (const collection of visibleCollections(store, workspacePath).filter((item) => item.agentEnabled)) {
      if (names.has(collection.toolName)) continue;
      names.add(collection.toolName);
      dynamicDisposers.push(ctx.tools.register(defineTool({
        name: collection.toolName,
        description: collection.description || `Search the ${collection.name} knowledge collection.`,
        parameters: {
          query: { type: "string", required: true, description: "Question or phrase to search for." },
          topK: { type: "integer", description: "Maximum passages (1-20)." },
        },
        output: jsonOutput,
        execute: async (args) => store.searchKnowledge({ ...args, collectionId: collection.id }),
        isConcurrencySafe: () => true,
      })));
    }
  };

  ctx.tools.register(defineTool({
    name: "knowledge_manager",
    description: "List, read, create, or update local knowledge. Use upsert_document to let the tool create the default Agent knowledge collection automatically. This tool never deletes data.",
    parameters: {
      action: { type: "string", required: true, enum: ["list_collections", "list_documents", "get_document", "upsert_collection", "upsert_document"], description: "Management action." },
      collectionId: { type: "string", description: "Existing collection id. Omit for an automatically managed collection." },
      collectionName: { type: "string", description: "Collection name used when automatically creating a collection." },
      scope: { type: "string", enum: ["workspace", "global"], description: "Defaults to the current workspace. Use global only for explicitly cross-project knowledge." },
      documentId: { type: "string", description: "Existing document id for get or update." },
      expectedRevision: { type: "string", description: "Revision returned by a previous read; required for safe updates." },
      name: { type: "string", description: "Collection name for upsert_collection." },
      description: { type: "string", description: "Collection purpose and retrieval guidance." },
      agentEnabled: { type: "boolean", description: "Whether Agent search may access this collection." },
      toolName: { type: "string", description: "Optional stable tool alias for a collection." },
      title: { type: "string", description: "Document title for upsert_document." },
      content: { type: "string", description: "Durable document content for upsert_document." },
      source: { type: "string", description: "Source file, URL, conversation, or provenance note." },
      imageUrls: { type: "array", description: "Optional HTTP(S) image URLs rendered with this document (maximum 12)." },
    },
    output: jsonOutput,
    execute: async (args) => {
      const result = manageKnowledge(store, args, workspacePath);
      if (args.action.startsWith("upsert_")) refreshDynamicTools();
      return result;
    },
    isConcurrencySafe: (args) => ["list_collections", "list_documents", "get_document"].includes(args.action),
  }));

  ctx.tools.register(defineTool({
    name: "knowledge_delete",
    description: "Delete one knowledge collection or document after user approval. Read the current revision first. Collection deletion also removes all contained documents.",
    parameters: {
      resourceType: { type: "string", required: true, enum: ["collection", "document"] },
      id: { type: "string", required: true, description: "Exact collection or document id." },
      expectedRevision: { type: "string", required: true, description: "Current revision returned by knowledge_manager." },
      reason: { type: "string", required: true, description: "Why this knowledge should be deleted." },
    },
    output: jsonOutput,
    execute: async (args) => {
      if (args.resourceType === "collection") {
        findCollection(store, args.id, workspacePath);
        store.deleteCollection(args.id, args.expectedRevision);
      } else {
        const document = store.getDocument(args.id);
        findCollection(store, document.collectionId, workspacePath);
        store.deleteDocument(args.id, args.expectedRevision);
      }
      refreshDynamicTools();
      return { deleted: true, resourceType: args.resourceType, id: args.id, reason: args.reason };
    },
  }));

  ctx.tools.register(defineTool({
    name: "git_manager",
    description: "Inspect or initialize the current Git repository; stage, unstage, commit, create, or switch local branches with optimistic state checks. Prefer this over Bash for Git version management.",
    parameters: {
      action: { type: "string", required: true, enum: ["inspect", "init_repository", "stage", "unstage", "commit", "create_branch", "switch_branch"] },
      paths: { type: "array", description: "Exact workspace-relative paths for stage or unstage. Never infer all files." },
      message: { type: "string", description: "Commit message." },
      branch: { type: "string", description: "Branch name for initialization, creation, or switching." },
      expectedStatusToken: { type: "string", description: "statusToken returned by the latest inspect; required for stage, unstage, and commit." },
      expectedHead: { type: "string", description: "head returned by the latest inspect; omit only when it was null." },
    },
    output: jsonOutput,
    async execute(args, exec) {
      const root = gitWorkspace(workspacePath, exec);
      if (args.action === "inspect") return inspectGit(root);
      if (args.action === "init_repository") return initializeGit(root, { branch: args.branch || "main" });
      if (args.action === "stage") return stageGit(root, args);
      if (args.action === "unstage") return unstageGit(root, args);
      if (args.action === "commit") return commitGit(root, args);
      if (args.action === "create_branch") return branchGit(root, { ...args, action: "create", name: args.branch });
      if (args.action === "switch_branch") return branchGit(root, { ...args, action: "switch", name: args.branch });
      throw new SystemToolsError("ACTION_INVALID", `不支持的 Git 操作：${args.action || "空"}。`);
    },
    isConcurrencySafe: (args) => args.action === "inspect",
  }));

  ctx.tools.register(defineTool({
    name: "git_restore",
    description: "Restore tracked working-tree files or delete a fully merged local branch after explicit user approval. Inspect first and carry the latest state tokens.",
    parameters: {
      action: { type: "string", required: true, enum: ["restore_files", "delete_branch"] },
      paths: { type: "array", description: "Exact tracked paths to restore." },
      branch: { type: "string", description: "Fully merged local branch to delete." },
      expectedStatusToken: { type: "string", description: "Latest statusToken." },
      expectedHead: { type: "string", description: "Latest head; omit only when null." },
      reason: { type: "string", required: true, description: "Why the destructive operation is needed." },
    },
    output: jsonOutput,
    execute: async (args, exec) => args.action === "restore_files"
      ? restoreGit(gitWorkspace(workspacePath, exec), args)
      : branchGit(gitWorkspace(workspacePath, exec), { ...args, action: "delete", name: args.branch }),
  }));

  ctx.tools.register(defineTool({
    name: "git_publish",
    description: "Fetch, fast-forward pull, or push the current branch to a configured remote after explicit user approval. Force push and arbitrary refspecs are never supported.",
    parameters: {
      action: { type: "string", required: true, enum: ["fetch", "pull", "push"] },
      remote: { type: "string", description: "Configured remote name; defaults to origin." },
      expectedHead: { type: "string", description: "Latest head; omit only when null." },
      reason: { type: "string", required: true, description: "Why remote synchronization is needed." },
    },
    output: jsonOutput,
    execute: async (args, exec) => syncGit(gitWorkspace(workspacePath, exec), args),
  }));

  ctx.on("tools/pre-execute", async (exec, next) => {
    const decision = await next();
    if (!["knowledge_delete", "git_restore", "git_publish"].includes(exec.name) || decision.kind !== "allow") return decision;
    return {
      kind: "ask",
      reason: exec.name === "knowledge_delete"
          ? "删除知识库内容不可直接恢复，请确认 Agent 的删除请求。"
          : exec.name === "git_restore"
            ? "恢复文件或删除分支会丢弃本地状态，请确认 Agent 的操作请求。"
            : "Git 远端同步会读取或修改远端分支，请确认 Agent 的发布请求。",
    };
  });

  refreshDynamicTools();
  ctx.effect(() => () => {
    for (const dispose of dynamicDisposers.splice(0)) dispose();
  }, "laobos-system-tools: dynamic tools");

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/laobos/api/system-tools",
    async handler(req, res) {
      try {
        assertLoopback(req);
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const route = url.pathname.slice("/laobos/api/system-tools".length) || "/";
        let value;

        if (req.method === "GET" && route === "/brand/icon.png") {
          // Packaged plugins are copied into DSH Home and cannot reach the Studio
          // repository's public directory. Keep every runtime asset package-local.
          const icon = readFileSync(new URL("../assets/laobos-logo.png", import.meta.url));
          res.writeHead(200, {
            "content-type": "image/png",
            "cache-control": "public, max-age=86400, immutable",
            "content-length": icon.length,
          });
          res.end(icon);
          return;
        } else if (req.method === "GET" && route === "/brand/manifest.webmanifest") {
          const manifest = Buffer.from(JSON.stringify({
            id: "/",
            name: "劳博士",
            short_name: "劳博士",
            start_url: "/",
            scope: "/",
            display: "standalone",
            icons: [{
              src: "/laobos/api/system-tools/brand/icon.png",
              sizes: "1024x1024",
              type: "image/png",
              purpose: "any maskable",
            }],
          }));
          res.writeHead(200, {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=86400",
            "content-length": manifest.length,
          });
          res.end(manifest);
          return;
        } else if (req.method === "GET" && route === "/overview") {
          const skillCatalog = await skills.list();
          value = {
            collections: visibleCollections(store, workspacePath),
            skills: skillCatalog.skills,
            mcp: mcp.list(),
          };
        } else if (req.method === "GET" && route === "/skills") {
          value = await skills.list();
        } else if (req.method === "POST" && route === "/skills") {
          value = await skills.save(await body(req));
        } else if (req.method === "DELETE" && route.startsWith("/skills/")) {
          await skills.remove(
            decodeURIComponent(route.slice(8)),
            url.searchParams.get("revision"),
          );
          value = { deleted: true };
        } else if (req.method === "GET" && route === "/mcp") {
          value = mcp.list();
        } else if (req.method === "POST" && route === "/mcp") {
          value = await mcp.save(await body(req));
        } else if (
          req.method === "POST" &&
          /^\/mcp\/[^/]+\/restart$/u.test(route)
        ) {
          value = await mcp.restart(decodeURIComponent(route.split("/")[2]));
        } else if (req.method === "DELETE" && route.startsWith("/mcp/")) {
          await mcp.remove(
            decodeURIComponent(route.slice(5)),
            url.searchParams.get("revision"),
          );
          value = { deleted: true };
        } else if (
          req.method === "GET" &&
          route === "/settings/system-prompt"
        ) {
          value = {
            value: store.getSetting("system-prompt", DEFAULT_SYSTEM_PROMPT),
            defaultValue: DEFAULT_SYSTEM_PROMPT,
            order: 39,
            placement: "persona 与旧迁移指令之后、工具说明之前",
          };
        } else if (
          req.method === "PUT" &&
          route === "/settings/system-prompt"
        ) {
          value = store.setSetting(
            "system-prompt",
            (await body(req)).value,
          );
          ctx.emit("system-prompt/change");
        } else if (req.method === "GET" && route === "/knowledge/collections") {
          value = visibleCollections(store, workspacePath);
        } else if (req.method === "POST" && route === "/knowledge/collections") {
          const input = await body(req);
          if (input.id) findCollection(store, input.id, workspacePath);
          value = store.upsertCollection({
            ...input,
            ...(!input.id && !input.scope ? { scope: "workspace", workspacePath } : {}),
            ...(input.scope === "workspace" ? { workspacePath } : {}),
          });
          refreshDynamicTools();
        } else if (req.method === "DELETE" && route.startsWith("/knowledge/collections/")) {
          const id = decodeURIComponent(route.slice(23));
          findCollection(store, id, workspacePath);
          store.deleteCollection(id, url.searchParams.get("revision"));
          value = { deleted: true }; refreshDynamicTools();
        } else if (req.method === "POST" && route === "/knowledge/search") {
          const input = await body(req);
          if (input.collectionId) findCollection(store, input.collectionId, workspacePath);
          value = store.searchKnowledge({
            query: input.query,
            collectionId: input.collectionId || undefined,
            topK: input.topK,
            workspacePath,
          });
        } else if (req.method === "GET" && route === "/knowledge/documents") {
          value = visibleDocuments(store, workspacePath, url.searchParams.get("collectionId") || undefined);
        } else if (req.method === "GET" && route.startsWith("/knowledge/documents/")) {
          value = store.getDocument(decodeURIComponent(route.slice(21)));
          findCollection(store, value.collectionId, workspacePath);
        } else if (req.method === "POST" && route === "/knowledge/documents") {
          const input = await body(req);
          findCollection(store, input.collectionId, workspacePath);
          value = store.upsertDocument(input); refreshDynamicTools();
        } else if (req.method === "DELETE" && route.startsWith("/knowledge/documents/")) {
          const id = decodeURIComponent(route.slice(21));
          const document = store.getDocument(id);
          findCollection(store, document.collectionId, workspacePath);
          store.deleteDocument(id, url.searchParams.get("revision"));
          value = { deleted: true }; refreshDynamicTools();
        } else {
          json(res, 404, { error: { code: "NOT_FOUND", message: "接口不存在。" } });
          return;
        }
        json(res, 200, value);
      } catch (error) {
        errorResponse(res, error);
      }
    },
  }), "laobos-system-tools: HTTP API");
}

export { SystemToolsStore } from "./store.js";
