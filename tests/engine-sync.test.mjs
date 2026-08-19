import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("project-bound Studio syncs an explicit default model without probing it", async (context) => {
  const studioRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const engineRoot = [
    process.env.PI_STUDIO_TEST_ENGINE_ROOT,
    path.join(path.dirname(studioRoot), "pi-mono"),
    path.join(path.dirname(studioRoot), "pi-agent-engine"),
  ].find(
    (candidate) =>
      candidate &&
      existsSync(path.join(candidate, "packages", "engine", "dist", "index.js")),
  );
  if (!engineRoot) {
    context.skip("A built Agent Engine fixture is not available in this checkout.");
    return;
  }

  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "pi-studio-engine-sync-"));
  const piDir = path.join(projectRoot, ".pi");
  const agentDir = path.join(piDir, "state", "agent");
  await mkdir(agentDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(piDir, "engine.yaml"),
      `version: 1
engine:
  id: "studio-sync-fixture"
project:
  root: ".."
  trust: "always"
agent:
  systemPrompt:
    replace: "./SYSTEM.md"
  tools:
    allow: []
    deny: []
    execution: "parallel"
resources:
  skills: []
  extensions: []
  contextFiles:
    enabled: false
    names: []
models:
  file: "./models.json"
  enabled: []
credentials: {}
runtime:
  mode: "in-process"
  maxConcurrentRuns: 1
  configUpdateMode: "next-run"
  sessions:
    backend: "memory"
    directory: "./state/sessions"
`,
    ),
    writeFile(path.join(piDir, "SYSTEM.md"), "Fixture prompt.\n"),
    writeFile(
      path.join(piDir, "models.json"),
      `${JSON.stringify(
        {
          providers: {
            "fixture-local": {
              name: "Fixture Local",
              baseUrl: "http://127.0.0.1:9/v1",
              api: "openai-completions",
              models: [
                {
                  id: "fixture-model",
                  name: "Fixture Model",
                  reasoning: false,
                  input: ["text"],
                  contextWindow: 8192,
                  maxTokens: 1024,
                },
              ],
            },
          },
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      path.join(agentDir, "auth.json"),
      `${JSON.stringify({
        "fixture-local": {
          type: "api_key",
          key: "fixture-secret-never-sent",
        },
      })}\n`,
      { mode: 0o600 },
    ),
  ]);

  process.env.PI_STUDIO_PROJECT_ROOT = projectRoot;
  process.env.PI_STUDIO_AGENT_DIR = agentDir;
  process.env.PI_STUDIO_MODELS_PATH = path.join(piDir, "models.json");
  process.env.PI_STUDIO_ENGINE_ROOT = engineRoot;

  const { startBridge } = await import(
    `../bridge/server.mjs?engine-sync-test=${Date.now()}`
  );
  let bridge;
  try {
    bridge = await startBridge({
      host: "127.0.0.1",
      port: 0,
      token: "engine-sync-token",
    });
    const headers = {
      "Content-Type": "application/json",
      "X-Pi-Bridge-Token": "engine-sync-token",
    };

    const beforeResponse = await fetch(`${bridge.url}/api/config`, { headers });
    const before = await beforeResponse.json();
    assert.equal(before.engineIntegration.ready, false);
    assert.equal(
      before.engineIntegration.checks.some(
        (check) => check.code === "ENGINE_DEFAULT_MODEL_REQUIRED",
      ),
      true,
    );

    const updateResponse = await fetch(`${bridge.url}/api/settings`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        workspacePath: projectRoot,
        projectTrust: true,
        memoryEnabled: true,
        defaultProvider: "fixture-local",
        defaultModel: "fixture-model",
        thinkingLevel: "medium",
        allowedTools: ["read"],
      }),
    });
    assert.equal(updateResponse.status, 200);
    const updateText = await updateResponse.text();
    assert.doesNotMatch(updateText, /fixture-secret-never-sent/u);
    const update = JSON.parse(updateText);
    assert.equal(update.engineIntegration.ready, true);
    assert.equal(update.settings.thinkingLevel, "off");
    assert.deepEqual(update.engineIntegration.thinkingLevelAdjustment, {
      from: "medium",
      to: "off",
      reason: "unsupported-by-model",
    });
    assert.deepEqual(update.engineIntegration.defaultModel, {
      provider: "fixture-local",
      id: "fixture-model",
      thinkingLevel: "off",
    });

    const modelsResponse = await fetch(`${bridge.url}/api/models`, { headers });
    assert.equal(modelsResponse.status, 200);
    const models = await modelsResponse.json();
    const fixtureModel = models.models.find(
      (model) =>
        model.provider === "fixture-local" && model.id === "fixture-model",
    );
    assert.deepEqual(fixtureModel?.thinkingLevels, ["off"]);
    assert.equal(fixtureModel?.reasoning, false);

    const collectionResponse = await fetch(`${bridge.url}/api/knowledge/collections`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: "项目知识" }),
    });
    assert.equal(collectionResponse.status, 200);
    const { collection } = await collectionResponse.json();
    assert.equal(collection.agentEnabled, false);
    assert.equal(collection.retrievalMode, "fast");
	assert.equal(typeof collection.revision, "string");

    const enableCollectionResponse = await fetch(`${bridge.url}/api/knowledge/collections`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        id: collection.id,
		expectedRevision: collection.revision,
        name: collection.name,
        description: "仅检索项目知识",
        agentEnabled: true,
        retrievalMode: "fast",
        toolName: "search_fixture_knowledge",
      }),
    });
    assert.equal(enableCollectionResponse.status, 200);
    const enabledCollection = await enableCollectionResponse.json();
    assert.equal(enabledCollection.collection.agentEnabled, true);
    assert.equal(enabledCollection.collection.toolName, "search_fixture_knowledge");
	const staleCollectionResponse = await fetch(`${bridge.url}/api/knowledge/collections`, {
	  method: "PUT",
	  headers,
	  body: JSON.stringify({
		id: collection.id,
		expectedRevision: collection.revision,
		name: "过期更新",
	  }),
	});
	assert.equal(staleCollectionResponse.status, 400);
	assert.equal((await staleCollectionResponse.json()).code, "ENGINE_RESOURCE_REVISION_CONFLICT");

    const documentResponse = await fetch(`${bridge.url}/api/knowledge/documents`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        collectionId: collection.id,
        title: "中文检索",
        content: "知识库使用轻量 SQLite 中文全文检索，不需要额外的搜索服务。",
      }),
    });
    assert.equal(documentResponse.status, 200);

    const searchResponse = await fetch(`${bridge.url}/api/knowledge/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "中文全文检索" }),
    });
    assert.equal(searchResponse.status, 200);
    const search = await searchResponse.json();
    assert.equal(search.results[0]?.title, "中文检索");

    const removedWorkflowResponse = await fetch(`${bridge.url}/api/workflows`, {
      headers,
    });
    assert.equal(removedWorkflowResponse.status, 404);

    const runtimeResponse = await fetch(
      `${bridge.url}/api/chat/11111111-1111-4111-8111-111111111111`,
      { headers },
    );
    assert.equal(runtimeResponse.status, 200);
    const runtimeState = await runtimeResponse.json();
    assert.equal(runtimeState.state.sessionId.length > 0, true);

    const engineYaml = await readFile(path.join(piDir, "engine.yaml"), "utf8");
    assert.match(engineYaml, /provider: fixture-local/u);
    assert.match(engineYaml, /id: fixture-model/u);
    assert.match(engineYaml, /fixture-local\/fixture-model/u);
  } finally {
    await bridge?.close();
    await rm(projectRoot, { recursive: true, force: true });
    delete process.env.PI_STUDIO_PROJECT_ROOT;
    delete process.env.PI_STUDIO_AGENT_DIR;
    delete process.env.PI_STUDIO_MODELS_PATH;
    delete process.env.PI_STUDIO_ENGINE_ROOT;
  }
});

test("standalone desktop mode exposes local knowledge and rejects removed workflow APIs", async (context) => {
  const studioRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const engineRoot = [
    process.env.PI_STUDIO_TEST_ENGINE_ROOT,
    path.join(path.dirname(studioRoot), "pi-mono"),
  ].find(
    (candidate) =>
      candidate && existsSync(path.join(candidate, "packages", "engine", "dist", "index.js")),
  );
  if (!engineRoot) {
    context.skip("A built Agent Engine fixture is not available in this checkout.");
    return;
  }

  const agentDir = await mkdtemp(path.join(os.tmpdir(), "pi-studio-standalone-tools-"));
  process.env.PI_STUDIO_AGENT_DIR = agentDir;
  process.env.PI_STUDIO_MODELS_PATH = path.join(agentDir, "models.json");
  process.env.PI_STUDIO_ENGINE_ROOT = engineRoot;
  delete process.env.PI_STUDIO_PROJECT_ROOT;

  const { startBridge } = await import(
    `../bridge/server.mjs?standalone-tools-test=${Date.now()}`
  );
  let bridge;
  try {
    bridge = await startBridge({
      host: "127.0.0.1",
      port: 0,
      token: "standalone-tools-token",
    });
    const headers = {
      "Content-Type": "application/json",
      "X-Pi-Bridge-Token": "standalone-tools-token",
    };
    const collectionResponse = await fetch(`${bridge.url}/api/knowledge/collections`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: "客户端手册",
        description: "桌面客户端本地知识",
        agentEnabled: true,
        toolName: "search_client_manual",
        retrievalMode: "fast",
      }),
    });
    assert.equal(collectionResponse.status, 200);
    const { collection } = await collectionResponse.json();
    assert.equal(collection.agentEnabled, true);

    const removedWorkflowResponse = await fetch(`${bridge.url}/api/workflows`, {
      headers,
    });
    assert.equal(removedWorkflowResponse.status, 404);
    assert.equal(existsSync(path.join(agentDir, "system-tools.db")), true);
    assert.equal(
      existsSync(path.join(agentDir, "pi-studio-engine", ".pi", "engine.yaml")),
      true,
    );
  } finally {
    await bridge?.close();
    await rm(agentDir, { recursive: true, force: true });
    delete process.env.PI_STUDIO_AGENT_DIR;
    delete process.env.PI_STUDIO_MODELS_PATH;
    delete process.env.PI_STUDIO_ENGINE_ROOT;
  }
});
