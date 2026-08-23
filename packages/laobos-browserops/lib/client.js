/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
  // packages/laobos-browserops/lib/conversation-link.js
  function clickTargetElement(target) {
    if (target?.nodeType === 3) return target.parentElement;
    return target;
  }
  function conversationBrowserUrlFromClick(event, baseUrl = globalThis.location?.href) {
    if (!event || event.defaultPrevented) return "";
    if (event.button !== void 0 && event.button !== 0) return "";
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return "";
    const anchor = clickTargetElement(event.target)?.closest?.("a[href]");
    if (!anchor || !anchor.closest?.("[data-conversation-scroll]") || anchor.hasAttribute?.("download")) return "";
    const raw = String(anchor.getAttribute?.("href") || "").trim();
    if (!/^(?:https?:)?\/\//iu.test(raw)) return "";
    try {
      const url = new URL(raw, baseUrl || "http://laobos.invalid/");
      if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  // packages/laobos-browserops/src/client.jsx
  window.__ModuleLoader__.load({
    id: "@laobos/dsh-browserops",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      const React = require2("react");
      const { useEffect, useRef, useState } = React;
      const css = `
      .lbs-browser-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}.lbs-browser-toolbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:6px;min-height:52px;padding:0 10px}.lbs-browser-toolbar button{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;display:inline-flex;font:inherit;font-size:12px;height:31px;justify-content:center;padding:0 9px}.lbs-browser-toolbar button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-browser-toolbar button:disabled{cursor:not-allowed;opacity:.38}.lbs-browser-nav-button{font-size:17px!important;padding:0!important;width:31px}.lbs-browser-address-shell{align-items:center;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:flex;flex:1;min-width:110px;padding-left:9px}.lbs-browser-address-icon{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-browser-address{appearance:none;background:transparent;border:0;color:inherit;flex:1;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;height:32px;min-width:80px;outline:0;padding:0 8px}.lbs-browser-address-shell:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px rgba(92,117,255,.12)}.lbs-browser-open{background:var(--dsw-alias-interactive-bg-primary)!important;color:var(--dsw-alias-label-on-primary)!important}.lbs-browser-ops{align-items:center;border-left:1px solid var(--dsw-alias-border-l1);display:flex;gap:6px;margin-left:3px;padding-left:9px}.lbs-browser-ops-state{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:10px;gap:5px;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-browser-ops-state:before{background:var(--dsw-alias-label-quaternary);border-radius:50%;content:"";height:6px;width:6px}.lbs-browser-ops-state[data-state=running]:before,.lbs-browser-ops-state[data-state=external]:before{background:var(--dsw-alias-state-success-primary,#2a9b67)}.lbs-browser-ops-state[data-state=starting]:before,.lbs-browser-ops-state[data-state=stopping]:before{background:var(--dsw-alias-state-warn-primary,#d6a84b)}.lbs-browser-ops-state[data-state=error]:before{background:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-browser-error{align-items:center;background:rgba(218,70,70,.1);border-bottom:1px solid rgba(218,70,70,.18);color:#d94b4b;display:flex;font-size:12px;gap:10px;line-height:1.45;padding:8px 12px}.lbs-browser-error span{flex:1}.lbs-browser-error button{background:transparent;border:1px solid currentColor;border-radius:6px;color:inherit;cursor:pointer;font:11px/25px inherit;padding:0 8px}.lbs-browser-viewport{flex:1;min-height:0}.lbs-browser-close{margin-left:2px}@media(max-width:980px){.lbs-browser-ops-state{display:none}}@media(max-width:850px){.lbs-browser-panel{left:0;right:0}.lbs-browser-toolbar{flex-wrap:wrap;padding:7px 9px}.lbs-browser-address-shell{order:3;width:calc(100% - 72px)}.lbs-browser-open{order:3}.lbs-browser-ops{border-left:0;margin-left:auto}.lbs-browser-viewport{min-height:300px}}
      .lbs-browser-web-mode{align-items:center;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--dsw-alias-brand-primary) 11%,transparent),transparent 46%);box-sizing:border-box;color:var(--dsw-alias-label-secondary);display:flex;flex:1;flex-direction:column;justify-content:center;min-height:0;padding:40px;text-align:center}.lbs-browser-web-mode-mark{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;color:var(--dsw-alias-brand-primary);display:flex;font-size:22px;height:58px;justify-content:center;margin-bottom:18px;width:58px}.lbs-browser-web-mode strong{color:var(--dsw-alias-label-primary);font-size:17px}.lbs-browser-web-mode p{font-size:12px;line-height:1.7;margin:9px 0 0;max-width:520px}.lbs-browser-web-mode code{background:var(--dsw-alias-bg-layer-1);border-radius:5px;padding:2px 5px}.lbs-browser-panel[data-open=false]{pointer-events:none!important;visibility:hidden!important}
      .lbs-browser-inspect{border:1px solid var(--dsw-alias-border-l1)!important;gap:5px}.lbs-browser-inspect[data-active=true]{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)!important;border-color:var(--dsw-alias-brand-primary)!important;color:var(--dsw-alias-brand-primary)}.lbs-browser-inspect-banner{align-items:center;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1));border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,var(--dsw-alias-border-l1));color:var(--dsw-alias-label-secondary);display:flex;font-size:11px;gap:8px;min-height:30px;padding:0 12px}.lbs-browser-inspect-banner:before{background:var(--dsw-alias-brand-primary);border-radius:50%;content:"";height:6px;width:6px}.lbs-browser-inspect-banner strong{color:var(--dsw-alias-label-primary)}
    `;
      if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-browserops"]')) {
        const style = document.createElement("style");
        style.dataset.pluginCss = "@laobos/dsh-browserops";
        style.textContent = css;
        document.head.append(style);
      }
      const messageOf = (reason) => String(reason instanceof Error ? reason.message : reason).replace(/^Error invoking remote method '[^']+': Error:\s*/u, "");
      const browserPreviewAvailable = () => window.laobosDesktop?.capabilities?.browserPreview === true;
      const elementPickerAvailable = () => window.laobosDesktop?.capabilities?.browserElementPicker === true;
      const normalizedAddress = (value) => {
        let input = String(value || "").trim();
        if (!input) throw new Error("请输入要打开的 HTTP(S) 地址。");
        if (!/^[a-z][a-z\d+.-]*:\/\//iu.test(input)) input = `http://${input}`;
        const url = new URL(input);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("浏览器预览只允许 HTTP(S) 地址。");
        if (url.username || url.password) throw new Error("浏览器地址不能包含用户名或密码。");
        return url.toString();
      };
      function BrowserPanel() {
        const [open, setOpen] = useState(false);
        const [address, setAddress] = useState("");
        const [state, setState] = useState({});
        const [error, setError] = useState("");
        const viewport = useRef(null);
        const addressInput = useRef(null);
        const addressRef = useRef(address);
        const pickerSessionRef = useRef();
        useEffect(() => {
          addressRef.current = address;
        }, [address]);
        const applyBrowserState = (value = {}) => {
          setState(value);
          if (value.url && document.activeElement !== addressInput.current) setAddress(value.url);
          setError(value.error || value.inspectError || "");
        };
        useEffect(() => {
          window.dispatchEvent(new CustomEvent("laobos:desktop-tool-ready", { detail: { tool: "browser" } }));
        }, []);
        useEffect(() => {
          if (open) window.dispatchEvent(new CustomEvent("laobos:desktop-tool-opened", { detail: { tool: "browser" } }));
        }, [open]);
        useEffect(() => {
          const show = (event) => {
            if (event.detail?.tool === "close") {
              setOpen(false);
              return;
            }
            if (event.detail?.tool !== "browser") return;
            setOpen(true);
            setError("");
            const requestedUrl = typeof event.detail?.url === "string" ? event.detail.url.trim() : "";
            if (!requestedUrl || !browserPreviewAvailable()) return;
            try {
              const target = normalizedAddress(requestedUrl);
              addressRef.current = target;
              setAddress(target);
              void window.laobosDesktop.browser.show(true).then(() => window.laobosDesktop.browser.navigate(target)).then(applyBrowserState).catch((reason) => setError(messageOf(reason)));
            } catch (reason) {
              setError(messageOf(reason));
            }
          };
          window.addEventListener("laobos:open-desktop-tool", show);
          return () => window.removeEventListener("laobos:open-desktop-tool", show);
        }, []);
        useEffect(() => {
          if (!browserPreviewAvailable()) return void 0;
          const openConversationLink = (event) => {
            const url = conversationBrowserUrlFromClick(event, window.location.href);
            if (!url) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", {
              detail: { tool: "browser", url, source: "conversation-link" }
            }));
          };
          document.addEventListener("click", openConversationLink, true);
          return () => document.removeEventListener("click", openConversationLink, true);
        }, []);
        useEffect(() => {
          if (!open || !window.laobosDesktop?.capabilities?.browserPreview) return void 0;
          let disposed = false;
          let frame = 0;
          const sync = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              if (!viewport.current || disposed) return;
              const rect = viewport.current.getBoundingClientRect();
              void window.laobosDesktop.browser.setBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
            });
          };
          const observer = new ResizeObserver(sync);
          observer.observe(viewport.current);
          window.addEventListener("resize", sync);
          const offState = window.laobosDesktop.browser.onState(applyBrowserState);
          const offElement = window.laobosDesktop.browser.onElementSelected?.((element) => {
            const sessionId = pickerSessionRef.current || module.ctx.sessions.list.getSnapshot().current;
            pickerSessionRef.current = void 0;
            if (!sessionId) {
              setError("当前没有可接入网页元素的对话。 ");
              return;
            }
            const handled = !window.dispatchEvent(new CustomEvent("laobos:add-browser-element-context", {
              detail: { sessionId, element },
              cancelable: true
            }));
            if (!handled) {
              setError("DSH 对话上下文服务尚未就绪，请重新加载后重试。 ");
              return;
            }
            setOpen(false);
            window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "browser" } }));
          }) || (() => {
          });
          void window.laobosDesktop.browser.show(true).then((value) => {
            applyBrowserState(value);
            sync();
          }).catch((reason) => setError(messageOf(reason)));
          const focusAddress = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "l") return;
            event.preventDefault();
            addressInput.current?.focus();
            addressInput.current?.select();
          };
          window.addEventListener("keydown", focusAddress);
          return () => {
            disposed = true;
            if (frame) cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", sync);
            window.removeEventListener("keydown", focusAddress);
            offState();
            offElement();
            pickerSessionRef.current = void 0;
            void window.laobosDesktop.browser.show(false);
          };
        }, [open]);
        const navigate = async () => {
          const target = addressRef.current.trim();
          if (!target) {
            addressInput.current?.focus();
            return;
          }
          try {
            setError("");
            if (!browserPreviewAvailable()) {
              const url = normalizedAddress(target);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.target = "_blank";
              anchor.rel = "noopener noreferrer";
              anchor.click();
              applyBrowserState({ url, loading: false, canGoBack: false, canGoForward: false });
              return;
            }
            applyBrowserState(await window.laobosDesktop.browser.navigate(target));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        const action = async (name) => {
          if (!browserPreviewAvailable()) {
            if (name === "reload") await navigate();
            return;
          }
          try {
            applyBrowserState(await window.laobosDesktop.browser.action(name));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        const toggleInspect = async () => {
          if (!elementPickerAvailable()) {
            setError("网页元素点选仅在桌面内置浏览器中可用。 ");
            return;
          }
          try {
            setError("");
            if (state.inspecting || state.inspectBusy) {
              pickerSessionRef.current = void 0;
              applyBrowserState(await window.laobosDesktop.browser.stopInspect());
              return;
            }
            const sessionId = module.ctx.sessions.list.getSnapshot().current;
            if (!sessionId) throw new Error("请先打开一个对话，再点选网页元素。 ");
            pickerSessionRef.current = sessionId;
            applyBrowserState(await window.laobosDesktop.browser.startInspect());
          } catch (reason) {
            pickerSessionRef.current = void 0;
            setError(messageOf(reason));
          }
        };
        const close = () => {
          pickerSessionRef.current = void 0;
          setOpen(false);
          window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "browser" } }));
        };
        return /* @__PURE__ */ React.createElement("section", { className: "lbs-browser-panel", "data-open": open, role: "dialog", "aria-label": "内置浏览器", "aria-hidden": !open }, /* @__PURE__ */ React.createElement("header", { className: "lbs-browser-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", disabled: !state.canGoBack, onClick: () => action("back"), title: "后退" }, "←"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", disabled: !state.canGoForward, onClick: () => action("forward"), title: "前进" }, "→"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", onClick: () => action(state.loading ? "stop" : "reload"), title: state.loading ? "停止加载" : "刷新" }, state.loading ? "×" : "↻"), /* @__PURE__ */ React.createElement("label", { className: "lbs-browser-address-shell" }, /* @__PURE__ */ React.createElement("span", { className: "lbs-browser-address-icon" }, "HTTP"), /* @__PURE__ */ React.createElement("input", { ref: addressInput, className: "lbs-browser-address", value: address, onChange: (event) => setAddress(event.target.value), onKeyDown: (event) => {
          if (event.key === "Enter") void navigate();
        }, placeholder: "输入地址，例如 localhost:5173", "aria-label": "浏览器地址" })), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-open", disabled: !address.trim(), onClick: navigate }, "打开"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-inspect", "data-active": state.inspecting || void 0, "aria-pressed": state.inspecting === true, disabled: !elementPickerAvailable() || state.loading || !state.url || Boolean(state.error), onClick: toggleInspect, title: "点击后，在预览页中选择要交给 Agent 修改的界面元素" }, state.inspectBusy ? "读取元素…" : state.inspecting ? "取消点选" : "⌖ 点选元素"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-close", onClick: close }, "关闭")), error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-error" }, /* @__PURE__ */ React.createElement("span", null, error), state.error ? /* @__PURE__ */ React.createElement("button", { type: "button", disabled: !address.trim(), onClick: navigate }, "重试") : null) : null, state.inspecting ? /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-inspect-banner" }, /* @__PURE__ */ React.createElement("strong", null, "元素点选已开启"), /* @__PURE__ */ React.createElement("span", null, "移动鼠标查看高亮，点击元素添加到当前对话；按 Esc 取消。")) : null, /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-viewport", ref: viewport }, browserPreviewAvailable() ? null : /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-web-mode" }, /* @__PURE__ */ React.createElement("span", { className: "lbs-browser-web-mode-mark" }, "↗"), /* @__PURE__ */ React.createElement("strong", null, "Web 标签页模式"), /* @__PURE__ */ React.createElement("p", null, "输入地址后会使用当前浏览器打开新标签页；内嵌预览和网页元素点选仅在桌面版中可用。"))));
      }
      const inject = ["slots", "sessions"];
      function apply(ctx) {
        module.ctx = ctx;
        ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-browserops", order: 41 }, BrowserPanel));
      }
      exports.apply = apply;
      exports.inject = inject;
      return module.exports;
    }
  });
})();
