/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
  // packages/laobos-shell/src/client.jsx
  window.__ModuleLoader__.load({
    id: "@laobos/dsh-shell",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      const React = require2("react");
      const { createElement: h, useEffect, useMemo, useState } = React;
      const css = `
      .lbs-shell-page{display:flex;flex-direction:column;gap:14px;max-width:820px}.lbs-shell-hero{align-items:flex-start;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:14px;display:flex;gap:12px;padding:16px}.lbs-shell-icon{align-items:center;background:var(--dsw-alias-bg-layer-2);border-radius:10px;display:flex;flex:none;font:600 14px ui-monospace,SFMono-Regular,Menlo,monospace;height:38px;justify-content:center;width:38px}.lbs-shell-copy{flex:1;min-width:0}.lbs-shell-title{font-size:16px;font-weight:600;line-height:23px}.lbs-shell-sub{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;margin-top:3px}.lbs-shell-badge{border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:22px;padding:0 9px;white-space:nowrap}.lbs-shell-badge[data-ready=true]{background:rgba(44,168,110,.1);border-color:rgba(44,168,110,.25);color:#2a9b67}.lbs-shell-progress{background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:7px;overflow:hidden}.lbs-shell-progress>span{background:var(--dsw-alias-brand-primary);display:block;height:100%;transition:width .2s}.lbs-shell-progress[data-indeterminate=true]>span{animation:lbs-shell-progress 1.2s ease-in-out infinite;width:35%}@keyframes lbs-shell-progress{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}.lbs-shell-grid{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}.lbs-shell-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:12px;padding:12px}.lbs-shell-card strong{display:block;font-size:13px}.lbs-shell-card span{color:var(--dsw-alias-label-tertiary);display:block;font-size:11px;line-height:18px;margin-top:4px;overflow-wrap:anywhere}.lbs-shell-actions{display:flex;flex-wrap:wrap;gap:8px}.lbs-shell-button{appearance:none;background:var(--dsw-alias-interactive-bg-primary);border:0;border-radius:9px;color:var(--dsw-alias-label-on-primary);cursor:pointer;font:inherit;font-size:12px;height:34px;padding:0 13px}.lbs-shell-button.secondary{background:var(--dsw-alias-interactive-bg-secondary);color:var(--dsw-alias-label-primary)}.lbs-shell-button:disabled{cursor:not-allowed;opacity:.5}.lbs-shell-note{background:var(--dsw-alias-bg-layer-2);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;padding:11px 12px}.lbs-shell-error{color:#d94b4b;white-space:pre-wrap}.lbs-shell-repair{display:flex;flex-direction:column;gap:9px}.lbs-shell-repair textarea{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:10px;box-sizing:border-box;color:inherit;font:12px/19px ui-monospace,SFMono-Regular,Menlo,monospace;min-height:220px;padding:10px;resize:vertical;width:100%}@media(max-width:760px){.lbs-shell-grid{grid-template-columns:1fr}.lbs-shell-hero{flex-wrap:wrap}}
    `;
      const style = document.createElement("style");
      style.dataset.laobosShell = "true";
      style.textContent = css;
      document.head.appendChild(style);
      function backendLabel(value) {
        return {
          "native-bash": "系统 Bash",
          wsl: "WSL Bash",
          "git-bash": "Git Bash",
          powershell: "PowerShell 兼容"
        }[value] || "检测中";
      }
      function ShellSettingsSection() {
        const desktop = window.laobosDesktop;
        const api = desktop?.shell;
        const [state, setState] = useState(null);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState("");
        const [repairPrompt, setRepairPrompt] = useState("");
        useEffect(() => {
          if (!api) return;
          let active = true;
          api.status().then((value) => {
            if (active) setState(value);
          }).catch((reason) => {
            if (active) setError(reason.message);
          });
          const unsubscribe = api.onState((value) => {
            if (active) setState(value);
          });
          return () => {
            active = false;
            unsubscribe();
          };
        }, [api]);
        const wslText = useMemo(() => {
          if (!state?.wsl?.available) return "Windows 组件尚未启用";
          if (!state.wsl.distributions?.length) return "尚未安装 Linux 发行版";
          if (state.wsl.defaultUserIsRoot) return `${state.wsl.distribution} 可用，待创建普通用户`;
          if (state.wsl.initializationBlocked) return `${state.wsl.distribution} 首次初始化可能卡住`;
          if (!state.wsl.ready) return `${state.wsl.distribution || state.wsl.distributions[0]} 需要初始化或修复`;
          return `${state.wsl.distribution} 已就绪`;
        }, [state]);
        async function action(operation) {
          setBusy(true);
          setError("");
          try {
            setState(await operation());
          } catch (reason) {
            setError(reason.message || String(reason));
          } finally {
            setBusy(false);
          }
        }
        async function prepareRepair() {
          setBusy(true);
          setError("");
          try {
            const value = await api.repairPrompt();
            setRepairPrompt(value.prompt);
          } catch (reason) {
            setError(reason.message || String(reason));
          } finally {
            setBusy(false);
          }
        }
        async function sendRepair() {
          const prompt = repairPrompt.trim();
          if (!prompt) return;
          setBusy(true);
          setError("");
          try {
            const snapshot = module.ctx.sessions.list.getSnapshot();
            const cwd = snapshot.current ? snapshot.byId?.[snapshot.current]?.cwd : void 0;
            const sessionId = await module.ctx.sessions.create({
              ...cwd ? { cwd } : {},
              agentPreset: "standard"
            });
            module.ctx.sessions.open(sessionId);
            const scoped = module.ctx.sessions.scope(sessionId);
            const conversation = scoped?.get("conversation");
            if (!conversation) throw new Error("修复会话尚未就绪。 ");
            await conversation.send(prompt);
            setRepairPrompt("");
          } catch (reason) {
            setError(reason.message || String(reason));
          } finally {
            setBusy(false);
          }
        }
        if (!api) {
          return h("div", { className: "lbs-shell-note" }, "WSL 管理仅在劳博士 Windows 桌面版中可用；当前环境继续使用系统 Shell。");
        }
        const indeterminate = state?.progress?.kind !== "determinate";
        const percent = indeterminate ? 0 : Number(state?.progress?.percent || 0);
        const ready = state?.selectedBackend === "wsl" || state?.selectedBackend === "native-bash";
        return h(
          "div",
          { className: "lbs-shell-page" },
          h(
            "section",
            { className: "lbs-shell-hero" },
            h("span", { className: "lbs-shell-icon", "aria-hidden": true }, ">_"),
            h(
              "div",
              { className: "lbs-shell-copy" },
              h("div", { className: "lbs-shell-title" }, "Shell 与 WSL 环境"),
              h("div", { className: "lbs-shell-sub" }, state?.message || "正在读取环境状态…")
            ),
            h("span", { className: "lbs-shell-badge", "data-ready": ready }, backendLabel(state?.selectedBackend))
          ),
          state?.phase === "installing" || state?.phase === "verifying" || state?.phase === "detecting" ? h("div", { className: "lbs-shell-progress", "data-indeterminate": indeterminate }, h("span", { style: indeterminate ? void 0 : { width: `${percent}%` } })) : null,
          h(
            "div",
            { className: "lbs-shell-grid" },
            h("div", { className: "lbs-shell-card" }, h("strong", null, "当前路由"), h("span", null, backendLabel(state?.selectedBackend))),
            h("div", { className: "lbs-shell-card" }, h("strong", null, "WSL"), h("span", null, wslText)),
            h("div", { className: "lbs-shell-card" }, h("strong", null, "兼容后端"), h("span", null, state?.gitBash?.executable ? "Git Bash 可用" : "PowerShell 可用"))
          ),
          h(
            "div",
            { className: "lbs-shell-actions" },
            h("button", { type: "button", className: "lbs-shell-button secondary", disabled: busy, onClick: () => action(() => api.refresh()) }, busy ? "处理中…" : "重新检测"),
            state?.platform === "win32" && !state?.wsl?.ready && !state?.wsl?.installed ? h("button", { type: "button", className: "lbs-shell-button", disabled: busy, onClick: () => action(() => api.installWsl("Ubuntu-24.04")) }, "安装 WSL + Ubuntu 24.04") : null,
            state?.platform === "win32" && !state?.wsl?.ready && state?.wsl?.installed && state?.wsl?.distribution ? h("button", { type: "button", className: "lbs-shell-button", disabled: busy, onClick: () => action(() => api.initializeWsl()) }, "打开 Linux 初始化窗口") : null,
            state?.platform === "win32" && state?.wsl?.defaultUserIsRoot ? h("button", { type: "button", className: "lbs-shell-button", disabled: busy, onClick: () => action(() => api.initializeWsl()) }, "打开 Linux 用户设置") : null,
            state?.status === "error" || state?.status === "attention" || state?.lastError ? h("button", { type: "button", className: "lbs-shell-button secondary", disabled: busy, onClick: prepareRepair }, "创建诊断对话") : null
          ),
          state?.requiresRestart ? h("div", { className: "lbs-shell-note" }, "Windows 需要重启。劳博士会保留安装状态，并在下次启动时自动检测。") : null,
          state?.wsl?.initializationBlocked ? h("div", { className: "lbs-shell-note" }, "发行版可能被首次启动窗口或 OOBE 状态阻塞。请先关闭残留安装窗口，再创建诊断对话；劳博士不会自动修改注册表。") : null,
          state?.wsl?.defaultUserIsRoot ? h("div", { className: "lbs-shell-note" }, "WSL 已能运行，但长期使用 root 风险较高。请创建普通 Linux 用户、加入 sudo 组并设为默认登录用户。") : null,
          error || state?.lastError ? h("div", { className: "lbs-shell-note lbs-shell-error" }, error || state.lastError) : null,
          h("div", { className: "lbs-shell-note" }, "性能模式在 Windows 上优先使用 WSL；WSL 不可用时依次降级到 Git Bash 和 PowerShell。需要管理员权限的安装或修复操作始终由你确认。"),
          repairPrompt ? h(
            "section",
            { className: "lbs-shell-repair" },
            h("div", { className: "lbs-shell-title" }, "可编辑的修复提示词"),
            h("textarea", { value: repairPrompt, onChange: (event) => setRepairPrompt(event.target.value), "aria-label": "WSL 修复提示词" }),
            h(
              "div",
              { className: "lbs-shell-actions" },
              h("button", { type: "button", className: "lbs-shell-button", disabled: busy || !repairPrompt.trim(), onClick: sendRepair }, "发送到新的标准模式对话"),
              h("button", { type: "button", className: "lbs-shell-button secondary", disabled: busy, onClick: () => setRepairPrompt("") }, "取消")
            )
          ) : null
        );
      }
      const inject = ["slots", "sessions"];
      function apply(ctx) {
        module.ctx = ctx;
        ctx.slots.inject("settings.section", () => ctx.slots.register({
          name: "settings.section",
          id: "laobos-shell",
          order: 18,
          label: () => "Shell 与 WSL"
        }, ShellSettingsSection));
      }
      exports.apply = apply;
      exports.inject = inject;
      return module.exports;
    }
  });
})();
