import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { executeWorkflow, validateWorkflowDefinition, WorkflowError } from "./workflow-runtime.js";

const MAX_DOCUMENT_CHARACTERS = 2_000_000;
const RESERVED_TOOL_NAMES = new Set([
  "knowledge_search",
  "knowledge_manager",
  "knowledge_delete",
  "workflow_manager",
  "workflow_delete",
]);
const SEARCH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "for", "how", "is", "of", "or", "the", "to", "what", "when", "where", "which", "why",
]);

export class SystemToolsError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "SystemToolsError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status) {
  throw new SystemToolsError(code, message, status);
}

function now() { return new Date().toISOString(); }
function revision(row) { return `${row.id}:${row.revision}`; }
function nonEmpty(value, label, maximum) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) fail("INPUT_INVALID", `${label}不能为空。`);
  if (normalized.length > maximum) fail("INPUT_INVALID", `${label}不能超过 ${maximum} 个字符。`);
  return normalized;
}
function identifier(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)) {
    fail("IDENTIFIER_INVALID", `${label}无效。`);
  }
  return value;
}
function toolName(value) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{1,63}$/u.test(value)) {
    fail("TOOL_NAME_INVALID", "工具名必须由 2–64 位小写字母、数字或下划线组成，并以字母开头。");
  }
  return value;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

function querySearchTerms(query) {
  const segments = normalizeSearchText(query).match(/[\p{Script=Han}]+|[\p{L}\p{N}_-]+/gu) || [];
  const terms = [];
  for (const rawSegment of segments) {
    const isHan = /\p{Script=Han}/u.test(rawSegment);
    let segment = isHan
      ? rawSegment.replace(/(?:是什么|有哪些|有多少|怎么样|怎么办|为什么|如何|怎么|是否|能否|可以吗|吗|呢)$/u, "")
      : rawSegment;
    if (!segment) segment = rawSegment;
    if (!isHan) {
      if (segment.length >= 2 && !SEARCH_STOP_WORDS.has(segment)) terms.push(segment);
      continue;
    }
    if (segment.length < 3) {
      terms.push(segment);
      continue;
    }
    for (let index = 0; index <= segment.length - 3; index += 1) {
      terms.push(segment.slice(index, index + 3));
    }
  }
  return [...new Set(terms)].slice(0, 32);
}

function ftsQuery(terms) {
  return terms
    .filter((term) => [...term].length >= 3)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(" OR ");
}

function mergeOverlappingText(parts) {
  let merged = "";
  for (const rawPart of parts) {
    const part = String(rawPart || "").trim();
    if (!part) continue;
    if (!merged) {
      merged = part;
      continue;
    }
    let overlap = 0;
    const maximum = Math.min(200, merged.length, part.length);
    for (let size = maximum; size >= 24; size -= 1) {
      if (merged.slice(-size) === part.slice(0, size)) {
        overlap = size;
        break;
      }
    }
    merged += overlap ? part.slice(overlap) : `\n\n${part}`;
  }
  return merged;
}
function splitDocument(content) {
  const normalized = content.replace(/\r\n?/gu, "\n").trim();
  const chunks = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(cursor + 900, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("\n\n", end), normalized.lastIndexOf("。", end), normalized.lastIndexOf(". ", end));
      if (boundary > cursor + 495) end = boundary + 1;
    }
    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    cursor = Math.max(cursor + 1, end - 120);
  }
  return chunks;
}

export class SystemToolsStore {
  constructor(databasePath) {
    this.path = databasePath;
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    if (process.platform !== "win32") chmodSync(databasePath, 0o600);
    this.database.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
    this.migrate();
  }

  close() { this.database.close(); }

  migrate() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_collections (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', agent_enabled INTEGER NOT NULL DEFAULT 0,
        tool_name TEXT NOT NULL DEFAULT '', retrieval_mode TEXT NOT NULL DEFAULT 'fast',
        scope TEXT NOT NULL DEFAULT 'global', workspace_path TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1,
        collection_id TEXT NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
        title TEXT NOT NULL, source TEXT, content TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        collection_id TEXT NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS knowledge_documents_collection_idx ON knowledge_documents(collection_id, updated_at);
      CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx ON knowledge_chunks(document_id, ordinal);
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
        chunk_id UNINDEXED, collection_id UNINDEXED, title, content, tokenize='trigram'
      );
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', tool_name TEXT NOT NULL, definition_json TEXT NOT NULL,
        published_version INTEGER, enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workflow_versions (
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, version INTEGER NOT NULL,
        name TEXT NOT NULL, description TEXT NOT NULL, tool_name TEXT NOT NULL,
        definition_json TEXT NOT NULL, published_at TEXT NOT NULL,
        PRIMARY KEY (workflow_id, version)
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 1,
        server_name TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    const collectionColumns = new Set(
      this.database.prepare("PRAGMA table_info(knowledge_collections)").all().map((row) => row.name),
    );
    if (!collectionColumns.has("scope")) {
      this.database.exec("ALTER TABLE knowledge_collections ADD COLUMN scope TEXT NOT NULL DEFAULT 'global'");
    }
    if (!collectionColumns.has("workspace_path")) {
      this.database.exec("ALTER TABLE knowledge_collections ADD COLUMN workspace_path TEXT");
    }
    const workflowColumns = new Set(
      this.database.prepare("PRAGMA table_info(workflows)").all().map((row) => row.name),
    );
    if (!workflowColumns.has("enabled")) {
      this.database.exec("ALTER TABLE workflows ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0");
      // Published workflows were active before the explicit enable switch existed.
      this.database.exec("UPDATE workflows SET enabled=1 WHERE published_version IS NOT NULL");
    }
  }

  transaction(operation) {
    this.database.exec("BEGIN IMMEDIATE");
    try { const result = operation(); this.database.exec("COMMIT"); return result; }
    catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  getSetting(key, fallback = "") {
    identifier(key, "设置键");
    return this.database
      .prepare("SELECT value FROM app_settings WHERE key=?")
      .get(key)?.value ?? fallback;
  }

  setSetting(key, value) {
    identifier(key, "设置键");
    value = String(value ?? "");
    if (value.length > 200_000) {
      fail("SETTING_TOO_LARGE", "设置内容不能超过 200,000 个字符。");
    }
    const timestamp = now();
    this.database
      .prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
      .run(key, value, timestamp);
    return { key, value, updatedAt: timestamp };
  }

  listMcpServers() {
    return this.database
      .prepare("SELECT * FROM mcp_servers ORDER BY updated_at DESC,server_name COLLATE NOCASE")
      .all()
      .map((row) => ({
        id: row.id,
        revision: revision(row),
        serverName: row.server_name,
        enabled: row.enabled === 1,
        config: JSON.parse(row.config_json),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  upsertMcpServer(input) {
    const id = input.id ? identifier(input.id, "MCP ID") : `mcp-${randomUUID()}`;
    const existing = this.listMcpServers().find((item) => item.id === id);
    if (
      existing &&
      input.expectedRevision &&
      input.expectedRevision !== existing.revision
    ) {
      fail("REVISION_CONFLICT", "MCP 配置已被其他操作修改。", 409);
    }
    const serverName = nonEmpty(input.serverName, "MCP 名称", 32);
    if (!/^[A-Za-z0-9_-]{1,32}$/u.test(serverName)) {
      fail("MCP_NAME_INVALID", "MCP 名称只能包含字母、数字、下划线和连字符。");
    }
    if (!input.config || typeof input.config !== "object" || Array.isArray(input.config)) {
      fail("MCP_CONFIG_INVALID", "MCP 配置必须是 JSON 对象。");
    }
    const timestamp = now();
    try {
      this.database
        .prepare(`INSERT INTO mcp_servers(id,server_name,enabled,config_json,created_at,updated_at)
          VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
          server_name=excluded.server_name,enabled=excluded.enabled,
          config_json=excluded.config_json,updated_at=excluded.updated_at,revision=revision+1`)
        .run(
          id,
          serverName,
          input.enabled === false ? 0 : 1,
          JSON.stringify(input.config),
          timestamp,
          timestamp,
        );
    } catch (error) {
      if (String(error?.message).includes("UNIQUE constraint failed")) {
        fail("MCP_NAME_CONFLICT", "MCP 名称已存在。", 409);
      }
      throw error;
    }
    return this.listMcpServers().find((item) => item.id === id);
  }

  deleteMcpServer(id, expectedRevision) {
    identifier(id, "MCP ID");
    const item = this.listMcpServers().find((server) => server.id === id);
    if (!item) fail("MCP_NOT_FOUND", "MCP 配置不存在。", 404);
    if (expectedRevision && expectedRevision !== item.revision) {
      fail("REVISION_CONFLICT", "MCP 配置已被其他操作修改。", 409);
    }
    this.database.prepare("DELETE FROM mcp_servers WHERE id=?").run(id);
    return item;
  }

  listCollections() {
    return this.database.prepare(`
      SELECT c.*, COUNT(DISTINCT d.id) document_count, COUNT(k.id) chunk_count
      FROM knowledge_collections c
      LEFT JOIN knowledge_documents d ON d.collection_id=c.id
      LEFT JOIN knowledge_chunks k ON k.document_id=d.id
      GROUP BY c.id ORDER BY c.updated_at DESC, c.name COLLATE NOCASE
    `).all().map((row) => ({
      id: row.id, revision: revision(row), name: row.name, description: row.description,
      agentEnabled: row.agent_enabled === 1, toolName: row.tool_name,
      retrievalMode: row.retrieval_mode === "smart" ? "smart" : "fast",
      scope: row.scope === "workspace" ? "workspace" : "global",
      ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
      documentCount: row.document_count, chunkCount: row.chunk_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  upsertCollection(input) {
    const id = input.id ? identifier(input.id, "知识库 ID") : `kb-${randomUUID()}`;
    const existing = this.listCollections().find((item) => item.id === id);
    if (existing && input.expectedRevision && input.expectedRevision !== existing.revision) fail("REVISION_CONFLICT", "知识库已被其他操作修改。", 409);
    const name = nonEmpty(input.name, "知识库名称", 160);
    const description = String(input.description || "").trim().slice(0, 2000);
    const agentEnabled = input.agentEnabled ?? existing?.agentEnabled ?? false;
    const proposedToolName = toolName(input.toolName || existing?.toolName || `search_kb_${id.replace(/[^a-z0-9]/giu, "").slice(-10).toLowerCase()}`);
    if (RESERVED_TOOL_NAMES.has(proposedToolName)) {
      fail("TOOL_NAME_RESERVED", `工具名 ${proposedToolName} 已被系统保留。`, 409);
    }
    const collectionConflict = this.database
      .prepare("SELECT id FROM knowledge_collections WHERE tool_name=? AND id<>?")
      .get(proposedToolName, id);
    const workflowConflict = this.database
      .prepare("SELECT id FROM workflows WHERE tool_name=?")
      .get(proposedToolName);
    if (collectionConflict || workflowConflict) {
      fail("TOOL_NAME_CONFLICT", `工具名 ${proposedToolName} 已被其他知识库或工作流使用。`, 409);
    }
    const retrievalMode = input.retrievalMode === "smart" ? "smart" : "fast";
    const scope = input.scope === "workspace" ? "workspace" : existing?.scope || "global";
    const workspacePath = scope === "workspace"
      ? nonEmpty(input.workspacePath || existing?.workspacePath, "工作区路径", 4000)
      : null;
    const timestamp = now();
    this.database.prepare(`
      INSERT INTO knowledge_collections(id,name,description,agent_enabled,tool_name,retrieval_mode,scope,workspace_path,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,
      description=excluded.description,agent_enabled=excluded.agent_enabled,tool_name=excluded.tool_name,
      retrieval_mode=excluded.retrieval_mode,scope=excluded.scope,workspace_path=excluded.workspace_path,
      updated_at=excluded.updated_at,revision=revision+1
    `).run(id, name, description, agentEnabled ? 1 : 0, proposedToolName, retrievalMode, scope, workspacePath, timestamp, timestamp);
    return this.listCollections().find((item) => item.id === id);
  }

  deleteCollection(id, expectedRevision) {
    identifier(id, "知识库 ID");
    const item = this.listCollections().find((value) => value.id === id);
    if (!item) fail("COLLECTION_NOT_FOUND", "知识库不存在。", 404);
    if (expectedRevision && expectedRevision !== item.revision) fail("REVISION_CONFLICT", "知识库已被其他操作修改。", 409);
    this.transaction(() => {
      for (const row of this.database.prepare("SELECT id FROM knowledge_chunks WHERE collection_id=?").all(id)) {
        this.database.prepare("DELETE FROM knowledge_chunks_fts WHERE chunk_id=?").run(row.id);
      }
      this.database.prepare("DELETE FROM knowledge_collections WHERE id=?").run(id);
    });
  }

  listDocuments(collectionId) {
    const where = collectionId ? "WHERE d.collection_id=?" : "";
    return this.database.prepare(`
      SELECT d.id,d.revision,d.collection_id,d.title,d.source,length(d.content) content_length,
      COUNT(k.id) chunk_count,d.created_at,d.updated_at FROM knowledge_documents d
      LEFT JOIN knowledge_chunks k ON k.document_id=d.id ${where}
      GROUP BY d.id ORDER BY d.updated_at DESC,d.title COLLATE NOCASE
    `).all(...(collectionId ? [collectionId] : [])).map((row) => ({
      id: row.id, revision: revision(row), collectionId: row.collection_id, title: row.title,
      ...(row.source ? { source: row.source } : {}), contentLength: row.content_length,
      chunkCount: row.chunk_count, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  getDocument(id) {
    identifier(id, "文档 ID");
    const row = this.database.prepare(`
      SELECT d.id,d.revision,d.collection_id,d.title,d.source,d.content,length(d.content) content_length,
      COUNT(k.id) chunk_count,d.created_at,d.updated_at FROM knowledge_documents d
      LEFT JOIN knowledge_chunks k ON k.document_id=d.id WHERE d.id=? GROUP BY d.id
    `).get(id);
    if (!row) fail("DOCUMENT_NOT_FOUND", "文档不存在。", 404);
    return { id: row.id, revision: revision(row), collectionId: row.collection_id, title: row.title,
      ...(row.source ? { source: row.source } : {}), content: row.content,
      contentLength: row.content_length, chunkCount: row.chunk_count,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }

  upsertDocument(input) {
    const id = input.id ? identifier(input.id, "文档 ID") : `doc-${randomUUID()}`;
    const existing = input.id ? this.listDocuments().find((item) => item.id === id) : undefined;
    if (existing && input.expectedRevision && input.expectedRevision !== existing.revision) fail("REVISION_CONFLICT", "文档已被其他操作修改。", 409);
    const collectionId = identifier(input.collectionId, "知识库 ID");
    if (!this.listCollections().some((item) => item.id === collectionId)) fail("COLLECTION_NOT_FOUND", "知识库不存在。", 404);
    const title = nonEmpty(input.title, "文档标题", 240);
    const content = nonEmpty(input.content, "文档内容", MAX_DOCUMENT_CHARACTERS);
    const source = String(input.source || "").trim().slice(0, 2000) || null;
    const chunks = splitDocument(content);
    const timestamp = now();
    this.transaction(() => {
      for (const row of this.database.prepare("SELECT id FROM knowledge_chunks WHERE document_id=?").all(id)) {
        this.database.prepare("DELETE FROM knowledge_chunks_fts WHERE chunk_id=?").run(row.id);
      }
      this.database.prepare("DELETE FROM knowledge_chunks WHERE document_id=?").run(id);
      this.database.prepare(`
        INSERT INTO knowledge_documents(id,collection_id,title,source,content,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET collection_id=excluded.collection_id,
        title=excluded.title,source=excluded.source,content=excluded.content,
        updated_at=excluded.updated_at,revision=revision+1
      `).run(id, collectionId, title, source, content, timestamp, timestamp);
      for (const [ordinal, chunk] of chunks.entries()) {
        const chunkId = `chunk-${randomUUID()}`;
        this.database.prepare("INSERT INTO knowledge_chunks VALUES(?,?,?,?,?,?)").run(chunkId, id, collectionId, ordinal, chunk, timestamp);
        this.database.prepare("INSERT INTO knowledge_chunks_fts(chunk_id,collection_id,title,content) VALUES(?,?,?,?)").run(chunkId, collectionId, title, chunk);
      }
      this.database.prepare("UPDATE knowledge_collections SET updated_at=?,revision=revision+1 WHERE id=?").run(timestamp, collectionId);
    });
    return this.listDocuments(collectionId).find((item) => item.id === id);
  }

  deleteDocument(id, expectedRevision) {
    const item = this.listDocuments().find((value) => value.id === id);
    if (!item) fail("DOCUMENT_NOT_FOUND", "文档不存在。", 404);
    if (expectedRevision && expectedRevision !== item.revision) fail("REVISION_CONFLICT", "文档已被其他操作修改。", 409);
    this.transaction(() => {
      for (const row of this.database.prepare("SELECT id FROM knowledge_chunks WHERE document_id=?").all(id)) this.database.prepare("DELETE FROM knowledge_chunks_fts WHERE chunk_id=?").run(row.id);
      this.database.prepare("DELETE FROM knowledge_documents WHERE id=?").run(id);
      this.database.prepare("UPDATE knowledge_collections SET updated_at=?,revision=revision+1 WHERE id=?").run(now(), item.collectionId);
    });
  }

  searchKnowledge({ query, collectionId, topK = 5, enabledOnly = false, workspacePath }) {
    query = nonEmpty(query, "检索词", 1000);
    topK = Math.min(Math.max(Number(topK) || 5, 1), 20);
    const terms = querySearchTerms(query);
    const match = ftsQuery(terms);
    const candidateLimit = Math.min(topK * 8, 100);
    let rows = [];
    try {
      rows = !match ? [] : this.database.prepare(`
        SELECT k.id chunk_id,k.ordinal,k.document_id,k.collection_id,d.title,d.source,k.content,
        bm25(knowledge_chunks_fts,0.0,0.0,5.0,1.0) rank
        FROM knowledge_chunks_fts JOIN knowledge_chunks k ON k.id=knowledge_chunks_fts.chunk_id
        JOIN knowledge_documents d ON d.id=k.document_id
        JOIN knowledge_collections c ON c.id=k.collection_id
        WHERE knowledge_chunks_fts MATCH ? AND (? IS NULL OR k.collection_id=?)
        AND (?=0 OR c.agent_enabled=1)
        AND (? IS NULL OR c.scope='global' OR c.workspace_path=?) ORDER BY rank LIMIT ?
      `).all(match, collectionId || null, collectionId || null, enabledOnly ? 1 : 0,
        workspacePath || null, workspacePath || null, candidateLimit);
    } catch { rows = []; }
    if (rows.length === 0) {
      const fallbackTerms = terms.length ? terms.slice(0, 12) : [normalizeSearchText(query)];
      const conditions = fallbackTerms.map(() => "(k.content LIKE ? OR d.title LIKE ?)").join(" OR ");
      const values = fallbackTerms.flatMap((term) => [`%${term}%`, `%${term}%`]);
      rows = this.database.prepare(`
        SELECT k.id chunk_id,k.ordinal,k.document_id,k.collection_id,d.title,d.source,k.content,1.0 rank
        FROM knowledge_chunks k JOIN knowledge_documents d ON d.id=k.document_id
        JOIN knowledge_collections c ON c.id=k.collection_id
        WHERE (${conditions}) AND (? IS NULL OR k.collection_id=?) AND (?=0 OR c.agent_enabled=1)
        AND (? IS NULL OR c.scope='global' OR c.workspace_path=?)
        ORDER BY d.updated_at DESC,k.ordinal LIMIT ?
      `).all(...values, collectionId || null, collectionId || null, enabledOnly ? 1 : 0,
        workspacePath || null, workspacePath || null, candidateLimit);
    }

    const ranked = rows.map((row) => {
      const title = normalizeSearchText(row.title);
      const content = normalizeSearchText(row.content);
      const matched = terms.filter((term) => title.includes(term) || content.includes(term)).length;
      const titleMatched = terms.filter((term) => title.includes(term)).length;
      const coverage = terms.length ? matched / terms.length : 1;
      const titleCoverage = terms.length ? titleMatched / terms.length : 0;
      const score = Math.min(0.99, 0.25 + coverage * 0.6 + titleCoverage * 0.14);
      return { ...row, score };
    }).sort((left, right) => right.score - left.score || left.rank - right.rank);

    const selected = [];
    for (const row of ranked) {
      if (selected.some((item) => item.document_id === row.document_id && Math.abs(item.ordinal - row.ordinal) <= 1)) continue;
      selected.push(row);
      if (selected.length >= topK) break;
    }

    return selected.map((row) => {
      const context = this.database.prepare(`
        SELECT content FROM knowledge_chunks WHERE document_id=? AND ordinal BETWEEN ? AND ? ORDER BY ordinal
      `).all(row.document_id, Math.max(0, row.ordinal - 1), row.ordinal + 1);
      return {
        chunkId: row.chunk_id, ordinal: row.ordinal, documentId: row.document_id,
        collectionId: row.collection_id, title: row.title,
        ...(row.source ? { source: row.source } : {}),
        content: mergeOverlappingText(context.map((item) => item.content)),
        score: Number(row.score.toFixed(6)),
      };
    });
  }

  listWorkflows() {
    return this.database.prepare(`SELECT w.*,v.published_at FROM workflows w LEFT JOIN workflow_versions v
      ON v.workflow_id=w.id AND v.version=w.published_version ORDER BY w.updated_at DESC,w.name COLLATE NOCASE`).all()
      .map((row) => ({ id: row.id, revision: revision(row), name: row.name, description: row.description,
        toolName: row.tool_name, definition: JSON.parse(row.definition_json),
        enabled: row.enabled === 1,
        ...(row.published_version === null ? {} : { publishedVersion: row.published_version }),
        ...(row.published_at ? { publishedAt: row.published_at } : {}),
        createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  getWorkflow(id) {
    identifier(id, "工作流 ID");
    const item = this.listWorkflows().find((workflow) => workflow.id === id);
    if (!item) fail("WORKFLOW_NOT_FOUND", "工作流不存在。", 404);
    return item;
  }

  upsertWorkflow(input) {
    const id = input.id ? identifier(input.id, "工作流 ID") : `workflow-${randomUUID()}`;
    const existing = this.listWorkflows().find((item) => item.id === id);
    if (existing && input.expectedRevision && input.expectedRevision !== existing.revision) fail("REVISION_CONFLICT", "工作流已被其他操作修改。", 409);
    const name = nonEmpty(input.name, "工作流名称", 160);
    const description = String(input.description || "").trim().slice(0, 2000);
    const registeredToolName = toolName(input.toolName);
    if (RESERVED_TOOL_NAMES.has(registeredToolName)) {
      fail("TOOL_NAME_RESERVED", `工具名 ${registeredToolName} 已被系统保留。`, 409);
    }
    const collectionConflict = this.database
      .prepare("SELECT id FROM knowledge_collections WHERE tool_name=?")
      .get(registeredToolName);
    const workflowConflict = this.database
      .prepare("SELECT id FROM workflows WHERE tool_name=? AND id<>?")
      .get(registeredToolName, id);
    if (collectionConflict || workflowConflict) {
      fail("TOOL_NAME_CONFLICT", `工具名 ${registeredToolName} 已被其他知识库或工作流使用。`, 409);
    }
    const definition = validateWorkflowDefinition(input.definition);
    const timestamp = now();
    this.database.prepare(`INSERT INTO workflows(id,name,description,tool_name,definition_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,
      tool_name=excluded.tool_name,definition_json=excluded.definition_json,updated_at=excluded.updated_at,revision=revision+1`)
      .run(id, name, description, registeredToolName, JSON.stringify(definition), timestamp, timestamp);
    return this.getWorkflow(id);
  }

  deleteWorkflow(id, expectedRevision) {
    const item = this.getWorkflow(id);
    if (expectedRevision && expectedRevision !== item.revision) fail("REVISION_CONFLICT", "工作流已被其他操作修改。", 409);
    this.database.prepare("DELETE FROM workflows WHERE id=?").run(id);
  }

  publishWorkflow(id, expectedRevision) {
    const workflow = this.getWorkflow(id);
    if (expectedRevision && expectedRevision !== workflow.revision) fail("REVISION_CONFLICT", "工作流已被其他操作修改。", 409);
    const version = (workflow.publishedVersion || 0) + 1;
    const timestamp = now();
    this.transaction(() => {
      this.database.prepare(`INSERT INTO workflow_versions(workflow_id,version,name,description,tool_name,definition_json,published_at)
        VALUES(?,?,?,?,?,?,?)`).run(id, version, workflow.name, workflow.description, workflow.toolName, JSON.stringify(workflow.definition), timestamp);
      this.database.prepare(`UPDATE workflows SET published_version=?,
        enabled=CASE WHEN published_version IS NULL THEN 1 ELSE enabled END,
        updated_at=?,revision=revision+1 WHERE id=?`).run(version, timestamp, id);
    });
    return { ...this.getWorkflow(id), version, publishedAt: timestamp };
  }

  setWorkflowEnabled(id, enabled, expectedRevision) {
    const workflow = this.getWorkflow(id);
    if (!expectedRevision) fail("REVISION_REQUIRED", "启停工作流前必须携带当前 revision。", 409);
    if (expectedRevision !== workflow.revision) fail("REVISION_CONFLICT", "工作流已被其他操作修改。", 409);
    if (enabled && !workflow.publishedVersion) fail("WORKFLOW_NOT_PUBLISHED", "工作流发布后才能启用。", 409);
    const timestamp = now();
    this.database.prepare("UPDATE workflows SET enabled=?,updated_at=?,revision=revision+1 WHERE id=?")
      .run(enabled ? 1 : 0, timestamp, id);
    return this.getWorkflow(id);
  }

  listPublishedWorkflows() {
    return this.database.prepare(`SELECT v.*,w.enabled FROM workflows w JOIN workflow_versions v
      ON v.workflow_id=w.id AND v.version=w.published_version ORDER BY v.tool_name`).all()
      .map((row) => ({ workflowId: row.workflow_id, version: row.version, name: row.name,
        description: row.description, toolName: row.tool_name, definition: JSON.parse(row.definition_json),
        enabled: row.enabled === 1, publishedAt: row.published_at }));
  }

  async runWorkflow(id, input, options = {}, version) {
    const workflow = version
      ? this.listPublishedWorkflows().find((item) => item.workflowId === id && item.version === version)
      : this.getWorkflow(id);
    if (!workflow) fail("WORKFLOW_NOT_FOUND", "工作流版本不存在。", 404);
    try {
      return { workflowId: id, ...(version ? { version } : {}),
        ...await executeWorkflow(workflow.definition, input, { ...options, knowledgeStore: this }) };
    } catch (error) {
      if (error instanceof WorkflowError) throw new SystemToolsError(error.code, error.message, 400);
      throw error;
    }
  }
}
