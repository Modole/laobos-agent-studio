import { Context } from "@deepseek-ai/cordis";
import SessionStore, { Session } from "@deepseek-ai/dsh-session";
import JsonlSessionPersistence from "@deepseek-ai/dsh-session-persistence-jsonl";
import {
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from "@deepseek-ai/dsh-llm";
import { randomUUID } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDocument } from "yaml";
import { DatabaseSync } from "node:sqlite";

const PROVIDER_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  google: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  xai: "XAI_API_KEY",
  zai: "ZAI_API_KEY",
};

function safeCredentialReference(provider) {
  return (
    PROVIDER_ENV[provider] ||
    `${provider.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_API_KEY`
  );
}

function timestamp(value, fallback = Date.now()) {
  const parsed = typeof value === "number" ? value : Date.parse(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

async function readText(filePath, fallback = "") {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readJson(filePath, fallback) {
  const text = await readText(filePath);
  if (!text.trim()) return structuredClone(fallback);
  return JSON.parse(text);
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(filePath, content, mode = 0o600) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporaryPath, "wx", mode);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, filePath);
  if (process.platform !== "win32") await chmod(filePath, mode);
}

function parseYamlDocument(text) {
  const document = parseDocument(text || "{}\n", {
    prettyErrors: true,
    strict: true,
  });
  if (document.errors.length > 0) throw document.errors[0];
  const value = document.toJS();
  if (value !== null && (typeof value !== "object" || Array.isArray(value))) {
    throw new Error("DSH YAML 文档根节点必须是 mapping。");
  }
  return document;
}

function setIfAllowed(document, pathSegments, value, force) {
  if (!force && document.hasIn(pathSegments)) return false;
  document.setIn(pathSegments, value);
  return true;
}

function modelSelection(settings) {
  const provider = settings.defaultProvider || "deepseek";
  const model = settings.defaultModel || "deepseek-v4-flash";
  const officialDeepSeek = provider === "deepseek" && model.startsWith("deepseek-v4-");
  const mappedProvider = officialDeepSeek ? "deepseek-official" : provider;
  let reasoningEffort = settings.thinkingLevel;
  if (mappedProvider === "deepseek-official") {
    reasoningEffort = reasoningEffort === "off"
      ? "off"
      : reasoningEffort === "max" || reasoningEffort === "xhigh"
        ? "max"
        : "high";
  }
  return {
    provider: mappedProvider,
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };
}

function piProviderProfiles(modelsConfig, auth) {
  const providers = {};
  const ids = new Set([
    ...Object.keys(modelsConfig.providers || {}),
    ...Object.keys(auth || {}),
  ]);

  for (const id of ids) {
    const source = modelsConfig.providers?.[id] || {};
    const profile = {};
    if (auth[id]?.key) profile.apiKeyEnv = safeCredentialReference(id);
    if (source.baseUrl || source.baseURL) {
      profile.baseURL = source.baseUrl || source.baseURL;
    }
    if (source.api) profile.api = source.api;
    if (Array.isArray(source.models) && source.models.length > 0) {
      profile.models = source.models.map((model) => ({
        id: model.id,
        ...(model.name ? { name: model.name } : {}),
        ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
        ...(model.maxTokens ? { maxTokens: model.maxTokens } : {}),
      }));
    }
    if (Object.keys(profile).length > 0) providers[id] = profile;
  }

  return providers;
}

async function migrateSettings({ dshHome, settings, modelsConfig, auth, force }) {
  const settingsPath = path.join(dshHome, "settings.yaml");
  const document = parseYamlDocument(await readText(settingsPath));
  const selection = modelSelection(settings);
  const profiles = piProviderProfiles(modelsConfig, auth);
  let changed = 0;

  changed += Number(
    setIfAllowed(document, ["agent-default-model"], selection, force),
  );
  for (const [provider, profile] of Object.entries(profiles)) {
    changed += Number(
      setIfAllowed(
        document,
        ["llm-pi-ai", "providers", provider],
        profile,
        force,
      ),
    );
  }

  const deepSeekSource = modelsConfig.providers?.deepseek || {};
  const deepSeekConfig = {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    ...(deepSeekSource.baseUrl || deepSeekSource.baseURL
      ? { baseURL: deepSeekSource.baseUrl || deepSeekSource.baseURL }
      : {}),
  };
  if (auth.deepseek?.key || Object.keys(deepSeekSource).length > 0) {
    changed += Number(
      setIfAllowed(document, ["llm-deepseek"], deepSeekConfig, force),
    );
  }

  if (changed > 0) await atomicWrite(settingsPath, String(document));
  return { changed, selection };
}

async function migrateCredentials({ dshHome, auth, force }) {
  const credentialsPath = path.join(dshHome, ".credentials.yaml");
  const document = parseYamlDocument(await readText(credentialsPath));
  let changed = 0;

  for (const [provider, credential] of Object.entries(auth || {})) {
    if (credential?.type !== "api_key" || typeof credential.key !== "string") {
      continue;
    }
    const key = credential.key.trim();
    if (!key) continue;
    changed += Number(
      setIfAllowed(document, [safeCredentialReference(provider)], key, force),
    );
  }

  if (changed > 0) await atomicWrite(credentialsPath, String(document));
  return { changed };
}

async function copyIfPresent(source, destination, force) {
  if (!(await exists(source))) return false;
  if (!force && (await exists(destination))) return false;
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await cp(source, destination, { recursive: true, force });
  return true;
}

function escapeSqlString(value) {
  return value.replaceAll("'", "''");
}

async function migrateSystemToolsDatabase({ dshHome, piHome, force }) {
  const source = path.join(piHome, "system-tools.db");
  const destination = path.join(dshHome, "data", "system-tools.db");
  if (!(await exists(source))) return { copied: false, reason: "not-found" };
  if (!force && (await exists(destination))) {
    return { copied: false, reason: "already-exists" };
  }

  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporaryPath = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const database = new DatabaseSync(source, { readOnly: true });
  try {
    // VACUUM INTO snapshots the main database together with committed WAL data.
    // A plain file copy can silently omit recent knowledge/workflow changes.
    database.exec(`VACUUM INTO '${escapeSqlString(temporaryPath)}'`);
  } finally {
    database.close();
  }
  await rename(temporaryPath, destination);
  if (process.platform !== "win32") await chmod(destination, 0o600);
  return { copied: true };
}

function skillName(name) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || `pi-skill-${randomUUID().slice(0, 8)}`;
}

async function findSkillBundles(root, directory = root, depth = 0) {
  if (depth > 6 || !(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const skillFile = entries.find(
    (entry) =>
      entry.isFile() &&
      (entry.name === "SKILL.md" || entry.name === "SKILL.md.disabled"),
  );
  if (skillFile) {
    return [{
      kind: "bundle",
      path: directory,
      enabled: skillFile.name === "SKILL.md",
      name: skillName(path.basename(directory)),
    }];
  }

  const result = [];
  if (depth === 0) {
    for (const entry of entries) {
      if (!entry.isFile() || !/\.md(?:\.disabled)?$/.test(entry.name)) continue;
      result.push({
        kind: "file",
        path: path.join(directory, entry.name),
        enabled: entry.name.endsWith(".md"),
        name: skillName(entry.name.replace(/\.md(?:\.disabled)?$/, "")),
      });
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    result.push(
      ...(await findSkillBundles(root, path.join(directory, entry.name), depth + 1)),
    );
  }
  return result;
}

async function migrateSkills({ dshHome, piHome, workspace, force }) {
  const destinationRoot = path.join(dshHome, "skills");
  const roots = [
    path.join(piHome, "skills"),
    ...(workspace ? [path.join(workspace, ".pi", "skills")] : []),
  ];
  let copied = 0;
  let skipped = 0;

  for (const root of roots) {
    for (const candidate of await findSkillBundles(root)) {
      const suffix = candidate.enabled ? "" : ".disabled";
      const destination = candidate.kind === "bundle"
        ? path.join(destinationRoot, `${candidate.name}${suffix}`)
        : path.join(destinationRoot, `${candidate.name}.md${suffix}`);
      if (!force && (await exists(destination))) {
        skipped += 1;
        continue;
      }
      await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
      await cp(candidate.path, destination, { recursive: true, force });
      copied += 1;
    }
  }

  return { copied, skipped };
}

function contentBlocks(content, attachmentSource, attachmentDestination) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  const blocks = [];
  for (const block of content) {
    if (block.type === "text" && typeof block.text === "string") {
      blocks.push({
        type: "text",
        text: block.text.replaceAll(attachmentSource, attachmentDestination),
      });
    } else if (block.type === "thinking" && typeof block.thinking === "string") {
      blocks.push({ type: "reasoning", text: block.thinking });
    }
  }
  return blocks;
}

function toolCallBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter(
      (block) =>
        block.type === "toolCall" &&
        typeof block.id === "string" &&
        typeof block.name === "string",
    )
    .map((block) => ({
      type: "tool-call",
      id: block.id,
      name: block.name,
      arguments:
        typeof block.arguments === "string"
          ? block.arguments
          : JSON.stringify(block.arguments || {}),
    }));
}

function groupPiTurns(records) {
  const turns = [];
  let current;
  let provider = "deepseek-official";
  let model = "deepseek-v4-flash";

  for (const record of records) {
    if (record.type === "model_change") {
      provider = record.provider === "deepseek" && String(record.modelId).startsWith("deepseek-v4-")
        ? "deepseek-official"
        : record.provider || provider;
      model = record.modelId || model;
      continue;
    }
    if (record.type !== "message") continue;
    const role = record.message?.role;
    if (role === "user") {
      current = { user: record, replies: [] };
      turns.push(current);
    } else if (current && (role === "assistant" || role === "toolResult")) {
      current.replies.push({ record, provider, model });
    }
  }
  return turns;
}

function convertPiSession(records, options) {
  const sessionRecord = records.find((record) => record.type === "session");
  if (!sessionRecord?.id) throw new Error("Pi 会话缺少 session id。");
  const createdAt = timestamp(sessionRecord.timestamp);
  const cwd = path.resolve(sessionRecord.cwd || options.workspace);
  const events = [];

  function append(type, data, time, surface) {
    events.push({
      type,
      seq: events.length,
      time: timestamp(time, createdAt + events.length),
      data,
      ...(surface || {}),
    });
    return events.at(-1);
  }

  append("permission/preset", { preset: "workspace-write" }, createdAt);
  append("sandbox/mode", { mode: "workspace-write" }, createdAt);
  append("approval/policy", { policy: "ask" }, createdAt);

  let turnNumber = 0;
  for (const turn of groupPiTurns(records)) {
    turnNumber += 1;
    append("turn/start", { turn: turnNumber }, turn.user.timestamp);
    let stepNumber = 1;
    let stepOpen = false;
    let pendingCalls = new Map();

    function startStep(time) {
      if (stepOpen) return;
      append(
        "step/start",
        { turn: turnNumber, step: stepNumber },
        time,
      );
      stepOpen = true;
    }

    function closeStep(time) {
      if (!stepOpen) return;
      for (const [callId, call] of pendingCalls) {
        const message = createToolResultMessage({
          callId,
          content: [{ type: "text", text: "Pi 导入：原会话未保存该工具结果。" }],
          isError: true,
        });
        append(
          "tool/result",
          {
            turn: turnNumber,
            step: stepNumber,
            message,
            error: { name: "PiImportError", code: "PI_RESULT_MISSING" },
          },
          time,
          { surfaceOp: "append", sourceEventSeqs: [call.seq] },
        );
      }
      pendingCalls = new Map();
      append("step/end", { turn: turnNumber, step: stepNumber }, time);
      stepOpen = false;
      stepNumber += 1;
    }

    startStep(turn.user.timestamp);
    append(
      "user/message",
      createUserMessage({
        content: contentBlocks(
          turn.user.message?.content,
          options.attachmentSource,
          options.attachmentDestination,
        ),
        source: { kind: "user" },
      }),
      turn.user.timestamp,
      { surfaceOp: "append" },
    );

    for (const reply of turn.replies) {
      const { record } = reply;
      if (record.message?.role === "assistant") {
        if (stepOpen && pendingCalls.size === 0 && events.at(-1)?.type === "assistant/message") {
          closeStep(record.timestamp);
        }
        startStep(record.timestamp);
        const blocks = [
          ...contentBlocks(
            record.message.content,
            options.attachmentSource,
            options.attachmentDestination,
          ),
          ...toolCallBlocks(record.message.content),
        ];
        if (blocks.length === 0) continue;
        const message = createAssistantMessage({
          content: blocks,
          source: { provider: reply.provider, model: reply.model },
        });
        append(
          "assistant/message",
          { turn: turnNumber, step: stepNumber, message },
          record.timestamp,
          { surfaceOp: "append", sourceEventSeqs: [] },
        );
        for (const block of blocks.filter((block) => block.type === "tool-call")) {
          const call = append(
            "tool/call",
            {
              turn: turnNumber,
              step: stepNumber,
              callId: block.id,
              name: block.name,
              arguments: block.arguments,
            },
            record.timestamp,
          );
          pendingCalls.set(block.id, call);
        }
        if (pendingCalls.size === 0) closeStep(record.timestamp);
      } else if (record.message?.role === "toolResult") {
        startStep(record.timestamp || record.message.timestamp);
        const callId = record.message.toolCallId;
        const call = pendingCalls.get(callId);
        if (!call) continue;
        const message = createToolResultMessage({
          callId,
          content: contentBlocks(
            record.message.content,
            options.attachmentSource,
            options.attachmentDestination,
          ),
          isError: record.message.isError === true,
        });
        append(
          "tool/result",
          {
            turn: turnNumber,
            step: stepNumber,
            message,
            ...(record.message.isError
              ? { error: { name: "PiToolError", code: "PI_TOOL_ERROR" } }
              : {}),
          },
          record.timestamp || record.message.timestamp,
          { surfaceOp: "append", sourceEventSeqs: [call.seq] },
        );
        pendingCalls.delete(callId);
      }
    }
    closeStep(turn.user.timestamp);
    append(
      "turn/end",
      { turn: turnNumber, reason: { kind: "completed" } },
      turn.replies.at(-1)?.record.timestamp || turn.user.timestamp,
    );
  }

  const header = {
    version: 0,
    id: sessionRecord.id,
    createdAt,
    cwd,
    delegationDepth: 0,
    agentPreset: "standard",
  };
  Session.create(sessionRecord.id, events, header);
  return { events, header };
}

async function migrateSessions({ dshHome, piHome, workspace }) {
  const sourceDirectory = path.join(piHome, "sessions", "pi-studio");
  if (!(await exists(sourceDirectory))) return { imported: 0, skipped: 0, failed: [] };
  const files = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".jsonl"));
  const ctx = new Context();
  new SessionStore(ctx);
  const persistence = new JsonlSessionPersistence(ctx, {
    root: path.join(dshHome, "sessions"),
    compression: "zstd",
  });
  const attachmentSource = path.join(piHome, "pi-studio-attachments");
  const attachmentDestination = path.join(dshHome, "imports", "pi", "attachments");
  let imported = 0;
  let skipped = 0;
  const failed = [];

  for (const file of files) {
    try {
      const records = (await readFile(path.join(sourceDirectory, file), "utf8"))
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      const converted = convertPiSession(records, {
        attachmentDestination,
        attachmentSource,
        workspace,
      });
      if (await persistence.loadStored(converted.header.id)) {
        skipped += 1;
        continue;
      }
      await persistence.create(converted.header);
      await persistence.append(converted.header.id, converted.events);
      imported += 1;
    } catch (error) {
      failed.push({ file, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { imported, skipped, failed };
}

export async function inspectPiData(piHome = path.join(os.homedir(), ".pi", "agent")) {
  const settings = await readJson(path.join(piHome, "pi-studio.json"), {});
  const sessionsDirectory = path.join(piHome, "sessions", "pi-studio");
  const sessions = (await exists(sessionsDirectory))
    ? (await readdir(sessionsDirectory)).filter((name) => name.endsWith(".jsonl"))
    : [];
  const auth = await readJson(path.join(piHome, "auth.json"), {});
  return {
    found: await exists(piHome),
    piHome,
    workspace: settings.workspacePath || "",
    providers: Object.keys(auth).length,
    sessions: sessions.length,
    hasSystemPrompt: await exists(path.join(piHome, "SYSTEM.md")),
    hasMemory: await exists(path.join(piHome, "MEMORY.md")),
    hasAttachments: await exists(path.join(piHome, "pi-studio-attachments")),
    hasSystemTools: await exists(path.join(piHome, "system-tools.db")),
  };
}

export async function migratePiData({
  piHome = path.join(os.homedir(), ".pi", "agent"),
  dshHome,
  force = false,
}) {
  if (!dshHome) throw new Error("migratePiData 需要 dshHome。");
  if (!(await exists(piHome))) throw new Error(`找不到 Pi 数据目录：${piHome}`);
  await mkdir(dshHome, { recursive: true, mode: 0o700 });

  const settings = await readJson(path.join(piHome, "pi-studio.json"), {});
  const modelsConfig = await readJson(path.join(piHome, "models.json"), {
    providers: {},
  });
  const auth = await readJson(path.join(piHome, "auth.json"), {});
  const workspace = settings.workspacePath || process.cwd();
  const importRoot = path.join(dshHome, "imports", "pi");
  await mkdir(importRoot, { recursive: true, mode: 0o700 });

  const [settingsResult, credentialsResult, skillsResult] = await Promise.all([
    migrateSettings({ dshHome, settings, modelsConfig, auth, force }),
    migrateCredentials({ dshHome, auth, force }),
    migrateSkills({ dshHome, piHome, workspace, force }),
  ]);
  const promptCopied = await copyIfPresent(
    path.join(piHome, "SYSTEM.md"),
    path.join(importRoot, "SYSTEM.md"),
    force,
  );
  const memoryCopied = await copyIfPresent(
    path.join(piHome, "MEMORY.md"),
    path.join(importRoot, "MEMORY.md"),
    force,
  );
  const attachmentsCopied = await copyIfPresent(
    path.join(piHome, "pi-studio-attachments"),
    path.join(importRoot, "attachments"),
    force,
  );
  const systemTools = await migrateSystemToolsDatabase({
    dshHome,
    piHome,
    force,
  });
  const sessionsResult = await migrateSessions({ dshHome, piHome, workspace });
  const result = {
    version: 1,
    migratedAt: new Date().toISOString(),
    source: piHome,
    workspace,
    memoryEnabled: settings.memoryEnabled !== false,
    settings: settingsResult,
    credentials: credentialsResult,
    prompts: { system: promptCopied, memory: memoryCopied },
    skills: skillsResult,
    attachments: { copied: attachmentsCopied },
    systemTools,
    sessions: sessionsResult,
  };
  await atomicWrite(
    path.join(importRoot, "manifest.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}
