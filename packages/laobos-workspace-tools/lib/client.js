/* eslint-disable @next/next/no-assign-module-variable -- generated DSH module factory */
(() => {
  // packages/laobos-workspace-tools/src/client.jsx
  window.__ModuleLoader__.load({
    id: "@laobos/dsh-workspace-tools",
    factory: (require2) => {
      var module = { exports: {} };
      var exports = module.exports;
      Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
      const React = require2("react");
      const { useCallback, useEffect, useMemo, useState } = React;
      const css = `
      .lbs-workbench{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483030}.lbs-workbench-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:8px;height:56px;padding:0 18px}.lbs-workbench-header strong{font-size:15px}.lbs-workbench-close{margin-left:auto}.lbs-workbench-body{display:flex;flex:1;min-height:0}.lbs-files-list{border-right:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;display:flex;flex-direction:column;min-width:250px;width:34%}.lbs-files-toolbar,.lbs-git-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:6px;min-height:43px;padding:0 10px}.lbs-files-path{color:var(--dsw-alias-label-secondary);flex:1;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-rows{flex:1;overflow:auto;padding:5px}.lbs-file-row{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:flex;font:inherit;font-size:12px;gap:7px;height:29px;padding:0 8px;text-align:left;width:100%}.lbs-file-row:hover,.lbs-file-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-size{color:var(--dsw-alias-label-tertiary);font-size:10px}.lbs-preview{box-sizing:border-box;flex:1;min-width:0;overflow:auto;padding:16px}.lbs-preview-empty{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;height:100%;justify-content:center;text-align:center}.lbs-preview-title{align-items:center;display:flex;gap:8px;margin-bottom:12px}.lbs-preview-title strong{font-size:14px}.lbs-preview-title .lbs-wb-button{margin-left:auto}.lbs-preview pre,.lbs-git-diff{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;box-sizing:border-box;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;overflow:auto;padding:12px;tab-size:2;white-space:pre}.lbs-preview img,.lbs-preview video{display:block;height:auto;margin:auto;max-height:calc(100vh - 130px);max-width:100%}.lbs-preview iframe{border:1px solid var(--dsw-alias-border-l1);height:calc(100vh - 115px);width:100%}.lbs-preview audio{margin:40px auto;max-width:620px;width:100%}
      .lbs-wb-button{appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;font:inherit;font-size:11px;min-height:31px;padding:0 9px}.lbs-wb-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-wb-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-wb-button.danger{color:#d94b4b}.lbs-wb-button:disabled{cursor:not-allowed;opacity:.38}.lbs-wb-error{background:rgba(218,70,70,.1);border-radius:8px;color:#d94b4b;font-size:11px;line-height:1.5;margin:8px;padding:9px}.lbs-wb-ok{background:rgba(52,163,105,.1);border-radius:8px;color:#38a76f;font-size:11px;margin:8px;padding:9px}
      .lbs-git-layout{display:grid;flex:1;grid-template-columns:minmax(310px,37%) minmax(0,1fr);min-height:0}.lbs-git-sidebar{border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0}.lbs-git-toolbar{flex-wrap:wrap}.lbs-git-toolbar select,.lbs-git-commit-box textarea{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:inherit;font:inherit}.lbs-git-toolbar select{font-size:11px;height:29px;max-width:150px;padding:0 7px}.lbs-git-toolbar-spacer{flex:1}.lbs-git-scroll{flex:1;min-height:0;overflow:auto;padding:7px 9px}.lbs-git-section{margin-bottom:15px}.lbs-git-section-head{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:10px;font-weight:600;height:27px;letter-spacing:.03em;padding:0 5px;text-transform:uppercase}.lbs-git-section-head span{margin-left:auto}.lbs-git-change,.lbs-git-history{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:grid;font:inherit;text-align:left;width:100%}.lbs-git-change{grid-template-columns:28px minmax(0,1fr) auto;min-height:34px;padding:4px 5px}.lbs-git-change:hover,.lbs-git-change[data-active=true],.lbs-git-history:hover,.lbs-git-history[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-git-code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-git-change-name,.lbs-git-history strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-change-sub,.lbs-git-history small{color:var(--dsw-alias-label-tertiary);display:block;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-row-action{appearance:none;background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:9px;height:25px;opacity:.2;padding:0 6px}.lbs-git-change:hover .lbs-git-row-action,.lbs-git-row-action:focus-visible{opacity:1}.lbs-git-history{display:block;padding:6px}.lbs-git-commit-box{border-top:1px solid var(--dsw-alias-border-l1);display:grid;gap:7px;padding:9px}.lbs-git-commit-box textarea{box-sizing:border-box;font-size:11px;line-height:1.45;min-height:58px;padding:7px;resize:vertical;width:100%}.lbs-git-commit-actions{align-items:center;display:flex;gap:6px}.lbs-git-commit-actions span{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-right:auto}.lbs-git-main{display:flex;flex-direction:column;min-width:0}.lbs-git-diff-head{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:8px;min-height:43px;padding:0 13px}.lbs-git-diff-head strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-diff-head span{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-git-diff{border:0;border-radius:0;flex:1;min-height:0}.lbs-git-onboarding{align-content:center;display:grid;gap:12px;height:100%;justify-items:center;padding:30px;text-align:center}.lbs-git-onboarding strong{font-size:16px}.lbs-git-onboarding p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:0;max-width:480px}.lbs-git-badge{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-secondary);font-size:9px;padding:2px 5px}.lbs-git-loading{opacity:.58;pointer-events:none}
      @media(max-width:850px){.lbs-workbench{left:0;right:0}.lbs-workbench-body,.lbs-git-layout{display:flex;flex-direction:column}.lbs-files-list,.lbs-git-sidebar{border-bottom:1px solid var(--dsw-alias-border-l1);border-right:0;max-height:46vh;width:100%}.lbs-git-main{min-height:42vh}}
    `;
      if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-workspace-tools"]')) {
        const style = document.createElement("style");
        style.dataset.pluginCss = "@laobos/dsh-workspace-tools";
        style.textContent = css;
        document.head.append(style);
      }
      const bridge = () => window.laobosDesktop;
      const messageOf = (reason) => {
        const text = reason instanceof Error ? reason.message : String(reason);
        return text.replace(/^Error invoking remote method '[^']+': Error:\s*/u, "");
      };
      const formatSize = (value) => value < 1024 ? `${value} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
      const parentPath = (value) => {
        const parts = String(value || ".").split("/").filter((part) => part && part !== ".");
        parts.pop();
        return parts.join("/") || ".";
      };
      function useDesktopContext() {
        const [context, setContext] = useState(null);
        const [error, setError] = useState("");
        const refresh = useCallback(async () => {
          try {
            setContext(await bridge().workspace.context());
            setError("");
          } catch (reason) {
            setError(messageOf(reason));
          }
        }, []);
        useEffect(() => {
          if (bridge()?.capabilities?.workspaceFiles) void refresh();
        }, [refresh]);
        return { context, error };
      }
      function Preview({ selected, value, onReveal }) {
        const source = useMemo(() => {
          if (!value?.base64) return "";
          const binary = atob(value.base64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
          return URL.createObjectURL(new Blob([bytes], { type: value.mediaType }));
        }, [value]);
        useEffect(() => () => {
          if (source) URL.revokeObjectURL(source);
        }, [source]);
        if (!selected) return /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "选择文件以预览");
        return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-title" }, /* @__PURE__ */ React.createElement("strong", null, selected), value ? /* @__PURE__ */ React.createElement("span", { className: "lbs-file-size" }, formatSize(value.size)) : null, /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: onReveal }, "在系统中显示")), !value ? /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "正在读取…") : value.kind === "text" ? /* @__PURE__ */ React.createElement("pre", null, value.content) : value.kind === "image" ? /* @__PURE__ */ React.createElement("img", { src: source, alt: selected }) : value.kind === "pdf" ? /* @__PURE__ */ React.createElement("iframe", { src: source, title: selected }) : value.kind === "media" && value.mediaType.startsWith("audio/") ? /* @__PURE__ */ React.createElement("audio", { src: source, controls: true }) : value.kind === "media" ? /* @__PURE__ */ React.createElement("video", { src: source, controls: true }) : /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "该二进制文件暂不支持内嵌预览。"));
      }
      function FilesPage({ requestedRoot }) {
        const desktop = useDesktopContext();
        const root = requestedRoot || desktop.context?.root;
        const [current, setCurrent] = useState(".");
        const [listing, setListing] = useState(null);
        const [selected, setSelected] = useState("");
        const [preview, setPreview] = useState(null);
        const [error, setError] = useState("");
        const load = useCallback(async (next) => {
          if (!root) return;
          try {
            setListing(await bridge().workspace.list({ root, path: next }));
            setCurrent(next);
            setError("");
          } catch (reason) {
            setError(messageOf(reason));
          }
        }, [root]);
        useEffect(() => {
          setCurrent(".");
          setSelected("");
          setPreview(null);
          if (root) void load(".");
        }, [root, load]);
        const choose = async (entry) => {
          if (entry.type === "directory") {
            setSelected("");
            setPreview(null);
            await load(entry.path);
            return;
          }
          setSelected(entry.path);
          setPreview(null);
          setError("");
          try {
            setPreview(await bridge().workspace.read({ root, path: entry.path }));
          } catch (reason) {
            setError(messageOf(reason));
          }
        };
        if (!bridge()?.capabilities?.workspaceFiles) return /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "文件工作台仅在桌面版中可用。");
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-workbench-body" }, /* @__PURE__ */ React.createElement("section", { className: "lbs-files-list" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-files-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", disabled: current === ".", onClick: () => load(parentPath(current)) }, "←"), /* @__PURE__ */ React.createElement("span", { className: "lbs-files-path", title: `${root || ""}/${current}` }, current), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: () => load(current) }, "刷新")), error || desktop.error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-wb-error" }, error || desktop.error) : null, /* @__PURE__ */ React.createElement("div", { className: "lbs-file-rows" }, listing?.entries?.map((entry) => /* @__PURE__ */ React.createElement("button", { className: "lbs-file-row", key: entry.path, "data-active": selected === entry.path, onClick: () => choose(entry) }, /* @__PURE__ */ React.createElement("span", null, entry.type === "directory" ? "▸" : "·"), /* @__PURE__ */ React.createElement("span", { className: "lbs-file-name" }, entry.name), entry.type === "file" ? /* @__PURE__ */ React.createElement("span", { className: "lbs-file-size" }, formatSize(entry.size)) : null)))), /* @__PURE__ */ React.createElement("section", { className: "lbs-preview" }, /* @__PURE__ */ React.createElement(Preview, { selected, value: preview, onReveal: () => bridge().workspace.reveal({ root, path: selected }) })));
      }
      function GitChange({ change, side, active, busy, onSelect, onAction, actionLabel }) {
        const code = side === "staged" ? change.index : change.worktree;
        return /* @__PURE__ */ React.createElement("div", { className: "lbs-git-change", "data-active": active, onClick: onSelect, role: "button", tabIndex: 0 }, /* @__PURE__ */ React.createElement("span", { className: "lbs-git-code" }, code === "?" ? "U" : code), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { className: "lbs-git-change-name" }, change.path), change.originalPath ? /* @__PURE__ */ React.createElement("span", { className: "lbs-git-change-sub" }, "来自 ", change.originalPath) : null), /* @__PURE__ */ React.createElement("button", { className: "lbs-git-row-action", disabled: busy, onClick: (event) => {
          event.stopPropagation();
          onAction();
        } }, actionLabel));
      }
      function GitPage({ requestedRoot }) {
        const desktop = useDesktopContext();
        const root = requestedRoot || desktop.context?.root;
        const [state, setState] = useState(null);
        const [selection, setSelection] = useState(null);
        const [diff, setDiff] = useState("");
        const [message, setMessage] = useState("");
        const [error, setError] = useState("");
        const [notice, setNotice] = useState("");
        const [busy, setBusy] = useState(false);
        const showChange = useCallback(async (change, side) => {
          setSelection({ kind: "change", path: change.path, side });
          setError("");
          try {
            const result = await bridge().git.diff({ root, path: change.path, side });
            setDiff(result.diff || "该文件没有可显示的文本差异。");
          } catch (reason) {
            setError(messageOf(reason));
          }
        }, [root]);
        const showCommit = useCallback(async (commit2) => {
          setSelection({ kind: "commit", ref: commit2.hash });
          setError("");
          try {
            const result = await bridge().git.diff({ root, side: "commit", ref: commit2.hash });
            setDiff(result.diff || "该提交没有文本差异。");
          } catch (reason) {
            setError(messageOf(reason));
          }
        }, [root]);
        const chooseDefault = useCallback((next) => {
          const staged2 = next.changes.find((change) => change.staged);
          const unstaged2 = next.changes.find((change) => change.unstaged);
          if (staged2) void showChange(staged2, "staged");
          else if (unstaged2) void showChange(unstaged2, unstaged2.untracked ? "untracked" : "unstaged");
          else if (next.commits[0]) void showCommit(next.commits[0]);
          else {
            setSelection(null);
            setDiff("");
          }
        }, [showChange, showCommit]);
        const refresh = useCallback(async () => {
          if (!root) return;
          setBusy(true);
          setError("");
          try {
            const next = await bridge().git.inspect({ root });
            setState(next);
            chooseDefault(next);
          } catch (reason) {
            setError(messageOf(reason));
          } finally {
            setBusy(false);
          }
        }, [root, chooseDefault]);
        useEffect(() => {
          setState(null);
          setSelection(null);
          setDiff("");
          if (root) void refresh();
        }, [root, refresh]);
        const update = async (task, success) => {
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const next = await task();
            setState(next);
            setNotice(success);
            chooseDefault(next);
            return next;
          } catch (reason) {
            setError(messageOf(reason));
            return null;
          } finally {
            setBusy(false);
          }
        };
        const stage = (change) => update(() => bridge().git.stage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已暂存 ${change.path}`);
        const unstage = (change) => update(() => bridge().git.unstage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已取消暂存 ${change.path}`);
        const restore = (change) => {
          if (!window.confirm(`放弃“${change.path}”尚未暂存的修改？
此操作不能直接撤销。`)) return;
          void update(() => bridge().git.restore({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已恢复 ${change.path}`);
        };
        const commit = async () => {
          const value = message.trim();
          if (!value) return;
          const next = await update(() => bridge().git.commit({ root, message: value, expectedHead: state.head, expectedStatusToken: state.statusToken }), "本地版本已提交");
          if (next) setMessage("");
        };
        const createBranch = () => {
          const name = window.prompt("新分支名称", "dsh/");
          if (!name?.trim()) return;
          void update(() => bridge().git.branch({ root, action: "create", name: name.trim(), expectedHead: state.head }), `已创建并切换到 ${name.trim()}`);
        };
        const switchBranch = (name) => update(() => bridge().git.branch({ root, action: "switch", name, expectedHead: state.head }), `已切换到 ${name}`);
        const deleteBranch = () => {
          const name = window.prompt("要删除的已合并本地分支名称");
          if (!name?.trim() || !window.confirm(`删除本地分支“${name.trim()}”？
未合并分支会被 Git 拒绝。`)) return;
          void update(() => bridge().git.branch({ root, action: "delete", name: name.trim(), expectedHead: state.head }), `已删除分支 ${name.trim()}`);
        };
        const sync = (action) => {
          const labels = { fetch: "获取远端更新", pull: "快进拉取远端更新", push: "推送当前分支到远端" };
          if (action !== "fetch" && !window.confirm(`${labels[action]}？
不会执行强制推送或自动合并。`)) return;
          void update(() => bridge().git.sync({ root, action, remote: state.remotes[0], expectedHead: state.head }), `${labels[action]}完成`);
        };
        if (!bridge()?.capabilities?.gitReview) return /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "版本中心仅在桌面版中可用。");
        if (!state && !error) return /* @__PURE__ */ React.createElement("div", { className: "lbs-preview-empty" }, "正在检查 Git 状态…");
        if (state && !state.isRepository) return /* @__PURE__ */ React.createElement("div", { className: "lbs-git-onboarding" }, /* @__PURE__ */ React.createElement("strong", null, "这个项目还没有版本记录"), /* @__PURE__ */ React.createElement("p", null, "启用后，劳博士可以为项目创建本地提交和任务分支；远端发布仍由你确认。"), /* @__PURE__ */ React.createElement("code", null, state.root), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button primary", disabled: busy, onClick: () => window.confirm(`在以下目录启用 Git 版本管理？
${state.root}`) && update(() => bridge().git.init({ root, branch: "main" }), "Git 版本管理已启用") }, "启用版本管理"), error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-wb-error" }, error) : null);
        if (!state) return /* @__PURE__ */ React.createElement("div", { className: "lbs-git-onboarding" }, /* @__PURE__ */ React.createElement("strong", null, "无法读取版本状态"), /* @__PURE__ */ React.createElement("div", { className: "lbs-wb-error" }, error || desktop.error), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: refresh }, "重试"));
        const staged = state.changes.filter((change) => change.staged);
        const unstaged = state.changes.filter((change) => change.unstaged);
        const selectedTitle = selection?.kind === "commit" ? `提交 ${selection.ref.slice(0, 8)}` : selection?.path || "版本差异";
        return /* @__PURE__ */ React.createElement("div", { className: `lbs-git-layout ${busy ? "lbs-git-loading" : ""}` }, /* @__PURE__ */ React.createElement("aside", { className: "lbs-git-sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-toolbar" }, /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: refresh }, "刷新"), /* @__PURE__ */ React.createElement("select", { value: state.branch, onChange: (event) => void switchBranch(event.target.value) }, state.branches.map((branch) => /* @__PURE__ */ React.createElement("option", { key: branch.name, value: branch.name }, branch.name))), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: createBranch }, "新分支"), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button danger", onClick: deleteBranch }, "删分支"), /* @__PURE__ */ React.createElement("span", { className: "lbs-git-toolbar-spacer" }), state.upstream ? /* @__PURE__ */ React.createElement("span", { className: "lbs-git-badge" }, "↑", state.ahead, " ↓", state.behind) : null), error || desktop.error ? /* @__PURE__ */ React.createElement("div", { className: "lbs-wb-error" }, error || desktop.error) : notice ? /* @__PURE__ */ React.createElement("div", { className: "lbs-wb-ok" }, notice) : null, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-scroll" }, /* @__PURE__ */ React.createElement("section", { className: "lbs-git-section" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-section-head" }, "已暂存 ", /* @__PURE__ */ React.createElement("span", null, staged.length)), staged.map((change) => /* @__PURE__ */ React.createElement(GitChange, { key: `s:${change.path}`, change, side: "staged", active: selection?.side === "staged" && selection.path === change.path, busy, onSelect: () => showChange(change, "staged"), onAction: () => unstage(change), actionLabel: "取消暂存" }))), /* @__PURE__ */ React.createElement("section", { className: "lbs-git-section" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-section-head" }, "工作区变更 ", /* @__PURE__ */ React.createElement("span", null, unstaged.length)), unstaged.map((change) => /* @__PURE__ */ React.createElement(GitChange, { key: `w:${change.path}`, change, side: change.untracked ? "untracked" : "unstaged", active: selection?.side !== "staged" && selection?.path === change.path, busy, onSelect: () => showChange(change, change.untracked ? "untracked" : "unstaged"), onAction: () => stage(change), actionLabel: "暂存" })), unstaged.filter((change) => !change.untracked).map((change) => /* @__PURE__ */ React.createElement("button", { key: `r:${change.path}`, className: "lbs-wb-button danger", onClick: () => restore(change) }, "放弃 ", change.path, " 的修改"))), /* @__PURE__ */ React.createElement("section", { className: "lbs-git-section" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-section-head" }, "提交历史 ", /* @__PURE__ */ React.createElement("span", null, state.commits.length)), state.commits.map((commit2) => /* @__PURE__ */ React.createElement("button", { className: "lbs-git-history", "data-active": selection?.ref === commit2.hash, key: commit2.hash, onClick: () => showCommit(commit2) }, /* @__PURE__ */ React.createElement("strong", null, commit2.subject), /* @__PURE__ */ React.createElement("small", null, commit2.shortHash, " · ", commit2.author, " · ", new Date(commit2.date).toLocaleString("zh-CN")))))), /* @__PURE__ */ React.createElement("div", { className: "lbs-git-commit-box" }, /* @__PURE__ */ React.createElement("textarea", { value: message, onChange: (event) => setMessage(event.target.value), placeholder: "描述这次本地版本…" }), /* @__PURE__ */ React.createElement("div", { className: "lbs-git-commit-actions" }, /* @__PURE__ */ React.createElement("span", null, staged.length, " 个已暂存文件"), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button primary", disabled: !message.trim() || staged.length === 0 || busy, onClick: commit }, "提交版本")))), /* @__PURE__ */ React.createElement("main", { className: "lbs-git-main" }, /* @__PURE__ */ React.createElement("div", { className: "lbs-git-diff-head" }, /* @__PURE__ */ React.createElement("strong", null, selectedTitle), /* @__PURE__ */ React.createElement("span", null, state.root), /* @__PURE__ */ React.createElement("span", { className: "lbs-git-toolbar-spacer" }), state.remotes.length ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: () => sync("fetch") }, "获取"), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button", onClick: () => sync("pull") }, "拉取"), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button primary", onClick: () => sync("push") }, "发布")) : /* @__PURE__ */ React.createElement("span", null, "未配置远端")), /* @__PURE__ */ React.createElement("pre", { className: "lbs-git-diff" }, diff || "选择一个变更或提交查看 Diff。")));
      }
      function WorkspaceWorkbench() {
        const [page, setPage] = useState("");
        const [root, setRoot] = useState("");
        useEffect(() => {
          const open = (event) => {
            const tool = event.detail?.tool;
            if (tool === "close") {
              setPage("");
              return;
            }
            if (!["files", "git"].includes(tool)) return;
            setRoot(event.detail?.cwd || "");
            setPage(tool);
          };
          window.addEventListener("laobos:open-desktop-tool", open);
          return () => window.removeEventListener("laobos:open-desktop-tool", open);
        }, []);
        const close = () => {
          const closing = page;
          setPage("");
          window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: closing } }));
        };
        if (!page) return null;
        const title = page === "files" ? "文件管理器" : "版本中心";
        return /* @__PURE__ */ React.createElement("section", { className: "lbs-workbench", role: "dialog", "aria-label": title }, /* @__PURE__ */ React.createElement("header", { className: "lbs-workbench-header" }, /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("button", { className: "lbs-wb-button lbs-workbench-close", onClick: close }, "关闭")), page === "files" ? /* @__PURE__ */ React.createElement(FilesPage, { requestedRoot: root }) : /* @__PURE__ */ React.createElement(GitPage, { requestedRoot: root }));
      }
      const inject = ["slots"];
      function apply(ctx) {
        ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-desktop-workbench", order: 35 }, WorkspaceWorkbench));
      }
      exports.apply = apply;
      exports.inject = inject;
      return module.exports;
    }
  });
})();
