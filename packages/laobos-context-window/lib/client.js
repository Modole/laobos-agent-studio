/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
  // packages/laobos-context-window/src/client.jsx
  window.__ModuleLoader__.load({
    id: "@laobos/dsh-context-window",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      const React = require2("react");
      const {
        useEffect,
        useId,
        useMemo,
        useRef,
        useState,
        useSyncExternalStore
      } = React;
      const API = "/laobos/api/context-window";
      const css = `
      .lbs-context-model{position:relative}.lbs-context-trigger{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;font:12px/20px inherit;gap:5px;height:28px;max-width:240px;padding:0 8px}.lbs-context-trigger:hover,.lbs-context-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-context-trigger:disabled{cursor:not-allowed;opacity:.45}.lbs-context-trigger-model{color:var(--dsw-alias-label-secondary);max-width:155px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-context-trigger-effort{color:var(--dsw-alias-label-tertiary);white-space:nowrap}.lbs-context-chevron{color:var(--dsw-alias-label-tertiary);font-size:12px;transition:transform .15s}.lbs-context-trigger[aria-expanded=true] .lbs-context-chevron{transform:rotate(180deg)}
      .lbs-context-menu{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:13px;bottom:calc(100% + 8px);box-shadow:0 10px 32px rgba(0,0,0,.14);box-sizing:border-box;color:var(--dsw-alias-label-primary);left:50%;min-width:252px;padding:6px;position:absolute;transform:translateX(-50%);z-index:120}.lbs-context-row{align-items:center;appearance:none;background:transparent;border:0;border-radius:9px;color:inherit;cursor:pointer;display:flex;font:13px/20px inherit;gap:12px;min-height:38px;padding:8px 10px;text-align:left;width:100%}.lbs-context-row:hover,.lbs-context-row[data-selected=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-context-row:disabled{cursor:not-allowed;opacity:.5}.lbs-context-row-label{flex:1;min-width:0}.lbs-context-row-value{color:var(--dsw-alias-label-tertiary);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-context-row-arrow{color:var(--dsw-alias-label-tertiary)}
      .lbs-context-toggle-state{align-items:center;display:flex;gap:8px}.lbs-context-toggle-value{color:var(--dsw-alias-label-tertiary);font-size:12px;min-width:28px;text-align:right}.lbs-context-switch{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-line-border);border-radius:999px;box-sizing:border-box;height:18px;position:relative;transition:background .15s,border-color .15s;width:30px}.lbs-context-switch::after{background:var(--dsw-alias-bg-layer-1);border:1px solid rgba(0,0,0,.08);border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.16);box-sizing:border-box;content:"";height:14px;left:1px;position:absolute;top:1px;transition:transform .15s;width:14px}.lbs-context-switch[data-checked=true]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}.lbs-context-switch[data-checked=true]::after{transform:translateX(12px)}
      .lbs-context-menu-title{align-items:center;display:flex;font-size:12px;font-weight:600;gap:8px;padding:7px 9px}.lbs-context-back{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:16px/22px inherit;height:26px;width:26px}.lbs-context-back:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-context-list{max-height:310px;overflow:auto}.lbs-context-group{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:10px;font-weight:600;justify-content:space-between;letter-spacing:.02em;padding:9px 31px 4px 10px;text-transform:uppercase}.lbs-context-option-copy{display:flex;flex:1;flex-direction:column;min-width:0}.lbs-context-option-name{align-items:center;display:flex;font-size:12px;gap:5px;line-height:18px;min-width:0}.lbs-context-option-name>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-context-option-copy small{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}.lbs-context-modality{color:var(--dsw-alias-brand-primary);display:block;flex:none;height:14px;width:14px}.lbs-context-multiplier{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;min-width:44px;text-align:right;white-space:nowrap}.lbs-context-check{color:var(--dsw-alias-brand-primary);font-weight:700;min-width:12px;text-align:center}.lbs-context-error{color:#d94b4b;font-size:11px;line-height:17px;padding:7px 10px}.lbs-context-loading{color:var(--dsw-alias-label-tertiary);font-size:11px;padding:9px 10px}
    `;
      async function request(path, init) {
        const response = await fetch(`${API}${path}`, {
          ...init,
          headers: { "content-type": "application/json", ...init?.headers || {} }
        });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value.error || `请求失败（${response.status}）`);
        return value;
      }
      function modelMultiplier(description) {
        const match = /(?:^| · )倍率\s+(\d+(?:\.\d+)?x(?:~\d+(?:\.\d+)?x)?)(?: · |$)/u.exec(description || "");
        if (!match) return "";
        return match[1];
      }
      function isMultimodalModel(model) {
        return Array.isArray(model?.inputModalities) && model.inputModalities.includes("image") || String(model?.description || "").split(" · ").includes("多模态");
      }
      function modelDetail(description) {
        return String(description || "").split(" · ").filter((item) => item !== "多模态" && !/^倍率\s+/u.test(item)).join(" · ");
      }
      function MultimodalIcon() {
        return /* @__PURE__ */ React.createElement("svg", { className: "lbs-context-modality", viewBox: "0 0 16 16", fill: "none", role: "img", "aria-label": "支持图片输入" }, /* @__PURE__ */ React.createElement("rect", { x: "1.5", y: "2", width: "13", height: "12", rx: "2", stroke: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "5", cy: "5.5", r: "1.25", fill: "currentColor" }), /* @__PURE__ */ React.createElement("path", { d: "M3.5 12l3.25-3.5 2.1 2.15 1.6-1.7L13 12", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }));
      }
      function formatContextWindow(value) {
        if (!Number.isFinite(value) || value <= 0) return "200K";
        if (value >= 1e6) {
          const millions = value / 1e6;
          return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
        }
        return `${Math.round(value / 1e3)}K`;
      }
      function ContextModelSelect({ locked, available, directory, load, select }) {
        const state = useSyncExternalStore(
          (listener) => directory.subscribe(listener),
          () => directory.getSnapshot()
        );
        const [open, setOpen] = useState(false);
        const [pane, setPane] = useState("root");
        const [context, setContext] = useState(null);
        const [contextBusy, setContextBusy] = useState(false);
        const [error, setError] = useState("");
        const rootRef = useRef(null);
        const menuId = useId();
        const choices = useMemo(() => state.groups.flatMap((group) => group.models.map((model) => ({
          group,
          model,
          selection: {
            provider: group.id,
            model: model.id,
            ...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
          }
        }))), [state.groups]);
        const currentChoice = choices.find((choice) => choice.selection.provider === state.current?.provider && choice.selection.model === state.current?.model);
        const reasoning = currentChoice?.model.reasoning;
        const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
        const effortLabel = reasoning?.efforts.find((item) => item.id === effectiveEffort)?.name ?? effectiveEffort;
        async function loadContext() {
          try {
            setContext(await request("/state"));
            setError("");
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        }
        useEffect(() => {
          if (!available) return;
          load();
          void loadContext();
        }, [available, load]);
        useEffect(() => {
          if (!open) return void 0;
          const close = (event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.type === "pointerdown" && !rootRef.current?.contains(event.target)) {
              setOpen(false);
            }
          };
          document.addEventListener("keydown", close);
          document.addEventListener("pointerdown", close);
          return () => {
            document.removeEventListener("keydown", close);
            document.removeEventListener("pointerdown", close);
          };
        }, [open]);
        async function toggleContext() {
          if (!context || contextBusy) return;
          const previous = context;
          const enabled = !context.enabled;
          setContext({
            ...context,
            enabled,
            effectiveContextWindow: enabled ? context.extendedContextWindow : context.standardContextWindow
          });
          setContextBusy(true);
          setError("");
          try {
            setContext(await request("/state", {
              method: "PUT",
              body: JSON.stringify({ enabled })
            }));
          } catch (reason) {
            setContext(previous);
            setError(reason instanceof Error ? reason.message : String(reason));
          } finally {
            setContextBusy(false);
          }
        }
        async function choose(selection) {
          setError("");
          if (await select(selection)) {
            setPane("root");
            return;
          }
          setError("模型设置未被 DSH 接受，请重试。");
        }
        const modelLabel = currentChoice?.model.name || state.current?.model || "选择模型";
        const effectiveLabel = formatContextWindow(context?.effectiveContextWindow);
        const effortChoices = reasoning === void 0 ? [] : [
          ...reasoning.defaultEffort === void 0 ? [{ id: void 0, name: "Default" }] : [],
          ...reasoning.efforts
        ];
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-context-model", ref: rootRef }, /* @__PURE__ */ React.createElement("style", null, css), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "lbs-context-trigger",
            "aria-expanded": open,
            "aria-controls": open ? menuId : void 0,
            "aria-label": `选择模型，当前 ${modelLabel}${effortLabel ? `，推理等级 ${effortLabel}` : ""}，上下文 ${effectiveLabel}`,
            disabled: locked || !available,
            onClick: () => {
              setOpen((value) => !value);
              setPane("root");
              setError("");
              if (!open) {
                load();
                void loadContext();
              }
            }
          },
          /* @__PURE__ */ React.createElement("span", { className: "lbs-context-trigger-model" }, modelLabel),
          effortLabel ? /* @__PURE__ */ React.createElement("span", { className: "lbs-context-trigger-effort" }, effortLabel) : null,
          /* @__PURE__ */ React.createElement("span", { className: "lbs-context-chevron", "aria-hidden": "true" }, "⌃")
        ), open ? /* @__PURE__ */ React.createElement("div", { className: "lbs-context-menu", id: menuId, role: "menu", "aria-label": "模型、推理等级与上下文调节" }, pane === "root" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            role: "switch",
            className: "lbs-context-row",
            "aria-label": `上下文调节开关，当前 ${effectiveLabel}`,
            "aria-checked": context?.enabled === true,
            disabled: !context || contextBusy,
            onClick: () => void toggleContext()
          },
          /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-label" }, "上下文调节"),
          /* @__PURE__ */ React.createElement("span", { className: "lbs-context-toggle-state" }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-toggle-value" }, effectiveLabel), /* @__PURE__ */ React.createElement("span", { className: "lbs-context-switch", "data-checked": context?.enabled === true, "aria-hidden": "true" }))
        ), /* @__PURE__ */ React.createElement("button", { type: "button", className: "lbs-context-row", onClick: () => setPane("models") }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-label" }, "模型"), /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-value" }, modelLabel), /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-arrow", "aria-hidden": "true" }, "›")), reasoning ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "lbs-context-row", onClick: () => setPane("efforts") }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-label" }, "推理等级"), /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-value" }, effortLabel || "Default"), /* @__PURE__ */ React.createElement("span", { className: "lbs-context-row-arrow", "aria-hidden": "true" }, "›")) : null) : null, pane === "models" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "lbs-context-menu-title" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "lbs-context-back", "aria-label": "返回", onClick: () => setPane("root") }, "‹"), /* @__PURE__ */ React.createElement("span", null, "选择模型")), /* @__PURE__ */ React.createElement("div", { className: "lbs-context-list" }, state.status === "loading" ? /* @__PURE__ */ React.createElement("div", { className: "lbs-context-loading" }, "正在刷新模型列表…") : null, state.groups.map((group) => /* @__PURE__ */ React.createElement("div", { key: group.id }, /* @__PURE__ */ React.createElement("div", { className: "lbs-context-group" }, /* @__PURE__ */ React.createElement("span", null, group.name), group.models.some((model) => modelMultiplier(model.description)) ? /* @__PURE__ */ React.createElement("span", null, "倍率") : null), group.models.map((model) => {
          const active = state.current?.provider === group.id && state.current?.model === model.id;
          const multimodal = isMultimodalModel(model);
          const multiplier = modelMultiplier(model.description);
          const detail = modelDetail(model.description);
          return /* @__PURE__ */ React.createElement("button", { key: model.id, type: "button", className: "lbs-context-row", "data-selected": active, onClick: () => void choose({ provider: group.id, model: model.id, ...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort } }) }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-option-copy" }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-option-name" }, /* @__PURE__ */ React.createElement("span", null, model.name), multimodal ? /* @__PURE__ */ React.createElement(MultimodalIcon, null) : null), detail ? /* @__PURE__ */ React.createElement("small", null, detail) : null), multiplier ? /* @__PURE__ */ React.createElement("span", { className: "lbs-context-multiplier" }, multiplier) : null, active || multiplier ? /* @__PURE__ */ React.createElement("span", { className: "lbs-context-check" }, active ? "✓" : "") : null);
        }))))) : null, pane === "efforts" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "lbs-context-menu-title" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "lbs-context-back", "aria-label": "返回", onClick: () => setPane("root") }, "‹"), /* @__PURE__ */ React.createElement("span", null, "推理等级")), /* @__PURE__ */ React.createElement("div", { className: "lbs-context-list" }, effortChoices.map((effort) => {
          const active = effort.id === effectiveEffort;
          return /* @__PURE__ */ React.createElement("button", { key: effort.id || "provider-default", type: "button", className: "lbs-context-row", "data-selected": active, onClick: () => void choose({ provider: currentChoice.selection.provider, model: currentChoice.selection.model, ...effort.id === void 0 ? {} : { reasoningEffort: effort.id } }) }, /* @__PURE__ */ React.createElement("span", { className: "lbs-context-option-copy" }, /* @__PURE__ */ React.createElement("span", null, effort.name), effort.description ? /* @__PURE__ */ React.createElement("small", null, effort.description) : null), active ? /* @__PURE__ */ React.createElement("span", { className: "lbs-context-check" }, "✓") : null);
        }))) : null, error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-context-error", role: "alert" }, error) : null) : null);
      }
      const inject = ["slots", "modelDirectories", "sessions"];
      function apply(ctx) {
        ctx.slots.inject("conversation.input.model", () => ctx.slots.register({
          name: "conversation.input.model",
          priority: -100,
          inject: (sessionId) => {
            const directory = ctx.modelDirectories.directoryFor(sessionId);
            const available = ctx.sessions.subagentAddress(sessionId) === void 0;
            return {
              available,
              directory: directory.store,
              load: () => {
                if (available) directory.load().catch(() => {
                });
              },
              select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
            };
          }
        }, ContextModelSelect));
      }
      exports.apply = apply;
      exports.inject = inject;
      return module.exports;
    }
  });
})();
