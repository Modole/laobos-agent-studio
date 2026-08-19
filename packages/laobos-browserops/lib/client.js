/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
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
      .lbs-browser-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}.lbs-browser-toolbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:6px;min-height:52px;padding:0 10px}.lbs-browser-toolbar button{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;display:inline-flex;font:inherit;font-size:12px;height:31px;justify-content:center;padding:0 9px}.lbs-browser-toolbar button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-browser-toolbar button:disabled{cursor:not-allowed;opacity:.38}.lbs-browser-nav-button{font-size:17px!important;padding:0!important;width:31px}.lbs-browser-address-shell{align-items:center;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:flex;flex:1;min-width:110px;padding-left:9px}.lbs-browser-address-icon{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-browser-address{appearance:none;background:transparent;border:0;color:inherit;flex:1;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;height:32px;min-width:80px;outline:0;padding:0 8px}.lbs-browser-address-shell:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px rgba(92,117,255,.12)}.lbs-browser-open{background:var(--dsw-alias-interactive-bg-primary)!important;color:var(--dsw-alias-label-on-primary)!important}.lbs-browser-ops{align-items:center;border-left:1px solid var(--dsw-alias-border-l1);display:flex;gap:6px;margin-left:3px;padding-left:9px}.lbs-browser-ops-state{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:10px;gap:5px;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-browser-ops-state:before{background:var(--dsw-alias-label-quaternary);border-radius:50%;content:"";height:6px;width:6px}.lbs-browser-ops-state[data-state=running]:before,.lbs-browser-ops-state[data-state=external]:before{background:#2a9b67}.lbs-browser-ops-state[data-state=starting]:before,.lbs-browser-ops-state[data-state=stopping]:before{background:#d6a84b}.lbs-browser-ops-state[data-state=error]:before{background:#d94b4b}.lbs-browser-error{align-items:center;background:rgba(218,70,70,.1);border-bottom:1px solid rgba(218,70,70,.18);color:#d94b4b;display:flex;font-size:12px;gap:10px;line-height:1.45;padding:8px 12px}.lbs-browser-error span{flex:1}.lbs-browser-error button{background:transparent;border:1px solid currentColor;border-radius:6px;color:inherit;cursor:pointer;font:11px/25px inherit;padding:0 8px}.lbs-browser-viewport{flex:1;min-height:0}.lbs-browser-close{margin-left:2px}@media(max-width:980px){.lbs-browser-ops-state{display:none}}@media(max-width:850px){.lbs-browser-panel{left:0;right:0}.lbs-browser-toolbar{flex-wrap:wrap;padding:7px 9px}.lbs-browser-address-shell{order:3;width:calc(100% - 72px)}.lbs-browser-open{order:3}.lbs-browser-ops{border-left:0;margin-left:auto}.lbs-browser-viewport{min-height:300px}}
    `;
      if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-browserops"]')) {
        const style = document.createElement("style");
        style.dataset.pluginCss = "@laobos/dsh-browserops";
        style.textContent = css;
        document.head.append(style);
      }
      const messageOf = (reason) => String(reason instanceof Error ? reason.message : reason).replace(/^Error invoking remote method '[^']+': Error:\s*/u, "");
      function BrowserPanel() {
        const [open, setOpen] = useState(false);
        const [address, setAddress] = useState("");
        const [state, setState] = useState({});
        const [ops, setOps] = useState({ state: "stopped", message: "BrowserOps 未启动" });
        const [error, setError] = useState("");
        const viewport = useRef(null);
        const addressInput = useRef(null);
        const addressRef = useRef(address);
        useEffect(() => {
          addressRef.current = address;
        }, [address]);
        const applyBrowserState = (value = {}) => {
          setState(value);
          if (value.url) setAddress(value.url);
          setError(value.error || "");
        };
        useEffect(() => {
          const show = (event) => {
            if (event.detail?.tool === "close") {
              setOpen(false);
              return;
            }
            if (event.detail?.tool !== "browser") return;
            setOpen(true);
            setError("");
          };
          window.addEventListener("laobos:open-desktop-tool", show);
          return () => window.removeEventListener("laobos:open-desktop-tool", show);
        }, []);
        useEffect(() => {
          if (!open || !window.laobosDesktop?.capabilities?.browserPreview) return void 0;
          let disposed = false;
          const sync = () => {
            if (!viewport.current || disposed) return;
            const rect = viewport.current.getBoundingClientRect();
            void window.laobosDesktop.browser.setBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
          };
          const observer = new ResizeObserver(sync);
          observer.observe(viewport.current);
          window.addEventListener("resize", sync);
          const offState = window.laobosDesktop.browser.onState(applyBrowserState);
          const offOps = window.laobosDesktop.browserOps.onState(setOps);
          void window.laobosDesktop.browser.show(true).then((value) => {
            applyBrowserState(value);
            sync();
          }).catch((reason) => setError(messageOf(reason)));
          void window.laobosDesktop.browserOps.status().then(setOps).catch((reason) => setOps({ state: "error", message: messageOf(reason) }));
          const focusAddress = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "l") return;
            event.preventDefault();
            addressInput.current?.focus();
            addressInput.current?.select();
          };
          window.addEventListener("keydown", focusAddress);
          return () => {
            disposed = true;
            observer.disconnect();
            window.removeEventListener("resize", sync);
            window.removeEventListener("keydown", focusAddress);
            offState();
            offOps();
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
            applyBrowserState(await window.laobosDesktop.browser.navigate(target));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        const action = async (name) => {
          try {
            applyBrowserState(await window.laobosDesktop.browser.action(name));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        const toggleOps = async () => {
          if (["starting", "stopping", "external"].includes(ops.state)) return;
          try {
            setError("");
            setOps(await (ops.state === "running" ? window.laobosDesktop.browserOps.stop() : window.laobosDesktop.browserOps.start()));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        const close = () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "browser" } }));
        };
        if (!open) return null;
        const opsLabel = ops.state === "running" ? "停止 BrowserOps" : ops.state === "external" ? "外部 BrowserOps" : ops.state === "starting" ? "正在启动…" : ops.state === "stopping" ? "正在停止…" : "启动 BrowserOps";
        return /* @__PURE__ */ React.createElement("section", { className: "lbs-browser-panel", role: "dialog", "aria-label": "内置浏览器" }, /* @__PURE__ */ React.createElement("header", { className: "lbs-browser-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", disabled: !state.canGoBack, onClick: () => action("back"), title: "后退" }, "←"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", disabled: !state.canGoForward, onClick: () => action("forward"), title: "前进" }, "→"), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-nav-button", onClick: () => action(state.loading ? "stop" : "reload"), title: state.loading ? "停止加载" : "刷新" }, state.loading ? "×" : "↻"), /* @__PURE__ */ React.createElement("label", { className: "lbs-browser-address-shell" }, /* @__PURE__ */ React.createElement("span", { className: "lbs-browser-address-icon" }, "HTTP"), /* @__PURE__ */ React.createElement("input", { ref: addressInput, className: "lbs-browser-address", value: address, onChange: (event) => setAddress(event.target.value), onKeyDown: (event) => {
          if (event.key === "Enter") void navigate();
        }, placeholder: "输入地址，例如 localhost:5173", "aria-label": "浏览器地址" })), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-open", disabled: !address.trim(), onClick: navigate }, "打开"), /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-ops" }, /* @__PURE__ */ React.createElement("button", { disabled: ["starting", "stopping", "external"].includes(ops.state), onClick: toggleOps }, opsLabel), /* @__PURE__ */ React.createElement("span", { className: "lbs-browser-ops-state", "data-state": ops.state, title: ops.message }, ops.message || ops.state)), /* @__PURE__ */ React.createElement("button", { className: "lbs-browser-close", onClick: close }, "关闭")), error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-error" }, /* @__PURE__ */ React.createElement("span", null, error), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: !address.trim(), onClick: navigate }, "重试")) : null, /* @__PURE__ */ React.createElement("div", { className: "lbs-browser-viewport", ref: viewport }));
      }
      const inject = ["slots"];
      function apply(ctx) {
        ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-browserops", order: 41 }, BrowserPanel));
      }
      exports.apply = apply;
      exports.inject = inject;
      return module.exports;
    }
  });
})();
