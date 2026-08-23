/* eslint-disable @next/next/no-assign-module-variable, @next/next/no-img-element -- DSH browser plugins use a CommonJS module and object URLs */
import {
  fileFromReference,
  parseFileEnvelopes,
  serializeFileEnvelope,
} from "../lib/envelope.js";
import {
  browserElementFromReference,
  browserElementLabel,
  parseBrowserElementEnvelopes,
  serializeBrowserElementEnvelope,
} from "../../laobos-browserops/lib/element-envelope.js";

window.__ModuleLoader__.load({
  id: "@laobos/dsh-file-attachments",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const Primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const { useEffect, useRef, useState } = React;

    const css = `
      @keyframes lbs-file-attach-spin{to{transform:rotate(360deg)}}.lbs-file-attach-button{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;height:30px;justify-content:center;padding:0;width:30px}.lbs-file-attach-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-file-attach-button:disabled{cursor:not-allowed;opacity:.42}.lbs-file-attach-button[data-busy=true]{opacity:1}.lbs-file-attach-button[data-busy=true] svg{animation:lbs-file-attach-spin .75s linear infinite;transform-origin:center}
      .lbs-file-user-row{align-items:flex-end;display:flex;gap:10px;justify-content:flex-end;min-width:0}.lbs-file-user-stack{align-items:flex-end;display:flex;flex-direction:column;gap:7px;max-width:min(82%,760px);min-width:0}.lbs-file-bubble{background:var(--dsw-alias-bg-layer-2);border-radius:16px 16px 4px 16px;box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;padding:10px 14px;white-space:pre-wrap}.lbs-file-ref-chip{background:var(--dsw-alias-interactive-bg-hover-solid);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;display:inline-block;font-size:.92em;padding:0 4px}
      .lbs-file-card-list{align-items:flex-end;display:flex;flex-direction:column;gap:6px;max-width:100%;width:300px}.lbs-file-card{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-sizing:border-box;display:grid;gap:7px;grid-template-columns:minmax(0,1fr) auto;min-height:48px;padding:5px 6px 5px 7px;text-align:left;width:100%}.lbs-file-card-open{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;display:grid;gap:8px;grid-template-columns:32px minmax(0,1fr);min-width:0;padding:2px;text-align:left}.lbs-file-card-open:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-svg-wrap{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border-radius:7px;color:var(--dsw-alias-label-secondary);display:flex;height:32px;justify-content:center;width:32px}.lbs-file-svg{display:block;height:20px;width:20px}.lbs-file-card-main{display:block;min-width:0}.lbs-file-card-name{color:var(--dsw-alias-label-primary);display:block;font-size:12px;font-weight:600;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-card-meta{color:var(--dsw-alias-label-tertiary);display:block;font-size:10px;line-height:14px;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.lbs-file-card-action,.lbs-file-message-action{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:inline-flex;height:28px;justify-content:center;padding:6px;width:28px}.lbs-file-card-action:hover,.lbs-file-message-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
      [data-composer-card]>div:has([role="group"] img){display:none!important}.lbs-file-composer-zone{box-sizing:border-box;margin:0 auto;max-width:calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance));padding:0 var(--dsh-composer-side-clearance);width:100%}.lbs-file-composer-panel{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0 2px}.lbs-file-composer-head{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:11px;font-weight:600;justify-content:space-between;line-height:16px;margin-bottom:5px;padding:0 2px}.lbs-file-composer-count{color:var(--dsw-alias-label-tertiary);font-weight:500}.lbs-file-composer-rail{align-items:center;display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;padding:0 1px;scrollbar-width:none}.lbs-file-composer-rail::-webkit-scrollbar{display:none}.lbs-file-composer-item{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-sizing:border-box;display:grid;flex:0 0 min(220px,calc(100vw - 96px));gap:6px;grid-template-columns:28px minmax(0,1fr) 22px;height:42px;max-width:220px;padding:4px 4px 4px 6px}.lbs-file-composer-item .lbs-file-svg-wrap{background:var(--dsw-specific-input-major);border-radius:6px;height:26px;width:26px}.lbs-file-composer-item .lbs-file-svg{height:16px;width:16px}.lbs-file-composer-image{border-radius:6px;height:26px;object-fit:cover;width:26px}.lbs-file-composer-remove{align-items:center;appearance:none;background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:flex;height:22px;justify-content:center;padding:0;width:22px}.lbs-file-composer-remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .lbs-file-message-actions{align-items:center;display:flex;gap:4px;height:28px;min-width:28px}.lbs-file-message-time{color:var(--dsw-alias-label-tertiary);font-size:12px;opacity:0;padding-right:4px;transition:opacity 80ms;white-space:nowrap}[data-time-hover-root]:hover .lbs-file-message-time,[data-time-hover-root]:focus-within .lbs-file-message-time{opacity:1}.lbs-file-extra{max-width:100%;width:460px}@media(max-width:700px){.lbs-file-user-stack{max-width:92%}.lbs-file-card-list{width:min(300px,78vw)}}
      .lbs-browser-context-composer{align-items:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,var(--dsw-alias-border-l1));border-radius:9px;display:grid;gap:7px;grid-template-columns:auto minmax(0,1fr);margin:0 2px 6px;padding:4px 5px 4px 8px}.lbs-browser-context-label{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:10px;font-weight:600;gap:4px;white-space:nowrap}.lbs-browser-context-rail{align-items:center;display:flex;gap:5px;min-width:0;overflow-x:auto;scrollbar-width:none}.lbs-browser-context-rail::-webkit-scrollbar{display:none}.lbs-browser-context-item{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;display:grid;flex:0 0 min(250px,calc(100vw - 150px));gap:6px;grid-template-columns:24px minmax(0,1fr) 22px;height:34px;max-width:250px;padding:2px 3px 2px 5px}.lbs-browser-context-icon{align-items:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent);border-radius:6px;color:var(--dsw-alias-brand-primary);display:inline-flex;height:24px;justify-content:center;width:24px}.lbs-browser-context-main{display:block;min-width:0}.lbs-browser-context-name{color:var(--dsw-alias-label-primary);display:block;font-size:11px;font-weight:600;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-browser-context-meta{color:var(--dsw-alias-label-tertiary);display:block;font-size:9px;line-height:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lbs-browser-message-group{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-sizing:border-box;max-width:100%;overflow:hidden;width:360px}.lbs-browser-message-group>summary{align-items:center;cursor:pointer;display:grid;gap:8px;grid-template-columns:28px minmax(0,1fr) 16px;list-style:none;min-height:42px;padding:4px 8px}.lbs-browser-message-group>summary::-webkit-details-marker{display:none}.lbs-browser-message-group>summary:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-browser-message-group[open]>summary{border-bottom:1px solid var(--dsw-alias-border-l1)}.lbs-browser-message-chevron{color:var(--dsw-alias-label-tertiary);font-size:16px;transform:rotate(0);transition:transform 120ms}.lbs-browser-message-group[open] .lbs-browser-message-chevron{transform:rotate(90deg)}.lbs-browser-message-body{display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto;padding:8px}.lbs-browser-message-element{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;padding:7px 8px}.lbs-browser-message-element-head{color:var(--dsw-alias-label-primary);font-size:11px;font-weight:600;line-height:15px;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-browser-message-row{display:grid;font-size:10px;gap:7px;grid-template-columns:48px minmax(0,1fr);line-height:15px}.lbs-browser-message-row>span{color:var(--dsw-alias-label-tertiary)}.lbs-browser-message-row code{color:var(--dsw-alias-label-secondary);font:10px/15px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;white-space:normal}@media(max-width:700px){.lbs-browser-context-label{display:none}.lbs-browser-context-composer{grid-template-columns:minmax(0,1fr)}.lbs-browser-message-group{width:min(360px,82vw)}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-file-attachments"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-file-attachments";
      style.textContent = css;
      document.head.append(style);
    }

    const NATIVE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

    const EMPTY_FILES = Object.freeze([]);
    const EMPTY_BROWSER_ELEMENTS = Object.freeze([]);
    const pendingFilesBySession = new Map();
    const pendingFileListeners = new Map();
    const pendingBrowserElementsBySession = new Map();
    const pendingBrowserElementListeners = new Map();

    function pendingFiles(sessionId) {
      return pendingFilesBySession.get(sessionId) || EMPTY_FILES;
    }

    function publishPendingFiles(sessionId) {
      for (const listener of pendingFileListeners.get(sessionId) || []) listener();
    }

    function replacePendingFiles(sessionId, files) {
      if (files.length) pendingFilesBySession.set(sessionId, Object.freeze(files));
      else pendingFilesBySession.delete(sessionId);
      publishPendingFiles(sessionId);
    }

    function fileIdentity(file) {
      return `${file.id || ""}\u0000${file.path}`;
    }

    function addPendingFiles(sessionId, values) {
      const next = [...pendingFiles(sessionId)];
      const identities = new Set(next.map(fileIdentity));
      for (const value of values) {
        const file = fileFromReference(value);
        const identity = fileIdentity(file);
        if (!identities.has(identity)) {
          identities.add(identity);
          next.push(file);
        }
      }
      replacePendingFiles(sessionId, next);
    }

    function removePendingFile(sessionId, target) {
      const identity = fileIdentity(target);
      replacePendingFiles(sessionId, pendingFiles(sessionId).filter((file) => fileIdentity(file) !== identity));
    }

    function usePendingFiles(sessionId) {
      const [, render] = useState(0);
      useEffect(() => {
        const listeners = pendingFileListeners.get(sessionId) || new Set();
        const listener = () => render((version) => version + 1);
        listeners.add(listener);
        pendingFileListeners.set(sessionId, listeners);
        return () => {
          listeners.delete(listener);
          if (!listeners.size) pendingFileListeners.delete(sessionId);
        };
      }, [sessionId]);
      return pendingFiles(sessionId);
    }

    function pendingBrowserElements(sessionId) {
      return pendingBrowserElementsBySession.get(sessionId) || EMPTY_BROWSER_ELEMENTS;
    }

    function publishPendingBrowserElements(sessionId) {
      for (const listener of pendingBrowserElementListeners.get(sessionId) || []) listener();
    }

    function replacePendingBrowserElements(sessionId, elements) {
      if (elements.length) pendingBrowserElementsBySession.set(sessionId, Object.freeze(elements));
      else pendingBrowserElementsBySession.delete(sessionId);
      publishPendingBrowserElements(sessionId);
    }

    function browserElementIdentity(element) {
      const selector = element.element?.selector || "";
      return selector ? `${element.page?.url || ""}\u0000${selector}` : element.id;
    }

    function addPendingBrowserElement(sessionId, value) {
      const element = browserElementFromReference(value);
      const identity = browserElementIdentity(element);
      const next = pendingBrowserElements(sessionId).filter((candidate) => browserElementIdentity(candidate) !== identity);
      next.push(element);
      replacePendingBrowserElements(sessionId, next.slice(-6));
    }

    function removePendingBrowserElement(sessionId, target) {
      const identity = browserElementIdentity(target);
      replacePendingBrowserElements(sessionId, pendingBrowserElements(sessionId).filter((element) => browserElementIdentity(element) !== identity));
    }

    function usePendingBrowserElements(sessionId) {
      const [, render] = useState(0);
      useEffect(() => {
        const listeners = pendingBrowserElementListeners.get(sessionId) || new Set();
        const listener = () => render((version) => version + 1);
        listeners.add(listener);
        pendingBrowserElementListeners.set(sessionId, listeners);
        return () => {
          listeners.delete(listener);
          if (!listeners.size) pendingBrowserElementListeners.delete(sessionId);
        };
      }, [sessionId]);
      return pendingBrowserElements(sessionId);
    }

    function selectedModelSupportsImages(ctx, sessionId) {
      try {
        const state = ctx.modelDirectories.directoryFor(sessionId).store.getSnapshot();
        const current = state.current;
        if (!current) return undefined;
        const model = state.groups
          .find((group) => group.id === current.provider)
          ?.models.find((candidate) => candidate.id === current.model);
        if (!Array.isArray(model?.inputModalities)) return undefined;
        return model.inputModalities.includes("image");
      } catch {
        return undefined;
      }
    }

    async function persistImagesAsFiles(sessionId, images) {
      const bridge = window.laobosDesktop;
      if (!bridge?.capabilities?.fileAttachments || !bridge.uploads?.pasteFiles) {
        throw new Error("当前模型不支持图片输入，且普通文件上传服务不可用。 ");
      }
      const payloads = await Promise.all(images.map(async (image) => ({
        name: image.file.name || "image",
        mimeType: image.file.type || "application/octet-stream",
        size: image.file.size,
        bytes: new Uint8Array(await image.file.arrayBuffer()),
      })));
      const result = await bridge.uploads.pasteFiles(sessionId, payloads);
      return (result?.files || []).map(fileFromReference);
    }

    function installBrowserElementContextIngress(ctx) {
      const receive = (event) => {
        try {
          const sessionId = typeof event.detail?.sessionId === "string" ? event.detail.sessionId : "";
          const sessions = ctx.sessions.list.getSnapshot();
          if (!sessionId || !sessions.byId?.[sessionId]) return;
          addPendingBrowserElement(sessionId, event.detail.element);
          event.preventDefault();
        } catch {
          // Leaving the cancelable event unhandled lets BrowserPanel show a useful error.
        }
      };
      window.addEventListener("laobos:add-browser-element-context", receive);
      return () => window.removeEventListener("laobos:add-browser-element-context", receive);
    }

    function installFileSendChannel(ctx) {
      const conversation = ctx.get("conversation");
      if (!conversation?.sendSession) throw new Error("对话发送服务尚未就绪。 ");
      const original = conversation.sendSession;
      const routed = async function routedSendSession(session, text, imageIds, mode, signal) {
        const pending = pendingFiles(session.sessionId);
        const pendingElements = pendingBrowserElements(session.sessionId);
        const downgradeImages = imageIds.length > 0
          && selectedModelSupportsImages(ctx, session.sessionId) !== true;
        const images = downgradeImages ? conversation.draftImages(imageIds) : [];
        if (downgradeImages && images.length !== imageIds.length) {
          throw new Error("一个或多个待发送图片已经失效。 ");
        }
        const converted = downgradeImages
          ? await persistImagesAsFiles(session.sessionId, images)
          : [];
        const files = [...pending, ...converted];
        const envelopes = [
          ...files.map(serializeFileEnvelope),
          ...pendingElements.map(serializeBrowserElementEnvelope),
        ].join("\n\n");
        const prompt = text && envelopes ? `${text}\n\n${envelopes}` : text || envelopes;
        if (pending.length) {
          const sent = new Set(pending.map(fileIdentity));
          replacePendingFiles(session.sessionId, pendingFiles(session.sessionId).filter((file) => !sent.has(fileIdentity(file))));
        }
        if (pendingElements.length) {
          const sent = new Set(pendingElements.map(browserElementIdentity));
          replacePendingBrowserElements(session.sessionId, pendingBrowserElements(session.sessionId).filter((element) => !sent.has(browserElementIdentity(element))));
        }
        try {
          const outcome = await original.call(
            conversation,
            session,
            prompt,
            downgradeImages ? [] : imageIds,
            mode,
            signal,
          );
          if (downgradeImages) conversation.releaseDraftImages(images);
          return outcome;
        } catch (error) {
          if (pending.length) {
            const current = pendingFiles(session.sessionId);
            const currentIds = new Set(current.map(fileIdentity));
            replacePendingFiles(session.sessionId, [...pending.filter((file) => !currentIds.has(fileIdentity(file))), ...current]);
          }
          if (pendingElements.length) {
            const current = pendingBrowserElements(session.sessionId);
            const currentIds = new Set(current.map(browserElementIdentity));
            replacePendingBrowserElements(session.sessionId, [...pendingElements.filter((element) => !currentIds.has(browserElementIdentity(element))), ...current]);
          }
          throw error;
        }
      };
      conversation.sendSession = routed;
      return () => {
        if (conversation.sendSession === routed) conversation.sendSession = original;
        pendingFilesBySession.clear();
        pendingFileListeners.clear();
        pendingBrowserElementsBySession.clear();
        pendingBrowserElementListeners.clear();
      };
    }

    function sessionInput(ctx, sessionId) {
      const actx = ctx.sessions.scope(sessionId);
      const conversation = actx?.get("conversation");
      if (!actx || !conversation?.input) throw new Error("当前会话的输入服务尚未就绪。 ");
      return { actx, conversation, input: conversation.input.for(actx) };
    }

    function notify(ctx, sessionId, level, message) {
      try { sessionInput(ctx, sessionId).input.notify(level, message); }
      catch { if (level === "error") window.alert(message); }
    }

    async function writeClipboard(text) {
      try {
        if (window.laobosDesktop?.clipboard?.writeText) {
          const result = await window.laobosDesktop.clipboard.writeText(text);
          if (result?.written) return true;
        }
      } catch {
        // The browser clipboard implementation below remains available as a fallback.
      }
      return Primitives.writeClipboard(text);
    }

    function useClipboardFeedback() {
      const [status, setStatus] = useState("idle");
      const resetTimer = useRef();
      useEffect(() => () => window.clearTimeout(resetTimer.current), []);
      const copy = async (text) => {
        window.clearTimeout(resetTimer.current);
        const written = await writeClipboard(text);
        setStatus(written ? "copied" : "failed");
        resetTimer.current = window.setTimeout(() => setStatus("idle"), written ? 1_800 : 3_000);
        return written;
      };
      return { status, copy };
    }

    function imageFileFromDesktop(image) {
      const source = image?.bytes?.type === "Buffer" ? image.bytes.data : image?.bytes;
      const bytes = source instanceof Uint8Array ? source : new Uint8Array(source || []);
      return new File([bytes], image.name, { type: image.mediaType, lastModified: Date.now() });
    }

    function insertMultimodalImages(ctx, sessionId, values) {
      insertImageFiles(ctx, sessionId, values.map(imageFileFromDesktop));
    }

    function insertImageFiles(ctx, sessionId, files) {
      if (!files.length) return;
      const { conversation, input } = sessionInput(ctx, sessionId);
      const images = conversation.createDraftImages(files);
      if (input.addImages(images.map((image) => image.id))) return;
      conversation.releaseDraftImages(images);
      throw new Error("当前状态无法添加图片，请稍后重试。 ");
    }

    function FileAttachButton({ sessionId, input }) {
      const [busy, setBusy] = useState(false);
      const mounted = useRef(true);
      useEffect(() => () => { mounted.current = false; }, []);
      const bridge = window.laobosDesktop;
      const unavailable = !bridge?.capabilities?.fileAttachments
        || busy
        || input?.phase === "adjudicating"
        || input?.phase === "submitting";
      useEffect(() => {
        const routeFiles = async (files) => {
          const images = files.filter((file) => NATIVE_IMAGE_TYPES.has(file.type));
          const ordinary = files.filter((file) => !NATIVE_IMAGE_TYPES.has(file.type));
          const payloads = await Promise.all(ordinary.map(async (file) => ({
            name: file.name,
            mimeType: file.type,
            size: file.size,
            bytes: new Uint8Array(await file.arrayBuffer()),
          })));
          const result = await bridge.uploads.pasteFiles(sessionId, payloads);
          insertImageFiles(module.ctx, sessionId, images);
          addPendingFiles(sessionId, result?.files || []);
        };
        const intercept = (event, files) => {
          if (!files.length || files.every((file) => NATIVE_IMAGE_TYPES.has(file.type))) return false;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (unavailable) {
            notify(module.ctx, sessionId, "error", "当前状态无法添加附件，请稍后重试。 ");
            return true;
          }
          setBusy(true);
          routeFiles(files).catch((error) => {
            notify(module.ctx, sessionId, "error", error instanceof Error ? error.message : String(error));
          }).finally(() => {
            if (mounted.current) setBusy(false);
          });
          return true;
        };
        const paste = (event) => {
          if (!event.target?.closest?.("[data-composer-card]")) return;
          const pasted = Array.from(event.clipboardData?.items || [])
            .filter((item) => item.kind === "file")
            .map((item) => item.getAsFile())
            .filter(Boolean);
          intercept(event, pasted);
        };
        const drop = (event) => {
          const dropped = Array.from(event.dataTransfer?.files || []);
          intercept(event, dropped);
        };
        document.addEventListener("paste", paste, true);
        document.addEventListener("drop", drop, true);
        return () => {
          document.removeEventListener("paste", paste, true);
          document.removeEventListener("drop", drop, true);
        };
      }, [bridge, sessionId, unavailable]);
      const choose = async () => {
        if (unavailable) return;
        setBusy(true);
        try {
          const result = await bridge.uploads.pickFiles(sessionId);
          insertMultimodalImages(module.ctx, sessionId, result?.images || []);
          addPendingFiles(sessionId, result?.files || []);
        } catch (error) {
          notify(module.ctx, sessionId, "error", error instanceof Error ? error.message : String(error));
        } finally {
          if (mounted.current) setBusy(false);
        }
      };
      return <Primitives.Tooltip label={bridge?.capabilities?.fileAttachments ? "添加图片或文件" : "附件上传仅在桌面版中可用"} side="top">
        <button className="lbs-file-attach-button" type="button" disabled={unavailable} data-busy={busy || undefined} aria-label="添加图片或文件" onClick={choose}>
          {busy ? <Primitives.IconLoadingOutline16 /> : <Primitives.IconPaperclipOutline16 />}
        </button>
      </Primitives.Tooltip>;
    }

    function formatBytes(value) {
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
      return `${(value / 1024 / 1024).toFixed(1)} MB`;
    }

    function fileKind(name) {
      const extension = name.includes(".") ? name.split(".").pop() : "file";
      return String(extension || "file").slice(0, 5).toUpperCase();
    }

    function FileSvgIcon() {
      return <span className="lbs-file-svg-wrap" aria-hidden={true}>
        <svg className="lbs-file-svg" viewBox="0 0 24 24" fill="none">
          <path d="M6.75 2.75h7l4.5 4.5v14H6.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M13.75 2.75v4.5h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="10.1" cy="11.4" r="1.15" fill="currentColor" />
          <path d="m8.5 17.3 2.65-2.85 1.85 1.8 1.6-1.55 2.05 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>;
    }

    function CloseSvgIcon() {
      return <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden={true}>
        <path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>;
    }

    function BrowserElementSvgIcon() {
      return <span className="lbs-browser-context-icon" aria-hidden={true}>
        <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
          <path d="M3.25 3.25h5.5v1.5h-4v4h-1.5zm8 0h5.5v5.5h-1.5v-4h-4zm4 8h1.5v5.5h-5.5v-1.5h4zm-12 0h1.5v4h4v1.5h-5.5z" fill="currentColor" />
          <circle cx="10" cy="10" r="2.15" stroke="currentColor" strokeWidth="1.35" />
        </svg>
      </span>;
    }

    function browserContextHost(context) {
      try { return new URL(context.page.url).host; }
      catch { return context.page.url; }
    }

    function browserContextTag(context) {
      return `<${context.element.tagName}>`;
    }

    function FileCard({ file }) {
      const { status, copy } = useClipboardFeedback();
      const copyPath = async () => {
        await copy(file.path);
      };
      const reveal = async () => {
        try { await window.laobosDesktop?.uploads?.reveal?.(file.path); }
        catch (error) { window.alert(error instanceof Error ? error.message : String(error)); }
      };
      return <article className="lbs-file-card" data-laobos-file-path={file.path} title={file.path}>
        <button className="lbs-file-card-open" type="button" aria-label={`在文件夹中显示 ${file.name}`} onClick={reveal}>
          <FileSvgIcon />
          <span className="lbs-file-card-main">
            <span className="lbs-file-card-name">{file.name}</span>
            <span className="lbs-file-card-meta">{fileKind(file.name)} · {formatBytes(file.size)}</span>
          </span>
        </button>
        <Primitives.Tooltip label={status === "copied" ? "已复制" : status === "failed" ? "复制失败，请重试" : "复制绝对路径"} side="bottom"><button className="lbs-file-card-action" type="button" aria-label={status === "copied" ? "文件绝对路径已复制" : status === "failed" ? "复制文件绝对路径失败，请重试" : "复制文件绝对路径"} onClick={copyPath}>{status === "copied" ? <Primitives.IconCheckOutline16 /> : status === "failed" ? <Primitives.IconWarningOutline16 /> : <Primitives.IconCopyOutline16 />}</button></Primitives.Tooltip>
      </article>;
    }

    function FileComposerRail({ sessionId, input, inputActions }) {
      const files = usePendingFiles(sessionId);
      const browserElements = usePendingBrowserElements(sessionId);
      const { conversation } = sessionInput(module.ctx, sessionId);
      const images = conversation.draftImages(input?.imageIds || []);
      const count = files.length + images.length;
      if (!count && !browserElements.length) return null;
      const removeImage = (image) => {
        conversation.releaseDraftImage(image.id);
        inputActions.removeImage(image.id);
      };
      return <div className="lbs-file-composer-zone">
        {browserElements.length ? <section className="lbs-browser-context-composer" aria-label="待发送网页元素上下文">
          <span className="lbs-browser-context-label">⌖ 网页上下文</span>
          <div className="lbs-browser-context-rail">
            {browserElements.map((element) => <article className="lbs-browser-context-item" key={browserElementIdentity(element)} title={`${element.element.selector}\n${element.page.url}`}>
              <BrowserElementSvgIcon />
              <span className="lbs-browser-context-main">
                <span className="lbs-browser-context-name">{browserContextTag(element)} · {browserElementLabel(element)}</span>
                <span className="lbs-browser-context-meta">{browserContextHost(element)}{element.element.source?.file ? ` · ${element.element.source.file}` : ""}</span>
              </span>
              <button className="lbs-file-composer-remove" type="button" aria-label={`移除网页元素 ${browserElementLabel(element)}`} onPointerDown={(event) => event.preventDefault()} onClick={() => removePendingBrowserElement(sessionId, element)}><CloseSvgIcon /></button>
            </article>)}
          </div>
        </section> : null}
        {count ? <section className="lbs-file-composer-panel" aria-label="待发送附件">
          <div className="lbs-file-composer-head"><span>附件</span><span className="lbs-file-composer-count">{count} 个</span></div>
          <div className="lbs-file-composer-rail">
            {images.map((image) => <article className="lbs-file-composer-item" key={image.id} title={image.file.name}>
              <img className="lbs-file-composer-image" src={image.previewUrl} alt="" />
              <span className="lbs-file-card-main">
                <span className="lbs-file-card-name">{image.file.name || "图片"}</span>
                <span className="lbs-file-card-meta">图片 · {formatBytes(image.file.size)}</span>
              </span>
              <button className="lbs-file-composer-remove" type="button" aria-label={`移除图片 ${image.file.name || "图片"}`} onPointerDown={(event) => event.preventDefault()} onClick={() => removeImage(image)}><CloseSvgIcon /></button>
            </article>)}
            {files.map((file) => <article className="lbs-file-composer-item" key={fileIdentity(file)} title={`${file.name}\n${file.path}`}>
              <FileSvgIcon />
              <span className="lbs-file-card-main">
                <span className="lbs-file-card-name">{file.name}</span>
                <span className="lbs-file-card-meta">{fileKind(file.name)} · {formatBytes(file.size)}</span>
              </span>
              <button className="lbs-file-composer-remove" type="button" aria-label={`移除文件 ${file.name}`} onPointerDown={(event) => event.preventDefault()} onClick={() => removePendingFile(sessionId, file)}><CloseSvgIcon /></button>
            </article>)}
          </div>
        </section> : null}
      </div>;
    }

    function projectedText(text) {
      const expression = /(^|\s)([/@][\w-]+)(?=\s|$)/gu;
      const parts = [];
      let cursor = 0;
      let match;
      while ((match = expression.exec(text)) !== null) {
        const start = match.index + (match[1]?.length || 0);
        const label = match[2] || "";
        if (start > cursor) parts.push(<Primitives.MessageText text={text.slice(cursor, start)} key={`text-${cursor}`} />);
        parts.push(<span className="lbs-file-ref-chip" data-ref-chip={label.startsWith("@") ? "subagent" : "skill"} key={`ref-${start}`}>{label}</span>);
        cursor = start + label.length;
      }
      if (parts.length === 0) return <Primitives.MessageText text={text} />;
      if (cursor < text.length) parts.push(<Primitives.MessageText text={text.slice(cursor)} key={`text-${cursor}`} />);
      return parts;
    }

    function sourceLabel(source) {
      if (!source?.file && !source?.component) return "";
      const position = source.line ? `:${source.line}${source.column ? `:${source.column}` : ""}` : "";
      return `${source.file || source.component}${position}${source.file && source.component ? ` · ${source.component}` : ""}`;
    }

    function BrowserElementGroup({ elements }) {
      if (!elements.length) return null;
      const primary = elements[0];
      const summary = elements.length === 1 ? browserElementLabel(primary) : `${browserElementLabel(primary)} 等 ${elements.length} 个元素`;
      return <details className="lbs-browser-message-group" data-laobos-browser-element-context={elements.length}>
        <summary>
          <BrowserElementSvgIcon />
          <span className="lbs-browser-context-main">
            <span className="lbs-browser-context-name">网页元素上下文 · {elements.length} 个</span>
            <span className="lbs-browser-context-meta">{summary} · {browserContextHost(primary)}</span>
          </span>
          <span className="lbs-browser-message-chevron" aria-hidden={true}>›</span>
        </summary>
        <div className="lbs-browser-message-body">
          {elements.map((context) => {
            const source = sourceLabel(context.element.source);
            const styles = Object.entries(context.element.styles).slice(0, 5).map(([name, value]) => `${name}: ${value}`).join("; ");
            const size = `${Math.round(context.element.bounds.width)} × ${Math.round(context.element.bounds.height)}`;
            return <article className="lbs-browser-message-element" key={`${browserElementIdentity(context)}:${context.id}`}>
              <div className="lbs-browser-message-element-head">{browserContextTag(context)} · {browserElementLabel(context)}</div>
              <div className="lbs-browser-message-row"><span>选择器</span><code>{context.element.selector || browserContextTag(context)}</code></div>
              <div className="lbs-browser-message-row"><span>页面</span><code>{context.page.url}{context.page.queryKeys.length ? `?${context.page.queryKeys.join("&")}` : ""}</code></div>
              {source ? <div className="lbs-browser-message-row"><span>源码</span><code>{source}</code></div> : null}
              <div className="lbs-browser-message-row"><span>尺寸</span><code>{size}</code></div>
              {styles ? <div className="lbs-browser-message-row"><span>样式</span><code>{styles}</code></div> : null}
            </article>;
          })}
        </div>
      </details>;
    }

    function MessageActions({ text, files, browserElements, time }) {
      const { status, copy: write } = useClipboardFeedback();
      const copy = async () => {
        const value = [
          text,
          ...files.map((file) => file.path),
          ...browserElements.map((context) => `网页元素 ${context.element.selector || browserContextTag(context)} · ${context.page.url}`),
        ].filter(Boolean).join("\n");
        await write(value);
      };
      let displayTime = "";
      if (time !== undefined) {
        const date = new Date(time);
        if (!Number.isNaN(date.getTime())) displayTime = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      }
      return <div className="lbs-file-message-actions">
        {displayTime ? <span className="lbs-file-message-time">{displayTime}</span> : null}
        <Primitives.Tooltip label={status === "copied" ? "已复制" : status === "failed" ? "复制失败，请重试" : "复制"} side="bottom"><button className="lbs-file-message-action" type="button" aria-label={status === "copied" ? "消息已复制" : status === "failed" ? "复制消息失败，请重试" : "复制消息"} onClick={copy}>{status === "copied" ? <Primitives.IconCheckOutline16 /> : status === "failed" ? <Primitives.IconWarningOutline16 /> : <Primitives.IconCopyOutline16 />}</button></Primitives.Tooltip>
      </div>;
    }

    function FileMessageNode({ node, renderMessageImages }) {
      const texts = [];
      const images = [];
      const rest = [];
      for (const block of node?.data?.content || []) {
        if (block?.type === "text" && typeof block.text === "string") texts.push(block.text);
        else if (block?.type === "image" && block.attachment) images.push({ attachment: block.attachment });
        else rest.push(block);
      }
      const fileProjection = parseFileEnvelopes(texts.join(""));
      const parsed = parseBrowserElementEnvelopes(fileProjection.text);
      const showBubble = parsed.text !== "" || rest.length > 0;
      return <div className="lbs-file-user-row" data-time-hover-root={true}>
        <div className="lbs-file-user-stack">
          {images.length ? renderMessageImages({ images, align: "end" }) : null}
          {showBubble ? <div className="lbs-file-bubble">{projectedText(parsed.text)}{rest.map((block, index) => <div className="lbs-file-extra" key={index}><Primitives.JsonBlock label="附加内容" payload={block} truncatedLabel={(total) => `内容过长（${total} 项）`} /></div>)}</div> : null}
          {parsed.elements.length ? <BrowserElementGroup elements={parsed.elements} /> : null}
          {fileProjection.files.length ? <div className="lbs-file-card-list">{fileProjection.files.map((file, index) => <FileCard file={file} key={`${file.id}:${index}`} />)}</div> : null}
        </div>
        <MessageActions text={parsed.text} files={fileProjection.files} browserElements={parsed.elements} time={node?.data?.time} />
      </div>;
    }

    const inject = ["sessions", "slots", "conversation", "modelDirectories"];
    function apply(ctx) {
      module.ctx = ctx;
      ctx.effect(() => installBrowserElementContextIngress(ctx), "laobos-file-attachments: browser element context ingress");
      ctx.effect(() => installFileSendChannel(ctx), "laobos-file-attachments: independent file send channel");
      ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
        name: "conversation.input.left",
        id: "laobos-file-attach",
        order: 30,
        label: "添加图片或文件",
      }, FileAttachButton));
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "laobos-file-composer-rail",
        order: 30,
        label: "待发送附件与网页上下文",
      }, FileComposerRail));
      for (const key of ["user", "steering"]) {
        ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
          name: "conversation.chat.node",
          key,
          priority: -10,
        }, FileMessageNode));
      }
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
