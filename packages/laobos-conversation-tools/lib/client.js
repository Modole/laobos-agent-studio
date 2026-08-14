/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-conversation-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const ReactDOM = require("react-dom");
    const Primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const { createElement: h, useEffect, useMemo, useRef, useState } = React;

    const css = `
      .lbs-conv-actions{align-items:center;display:flex;gap:4px;position:relative}
      .lbs-conv-action-button{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;font:inherit;font-size:12px;height:26px;justify-content:center;padding:0 7px}
      .lbs-conv-action-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-conv-action-button:disabled{cursor:not-allowed;opacity:.45}
      .lbs-conv-menu{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:var(--dsw-shadow-lv2);display:flex;flex-direction:column;gap:2px;min-width:168px;padding:5px;position:absolute;right:0;top:30px;z-index:2147483100}
      .lbs-conv-menu.fixed{bottom:auto;box-sizing:border-box;max-height:calc(100vh - 16px);max-width:calc(100vw - 16px);overflow-y:auto;position:fixed;right:auto}.lbs-conv-menu button{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:inherit;font-size:13px;line-height:30px;padding:0 9px;text-align:left;white-space:nowrap}.lbs-conv-menu button:hover,.lbs-conv-menu button:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}.lbs-conv-menu button.danger{color:#d94b4b}.lbs-conv-menu button:disabled{cursor:not-allowed;opacity:.45}
      .lbs-conv-inline-action{align-items:center;appearance:none;background:transparent;border:0;border-radius:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;height:28px;justify-content:center;padding:6px;width:28px}.lbs-conv-inline-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.lbs-conv-inline-action:disabled{background:transparent;color:var(--dsw-alias-label-tertiary);cursor:not-allowed;opacity:.4}.lbs-conv-inline-action svg{display:block}
      [data-time-hover-root]:not([data-turn-tail]){align-items:flex-end!important;flex-direction:column!important;gap:6px!important}
      .lbs-conv-overlay{align-items:center;background:rgba(0,0,0,.28);display:flex;inset:0;justify-content:center;padding:24px;position:fixed;z-index:2147483200}.lbs-conv-dialog{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);box-sizing:border-box;max-width:620px;padding:18px;width:100%}.lbs-conv-dialog h2{font-size:17px;margin:0 0 5px}.lbs-conv-dialog p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin:0 0 12px}.lbs-conv-dialog textarea{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;box-sizing:border-box;color:inherit;font:inherit;line-height:21px;min-height:150px;padding:10px;resize:vertical;width:100%}.lbs-conv-dialog footer{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.lbs-conv-primary,.lbs-conv-secondary{appearance:none;border:0;border-radius:8px;cursor:pointer;font:inherit;font-size:13px;height:34px;padding:0 13px}.lbs-conv-primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-conv-secondary{background:var(--dsw-alias-interactive-bg-secondary);color:inherit}.lbs-conv-primary:disabled{cursor:not-allowed;opacity:.5}.lbs-conv-feedback{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      [data-phase]>[data-slot="conversation.session.header"]>header{padding:6px 28px 6px 20px!important}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-conversation-tools"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-conversation-tools";
      style.textContent = css;
      document.head.append(style);
    }

    const cleanText = (value) => String(value || "").replace(/\s+/gu, " ").trim();
    const rawContentText = (content) => Array.isArray(content)
      ? content.filter((part) => part?.type === "text").map((part) => part.text || "").join("\n").trim()
      : "";
    const FILE_ENVELOPE_PATTERN = /<laobos-file>\s*([\s\S]*?)\s*<\/laobos-file>/gu;
    const contentProjection = (content) => {
      const files = [];
      const envelopes = [];
      const text = rawContentText(content).replace(FILE_ENVELOPE_PATTERN, (match, payload) => {
        try {
          const file = JSON.parse(payload);
          if (file?.kind !== "file" || file?.version !== 1 || typeof file.name !== "string" || typeof file.path !== "string") return match;
          files.push(file);
          envelopes.push(match);
          return "";
        } catch { return match; }
      }).replace(/\n{3,}/gu, "\n\n").trim();
      return { text, files, envelopes };
    };
    const appendFileEnvelopes = (text, envelopes) => [String(text || "").trim(), ...envelopes].filter(Boolean).join("\n");
    const escapeHtml = (value) => String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

    function orderedNodes(snapshot) {
      return snapshot?.chat?.order
        ?.map((key) => snapshot.chat.nodes.get(key))
        .filter((node) => node !== undefined) || [];
    }

    function latestUser(snapshot) {
      return orderedNodes(snapshot).findLast((node) =>
        node?.data?.kind === "user" || node?.data?.kind === "steering");
    }

    function nodeTurn(node) {
      const location = node?.location;
      if (location?.kind === "turn" || location?.kind === "step") return location.turn.turn;
      const turn = Number(node?.data?.turn);
      return Number.isFinite(turn) ? turn : undefined;
    }

    function previousBoundary(snapshot, node) {
      const currentTurn = nodeTurn(node);
      if (currentTurn === undefined) return undefined;
      const order = snapshot.chat.timeline?.turnOrder || [];
      const index = order.indexOf(currentTurn);
      if (index <= 0) return null;
      const previousTurn = order[index - 1];
      return snapshot.turnEnds?.get(previousTurn) ?? null;
    }

    function scopedConversation(ctx, sessionId) {
      const scoped = ctx.sessions.scope(sessionId);
      const conversation = scoped?.get("conversation");
      if (!conversation) throw new Error("当前会话的发送服务尚未就绪。 ");
      return conversation;
    }

    async function editAndResend(ctx, sessionId, text) {
      const trimmed = String(text || "").trim();
      if (!trimmed) throw new Error("编辑后的消息不能为空。 ");
      const source = ctx.sessions.binding(sessionId)?.session;
      if (!source) throw new Error("会话尚未载入。 ");
      await source.open();
      const snapshot = source.getSnapshot();
      if (snapshot.running) throw new Error("会话运行中，暂时不能编辑重发。 ");
      const user = latestUser(snapshot);
      if (!user) throw new Error("没有可以编辑的用户消息。 ");
      const boundary = previousBoundary(snapshot, user);
      let childId;
      if (boundary === null) {
        const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
        childId = await ctx.sessions.create({ cwd });
      } else if (boundary === undefined) {
        throw new Error("无法确定上一轮的稳定边界。 ");
      } else {
        childId = await ctx.sessions.fork({ sessionId, atSeq: boundary, increaseTitle: true });
      }
      ctx.sessions.open(childId);
      await scopedConversation(ctx, childId).send(trimmed);
      return childId;
    }

    async function retryLast(ctx, sessionId) {
      const session = ctx.sessions.binding(sessionId)?.session;
      if (!session) throw new Error("会话尚未载入。 ");
      await session.open();
      const snapshot = session.getSnapshot();
      if (snapshot.running) throw new Error("会话运行中，不能重试。 ");
      const text = rawContentText(latestUser(snapshot)?.data?.content);
      if (!text) throw new Error("没有可以重试的纯文本用户消息。 ");
      await scopedConversation(ctx, sessionId).send(text);
    }

    function assistantText(node) {
      const blocks = node?.data?.blocks;
      if (!Array.isArray(blocks)) return "";
      return blocks.filter((block) => block?.kind === "text").map((block) => block.text || "").join("\n").trim();
    }

    function conversationHtml(sessionId, title, snapshot) {
      const rows = [];
      for (const node of orderedNodes(snapshot)) {
        const kind = node?.data?.kind;
        if (kind === "user" || kind === "steering") {
          const projected = contentProjection(node.data.content);
          const fileRows = projected.files.map((file) => `<div class="file"><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.path)}</small></div>`).join("");
          rows.push(`<section class="message user"><header>用户</header>${projected.text ? `<div>${escapeHtml(projected.text).replaceAll("\n", "<br>")}</div>` : ""}${fileRows}</section>`);
        } else if (kind === "assistant") {
          const text = assistantText(node);
          if (text) rows.push(`<section class="message assistant"><header>劳博士</header><div>${escapeHtml(text).replaceAll("\n", "<br>")}</div></section>`);
        } else if (kind === "turn-error" || kind === "retry" || kind === "turn-max-tokens") {
          rows.push(`<details class="activity"><summary>运行记录：${escapeHtml(kind)}</summary><pre>${escapeHtml(cleanText(node?.data?.message || node?.data?.error || ""))}</pre></details>`);
        } else if (kind === "tool-result") {
          rows.push(`<details class="activity"><summary>工具：${escapeHtml(node?.data?.name || "调用结果")}</summary><pre>${escapeHtml(cleanText(node?.data?.output || node?.data?.result || ""))}</pre></details>`);
        }
      }
      const exportedAt = new Date().toLocaleString("zh-CN");
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{color:#242424;font:14px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0}h1{font-size:23px;margin:0 0 4px}.meta{border-bottom:1px solid #ddd;color:#777;font-size:11px;margin-bottom:20px;padding-bottom:12px}.message{break-inside:avoid;border:1px solid #ddd;border-radius:10px;margin:0 0 12px;padding:12px 14px}.message header{color:#666;font-size:11px;font-weight:700;margin-bottom:6px}.user{background:#f4f7ff}.assistant{background:#fff}.file{background:#fff;border:1px solid #d9deea;border-radius:8px;margin-top:8px;padding:8px 10px}.file strong,.file small{display:block}.file small{color:#667085;font:9px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}.activity{break-inside:avoid;border-left:3px solid #ccc;color:#555;margin:8px 0;padding:4px 10px}.activity summary{cursor:default;font-size:11px}.activity pre{font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap}footer{border-top:1px solid #ddd;color:#888;font-size:10px;margin-top:24px;padding-top:8px}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">会话 ${escapeHtml(sessionId)} · 导出于 ${escapeHtml(exportedAt)}</div>${rows.join("")}<footer>由劳博士导出</footer></body></html>`;
    }

    async function exportConversation(ctx, sessionId) {
      const bridge = window.laobosDesktop;
      if (!bridge?.capabilities?.conversationPdf) throw new Error("PDF 导出仅在桌面版中可用。 ");
      const session = ctx.sessions.binding(sessionId)?.session;
      if (!session) throw new Error("会话尚未载入。 ");
      await session.open();
      let snapshot = session.getSnapshot();
      let pages = 0;
      while (snapshot.hasMore && pages < 500) {
        await session.loadOlder();
        snapshot = session.getSnapshot();
        pages += 1;
      }
      const row = ctx.sessions.list.getSnapshot().byId[sessionId];
      const title = cleanText(row?.title) || "劳博士会话";
      return bridge.pdf.exportConversation({
        html: conversationHtml(sessionId, title, snapshot),
        suggestedName: title,
      });
    }

    async function deleteConversation(ctx, sessionId) {
      const row = ctx.sessions.list.getSnapshot().byId[sessionId];
      const title = cleanText(row?.title) || "当前会话";
      if (!window.confirm(`确定删除“${title}”吗？\n\n会话会先停止并归档，再移动到劳博士回收站。`)) return false;
      const session = ctx.sessions.binding(sessionId)?.session;
      if (session) {
        await session.open();
        if (session.getSnapshot().running) await scopedConversation(ctx, sessionId).cancel();
      }
      await ctx.workspaces.archiveSession(sessionId);
      const result = await window.laobosDesktop?.sessions?.trash?.({ sessionId });
      if (result && !result.moved) console.warn("session archived but artifact was not found", sessionId);
      return true;
    }

    function EditDialog({ initialValue, allowEmpty, busy, onCancel, onConfirm }) {
      const [value, setValue] = useState(initialValue);
      const area = useRef(null);
      useEffect(() => { area.current?.focus(); area.current?.select(); }, []);
      const canSubmit = allowEmpty || Boolean(value.trim());
      return h("div", { className: "lbs-conv-overlay", role: "presentation", onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) onCancel(); } },
        h("div", { className: "lbs-conv-dialog", role: "dialog", "aria-modal": true, "aria-labelledby": "lbs-edit-title" },
          h("h2", { id: "lbs-edit-title" }, "编辑上一轮并重新发送"),
          h("p", null, "原会话不会被改写；劳博士会从上一稳定轮次创建一个新分支。"),
          h("textarea", { ref: area, value, disabled: busy, onChange: (event) => setValue(event.target.value), onKeyDown: (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit && !busy) onConfirm(value); } }),
          h("footer", null,
            h("button", { className: "lbs-conv-secondary", disabled: busy, onClick: onCancel }, "取消"),
            h("button", { className: "lbs-conv-primary", disabled: busy || !canSubmit, onClick: () => onConfirm(value) }, busy ? "正在创建分支…" : "创建分支并发送"),
          ),
        ),
      );
    }

    function latestUserActionTarget(nodeKey) {
      if (!nodeKey) return null;
      const rows = document.querySelectorAll('[data-chat-anchor-key]');
      const row = [...rows].find((candidate) => candidate.dataset.chatAnchorKey === nodeKey);
      const userRow = row?.querySelector('[data-time-hover-root]');
      const target = userRow?.lastElementChild;
      return target instanceof HTMLElement ? target : null;
    }

    function ConversationActions({ sessionId, useSession }) {
      const snapshot = useSession((value) => value);
      const [open, setOpen] = useState(false);
      const [editing, setEditing] = useState(false);
      const [busy, setBusy] = useState("");
      const [feedback, setFeedback] = useState("");
      const [messageActionTarget, setMessageActionTarget] = useState(null);
      const root = useRef(null);
      const user = useMemo(() => latestUser(snapshot), [snapshot]);
      const projection = useMemo(() => contentProjection(user?.data?.content), [user]);
      const initialText = projection.text;
      const hasContent = Boolean(initialText || projection.envelopes.length);

      useEffect(() => {
        let frame = 0;
        const locate = () => {
          frame = 0;
          const next = latestUserActionTarget(user?.key);
          setMessageActionTarget((current) => current === next ? current : next);
        };
        const schedule = () => {
          if (frame) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(locate);
        };
        locate();
        const observer = new MutationObserver(schedule);
        observer.observe(document.querySelector('[data-conversation-scroll]') || document.body, { childList: true, subtree: true });
        return () => {
          observer.disconnect();
          if (frame) cancelAnimationFrame(frame);
        };
      }, [user?.key]);

      useEffect(() => {
        if (!open) return undefined;
        const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
        const key = (event) => { if (event.key === "Escape") setOpen(false); };
        document.addEventListener("pointerdown", close);
        window.addEventListener("keydown", key);
        return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
      }, [open]);

      const run = async (label, task) => {
        setOpen(false); setBusy(label); setFeedback("");
        try { const result = await task(); setFeedback(result?.canceled ? "已取消" : `${label}完成`); }
        catch (error) { setFeedback(error instanceof Error ? error.message : String(error)); }
        finally { setBusy(""); }
      };

      const unavailable = snapshot.running || Boolean(busy) || !hasContent;
      const inlineActions = messageActionTarget && hasContent ? ReactDOM.createPortal(
        h(React.Fragment, null,
          h(Primitives.Tooltip, { label: "编辑上一轮并重发", side: "bottom" },
            h("button", { className: "lbs-conv-inline-action", type: "button", disabled: unavailable, "aria-label": "编辑上一轮并重发", onClick: () => { setOpen(false); setEditing(true); } },
              h(Primitives.IconEditOutline16, { size: 16 }))),
          h(Primitives.Tooltip, { label: "重试上一轮", side: "bottom" },
            h("button", { className: "lbs-conv-inline-action", type: "button", disabled: unavailable, "aria-label": "重试上一轮", onClick: () => run("重试", () => retryLast(module.ctx, sessionId)) },
              h(Primitives.IconRefreshOutline16, { size: 16 }))),
        ),
        messageActionTarget,
      ) : null;

      return h("div", { className: "lbs-conv-actions", ref: root },
        feedback ? h("span", { className: "lbs-conv-feedback", title: feedback }, feedback) : null,
        h("button", { className: "lbs-conv-action-button", type: "button", disabled: Boolean(busy), "aria-label": "会话操作", onClick: () => setOpen((value) => !value) },
          h(Primitives.IconEllipsisOutline16, { size: 16 })),
        open ? h("div", { className: "lbs-conv-menu", role: "menu" },
          h("button", { onClick: () => run("导出", () => exportConversation(module.ctx, sessionId)) }, "导出会话为 PDF"),
          h("button", { className: "danger", onClick: () => run("删除", () => deleteConversation(module.ctx, sessionId)) }, "删除会话"),
        ) : null,
        editing ? h(EditDialog, { initialValue: initialText, allowEmpty: projection.envelopes.length > 0, busy: busy === "发送", onCancel: () => setEditing(false), onConfirm: (value) => run("发送", async () => { await editAndResend(module.ctx, sessionId, appendFileEnvelopes(value, projection.envelopes)); setEditing(false); }) }) : null,
        inlineActions,
      );
    }

    function rowTitle(row) {
      const spans = [...row.querySelectorAll(":scope > span")];
      const candidate = spans.find((span) => cleanText(span.textContent).length > 0 && !/^\d+[smhdwy]$/u.test(cleanText(span.textContent)));
      return cleanText(candidate?.textContent || row.textContent);
    }

    function resolveSessionId(ctx, row) {
      const list = ctx.sessions.list.getSnapshot();
      if (row.getAttribute("aria-selected") === "true" && list.current) return list.current;
      const text = rowTitle(row);
      const candidates = list.ids.filter((id) => cleanText(list.byId[id]?.title) === text);
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1) {
        const similarRows = [...document.querySelectorAll('[role="treeitem"]')].filter((item) => rowTitle(item) === text);
        return candidates[Math.max(0, similarRows.indexOf(row))] || candidates[0];
      }
      return undefined;
    }

    function resolveWorkspace(ctx, row) {
      const title = rowTitle(row);
      return ctx.workspaces.list.getSnapshot().items.find((item) => cleanText(item.title) === title);
    }

    function openDesktopTool(tool, cwd) {
      window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", { detail: { tool, cwd } }));
    }

    function ContextMenuBridge() {
      const [menu, setMenu] = useState(null);
      useEffect(() => {
        const onContextMenu = (event) => {
          const row = event.target instanceof Element ? event.target.closest('[role="treeitem"]') : null;
          if (!row || !row.closest('[role="tree"]')) return;
          const workspace = row.hasAttribute("aria-expanded") ? resolveWorkspace(module.ctx, row) : undefined;
          const sessionId = workspace ? undefined : resolveSessionId(module.ctx, row);
          if (!workspace && !sessionId) return;
          event.preventDefault(); event.stopPropagation();
          const width = 210; const height = workspace ? 170 : 144;
          setMenu({ kind: workspace ? "workspace" : "session", workspace, sessionId, x: Math.min(event.clientX, window.innerWidth - width - 8), y: Math.min(event.clientY, window.innerHeight - height - 8) });
        };
        const close = () => setMenu(null);
        const key = (event) => { if (event.key === "Escape") close(); };
        document.addEventListener("contextmenu", onContextMenu, true);
        document.addEventListener("pointerdown", close);
        window.addEventListener("blur", close);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", key);
        return () => { document.removeEventListener("contextmenu", onContextMenu, true); document.removeEventListener("pointerdown", close); window.removeEventListener("blur", close); window.removeEventListener("resize", close); window.removeEventListener("keydown", key); };
      }, []);
      if (!menu) return null;
      const act = (task) => async (event) => { event.stopPropagation(); setMenu(null); try { await task(); } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); } };
      const style = { left: `${menu.x}px`, top: `${menu.y}px` };
      if (menu.kind === "workspace") {
        const item = menu.workspace;
        return h("div", { className: "lbs-conv-menu fixed", style, role: "menu", onPointerDown: (event) => event.stopPropagation() },
          h("button", { onClick: act(() => openDesktopTool("files", item.path)) }, "文件管理器"),
          h("button", { onClick: act(() => openDesktopTool("git", item.path)) }, "版本中心"),
          h("button", { onClick: act(() => openDesktopTool("terminal", item.path)) }, "在终端中打开"),
          h("button", { onClick: act(async () => { const title = window.prompt("工作区名称", item.title); if (title?.trim()) await module.ctx.workspaces.rename(item.workspaceId, title.trim()); }) }, "重命名工作区"),
          h("button", { className: "danger", onClick: act(async () => { if (window.confirm(`从侧栏移除“${item.title}”？\n不会删除目录和会话。`)) await module.ctx.workspaces.delete(item.workspaceId); }) }, "从侧栏移除"),
        );
      }
      const id = menu.sessionId;
      return h("div", { className: "lbs-conv-menu fixed", style, role: "menu", onPointerDown: (event) => event.stopPropagation() },
        h("button", { onClick: act(() => module.ctx.sessions.open(id)) }, "打开会话"),
        h("button", { onClick: act(() => exportConversation(module.ctx, id)) }, "导出为 PDF"),
        h("button", { onClick: act(async () => { const session = module.ctx.sessions.binding(id)?.session; const current = module.ctx.sessions.list.getSnapshot().byId[id]?.title || ""; const title = window.prompt("会话名称", current); if (!title?.trim() || !session) return; const result = await session.rename(title.trim()); if (!result.ok) throw new Error(result.error.message); }) }, "重命名会话"),
        h("button", { className: "danger", onClick: act(() => deleteConversation(module.ctx, id)) }, "删除会话"),
      );
    }

    const inject = ["slots", "sessions", "workspaces", "conversation"];
    function apply(ctx) {
      module.ctx = ctx;
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
        name: "conversation.session.header.utilities",
        id: "laobos-conversation-actions",
        order: 40,
        label: "会话操作",
      }, ConversationActions));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "laobos-context-menu-bridge",
        order: 30,
      }, ContextMenuBridge));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
