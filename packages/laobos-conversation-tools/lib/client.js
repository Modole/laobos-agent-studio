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
      [data-chat-flow-kind="context"]{display:none!important}
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

    const EXPORT_ROOT_ID = "lbs-conversation-export-root";
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

    async function settleFrames(count = 3) {
      for (let index = 0; index < count; index += 1) await nextFrame();
    }

    function visibleConversationScroll() {
      const candidates = [...document.querySelectorAll("[data-conversation-scroll]")]
        .filter((element) => !element.closest(`#${EXPORT_ROOT_ID}`));
      return candidates.find((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }) || candidates[0] || null;
    }

    async function waitForCurrentSession(ctx, sessionId) {
      const deadline = performance.now() + 10_000;
      while (performance.now() < deadline) {
        if (ctx.sessions.list.getSnapshot().current === sessionId) return;
        await nextFrame();
      }
      throw new Error("等待会话界面切换超时。 ");
    }

    async function loadCompleteSnapshot(session) {
      let snapshot = session.getSnapshot();
      let previousMarker = "";
      while (snapshot.hasMore) {
        const marker = `${snapshot.chat.order[0] || ""}:${snapshot.chat.order.length}`;
        if (marker === previousMarker) throw new Error("历史会话分页没有继续前进，无法保证完整导出。 ");
        previousMarker = marker;
        await session.loadOlder();
        snapshot = session.getSnapshot();
      }
      return snapshot;
    }

    async function waitForRenderedConversation(snapshot) {
      await settleFrames();
      const scroll = visibleConversationScroll();
      if (!scroll) throw new Error("找不到当前会话的渲染区域。 ");

      // The Chat view has one keyed seat for every ordered DSH node. Other active
      // views (for example Trajectory) do not expose these seats and are cloned as-is.
      const expected = snapshot.chat.order;
      if (scroll.querySelector("[data-chat-flow-key]") && expected.length > 0) {
        const deadline = performance.now() + 10_000;
        while (performance.now() < deadline) {
          const rendered = new Set([...scroll.querySelectorAll("[data-chat-flow-key]")]
            .map((element) => element.dataset.chatFlowKey));
          if (expected.every((key) => rendered.has(key))) break;
          await nextFrame();
        }
        const rendered = new Set([...scroll.querySelectorAll("[data-chat-flow-key]")]
          .map((element) => element.dataset.chatFlowKey));
        if (!expected.every((key) => rendered.has(key))) {
          throw new Error("会话历史尚未全部渲染，已停止导出以避免生成不完整文件。 ");
        }
      }
      return scroll;
    }

    function copyLiveElementState(source, clone) {
      const originals = [source, ...source.querySelectorAll("*")];
      const copies = [clone, ...clone.querySelectorAll("*")];
      for (let index = 0; index < originals.length; index += 1) {
        const original = originals[index];
        const copy = copies[index];
        if (original instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
          copy.value = original.value;
          copy.checked = original.checked;
        } else if (original instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) {
          copy.value = original.value;
          copy.textContent = original.value;
        } else if (original instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) {
          copy.value = original.value;
        } else if (original instanceof HTMLImageElement && copy instanceof HTMLImageElement) {
          copy.src = original.currentSrc || original.src;
          copy.removeAttribute("srcset");
          copy.removeAttribute("loading");
        } else if (original instanceof HTMLCanvasElement && copy instanceof HTMLCanvasElement) {
          try {
            const image = document.createElement("img");
            image.src = original.toDataURL("image/png");
            image.className = copy.className;
            image.style.cssText = copy.style.cssText;
            const box = original.getBoundingClientRect();
            if (box.width > 0) image.style.width = `${box.width}px`;
            if (box.height > 0) image.style.height = `${box.height}px`;
            copy.replaceWith(image);
          } catch { /* A tainted third-party canvas remains as an empty canvas. */ }
        } else if (original instanceof HTMLVideoElement && copy instanceof HTMLVideoElement && original.videoWidth > 0) {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = original.videoWidth;
            canvas.height = original.videoHeight;
            canvas.getContext("2d")?.drawImage(original, 0, 0);
            const image = document.createElement("img");
            image.src = canvas.toDataURL("image/png");
            image.className = copy.className;
            image.style.cssText = copy.style.cssText;
            copy.replaceWith(image);
          } catch { /* Keep the cloned video/poster when a frame cannot be read. */ }
        }
      }
    }

    function cloneRenderedElement(source) {
      const clone = source.cloneNode(true);
      copyLiveElementState(source, clone);
      clone.querySelectorAll(".lbs-conv-actions,.lbs-conv-menu,.lbs-conv-overlay")
        .forEach((element) => element.remove());
      clone.querySelectorAll("script").forEach((element) => element.remove());
      for (const element of [clone, ...clone.querySelectorAll("*")]) {
        for (const attribute of [...element.attributes]) {
          if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
        }
      }
      return clone;
    }

    async function expandFoldedContent(scroll) {
      const clicked = [];
      const attempted = new WeakSet();
      const initialStates = new Map();

      for (let round = 0; round < 20; round += 1) {
        let changed = false;
        for (const control of scroll.querySelectorAll("[aria-expanded]")) {
          if (!initialStates.has(control)) {
            initialStates.set(control, control.getAttribute("aria-expanded") === "true");
          }
        }
        const controls = [...scroll.querySelectorAll('[aria-expanded="false"]')]
          .filter((element) => !attempted.has(element)
            && !element.hasAttribute("disabled")
            && !element.hasAttribute("aria-haspopup"));
        for (const control of controls) {
          attempted.add(control);
          control.click();
          clicked.push(control);
          changed = true;
          await settleFrames(2);
        }
        if (!changed) break;
        await settleFrames(2);
      }

      return {
        initialStates,
        restore: async () => {
          for (const control of clicked.reverse()) {
            if (control.isConnected && control.getAttribute("aria-expanded") === "true") control.click();
          }
          await settleFrames(2);
        },
      };
    }

    function annotateFoldedContent(scroll, initialStates) {
      const annotated = [];
      const seen = new Set();
      let index = 0;
      for (const control of scroll.querySelectorAll('[aria-expanded="true"]')) {
        const toggle = control.closest("[data-disclosure-row]") || control;
        if (seen.has(toggle)) continue;
        const controlledId = control.getAttribute("aria-controls");
        const controlled = controlledId ? document.getElementById(controlledId) : null;
        const panels = controlled && scroll.contains(controlled) ? [controlled] : [];
        if (panels.length === 0) {
          for (let panel = toggle.nextElementSibling; panel; panel = panel.nextElementSibling) panels.push(panel);
        }
        if (panels.length === 0) continue;
        seen.add(toggle);
        const id = `fold-${index += 1}`;
        const initiallyOpen = initialStates.get(control) ?? initialStates.get(toggle) ?? true;
        toggle.dataset.lbsExportToggle = id;
        toggle.dataset.lbsExportInitial = initiallyOpen ? "expanded" : "collapsed";
        const addedTabIndex = !toggle.hasAttribute("tabindex");
        if (addedTabIndex) toggle.tabIndex = 0;
        for (const panel of panels) {
          panel.dataset.lbsExportPanel = id;
          panel.dataset.lbsExportInitial = initiallyOpen ? "expanded" : "collapsed";
        }
        annotated.push({ toggle, panels, addedTabIndex });
      }
      return () => {
        for (const { toggle, panels, addedTabIndex } of annotated) {
          delete toggle.dataset.lbsExportToggle;
          delete toggle.dataset.lbsExportInitial;
          if (addedTabIndex) toggle.removeAttribute("tabindex");
          for (const panel of panels) {
            delete panel.dataset.lbsExportPanel;
            delete panel.dataset.lbsExportInitial;
          }
        }
      };
    }

    function buildExportSnapshot(scroll) {
      const phase = scroll.closest("[data-phase]");
      const sessionView = [...scroll.children]
        .find((element) => !element.matches("[data-composer-seat]"));
      if (!sessionView) throw new Error("找不到当前会话内容。 ");

      const root = document.createElement("main");
      root.id = EXPORT_ROOT_ID;
      root.setAttribute("data-conversation-export", "");
      const shell = document.createElement("article");
      shell.className = [phase?.className || "", "lbs-conversation-export-shell"].filter(Boolean).join(" ");
      if (phase?.dataset.phase) shell.dataset.phase = phase.dataset.phase;

      const header = phase?.querySelector(':scope > [data-slot="conversation.session.header"]');
      if (header) shell.append(cloneRenderedElement(header));

      const scrollClone = document.createElement("div");
      scrollClone.className = scroll.className;
      scrollClone.setAttribute("data-conversation-scroll", "");
      scrollClone.append(cloneRenderedElement(sessionView));
      shell.append(scrollClone);
      root.append(shell);

      const phaseStyle = phase ? getComputedStyle(phase) : null;
      for (const property of [
        "--dsh-chat-content-width",
        "--dsh-composer-card-max-width",
        "--dsh-composer-side-clearance",
        "--dsh-composer-dock-inset",
      ]) {
        const value = phaseStyle?.getPropertyValue(property);
        if (value) root.style.setProperty(property, value);
      }
      if (phaseStyle) {
        root.style.color = phaseStyle.color;
        root.style.background = phaseStyle.backgroundColor;
        root.style.fontFamily = phaseStyle.fontFamily;
      }
      return root;
    }

    function blobDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
        reader.addEventListener("error", () => reject(reader.error), { once: true });
        reader.readAsDataURL(blob);
      });
    }

    async function inlineImageAssets(root) {
      await Promise.all([...root.querySelectorAll("img")].map(async (image) => {
        const source = image.getAttribute("src");
        if (!source || source.startsWith("data:")) return;
        try {
          const response = await fetch(source);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          image.src = await blobDataUrl(await response.blob());
        } catch (error) {
          throw new Error(`图片资源无法内嵌，已停止导出：${error instanceof Error ? error.message : String(error)}`);
        }
      }));
    }

    function stylesheetText() {
      const chunks = [];
      for (const sheet of document.styleSheets) {
        try {
          chunks.push([...sheet.cssRules].map((rule) => rule.cssText).join("\n"));
        } catch { /* Cross-origin styles cannot be embedded; DSH plugin styles are same-origin. */ }
      }
      return chunks.join("\n");
    }

    const escapeHtml = (value) => String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

    function documentAttributes(element) {
      return [...element.attributes]
        .filter((attribute) => attribute.name === "class"
          || attribute.name === "style"
          || attribute.name === "lang"
          || attribute.name === "dir"
          || attribute.name.startsWith("data-"))
        .map((attribute) => `${attribute.name}="${escapeHtml(attribute.value)}"`)
        .join(" ");
    }

    function standaloneConversationHtml(root, title) {
      const styles = stylesheetText().replaceAll("</style", "<\\/style");
      const htmlAttributes = documentAttributes(document.documentElement);
      const bodyAttributes = documentAttributes(document.body);
      const exportStyles = `
        html,body{box-sizing:border-box;height:auto!important;min-height:100%;overflow:visible!important}
        body{display:block!important;margin:0!important;background:var(--dsw-alias-bg-base,#fff)}
        #${EXPORT_ROOT_ID}{box-sizing:border-box;display:block!important;width:100%;min-height:100vh;color:inherit;background:inherit}
        #${EXPORT_ROOT_ID} .lbs-conversation-export-shell{box-sizing:border-box!important;display:flex!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}
        #${EXPORT_ROOT_ID} [data-conversation-scroll],
        #${EXPORT_ROOT_ID} [data-conversation-scroll]>*{box-sizing:border-box!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}
        #${EXPORT_ROOT_ID} [data-conversation-scroll]{display:block!important;padding:0!important;scrollbar-gutter:auto!important}
        #${EXPORT_ROOT_ID} [data-composer-seat],#${EXPORT_ROOT_ID} .lbs-conv-actions,
        #${EXPORT_ROOT_ID} .lbs-conv-menu,#${EXPORT_ROOT_ID} .lbs-conv-overlay{display:none!important}
        #${EXPORT_ROOT_ID} [data-lbs-export-toggle]{cursor:pointer}
        #${EXPORT_ROOT_ID} [data-lbs-export-panel][data-lbs-export-initial="collapsed"],
        #${EXPORT_ROOT_ID} [data-lbs-export-panel][hidden]{display:none!important}
        #${EXPORT_ROOT_ID} img,#${EXPORT_ROOT_ID} svg,#${EXPORT_ROOT_ID} canvas{max-width:100%}
        #${EXPORT_ROOT_ID} pre{max-width:100%;white-space:pre-wrap!important;overflow-wrap:anywhere}
        #${EXPORT_ROOT_ID} table{max-width:100%;overflow-wrap:anywhere}
      `;
      const interactions = `(()=>{
        const root=document.getElementById(${JSON.stringify(EXPORT_ROOT_ID)});
        if(!root)return;
        const apply=(toggle,open)=>{
          toggle.setAttribute("aria-expanded",String(open));
          toggle.dataset.lbsExportState=open?"expanded":"collapsed";
          const id=toggle.dataset.lbsExportToggle;
          for(const panel of root.querySelectorAll("[data-lbs-export-panel]")){
            if(panel.dataset.lbsExportPanel!==id)continue;
            panel.hidden=!open;
            delete panel.dataset.lbsExportInitial;
          }
        };
        for(const toggle of root.querySelectorAll("[data-lbs-export-toggle]")){
          let open=toggle.dataset.lbsExportInitial!=="collapsed";
          apply(toggle,open);
          delete toggle.dataset.lbsExportInitial;
          const flip=(event)=>{event.preventDefault();event.stopPropagation();open=!open;apply(toggle,open);};
          toggle.addEventListener("click",flip);
          toggle.addEventListener("keydown",(event)=>{if(event.key==="Enter"||event.key===" ")flip(event);});
        }
      })();`;
      return `<!doctype html><html ${htmlAttributes}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="劳博士 DSH 会话导出"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: http: https:; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline';"><title>${escapeHtml(title)}</title><style>${styles}\n${exportStyles}</style></head><body ${bodyAttributes}>${root.outerHTML}<script>${interactions}</script></body></html>`;
    }

    function safeHtmlFileName(title) {
      const sanitized = String(title || "劳博士会话")
        .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-")
        .replace(/\s+/gu, " ")
        .slice(0, 120)
        .replace(/[. ]+$/gu, "");
      return `${sanitized || "劳博士会话"}.html`;
    }

    function downloadHtml(html, title) {
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeHtmlFileName(title);
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { canceled: false, browserDownload: true };
    }

    async function exportConversation(ctx, sessionId) {
      const bridge = window.laobosDesktop;
      if (ctx.sessions.list.getSnapshot().current !== sessionId) ctx.sessions.open(sessionId);
      await waitForCurrentSession(ctx, sessionId);
      const session = ctx.sessions.binding(sessionId)?.session;
      if (!session) throw new Error("会话尚未载入。 ");
      await session.open();
      const snapshot = await loadCompleteSnapshot(session);
      const scroll = await waitForRenderedConversation(snapshot);
      const row = ctx.sessions.list.getSnapshot().byId[sessionId];
      const title = cleanText(row?.title) || "劳博士会话";
      const folded = await expandFoldedContent(scroll);
      const removeAnnotations = annotateFoldedContent(scroll, folded.initialStates);
      try {
        const root = buildExportSnapshot(scroll);
        await inlineImageAssets(root);
        const html = standaloneConversationHtml(root, title);
        if (bridge?.capabilities?.conversationHtml) {
          return await bridge.html.exportConversation({ html, suggestedName: title });
        }
        return downloadHtml(html, title);
      } finally {
        removeAnnotations();
        await folded.restore();
      }
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
          h("button", { onClick: () => run("导出", () => exportConversation(module.ctx, sessionId)) }, "导出完整会话为 HTML"),
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

    function defaultTitleForPath(value, fallback) {
      const title = String(value || "").replace(/[/\\]+$/u, "").split(/[/\\]/u).pop()?.trim();
      return title || fallback;
    }

    async function revealInSystemFileManager(cwd) {
      if (!cwd) throw new Error("当前项目没有可定位的本地路径。 ");
      const reveal = window.laobosDesktop?.workspace?.reveal;
      if (!reveal) throw new Error("系统文件管理器仅在桌面版中可用。 ");
      await reveal({ root: cwd, path: "." });
    }

    async function renameWorkspace(item) {
      const input = window.prompt("工作区名称（清空可恢复目录名称）", item.title);
      if (input === null) return;
      const title = input.trim() || defaultTitleForPath(item.path, item.workspaceId);
      await module.ctx.workspaces.rename(item.workspaceId, title);
    }

    async function renameSession(id) {
      const summary = module.ctx.sessions.list.getSnapshot().byId[id];
      const session = module.ctx.sessions.binding(id)?.session;
      if (!session) return;
      const input = window.prompt("会话名称（清空可恢复默认名称）", summary?.title || "");
      if (input === null) return;
      const title = input.trim() || defaultTitleForPath(summary?.cwd, id);
      const result = await session.rename(title);
      if (!result.ok) throw new Error(result.error.message);
    }

    function ContextMenuBridge() {
      const [menu, setMenu] = useState(null);
      useEffect(() => {
        const onContextMenu = (event) => {
          if (event.target instanceof Element && event.target.closest(".lbs-workbench")) return;
          const row = event.target instanceof Element ? event.target.closest('[role="treeitem"]') : null;
          if (!row || !row.closest('[role="tree"]')) return;
          const workspace = row.hasAttribute("aria-expanded") ? resolveWorkspace(module.ctx, row) : undefined;
          const sessionId = workspace ? undefined : resolveSessionId(module.ctx, row);
          if (!workspace && !sessionId) return;
          event.preventDefault(); event.stopPropagation();
          const width = 240; const height = workspace ? 206 : 176;
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
          h("button", { onClick: act(() => revealInSystemFileManager(item.path)) }, "在系统文件管理器中打开"),
          h("button", { onClick: act(() => renameWorkspace(item)) }, "重命名工作区"),
          h("button", { className: "danger", onClick: act(async () => { if (window.confirm(`从侧栏移除“${item.title}”？\n不会删除目录和会话。`)) await module.ctx.workspaces.delete(item.workspaceId); }) }, "从侧栏移除"),
        );
      }
      const id = menu.sessionId;
      const cwd = module.ctx.sessions.list.getSnapshot().byId[id]?.cwd;
      return h("div", { className: "lbs-conv-menu fixed", style, role: "menu", onPointerDown: (event) => event.stopPropagation() },
        h("button", { onClick: act(() => module.ctx.sessions.open(id)) }, "打开会话"),
        h("button", { onClick: act(() => revealInSystemFileManager(cwd)) }, "在系统文件管理器中打开"),
        h("button", { onClick: act(() => exportConversation(module.ctx, id)) }, "导出为 HTML"),
        h("button", { onClick: act(() => renameSession(id)) }, "重命名会话"),
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
