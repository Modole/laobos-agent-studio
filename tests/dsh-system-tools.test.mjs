import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  MCP_SECRET_MASK,
  McpManager,
} from "../packages/laobos-system-tools/lib/mcp-manager.js";
import { SkillsManager } from "../packages/laobos-system-tools/lib/skills-manager.js";
import {
  DEFAULT_SYSTEM_PROMPT,
  apply as applySystemTools,
  formatUserSystemPrompt,
  gitWorkspace,
} from "../packages/laobos-system-tools/lib/index.js";
import { SystemToolsStore } from "../packages/laobos-system-tools/lib/store.js";

const definition = {
  version: 2,
  nodes: [
    {
      id: "input",
      type: "input",
      fields: [
        { name: "message", type: "string", required: true },
        { name: "count", type: "number", default: 2 },
      ],
    },
    {
      id: "template",
      type: "template",
      template: "你好，{{ input.message }}！",
    },
    {
      id: "code",
      type: "code",
      code: "return input.count * 2;",
    },
    {
      id: "condition",
      type: "if-else",
      conditions: [{ left: "{{ input.count }}", operator: "greater-than", right: 3 }],
    },
    {
      id: "large",
      type: "variable-assigner",
      assignments: [{ name: "verdict", value: "large" }],
    },
    {
      id: "small",
      type: "variable-assigner",
      assignments: [{ name: "verdict", value: "small" }],
    },
    {
      id: "output",
      type: "output",
      outputs: [
        { name: "greeting", value: "{{ nodes.template }}" },
        { name: "double", value: "{{ nodes.code }}" },
        { name: "verdict", value: "{{ variables.verdict }}" },
      ],
    },
  ],
  edges: [
    { id: "e1", source: "input", target: "template" },
    { id: "e2", source: "template", target: "code" },
    { id: "e3", source: "code", target: "condition" },
    { id: "e4", source: "condition", target: "large", sourceHandle: "true" },
    { id: "e5", source: "condition", target: "small", sourceHandle: "false" },
    { id: "e6", source: "large", target: "output" },
    { id: "e7", source: "small", target: "output" },
  ],
};

test("system Git tools trust the current DSH session workspace across Windows drives", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-session-workspace-"));
  const startup = path.join(temporary, "Documents");
  const session = path.join(temporary, "D-drive", "project");
  await mkdir(startup, { recursive: true });
  await mkdir(session, { recursive: true });
  try {
    assert.equal(gitWorkspace(startup, {
      agent: { session: { header: { cwd: session } } },
    }), await realpath(session));
    assert.throws(() => gitWorkspace(startup, {
      agent: { session: { header: { cwd: path.join(temporary, "missing") } } },
    }), /当前会话工作区不可访问/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("DSH system-tools store preserves knowledge CRUD/search and published workflow execution", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-system-tools-"));
  const store = new SystemToolsStore(path.join(root, "system-tools.db"));
  try {
    const collection = store.upsertCollection({
      name: "项目规范",
      description: "劳博士项目规范",
      agentEnabled: true,
      toolName: "search_project_rules",
      retrievalMode: "fast",
    });
    const document = store.upsertDocument({
      collectionId: collection.id,
      title: "发布规范",
      content: "生产发布必须经过安全审批，并且保留回滚方案。",
      imageUrls: ["https://example.com/release-checklist.png"],
    });
    assert.equal(document.chunkCount, 1);
    assert.deepEqual(document.imageUrls, ["https://example.com/release-checklist.png"]);
    const knowledgeResult = store.searchKnowledge({ query: "安全审批" })[0];
    assert.match(knowledgeResult.content, /回滚方案/);
    assert.deepEqual(knowledgeResult.imageUrls, ["https://example.com/release-checklist.png"]);
    assert.throws(
      () => store.upsertDocument({ collectionId: collection.id, title: "危险图片", content: "拒绝非 HTTP 图片", imageUrls: ["file:///tmp/private.png"] }),
      (error) => error.code === "IMAGE_URL_INVALID",
    );

    const workflow = store.upsertWorkflow({
      name: "测试工作流",
      description: "覆盖迁移后的原有节点",
      toolName: "test_workflow",
      definition,
    });
    assert.equal(workflow.enabled, false);
    const published = store.publishWorkflow(workflow.id);
    assert.equal(published.enabled, true);
    const result = await store.runWorkflow(
      workflow.id,
      { message: "劳博士", count: 4 },
      {},
      published.version,
    );
    assert.deepEqual(result.output, {
      greeting: "你好，劳博士！",
      double: 8,
      verdict: "large",
    });
    const disabled = store.setWorkflowEnabled(workflow.id, false, published.revision);
    assert.equal(disabled.enabled, false);
    assert.equal(store.listPublishedWorkflows()[0].enabled, false);
    const republished = store.publishWorkflow(workflow.id, disabled.revision);
    assert.equal(republished.enabled, false, "republishing must preserve an explicit user disable");
    const enabled = store.setWorkflowEnabled(workflow.id, true, republished.revision);
    assert.equal(enabled.enabled, true);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("workflow migration keeps previously published tools enabled", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-workflow-migration-"));
  const databasePath = path.join(root, "system-tools.db");
  const legacy = new DatabaseSync(databasePath);
  const timestamp = new Date().toISOString();
  legacy.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', tool_name TEXT NOT NULL, definition_json TEXT NOT NULL,
      published_version INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE workflow_versions (
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, version INTEGER NOT NULL,
      name TEXT NOT NULL, description TEXT NOT NULL, tool_name TEXT NOT NULL,
      definition_json TEXT NOT NULL, published_at TEXT NOT NULL,
      PRIMARY KEY (workflow_id, version)
    );
  `);
  legacy.prepare(`INSERT INTO workflows(
    id,revision,name,description,tool_name,definition_json,published_version,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    "workflow-legacy", 1, "旧工作流", "升级前已发布", "legacy_workflow",
    JSON.stringify(definition), 1, timestamp, timestamp,
  );
  legacy.prepare(`INSERT INTO workflow_versions(
    workflow_id,version,name,description,tool_name,definition_json,published_at
  ) VALUES(?,?,?,?,?,?,?)`).run(
    "workflow-legacy", 1, "旧工作流", "升级前已发布", "legacy_workflow",
    JSON.stringify(definition), timestamp,
  );
  legacy.close();

  const store = new SystemToolsStore(databasePath);
  try {
    assert.equal(store.getWorkflow("workflow-legacy").enabled, true);
    assert.equal(store.listPublishedWorkflows()[0].enabled, true);
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("knowledge retrieval handles natural questions and respects Agent visibility", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-knowledge-retrieval-"));
  const store = new SystemToolsStore(path.join(root, "system-tools.db"));
  try {
    const collection = store.upsertCollection({
      name: "售后规则",
      description: "产品售后知识",
      agentEnabled: false,
      toolName: "search_support_rules",
      retrievalMode: "fast",
    });
    store.upsertDocument({
      collectionId: collection.id,
      title: "退款规则",
      content: "平台支持在付款后七天内申请退款。提交退款后，款项通常在三个工作日内原路返回。",
    });
    store.upsertDocument({
      collectionId: collection.id,
      title: "上线规则",
      content: "生产发布必须经过安全审批，并且保留回滚方案。",
    });

    assert.equal(store.searchKnowledge({ query: "退款规则是什么？" })[0]?.title, "退款规则");
    assert.equal(store.searchKnowledge({ query: "付款后多久可以退款？" })[0]?.title, "退款规则");
    assert.equal(store.searchKnowledge({ query: "安全审批 回滚方案" })[0]?.title, "上线规则");
    assert.deepEqual(store.searchKnowledge({ query: "申请退款", enabledOnly: true }), []);

    const latest = store.listCollections().find((item) => item.id === collection.id);
    store.upsertCollection({
      ...latest,
      expectedRevision: latest.revision,
      agentEnabled: true,
    });
    assert.equal(store.searchKnowledge({ query: "申请退款", enabledOnly: true }).length, 1);

    const privateCollection = store.upsertCollection({
      name: "甲项目知识",
      toolName: "search_project_alpha",
      agentEnabled: true,
      scope: "workspace",
      workspacePath: "/workspace/alpha",
    });
    store.upsertDocument({
      collectionId: privateCollection.id,
      title: "内部代号",
      content: "甲项目的内部发布代号是青鸟计划。",
    });
    assert.equal(store.searchKnowledge({ query: "青鸟计划", enabledOnly: true, workspacePath: "/workspace/alpha" }).length, 1);
    assert.equal(store.searchKnowledge({ query: "青鸟计划", enabledOnly: true, workspacePath: "/workspace/beta" }).length, 0);
    assert.throws(
      () => store.upsertCollection({ name: "冲突知识", toolName: "knowledge_search" }),
      (error) => error.code === "TOOL_NAME_RESERVED",
    );
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("DSH knowledge tools let the Agent create and manage its default collection", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-agent-knowledge-"));
  const registeredTools = new Map();
  const promptSections = new Map();
  const effects = [];
  const listeners = new Map();
  const context = {
    tools: {
      register(tool) {
        registeredTools.set(tool.name, tool);
        return () => { if (registeredTools.get(tool.name) === tool) registeredTools.delete(tool.name); };
      },
      schemas() { return [...registeredTools.values()].map((tool) => ({ name: tool.name })); },
    },
    systemPrompt: {
      section(section) {
        promptSections.set(section.name, section);
        return () => promptSections.delete(section.name);
      },
    },
    permissionPresets: { current() { return "workspace-write"; }, set() {}, names: ["workspace-write", "read-only"] },
    sessions: { list() { return []; } },
    webServer: { register() { return () => {}; } },
    logger: { warn() {} },
    inject() { return () => {}; },
    effect(operation) { const dispose = operation(); if (typeof dispose === "function") effects.push(dispose); },
    on(name, listener) { listeners.set(name, listener); return () => listeners.delete(name); },
    emit() {},
    plugin() { throw new Error("MCP is not configured in this fixture"); },
  };

  try {
    applySystemTools(context, {
      databasePath: path.join(root, "system-tools.db"),
      planPreset: "read-only",
      fallbackPreset: "workspace-write",
    });
    const identitySection = promptSections.get("laobos:user-system-prompt");
    assert.equal(identitySection.order, 39);
    assert.match(identitySection.text(), /你的名字是劳博士/u);
    assert.deepEqual(
      [...registeredTools.keys()].filter((name) => name.startsWith("knowledge_")).sort(),
      ["knowledge_delete", "knowledge_manager", "knowledge_search"],
    );
    assert.deepEqual(
      [...registeredTools.keys()].filter((name) => name.startsWith("workflow_")).sort(),
      [],
    );
    assert.deepEqual(
      [...registeredTools.keys()].filter((name) => name.startsWith("git_")).sort(),
      ["git_manager", "git_publish", "git_restore"],
    );

    const created = await registeredTools.get("knowledge_manager").execute({
      action: "upsert_document",
      title: "发布约束",
      content: "每次生产发布都必须保留可验证的回滚方案。",
      source: "测试会话",
    }, {});
    assert.equal(created.title, "发布约束");
    await assert.rejects(
      registeredTools.get("knowledge_manager").execute({
        action: "upsert_document",
        documentId: created.id,
        content: "缺少 revision 的覆盖不应成功。",
      }, {}),
      (error) => error.code === "REVISION_REQUIRED",
    );
    const updated = await registeredTools.get("knowledge_manager").execute({
      action: "upsert_document",
      documentId: created.id,
      expectedRevision: created.revision,
      content: "每次生产发布都必须保留经过验证的回滚方案。",
    }, {});
    assert.notEqual(updated.revision, created.revision);

    const collections = await registeredTools.get("knowledge_manager").execute({ action: "list_collections" }, {});
    assert.equal(collections.length, 1);
    assert.equal(collections[0].name, "Agent 知识");
    assert.equal(collections[0].agentEnabled, true);
    assert.equal(collections[0].scope, "workspace");
    assert.equal(collections[0].workspacePath, process.cwd());
    assert.ok(registeredTools.has(collections[0].toolName));

    const results = await registeredTools.get("knowledge_search").execute({ query: "生产发布需要什么？" }, {});
    assert.equal(results[0]?.title, "发布约束");

    const deleteDecision = await listeners.get("tools/pre-execute")(
      { name: "knowledge_delete" },
      () => Promise.resolve({ kind: "allow" }),
    );
    assert.equal(deleteDecision.kind, "ask");
    for (const name of ["git_restore", "git_publish"]) {
      const decision = await listeners.get("tools/pre-execute")(
        { name },
        () => Promise.resolve({ kind: "allow" }),
      );
      assert.equal(decision.kind, "ask");
    }
  } finally {
    for (const dispose of effects.reverse()) await dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("system prompt and MCP settings persist locally with secret masking", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-system-settings-"));
  const store = new SystemToolsStore(path.join(root, "system-tools.db"));
  const context = {
    tools: { schemas: () => [] },
    plugin() {
      throw new Error("disabled MCP must not start");
    },
  };
  const manager = new McpManager(context, store);
  try {
    assert.equal(
      store.getSetting("system-prompt", DEFAULT_SYSTEM_PROMPT),
      DEFAULT_SYSTEM_PROMPT,
    );
    store.setSetting("system-prompt", "优先遵守项目规则");
    assert.equal(store.getSetting("system-prompt"), "优先遵守项目规则");

    const server = await manager.save({
      serverName: "local_files",
      enabled: false,
      config: {
        transport: "stdio",
        command: "node",
        args: ["server.mjs"],
        env: { TOKEN: "real-secret" },
      },
    });
    assert.equal(server.status.state, "disabled");
    assert.equal(server.config.env.TOKEN, MCP_SECRET_MASK);

    await manager.save({
      id: server.id,
      expectedRevision: server.revision,
      serverName: server.serverName,
      enabled: false,
      config: {
        ...server.config,
        env: { TOKEN: MCP_SECRET_MASK },
      },
    });
    assert.equal(
      store.listMcpServers()[0].config.env.TOKEN,
      "real-secret",
      "masked values retain the stored secret on edit",
    );

    const failed = await manager.save({
      serverName: "failed_server",
      enabled: true,
      config: {
        transport: "stdio",
        command: "node",
        args: ["missing.mjs"],
      },
    });
    assert.equal(failed.status.state, "error");
    assert.match(failed.status.message, /disabled MCP must not start/u);
  } finally {
    await manager.close();
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("user-managed Agent identity replaces the default name without keeping aliases", () => {
  assert.match(DEFAULT_SYSTEM_PROMPT, /你的名字是劳博士/u);

  const prompt = formatUserSystemPrompt("你的名字是小劳同学。");
  assert.match(prompt, /你的名字是小劳同学/u);
  assert.match(prompt, /只使用这里指定的姓名和身份/u);
  assert.doesNotMatch(prompt, /你的名字是劳博士/u);
  assert.equal(formatUserSystemPrompt("  \n  "), "");
});

test("Skills manager writes DSH-native project skills and toggles discovery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "laobos-skills-"));
  const workspace = path.join(root, "workspace");
  const dshHome = path.join(root, "dsh-home");
  const previousAgentsHome = process.env.DSH_AGENTS_HOME;
  process.env.DSH_AGENTS_HOME = path.join(root, "agents-home");
  await mkdir(workspace, { recursive: true });
  const manager = new SkillsManager({ dshHome, workspace });
  try {
    const created = await manager.save({
      rootId: "project-dsh",
      name: "release-check",
      description: "Verify a release before deployment.",
      whenToUse: "Before publishing a release.",
      body: "# Release check\n\nRun the required validation suite.",
      enabled: true,
      userInvocable: true,
    });
    assert.equal(created.scope, "项目");
    assert.equal(created.source, "DSH");
    assert.equal(created.rank, 100);
    assert.equal(created.enabled, true);
    assert.match(await readFile(created.path, "utf8"), /name: release-check/u);
    if (process.platform !== "win32") {
      assert.equal((await stat(created.path)).mode & 0o777, 0o600);
    }

    const disabled = await manager.save({
      id: created.id,
      expectedRevision: created.revision,
      name: created.name,
      description: created.description,
      whenToUse: created.whenToUse,
      body: created.body,
      enabled: false,
      userInvocable: created.userInvocable,
      disableModelInvocation: created.disableModelInvocation,
    });
    assert.equal(disabled.enabled, false);
    assert.match(disabled.path, /SKILL\.md\.disabled$/u);
    assert.equal((await manager.list()).skills.length, 1);

    const removed = await manager.remove(disabled.id, disabled.revision);
    assert.deepEqual(removed, { deleted: true, id: disabled.id });
    assert.equal((await manager.list()).skills.length, 0);
  } finally {
    if (previousAgentsHome === undefined) delete process.env.DSH_AGENTS_HOME;
    else process.env.DSH_AGENTS_HOME = previousAgentsHome;
    await rm(root, { recursive: true, force: true });
  }
});

test("browser plugin exposes right-side page navigation and migrated settings", async () => {
  const source = await readFile(
    new URL("../packages/laobos-system-tools/lib/client.js", import.meta.url),
    "utf8",
  );
  for (const label of ["对话", "轨迹", "文件管理器", "版本中心", "知识库", "Skills", "MCP", "终端", "浏览器", "SSH", "应用管理"]) {
    assert.match(source, new RegExp(`label: "${label}"`, "u"));
  }
  for (const group of ["对话", "工作台", "集成管理"]) {
    assert.match(source, new RegExp(`groupLabel: "${group}"`, "u"));
  }
  assert.doesNotMatch(source, /sidebar\.footer\.action/u);
  assert.match(source, /shell\.overlay/u);
  assert.match(source, /data-laobos-right-sidebar/u);
  assert.match(source, /className: "lbs-right-toggle"/u);
  assert.match(source, /className: "lbs-right-resizer"/u);
  assert.match(source, /id: "laobos-project-sidebar"/u);
  assert.match(source, /id: "laobos-project-workspace"/u);
  assert.match(source, /className: "lbs-center-page"/u);
  assert.match(source, /data-laobos-native-settings-trigger/u);
  assert.match(source, /button\[aria-haspopup="dialog"\]/u);
  assert.doesNotMatch(source, /lbs-auth-usage-button/u);
  assert.match(source, /openNativeSettings/u);
  assert.match(source, /closeNativeSettings/u);
  assert.match(source, /closingPage === "settings"/u);
  assert.match(source, /active === "settings"/u);
  assert.match(source, /attributeFilter: \["aria-expanded"\]/u);
  assert.match(source, /2147483600/u);
  assert.ok(source.includes('body:has([data-laobos-native-settings-trigger][aria-expanded="true"])'));
  assert.match(source, /IconSettingsOutline16/u);
  assert.match(source, /IconSkillOutline16/u);
  assert.match(source, /function SystemPromptSection/u);
  assert.match(source, /Agent 自动维护知识/u);
  assert.match(source, /召回测试/u);
  assert.match(source, /\/knowledge\/search/u);
  assert.match(source, /保存并重新索引/u);
  assert.match(source, /className: "lbs-knowledge-table"/u);
  assert.match(source, /className: "lbs-knowledge-toolbar"/u);
  assert.match(source, /搜索知识库名称或说明/u);
  assert.match(source, /name: "activity"/u);
  assert.match(source, /活动日志/u);
  assert.match(source, /aria-labelledby": "lbs-knowledge-activity-title"/u);
  assert.match(source, /className: "lbs-icon-action"/u);
  assert.match(source, /role: "dialog"/u);
  assert.match(source, /aria-labelledby": "lbs-knowledge-modal-title"/u);
  assert.match(source, /settings\.section/u);
  assert.doesNotMatch(source, /id: "laobos-workflow-plugins"/u);
  assert.doesNotMatch(source, /\{ id: "workflows", label: "工作流"/u);
  for (const icon of ["edit", "trash"]) {
    assert.match(source, new RegExp(`name: "${icon}"`, "u"));
  }
  assert.match(source, /requestCloseManagement/u);
  assert.match(source, /isConversationNavigationClick/u);
  assert.ok(source.includes('[role="treeitem"][aria-selected]'));
  assert.ok(source.includes('button[aria-label="新建会话"]'));
  assert.match(source, /closeFeaturePageFromConversationNavigation/u);
  assert.match(source, /requestCloseManagement\(\(\) => switchNativeView\("chat"\)\)/u);
  assert.match(source, /addEventListener\(\s*"click",\s*closeFeaturePageFromConversationNavigation,\s*true/u);
  assert.match(source, /setExpanded\(false\)/u);
  assert.match(source, /className: "lbs-extension-slot"/u);
  assert.match(source, /className: "lbs-management-table"/u);
  assert.match(source, /搜索名称、简介或文件位置/u);
  assert.match(source, /显示兼容 Skills/u);
  assert.match(source, /复制位置/u);
  assert.match(source, /搜索 Server、连接目标或工具/u);
  assert.match(source, /复制目标/u);
  assert.match(source, /item\.enabled \? "停用" : "启用"/u);
  assert.doesNotMatch(source, /action: h\(Button, \{ onClick: createSkill \}/u);
  assert.doesNotMatch(source, /action: h\(Button, \{ onClick: createServer \}/u);
  assert.match(source, /localStorage\.getItem\("laobos:right-sidebar"\) === "expanded"/u);
  assert.match(source, /"data-slot": "skills-resources"/u);
  assert.match(source, /"data-slot": "mcp-diagnostics"/u);
  assert.match(source, /收起/u);
  assert.match(source, /\/skills\/\$\{encodeURIComponent\(item\.id\)\}/u);
  assert.match(source, /setInterval\(\(\) => load\(\), 2_000\)/u);
  assert.match(source, /RIGHT_SIDEBAR_DEFAULT_WIDTH = 120/u);
  assert.match(source, /RIGHT_SIDEBAR_MIN_WIDTH = 112/u);
  assert.match(source, /RIGHT_SIDEBAR_MAX_WIDTH = 180/u);
  assert.match(source, /settings\.section/u);
  assert.match(source, /id: "laobos-system-prompt"/u);
  assert.match(source, /id: "laobos-upload-cache"/u);
  assert.match(source, /function UploadCacheSettingsSection/u);
  assert.match(source, /selectLocation\("default"\)/u);
  assert.match(source, /selectLocation\("workspace"\)/u);
});
