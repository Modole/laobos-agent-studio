"use client";

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ApiFetch = (pathname: string, init?: RequestInit) => Promise<Response>;

type KnowledgeCollection = {
  id: string;
	revision: string;
  name: string;
  description: string;
  agentEnabled: boolean;
  toolName: string;
  retrievalMode: "fast" | "smart";
  documentCount: number;
  chunkCount: number;
  updatedAt: string;
};

type KnowledgeDocument = {
  id: string;
	revision: string;
  collectionId: string;
  title: string;
  source?: string;
  contentLength: number;
  chunkCount: number;
  updatedAt: string;
};

type SearchResult = {
  documentId: string;
  collectionId: string;
  title: string;
  source?: string;
  content: string;
  score: number;
};

const acceptedFileTypes = ".txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml,.log,.sql,.js,.ts,.tsx,.jsx,.css";
const acceptedExtensions = new Set(acceptedFileTypes.split(","));

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function fileKind(name: string): string {
  const extension = fileExtension(name).replace(".", "");
  return extension.slice(0, 4).toUpperCase() || "TXT";
}

function normalizedToolName(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 45);
  return `search_${ascii || "knowledge"}`;
}

async function readKnowledgeFile(file: File): Promise<string> {
  if (!acceptedExtensions.has(fileExtension(file.name))) {
    throw new Error(`暂不支持 ${file.name}；请导入 TXT、Markdown、CSV、JSON、HTML 或代码文本。`);
  }
  if (file.size > 2_000_000) throw new Error(`${file.name} 超过 2 MB，建议先拆分文档。`);
  const text = await file.text();
  if (fileExtension(file.name) === ".html" || fileExtension(file.name) === ".htm") {
    return new DOMParser().parseFromString(text, "text/html").body.textContent?.trim() || "";
  }
  if (fileExtension(file.name) === ".json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

export function KnowledgeBase({
  apiFetch,
  connected,
  onNotify,
	refreshVersion = 0,
}: {
  apiFetch: ApiFetch;
  connected: boolean;
  onNotify: (message: string) => void;
	refreshVersion?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState("");
	const [collectionRevision, setCollectionRevision] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [toolNameDraft, setToolNameDraft] = useState("");
  const [retrievalModeDraft, setRetrievalModeDraft] = useState<"fast" | "smart">("fast");
  const [documentOpen, setDocumentOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentSource, setDocumentSource] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragging, setDragging] = useState(false);

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeCollectionId),
    [activeCollectionId, collections],
  );

  const syncCollectionDrafts = useCallback((collection?: KnowledgeCollection) => {
	setCollectionRevision(collection?.revision || "");
    setNameDraft(collection?.name || "");
    setDescriptionDraft(collection?.description || "");
    setToolNameDraft(collection?.toolName || "");
    setRetrievalModeDraft(collection?.retrievalMode || "fast");
  }, []);

  const loadKnowledge = useCallback(
    async (preferredCollectionId?: string) => {
      if (!connected) return;
      const response = await apiFetch("/api/knowledge");
      const data = (await response.json()) as {
        collections?: KnowledgeCollection[];
        documents?: KnowledgeDocument[];
      };
      const nextCollections = data.collections || [];
      const selectedId =
        preferredCollectionId && nextCollections.some((collection) => collection.id === preferredCollectionId)
          ? preferredCollectionId
          : nextCollections[0]?.id || "";
      setCollections(nextCollections);
      setActiveCollectionId(selectedId);
      setDocuments(
        selectedId
          ? (data.documents || []).filter((document) => document.collectionId === selectedId)
          : [],
      );
      syncCollectionDrafts(nextCollections.find((collection) => collection.id === selectedId));
    },
    [apiFetch, connected, syncCollectionDrafts],
  );

  const loadDocuments = useCallback(
    async (collectionId: string) => {
      setActiveCollectionId(collectionId);
      setResults([]);
      const collection = collections.find((item) => item.id === collectionId);
      syncCollectionDrafts(collection);
      if (!collectionId || !connected) {
        setDocuments([]);
        return;
      }
      const response = await apiFetch(`/api/knowledge?collectionId=${encodeURIComponent(collectionId)}`);
      const data = (await response.json()) as { documents?: KnowledgeDocument[] };
      setDocuments(data.documents || []);
    },
    [apiFetch, collections, connected, syncCollectionDrafts],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKnowledge().catch((error) =>
        onNotify(error instanceof Error ? error.message : "知识库加载失败"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
	}, [loadKnowledge, onNotify]);

	useEffect(() => {
	  if (refreshVersion === 0 || !connected) return;
	  const timer = window.setTimeout(() => {
		void apiFetch("/api/knowledge").then(async (response) => {
		  const data = (await response.json()) as { collections?: KnowledgeCollection[]; documents?: KnowledgeDocument[] };
		  const nextCollections = data.collections || [];
		  const latest = nextCollections.find((collection) => collection.id === activeCollectionId);
		  setCollections(nextCollections);
		  setDocuments(activeCollectionId ? (data.documents || []).filter((document) => document.collectionId === activeCollectionId) : []);
		  if (activeCollectionId && !latest) onNotify("当前知识库已被 Agent 删除");
		  else if (latest && collectionRevision && latest.revision !== collectionRevision) onNotify("Agent 已修改当前知识库；你的设置草稿已保留，保存前请重新选择知识库");
		}).catch((error) => onNotify(error instanceof Error ? error.message : "知识库刷新失败"));
	  }, 0);
	  return () => window.clearTimeout(timer);
	}, [activeCollectionId, apiFetch, collectionRevision, connected, onNotify, refreshVersion]);

  async function createCollection(event: FormEvent) {
    event.preventDefault();
    const nextName = collectionName.trim();
    if (!nextName) return;
    setLoading(true);
    try {
      const response = await apiFetch("/api/knowledge/collections", {
        method: "PUT",
        body: JSON.stringify({
          name: nextName,
          description: "",
          toolName: normalizedToolName(nextName),
          retrievalMode: "fast",
          agentEnabled: false,
        }),
      });
      const data = (await response.json()) as { collection: KnowledgeCollection };
      setCollectionName("");
      await loadKnowledge(data.collection.id);
      onNotify("知识库已创建，可以直接导入资料");
    } finally {
      setLoading(false);
    }
  }

  async function updateCollection(patch: Partial<KnowledgeCollection>, message: string) {
    if (!activeCollection) return;
    setLoading(true);
    try {
      const response = await apiFetch("/api/knowledge/collections", {
        method: "PUT",
        body: JSON.stringify({
          id: activeCollection.id,
		  expectedRevision: collectionRevision,
          name: patch.name ?? nameDraft ?? activeCollection.name,
          description: patch.description ?? descriptionDraft,
          toolName: patch.toolName ?? toolNameDraft,
          retrievalMode: patch.retrievalMode ?? retrievalModeDraft,
          agentEnabled: patch.agentEnabled ?? activeCollection.agentEnabled,
        }),
      });
      const data = (await response.json()) as { collection: KnowledgeCollection };
      await loadKnowledge(data.collection.id);
      onNotify(message);
    } finally {
      setLoading(false);
    }
  }

  async function importFiles(files: File[]) {
    if (!activeCollectionId || files.length === 0) return;
    setLoading(true);
    try {
      let imported = 0;
      for (const file of files) {
        const content = await readKnowledgeFile(file);
        if (!content.trim()) throw new Error(`${file.name} 没有可索引的文本。`);
        await apiFetch("/api/knowledge/documents", {
          method: "PUT",
          body: JSON.stringify({
            collectionId: activeCollectionId,
            title: file.name.replace(/\.[^.]+$/u, ""),
            source: file.name,
            content,
          }),
        });
        imported += 1;
      }
      await loadKnowledge(activeCollectionId);
      onNotify(`已导入并索引 ${imported} 份文档`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void importFiles([...event.dataTransfer.files]).catch((error) =>
      onNotify(error instanceof Error ? error.message : "文件导入失败"),
    );
  }

  async function saveDocument(event: FormEvent) {
    event.preventDefault();
    if (!activeCollectionId) return;
    setLoading(true);
    try {
      await apiFetch("/api/knowledge/documents", {
        method: "PUT",
        body: JSON.stringify({
          collectionId: activeCollectionId,
          title: documentTitle,
          source: documentSource,
          content: documentContent,
        }),
      });
      setDocumentTitle("");
      setDocumentSource("");
      setDocumentContent("");
      setDocumentOpen(false);
      await loadKnowledge(activeCollectionId);
      onNotify("文档已切分并建立本地索引");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(documentId: string) {
    if (!window.confirm("删除这份文档及其索引？")) return;
	const document = documents.find((item) => item.id === documentId);
	if (!document) return;
	await apiFetch(`/api/knowledge/documents/${encodeURIComponent(documentId)}`, { method: "DELETE", headers: { "X-Resource-Revision": document.revision } });
    await loadKnowledge(activeCollectionId);
    onNotify("文档已删除");
  }

  async function deleteCollection() {
    if (!activeCollection || !window.confirm(`删除“${activeCollection.name}”及全部文档？`)) return;
	await apiFetch(`/api/knowledge/collections/${encodeURIComponent(activeCollection.id)}`, {
      method: "DELETE",
	  headers: { "X-Resource-Revision": collectionRevision },
    });
    setActiveCollectionId("");
    await loadKnowledge();
    onNotify("知识库已删除");
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await apiFetch("/api/knowledge/search", {
        method: "POST",
        body: JSON.stringify({
          query: searchQuery,
          ...(activeCollectionId ? { collectionId: activeCollectionId } : {}),
          retrievalMode: retrievalModeDraft,
          topK: 8,
        }),
      });
      const data = (await response.json()) as { results?: SearchResult[] };
      setResults(data.results || []);
      if (!data.results?.length) onNotify("没有找到相关片段，可以换一种问法再试");
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="system-tools-view knowledge-view">
      <div className="settings-header system-tools-header knowledge-header">
        <div>
          <span className="eyebrow">KNOWLEDGE TOOLS</span>
          <h1>知识库</h1>
          <p>资料仅保存在本机；每个知识库都可以独立开启为 Agent 工具。</p>
        </div>
        <div className="knowledge-header-actions">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            multiple
            accept={acceptedFileTypes}
            onChange={(event) => void importFiles([...(event.target.files || [])]).catch((error) => onNotify(error instanceof Error ? error.message : "文件导入失败"))}
          />
          <button className="secondary-button" type="button" disabled={!activeCollectionId || loading} onClick={() => setDocumentOpen(true)}>粘贴文本</button>
          <button className="primary-button" type="button" disabled={!activeCollectionId || loading} onClick={() => fileInputRef.current?.click()}>＋ 导入文件</button>
        </div>
      </div>

      <div className="knowledge-layout">
        <aside className="knowledge-sidebar">
          <form className="inline-create" onSubmit={createCollection}>
            <input value={collectionName} placeholder="新建知识库" aria-label="新知识库名称" onChange={(event) => setCollectionName(event.target.value)} />
            <button type="submit" disabled={!connected || loading || !collectionName.trim()}>＋</button>
          </form>
          <div className="panel-label panel-label-row knowledge-list-label"><span>我的知识库</span><span>{collections.length}</span></div>
          <div className="knowledge-collection-list">
            {collections.map((collection) => (
              <button className={collection.id === activeCollectionId ? "is-active" : ""} key={collection.id} type="button" onClick={() => void loadDocuments(collection.id)}>
                <span className="collection-icon">▤</span>
                <span><strong>{collection.name}</strong><small>{collection.documentCount} 文档 · {collection.chunkCount} 片段</small></span>
                {collection.agentEnabled ? <em title="Agent 工具已开启">●</em> : null}
              </button>
            ))}
            {!collections.length ? <div className="mini-empty">创建一个知识库，把常用资料交给 Agent。</div> : null}
          </div>
        </aside>

        <main className="knowledge-main">
          {activeCollection ? (
            <>
              <div className="knowledge-toolbar">
                <div>
                  <strong>{activeCollection.name}</strong>
                  <small>更新于 {new Date(activeCollection.updatedAt).toLocaleString()}</small>
                </div>
                <button className="danger-link" type="button" onClick={deleteCollection}>删除知识库</button>
              </div>

              <section className="knowledge-summary-grid">
                <article><span>文档</span><strong>{activeCollection.documentCount}</strong><small>已导入资料</small></article>
                <article><span>索引片段</span><strong>{activeCollection.chunkCount}</strong><small>按需本地检索</small></article>
                <article><span>检索方式</span><strong>{retrievalModeDraft === "smart" ? "智能" : "快速"}</strong><small>{retrievalModeDraft === "smart" ? "调用时使用当前模型" : "零模型消耗"}</small></article>
              </section>

              <div className="knowledge-content-grid">
                <section className="knowledge-files-panel">
                  <div className="knowledge-section-heading"><div><strong>资料</strong><small>支持文本、Markdown、CSV、JSON、HTML 与代码文件</small></div></div>
                  <div className={`knowledge-drop-zone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onFileDrop}>
                    <span>⇧</span><div><strong>拖入文件即可建立索引</strong><small>文件只在本机处理，单个不超过 2 MB</small></div><button type="button" onClick={() => fileInputRef.current?.click()}>选择文件</button>
                  </div>
                  <div className="knowledge-documents">
                    {documents.map((document) => (
                      <article key={document.id}>
                        <span className="document-icon">{fileKind(document.source || document.title)}</span>
                        <div><strong>{document.title}</strong><small>{document.chunkCount} 片段 · {Math.max(1, Math.round(document.contentLength / 1000))}k 字符{document.source ? ` · ${document.source}` : ""}</small></div>
                        <button className="danger-link" type="button" onClick={() => void deleteDocument(document.id)}>删除</button>
                      </article>
                    ))}
                    {!documents.length ? <div className="knowledge-empty-row">暂无资料，拖入文件或粘贴文本开始使用。</div> : null}
                  </div>
                </section>

                <aside className="knowledge-tool-panel">
                  <div className="knowledge-section-heading"><div><strong>Agent 工具</strong><small>开启后 Agent 可按需检索这个知识库</small></div><button className={`tool-toggle ${activeCollection.agentEnabled ? "is-on" : ""}`} type="button" disabled={loading} aria-label="允许 Agent 使用" onClick={() => void updateCollection({ agentEnabled: !activeCollection.agentEnabled }, activeCollection.agentEnabled ? "已停止 Agent 使用该知识库" : "知识库工具已启用，Agent 现在可以调用") }><span /></button></div>
                  <label className="field"><span>名称</span><input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label>
                  <label className="field"><span>工具名</span><input className="mono-input" value={toolNameDraft} onChange={(event) => setToolNameDraft(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></label>
                  <label className="field"><span>用途描述</span><textarea value={descriptionDraft} placeholder="例如：产品使用说明和常见问题，回答产品相关问题前先检索" onChange={(event) => setDescriptionDraft(event.target.value)} /></label>
                  <div className="field"><span>检索模式</span><div className="retrieval-options"><button className={retrievalModeDraft === "fast" ? "is-active" : ""} type="button" onClick={() => setRetrievalModeDraft("fast")}><strong>快速</strong><small>本地全文检索</small></button><button className={retrievalModeDraft === "smart" ? "is-active" : ""} type="button" onClick={() => setRetrievalModeDraft("smart")}><strong>智能</strong><small>LLM 改写查询</small></button></div></div>
                  {retrievalModeDraft === "smart" ? <div className="smart-retrieval-note">智能模式复用当前 Agent 模型，仅在检索时调用；模型不可用时自动退回本地检索。</div> : null}
                  <button className="secondary-button knowledge-settings-save" type="button" disabled={loading || !nameDraft.trim() || !toolNameDraft.trim()} onClick={() => void updateCollection({}, "知识库设置已保存")}>{loading ? "保存中…" : "保存设置"}</button>
                </aside>
              </div>

              <section className="knowledge-test-section">
                <div className="knowledge-section-heading"><div><strong>测试检索</strong><small>用和 Agent 相同的方式检查结果</small></div></div>
                <form className="knowledge-search" onSubmit={search}><span>⌕</span><input value={searchQuery} placeholder="输入一个真实问题，例如：退款规则是什么？" onChange={(event) => setSearchQuery(event.target.value)} /><button type="submit" disabled={!connected || searching || !searchQuery.trim()}>{searching ? "检索中…" : "检索"}</button></form>
                {results.length ? <div className="search-results">{results.map((result, index) => <article key={`${result.documentId}-${index}`}><div><strong>{result.title}</strong><small>相关度 {Math.round(result.score * 100)}%</small></div><p>{result.content}</p></article>)}</div> : null}
              </section>
            </>
          ) : (
            <div className="large-empty"><span>▤</span><strong>创建你的第一个知识库</strong><p>不需要服务器。导入资料后，开启开关就能让 Agent 把它当作工具使用。</p></div>
          )}
        </main>
      </div>

      {documentOpen ? (
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" type="button" aria-label="关闭" onClick={() => setDocumentOpen(false)} />
          <form className="modal-card knowledge-modal" onSubmit={saveDocument}>
            <div className="modal-heading"><div className="modal-symbol neutral">▤</div><div><h2>粘贴文本资料</h2><p>内容会在本机自动切分并建立索引。</p></div><button className="icon-button" type="button" onClick={() => setDocumentOpen(false)}>×</button></div>
            <label className="field"><span>标题</span><input required value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} /></label>
            <label className="field"><span>来源（可选）</span><input value={documentSource} placeholder="文件名、URL 或备注" onChange={(event) => setDocumentSource(event.target.value)} /></label>
            <label className="field"><span>正文</span><textarea required className="knowledge-editor" value={documentContent} placeholder="粘贴纯文本或 Markdown…" onChange={(event) => setDocumentContent(event.target.value)} /></label>
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setDocumentOpen(false)}>取消</button><button className="primary-button" type="submit" disabled={loading}>{loading ? "索引中…" : "保存并索引"}</button></div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
