/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-browserops",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { createElement: h, useEffect, useRef, useState } = React;
    const css = `.lbs-browser-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}.lbs-browser-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:5px;height:48px;padding:0 9px}.lbs-browser-toolbar button{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:inherit;font-size:12px;height:29px;padding:0 8px}.lbs-browser-toolbar button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-browser-toolbar button:disabled{opacity:.4}.lbs-browser-address{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:7px;color:inherit;flex:1;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;height:30px;min-width:90px;padding:0 9px}.lbs-browser-viewport{flex:1;min-height:0}.lbs-browser-ops{align-items:center;border-left:1px solid var(--dsw-alias-border-l1);display:flex;gap:5px;margin-left:4px;padding-left:8px}.lbs-browser-ops span{color:var(--dsw-alias-label-tertiary);font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-browser-error{background:rgba(218,70,70,.1);color:#d94b4b;font-size:12px;padding:7px 11px}@media(max-width:850px){.lbs-browser-panel{left:0;right:0}.lbs-browser-ops span{display:none}}`;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-browserops"]')) { const style = document.createElement("style"); style.dataset.pluginCss = "@laobos/dsh-browserops"; style.textContent = css; document.head.append(style); }

    function BrowserPanel() {
      const [open, setOpen] = useState(false); const [address, setAddress] = useState("http://127.0.0.1:3000"); const [state, setState] = useState({}); const [ops, setOps] = useState({ state: "stopped", message: "" }); const [error, setError] = useState(""); const viewport = useRef(null); const addressRef = useRef(address);
      useEffect(() => { addressRef.current = address; }, [address]);
      useEffect(() => { const show = (event) => { if (event.detail?.tool === "close") { setOpen(false); return; } if (event.detail?.tool !== "browser") return; setOpen(true); setError(""); }; window.addEventListener("laobos:open-desktop-tool", show); return () => window.removeEventListener("laobos:open-desktop-tool", show); }, []);
      useEffect(() => {
        if (!open || !window.laobosDesktop?.capabilities?.browserPreview) return undefined;
        let disposed = false;
        const sync = () => { if (!viewport.current || disposed) return; const rect = viewport.current.getBoundingClientRect(); void window.laobosDesktop.browser.setBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }); };
        const observer = new ResizeObserver(sync); observer.observe(viewport.current); window.addEventListener("resize", sync);
        const offState = window.laobosDesktop.browser.onState((value) => { setState(value); if (value.url) setAddress(value.url); });
        const offOps = window.laobosDesktop.browserOps.onState(setOps);
        void window.laobosDesktop.browser.show(true).then((value) => { setState(value); sync(); if (!value.url) return window.laobosDesktop.browser.navigate(addressRef.current); }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
        void window.laobosDesktop.browserOps.status().then(setOps);
        return () => { disposed = true; observer.disconnect(); window.removeEventListener("resize", sync); offState(); offOps(); void window.laobosDesktop.browser.show(false); };
      }, [open]);
      const navigate = async () => { try { setError(""); setState(await window.laobosDesktop.browser.navigate(address)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
      const action = async (name) => { try { setState(await window.laobosDesktop.browser.action(name)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
      const toggleOps = async () => { try { setOps(await (ops.state === "running" ? window.laobosDesktop.browserOps.stop() : window.laobosDesktop.browserOps.start())); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
      const close = () => { setOpen(false); window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "browser" } })); };
      if (!open) return null;
      return h("section", { className: "lbs-browser-panel", role: "dialog", "aria-label": "浏览器预览" },
        h("header", { className: "lbs-browser-toolbar" }, h("button", { disabled: !state.canGoBack, onClick: () => action("back") }, "←"), h("button", { disabled: !state.canGoForward, onClick: () => action("forward") }, "→"), h("button", { onClick: () => action(state.loading ? "stop" : "reload") }, state.loading ? "停止" : "刷新"), h("input", { className: "lbs-browser-address", value: address, onChange: (event) => setAddress(event.target.value), onKeyDown: (event) => { if (event.key === "Enter") void navigate(); }, "aria-label": "浏览器地址" }), h("button", { onClick: navigate }, "打开"), h("div", { className: "lbs-browser-ops" }, h("button", { onClick: toggleOps }, ops.state === "running" ? "停止 BrowserOps" : "启动 BrowserOps"), h("span", { title: ops.message }, ops.message || ops.state)), h("button", { onClick: close }, "关闭")),
        error ? h("div", { className: "lbs-browser-error" }, error) : null,
        h("div", { className: "lbs-browser-viewport", ref: viewport }),
      );
    }
    const inject = ["slots"];
    function apply(ctx) { ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-browserops", order: 41 }, BrowserPanel)); }
    exports.apply = apply; exports.inject = inject; return module.exports;
  },
});
