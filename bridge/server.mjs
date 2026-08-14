#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BRIDGE_VERSION = "0.1.0";
const HOST = process.env.PI_STUDIO_HOST || "127.0.0.1";
const PORT = Number(process.env.PI_STUDIO_PORT || 31415);
const studioSourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectBound = Boolean(process.env.PI_STUDIO_PROJECT_ROOT);
const projectRoot = path.resolve(
  process.env.PI_STUDIO_PROJECT_ROOT || path.dirname(studioSourceRoot),
);
const defaultWorkspace = projectRoot;
const engineRoot = path.resolve(
  process.env.PI_STUDIO_ENGINE_ROOT ||
    path.join(projectRoot, "services", "pi-agent-engine"),
);
const engineModulePath = path.join(
  engineRoot,
  "packages",
  "engine",
  "dist",
  "index.js",
);
const engineSystemToolsExtensionPath = path.join(
  engineRoot,
  "packages",
  "engine",
  "dist",
  "rpc-extension.js",
);
const canShutdownStudio = process.env.PI_STUDIO_ALLOW_SHUTDOWN === "1";
const agentDir =
  process.env.PI_STUDIO_AGENT_DIR ||
  process.env.PI_CODING_AGENT_DIR ||
  path.join(os.homedir(), ".pi", "agent");
const studioSettingsPath = path.join(agentDir, "pi-studio.json");
const authPath = path.join(agentDir, "auth.json");
const modelsPath = path.resolve(
  process.env.PI_STUDIO_MODELS_PATH || path.join(agentDir, "models.json"),
);
const runtimeModelsPath = path.join(agentDir, "models.json");
const globalPromptPath = path.join(agentDir, "SYSTEM.md");
const memoryPath = path.join(agentDir, "MEMORY.md");
const tokenPath = path.join(agentDir, "pi-studio-token");
const sessionDir = path.join(agentDir, "sessions", "pi-studio");
const attachmentRoot = path.join(agentDir, "pi-studio-attachments");
const standaloneEngineRoot = path.join(agentDir, "pi-studio-engine");
const embeddedEngineProjectRoot = projectBound ? projectRoot : standaloneEngineRoot;
const engineConfigPath = path.join(
  embeddedEngineProjectRoot,
  ".pi",
  "engine.yaml",
);
const runtimeBySession = new Map();
let catalogRuntime = null;

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_REQUEST_BYTES =
  Math.ceil((MAX_ATTACHMENT_TOTAL_BYTES * 4) / 3) + 2 * 1024 * 1024;
const MAX_INLINE_ATTACHMENT_CHARS = 120_000;
const supportedInlineImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const localMarkdownImageTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);
const MAX_LOCAL_MARKDOWN_IMAGE_BYTES = 25 * 1024 * 1024;
const textAttachmentExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".css",
  ".csv",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".md",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const providerCatalog = [
  {
    id: "openai",
    name: "OpenAI",
    env: "OPENAI_API_KEY",
    accent: "#111111",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    env: "ANTHROPIC_API_KEY",
    accent: "#d97757",
    defaultBaseUrl: "https://api.anthropic.com",
  },
  {
    id: "google",
    name: "Google Gemini",
    env: "GEMINI_API_KEY",
    accent: "#4285f4",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    env: "OPENROUTER_API_KEY",
    accent: "#6f5cff",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    env: "DEEPSEEK_API_KEY",
    accent: "#4d6bfe",
    defaultBaseUrl: "https://api.deepseek.com",
  },
  {
    id: "xai",
    name: "xAI",
    env: "XAI_API_KEY",
    accent: "#171717",
    defaultBaseUrl: "https://api.x.ai/v1",
  },
  {
    id: "groq",
    name: "Groq",
    env: "GROQ_API_KEY",
    accent: "#f55036",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "mistral",
    name: "Mistral",
    env: "MISTRAL_API_KEY",
    accent: "#f6a019",
    defaultBaseUrl: "https://api.mistral.ai",
  },
  {
    id: "zai",
    name: "ZAI",
    env: "ZAI_API_KEY",
    accent: "#5a63f2",
    defaultBaseUrl: "https://api.z.ai/api/coding/paas/v4",
  },
  {
    id: "kimi-coding",
    name: "Kimi Coding",
    env: "KIMI_API_KEY",
    accent: "#202d70",
    defaultBaseUrl: "https://api.kimi.com/coding",
  },
  {
    id: "minimax",
    name: "MiniMax",
    env: "MINIMAX_API_KEY",
    accent: "#ff5b42",
    defaultBaseUrl: "https://api.minimax.io/anthropic",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    env: "CEREBRAS_API_KEY",
    accent: "#ff4d00",
    defaultBaseUrl: "https://api.cerebras.ai/v1",
  },
];
const builtInProviderIds = new Set(providerCatalog.map((provider) => provider.id));
const supportedCustomApis = new Set([
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
]);
const customProviderAccents = [
  "#5f63d8",
  "#0f8f7d",
  "#d06c3f",
  "#8b5bb5",
  "#3578b8",
  "#a26b25",
];

const defaultSettings = {
  workspacePath: defaultWorkspace,
  projectTrust: Boolean(process.env.PI_STUDIO_PROJECT_ROOT),
  memoryEnabled: true,
  defaultProvider: "",
  defaultModel: "",
  thinkingLevel: "medium",
  allowedTools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
  customProviderIds: [],
};

function detectEngine() {
  const explicit = process.env.PI_STUDIO_PI_BIN;
  if (explicit) {
    return { command: explicit, source: "PI_STUDIO_PI_BIN" };
  }

  const candidates = [
    path.join(projectRoot, "services", "pi-agent-engine", "pi-test.sh"),
    path.join(path.dirname(studioSourceRoot), "pi-agent-engine", "pi-test.sh"),
    path.join(path.dirname(studioSourceRoot), "pi-mono", "pi-test.sh"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { command: candidate, source: "workspace" };
    }
  }

  return { command: "pi", source: "PATH" };
}

const engine = detectEngine();

async function ensureAgentDir() {
  await mkdir(agentDir, { recursive: true, mode: 0o700 });
  await mkdir(sessionDir, { recursive: true, mode: 0o700 });
  await mkdir(attachmentRoot, { recursive: true, mode: 0o700 });
  if (!projectBound && existsSync(engineModulePath)) {
    const standalonePiDir = path.join(standaloneEngineRoot, ".pi");
    await mkdir(path.join(standalonePiDir, "state", "sessions"), {
      recursive: true,
      mode: 0o700,
    });
    if (!existsSync(engineConfigPath)) {
      await atomicWrite(
        engineConfigPath,
        `version: 1
engine:
  id: "pi-studio-client"
  displayName: "劳博士"
  description: "Local consumer desktop Agent tools."
project:
  root: "../.."
  trust: "never"
agent:
  systemPrompt: {}
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
  file: "${modelsPath.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"
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
      );
    }
  }
}

async function syncRuntimeModels() {
  if (modelsPath === runtimeModelsPath) return;
  try {
    await atomicWriteBuffer(runtimeModelsPath, await readFile(modelsPath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
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
  const raw = await readText(filePath, "");
  if (!raw.trim()) return structuredClone(fallback);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadModelsConfig({ strict = false } = {}) {
  const raw = await readText(modelsPath, "");
  let config = { providers: {} };
  if (raw.trim()) {
    try {
      config = JSON.parse(raw);
    } catch {
      if (strict) {
        throw new HttpError(
          409,
          "现有 models.json 不是有效 JSON，请修复后再管理第三方模型。",
        );
      }
    }
  }
  return {
    ...config,
    providers: isRecord(config.providers) ? config.providers : {},
  };
}

function customProviderAccent(id) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return customProviderAccents[hash % customProviderAccents.length];
}

function customProviderSummaries(modelsConfig, auth, managedProviderIds) {
  const managed = new Set(managedProviderIds);
  return Object.entries(modelsConfig.providers)
    .filter(
      ([id, provider]) =>
        managed.has(id) &&
        !builtInProviderIds.has(id) &&
        isRecord(provider) &&
        Array.isArray(provider.models),
    )
    .map(([id, provider]) => {
      const credential = auth[id];
      const inlineKey = typeof provider.apiKey === "string" && provider.apiKey.trim();
      return {
        id,
        name:
          typeof provider.name === "string" && provider.name.trim()
            ? provider.name.trim()
            : id,
        env: "自定义端点",
        accent: customProviderAccent(id),
        configured: Boolean(credential) || Boolean(inlineKey),
        source: credential ? "auth.json" : inlineKey ? "models.json" : null,
        credentialType: credential?.type || (inlineKey ? "api_key" : null),
        custom: true,
        baseUrl: typeof provider.baseUrl === "string" ? provider.baseUrl : "",
        api: typeof provider.api === "string" ? provider.api : "",
        models: provider.models
          .filter((model) => isRecord(model) && typeof model.id === "string")
          .map((model) => ({
            id: model.id,
            name: typeof model.name === "string" ? model.name : model.id,
            reasoning: model.reasoning === true,
            vision: Array.isArray(model.input) && model.input.includes("image"),
            contextWindow:
              Number.isFinite(model.contextWindow) && model.contextWindow > 0
                ? model.contextWindow
                : 128000,
            maxTokens:
              Number.isFinite(model.maxTokens) && model.maxTokens > 0
                ? model.maxTokens
                : 16384,
          })),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function atomicWrite(filePath, content, mode = 0o600) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", mode });
  await chmod(temporaryPath, mode);
  await rename(temporaryPath, filePath);
}

async function atomicWriteBuffer(filePath, content, mode = 0o600) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content, { mode });
  await chmod(temporaryPath, mode);
  await rename(temporaryPath, filePath);
}

async function writeJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function safeFileName(value) {
  const base = path.basename(String(value || "attachment"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (base || "attachment").slice(0, 180);
}

function safeStoredExtension(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : "";
}

function attachmentBatchDirectory(sessionId, batchId) {
  return path.join(attachmentRoot, sessionId, batchId);
}

function publicAttachment(attachment, sessionId, batchId) {
  return {
    id: attachment.id,
    batchId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    downloadPath: `/api/chat/${sessionId}/attachments/${batchId}/${attachment.id}`,
  };
}

function isTextAttachment(attachment) {
  return (
    attachment.mimeType.startsWith("text/") ||
    [
      "application/json",
      "application/ld+json",
      "application/sql",
      "application/xml",
      "application/x-httpd-php",
      "application/x-sh",
      "application/yaml",
    ].includes(attachment.mimeType) ||
    textAttachmentExtensions.has(path.extname(attachment.name).toLowerCase())
  );
}

async function saveAttachmentBatch(sessionId, input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new HttpError(400, "请选择至少一个附件。");
  }
  if (input.length > MAX_ATTACHMENT_COUNT) {
    throw new HttpError(400, `每次最多添加 ${MAX_ATTACHMENT_COUNT} 个附件。`);
  }

  const normalized = [];
  const attachmentIds = new Set();
  let totalBytes = 0;
  for (const candidate of input) {
    if (!isRecord(candidate)) throw new HttpError(400, "附件信息无效。");
    const encoded = typeof candidate.data === "string" ? candidate.data : "";
    if (
      !encoded ||
      encoded.length > Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
    ) {
      throw new HttpError(400, "附件内容不是有效的 Base64 数据。");
    }

    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
      throw new HttpError(400, `单个附件不能超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB。`);
    }
    if (Number(candidate.size) !== bytes.length) {
      throw new HttpError(400, "附件大小校验失败，请重新选择。");
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
      throw new HttpError(
        400,
        `单次附件总大小不能超过 ${MAX_ATTACHMENT_TOTAL_BYTES / 1024 / 1024} MB。`,
      );
    }

    const requestedId = String(candidate.id || "");
    let id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestedId,
    )
      ? requestedId.toLowerCase()
      : crypto.randomUUID();
    if (attachmentIds.has(id)) id = crypto.randomUUID();
    attachmentIds.add(id);
    const name = safeFileName(candidate.name);
    const mimeType = String(candidate.mimeType || "application/octet-stream")
      .split(";")[0]
      .trim()
      .toLowerCase()
      .slice(0, 120);
    const kind = supportedInlineImageTypes.has(mimeType) ? "image" : "file";
    normalized.push({
      id,
      name,
      mimeType: mimeType || "application/octet-stream",
      size: bytes.length,
      kind,
      storedName: `${id}${safeStoredExtension(name)}`,
      bytes,
    });
  }

  const batchId = crypto.randomUUID();
  const batchDirectory = attachmentBatchDirectory(sessionId, batchId);
  await mkdir(batchDirectory, { recursive: true, mode: 0o700 });
  try {
    const attachments = normalized.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
      storedName: attachment.storedName,
    }));
    await Promise.all(
      normalized.map((attachment) =>
        atomicWriteBuffer(
          path.join(batchDirectory, attachment.storedName),
          attachment.bytes,
        ),
      ),
    );
    const metadata = {
      version: 1,
      id: batchId,
      sessionId,
      createdAt: new Date().toISOString(),
      attachments,
    };
    await writeJson(path.join(batchDirectory, "meta.json"), metadata);
    return metadata;
  } catch (error) {
    await rm(batchDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function readAttachmentBatch(sessionId, batchId) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(batchId || ""),
    )
  ) {
    return null;
  }
  const metadata = await readJson(
    path.join(attachmentBatchDirectory(sessionId, batchId), "meta.json"),
    null,
  );
  if (
    !isRecord(metadata) ||
    metadata.sessionId !== sessionId ||
    metadata.id !== batchId ||
    !Array.isArray(metadata.attachments)
  ) {
    return null;
  }
  return metadata;
}

function attachmentContextMatch(message) {
  return message.match(
    /\n\n<pi-studio-attachments batch="([0-9a-f-]{36})">[\s\S]*?<\/pi-studio-attachments>\s*$/i,
  );
}

function messageWithoutAttachmentContext(message) {
  const match = attachmentContextMatch(message);
  return match ? message.slice(0, match.index).trim() : message;
}

async function buildAttachmentPrompt(message, sessionId, batch) {
  const lines = [];
  const images = [];
  const inlineSections = [];
  let inlineCharacters = 0;

  for (const attachment of batch.attachments) {
    const filePath = path.join(
      attachmentBatchDirectory(sessionId, batch.id),
      attachment.storedName,
    );
    lines.push(
      `- ${JSON.stringify(attachment.name)} (${attachment.mimeType}, ${attachment.size} bytes): ${filePath}`,
    );
    const bytes = await readFile(filePath);
    if (attachment.kind === "image") {
      images.push({
        type: "image",
        data: bytes.toString("base64"),
        mimeType: attachment.mimeType,
      });
      continue;
    }
    if (
      isTextAttachment(attachment) &&
      inlineCharacters < MAX_INLINE_ATTACHMENT_CHARS
    ) {
      const text = bytes
        .toString("utf8")
        .slice(0, MAX_INLINE_ATTACHMENT_CHARS - inlineCharacters);
      inlineCharacters += text.length;
      inlineSections.push(
        `\n<pi-studio-attachment-content name=${JSON.stringify(attachment.name)}>\n${text}\n</pi-studio-attachment-content>`,
      );
    }
  }

  const prompt = message || "请查看并处理这些附件。";
  return {
    message: `${prompt}\n\n<pi-studio-attachments batch="${batch.id}">\nThe user attached these local files. Use the image inputs for images and the listed paths or inline content for other files.\n${lines.join("\n")}${inlineSections.join("")}\n</pi-studio-attachments>`,
    images,
  };
}

async function messageWithAttachments(message, sessionId) {
  const text = getContentText(message.content);
  if (message.role !== "user") return { ...message, text };
  const match = attachmentContextMatch(text);
  if (!match) return { ...message, text };
  const batch = await readAttachmentBatch(sessionId, match[1]);
  return {
    ...message,
    text: messageWithoutAttachmentContext(text),
    attachments: batch
      ? batch.attachments.map((attachment) =>
          publicAttachment(attachment, sessionId, batch.id),
        )
      : [],
  };
}

async function loadSettings() {
  const saved = await readJson(studioSettingsPath, {});
  return {
    ...defaultSettings,
    ...saved,
    allowedTools: Array.isArray(saved.allowedTools)
      ? saved.allowedTools
      : defaultSettings.allowedTools,
    customProviderIds: Array.isArray(saved.customProviderIds)
      ? saved.customProviderIds.filter((id) => typeof id === "string")
      : defaultSettings.customProviderIds,
  };
}

async function getBridgeToken() {
  if (process.env.PI_STUDIO_TOKEN) return process.env.PI_STUDIO_TOKEN;
  const existing = (await readText(tokenPath, "")).trim();
  if (existing) return existing;
  const token = crypto.randomBytes(24).toString("base64url");
  await atomicWrite(tokenPath, `${token}\n`);
  return token;
}

function projectPromptPath(workspacePath) {
  return path.join(workspacePath, ".pi", "SYSTEM.md");
}

function skillRoots(settings) {
  return [
    { scope: "global", root: path.join(agentDir, "skills") },
    { scope: "project", root: path.join(settings.workspacePath, ".pi", "skills") },
  ];
}

function parseSkillDocument(raw, fallbackName) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const metadata = {};
  let instructions = raw;

  if (match) {
    instructions = raw.slice(match[0].length);
    for (const line of match[1].split("\n")) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      value = value.replace(/^['"]|['"]$/g, "");
      metadata[key] = value;
    }
  }

  return {
    name: metadata.name || fallbackName,
    description: metadata.description || "No description",
    instructions: instructions.trim(),
  };
}

async function collectSkills(settings) {
  const skills = [];

  async function visit(root, dir, scope, depth = 0) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    const skillFile = entries.find(
      (entry) =>
        entry.isFile() &&
        (entry.name === "SKILL.md" || entry.name === "SKILL.md.disabled"),
    );

    if (skillFile) {
      const filePath = path.join(dir, skillFile.name);
      const raw = await readText(filePath);
      const parsed = parseSkillDocument(raw, path.basename(dir));
      skills.push({
        ...parsed,
        id: crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 12),
        scope,
        path: filePath,
        relativePath: path.relative(root, filePath),
        enabled: skillFile.name === "SKILL.md",
      });
      return;
    }

    if (depth === 0) {
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const enabled = entry.name.endsWith(".md");
        const disabled = entry.name.endsWith(".md.disabled");
        if (!enabled && !disabled) continue;
        const filePath = path.join(dir, entry.name);
        const raw = await readText(filePath);
        const fallbackName = entry.name.replace(/\.md(?:\.disabled)?$/, "");
        const parsed = parseSkillDocument(raw, fallbackName);
        skills.push({
          ...parsed,
          id: crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 12),
          scope,
          path: filePath,
          relativePath: path.relative(root, filePath),
          enabled,
        });
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await visit(root, path.join(dir, entry.name), scope, depth + 1);
    }
  }

  for (const { scope, root } of skillRoots(settings)) {
    await visit(root, root, scope);
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function listStudioSessions() {
  let entries;
  try {
    entries = await readdir(sessionDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const sessions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map(async (entry) => {
        const filePath = path.join(sessionDir, entry.name);
        const [raw, fileStat] = await Promise.all([readText(filePath), stat(filePath)]);
        let id = "";
        let title = "";
        let firstUserMessage = "";
        let updatedAt = fileStat.mtimeMs;

        for (const line of raw.split("\n")) {
          if (!line.trim()) continue;
          try {
            const record = JSON.parse(line);
            if (record.type === "session" && typeof record.id === "string") {
              id = record.id;
            }
            if (
              record.type === "session_info" &&
              typeof record.name === "string" &&
              record.name.trim()
            ) {
              title = record.name.trim();
            }
            if (
              !firstUserMessage &&
              record.type === "message" &&
              record.message?.role === "user"
            ) {
              firstUserMessage = messageWithoutAttachmentContext(
                getContentText(record.message.content),
              ).trim();
            }
            const timestamp = Date.parse(record.timestamp);
            if (Number.isFinite(timestamp)) updatedAt = Math.max(updatedAt, timestamp);
          } catch {
            // Ignore an incomplete trailing line while Pi is writing the session.
          }
        }

        if (!id) return null;
        const fallbackTitle = firstUserMessage.replace(/\s+/g, " ").slice(0, 40);
        return {
          id,
          title: title || fallbackTitle || "劳博士会话",
          updatedAt,
        };
      }),
  );

  return sessions
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function assertSkillName(name) {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name) || name.includes("--")) {
    throw new HttpError(
      400,
      "Skill 名称只能包含小写字母、数字和单个连字符，长度为 1–64。",
    );
  }
}

function skillMarkdown(name, description, instructions) {
  const safeDescription = String(description || "").replace(/\r?\n/g, " ").trim();
  return `---\nname: ${name}\ndescription: ${safeDescription}\n---\n\n${String(instructions || "").trim()}\n`;
}

function assertPathInRoots(candidate, settings) {
  const resolved = path.resolve(candidate);
  const root = skillRoots(settings)
    .map(({ root: item }) => path.resolve(item))
    .find((item) => resolved === item || resolved.startsWith(`${item}${path.sep}`));
  if (!root) throw new HttpError(403, "Skill 路径不在允许管理的目录中。");
  return resolved;
}

async function readLocalMarkdownImage(candidate) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) {
    throw new HttpError(400, "图片路径必须是有效的绝对路径。");
  }
  const filePath = path.resolve(candidate);
  const mimeType = localMarkdownImageTypes.get(path.extname(filePath).toLowerCase());
  if (!mimeType) {
    throw new HttpError(415, "仅支持 PNG、JPEG、GIF、WebP 和 AVIF 图片。");
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new HttpError(404, "找不到本机图片。");
  }
  if (!fileStat.isFile()) throw new HttpError(400, "图片路径不是文件。");
  if (fileStat.size > MAX_LOCAL_MARKDOWN_IMAGE_BYTES) {
    throw new HttpError(413, "本机图片不能超过 25 MB。");
  }
  return { bytes: await readFile(filePath), mimeType };
}

function sanitizeSettings(input, current) {
  const next = { ...current };
  if (typeof input.workspacePath === "string" && input.workspacePath.trim()) {
    next.workspacePath = path.resolve(input.workspacePath.trim());
  }
  if (typeof input.projectTrust === "boolean") next.projectTrust = input.projectTrust;
  if (typeof input.memoryEnabled === "boolean") next.memoryEnabled = input.memoryEnabled;
  if (typeof input.defaultProvider === "string") next.defaultProvider = input.defaultProvider.trim();
  if (typeof input.defaultModel === "string") next.defaultModel = input.defaultModel.trim();
  if (
    typeof input.thinkingLevel === "string" &&
    ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
      input.thinkingLevel,
    )
  ) {
    next.thinkingLevel = input.thinkingLevel;
  }
  if (Array.isArray(input.allowedTools)) {
    next.allowedTools = input.allowedTools.filter(
      (tool) => typeof tool === "string" && /^[a-zA-Z0-9_-]+$/.test(tool),
    );
  }
  return next;
}

function publicEngineReadiness(readiness) {
  return {
    managed: true,
    available: true,
    ready: readiness.ready,
    state: readiness.ready ? "ready" : "needs-configuration",
    defaultModel: readiness.defaultModel || null,
    checks: readiness.checks.map((check) => ({
      id: check.id,
      ready: check.ready,
      ...(check.code ? { code: check.code } : {}),
      message: check.message,
    })),
  };
}

async function withEmbeddedEngine(callback) {
  if (!existsSync(engineConfigPath) || !existsSync(engineModulePath)) {
    throw new HttpError(
      409,
      "客户端缺少可用的 Agent Engine，请先构建相邻的 pi-mono Engine。",
    );
  }
  const engineModule = await import(pathToFileURL(engineModulePath).href);
  if (typeof engineModule.createAgentEngine !== "function") {
    throw new HttpError(409, "Agent Engine 构建产物不完整，请重新构建引擎。");
  }
  const embeddedEngine = await engineModule.createAgentEngine({
    cwd: embeddedEngineProjectRoot,
    configPath: engineConfigPath,
    agentDir,
  });
  try {
    return await callback(embeddedEngine);
  } finally {
    await embeddedEngine.dispose();
  }
}

async function withSystemToolsEngine(callback) {
  try {
    return await withEmbeddedEngine(callback);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const code = typeof error?.code === "string" ? error.code : "";
    if (code.includes("NOT_FOUND")) {
      throw new HttpError(404, error.message, code);
    }
    if (code.includes("EXISTS") || code.includes("RESERVED")) {
      throw new HttpError(409, error.message, code);
    }
    if (code.startsWith("ENGINE_")) {
      throw new HttpError(400, error.message, code);
    }
    throw error;
  }
}

async function inspectEmbeddedEngine() {
  try {
    return await withEmbeddedEngine(async (embeddedEngine) =>
      publicEngineReadiness(await embeddedEngine.getReadiness()),
    );
  } catch (error) {
    return {
      managed: true,
      available: false,
      ready: false,
      state: "unavailable",
      defaultModel: null,
      checks: [],
      message:
        error instanceof HttpError
          ? error.message
          : "Agent Engine 配置暂时无法读取，请检查引擎构建和 .pi/engine.yaml。",
    };
  }
}

async function listSystemToolNames() {
  if (!existsSync(engineSystemToolsExtensionPath)) return [];
  try {
    return await withEmbeddedEngine(async (embeddedEngine) => [
      "knowledge_search",
      "workflow_manager",
	  "workflow_delete",
	  "knowledge_manager",
	  "knowledge_delete",
      "git_manager",
      "git_restore",
      "git_publish",
      ...embeddedEngine
        .listKnowledgeCollections()
        .filter((collection) => collection.agentEnabled)
        .map((collection) => collection.toolName),
      ...embeddedEngine
        .listWorkflows()
        .filter((workflow) => workflow.publishedVersion)
        .map((workflow) => workflow.toolName),
    ]);
  } catch {
    return [];
  }
}

async function mergeEmbeddedModelCapabilities(models) {
  if (!Array.isArray(models) || !existsSync(engineConfigPath)) return models;
  try {
    return await withEmbeddedEngine(async (embeddedEngine) => {
      const catalog = await embeddedEngine.listModels();
      const capabilities = new Map(
        catalog.items.map((model) => [
          `${model.provider}/${model.id}`,
          model.thinkingLevels,
        ]),
      );
      return models.map((model) => {
        const thinkingLevels = capabilities.get(`${model.provider}/${model.id}`);
        return thinkingLevels
          ? {
              ...model,
              reasoning: thinkingLevels.some((level) => level !== "off"),
              thinkingLevels,
            }
          : model;
      });
    });
  } catch {
    return models;
  }
}

async function syncSettingsToEmbeddedEngine(settings) {
  try {
    return await withEmbeddedEngine(async (embeddedEngine) => {
      const current = embeddedEngine.getVersionedConfig();
      const candidate = structuredClone(current.config);
      const agent = isRecord(candidate.agent) ? { ...candidate.agent } : {};
      const models = isRecord(candidate.models) ? { ...candidate.models } : {};
      const project = isRecord(candidate.project) ? { ...candidate.project } : {};
      let thinkingLevelAdjustment;

      if (settings.defaultProvider && settings.defaultModel) {
        const catalog = await embeddedEngine.listModels();
        const selectedModel = catalog.items.find(
          (model) =>
            model.provider === settings.defaultProvider &&
            model.id === settings.defaultModel,
        );
        if (
          selectedModel &&
          !selectedModel.thinkingLevels.includes(settings.thinkingLevel)
        ) {
          const previous = settings.thinkingLevel;
          settings.thinkingLevel = selectedModel.thinkingLevels.includes("off")
            ? "off"
            : selectedModel.thinkingLevels[0] || "off";
          thinkingLevelAdjustment = {
            from: previous,
            to: settings.thinkingLevel,
            reason: "unsupported-by-model",
          };
        }
        agent.defaultModel = {
          provider: settings.defaultProvider,
          id: settings.defaultModel,
          thinkingLevel: settings.thinkingLevel,
        };
        const modelReference = `${settings.defaultProvider}/${settings.defaultModel}`;
        const enabledModels = Array.isArray(models.enabled)
          ? models.enabled.filter((item) => typeof item === "string")
          : [];
        models.enabled = [...new Set([...enabledModels, modelReference])];
      } else {
        delete agent.defaultModel;
      }

      project.trust = projectBound && settings.projectTrust ? "always" : "never";
      candidate.agent = agent;
      candidate.models = models;
      candidate.project = project;

      await embeddedEngine.updateConfiguration(candidate, current.revision);
      return {
        ...publicEngineReadiness(await embeddedEngine.getReadiness()),
        ...(thinkingLevelAdjustment ? { thinkingLevelAdjustment } : {}),
      };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      409,
      "Studio 设置未能同步到 Agent Engine；原设置未保存，请检查 .pi/engine.yaml 后重试。",
    );
  }
}

function sanitizeProviderBaseUrl(input) {
  const baseUrl = String(input || "").trim().replace(/\/+$/, "");
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new HttpError(400, "请求地址不是有效地址。");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new HttpError(400, "请求地址只支持 http 或 https。");
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new HttpError(400, "请求地址不能包含用户名或密码。");
  }
  return baseUrl;
}

function sanitizeCustomProvider(input, existingAuth) {
  const id = String(input.id || "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id) || id.includes("--")) {
    throw new HttpError(400, "Provider ID 只能包含小写字母、数字和单个连字符。");
  }
  if (builtInProviderIds.has(id)) {
    throw new HttpError(409, "该 Provider ID 已被内置服务占用。");
  }

  const name = String(input.name || "").trim();
  if (!name || name.length > 80) {
    throw new HttpError(400, "Provider 名称不能为空且不能超过 80 个字符。");
  }

  const baseUrl = String(input.baseUrl || "").trim().replace(/\/+$/, "");
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new HttpError(400, "Base URL 不是有效地址。");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new HttpError(400, "Base URL 只支持 http 或 https。");
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new HttpError(400, "Base URL 不能包含用户名或密码。");
  }

  const api = String(input.api || "");
  if (!supportedCustomApis.has(api)) {
    throw new HttpError(400, "不支持该 API 协议。");
  }

  if (!Array.isArray(input.models) || !input.models.length || input.models.length > 50) {
    throw new HttpError(400, "请配置 1–50 个模型。");
  }

  const seenModelIds = new Set();
  const models = input.models.map((candidate) => {
    const model = isRecord(candidate) ? candidate : {};
    const modelId = String(model.id || "").trim();
    if (!modelId || modelId.length > 200 || /[\u0000-\u001f]/.test(modelId)) {
      throw new HttpError(400, "模型 ID 不能为空、包含控制字符或超过 200 个字符。");
    }
    if (seenModelIds.has(modelId)) {
      throw new HttpError(400, `模型 ID 重复：${modelId}`);
    }
    seenModelIds.add(modelId);

    const modelName = String(model.name || modelId).trim();
    const contextWindow = Number(model.contextWindow || 128000);
    const maxTokens = Number(model.maxTokens || 16384);
    if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
      throw new HttpError(400, `模型 ${modelId} 的上下文长度无效。`);
    }
    if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
      throw new HttpError(400, `模型 ${modelId} 的最大输出长度无效。`);
    }

    return {
      id: modelId,
      name: modelName.slice(0, 120) || modelId,
      reasoning: model.reasoning === true,
      input: model.vision === true ? ["text", "image"] : ["text"],
      contextWindow,
      maxTokens,
    };
  });

  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!key && input.localNoKey !== true && !existingAuth) {
    throw new HttpError(400, "请输入 API Key，或选择本地服务无需 Key。");
  }

  return {
    id,
    name,
    baseUrl,
    api,
    models,
    key: input.localNoKey === true ? "pi-studio-local" : key,
  };
}

function getContentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n");
}

class RpcRuntime extends EventEmitter {
  constructor({ sessionId, title = "劳博士", noSession = false }) {
    super();
    this.sessionId = sessionId;
    this.title = title;
    this.noSession = noSession;
    this.child = null;
    this.buffer = "";
    this.pending = new Map();
	this.pendingUiRequests = new Set();
    this.readyPromise = null;
    this.closed = false;
    this.lastUsedAt = Date.now();
  }

  async start() {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      const settings = await loadSettings();
      await syncRuntimeModels();
      const memory = settings.memoryEnabled ? (await readText(memoryPath, "")).trim() : "";
      const systemToolNames = await listSystemToolNames();
      const args = ["--mode", "rpc"];

      if (existsSync(engineSystemToolsExtensionPath)) {
        args.push("--extension", engineSystemToolsExtensionPath);
      }

      if (this.noSession) {
        args.push("--no-session");
      } else {
        args.push("--session-id", this.sessionId, "--session-dir", sessionDir);
      }
      args.push("--name", this.title.slice(0, 100));
      args.push(settings.projectTrust ? "--approve" : "--no-approve");
      if (settings.defaultProvider) args.push("--provider", settings.defaultProvider);
      if (settings.defaultModel) args.push("--model", settings.defaultModel);
      if (settings.thinkingLevel) args.push("--thinking", settings.thinkingLevel);
      const activeTools = [...new Set([...settings.allowedTools, ...systemToolNames])];
      if (activeTools.length) {
        args.push("--tools", activeTools.join(","));
      } else {
        args.push("--no-tools");
      }
      if (memory) {
        args.push(
          "--append-system-prompt",
          `# Long-term memory\n\nTreat the following as user-managed persistent context. Do not rewrite it unless the user explicitly asks.\n\n${memory}`,
        );
      }

      const child = spawn(engine.command, args, {
        cwd: settings.workspacePath,
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: agentDir,
          PI_STUDIO_SYSTEM_TOOLS_DB: path.join(agentDir, "system-tools.db"),
          PI_SKIP_VERSION_CHECK: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      this.child = child;

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => this.onStdout(chunk));
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        const text = String(chunk).trim();
        if (text) this.emit("diagnostic", text.slice(-3000));
      });
      child.on("error", (error) => this.onExit(error));
      child.on("exit", (code, signal) => {
        if (!this.closed) {
          this.onExit(
            new Error(`劳博士进程已退出（code=${String(code)}, signal=${String(signal)}）。`),
          );
        }
      });

      await this.command("get_state", {}, 20_000);
      return this;
    })();

    return this.readyPromise;
  }

  onStdout(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline === -1) break;
      const line = this.buffer.slice(0, newline).replace(/\r$/, "");
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.type === "response" && message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.success) pending.resolve(message);
          else pending.reject(new Error(message.error || `${message.command} 执行失败。`));
		} else {
		  if (message.type === "extension_ui_request" && message.id && ["confirm", "select", "input", "editor"].includes(message.method)) {
			this.pendingUiRequests.add(message.id);
		  }
          this.emit("event", message);
        }
      } catch {
        this.emit("diagnostic", `无法解析劳博士 RPC 输出：${line.slice(0, 500)}`);
      }
    }
  }

  command(type, payload = {}, timeoutMs = 30_000) {
    if (!this.child || this.closed) {
      return Promise.reject(new Error("劳博士 RPC 尚未启动。"));
    }
    const id = crypto.randomUUID();
    const record = { id, type, ...payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${type} 等待劳博士响应超时。`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify(record)}\n`);
      this.lastUsedAt = Date.now();
    });
  }

	respondToUiRequest(id, response) {
	  if (!this.child || this.closed) throw new Error("劳博士 RPC 尚未启动。");
	  if (!this.pendingUiRequests.delete(id)) throw new HttpError(404, "确认请求不存在或已经处理。");
	  this.child.stdin.write(`${JSON.stringify({ type: "extension_ui_response", id, ...response })}\n`);
	  this.lastUsedAt = Date.now();
	}

  onExit(error) {
    if (this.closed) return;
    this.closed = true;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
    this.emit("fatal", error);
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.child?.stdin.end();
      this.child?.kill("SIGTERM");
    } catch {
      // Process is already gone.
    }
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("劳博士会话已重启。"));
    }
    this.pending.clear();
  }
}

async function getRuntime(sessionId, title) {
  let runtime = runtimeBySession.get(sessionId);
  if (!runtime || runtime.closed) {
    runtime = new RpcRuntime({ sessionId, title });
    runtimeBySession.set(sessionId, runtime);
  }
  await runtime.start();
  return runtime;
}

async function getCatalogRuntime() {
  if (!catalogRuntime || catalogRuntime.closed) {
    catalogRuntime = new RpcRuntime({ sessionId: null, noSession: true, title: "Model catalog" });
  }
  await catalogRuntime.start();
  return catalogRuntime;
}

function restartRuntimes() {
  for (const runtime of runtimeBySession.values()) runtime.stop();
  runtimeBySession.clear();
  catalogRuntime?.stop();
  catalogRuntime = null;
}

class HttpError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    if (code) this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function corsHeaders(request) {
  const origin = request.headers.origin || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Pi-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(`${JSON.stringify(data)}\n`);
}

async function parseBody(request, limit = 1_000_000) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new HttpError(413, "请求内容过大。");
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "请求体不是有效的 JSON。");
  }
}

function isAuthorized(request, token) {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers["x-pi-bridge-token"];
  const supplied = bearer || headerToken || "";
  const suppliedBytes = Buffer.from(supplied);
  const tokenBytes = Buffer.from(token);
  if (!supplied || suppliedBytes.length !== tokenBytes.length) return false;
  return crypto.timingSafeEqual(suppliedBytes, tokenBytes);
}

function routeMatch(pathname, expression) {
  return pathname.match(expression);
}

async function handleSystemToolsRequest(request, response, url, headers) {
  if (
    url.pathname !== "/api/knowledge" &&
    !url.pathname.startsWith("/api/knowledge/") &&
    url.pathname !== "/api/workflows" &&
    !url.pathname.startsWith("/api/workflows/")
  ) {
    return false;
  }

  if (request.method === "GET" && url.pathname === "/api/knowledge") {
    const collectionId = url.searchParams.get("collectionId") || undefined;
    const data = await withSystemToolsEngine(async (embeddedEngine) => ({
      collections: embeddedEngine.listKnowledgeCollections(),
      documents: embeddedEngine.listKnowledgeDocuments(collectionId),
    }));
    sendJson(response, 200, data, headers);
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/api/knowledge/collections") {
    const body = await parseBody(request);
    const previousCollection = body.id
      ? await withSystemToolsEngine(async (embeddedEngine) =>
          embeddedEngine
            .listKnowledgeCollections()
            .find((collection) => collection.id === body.id),
        )
      : undefined;
    const collection = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.upsertKnowledgeCollection(body),
    );
    if (
      previousCollection?.agentEnabled !== collection.agentEnabled ||
      previousCollection?.toolName !== collection.toolName ||
      previousCollection?.retrievalMode !== collection.retrievalMode
    ) {
      restartRuntimes();
    }
    sendJson(response, 200, { collection }, headers);
    return true;
  }

  const collectionMatch = routeMatch(
    url.pathname,
    /^\/api\/knowledge\/collections\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/u,
  );
  if (request.method === "DELETE" && collectionMatch) {
    await withSystemToolsEngine(async (embeddedEngine) =>
	  embeddedEngine.deleteKnowledgeCollection(
		collectionMatch[1],
		request.headers["x-resource-revision"] || undefined,
	  ),
    );
    restartRuntimes();
    sendJson(response, 200, { ok: true }, headers);
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/api/knowledge/documents") {
    const body = await parseBody(request, 2_500_000);
    const document = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.upsertKnowledgeDocument(body),
    );
    sendJson(response, 200, { document }, headers);
    return true;
  }

  const documentMatch = routeMatch(
    url.pathname,
    /^\/api\/knowledge\/documents\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/u,
  );
  if (request.method === "DELETE" && documentMatch) {
    await withSystemToolsEngine(async (embeddedEngine) =>
	  embeddedEngine.deleteKnowledgeDocument(
		documentMatch[1],
		request.headers["x-resource-revision"] || undefined,
	  ),
    );
    sendJson(response, 200, { ok: true }, headers);
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/knowledge/search") {
    const body = await parseBody(request);
    const results = await withSystemToolsEngine(async (embeddedEngine) =>
      body.retrievalMode === "smart"
        ? embeddedEngine.searchKnowledgeSmart(body)
        : embeddedEngine.searchKnowledge(body),
    );
    sendJson(response, 200, { results }, headers);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/workflows") {
    const workflows = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.listWorkflows(),
    );
    sendJson(response, 200, { workflows }, headers);
    return true;
  }

  if (request.method === "PUT" && url.pathname === "/api/workflows") {
    const body = await parseBody(request);
    const workflow = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.upsertWorkflow(body),
    );
    sendJson(response, 200, { workflow }, headers);
    return true;
  }

  const workflowActionMatch = routeMatch(
    url.pathname,
    /^\/api\/workflows\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})\/(publish|run)$/u,
  );
  if (request.method === "POST" && workflowActionMatch?.[2] === "publish") {
    const published = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.publishWorkflow(workflowActionMatch[1]),
    );
    restartRuntimes();
    sendJson(response, 200, { published }, headers);
    return true;
  }
  if (request.method === "POST" && workflowActionMatch?.[2] === "run") {
    const body = await parseBody(request);
    const result = await withSystemToolsEngine(async (embeddedEngine) =>
      embeddedEngine.runWorkflow(workflowActionMatch[1], body),
    );
    sendJson(response, 200, { result }, headers);
    return true;
  }

  const workflowMatch = routeMatch(
    url.pathname,
    /^\/api\/workflows\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/u,
  );
  if (request.method === "DELETE" && workflowMatch) {
    await withSystemToolsEngine(async (embeddedEngine) =>
	  embeddedEngine.deleteWorkflow(
		workflowMatch[1],
		request.headers["x-resource-revision"] || undefined,
	  ),
    );
    restartRuntimes();
    sendJson(response, 200, { ok: true }, headers);
    return true;
  }

  throw new HttpError(404, "未找到该知识库或工作流接口。");
}

async function handleRequest(request, response, token) {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(
      response,
      200,
      {
        ok: true,
        bridgeVersion: BRIDGE_VERSION,
        engine: {
          available: engine.source === "PATH" ? null : existsSync(engine.command),
          source: engine.source,
          commandLabel: path.basename(engine.command),
        },
        authRequired: true,
        projectRoot,
        agentDir,
      },
      headers,
    );
    return;
  }

  if (!isAuthorized(request, token)) {
    sendJson(response, 401, { error: "Bridge Token 不正确。" }, headers);
    return;
  }

  if (await handleSystemToolsRequest(request, response, url, headers)) return;

  if (request.method === "GET" && url.pathname === "/api/files/image") {
    const image = await readLocalMarkdownImage(url.searchParams.get("path") || "");
    response.writeHead(200, {
      ...headers,
      "Content-Type": image.mimeType,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(image.bytes);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    const settings = await loadSettings();
    const auth = await readJson(authPath, {});
    const [globalPrompt, projectPrompt, memory, skills, modelsConfig, engineIntegration] =
      await Promise.all([
        readText(globalPromptPath, ""),
        readText(projectPromptPath(settings.workspacePath), ""),
        readText(memoryPath, ""),
        collectSkills(settings),
        loadModelsConfig(),
        inspectEmbeddedEngine(),
      ]);
    const providers = [
      ...providerCatalog.map((provider) => {
        const credential = auth[provider.id];
        const fromEnvironment = Boolean(process.env[provider.env]);
        const providerConfig = modelsConfig.providers[provider.id];
        const configuredBaseUrl =
          isRecord(providerConfig) && typeof providerConfig.baseUrl === "string"
            ? providerConfig.baseUrl.trim()
            : "";
        return {
          ...provider,
          baseUrl: configuredBaseUrl || provider.defaultBaseUrl,
          endpointCustomized: Boolean(configuredBaseUrl),
          configured: Boolean(credential) || fromEnvironment,
          source: credential ? "auth.json" : fromEnvironment ? "environment" : null,
          credentialType: credential?.type || (fromEnvironment ? "api_key" : null),
          custom: false,
        };
      }),
      ...customProviderSummaries(modelsConfig, auth, settings.customProviderIds),
    ];

    sendJson(
      response,
      200,
      {
        settings,
        prompts: { global: globalPrompt, project: projectPrompt },
        memory,
        skills,
        providers,
        engineIntegration,
        studioControl: {
          canShutdown: canShutdownStudio,
        },
        paths: {
          agentDir,
          authPath,
          globalPromptPath,
          projectPromptPath: projectPromptPath(settings.workspacePath),
          memoryPath,
          modelsPath,
        },
      },
      headers,
    );
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/settings") {
    const current = await loadSettings();
    const body = await parseBody(request);
    const next = sanitizeSettings(body, current);
    try {
      const workspaceStat = await stat(next.workspacePath);
      if (!workspaceStat.isDirectory()) throw new Error("not a directory");
    } catch {
      throw new HttpError(400, "工作目录不存在或不是文件夹。");
    }
    const engineIntegration = await syncSettingsToEmbeddedEngine(next);
    await writeJson(studioSettingsPath, next);
    restartRuntimes();
    sendJson(response, 200, { ok: true, settings: next, engineIntegration }, headers);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/studio/shutdown") {
    if (!canShutdownStudio) {
      throw new HttpError(
        403,
        "当前 Studio 不是由 dev:full 管理的开发进程，请在启动它的终端按 Ctrl+C 关闭。",
      );
    }
    sendJson(response, 202, { ok: true, shuttingDown: true }, headers);
    setTimeout(() => process.kill(process.pid, "SIGTERM"), 120).unref();
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/system-prompt") {
    const settings = await loadSettings();
    const body = await parseBody(request);
    const scope = body.scope === "project" ? "project" : "global";
    const filePath =
      scope === "project" ? projectPromptPath(settings.workspacePath) : globalPromptPath;
    await atomicWrite(filePath, String(body.content || ""));
    restartRuntimes();
    sendJson(response, 200, { ok: true, scope, path: filePath }, headers);
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/memory") {
    const body = await parseBody(request);
    await atomicWrite(memoryPath, String(body.content || ""));
    restartRuntimes();
    sendJson(response, 200, { ok: true, path: memoryPath }, headers);
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/providers/custom") {
    const body = await parseBody(request);
    const [modelsConfig, auth, settings] = await Promise.all([
      loadModelsConfig({ strict: true }),
      readJson(authPath, {}),
      loadSettings(),
    ]);
    const originalId =
      typeof body.originalId === "string" && body.originalId.trim()
        ? body.originalId.trim().toLowerCase()
        : "";
    const requestedId = String(body.id || "").trim().toLowerCase();
    const existingConfig = originalId ? modelsConfig.providers[originalId] : null;

    if (originalId) {
      if (
        builtInProviderIds.has(originalId) ||
        !settings.customProviderIds.includes(originalId) ||
        !isRecord(existingConfig)
      ) {
        throw new HttpError(404, "找不到要更新的自定义 Provider。");
      }
    } else if (modelsConfig.providers[requestedId]) {
      throw new HttpError(409, "该 Provider ID 已存在。");
    }

    const existingCredential =
      auth[originalId || requestedId] ||
      (isRecord(existingConfig) &&
      typeof existingConfig.apiKey === "string" &&
      existingConfig.apiKey.trim()
        ? { type: "models_json" }
        : null);
    const provider = sanitizeCustomProvider(body, existingCredential);
    if (
      provider.id !== originalId &&
      modelsConfig.providers[provider.id] &&
      !builtInProviderIds.has(provider.id)
    ) {
      throw new HttpError(409, "新的 Provider ID 已存在。");
    }

    const nextProviderConfig = {
      ...(isRecord(existingConfig) ? existingConfig : {}),
      name: provider.name,
      baseUrl: provider.baseUrl,
      api: provider.api,
      models: provider.models,
    };
    if (originalId && originalId !== provider.id) {
      delete modelsConfig.providers[originalId];
    }
    modelsConfig.providers[provider.id] = nextProviderConfig;

    if (originalId && originalId !== provider.id && auth[originalId]) {
      auth[provider.id] = auth[originalId];
      delete auth[originalId];
    }
    if (provider.key) {
      auth[provider.id] = { type: "api_key", key: provider.key };
    }

    if (originalId && originalId !== provider.id && settings.defaultProvider === originalId) {
      settings.defaultProvider = provider.id;
    }
    settings.customProviderIds = [
      ...new Set([
        ...settings.customProviderIds.filter((id) => id !== originalId),
        provider.id,
      ]),
    ];

    await Promise.all([
      writeJson(modelsPath, modelsConfig),
      writeJson(authPath, auth),
      writeJson(studioSettingsPath, settings),
    ]);
    restartRuntimes();
    sendJson(response, 200, { ok: true, provider: provider.id }, headers);
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/providers/custom") {
    const body = await parseBody(request);
    const id = String(body.provider || "").trim().toLowerCase();
    if (!id || builtInProviderIds.has(id)) {
      throw new HttpError(400, "只能删除自定义 Provider。");
    }

    const [modelsConfig, auth, settings] = await Promise.all([
      loadModelsConfig({ strict: true }),
      readJson(authPath, {}),
      loadSettings(),
    ]);
    if (
      !settings.customProviderIds.includes(id) ||
      !isRecord(modelsConfig.providers[id])
    ) {
      throw new HttpError(404, "找不到该自定义 Provider。");
    }

    delete modelsConfig.providers[id];
    delete auth[id];
    settings.customProviderIds = settings.customProviderIds.filter(
      (providerId) => providerId !== id,
    );
    if (settings.defaultProvider === id) {
      settings.defaultProvider = "";
      settings.defaultModel = "";
    }

    await Promise.all([
      writeJson(modelsPath, modelsConfig),
      writeJson(authPath, auth),
      writeJson(studioSettingsPath, settings),
    ]);
    restartRuntimes();
    sendJson(response, 200, { ok: true, provider: id }, headers);
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/providers/key") {
    const body = await parseBody(request);
    const provider = providerCatalog.find((item) => item.id === body.provider);
    if (!provider) throw new HttpError(400, "不支持的 Provider。");
    const baseUrl = sanitizeProviderBaseUrl(body.baseUrl || provider.defaultBaseUrl);
    const [auth, modelsConfig] = await Promise.all([
      readJson(authPath, {}),
      loadModelsConfig({ strict: true }),
    ]);
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key && !auth[provider.id] && !process.env[provider.env]) {
      throw new HttpError(400, "请输入 API Key 后再保存请求地址。");
    }
    if (key) {
      auth[provider.id] = { type: "api_key", key };
    }
    const existingProviderConfig = modelsConfig.providers[provider.id];
    const nextProviderConfig = isRecord(existingProviderConfig)
      ? { ...existingProviderConfig }
      : {};
    if (baseUrl === provider.defaultBaseUrl) {
      delete nextProviderConfig.baseUrl;
    } else {
      nextProviderConfig.baseUrl = baseUrl;
    }
    if (Object.keys(nextProviderConfig).length) {
      modelsConfig.providers[provider.id] = nextProviderConfig;
    } else {
      delete modelsConfig.providers[provider.id];
    }
    await Promise.all([writeJson(authPath, auth), writeJson(modelsPath, modelsConfig)]);
    restartRuntimes();
    sendJson(response, 200, { ok: true, provider: provider.id, baseUrl }, headers);
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/providers/key") {
    const body = await parseBody(request);
    const provider = providerCatalog.find((item) => item.id === body.provider);
    if (!provider) throw new HttpError(400, "不支持的 Provider。");
    const auth = await readJson(authPath, {});
    delete auth[provider.id];
    await writeJson(authPath, auth);
    restartRuntimes();
    sendJson(response, 200, { ok: true, provider: provider.id }, headers);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/skills/save") {
    const settings = await loadSettings();
    const body = await parseBody(request);
    const scope = body.scope === "project" ? "project" : "global";
    const name = String(body.name || "").trim();
    assertSkillName(name);
    const root = skillRoots(settings).find((item) => item.scope === scope).root;
    const existingPath = body.path ? assertPathInRoots(String(body.path), settings) : null;
    const targetPath =
      existingPath ||
      path.join(root, name, body.enabled === false ? "SKILL.md.disabled" : "SKILL.md");
    await atomicWrite(
      targetPath,
      skillMarkdown(name, body.description, body.instructions),
      0o600,
    );
    restartRuntimes();
    sendJson(response, 200, { ok: true, path: targetPath }, headers);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/skills/toggle") {
    const settings = await loadSettings();
    const body = await parseBody(request);
    const source = assertPathInRoots(String(body.path || ""), settings);
    const enabled = Boolean(body.enabled);
    const target = enabled
      ? source.replace(/\.disabled$/, "")
      : source.endsWith(".disabled")
        ? source
        : `${source}.disabled`;
    if (source !== target) await rename(source, target);
    restartRuntimes();
    sendJson(response, 200, { ok: true, path: target, enabled }, headers);
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/skills") {
    const settings = await loadSettings();
    const body = await parseBody(request);
    const filePath = assertPathInRoots(String(body.path || ""), settings);
    await rm(filePath);
    const parent = path.dirname(filePath);
    try {
      await rmdir(parent);
    } catch {
      // Keep non-empty skill folders and root skill directories.
    }
    restartRuntimes();
    sendJson(response, 200, { ok: true }, headers);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/sessions") {
    const sessions = (await listStudioSessions()).slice(0, 200);
    sendJson(response, 200, { sessions }, headers);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/models") {
    const runtime = await getCatalogRuntime();
    const result = await runtime.command("get_available_models");
    const data = result.data || { models: [] };
    sendJson(
      response,
      200,
      {
        ...data,
        models: await mergeEmbeddedModelCapabilities(data.models),
      },
      headers,
    );
    return;
  }

  const attachmentUploadMatch = routeMatch(
    url.pathname,
    /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/attachments$/i,
  );
  if (request.method === "POST" && attachmentUploadMatch) {
    const body = await parseBody(request, MAX_ATTACHMENT_REQUEST_BYTES);
    const batch = await saveAttachmentBatch(
      attachmentUploadMatch[1],
      body.attachments,
    );
    sendJson(
      response,
      201,
      {
        batchId: batch.id,
        attachments: batch.attachments.map((attachment) =>
          publicAttachment(attachment, attachmentUploadMatch[1], batch.id),
        ),
      },
      headers,
    );
    return;
  }

  const attachmentDownloadMatch = routeMatch(
    url.pathname,
    /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  if (request.method === "GET" && attachmentDownloadMatch) {
    const [, sessionId, batchId, attachmentId] = attachmentDownloadMatch;
    const batch = await readAttachmentBatch(sessionId, batchId);
    const attachment = batch?.attachments.find(
      (candidate) => candidate.id === attachmentId,
    );
    if (!attachment) throw new HttpError(404, "找不到该附件。");
    const bytes = await readFile(
      path.join(
        attachmentBatchDirectory(sessionId, batchId),
        attachment.storedName,
      ),
    );
    const disposition = attachment.kind === "image" ? "inline" : "attachment";
    response.writeHead(200, {
      ...headers,
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(bytes);
    return;
  }

  const promptMatch = routeMatch(
    url.pathname,
    /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/prompt$/i,
  );
  if (request.method === "POST" && promptMatch) {
    const body = await parseBody(request);
    const displayMessage = String(body.message || "").trim();
    const attachmentBatchId = String(body.attachmentBatchId || "");
    const attachmentBatch = attachmentBatchId
      ? await readAttachmentBatch(promptMatch[1], attachmentBatchId)
      : null;
    if (attachmentBatchId && !attachmentBatch) {
      throw new HttpError(404, "附件已失效，请重新添加。");
    }
    if (!displayMessage && !attachmentBatch) {
      throw new HttpError(400, "消息或附件不能为空。");
    }
    const prompt = attachmentBatch
      ? await buildAttachmentPrompt(displayMessage, promptMatch[1], attachmentBatch)
      : { message: displayMessage, images: [] };

    const runtime = await getRuntime(promptMatch[1], String(body.title || "New task"));
    response.writeHead(200, {
      ...headers,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    });

    let ended = false;
    const writeEvent = (event) => {
      if (ended || response.destroyed) return;
      response.write(`${JSON.stringify(event)}\n`);
    };
    const cleanup = () => {
      runtime.off("event", onEvent);
      runtime.off("diagnostic", onDiagnostic);
      runtime.off("fatal", onFatal);
    };
    const finish = () => {
      if (ended) return;
      ended = true;
      cleanup();
      response.end();
    };
    const onEvent = (event) => {
      writeEvent(event);
	  const details = event.type === "tool_execution_end" ? event.result?.details : null;
	  if (!event.isError && details?.resourceChanged === true) {
		writeEvent({ type: "resource_changed", resourceType: details.resourceType });
		runtime.resourcesChanged = true;
	  }
	  if (event.type === "agent_settled") {
		finish();
		if (runtime.resourcesChanged) {
		  runtime.resourcesChanged = false;
		  setTimeout(() => {
			if (runtimeBySession.get(promptMatch[1]) === runtime) {
			  runtime.stop();
			  runtimeBySession.delete(promptMatch[1]);
			}
		  }, 0);
		}
	  }
    };
    const onDiagnostic = (messageText) =>
      writeEvent({ type: "bridge_diagnostic", message: messageText });
    const onFatal = (error) => {
      writeEvent({ type: "bridge_error", message: error.message });
      finish();
    };
    runtime.on("event", onEvent);
    runtime.on("diagnostic", onDiagnostic);
    runtime.on("fatal", onFatal);
    response.on("close", cleanup);

    try {
      if (body.provider && body.modelId) {
        await runtime.command("set_model", {
          provider: String(body.provider),
          modelId: String(body.modelId),
        });
      }
      if (
        body.thinkingLevel &&
        ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
          body.thinkingLevel,
        )
      ) {
        await runtime.command("set_thinking_level", {
          level: body.thinkingLevel,
        });
      }
      const state = await runtime.command("get_state");
      writeEvent({ type: "bridge_state", state: state.data });
      await runtime.command(
        "prompt",
        {
          message: prompt.message,
          images: prompt.images.length ? prompt.images : undefined,
        },
        30_000,
      );
    } catch (error) {
      writeEvent({ type: "bridge_error", message: error.message });
      finish();
    }
    return;
  }

	const uiResponseMatch = routeMatch(
	  url.pathname,
	  /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/ui-response$/i,
	);
	if (request.method === "POST" && uiResponseMatch) {
	  const runtime = runtimeBySession.get(uiResponseMatch[1]);
	  if (!runtime || runtime.closed) throw new HttpError(404, "确认请求所属会话已经结束。");
	  const body = await parseBody(request);
	  const requestId = String(body.id || "");
	  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new HttpError(400, "确认请求 ID 无效。");
	  runtime.respondToUiRequest(
		requestId,
		body.cancelled === true ? { cancelled: true } : { confirmed: body.confirmed === true },
	  );
	  sendJson(response, 200, { ok: true }, headers);
	  return;
	}

  const chatStateMatch = routeMatch(
    url.pathname,
    /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  if (request.method === "GET" && chatStateMatch) {
    const runtime = await getRuntime(chatStateMatch[1], "劳博士");
    const [state, messages, commands] = await Promise.all([
      runtime.command("get_state"),
      runtime.command("get_messages"),
      runtime.command("get_commands"),
    ]);
    sendJson(
      response,
      200,
      {
        state: state.data,
        messages: await Promise.all(
          (messages.data?.messages || []).map((message) =>
            messageWithAttachments(message, chatStateMatch[1]),
          ),
        ),
        commands: commands.data?.commands || [],
      },
      headers,
    );
    return;
  }

  const abortMatch = routeMatch(
    url.pathname,
    /^\/api\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/abort$/i,
  );
  if (request.method === "POST" && abortMatch) {
    const runtime = runtimeBySession.get(abortMatch[1]);
    if (runtime && !runtime.closed) await runtime.command("abort");
    sendJson(response, 200, { ok: true }, headers);
    return;
  }

  sendJson(response, 404, { error: "未找到该接口。" }, headers);
}

export async function startBridge({
  host = HOST,
  port = PORT,
  token,
  log = false,
} = {}) {
  await ensureAgentDir();
  const bridgeToken = token || (await getBridgeToken());
  const server = createServer((request, response) => {
    handleRequest(request, response, bridgeToken).catch((error) => {
      const status = error instanceof HttpError ? error.status : 500;
      const headers = corsHeaders(request);
      sendJson(
        response,
        status,
        {
          error: error.message || "Bridge 内部错误。",
          ...(error.code ? { code: error.code } : {}),
          ...(error.details ? { details: error.details } : {}),
        },
        headers,
      );
    });
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Bridge 未能解析监听地址。");
  }

  const url = `http://${host}:${address.port}`;
  if (log) {
    console.log("");
    console.log("  劳博士 Bridge");
    console.log(`  API:    ${url}`);
    console.log(`  Engine: ${engine.command} (${engine.source})`);
    console.log(`  Agent:  ${agentDir}`);
    if (process.env.PI_STUDIO_LOCAL_AUTO_CONNECT === "1") {
      console.log("  Auth:   dev:full 自动连接");
    } else {
      console.log(`  Token:  ${bridgeToken}`);
      console.log("");
      console.log("  将 Token 粘贴到劳博士的“连接本机”对话框。");
    }
    console.log("");
  }

  const cleanupTimer = setInterval(() => {
    const staleBefore = Date.now() - 30 * 60 * 1000;
    for (const [sessionId, runtime] of runtimeBySession) {
      if (runtime.lastUsedAt < staleBefore) {
        runtime.stop();
        runtimeBySession.delete(sessionId);
      }
    }
  }, 5 * 60 * 1000);
  cleanupTimer.unref();

  let closePromise;
  return {
    url,
    token: bridgeToken,
    engine,
    agentDir,
    close() {
      if (closePromise) return closePromise;
      closePromise = new Promise((resolve) => {
        clearInterval(cleanupTimer);
        restartRuntimes();
        server.close(resolve);
        server.closeAllConnections?.();
      });
      return closePromise;
    },
  };
}

async function runCommandLineBridge() {
  try {
    const bridge = await startBridge({ log: true });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, async () => {
        await bridge.close();
        process.exit(0);
      });
    }
  } catch (error) {
    if (error?.code === "EADDRINUSE") {
      console.error(`\n劳博士 Bridge 无法启动：${HOST}:${PORT} 已被占用。`);
      console.error(
        "若该端口上的服务是已有劳博士 Bridge，可直接复用它；否则请设置 PI_STUDIO_PORT 后重试。\n",
      );
    } else {
      console.error(`\n劳博士 Bridge 无法启动：${error.message}\n`);
    }
    process.exit(1);
  }
}

const isCommandLineEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCommandLineEntry) {
  await runCommandLineBridge();
}
