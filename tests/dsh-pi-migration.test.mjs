import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import SessionStore from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";
import { DatabaseSync } from "node:sqlite";
import { migratePiData } from "../migrations/pi-data.mjs";
import { renderImportedContext } from "../plugins/imported-context.mjs";

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test("Pi migration imports config, context, skills, attachments and a native DSH session", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "laobos-pi-migrate-"));
  const piHome = path.join(temporaryRoot, "pi");
  const dshHome = path.join(temporaryRoot, "dsh");
  const workspace = path.join(temporaryRoot, "workspace");
  const sessionId = "11111111-1111-4111-8111-111111111111";

  try {
    await mkdir(path.join(piHome, "sessions", "pi-studio"), { recursive: true });
    await mkdir(path.join(piHome, "skills", "hello"), { recursive: true });
    await mkdir(path.join(piHome, "pi-studio-attachments", sessionId), {
      recursive: true,
    });
    await mkdir(path.join(workspace, ".pi"), { recursive: true });
    await writeJson(path.join(piHome, "pi-studio.json"), {
      workspacePath: workspace,
      memoryEnabled: true,
      defaultProvider: "deepseek",
      defaultModel: "deepseek-v4-flash",
      thinkingLevel: "medium",
    });
    await writeJson(path.join(piHome, "models.json"), {
      providers: { openai: { baseUrl: "https://gateway.example/v1" } },
    });
    await writeJson(path.join(piHome, "auth.json"), {
      deepseek: { type: "api_key", key: "test-deepseek-key" },
      openai: { type: "api_key", key: "test-openai-key" },
    });
    await writeFile(path.join(piHome, "SYSTEM.md"), "请使用劳博士身份。\n");
    await writeFile(path.join(piHome, "MEMORY.md"), "用户偏好简洁回复。\n");
    await writeFile(path.join(workspace, ".pi", "SYSTEM.md"), "项目兼容指令。\n");
    await writeFile(
      path.join(piHome, "skills", "hello", "SKILL.md"),
      "---\nname: hello\ndescription: test\n---\n\nHello\n",
    );
    await writeFile(
      path.join(piHome, "pi-studio-attachments", sessionId, "note.txt"),
      "attachment",
    );
    const piSystemTools = new DatabaseSync(path.join(piHome, "system-tools.db"));
    piSystemTools.exec(
      "CREATE TABLE migration_probe (value TEXT NOT NULL); INSERT INTO migration_probe VALUES ('knowledge-and-workflows');",
    );
    piSystemTools.close();

    const records = [
      {
        type: "session",
        version: 3,
        id: sessionId,
        timestamp: "2026-08-01T00:00:00.000Z",
        cwd: workspace,
      },
      {
        type: "model_change",
        provider: "deepseek",
        modelId: "deepseek-v4-flash",
      },
      {
        type: "message",
        timestamp: "2026-08-01T00:00:01.000Z",
        message: { role: "user", content: [{ type: "text", text: "你好" }] },
      },
      {
        type: "message",
        timestamp: "2026-08-01T00:00:02.000Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "你好，我是劳博士。" }],
        },
      },
    ];
    await writeFile(
      path.join(piHome, "sessions", "pi-studio", "session.jsonl"),
      `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    );

    const result = await migratePiData({ piHome, dshHome });
    assert.equal(result.credentials.changed, 2);
    assert.equal(result.sessions.imported, 1);
    assert.equal(result.sessions.failed.length, 0);
    assert.equal(result.skills.copied, 1);
    assert.equal(result.systemTools.copied, true);

    const settings = parse(await readFile(path.join(dshHome, "settings.yaml"), "utf8"));
    assert.deepEqual(settings["agent-default-model"], {
      provider: "deepseek-official",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
    });
    assert.equal(
      settings["llm-pi-ai"].providers.openai.baseURL,
      "https://gateway.example/v1",
    );
    const credentials = parse(
      await readFile(path.join(dshHome, ".credentials.yaml"), "utf8"),
    );
    assert.equal(credentials.DEEPSEEK_API_KEY, "test-deepseek-key");
    if (process.platform !== "win32") {
      assert.equal((await stat(path.join(dshHome, ".credentials.yaml"))).mode & 0o077, 0);
    }
    assert.match(renderImportedContext(dshHome, workspace), /项目兼容指令/);
    assert.equal(
      await readFile(path.join(dshHome, "skills", "hello", "SKILL.md"), "utf8"),
      "---\nname: hello\ndescription: test\n---\n\nHello\n",
    );
    assert.equal(
      await readFile(
        path.join(dshHome, "imports", "pi", "attachments", sessionId, "note.txt"),
        "utf8",
      ),
      "attachment",
    );
    const migratedSystemTools = new DatabaseSync(
      path.join(dshHome, "data", "system-tools.db"),
      { readOnly: true },
    );
    assert.equal(
      migratedSystemTools.prepare("SELECT value FROM migration_probe").get().value,
      "knowledge-and-workflows",
    );
    migratedSystemTools.close();

    const ctx = new Context();
    new SessionStore(ctx);
    const persistence = new JsonlSessionPersistence(ctx, {
      root: path.join(dshHome, "sessions"),
      compression: "zstd",
    });
    const stored = await persistence.loadStored(sessionId);
    assert.equal(stored.meta.agentPreset, "standard");
    assert.equal(stored.events.at(-1).type, "turn/end");
    assert.equal(
      stored.events.find((event) => event.type === "user/message").data.content[0].text,
      "你好",
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
