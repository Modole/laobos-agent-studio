/* eslint-disable @next/next/no-assign-module-variable, @next/next/no-img-element -- DSH module factory and local previews */
import { codeLines, isCodePath, languageForPath, parseUnifiedDiff, tokenizeCodeLine } from "./code-renderer.mjs";
window.__ModuleLoader__.load({
  id: "@laobos/dsh-workspace-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useMemo, useState } = React;

    const css = `
      .lbs-workbench{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483030}.lbs-workbench-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:8px;height:56px;padding:0 18px}.lbs-workbench-header strong{font-size:15px}.lbs-workbench-close{margin-left:auto}.lbs-workbench-body{display:flex;flex:1;min-height:0}.lbs-files-list{border-right:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;display:flex;flex-direction:column;min-width:250px;width:34%}.lbs-files-toolbar,.lbs-git-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:6px;min-height:43px;padding:0 10px}.lbs-files-path{color:var(--dsw-alias-label-secondary);flex:1;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-rows{flex:1;overflow:auto;padding:5px}.lbs-file-row{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:flex;font:inherit;font-size:12px;gap:7px;height:29px;padding:0 8px;text-align:left;width:100%}.lbs-file-row:hover,.lbs-file-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-size{color:var(--dsw-alias-label-tertiary);font-size:10px}.lbs-preview{box-sizing:border-box;flex:1;min-width:0;overflow:auto;padding:16px}.lbs-preview-empty{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;height:100%;justify-content:center;text-align:center}.lbs-preview-title{align-items:center;display:flex;gap:8px;margin-bottom:12px}.lbs-preview-title strong{font-size:14px}.lbs-preview-actions{align-items:center;display:flex;gap:5px;margin-left:auto}.lbs-preview pre,.lbs-git-diff{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;box-sizing:border-box;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;overflow:auto;padding:12px;tab-size:2;white-space:pre}.lbs-preview img,.lbs-preview video{display:block;height:auto;margin:auto;max-height:calc(100vh - 130px);max-width:100%}.lbs-preview iframe{border:1px solid var(--dsw-alias-border-l1);height:calc(100vh - 115px);width:100%}.lbs-preview audio{margin:40px auto;max-width:620px;width:100%}.lbs-preview-editor{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font:12px/1.58 ui-monospace,SFMono-Regular,Menlo,monospace;height:calc(100vh - 145px);min-height:280px;outline:none;padding:12px;resize:none;tab-size:2;width:100%}.lbs-preview-editor:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
      .lbs-wb-button{appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;font:inherit;font-size:11px;min-height:31px;padding:0 9px}.lbs-wb-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-wb-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-wb-button.danger{color:#d94b4b}.lbs-wb-button:disabled{cursor:not-allowed;opacity:.38}.lbs-wb-error{background:rgba(218,70,70,.1);border-radius:8px;color:#d94b4b;font-size:11px;line-height:1.5;margin:8px;padding:9px}.lbs-wb-ok{background:rgba(52,163,105,.1);border-radius:8px;color:#38a76f;font-size:11px;margin:8px;padding:9px}
      .lbs-git-layout{display:grid;flex:1;grid-template-columns:minmax(310px,37%) minmax(0,1fr);min-height:0}.lbs-git-sidebar{border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0}.lbs-git-toolbar{flex-wrap:wrap}.lbs-git-toolbar select,.lbs-git-commit-box textarea{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:inherit;font:inherit}.lbs-git-toolbar select{font-size:11px;height:29px;max-width:150px;padding:0 7px}.lbs-git-toolbar-spacer{flex:1}.lbs-git-scroll{flex:1;min-height:0;overflow:auto;padding:7px 9px}.lbs-git-section{margin-bottom:15px}.lbs-git-section-head{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:10px;font-weight:600;height:27px;letter-spacing:.03em;padding:0 5px;text-transform:uppercase}.lbs-git-section-head span{margin-left:auto}.lbs-git-change,.lbs-git-history{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:grid;font:inherit;text-align:left;width:100%}.lbs-git-change{grid-template-columns:28px minmax(0,1fr) auto;min-height:34px;padding:4px 5px}.lbs-git-change:hover,.lbs-git-change[data-active=true],.lbs-git-history:hover,.lbs-git-history[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-git-code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-git-change-name,.lbs-git-history strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-change-sub,.lbs-git-history small{color:var(--dsw-alias-label-tertiary);display:block;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-row-action{appearance:none;background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:9px;height:25px;opacity:.2;padding:0 6px}.lbs-git-change:hover .lbs-git-row-action,.lbs-git-row-action:focus-visible{opacity:1}.lbs-git-history{display:block;padding:6px}.lbs-git-commit-box{border-top:1px solid var(--dsw-alias-border-l1);display:grid;gap:7px;padding:9px}.lbs-git-commit-box textarea{box-sizing:border-box;font-size:11px;line-height:1.45;min-height:58px;padding:7px;resize:vertical;width:100%}.lbs-git-commit-actions{align-items:center;display:flex;gap:6px}.lbs-git-commit-actions span{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-right:auto}.lbs-git-main{display:flex;flex-direction:column;min-width:0}.lbs-git-diff-head{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:8px;min-height:43px;padding:0 13px}.lbs-git-diff-head strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-diff-head span{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-git-diff{border:0;border-radius:0;flex:1;min-height:0}.lbs-git-onboarding{align-content:center;display:grid;gap:12px;height:100%;justify-items:center;padding:30px;text-align:center}.lbs-git-onboarding strong{font-size:16px}.lbs-git-onboarding p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:0;max-width:480px}.lbs-git-badge{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-secondary);font-size:9px;padding:2px 5px}.lbs-git-loading{opacity:.58;pointer-events:none}
      .lbs-files-list{min-width:280px;width:32%}.lbs-files-toolbar{min-height:46px}.lbs-file-tree{flex:1;overflow:auto;padding:6px 5px 14px}.lbs-file-root-row,.lbs-tree-row{align-items:center;border-radius:6px;box-sizing:border-box;display:flex;min-width:max-content;width:100%}.lbs-file-root-row{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;height:31px;padding:0 8px}.lbs-tree-row{height:29px;padding-right:7px}.lbs-tree-row:hover,.lbs-tree-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-tree-toggle,.lbs-tree-file{align-items:center;appearance:none;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;font:inherit;height:100%;min-width:0;padding:0;text-align:left}.lbs-tree-toggle{flex:1}.lbs-tree-chevron{color:var(--dsw-alias-label-tertiary);display:inline-flex;flex:none;font-size:10px;justify-content:center;width:18px}.lbs-tree-icon{align-items:center;color:var(--dsw-alias-label-secondary);display:inline-flex;flex:none;font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;height:18px;justify-content:center;margin-right:5px;width:18px}.lbs-tree-row[data-type=directory] .lbs-tree-icon{color:#d6a84b;font-size:15px}.lbs-tree-row[data-code=true] .lbs-tree-icon{color:#6f8cff}.lbs-tree-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-tree-file{flex:1}.lbs-tree-size{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-left:10px}.lbs-tree-loading{animation:lbs-tree-spin .8s linear infinite;display:inline-block}@keyframes lbs-tree-spin{to{transform:rotate(360deg)}}
      .lbs-file-menu{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-shadow:var(--dsw-shadow-lv3);display:grid;min-width:190px;padding:5px;position:fixed;z-index:2147483200}.lbs-file-menu button{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:11px;height:30px;padding:0 9px;text-align:left}.lbs-file-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-menu button.danger{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-file-menu-separator{border-top:1px solid var(--dsw-alias-border-l1);margin:4px 3px}
      .lbs-workbench{--lbs-code-keyword:#cf222e;--lbs-code-string:#0a3069;--lbs-code-number:#0550ae;--lbs-code-comment:#6e7781;--lbs-code-type:#953800;--lbs-code-function:#8250df;--lbs-diff-add:#1a7f37;--lbs-diff-delete:#cf222e;--lbs-diff-hunk:#0969da;--lbs-diff-file:#8250df;--lbs-diff-insert-bg:rgba(46,160,67,.1);--lbs-diff-insert-gutter:rgba(46,160,67,.16);--lbs-diff-delete-bg:rgba(248,81,73,.1);--lbs-diff-delete-gutter:rgba(248,81,73,.16);--lbs-diff-hunk-bg:rgba(9,105,218,.08)}body[data-ds-dark-theme] .lbs-workbench{--lbs-code-keyword:#ff7b72;--lbs-code-string:#a5d6ff;--lbs-code-number:#79c0ff;--lbs-code-comment:#8b949e;--lbs-code-type:#ffa657;--lbs-code-function:#d2a8ff;--lbs-diff-add:#56d364;--lbs-diff-delete:#ff7b72;--lbs-diff-hunk:#79c0ff;--lbs-diff-file:#d2a8ff;--lbs-diff-insert-bg:rgba(46,160,67,.17);--lbs-diff-insert-gutter:rgba(46,160,67,.24);--lbs-diff-delete-bg:rgba(248,81,73,.16);--lbs-diff-delete-gutter:rgba(248,81,73,.23);--lbs-diff-hunk-bg:rgba(56,139,253,.13)}
      .lbs-code-viewer{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:9px;color:var(--dsw-alias-label-primary);min-width:max-content;overflow:auto}.lbs-code-language{align-items:center;background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);display:flex;font:10px/28px ui-monospace,SFMono-Regular,Menlo,monospace;height:28px;justify-content:space-between;padding:0 10px;position:sticky;left:0}.lbs-code-row{display:grid;font:12px/1.58 ui-monospace,SFMono-Regular,Menlo,monospace;grid-template-columns:52px minmax(max-content,1fr);min-height:19px}.lbs-code-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-code-line-number{border-right:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));padding:0 10px;text-align:right;user-select:none}.lbs-code-line{padding:0 12px;white-space:pre}.lbs-code-truncated{background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-tertiary);font-size:11px;padding:8px 12px;position:sticky;left:0}.lbs-token-keyword{color:var(--lbs-code-keyword)}.lbs-token-string{color:var(--lbs-code-string)}.lbs-token-number{color:var(--lbs-code-number)}.lbs-token-comment{color:var(--lbs-code-comment);font-style:italic}.lbs-token-type{color:var(--lbs-code-type)}.lbs-token-function{color:var(--lbs-code-function)}
      .lbs-diff-viewer{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);display:flex;flex:1;flex-direction:column;min-height:0}.lbs-diff-summary{align-items:center;background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex:none;gap:10px;height:34px;padding:0 10px}.lbs-diff-summary span{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-diff-additions{color:var(--lbs-diff-add)}.lbs-diff-deletions{color:var(--lbs-diff-delete)}.lbs-diff-summary button{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:10px;line-height:23px;margin-left:auto;padding:0 8px}.lbs-diff-summary button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-diff-scroll{flex:1;min-height:0;overflow:auto}.lbs-diff-table{border-collapse:collapse;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;min-width:100%;table-layout:auto}.lbs-diff-row td{height:20px;padding:0}.lbs-diff-gutter{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border-right:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));min-width:43px;padding:0 8px!important;text-align:right;user-select:none;width:43px}.lbs-diff-prefix{color:var(--dsw-alias-label-tertiary);text-align:center;user-select:none;width:24px}.lbs-diff-code{padding-right:14px!important;white-space:pre}.lbs-diff-viewer[data-wrap=true] .lbs-diff-code{overflow-wrap:anywhere;white-space:pre-wrap}.lbs-diff-row[data-type=insert]{background:var(--lbs-diff-insert-bg)}.lbs-diff-row[data-type=insert] .lbs-diff-gutter{background:var(--lbs-diff-insert-gutter);color:var(--lbs-diff-add)}.lbs-diff-row[data-type=insert] .lbs-diff-prefix{color:var(--lbs-diff-add)}.lbs-diff-row[data-type=delete]{background:var(--lbs-diff-delete-bg)}.lbs-diff-row[data-type=delete] .lbs-diff-gutter{background:var(--lbs-diff-delete-gutter);color:var(--lbs-diff-delete)}.lbs-diff-row[data-type=delete] .lbs-diff-prefix{color:var(--lbs-diff-delete)}.lbs-diff-row[data-type=hunk]{background:var(--lbs-diff-hunk-bg);color:var(--lbs-diff-hunk)}.lbs-diff-row[data-type=file]{background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));color:var(--lbs-diff-file);font-weight:600}.lbs-diff-row[data-type=meta],.lbs-diff-row[data-type=notice]{color:var(--dsw-alias-label-tertiary)}.lbs-diff-row[data-type=hunk] .lbs-diff-code,.lbs-diff-row[data-type=file] .lbs-diff-code,.lbs-diff-row[data-type=meta] .lbs-diff-code,.lbs-diff-row[data-type=notice] .lbs-diff-code{padding:2px 12px!important}.lbs-diff-row:hover{box-shadow:inset 0 0 0 9999px color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent)}
      .lbs-git-change[data-status=A] .lbs-git-code,.lbs-git-change[data-status=U] .lbs-git-code{color:#2a9b67}.lbs-git-change[data-status=M] .lbs-git-code{color:#6f8cff}.lbs-git-change[data-status=D] .lbs-git-code{color:#d94b4b}.lbs-git-change[data-status=R] .lbs-git-code{color:#a675d1}
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
    const absolutePathPattern = /^(?:\/|[a-zA-Z]:[\\/]|\\\\)/u;
    const pathSeparator = (root) => String(root || "").includes("\\") ? "\\" : "/";
    const absoluteWorkspacePath = (root, target) => {
      const value = String(target || ".");
      if (!root || absolutePathPattern.test(value)) return value;
      if (value === ".") return root;
      const separator = pathSeparator(root);
      return `${String(root).replace(/[\\/]+$/u, "")}${separator}${value.replace(/^[.][\\/]/u, "")}`;
    };
    const relativeWorkspacePath = (root, target) => {
      const value = String(target || ".");
      if (!root) return value;
      if (!absolutePathPattern.test(value)) return value.replace(/^[.][\\/]/u, "") || ".";
      const windows = pathSeparator(root) === "\\";
      const normalizedRoot = String(root || "").replaceAll("\\", "/").replace(/\/+$/u, "");
      const normalizedTarget = value.replaceAll("\\", "/");
      const comparableRoot = windows ? normalizedRoot.toLowerCase() : normalizedRoot;
      const comparableTarget = windows ? normalizedTarget.toLowerCase() : normalizedTarget;
      if (comparableTarget === comparableRoot) return ".";
      if (comparableTarget.startsWith(`${comparableRoot}/`)) return normalizedTarget.slice(normalizedRoot.length + 1).replaceAll("/", pathSeparator(root));
      return value;
    };
    const parentWorkspacePath = (value) => {
      const parts = String(value || ".").split(/[\\/]/u).filter(Boolean);
      return parts.length <= 1 ? "." : parts.slice(0, -1).join(String(value).includes("\\") ? "\\" : "/");
    };

    async function openProducedFile(path) {
      const sessions = module.ctx?.sessions?.list?.getSnapshot?.();
      const cwd = sessions?.current ? sessions.byId?.[sessions.current]?.cwd : undefined;
      const target = absoluteWorkspacePath(cwd, path);
      try {
        if (!module.ctx?.workspaces?.openPath) throw new Error("系统文件打开器不可用");
        await module.ctx.workspaces.openPath(target);
      } catch {
        window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", {
          detail: { tool: "files", cwd, path, source: "file-open-fallback" },
        }));
      }
    }

    function useDesktopContext() {
      const [context, setContext] = useState(null);
      const [error, setError] = useState("");
      const refresh = useCallback(async () => {
        try { setContext(await bridge().workspace.context()); setError(""); }
        catch (reason) { setError(messageOf(reason)); }
      }, []);
      useEffect(() => { if (bridge()?.capabilities?.workspaceFiles) void refresh(); }, [refresh]);
      return { context, error };
    }

    function CodeTokens({ value, language }) {
      return tokenizeCodeLine(value, language).map((token, index) => <span className={`lbs-token-${token.type}`} key={`${index}:${token.value}`}>{token.value}</span>);
    }

    function CodeViewer({ value, path }) {
      const language = languageForPath(path);
      const lines = useMemo(() => codeLines(value), [value]);
      const visibleLines = lines.slice(0, 6_000);
      return <div className="lbs-code-viewer" aria-label={`${path} 代码预览`}>
        <div className="lbs-code-language"><span>{language}</span><span>{lines.length} 行</span></div>
        {visibleLines.map((line, index) => <div className="lbs-code-row" key={index}>
          <span className="lbs-code-line-number">{index + 1}</span>
          <code className="lbs-code-line"><CodeTokens value={line} language={language} /></code>
        </div>)}
        {lines.length > visibleLines.length ? <div className="lbs-code-truncated">文件较大，仅渲染前 {visibleLines.length} 行；可在系统编辑器中查看完整内容。</div> : null}
      </div>;
    }

    function DiffViewer({ value, path }) {
      const [wrap, setWrap] = useState(false);
      const model = useMemo(() => parseUnifiedDiff(value, path), [value, path]);
      const visibleLines = model.lines.slice(0, 12_000);
      return <div className="lbs-diff-viewer" data-wrap={wrap}>
        <div className="lbs-diff-summary">
          <span className="lbs-diff-additions">+{model.additions} 添加</span>
          <span className="lbs-diff-deletions">−{model.deletions} 删除</span>
          <span>{model.lines.length} 行</span>
          <button type="button" onClick={() => setWrap((value) => !value)}>{wrap ? "不换行" : "自动换行"}</button>
        </div>
        <div className="lbs-diff-scroll">
          <table className="lbs-diff-table" aria-label="Git 变更内容"><tbody>
            {visibleLines.map((line) => {
              const codeLine = ["insert", "delete", "normal"].includes(line.type);
              const language = languageForPath(line.path || path);
              return <tr className="lbs-diff-row" data-type={line.type} key={line.key}>
                <td className="lbs-diff-gutter">{line.oldLine ?? ""}</td>
                <td className="lbs-diff-gutter">{line.newLine ?? ""}</td>
                {codeLine ? <><td className="lbs-diff-prefix">{line.prefix}</td><td className="lbs-diff-code"><code><CodeTokens value={line.content} language={language} /></code></td></>
                  : <td className="lbs-diff-code" colSpan={2}>{line.content}</td>}
              </tr>;
            })}
          </tbody></table>
          {model.lines.length > visibleLines.length ? <div className="lbs-code-truncated">Diff 较大，仅渲染前 {visibleLines.length} 行。</div> : null}
        </div>
      </div>;
    }

    function fileGlyph(entry) {
      if (entry.type === "directory") return "▰";
      if (isCodePath(entry.path)) return "{}";
      const extension = entry.name.split(".").at(-1)?.toLowerCase();
      if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "▧";
      return "·";
    }

    function FileTreeNode({ entry, depth, childrenByPath, expanded, loadingPaths, selected, onToggle, onSelect, onContextMenu }) {
      const isDirectory = entry.type === "directory";
      const isExpanded = isDirectory && expanded.has(entry.path);
      const children = childrenByPath[entry.path] || [];
      return <div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined} aria-selected={!isDirectory && selected === entry.path}>
        <div className="lbs-tree-row" data-active={selected === entry.path} data-code={!isDirectory && isCodePath(entry.path)} data-type={entry.type} onContextMenu={(event) => onContextMenu(event, entry)} style={{ paddingLeft: 8 + depth * 16 }}>
          {isDirectory ? <button type="button" className="lbs-tree-toggle" onClick={() => onToggle(entry)} title={entry.path}>
            <span className="lbs-tree-chevron">{loadingPaths.has(entry.path) ? <span className="lbs-tree-loading">◌</span> : isExpanded ? "▾" : "▸"}</span>
            <span className="lbs-tree-icon">{fileGlyph(entry)}</span><span className="lbs-tree-name">{entry.name}</span>
          </button> : <button type="button" className="lbs-tree-file" onClick={() => onSelect(entry)} title={entry.path}>
            <span className="lbs-tree-chevron" /><span className="lbs-tree-icon">{fileGlyph(entry)}</span><span className="lbs-tree-name">{entry.name}</span>
          </button>}
          {!isDirectory ? <span className="lbs-tree-size">{formatSize(entry.size)}</span> : null}
        </div>
        {isExpanded ? <div role="group">{children.map((child) => <FileTreeNode key={child.path} entry={child} depth={depth + 1} childrenByPath={childrenByPath} expanded={expanded} loadingPaths={loadingPaths} selected={selected} onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu} />)}</div> : null}
      </div>;
    }

    function Preview({ selected, value, editing, draft, saving, onBeginEdit, onDraftChange, onSave, onCancelEdit, onReveal }) {
      const source = useMemo(() => {
        if (!value?.base64) return "";
        const binary = atob(value.base64); const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return URL.createObjectURL(new Blob([bytes], { type: value.mediaType }));
      }, [value]);
      useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
      if (!selected) return <div className="lbs-preview-empty">选择文件以预览</div>;
      return <div>
        <div className="lbs-preview-title"><strong>{selected}</strong>{value ? <span className="lbs-file-size">{formatSize(value.size)}</span> : null}<div className="lbs-preview-actions">
          {value?.kind === "text" ? editing ? <><button className="lbs-wb-button" disabled={saving} onClick={onCancelEdit}>取消</button><button className="lbs-wb-button primary" disabled={saving} onClick={onSave}>{saving ? "正在保存…" : "保存"}</button></> : <button className="lbs-wb-button" onClick={onBeginEdit}>编辑</button> : null}
          <button className="lbs-wb-button" onClick={onReveal}>打开所在位置</button>
        </div></div>
        {!value ? <div className="lbs-preview-empty">正在读取…</div>
          : value.kind === "text" && editing ? <textarea className="lbs-preview-editor" aria-label={`${selected} 文本编辑器`} autoFocus spellCheck={false} value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); onSave(); } }} />
          : value.kind === "text" && isCodePath(selected) ? <CodeViewer value={value.content} path={selected} />
          : value.kind === "text" ? <pre>{value.content}</pre>
          : value.kind === "image" ? <img src={source} alt={selected} />
          : value.kind === "pdf" ? <iframe src={source} title={selected} />
          : value.kind === "media" && value.mediaType.startsWith("audio/") ? <audio src={source} controls />
          : value.kind === "media" ? <video src={source} controls />
          : <div className="lbs-preview-empty">该二进制文件暂不支持内嵌预览。</div>}
      </div>;
    }

    function FilesPage({ requestedRoot, requestedPath }) {
      const desktop = useDesktopContext();
      const root = requestedRoot || desktop.context?.root;
      const [childrenByPath, setChildrenByPath] = useState({});
      const [expanded, setExpanded] = useState(() => new Set(["."]));
      const [loadingPaths, setLoadingPaths] = useState(() => new Set());
      const [selected, setSelected] = useState("");
      const [preview, setPreview] = useState(null);
      const [error, setError] = useState("");
      const [menu, setMenu] = useState(null);
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState("");
      const [saving, setSaving] = useState(false);
      const loadDirectory = useCallback(async (next) => {
        if (!root) return;
        setLoadingPaths((current) => new Set(current).add(next));
        try {
          const listing = await bridge().workspace.list({ root, path: next });
          setChildrenByPath((current) => ({ ...current, [next]: listing.entries || [] }));
          setError("");
        }
        catch (reason) { setError(messageOf(reason)); }
        finally { setLoadingPaths((current) => { const value = new Set(current); value.delete(next); return value; }); }
      }, [root]);
      const choose = useCallback(async (entry) => {
        setSelected(entry.path); setPreview(null); setEditing(false); setDraft(""); setError("");
        try { setPreview(await bridge().workspace.read({ root, path: entry.path })); }
        catch (reason) { setError(messageOf(reason)); }
      }, [root]);
      const initialize = useCallback(async (target = "") => {
        setChildrenByPath({}); setExpanded(new Set(["."])); setSelected(""); setPreview(null); setEditing(false); setDraft(""); setMenu(null);
        if (!root) return;
        const relative = target ? relativeWorkspacePath(root, target) : ".";
        const parts = relative.split(/[\\/]/u).filter((part) => part && part !== ".");
        const separator = pathSeparator(root);
        const directories = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(separator));
        const openDirectories = [".", ...directories];
        setExpanded(new Set(openDirectories));
        await Promise.all(openDirectories.map((directory) => loadDirectory(directory)));
        if (parts.length > 0) await choose({ path: parts.join(separator), type: "file" });
      }, [choose, loadDirectory, root]);
      useEffect(() => { void initialize(requestedPath); }, [initialize, requestedPath]);
      useEffect(() => {
        const close = () => setMenu(null);
        const key = (event) => { if (event.key === "Escape") close(); };
        document.addEventListener("pointerdown", close);
        window.addEventListener("blur", close);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", key);
        return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("blur", close); window.removeEventListener("resize", close); window.removeEventListener("keydown", key); };
      }, []);
      const toggleDirectory = async (entry) => {
        if (expanded.has(entry.path)) {
          setExpanded((current) => { const value = new Set(current); value.delete(entry.path); return value; });
          return;
        }
        setExpanded((current) => new Set(current).add(entry.path));
        if (!childrenByPath[entry.path]) await loadDirectory(entry.path);
      };
      const save = async () => {
        if (!selected || preview?.kind !== "text" || saving) return;
        setSaving(true); setError("");
        try {
          const result = await bridge().workspace.write({ root, path: selected, content: draft, expectedModifiedAt: preview.modifiedAt });
          setPreview((current) => ({ ...current, content: draft, size: result.size, modifiedAt: result.modifiedAt }));
          setEditing(false);
          await loadDirectory(parentWorkspacePath(selected));
        } catch (reason) { setError(messageOf(reason)); }
        finally { setSaving(false); }
      };
      const editEntry = async (entry) => {
        setSelected(entry.path); setPreview(null); setEditing(false); setDraft("");
        const value = await bridge().workspace.read({ root, path: entry.path });
        if (value.kind !== "text") throw new Error("该文件不是可编辑的文本文件。 ");
        setPreview(value); setDraft(value.content); setEditing(true);
      };
      const refresh = async () => Promise.all([...expanded].map((path) => loadDirectory(path)));
      const openMenu = (event, entry) => {
        event.preventDefault(); event.stopPropagation();
        setMenu({ entry, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 208)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 218)) });
      };
      const menuAction = (task) => async (event) => {
        event.preventDefault(); event.stopPropagation(); setMenu(null); setError("");
        try { await task(); } catch (reason) { setError(messageOf(reason)); }
      };
      const renameEntry = async (entry) => {
        const name = window.prompt(`重命名${entry.type === "directory" ? "文件夹" : "文件"}`, entry.name);
        if (!name?.trim() || name.trim() === entry.name) return;
        const result = await bridge().workspace.rename({ root, path: entry.path, name: name.trim() });
        if (entry.type === "directory") {
          await initialize();
          return;
        }
        await loadDirectory(parentWorkspacePath(entry.path));
        if (selected === entry.path) await choose({ ...entry, name: result.name, path: result.path });
      };
      const removeEntry = async (entry) => {
        const label = entry.type === "directory" ? `空文件夹“${entry.name}”` : `文件“${entry.name}”`;
        if (!window.confirm(`确定删除${label}？\n此操作无法撤销。`)) return;
        await bridge().workspace.remove({ root, path: entry.path });
        const separator = pathSeparator(root);
        if (selected === entry.path || selected.startsWith(`${entry.path}${separator}`)) {
          setSelected(""); setPreview(null); setEditing(false); setDraft("");
        }
        setExpanded((current) => new Set([...current].filter((item) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
        setChildrenByPath((current) => Object.fromEntries(Object.entries(current).filter(([item]) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
        await loadDirectory(parentWorkspacePath(entry.path));
      };
      const revealSelected = async () => {
        try { await bridge().workspace.reveal({ root, path: selected }); }
        catch (reason) { setError(messageOf(reason)); }
      };
      const rootName = String(root || "项目").split(/[\\/]/u).filter(Boolean).at(-1) || String(root || "项目");
      if (!bridge()?.capabilities?.workspaceFiles) return <div className="lbs-preview-empty">文件工作台仅在桌面版中可用。</div>;
      return <div className="lbs-workbench-body">
        <section className="lbs-files-list">
          <div className="lbs-files-toolbar"><span className="lbs-files-path" title={root}>{root || "正在读取项目…"}</span><button className="lbs-wb-button" disabled={expanded.size <= 1} onClick={() => setExpanded(new Set(["."]))}>全部折叠</button><button className="lbs-wb-button" onClick={refresh}>刷新</button></div>
          {error || desktop.error ? <div className="lbs-wb-error">{error || desktop.error}</div> : null}
          <div className="lbs-file-tree" role="tree" aria-label="项目文件目录树">
            <div className="lbs-file-root-row"><span className="lbs-tree-chevron">▾</span><span className="lbs-tree-icon">▰</span><span className="lbs-tree-name">{rootName}</span></div>
            <div role="group">{(childrenByPath["."] || []).map((entry) => <FileTreeNode key={entry.path} entry={entry} depth={0} childrenByPath={childrenByPath} expanded={expanded} loadingPaths={loadingPaths} selected={selected} onToggle={toggleDirectory} onSelect={choose} onContextMenu={openMenu} />)}</div>
          </div>
        </section>
        <section className="lbs-preview"><Preview selected={selected} value={preview} editing={editing} draft={draft} saving={saving} onBeginEdit={() => { setDraft(preview?.content || ""); setEditing(true); }} onDraftChange={setDraft} onSave={save} onCancelEdit={() => { setDraft(preview?.content || ""); setEditing(false); }} onReveal={revealSelected} /></section>
        {menu ? <div className="lbs-file-menu" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
          <button onClick={menuAction(() => menu.entry.type === "directory" ? toggleDirectory(menu.entry) : choose(menu.entry))}>{menu.entry.type === "directory" ? expanded.has(menu.entry.path) ? "折叠文件夹" : "展开文件夹" : "在文件管理器中打开"}</button>
          {menu.entry.mediaType?.startsWith("text/") || menu.entry.mediaType === "application/json" ? <button onClick={menuAction(() => editEntry(menu.entry))}>编辑文本</button> : null}
          <button onClick={menuAction(() => bridge().workspace.reveal({ root, path: menu.entry.path }))}>打开所在位置</button>
          <button onClick={menuAction(() => renameEntry(menu.entry))}>重命名…</button>
          <div className="lbs-file-menu-separator" />
          <button className="danger" onClick={menuAction(() => removeEntry(menu.entry))}>{menu.entry.type === "directory" ? "删除空文件夹" : "删除文件"}</button>
        </div> : null}
      </div>;
    }

    function GitChange({ change, side, active, busy, onSelect, onAction, actionLabel }) {
      const code = side === "staged" ? change.index : change.worktree;
      return <div className="lbs-git-change" data-active={active} data-status={code === "?" ? "U" : code} onClick={onSelect} onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) onSelect(); }} role="button" tabIndex={0}>
        <span className="lbs-git-code">{code === "?" ? "U" : code}</span>
        <span><span className="lbs-git-change-name">{change.path}</span>{change.originalPath ? <span className="lbs-git-change-sub">来自 {change.originalPath}</span> : null}</span>
        <button className="lbs-git-row-action" disabled={busy} onClick={(event) => { event.stopPropagation(); onAction(); }}>{actionLabel}</button>
      </div>;
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
        setSelection({ kind: "change", path: change.path, side }); setError("");
        try { const result = await bridge().git.diff({ root, path: change.path, side }); setDiff(result.diff || "该文件没有可显示的文本差异。"); }
        catch (reason) { setError(messageOf(reason)); }
      }, [root]);
      const showCommit = useCallback(async (commit) => {
        setSelection({ kind: "commit", ref: commit.hash }); setError("");
        try { const result = await bridge().git.diff({ root, side: "commit", ref: commit.hash }); setDiff(result.diff || "该提交没有文本差异。"); }
        catch (reason) { setError(messageOf(reason)); }
      }, [root]);
      const chooseDefault = useCallback((next) => {
        const staged = next.changes.find((change) => change.staged);
        const unstaged = next.changes.find((change) => change.unstaged);
        if (staged) void showChange(staged, "staged");
        else if (unstaged) void showChange(unstaged, unstaged.untracked ? "untracked" : "unstaged");
        else if (next.commits[0]) void showCommit(next.commits[0]);
        else { setSelection(null); setDiff(""); }
      }, [showChange, showCommit]);
      const refresh = useCallback(async () => {
        if (!root) return;
        setBusy(true); setError("");
        try { const next = await bridge().git.inspect({ root }); setState(next); chooseDefault(next); }
        catch (reason) { setError(messageOf(reason)); }
        finally { setBusy(false); }
      }, [root, chooseDefault]);
      useEffect(() => { setState(null); setSelection(null); setDiff(""); if (root) void refresh(); }, [root, refresh]);

      const update = async (task, success) => {
        setBusy(true); setError(""); setNotice("");
        try { const next = await task(); setState(next); setNotice(success); chooseDefault(next); return next; }
        catch (reason) { setError(messageOf(reason)); return null; }
        finally { setBusy(false); }
      };
      const stage = (change) => update(() => bridge().git.stage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已暂存 ${change.path}`);
      const unstage = (change) => update(() => bridge().git.unstage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已取消暂存 ${change.path}`);
      const restore = (change) => {
        if (!window.confirm(`放弃“${change.path}”尚未暂存的修改？\n此操作不能直接撤销。`)) return;
        void update(() => bridge().git.restore({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已恢复 ${change.path}`);
      };
      const commit = async () => {
        const value = message.trim(); if (!value) return;
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
        if (!name?.trim() || !window.confirm(`删除本地分支“${name.trim()}”？\n未合并分支会被 Git 拒绝。`)) return;
        void update(() => bridge().git.branch({ root, action: "delete", name: name.trim(), expectedHead: state.head }), `已删除分支 ${name.trim()}`);
      };
      const sync = (action) => {
        const labels = { fetch: "获取远端更新", pull: "快进拉取远端更新", push: "推送当前分支到远端" };
        if (action !== "fetch" && !window.confirm(`${labels[action]}？\n不会执行强制推送或自动合并。`)) return;
        void update(() => bridge().git.sync({ root, action, remote: state.remotes[0], expectedHead: state.head }), `${labels[action]}完成`);
      };

      if (!bridge()?.capabilities?.gitReview) return <div className="lbs-preview-empty">版本中心仅在桌面版中可用。</div>;
      if (!state && !error) return <div className="lbs-preview-empty">正在检查 Git 状态…</div>;
      if (state && !state.isRepository) return <div className="lbs-git-onboarding">
        <strong>这个项目还没有版本记录</strong>
        <p>启用后，劳博士可以为项目创建本地提交和任务分支；远端发布仍由你确认。</p>
        <code>{state.root}</code>
        <button className="lbs-wb-button primary" disabled={busy} onClick={() => window.confirm(`在以下目录启用 Git 版本管理？\n${state.root}`) && update(() => bridge().git.init({ root, branch: "main" }), "Git 版本管理已启用")}>启用版本管理</button>
        {error ? <div className="lbs-wb-error">{error}</div> : null}
      </div>;
      if (!state) return <div className="lbs-git-onboarding"><strong>无法读取版本状态</strong><div className="lbs-wb-error">{error || desktop.error}</div><button className="lbs-wb-button" onClick={refresh}>重试</button></div>;

      const staged = state.changes.filter((change) => change.staged);
      const unstaged = state.changes.filter((change) => change.unstaged);
      const selectedTitle = selection?.kind === "commit" ? `提交 ${selection.ref.slice(0, 8)}` : selection?.path || "版本差异";
      return <div className={`lbs-git-layout ${busy ? "lbs-git-loading" : ""}`}>
        <aside className="lbs-git-sidebar">
          <div className="lbs-git-toolbar">
            <button className="lbs-wb-button" onClick={refresh}>刷新</button>
            <select value={state.branch} onChange={(event) => void switchBranch(event.target.value)}>{state.branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select>
            <button className="lbs-wb-button" onClick={createBranch}>新分支</button>
            <button className="lbs-wb-button danger" onClick={deleteBranch}>删分支</button>
            <span className="lbs-git-toolbar-spacer" />
            {state.upstream ? <span className="lbs-git-badge">↑{state.ahead} ↓{state.behind}</span> : null}
          </div>
          {error || desktop.error ? <div className="lbs-wb-error">{error || desktop.error}</div> : notice ? <div className="lbs-wb-ok">{notice}</div> : null}
          <div className="lbs-git-scroll">
            <section className="lbs-git-section"><div className="lbs-git-section-head">已暂存 <span>{staged.length}</span></div>{staged.map((change) => <GitChange key={`s:${change.path}`} change={change} side="staged" active={selection?.side === "staged" && selection.path === change.path} busy={busy} onSelect={() => showChange(change, "staged")} onAction={() => unstage(change)} actionLabel="取消暂存" />)}</section>
            <section className="lbs-git-section"><div className="lbs-git-section-head">工作区变更 <span>{unstaged.length}</span></div>{unstaged.map((change) => <GitChange key={`w:${change.path}`} change={change} side={change.untracked ? "untracked" : "unstaged"} active={selection?.side !== "staged" && selection?.path === change.path} busy={busy} onSelect={() => showChange(change, change.untracked ? "untracked" : "unstaged")} onAction={() => stage(change)} actionLabel="暂存" />)}{unstaged.filter((change) => !change.untracked).map((change) => <button key={`r:${change.path}`} className="lbs-wb-button danger" onClick={() => restore(change)}>放弃 {change.path} 的修改</button>)}</section>
            <section className="lbs-git-section"><div className="lbs-git-section-head">提交历史 <span>{state.commits.length}</span></div>{state.commits.map((commit) => <button className="lbs-git-history" data-active={selection?.ref === commit.hash} key={commit.hash} onClick={() => showCommit(commit)}><strong>{commit.subject}</strong><small>{commit.shortHash} · {commit.author} · {new Date(commit.date).toLocaleString("zh-CN")}</small></button>)}</section>
          </div>
          <div className="lbs-git-commit-box"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="描述这次本地版本…" /><div className="lbs-git-commit-actions"><span>{staged.length} 个已暂存文件</span><button className="lbs-wb-button primary" disabled={!message.trim() || staged.length === 0 || busy} onClick={commit}>提交版本</button></div></div>
        </aside>
        <main className="lbs-git-main">
          <div className="lbs-git-diff-head"><strong>{selectedTitle}</strong><span>{state.root}</span><span className="lbs-git-toolbar-spacer" />{state.remotes.length ? <><button className="lbs-wb-button" onClick={() => sync("fetch")}>获取</button><button className="lbs-wb-button" onClick={() => sync("pull")}>拉取</button><button className="lbs-wb-button primary" onClick={() => sync("push")}>发布</button></> : <span>未配置远端</span>}</div>
          {diff ? <DiffViewer value={diff} path={selection?.path || ""} /> : <div className="lbs-preview-empty">选择一个变更或提交查看 Diff。</div>}
        </main>
      </div>;
    }

    function WorkspaceWorkbench() {
      const [page, setPage] = useState("");
      const [root, setRoot] = useState("");
      const [requestedPath, setRequestedPath] = useState("");
      useEffect(() => {
        const open = (event) => {
          const tool = event.detail?.tool;
          if (tool === "close") { setPage(""); setRequestedPath(""); return; }
          if (!["files", "git"].includes(tool)) return;
          setRoot(event.detail?.cwd || ""); setRequestedPath(tool === "files" ? event.detail?.path || "" : ""); setPage(tool);
        };
        window.addEventListener("laobos:open-desktop-tool", open);
        return () => window.removeEventListener("laobos:open-desktop-tool", open);
      }, []);
      useEffect(() => {
        const interceptProducedFile = (event) => {
          if (!(event.target instanceof Element)) return;
          const target = event.target.closest('[data-produced-files-row] button[title], [data-chat-flow] [aria-label][title]');
          if (!target) return;
          const produced = target.closest("[data-produced-files-row]");
          const label = target.getAttribute("aria-label") || "";
          if (!produced && !/^(?:打开|Open)\s/u.test(label)) return;
          const path = target.getAttribute("title");
          if (!path) return;
          event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
          void openProducedFile(path);
        };
        document.addEventListener("click", interceptProducedFile, true);
        return () => document.removeEventListener("click", interceptProducedFile, true);
      }, []);
      const close = () => { const closing = page; setPage(""); setRequestedPath(""); window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: closing } })); };
      if (!page) return null;
      const title = page === "files" ? "文件管理器" : "版本中心";
      return <section className="lbs-workbench" role="dialog" aria-label={title}>
        <header className="lbs-workbench-header"><strong>{title}</strong><button className="lbs-wb-button lbs-workbench-close" onClick={close}>关闭</button></header>
        {page === "files" ? <FilesPage requestedRoot={root} requestedPath={requestedPath} /> : <GitPage requestedRoot={root} />}
      </section>;
    }

    const inject = ["slots", "sessions", "workspaces"];
    function apply(ctx) {
      module.ctx = ctx;
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-desktop-workbench", order: 35 }, WorkspaceWorkbench));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
