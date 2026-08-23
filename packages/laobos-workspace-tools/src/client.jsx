/* eslint-disable @next/next/no-assign-module-variable, @next/next/no-img-element -- DSH module factory and local previews */
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css as cssLanguage } from "@codemirror/lang-css";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json as jsonLanguage } from "@codemirror/lang-json";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { python as pythonLanguage } from "@codemirror/lang-python";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightSpecialChars, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { isCodePath, languageForPath, parseUnifiedDiff, tokenizeCodeLine } from "./code-renderer.mjs";
import { createConversationChangeStatsDefinition, selectConversationChanges } from "./conversation-changes.mjs";
import { buildGitReviewTree, gitReviewDirectoryPaths } from "./git-review-tree.mjs";
import { resolveWorkspaceRoot } from "./workspace-root.mjs";
window.__ModuleLoader__.load({
  id: "@laobos/dsh-workspace-tools",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const Primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const { isAppendSurfaceEvent } = require("@deepseek-ai/dsh-client-runtime/client");
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    const conversationChangeStatsDefinition = createConversationChangeStatsDefinition(isAppendSurfaceEvent);

    const css = `
      .lbs-workbench{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483030}.lbs-workbench-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:8px;height:56px;padding:0 18px}.lbs-workbench-header strong{font-size:15px}.lbs-workbench-close{margin-left:auto}.lbs-workbench-body{display:flex;flex:1;min-height:0}.lbs-files-list{border-right:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;display:flex;flex-direction:column;min-width:250px;width:34%}.lbs-files-toolbar,.lbs-git-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:6px;min-height:43px;padding:0 10px}.lbs-files-path{color:var(--dsw-alias-label-secondary);flex:1;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-rows{flex:1;overflow:auto;padding:5px}.lbs-file-row{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:flex;font:inherit;font-size:12px;gap:7px;height:29px;padding:0 8px;text-align:left;width:100%}.lbs-file-row:hover,.lbs-file-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-file-size{color:var(--dsw-alias-label-tertiary);font-size:10px}.lbs-preview{box-sizing:border-box;flex:1;min-width:0;overflow:auto;padding:16px}.lbs-preview-empty{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;height:100%;justify-content:center;text-align:center}.lbs-preview-title{align-items:center;display:flex;gap:8px;margin-bottom:12px}.lbs-preview-title strong{font-size:14px}.lbs-preview-actions{align-items:center;display:flex;gap:5px;margin-left:auto}.lbs-preview pre,.lbs-git-diff{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;box-sizing:border-box;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;overflow:auto;padding:12px;tab-size:2;white-space:pre}.lbs-preview img,.lbs-preview video{display:block;height:auto;margin:auto;max-height:calc(100vh - 130px);max-width:100%}.lbs-preview iframe{border:1px solid var(--dsw-alias-border-l1);height:calc(100vh - 115px);width:100%}.lbs-preview audio{margin:40px auto;max-width:620px;width:100%}.lbs-preview-editor{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font:12px/1.58 ui-monospace,SFMono-Regular,Menlo,monospace;height:calc(100vh - 145px);min-height:280px;outline:none;padding:12px;resize:none;tab-size:2;width:100%}.lbs-preview-editor:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
      .lbs-wb-button{appearance:none;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;font:inherit;font-size:11px;min-height:31px;padding:0 9px}.lbs-wb-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-wb-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-wb-button.danger{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-wb-button:disabled{cursor:not-allowed;opacity:.38}.lbs-wb-error{background:rgba(218,70,70,.1);border-radius:8px;color:var(--dsw-alias-state-error-primary,#d94b4b);font-size:11px;line-height:1.5;margin:8px;padding:9px}.lbs-wb-ok{background:rgba(52,163,105,.1);border-radius:8px;color:var(--dsw-alias-state-success-primary,#38a76f);font-size:11px;margin:8px;padding:9px}
      .lbs-git-layout{display:grid;flex:1;grid-template-columns:minmax(230px,270px) minmax(220px,280px) minmax(0,1fr);height:100%;min-height:0;min-width:0;overflow:hidden}.lbs-git-sidebar{border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}.lbs-git-toolbar{flex-wrap:wrap}.lbs-git-toolbar select,.lbs-git-commit-box textarea{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:inherit;font:inherit}.lbs-git-toolbar select{font-size:11px;height:29px;max-width:122px;padding:0 7px}.lbs-git-toolbar-spacer{flex:1}
      .lbs-git-scroll{flex:1;min-height:0;overflow:auto;padding:7px 9px;scrollbar-gutter:stable}.lbs-git-section{margin-bottom:15px}.lbs-git-section-head{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:10px;font-weight:600;height:27px;letter-spacing:.03em;padding:0 5px;text-transform:uppercase}.lbs-git-section-head span{margin-left:auto}.lbs-git-section-head .lbs-git-row-action{margin-left:8px;opacity:1}.lbs-git-section-head .lbs-git-row-action:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-git-change,.lbs-git-history{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;display:grid;font:inherit;text-align:left;width:100%}.lbs-git-change{grid-template-columns:28px minmax(0,1fr) auto;min-height:34px;padding:4px 5px}.lbs-git-change:hover,.lbs-git-change[data-active=true],.lbs-git-history:hover,.lbs-git-history[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-git-code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-git-change-name,.lbs-git-history strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-change-sub,.lbs-git-history small{color:var(--dsw-alias-label-tertiary);display:block;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-row-action{appearance:none;background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:9px;height:25px;opacity:.2;padding:0 6px}.lbs-git-change:hover .lbs-git-row-action,.lbs-git-row-action:focus-visible{opacity:1}.lbs-git-history{display:block;padding:6px}.lbs-git-commit-box{border-top:1px solid var(--dsw-alias-border-l1);display:grid;gap:7px;padding:9px}.lbs-git-commit-box textarea{box-sizing:border-box;font-size:11px;line-height:1.45;min-height:58px;padding:7px;resize:vertical;width:100%}.lbs-git-commit-actions{align-items:center;display:flex;gap:6px}.lbs-git-commit-actions span{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-right:auto}
      .lbs-git-files-pane{background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-1));border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}.lbs-git-files-head{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:8px;height:42px;padding:0 10px}.lbs-git-files-head strong{font-size:11px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-files-head span{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-left:auto}.lbs-git-file-tree{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:5px;scrollbar-gutter:stable}.lbs-git-tree-row{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;box-sizing:border-box;color:var(--dsw-alias-label-primary);cursor:pointer;display:grid;font:inherit;grid-template-columns:16px 19px minmax(0,1fr) auto;height:29px;padding-right:7px;text-align:left;width:100%}.lbs-git-tree-row:hover,.lbs-git-tree-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-git-tree-chevron{color:var(--dsw-alias-label-tertiary);font-size:10px;text-align:center}.lbs-git-tree-icon{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;justify-content:center}.lbs-git-tree-icon[data-kind=folder]{color:var(--dsw-alias-state-warn-primary,#d6a84b)}.lbs-git-tree-name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-tree-status{color:var(--dsw-alias-label-tertiary);font:10px ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:7px}.lbs-git-tree-status[data-status=A],.lbs-git-tree-status[data-status=U]{color:var(--dsw-alias-state-success-primary)}.lbs-git-tree-status[data-status=D]{color:var(--dsw-alias-state-error-primary)}.lbs-git-files-empty{color:var(--dsw-alias-label-tertiary);font-size:11px;padding:14px 9px}
      .lbs-git-main{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}.lbs-git-diff-head{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;gap:8px;min-height:43px;padding:0 13px}.lbs-git-diff-head strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-git-diff-head span{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-git-diff{border:0;border-radius:0;flex:1;min-height:0}.lbs-git-onboarding{align-content:center;display:grid;gap:12px;height:100%;justify-items:center;padding:30px;text-align:center}.lbs-git-onboarding strong{font-size:16px}.lbs-git-onboarding p{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;margin:0;max-width:480px}.lbs-git-badge{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-secondary);font-size:9px;padding:2px 5px}.lbs-git-loading{opacity:.58;pointer-events:none}
      .lbs-files-list{min-width:280px;width:32%}.lbs-files-toolbar{min-height:46px}.lbs-file-tree{flex:1;overflow:auto;padding:6px 5px 14px}.lbs-file-root-row,.lbs-tree-row{align-items:center;border-radius:6px;box-sizing:border-box;display:flex;min-width:max-content;width:100%}.lbs-file-root-row{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;height:31px;padding:0 8px}.lbs-tree-row{height:29px;padding-right:7px}.lbs-tree-row:hover,.lbs-tree-row[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}.lbs-tree-toggle,.lbs-tree-file{align-items:center;appearance:none;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;font:inherit;height:100%;min-width:0;padding:0;text-align:left}.lbs-tree-toggle{flex:1}.lbs-tree-chevron{color:var(--dsw-alias-label-tertiary);display:inline-flex;flex:none;font-size:10px;justify-content:center;width:18px}.lbs-tree-icon{align-items:center;color:var(--dsw-alias-label-secondary);display:inline-flex;flex:none;font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;height:18px;justify-content:center;margin-right:5px;width:18px}.lbs-tree-row[data-type=directory] .lbs-tree-icon{color:var(--dsw-alias-state-warn-primary,#d6a84b);font-size:15px}.lbs-tree-row[data-code=true] .lbs-tree-icon{color:var(--dsw-alias-brand-primary,#6f8cff)}.lbs-tree-name{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-tree-file{flex:1}.lbs-tree-size{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-left:10px}.lbs-tree-loading{animation:lbs-tree-spin .8s linear infinite;display:inline-block}@keyframes lbs-tree-spin{to{transform:rotate(360deg)}}
      .lbs-file-menu{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-shadow:var(--dsw-shadow-lv3);display:grid;min-width:190px;padding:5px;position:fixed;z-index:2147483200}.lbs-file-menu button{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:11px;height:30px;padding:0 9px;text-align:left}.lbs-file-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-file-menu button.danger{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-file-menu-separator{border-top:1px solid var(--dsw-alias-border-l1);margin:4px 3px}
      .lbs-wb-dialog-backdrop{align-items:center;background:rgba(0,0,0,.46);display:flex;inset:0;justify-content:center;padding:22px;position:fixed;z-index:2147483220}.lbs-wb-dialog{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);display:grid;grid-template-rows:46px minmax(0,1fr) auto;max-height:min(560px,92vh);overflow:hidden;width:min(480px,calc(100vw - 34px))}.lbs-wb-dialog header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;padding:0 14px}.lbs-wb-dialog header h2{font-size:14px;margin:0}.lbs-wb-dialog header>button{margin-left:auto}.lbs-wb-dialog-body{min-height:0;overflow:auto;padding:15px}.lbs-wb-dialog footer{border-top:1px solid var(--dsw-alias-border-l1);display:flex;gap:7px;justify-content:flex-end;padding:10px 14px}.lbs-wb-dialog p{font-size:12px;line-height:1.6;margin:0 0 10px;white-space:pre-line}.lbs-wb-dialog p:last-child{margin-bottom:0}.lbs-wb-dialog label{color:var(--dsw-alias-label-secondary);display:grid;font-size:11px;gap:5px}.lbs-wb-dialog input{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:12px inherit;height:32px;padding:0 8px;width:100%}
      .lbs-workbench{--lbs-code-keyword:#cf222e;--lbs-code-string:#0a3069;--lbs-code-number:#0550ae;--lbs-code-comment:#6e7781;--lbs-code-type:#953800;--lbs-code-function:#8250df;--lbs-diff-add:#1a7f37;--lbs-diff-delete:#cf222e;--lbs-diff-hunk:#0969da;--lbs-diff-file:#8250df;--lbs-diff-insert-bg:rgba(46,160,67,.1);--lbs-diff-insert-gutter:rgba(46,160,67,.16);--lbs-diff-delete-bg:rgba(248,81,73,.1);--lbs-diff-delete-gutter:rgba(248,81,73,.16);--lbs-diff-hunk-bg:rgba(9,105,218,.08)}body[data-ds-dark-theme] .lbs-workbench{--lbs-code-keyword:#ff7b72;--lbs-code-string:#a5d6ff;--lbs-code-number:#79c0ff;--lbs-code-comment:#8b949e;--lbs-code-type:#ffa657;--lbs-code-function:#d2a8ff;--lbs-diff-add:#56d364;--lbs-diff-delete:#ff7b72;--lbs-diff-hunk:#79c0ff;--lbs-diff-file:#d2a8ff;--lbs-diff-insert-bg:rgba(46,160,67,.17);--lbs-diff-insert-gutter:rgba(46,160,67,.24);--lbs-diff-delete-bg:rgba(248,81,73,.16);--lbs-diff-delete-gutter:rgba(248,81,73,.23);--lbs-diff-hunk-bg:rgba(56,139,253,.13)}
      .lbs-code-viewer{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:9px;color:var(--dsw-alias-label-primary);min-width:max-content;overflow:auto}.lbs-code-language{align-items:center;background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);display:flex;font:10px/28px ui-monospace,SFMono-Regular,Menlo,monospace;height:28px;justify-content:space-between;padding:0 10px;position:sticky;left:0}.lbs-code-row{display:grid;font:12px/1.58 ui-monospace,SFMono-Regular,Menlo,monospace;grid-template-columns:52px minmax(max-content,1fr);min-height:19px}.lbs-code-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-code-line-number{border-right:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));padding:0 10px;text-align:right;user-select:none}.lbs-code-line{padding:0 12px;white-space:pre}.lbs-code-truncated{background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-tertiary);font-size:11px;padding:8px 12px;position:sticky;left:0}.lbs-token-keyword{color:var(--lbs-code-keyword)}.lbs-token-string{color:var(--lbs-code-string)}.lbs-token-number{color:var(--lbs-code-number)}.lbs-token-comment{color:var(--lbs-code-comment);font-style:italic}.lbs-token-type{color:var(--lbs-code-type)}.lbs-token-function{color:var(--lbs-code-function)}
      .lbs-diff-viewer{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);display:flex;flex:1;flex-direction:column;min-height:0}.lbs-diff-summary{align-items:center;background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex:none;gap:10px;height:34px;padding:0 10px}.lbs-diff-summary span{font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-diff-additions{color:var(--lbs-diff-add)}.lbs-diff-deletions{color:var(--lbs-diff-delete)}.lbs-diff-summary button{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:10px;line-height:23px;margin-left:auto;padding:0 8px}.lbs-diff-summary button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-diff-scroll{flex:1;min-height:0;overflow:auto}.lbs-diff-table{border-collapse:collapse;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;min-width:100%;table-layout:auto}.lbs-diff-row td{height:20px;padding:0}.lbs-diff-gutter{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-1));border-right:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));min-width:43px;padding:0 8px!important;text-align:right;user-select:none;width:43px}.lbs-diff-prefix{color:var(--dsw-alias-label-tertiary);text-align:center;user-select:none;width:24px}.lbs-diff-code{padding-right:14px!important;white-space:pre}.lbs-diff-viewer[data-wrap=true] .lbs-diff-code{overflow-wrap:anywhere;white-space:pre-wrap}.lbs-diff-row[data-type=insert]{background:var(--lbs-diff-insert-bg)}.lbs-diff-row[data-type=insert] .lbs-diff-gutter{background:var(--lbs-diff-insert-gutter);color:var(--lbs-diff-add)}.lbs-diff-row[data-type=insert] .lbs-diff-prefix{color:var(--lbs-diff-add)}.lbs-diff-row[data-type=delete]{background:var(--lbs-diff-delete-bg)}.lbs-diff-row[data-type=delete] .lbs-diff-gutter{background:var(--lbs-diff-delete-gutter);color:var(--lbs-diff-delete)}.lbs-diff-row[data-type=delete] .lbs-diff-prefix{color:var(--lbs-diff-delete)}.lbs-diff-row[data-type=hunk]{background:var(--lbs-diff-hunk-bg);color:var(--lbs-diff-hunk)}.lbs-diff-row[data-type=file]{background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));color:var(--lbs-diff-file);font-weight:600}.lbs-diff-row[data-type=meta],.lbs-diff-row[data-type=notice]{color:var(--dsw-alias-label-tertiary)}.lbs-diff-row[data-type=hunk] .lbs-diff-code,.lbs-diff-row[data-type=file] .lbs-diff-code,.lbs-diff-row[data-type=meta] .lbs-diff-code,.lbs-diff-row[data-type=notice] .lbs-diff-code{padding:2px 12px!important}.lbs-diff-row:hover{box-shadow:inset 0 0 0 9999px color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent)}
      .lbs-git-main .lbs-diff-viewer{height:100%;overflow:hidden}.lbs-git-main .lbs-diff-scroll{height:0;overscroll-behavior:contain;scrollbar-gutter:stable}
      .lbs-git-change[data-status=A] .lbs-git-code,.lbs-git-change[data-status=U] .lbs-git-code{color:var(--dsw-alias-state-success-primary,#2a9b67)}.lbs-git-change[data-status=M] .lbs-git-code{color:var(--dsw-alias-brand-primary,#6f8cff)}.lbs-git-change[data-status=D] .lbs-git-code{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-git-change[data-status=R] .lbs-git-code{color:#a675d1}
      body[data-laobos-task-git-hub] [data-goal-bar],body[data-laobos-task-git-hub] [data-testid="todo-panel"]{display:none!important}
      .lbs-project-hub{color:var(--dsw-alias-label-primary);position:relative}.lbs-project-hub-trigger{align-items:center;appearance:none;background:transparent;border:0;border-radius:9px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;height:32px;justify-content:center;padding:0;position:relative;width:32px}.lbs-project-hub-trigger:hover,.lbs-project-hub-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-project-hub-trigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}.lbs-project-hub-count{align-items:center;background:var(--dsw-alias-state-business-primary);border:2px solid var(--dsw-alias-bg-base);border-radius:999px;color:#fff;display:flex;font-size:8px;font-variant-numeric:tabular-nums;font-weight:700;height:14px;justify-content:center;line-height:1;min-width:14px;padding:0 2px;position:absolute;right:-4px;top:-4px}.lbs-project-hub-panel{background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:var(--dsw-shadow-lv3);box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;max-height:min(720px,calc(100vh - 76px));overflow:hidden;position:absolute;right:0;top:calc(100% + 10px);width:min(420px,calc(100vw - 28px));z-index:2147483060}.lbs-project-hub-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;flex:none;height:51px;padding:0 14px 0 17px}.lbs-project-hub-header strong{font-size:14px;font-weight:620}.lbs-project-hub-header small{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-left:8px;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-project-hub-close,.lbs-project-hub-refresh{align-items:center;appearance:none;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:flex;height:28px;justify-content:center;margin-left:auto;padding:0;width:28px}.lbs-project-hub-close:hover,.lbs-project-hub-refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-project-hub-scroll{min-height:0;overflow:auto;padding:4px 0 10px}.lbs-project-hub-section{padding:13px 16px}.lbs-project-hub-section+.lbs-project-hub-section{border-top:1px solid var(--dsw-alias-border-l1)}.lbs-project-hub-section-head{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:12px;font-weight:600;gap:8px;min-height:27px}.lbs-project-hub-section-head>svg{color:var(--dsw-alias-label-tertiary);flex:none}.lbs-project-hub-section-head>span:nth-child(2){margin-left:auto}.lbs-project-hub-link{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:10px;margin-left:auto;padding:4px 6px}.lbs-project-hub-link:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-project-hub-metric{align-items:center;border-radius:8px;display:grid;gap:9px;grid-template-columns:18px minmax(0,1fr) auto;min-height:35px;padding:1px 5px}.lbs-project-hub-metric:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-project-hub-metric-icon{color:var(--dsw-alias-label-tertiary);display:flex}.lbs-project-hub-metric-label{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-project-hub-metric-value{color:var(--dsw-alias-label-tertiary);font:10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.lbs-project-hub-files-toggle{appearance:none;background:transparent;border:0;color:inherit;cursor:pointer;font:inherit;text-align:left;width:100%}.lbs-project-hub-files-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.lbs-project-hub-files-toggle .lbs-project-hub-metric-value{align-items:center;display:flex;gap:6px}.lbs-project-hub-disclosure{align-items:center;display:flex;transition:transform .16s var(--ds-ease-in-out,ease)}.lbs-project-hub-files-toggle[aria-expanded=true] .lbs-project-hub-disclosure{transform:rotate(90deg)}.lbs-project-hub-add{color:var(--dsw-alias-state-success-primary,#2a9b67)}.lbs-project-hub-delete{color:var(--dsw-alias-state-error-primary,#d94b4b);margin-left:6px}.lbs-project-hub-files{display:grid;gap:2px;margin-top:5px}.lbs-project-hub-file{align-items:center;appearance:none;background:transparent;border:0;border-radius:8px;color:inherit;cursor:pointer;display:grid;font:inherit;gap:9px;grid-template-columns:19px minmax(0,1fr) auto;min-height:34px;padding:3px 6px;text-align:left;width:100%}.lbs-project-hub-file:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-project-hub-file-code{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center}.lbs-project-hub-file[data-status=A] .lbs-project-hub-file-code,.lbs-project-hub-file[data-status=U] .lbs-project-hub-file-code{color:var(--dsw-alias-state-success-primary,#2a9b67)}.lbs-project-hub-file[data-status=M] .lbs-project-hub-file-code{color:var(--dsw-alias-state-business-primary)}.lbs-project-hub-file[data-status=D] .lbs-project-hub-file-code{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-project-hub-file-name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-project-hub-file-state{color:var(--dsw-alias-label-tertiary);font-size:9px;white-space:nowrap}.lbs-project-hub-goal{margin-top:7px;padding:0 5px}.lbs-project-hub-objective{font-size:13px;line-height:20px;margin:0;overflow-wrap:anywhere}.lbs-project-hub-goal-meta{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:10px;gap:8px;margin-top:6px}.lbs-project-hub-phase{background:var(--dsw-alias-fill-l2);border-radius:999px;color:var(--dsw-alias-label-secondary);padding:2px 7px}.lbs-project-hub-phase[data-phase=active]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary)}.lbs-project-hub-phase[data-phase=complete]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary)}.lbs-project-hub-phase[data-phase=blocked]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary)}.lbs-project-hub-blocker{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:10px;line-height:16px;margin-top:8px;padding:7px 9px}.lbs-project-hub-todos{display:grid;gap:5px;list-style:none;margin:7px 0 0;padding:0 5px}.lbs-project-hub-todo{align-items:flex-start;color:var(--dsw-alias-label-secondary);display:grid;font-size:12px;gap:9px;grid-template-columns:16px minmax(0,1fr);line-height:19px}.lbs-project-hub-todo-icon{align-items:center;color:var(--dsw-alias-label-caption);display:flex;height:19px;justify-content:center}.lbs-project-hub-todo[data-status=completed]{color:var(--dsw-alias-label-tertiary)}.lbs-project-hub-todo[data-status=completed] .lbs-project-hub-todo-icon{color:var(--dsw-alias-state-success-primary)}.lbs-project-hub-todo[data-status=in_progress] .lbs-project-hub-todo-icon{color:var(--dsw-alias-state-business-primary)}.lbs-project-hub-todo[data-status=in_progress] svg{animation:lbs-project-hub-spin 1s linear infinite}.lbs-project-hub-empty{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;margin:7px 5px 1px}.lbs-project-hub-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:10px;line-height:16px;margin-top:7px;padding:8px}.lbs-project-hub-loading{animation:lbs-project-hub-pulse 1.1s ease-in-out infinite;color:var(--dsw-alias-label-tertiary);font-size:11px;margin:8px 5px}.lbs-project-hub-full-button{align-items:center;appearance:none;background:var(--dsw-alias-interactive-bg-primary);border:0;border-radius:8px;color:var(--dsw-alias-label-on-primary);cursor:pointer;display:flex;font:inherit;font-size:11px;height:32px;justify-content:center;margin:10px 5px 0;width:calc(100% - 10px)}@keyframes lbs-project-hub-spin{to{transform:rotate(360deg)}}@keyframes lbs-project-hub-pulse{50%{opacity:.45}}
      .lbs-project-hub-section-head>span:nth-child(2){margin-left:0}.lbs-project-hub-section-head>span:nth-child(n+3){margin-left:auto}.lbs-project-hub-close{margin-left:4px}.lbs-project-hub-files{max-height:174px;overflow:auto;padding-right:2px}.lbs-project-hub.is-shell-fallback .lbs-project-hub-panel{position:fixed;right:68px;top:54px}
      .lbs-project-hub-commit-toggle{margin-top:5px}.lbs-project-hub-commit-panel{background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1));border:1px solid var(--dsw-alias-border-l1);border-radius:13px;display:grid;gap:0;margin:5px 4px 1px;overflow:hidden;padding:8px}.lbs-project-hub-commit-context{align-items:center;display:flex;gap:7px;padding:1px 2px 8px}.lbs-project-hub-commit-branch{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border-radius:999px;display:flex;font-size:11px;gap:6px;max-width:230px;padding:6px 10px}.lbs-project-hub-commit-branch span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-project-hub-ai-badge{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-left:auto}.lbs-project-hub-commit-input-wrap{position:relative}.lbs-project-hub-commit-input{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:9px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font:11px/18px inherit;max-height:140px;min-height:82px;outline:none;padding:10px 40px 10px 11px;resize:vertical;width:100%}.lbs-project-hub-commit-input:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}.lbs-project-hub-commit-input::placeholder{color:var(--dsw-alias-label-tertiary)}.lbs-project-hub-commit-input:disabled{opacity:.68}.lbs-project-hub-commit-ai{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border-radius:6px;color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;height:22px;justify-content:center;position:absolute;right:8px;top:8px;width:25px}.lbs-project-hub-commit-include{align-items:center;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;font-size:11px;gap:8px;min-height:38px;padding:2px 3px}.lbs-project-hub-commit-include input{accent-color:var(--dsw-alias-state-business-primary);height:15px;margin:0;width:15px}.lbs-project-hub-commit-include>span:nth-child(2){font-weight:560}.lbs-project-hub-commit-stats{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;margin-left:auto;white-space:nowrap}.lbs-project-hub-commit-feedback{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:14px;min-height:14px;overflow-wrap:anywhere;padding:0 3px 7px}.lbs-project-hub-commit-feedback[data-state=error]{color:var(--dsw-alias-state-error-primary)}.lbs-project-hub-commit-feedback[data-state=success]{color:var(--dsw-alias-state-success-primary)}.lbs-project-hub-commit-actions{border-top:1px solid var(--dsw-alias-border-l1);display:grid;gap:2px;padding-top:6px}.lbs-project-hub-commit-button{align-items:center;appearance:none;background:transparent;border:0;border-radius:8px;color:var(--dsw-alias-label-primary);cursor:pointer;display:grid;font:inherit;font-size:11px;gap:9px;grid-template-columns:18px minmax(0,1fr) auto;height:35px;padding:0 9px;text-align:left;width:100%}.lbs-project-hub-commit-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.lbs-project-hub-commit-button.primary{background:var(--dsw-alias-interactive-bg-hover-solid)}.lbs-project-hub-commit-button>svg{color:var(--dsw-alias-label-secondary)}.lbs-project-hub-commit-button small{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-project-hub-commit-button:disabled{cursor:not-allowed;opacity:.35}
      @media(max-width:1100px){.lbs-git-layout{grid-template-columns:220px 220px minmax(0,1fr)}}
      @media(max-width:850px){.lbs-workbench{left:0;right:0}.lbs-workbench-body{display:flex;flex-direction:column}.lbs-files-list{border-bottom:1px solid var(--dsw-alias-border-l1);border-right:0;max-height:46vh;width:100%}.lbs-git-layout{grid-template-columns:200px 210px minmax(440px,1fr);overflow:auto}.lbs-git-main{min-height:0}}
      @media(max-width:560px){.lbs-project-hub-panel{position:fixed;right:10px;top:54px;width:calc(100vw - 20px)}}
      .lbs-workbench[data-tool=files]{left:0}.lbs-workbench[data-tool=files] .lbs-workbench-header{height:48px;padding:0 14px}.lbs-workbench[data-tool=files] .lbs-workbench-header strong{font-size:14px}.lbs-workbench-root{color:var(--dsw-alias-label-tertiary);font-size:11px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-files-page{display:grid;grid-template-columns:260px minmax(0,1fr)}.lbs-files-page .lbs-files-list{background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-layer-1));flex:none;min-width:260px;width:260px}.lbs-files-page .lbs-files-toolbar{height:42px;min-height:42px;padding:0 6px 0 12px}.lbs-files-project{font-size:12px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-files-actions{display:flex;margin-left:auto}.lbs-files-actions button{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:10px;height:28px;padding:0 6px;white-space:nowrap}.lbs-files-actions button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-files-actions button:disabled{cursor:not-allowed;opacity:.35}.lbs-files-page .lbs-file-tree{padding-top:4px}.lbs-files-page .lbs-tree-size{display:none}.lbs-files-page .lbs-preview{display:flex;min-height:0;overflow:hidden;padding:0}.lbs-file-editor{display:flex;flex:1;flex-direction:column;min-height:0;min-width:0}.lbs-file-editor .lbs-preview-title{border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;height:42px;margin:0;padding:0 10px 0 13px}.lbs-file-editor .lbs-preview-title strong{font-size:12px;max-width:min(52vw,620px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-editor-file-icon{color:var(--dsw-alias-brand-primary);font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.lbs-editor-dirty{color:var(--dsw-alias-state-warn-primary,#d6a84b);font-size:10px}.lbs-editor-path{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);display:flex;flex:none;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;height:29px;overflow:hidden;padding:0 14px;text-overflow:ellipsis;white-space:nowrap}.lbs-preview-content{display:flex;flex:1;min-height:0;min-width:0;overflow:auto}.lbs-preview-content .lbs-preview-editor{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base));border:0;border-radius:0;box-shadow:none;flex:1;height:100%;min-height:0;padding:16px 18px;resize:none}.lbs-preview-content .lbs-preview-editor:focus{border:0;box-shadow:none}.lbs-preview-content img,.lbs-preview-content video{align-self:flex-start;margin:auto;max-height:100%;padding:16px}.lbs-preview-content iframe{border:0;height:100%;width:100%}.lbs-preview-content audio{align-self:flex-start}.lbs-file-editor .lbs-preview-actions{flex:none}.lbs-file-editor .lbs-wb-button.primary:disabled{background:transparent;color:var(--dsw-alias-label-tertiary)}
      @media(max-width:850px){.lbs-files-page{display:grid;flex-direction:row;grid-template-columns:220px minmax(0,1fr)}.lbs-files-page .lbs-files-list{border-bottom:0;border-right:1px solid var(--dsw-alias-border-l1);max-height:none;min-width:220px;width:220px}}
      @media(max-width:560px){.lbs-files-page{grid-template-columns:minmax(150px,42%) minmax(0,1fr)}.lbs-files-page .lbs-files-list{min-width:0;width:auto}.lbs-files-actions button{font-size:0;padding:0;width:27px}.lbs-files-actions button:before{font-size:14px}.lbs-files-actions button:nth-child(1):before{content:"＋"}.lbs-files-actions button:nth-child(2):before{content:"▰"}.lbs-files-actions button:nth-child(3):before{content:"↻"}.lbs-workbench-root,.lbs-editor-path{display:none}.lbs-file-editor{grid-template-rows:42px minmax(0,1fr)}.lbs-file-editor .lbs-preview-title strong{max-width:120px}}
      .lbs-workbench[data-tool=files],.lbs-workbench[data-tool=git]{left:var(--lbs-files-sidebar-offset,56px);transition:left var(--ds-transition-duration-slow,.2s) var(--ds-ease-in-out,ease)}.lbs-files-page{height:100%;min-height:0;overflow:hidden}.lbs-files-page .lbs-files-list{min-height:0;overflow:hidden}.lbs-files-page .lbs-file-tree{box-sizing:border-box;min-height:0;overflow:auto;padding-bottom:18px;scrollbar-gutter:stable}.lbs-tree-icon svg,.lbs-editor-file-icon svg,.lbs-files-actions svg{display:block}.lbs-tree-icon[data-kind=folder]{color:var(--dsw-alias-state-warn-primary,#d6a84b)}.lbs-tree-icon[data-kind=javascript]{color:#d6b94c}.lbs-tree-icon[data-kind=typescript]{color:#4d91d8}.lbs-tree-icon[data-kind=json]{color:#a487d4}.lbs-tree-icon[data-kind=markdown]{color:#5a91d8}.lbs-tree-icon[data-kind=image]{color:#54a779}.lbs-tree-icon[data-kind=html]{color:#d87955}.lbs-tree-icon[data-kind=css]{color:#7a7ed8}.lbs-tree-icon[data-kind=python]{color:#5f92bc}.lbs-tree-icon[data-kind=config]{color:#8c919a}.lbs-tree-icon[data-kind=binary]{color:#b07b9f}.lbs-tree-icon[data-kind=text]{color:var(--dsw-alias-label-secondary)}.lbs-editor-file-icon{align-items:center;display:inline-flex}.lbs-files-actions button{align-items:center;display:flex;gap:4px}.lbs-files-actions button svg{height:14px;width:14px}@media(max-width:850px){.lbs-workbench[data-tool=files],.lbs-workbench[data-tool=git]{left:var(--lbs-files-sidebar-offset,56px);right:var(--lbs-right-column,56px)}}@media(max-width:560px){.lbs-files-actions button:before{content:none!important}.lbs-files-actions button svg{height:15px;width:15px}}
      .lbs-code-editor-host{background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base));flex:1;min-height:0;min-width:0;overflow:hidden}.lbs-code-editor-host .cm-editor{height:100%}.lbs-code-editor-host .cm-scroller{font-variant-ligatures:none;overflow:auto}.lbs-markdown-mode{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border-radius:6px;display:flex;padding:2px}.lbs-markdown-mode button{appearance:none;background:transparent;border:0;border-radius:4px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:10px;height:25px;padding:0 8px}.lbs-markdown-mode button[data-active=true]{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}.lbs-markdown-preview{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:38px clamp(26px,6vw,76px) 72px}.lbs-markdown-document{font-size:14px;line-height:1.75;margin:0 auto;max-width:860px;min-width:0;width:100%}.lbs-markdown-document>:first-child{margin-top:0}.lbs-markdown-document>:last-child{margin-bottom:0}.lbs-unsupported-preview{box-sizing:border-box;flex:1;flex-direction:column;gap:9px;min-height:0;padding:36px;width:100%}.lbs-unsupported-preview svg{color:var(--dsw-alias-label-tertiary)}.lbs-unsupported-preview strong{color:var(--dsw-alias-label-primary);font-size:14px}.lbs-unsupported-preview p{font-size:11px;line-height:1.6;margin:0;max-width:430px}.lbs-open-default{align-items:center;background:var(--dsw-alias-interactive-bg-hover-solid);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);cursor:pointer;display:flex;font:inherit;font-size:11px;gap:6px;height:32px;margin-top:5px;padding:0 11px}.lbs-open-default:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-open-default svg{color:inherit}
      .lbs-turn-changes{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;margin-top:10px;overflow:hidden}
      .lbs-turn-changes-summary{align-items:center;color:var(--dsw-alias-label-primary);display:flex;gap:10px;min-height:56px;padding:6px 10px}
      .lbs-turn-changes-icon{align-items:center;background:var(--dsw-alias-bg-base);border-radius:8px;color:var(--dsw-alias-label-secondary);display:flex;flex:none;height:36px;justify-content:center;width:36px}
      .lbs-turn-changes-heading{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}.lbs-turn-changes-title{font-size:14px;font-weight:600;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lbs-turn-changes-stats,.lbs-turn-changes-file-stats{display:flex;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;gap:7px;line-height:17px;white-space:nowrap}.lbs-turn-changes-add{color:var(--dsw-alias-state-success-primary)}.lbs-turn-changes-delete{color:var(--dsw-alias-state-error-primary)}
      .lbs-turn-changes-toggle{align-items:center;appearance:none;background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;flex:none;font:inherit;gap:5px;height:28px;padding:0 8px}.lbs-turn-changes-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-turn-changes-toggle:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3);outline:none}.lbs-turn-changes-action{font-size:11px;white-space:nowrap}.lbs-turn-changes-chevron{display:flex;transition:transform var(--ds-transition-duration-fast,.12s) ease}.lbs-turn-changes-toggle[aria-expanded=true] .lbs-turn-changes-chevron{transform:rotate(90deg)}
      .lbs-turn-changes-files{border-top:1px solid var(--dsw-alias-border-l1);display:grid;padding:3px 8px}.lbs-turn-changes-file{align-items:center;appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);cursor:pointer;display:grid;font:inherit;gap:12px;grid-template-columns:minmax(0,1fr) auto;min-height:32px;padding:2px 6px;text-align:left}.lbs-turn-changes-file:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-turn-changes-path{color:var(--dsw-alias-label-secondary);font:12px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-turn-changes-state{color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap}.lbs-turn-changes-note{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;padding:3px 6px 5px}
      @media(max-width:560px){.lbs-turn-changes-summary{min-height:52px;padding:5px 8px}.lbs-turn-changes-icon{height:34px;width:34px}.lbs-turn-changes-action{display:none}.lbs-turn-changes-toggle{justify-content:center;padding:0;width:29px}.lbs-turn-changes-files{padding:2px 4px}.lbs-turn-changes-file{min-height:30px}.lbs-turn-changes-path{font-size:11px}}
      .lbs-workbench[data-open=false]{pointer-events:none!important;visibility:hidden!important}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-workspace-tools"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-workspace-tools";
      style.textContent = css;
      document.head.append(style);
    }

    const bridge = () => window.laobosDesktop;
    const conversationGitSummaryCache = new Map();
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
      const workspaces = module.ctx?.workspaces?.list?.getSnapshot?.();
      const cwd = resolveWorkspaceRoot(sessions, workspaces) || undefined;
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

    function openGitDetails({ root, path, side, source }) {
      window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", {
        detail: { tool: "git", cwd: root, mode: "full", path, side, source },
      }));
    }

    function loadConversationGitSummary(root, paths, { force = false } = {}) {
      const key = `${root}\0${paths.join("\0")}`;
      const cached = conversationGitSummaryCache.get(key);
      if (!force && cached?.expiresAt > Date.now()) return cached.promise;
      const promise = bridge().git.summary({ root, paths });
      conversationGitSummaryCache.set(key, { expiresAt: Date.now() + 5_000, promise });
      promise.catch(() => {
        if (conversationGitSummaryCache.get(key)?.promise === promise) conversationGitSummaryCache.delete(key);
      });
      if (conversationGitSummaryCache.size > 100) conversationGitSummaryCache.delete(conversationGitSummaryCache.keys().next().value);
      return promise;
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

    function useSessionWorkspaceRoot(sessionId) {
      const readRoot = useCallback(() => resolveWorkspaceRoot(
        module.ctx?.sessions?.list?.getSnapshot?.(),
        module.ctx?.workspaces?.list?.getSnapshot?.(),
        sessionId,
      ), [sessionId]);
      const [root, setRoot] = useState(readRoot);
      useEffect(() => {
        const refresh = () => setRoot((current) => {
          const next = readRoot();
          return current === next ? current : next;
        });
        const stopSessions = module.ctx?.sessions?.list?.subscribe?.(refresh);
        const stopWorkspaces = module.ctx?.workspaces?.list?.subscribe?.(refresh);
        refresh();
        return () => {
          stopSessions?.();
          stopWorkspaces?.();
        };
      }, [readRoot]);
      return root;
    }

    function useSessionCwd(sessionId) {
      const readCwd = useCallback(() => {
        const snapshot = module.ctx?.sessions?.list?.getSnapshot?.();
        const resolvedSessionId = sessionId || snapshot?.current;
        return resolvedSessionId ? snapshot?.byId?.[resolvedSessionId]?.cwd || "" : "";
      }, [sessionId]);
      const [cwd, setCwd] = useState(readCwd);
      useEffect(() => {
        const refresh = () => setCwd((current) => {
          const next = readCwd();
          return current === next ? current : next;
        });
        const stop = module.ctx?.sessions?.list?.subscribe?.(refresh);
        refresh();
        return () => stop?.();
      }, [readCwd]);
      return cwd;
    }

    const comparableWorkspacePath = (root, value) => {
      const normalized = String(value || "").replaceAll("\\", "/").replace(/^\.\//u, "");
      return pathSeparator(root) === "\\" ? normalized.toLowerCase() : normalized;
    };

    function ConversationChangesCard({ matched, sessionId }) {
      const root = useSessionWorkspaceRoot(sessionId);
      const sessionCwd = useSessionCwd(sessionId);
      const pathKey = matched.paths.join("\0");
      const displayEntries = useMemo(() => pathKey.split("\0").map((original) => {
        const absolute = absoluteWorkspacePath(sessionCwd || root, original);
        return { original, path: relativeWorkspacePath(root, absolute) };
      }), [pathKey, root, sessionCwd]);
      const gitEntries = useMemo(() => {
        const seen = new Set();
        return displayEntries.filter((entry) => {
          const key = comparableWorkspacePath(root, entry.path);
          if (!entry.path || entry.path === "." || absolutePathPattern.test(entry.path) || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }, [displayEntries, root]);
      const [expanded, setExpanded] = useState(false);
      const [summary, setSummary] = useState(null);
      const [summaryError, setSummaryError] = useState("");
      const requestRef = useRef(0);
      const refresh = useCallback(async (force = false) => {
        const git = bridge()?.git;
        if (!root || !bridge()?.capabilities?.gitReview || typeof git?.summary !== "function" || gitEntries.length === 0) {
          setSummary(null); setSummaryError("");
          return;
        }
        const request = ++requestRef.current;
        try {
          const next = await loadConversationGitSummary(root, gitEntries.slice(0, 200).map((entry) => entry.path), { force });
          if (request === requestRef.current) { setSummary(next); setSummaryError(""); }
        } catch (reason) {
          if (request === requestRef.current) { setSummary(null); setSummaryError(messageOf(reason)); }
        }
      }, [gitEntries, root]);
      useEffect(() => {
        void refresh();
        return () => { requestRef.current += 1; };
      }, [refresh]);

      const changedByPath = useMemo(() => new Map((summary?.files || []).map((file) => [comparableWorkspacePath(root, file.path), file])), [root, summary]);
      const hasCompleteGitStats = !summary?.stale && Boolean(summary?.files?.length) && summary.files.every((file) => file.statsAvailable !== false);
      const turnStats = matched.stats;
      const turnStatsByPath = useMemo(() => new Map((turnStats?.files || []).map((file) => [comparableWorkspacePath(root, file.path), file])), [root, turnStats]);
      const visibleStats = turnStats ?? (hasCompleteGitStats ? { additions: summary.additions, deletions: summary.deletions } : null);
      const hasBinary = !turnStats && Boolean(summary?.files?.some((file) => file.binary));
      const statsTitle = !turnStats ? "这些文件当前未提交的 Git 差异" : "本轮 Edit/Write 操作累计修改的代码行";
      const stateLabel = (file) => file?.conflict ? "有冲突" : file?.untracked ? "未跟踪" : file?.staged && file?.unstaged ? "已暂存并修改" : file?.staged ? "已暂存" : file?.unstaged ? "已修改" : "已编辑";
      const openEntry = (entry) => {
        const file = changedByPath.get(comparableWorkspacePath(root, entry.path));
        openGitDetails({ root: root || sessionCwd, path: file?.path || entry.path, side: file?.side, source: "conversation-changes" });
      };
      return <section className="lbs-turn-changes" data-laobos-conversation-changes>
        <div className="lbs-turn-changes-summary">
          <span className="lbs-turn-changes-icon"><HubGlyph name="changes" size={21} /></span>
          <span className="lbs-turn-changes-heading">
            <span className="lbs-turn-changes-title">已编辑 {matched.paths.length} 个文件</span>
            {visibleStats ? <span className="lbs-turn-changes-stats" title={statsTitle}><span className="lbs-turn-changes-add">+{visibleStats.additions}</span><span className="lbs-turn-changes-delete">-{visibleStats.deletions}</span>{hasBinary ? <span>二进制</span> : null}</span> : null}
          </span>
          <button type="button" className="lbs-turn-changes-toggle" aria-expanded={expanded} title={expanded ? "收起文件列表" : "查看本轮编辑的文件"} onClick={(event) => { setExpanded((value) => !value); if (!expanded && event.isTrusted) void refresh(true); }}>
            <span className="lbs-turn-changes-action">{expanded ? "收起" : "查看更改"}</span>
            <span className="lbs-turn-changes-chevron"><HubGlyph name="disclosure" size={13} /></span>
          </button>
        </div>
        {expanded ? <div className="lbs-turn-changes-files">{displayEntries.map((entry) => {
          const file = changedByPath.get(comparableWorkspacePath(root, entry.path));
          const historicalStats = turnStatsByPath.get(comparableWorkspacePath(root, entry.original));
          const fileStats = historicalStats ?? (!summary?.stale && file?.statsAvailable !== false && Number.isInteger(file?.additions) && Number.isInteger(file?.deletions) ? file : null);
          return <button type="button" className="lbs-turn-changes-file" key={entry.original} title={`${entry.original} · 进入版本中心审查`} onClick={() => openEntry(entry)}><span className="lbs-turn-changes-path">{entry.path}</span>{fileStats ? <span className="lbs-turn-changes-file-stats"><span className="lbs-turn-changes-add">+{fileStats.additions}</span><span className="lbs-turn-changes-delete">-{fileStats.deletions}</span>{fileStats.binary ? <span className="lbs-turn-changes-state">二进制</span> : null}</span> : <span className="lbs-turn-changes-state">{stateLabel(file)}</span>}</button>;
        })}{summaryError || summary?.stale ? <div className="lbs-turn-changes-note">当前 Git 差异暂不可用，仍可进入版本中心审查。</div> : null}</div> : null}
      </section>;
    }

    function CodeTokens({ value, language }) {
      return tokenizeCodeLine(value, language).map((token, index) => <span className={`lbs-token-${token.type}`} key={`${index}:${token.value}`}>{token.value}</span>);
    }

    const editorHighlightStyle = HighlightStyle.define([
      { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.modifier], color: "var(--lbs-code-keyword)" },
      { tag: [tags.string, tags.character, tags.attributeValue, tags.regexp], color: "var(--lbs-code-string)" },
      { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--lbs-code-number)" },
      { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "var(--lbs-code-comment)", fontStyle: "italic" },
      { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], color: "var(--lbs-code-type)" },
      { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.variableName)], color: "var(--lbs-code-function)" },
      { tag: [tags.operator, tags.punctuation, tags.bracket], color: "var(--dsw-alias-label-secondary)" },
      { tag: [tags.heading, tags.strong], color: "var(--lbs-code-keyword)", fontWeight: "650" },
      { tag: [tags.link, tags.url], color: "var(--lbs-code-number)", textDecoration: "underline" },
      { tag: tags.invalid, color: "var(--dsw-alias-state-error-primary,#d94b4b)", textDecoration: "underline wavy" },
    ]);

    const editorTheme = EditorView.theme({
      "&": { backgroundColor: "var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base))", color: "var(--dsw-alias-label-primary)", height: "100%" },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": { fontFamily: "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace", fontSize: "12px", lineHeight: "1.58", fontVariantLigatures: "none", tabSize: "2" },
      ".cm-content": { caretColor: "var(--dsw-alias-label-primary)", padding: "16px 0 40px" },
      ".cm-line": { padding: "0 18px" },
      ".cm-cursor,.cm-dropCursor": { borderLeftColor: "var(--dsw-alias-label-primary)" },
      ".cm-selectionBackground,.cm-content ::selection": { backgroundColor: "color-mix(in srgb,var(--dsw-alias-state-business-primary) 28%,transparent)!important" },
      ".cm-activeLine": { backgroundColor: "color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent)" },
      ".cm-gutters": { backgroundColor: "var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-base))", borderRight: "1px solid var(--dsw-alias-border-l1)", color: "var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))" },
      ".cm-lineNumbers .cm-gutterElement": { minWidth: "42px", padding: "0 10px 0 6px" },
    });

    function codeMirrorLanguage(path) {
      const language = languageForPath(path);
      const extension = String(path || "").split(/[\\/]/u).at(-1)?.split(".").at(-1)?.toLowerCase() || "";
      if (language === "javascript") return javascript({ jsx: ["jsx", "tsx"].includes(extension), typescript: ["ts", "tsx", "mts", "cts"].includes(extension) });
      if (language === "python") return pythonLanguage();
      if (language === "json") return jsonLanguage();
      if (language === "css") return cssLanguage();
      if (language === "markup") return htmlLanguage();
      if (language === "markdown") return markdownLanguage();
      return [];
    }

    function CodeEditor({ path, value, onChange, onSave }) {
      const hostRef = useRef(null);
      const viewRef = useRef(null);
      const valueRef = useRef(value);
      const onChangeRef = useRef(onChange);
      const onSaveRef = useRef(onSave);
      valueRef.current = value;
      onChangeRef.current = onChange;
      onSaveRef.current = onSave;

      useEffect(() => {
        if (!hostRef.current) return undefined;
        const saveKey = { key: "Mod-s", preventDefault: true, run: () => { void onSaveRef.current?.(); return true; } };
        const state = EditorState.create({
          doc: valueRef.current,
          extensions: [
            lineNumbers(),
            highlightSpecialChars(),
            history(),
            drawSelection(),
            indentOnInput(),
            bracketMatching(),
            highlightActiveLine(),
            syntaxHighlighting(editorHighlightStyle),
            codeMirrorLanguage(path),
            editorTheme,
            EditorView.contentAttributes.of({ "aria-label": `${path} 代码编辑器`, autocapitalize: "off", autocomplete: "off", autocorrect: "off", spellcheck: "false" }),
            EditorView.updateListener.of((update) => { if (update.docChanged) onChangeRef.current(update.state.doc.toString()); }),
            keymap.of([saveKey, indentWithTab, ...defaultKeymap, ...historyKeymap]),
          ],
        });
        const view = new EditorView({ state, parent: hostRef.current });
        viewRef.current = view;
        const focusFrame = window.requestAnimationFrame(() => view.focus());
        return () => { window.cancelAnimationFrame(focusFrame); viewRef.current = null; view.destroy(); };
      }, [path]);

      useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      }, [path, value]);

      return <div className="lbs-code-editor-host" ref={hostRef} />;
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

    function Dialog({ title, onClose, footer, children }) {
      return <div className="lbs-wb-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="lbs-wb-dialog" role="dialog" aria-modal="true" aria-label={title}>
          <header><h2>{title}</h2><button className="lbs-wb-button" aria-label="关闭" onClick={onClose}>×</button></header>
          <div className="lbs-wb-dialog-body">{children}</div>
          {footer ? <footer>{footer}</footer> : null}
        </section>
      </div>;
    }

    function fileIconKind(path = "", type = "file") {
      if (type === "directory") return "folder";
      const name = path.split(/[\\/]/u).at(-1)?.toLowerCase() || "";
      const extension = name.includes(".") ? name.split(".").at(-1) : "";
      if (["js", "jsx", "mjs", "cjs"].includes(extension)) return "javascript";
      if (["ts", "tsx", "mts", "cts"].includes(extension)) return "typescript";
      if (["json", "jsonc"].includes(extension)) return "json";
      if (["md", "mdx"].includes(extension)) return "markdown";
      if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"].includes(extension)) return "image";
      if (["html", "htm", "vue", "svelte"].includes(extension)) return "html";
      if (["css", "scss", "sass", "less"].includes(extension)) return "css";
      if (["py", "pyw"].includes(extension)) return "python";
      if (["zip", "gz", "tgz", "7z", "rar", "pdf", "docx", "xlsx", "pptx"].includes(extension)) return "binary";
      if (name.startsWith(".") || ["yaml", "yml", "toml", "ini", "conf", "lock"].includes(extension)) return "config";
      return isCodePath(path) ? "code" : "text";
    }

    function FileIcon({ path = "", type = "file", expanded = false, size = 16 }) {
      const kind = fileIconKind(path, type);
      const props = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
      if (kind === "folder") return <svg {...props}><path d={expanded ? "M1.75 5.25h4.4l1.3 1.45h6.8l-1.45 6.05H2.55z" : "M1.75 3.5h4.4l1.3 1.55h6.8v7.7H1.75z"} /><path d="M1.75 5.25h12.5" /></svg>;
      const detail = kind === "image" ? <><circle cx="7" cy="7.2" r="1" /><path d="m5.25 11 1.8-1.8 1.35 1.25 1.2-1.2 1.4 1.75" /></>
        : kind === "json" ? <><path d="M7 6.3c-.8 0-.9.5-.9 1.2v1c0 .7-.1 1.2-.9 1.2M10 6.3c.8 0 .9.5.9 1.2v1c0 .7.1 1.2.9 1.2" /></>
        : ["javascript", "typescript", "html", "css", "python", "code"].includes(kind) ? <><path d="m7.1 7-1.6 1.5L7.1 10M9.4 7l1.6 1.5L9.4 10" /></>
        : kind === "markdown" ? <><path d="M5.4 10V7.2l1.25 1.4 1.25-1.4V10M9.4 7.2v2.8m-1-1 1 1 1-1" /></>
        : kind === "config" ? <><path d="M5.4 7h5.2M5.4 9.2h5.2M7 6v2M9.2 8.2v2" /></>
        : kind === "binary" ? <><path d="M5.5 7.2h5M5.5 9.2h5M5.5 11.2h3" /></>
        : <><path d="M5.5 7.2h5M5.5 9.2h5M5.5 11.2h3" /></>;
      return <svg {...props}><path d="M3.25 1.75h6l3.5 3.5v9H3.25z" /><path d="M9.25 1.75v3.5h3.5" />{detail}</svg>;
    }

    function FileActionIcon({ name }) {
      const props = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
      if (name === "new-file") return <svg {...props}><path d="M3.25 1.75h6l3.5 3.5v9H3.25zM9.25 1.75v3.5h3.5M8 7.5v4M6 9.5h4" /></svg>;
      if (name === "new-folder") return <svg {...props}><path d="M1.75 4h4l1.2 1.35h7.3v7.4H1.75zM8 7v4M6 9h4" /></svg>;
      if (name === "open") return <svg {...props}><path d="M6.25 2.5H3.5v10h9V9.75M8.5 2.5h5v5M13.25 2.75 7.5 8.5" /></svg>;
      return <svg {...props}><path d="M12.8 6A5 5 0 1 0 13 9.2M12.8 3.5V6h-2.5" /></svg>;
    }

    function FileTreeNode({ entry, depth, childrenByPath, expanded, loadingPaths, selected, onToggle, onSelect, onContextMenu }) {
      const isDirectory = entry.type === "directory";
      const isExpanded = isDirectory && expanded.has(entry.path);
      const children = childrenByPath[entry.path] || [];
      return <div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined} aria-selected={!isDirectory && selected === entry.path}>
        <div className="lbs-tree-row" data-active={selected === entry.path} data-code={!isDirectory && isCodePath(entry.path)} data-type={entry.type} onContextMenu={(event) => onContextMenu(event, entry)} style={{ paddingLeft: 8 + depth * 16 }}>
          {isDirectory ? <button type="button" className="lbs-tree-toggle" onClick={() => onToggle(entry)} title={entry.path}>
            <span className="lbs-tree-chevron">{loadingPaths.has(entry.path) ? <span className="lbs-tree-loading">◌</span> : isExpanded ? "▾" : "▸"}</span>
            <span className="lbs-tree-icon" data-kind="folder"><FileIcon path={entry.path} type="directory" expanded={isExpanded} /></span><span className="lbs-tree-name">{entry.name}</span>
          </button> : <button type="button" className="lbs-tree-file" onClick={() => onSelect(entry)} title={entry.path}>
            <span className="lbs-tree-chevron" /><span className="lbs-tree-icon" data-kind={fileIconKind(entry.path)}><FileIcon path={entry.path} /></span><span className="lbs-tree-name">{entry.name}</span>
          </button>}
          {!isDirectory ? <span className="lbs-tree-size">{formatSize(entry.size)}</span> : null}
        </div>
        {isExpanded ? <div role="group">{children.map((child) => <FileTreeNode key={child.path} entry={child} depth={depth + 1} childrenByPath={childrenByPath} expanded={expanded} loadingPaths={loadingPaths} selected={selected} onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu} />)}</div> : null}
      </div>;
    }

    function Preview({ selected, value, draft, dirty, saving, onDraftChange, onSave, onReveal, onOpenDefault }) {
      const [markdownMode, setMarkdownMode] = useState("preview");
      const source = useMemo(() => {
        if (!value?.base64) return "";
        const binary = atob(value.base64); const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return URL.createObjectURL(new Blob([bytes], { type: value.mediaType }));
      }, [value]);
      useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
      useEffect(() => { setMarkdownMode("preview"); }, [selected]);
      if (!selected) return <div className="lbs-preview-empty">从左侧选择一个文件</div>;
      const fileName = selected.split(/[\\/]/u).filter(Boolean).at(-1) || selected;
      const markdown = languageForPath(selected) === "markdown";
      const handleEditorKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault(); void onSave(); return;
        }
        if (event.key !== "Tab") return;
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart; const end = input.selectionEnd;
        const indentation = "  ";
        onDraftChange(`${draft.slice(0, start)}${indentation}${draft.slice(end)}`);
        window.requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + indentation.length; });
      };
      return <div className="lbs-file-editor">
        <div className="lbs-preview-title"><span className="lbs-editor-file-icon" data-kind={fileIconKind(selected)}><FileIcon path={selected} /></span><strong title={selected}>{fileName}</strong>{dirty ? <span className="lbs-editor-dirty">未保存</span> : value ? <span className="lbs-file-size">{formatSize(value.size)}</span> : null}<div className="lbs-preview-actions">
          {value?.kind === "text" && markdown ? <div className="lbs-markdown-mode" role="group" aria-label="Markdown 显示方式"><button type="button" data-active={markdownMode === "preview"} onClick={() => setMarkdownMode("preview")}>阅读</button><button type="button" data-active={markdownMode === "source"} onClick={() => setMarkdownMode("source")}>源码</button></div> : null}
          {value?.kind === "text" ? <button className="lbs-wb-button primary" disabled={!dirty || saving} onClick={() => void onSave()}>{saving ? "正在保存…" : "保存"}</button> : null}
          <button className="lbs-wb-button" onClick={onReveal}>所在位置</button>
        </div></div>
        <div className="lbs-editor-path" title={selected}>{selected}</div>
        <div className="lbs-preview-content">{!value ? <div className="lbs-preview-empty">正在读取…</div>
          : value.kind === "text" && markdown && markdownMode === "preview" ? <div className="lbs-markdown-preview"><article className="lbs-markdown-document"><Primitives.MarkdownText text={draft} /></article></div>
          : value.kind === "text" && isCodePath(selected) ? <CodeEditor path={selected} value={draft} onChange={onDraftChange} onSave={onSave} />
          : value.kind === "text" ? <textarea className="lbs-preview-editor" aria-label={`${selected} 文本编辑器`} autoFocus spellCheck={false} value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={handleEditorKeyDown} />
          : value.kind === "image" ? <img src={source} alt={selected} />
          : value.kind === "pdf" ? <iframe src={source} title={selected} />
          : value.kind === "media" && value.mediaType.startsWith("audio/") ? <audio src={source} controls />
          : value.kind === "media" ? <video src={source} controls />
          : <div className="lbs-preview-empty lbs-unsupported-preview"><FileIcon path={selected} size={38} /><strong>暂不支持在应用内预览</strong><p>可以使用系统为该文件类型配置的默认应用打开。</p><button type="button" className="lbs-open-default" onClick={onOpenDefault}><FileActionIcon name="open" />使用系统默认方式打开</button></div>}</div>
      </div>;
    }

    function FilesPage({ requestedRoot, requestedPath, onDirtyChange }) {
      const desktop = useDesktopContext();
      const currentWorkspaceRoot = useSessionWorkspaceRoot();
      const root = requestedRoot || currentWorkspaceRoot || desktop.context?.root;
      const [childrenByPath, setChildrenByPath] = useState({});
      const [expanded, setExpanded] = useState(() => new Set(["."]));
      const [loadingPaths, setLoadingPaths] = useState(() => new Set());
      const [selected, setSelected] = useState("");
      const [preview, setPreview] = useState(null);
      const [error, setError] = useState("");
      const [menu, setMenu] = useState(null);
      const [dialog, setDialog] = useState(null);
      const [draft, setDraft] = useState("");
      const [saving, setSaving] = useState(false);
      const dirty = preview?.kind === "text" && draft !== preview.content;
      useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
      useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
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
      const openEntry = useCallback(async (entry) => {
        setSelected(entry.path); setPreview(null); setDraft(""); setError("");
        try {
          const value = await bridge().workspace.read({ root, path: entry.path });
          setPreview(value); setDraft(value.kind === "text" ? value.content : "");
        }
        catch (reason) { setError(messageOf(reason)); }
      }, [root]);
      const initialize = useCallback(async (target = "") => {
        setChildrenByPath({}); setExpanded(new Set(["."])); setSelected(""); setPreview(null); setDraft(""); setMenu(null); setDialog(null);
        if (!root) return;
        const relative = target ? relativeWorkspacePath(root, target) : ".";
        const parts = relative.split(/[\\/]/u).filter((part) => part && part !== ".");
        const separator = pathSeparator(root);
        const directories = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(separator));
        const openDirectories = [".", ...directories];
        setExpanded(new Set(openDirectories));
        await Promise.all(openDirectories.map((directory) => loadDirectory(directory)));
        if (parts.length > 0) await openEntry({ path: parts.join(separator), type: "file" });
      }, [loadDirectory, openEntry, root]);
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
      const choose = (entry) => {
        if (entry.path === selected) return;
        if (dirty) { setDialog({ type: "switch", entry }); return; }
        void openEntry(entry);
      };
      const save = async () => {
        if (!selected || preview?.kind !== "text" || saving) return false;
        setSaving(true); setError("");
        try {
          const result = await bridge().workspace.write({ root, path: selected, content: draft, expectedModifiedAt: preview.modifiedAt });
          setPreview((current) => ({ ...current, content: draft, size: result.size, modifiedAt: result.modifiedAt }));
          await loadDirectory(parentWorkspacePath(selected));
          return true;
        } catch (reason) { setError(messageOf(reason)); }
        finally { setSaving(false); }
        return false;
      };
      const refresh = async () => Promise.all([...expanded].map((value) => loadDirectory(value)));
      const openMenu = (event, entry) => {
        event.preventDefault(); event.stopPropagation();
        setMenu({ entry, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 208)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 280)) });
      };
      const menuAction = (task) => async (event) => {
        event.preventDefault(); event.stopPropagation(); setMenu(null); setError("");
        try { await task(); } catch (reason) { setError(messageOf(reason)); }
      };
      const selectionAffectedBy = (entry) => {
        if (!selected) return false;
        if (selected === entry.path) return true;
        const separator = pathSeparator(root);
        return entry.type === "directory" && selected.startsWith(`${entry.path}${separator}`);
      };
      const createEntry = (type, parent = ".") => setDialog({ type: "create", entryType: type, parent, value: "" });
      const renameEntry = (entry) => {
        if (dirty && selectionAffectedBy(entry)) { setError("请先保存当前文件，再重命名它或所在文件夹。"); return; }
        setDialog({ type: "rename", entry, value: entry.name });
      };
      const removeEntry = (entry) => setDialog({ type: "delete", entry });
      const performCreate = async (type, parent, name) => {
        const result = await bridge().workspace.create({ root, parent, name, type });
        setExpanded((current) => new Set(current).add(parent));
        await loadDirectory(parent);
        if (type === "file") choose(result);
      };
      const performRename = async (entry, name) => {
        const result = await bridge().workspace.rename({ root, path: entry.path, name });
        if (entry.type === "directory") {
          if (selectionAffectedBy(entry)) {
            const nextSelected = `${result.path}${selected.slice(entry.path.length)}`;
            await initialize(nextSelected);
            return;
          }
          const separator = pathSeparator(root);
          setExpanded((current) => new Set([...current].filter((item) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
          setChildrenByPath((current) => Object.fromEntries(Object.entries(current).filter(([item]) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
          await loadDirectory(parentWorkspacePath(entry.path));
          return;
        }
        await loadDirectory(parentWorkspacePath(entry.path));
        if (selected === entry.path) setSelected(result.path);
      };
      const performRemove = async (entry) => {
        await bridge().workspace.remove({ root, path: entry.path });
        const separator = pathSeparator(root);
        if (selected === entry.path || selected.startsWith(`${entry.path}${separator}`)) {
          setSelected(""); setPreview(null); setDraft("");
        }
        setExpanded((current) => new Set([...current].filter((item) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
        setChildrenByPath((current) => Object.fromEntries(Object.entries(current).filter(([item]) => item !== entry.path && !item.startsWith(`${entry.path}${separator}`))));
        await loadDirectory(parentWorkspacePath(entry.path));
      };
      const submitDialog = async () => {
        if (!dialog || dialog.type === "switch") return;
        if (dialog.type === "delete") {
          const entry = dialog.entry;
          setDialog(null); setError("");
          try { await performRemove(entry); } catch (reason) { setError(messageOf(reason)); }
          return;
        }
        const name = dialog.value.trim();
        if (!name || (dialog.type === "rename" && name === dialog.entry.name)) { setDialog(null); return; }
        const currentDialog = dialog;
        setDialog(null); setError("");
        try {
          if (currentDialog.type === "create") await performCreate(currentDialog.entryType, currentDialog.parent, name);
          else await performRename(currentDialog.entry, name);
        } catch (reason) { setError(messageOf(reason)); }
      };
      const discardAndSwitch = async () => {
        const entry = dialog?.entry; setDialog(null);
        if (entry) await openEntry(entry);
      };
      const saveAndSwitch = async () => {
        const entry = dialog?.entry;
        if (entry && await save()) { setDialog(null); await openEntry(entry); }
      };
      const revealSelected = async () => {
        try { await bridge().workspace.reveal({ root, path: selected }); }
        catch (reason) { setError(messageOf(reason)); }
      };
      const openSelectedDefault = async () => {
        try { await bridge().workspace.open({ root, path: selected }); }
        catch (reason) { setError(messageOf(reason)); }
      };
      const rootName = String(root || "项目").split(/[\\/]/u).filter(Boolean).at(-1) || String(root || "项目");
      if (!bridge()?.capabilities?.workspaceFiles) return <div className="lbs-preview-empty">文件工作台仅在桌面版中可用。</div>;
      return <div className="lbs-workbench-body lbs-files-page">
        <section className="lbs-files-list">
          <div className="lbs-files-toolbar"><strong className="lbs-files-project" title={root}>{rootName}</strong><div className="lbs-files-actions"><button type="button" title="新建文件" disabled={!root} onClick={() => createEntry("file")}><FileActionIcon name="new-file" />文件</button><button type="button" title="新建文件夹" disabled={!root} onClick={() => createEntry("directory")}><FileActionIcon name="new-folder" />文件夹</button><button type="button" title="刷新目录" disabled={!root} onClick={() => void refresh()}><FileActionIcon name="refresh" /></button></div></div>
          {error || desktop.error ? <div className="lbs-wb-error">{error || desktop.error}</div> : null}
          <div className="lbs-file-tree" role="tree" aria-label="项目文件目录树">
            <div className="lbs-file-root-row"><span className="lbs-tree-chevron">▾</span><span className="lbs-tree-icon" data-kind="folder"><FileIcon path={rootName} type="directory" expanded /></span><span className="lbs-tree-name">{rootName}</span></div>
            <div role="group">{(childrenByPath["."] || []).map((entry) => <FileTreeNode key={entry.path} entry={entry} depth={0} childrenByPath={childrenByPath} expanded={expanded} loadingPaths={loadingPaths} selected={selected} onToggle={toggleDirectory} onSelect={choose} onContextMenu={openMenu} />)}</div>
          </div>
        </section>
        <section className="lbs-preview"><Preview selected={selected} value={preview} draft={draft} dirty={dirty} saving={saving} onDraftChange={setDraft} onSave={save} onReveal={revealSelected} onOpenDefault={openSelectedDefault} /></section>
        {menu ? <div className="lbs-file-menu" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
          <button onClick={menuAction(() => menu.entry.type === "directory" ? toggleDirectory(menu.entry) : choose(menu.entry))}>{menu.entry.type === "directory" ? expanded.has(menu.entry.path) ? "折叠文件夹" : "展开文件夹" : "打开文件"}</button>
          {menu.entry.type === "directory" ? <><button onClick={menuAction(() => createEntry("file", menu.entry.path))}>新建文件…</button><button onClick={menuAction(() => createEntry("directory", menu.entry.path))}>新建文件夹…</button></> : null}
          {menu.entry.type === "file" ? <button onClick={menuAction(() => bridge().workspace.open({ root, path: menu.entry.path }))}>使用系统默认方式打开</button> : null}
          <button onClick={menuAction(() => bridge().workspace.reveal({ root, path: menu.entry.path }))}>打开所在位置</button>
          <button onClick={menuAction(() => renameEntry(menu.entry))}>重命名…</button>
          <div className="lbs-file-menu-separator" />
          <button className="danger" onClick={menuAction(() => removeEntry(menu.entry))}>删除…</button>
        </div> : null}
        {dialog ? <Dialog title={dialog.type === "switch" ? "当前文件尚未保存" : dialog.type === "create" ? `新建${dialog.entryType === "directory" ? "文件夹" : "文件"}` : dialog.type === "rename" ? `重命名${dialog.entry.type === "directory" ? "文件夹" : "文件"}` : `删除${dialog.entry.type === "directory" ? "文件夹" : "文件"}`} onClose={() => setDialog(null)} footer={dialog.type === "switch" ? <><button className="lbs-wb-button" onClick={() => setDialog(null)}>取消</button><button className="lbs-wb-button danger" onClick={() => void discardAndSwitch()}>不保存</button><button className="lbs-wb-button primary" disabled={saving} onClick={() => void saveAndSwitch()}>保存并切换</button></> : <><button className="lbs-wb-button" onClick={() => setDialog(null)}>取消</button><button className={dialog.type === "delete" ? "lbs-wb-button danger" : "lbs-wb-button primary"} onClick={() => void submitDialog()}>{dialog.type === "delete" ? "移到废纸篓" : "确定"}</button></>}>
          {dialog.type === "switch" ? <p>“{selected}”有未保存的修改。保存后再打开“{dialog.entry.path}”吗？</p>
            : dialog.type === "delete" ? <p>{`确定将${dialog.entry.type === "directory" ? `文件夹“${dialog.entry.name}”及其中内容` : `文件“${dialog.entry.name}”`}移到系统废纸篓吗？${dirty && selectionAffectedBy(dialog.entry) ? "\n当前未保存的修改也会丢失。" : ""}`}</p>
            : <label>{dialog.type === "create" ? dialog.entryType === "directory" ? "文件夹名称" : "文件名称" : dialog.entry.type === "directory" ? "文件夹名称" : "文件名称"}<input autoFocus value={dialog.value} placeholder={dialog.type === "create" && dialog.entryType === "file" ? "例如 notes.md" : ""} onChange={(event) => setDialog((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitDialog(); } }} /></label>}
        </Dialog> : null}
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

    function GitReviewTreeNode({ node, depth, expanded, selectedPath, onToggle, onSelect }) {
      const directory = node.type === "directory";
      const open = directory && expanded.has(node.treePath);
      return <div role="treeitem" aria-expanded={directory ? open : undefined} aria-selected={!directory && selectedPath === node.path}>
        <button type="button" className="lbs-git-tree-row" data-active={!directory && selectedPath === node.path} data-type={node.type} style={{ paddingLeft: 8 + depth * 15 }} title={node.path || node.treePath} onClick={() => directory ? onToggle(node.treePath) : onSelect(node)}>
          <span className="lbs-git-tree-chevron">{directory ? open ? "▾" : "▸" : ""}</span>
          <span className="lbs-git-tree-icon" data-kind={directory ? "folder" : fileIconKind(node.path)}><FileIcon path={node.path || node.treePath} type={directory ? "directory" : "file"} expanded={open} /></span>
          <span className="lbs-git-tree-name">{node.name}</span>
          {!directory && node.status ? <span className="lbs-git-tree-status" data-status={node.status}>{node.status}</span> : null}
        </button>
        {open ? <div role="group">{node.children.map((child) => <GitReviewTreeNode key={`${child.type}:${child.treePath}`} node={child} depth={depth + 1} expanded={expanded} selectedPath={selectedPath} onToggle={onToggle} onSelect={onSelect} />)}</div> : null}
      </div>;
    }

    function GitReviewFilesPane({ files, title, selectedPath, onSelect }) {
      const tree = useMemo(() => buildGitReviewTree(files), [files]);
      const treeKey = useMemo(() => files.map((file) => `${file.path}:${file.status || ""}`).join("\0"), [files]);
      const [expanded, setExpanded] = useState(() => new Set(gitReviewDirectoryPaths(tree)));
      useEffect(() => { setExpanded(new Set(gitReviewDirectoryPaths(tree))); }, [treeKey]);
      const toggle = (path) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      });
      return <aside className="lbs-git-files-pane">
        <div className="lbs-git-files-head"><strong>{title || "变更文件"}</strong><span>{files.length}</span></div>
        <div className="lbs-git-file-tree" role="tree" aria-label="版本变更文件目录树">
          {tree.length ? tree.map((node) => <GitReviewTreeNode key={`${node.type}:${node.treePath}`} node={node} depth={0} expanded={expanded} selectedPath={selectedPath} onToggle={toggle} onSelect={onSelect} />) : <div className="lbs-git-files-empty">当前分组没有文件</div>}
        </div>
      </aside>;
    }

    function GitPage({ requestedRoot, requestedPath, requestedSide }) {
      const desktop = useDesktopContext();
      const currentWorkspaceRoot = useSessionWorkspaceRoot();
      const root = requestedRoot || currentWorkspaceRoot || desktop.context?.root;
      const [state, setState] = useState(null);
      const [selection, setSelection] = useState(null);
      const [reviewGroup, setReviewGroup] = useState({ kind: "", title: "", files: [], side: "", ref: "" });
      const [diff, setDiff] = useState("");
      const [diffLoading, setDiffLoading] = useState(false);
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const [notice, setNotice] = useState("");
      const [busy, setBusy] = useState(false);
      const [dialog, setDialog] = useState(null);
      const [history, setHistory] = useState(null);
      const [historyEnd, setHistoryEnd] = useState(false);

      const changeFiles = useCallback((changes, side) => changes.map((change) => ({
        path: change.path,
        originalPath: change.originalPath,
        status: side === "staged" ? change.index === "?" ? "A" : change.index : change.worktree === "?" ? "U" : change.worktree,
        side: side === "staged" ? "staged" : change.untracked ? "untracked" : "unstaged",
      })), []);
      const loadReviewFile = useCallback(async (target) => {
        setSelection(target); setError(""); setDiffLoading(true);
        try {
          const result = await bridge().git.diff({ root, path: target.path, side: target.side, ...(target.ref ? { ref: target.ref } : {}) });
          setDiff(result.diff || "该文件没有可显示的文本差异。");
        } catch (reason) { setError(messageOf(reason)); }
        finally { setDiffLoading(false); }
      }, [root]);
      const showChange = useCallback((change, side, group = [change]) => {
        const files = changeFiles(group, side);
        setReviewGroup({ kind: "change", title: side === "staged" ? "已暂存" : "工作区变更", files, side, ref: "" });
        void loadReviewFile({ kind: "change", path: change.path, side });
      }, [changeFiles, loadReviewFile]);
      const showCommit = useCallback(async (commit, preferredPath = "") => {
        setReviewGroup({ kind: "commit", title: `提交 ${commit.shortHash || commit.hash.slice(0, 8)}`, files: [], side: "commit", ref: commit.hash });
        setSelection({ kind: "commit", ref: commit.hash, path: "", side: "commit" });
        setError(""); setDiffLoading(true);
        try {
          const result = await bridge().git.diff({ root, side: "commit", ref: commit.hash });
          const files = Array.isArray(result.files) ? result.files : [];
          setReviewGroup({ kind: "commit", title: `提交 ${commit.shortHash || commit.hash.slice(0, 8)}`, files, side: "commit", ref: commit.hash });
          const preferredKey = comparableWorkspacePath(root, preferredPath);
          const target = files.find((file) => comparableWorkspacePath(root, file.path) === preferredKey) || files[0];
          if (!target) {
            setDiff(result.diff || "该提交没有可显示的文本差异。");
            return;
          }
          setSelection({ kind: "commit", ref: commit.hash, path: target.path, side: "commit" });
          const fileResult = await bridge().git.diff({ root, side: "commit", ref: commit.hash, path: target.path });
          setDiff(fileResult.diff || "该文件没有可显示的文本差异。");
        } catch (reason) { setError(messageOf(reason)); }
        finally { setDiffLoading(false); }
      }, [root]);
      const chooseDefault = useCallback((next) => {
        const requestedKey = comparableWorkspacePath(root, requestedPath);
        const requested = requestedPath ? next.changes.find((change) => comparableWorkspacePath(root, change.path) === requestedKey) : null;
        if (requested) {
          const side = requestedSide || (requested.staged ? "staged" : requested.untracked ? "untracked" : "unstaged");
          const group = next.changes.filter((change) => side === "staged" ? change.staged : change.unstaged);
          showChange(requested, side, group);
          return;
        }
        const staged = next.changes.find((change) => change.staged);
        const unstaged = next.changes.find((change) => change.unstaged);
        if (staged) showChange(staged, "staged", next.changes.filter((change) => change.staged));
        else if (unstaged) showChange(unstaged, unstaged.untracked ? "untracked" : "unstaged", next.changes.filter((change) => change.unstaged));
        else if (next.commits[0]) void showCommit(next.commits[0], requestedPath);
        else { setSelection(null); setReviewGroup({ kind: "", title: "", files: [], side: "", ref: "" }); setDiff(""); }
      }, [requestedPath, requestedSide, root, showChange, showCommit]);
      const refresh = useCallback(async () => {
        if (!root) return;
        setBusy(true); setError("");
        try { const next = await bridge().git.inspect({ root }); setState(next); chooseDefault(next); }
        catch (reason) { setError(messageOf(reason)); }
        finally { setBusy(false); }
      }, [root, chooseDefault]);
      useEffect(() => { setState(null); setSelection(null); setReviewGroup({ kind: "", title: "", files: [], side: "", ref: "" }); setDiff(""); setDiffLoading(false); setHistory(null); setHistoryEnd(false); if (root) void refresh(); }, [root, refresh]);

      useEffect(() => { if (state) setHistory(state.commits); }, [state]);

      const update = async (task, success) => {
        setBusy(true); setError(""); setNotice("");
        try { const next = await task(); setState(next); setHistory(next.commits); setNotice(success); chooseDefault(next); return next; }
        catch (reason) { setError(messageOf(reason)); return null; }
        finally { setBusy(false); }
      };
      const stage = (change) => update(() => bridge().git.stage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已暂存 ${change.path}`);
      const unstage = (change) => update(() => bridge().git.unstage({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已取消暂存 ${change.path}`);
      const stageAll = (changes) => update(() => bridge().git.stage({ root, paths: changes.map((change) => change.path), expectedStatusToken: state.statusToken }), `已暂存 ${changes.length} 个文件`);
      const unstageAll = (changes) => update(() => bridge().git.unstage({ root, paths: changes.map((change) => change.path), expectedStatusToken: state.statusToken }), `已取消暂存 ${changes.length} 个文件`);
      const loadMoreHistory = async () => {
        if (!root || busy || !history?.length) return;
        setBusy(true); setError("");
        try {
          const nextLimit = history.length + 50;
          const result = await bridge().git.log({ root, limit: nextLimit });
          const commits = result.commits || [];
          setHistory(commits);
          setHistoryEnd(commits.length < nextLimit);
        } catch (reason) { setError(messageOf(reason)); }
        finally { setBusy(false); }
      };
      const restore = (change) => setDialog({ type: "restore", change });
      const commit = async () => {
        const value = message.trim(); if (!value) return;
        const next = await update(() => bridge().git.commit({ root, message: value, expectedHead: state.head, expectedStatusToken: state.statusToken }), "本地版本已提交");
        if (next) setMessage("");
      };
      const createBranch = () => setDialog({ type: "createBranch", value: "dsh/" });
      const switchBranch = (name) => update(() => bridge().git.branch({ root, action: "switch", name, expectedHead: state.head }), `已切换到 ${name}`);
      const deleteBranch = () => setDialog({ type: "deleteBranch", value: "" });
      const syncLabels = { fetch: "获取远端更新", pull: "快进拉取远端更新", push: "推送当前分支到远端" };
      const sync = (action) => {
        if (action !== "fetch") { setDialog({ type: "sync", action }); return; }
        void update(() => bridge().git.sync({ root, action, remote: state.remotes[0], expectedHead: state.head }), `${syncLabels[action]}完成`);
      };
      const submitDialog = () => {
        if (!dialog) return;
        if (dialog.type === "restore") {
          const change = dialog.change;
          setDialog(null);
          void update(() => bridge().git.restore({ root, paths: [change.path], expectedStatusToken: state.statusToken }), `已恢复 ${change.path}`);
          return;
        }
        if (dialog.type === "createBranch" || dialog.type === "deleteBranch") {
          const name = dialog.value.trim();
          setDialog(null);
          if (!name) return;
          if (dialog.type === "createBranch") void update(() => bridge().git.branch({ root, action: "create", name, expectedHead: state.head }), `已创建并切换到 ${name}`);
          else void update(() => bridge().git.branch({ root, action: "delete", name, expectedHead: state.head }), `已删除分支 ${name}`);
          return;
        }
        if (dialog.type === "sync") {
          const action = dialog.action;
          setDialog(null);
          void update(() => bridge().git.sync({ root, action, remote: state.remotes[0], expectedHead: state.head }), `${syncLabels[action]}完成`);
          return;
        }
        if (dialog.type === "init") {
          setDialog(null);
          void update(() => bridge().git.init({ root, branch: "main" }), "Git 版本管理已启用");
        }
      };
      const dialogNode = dialog ? <Dialog title={dialog.type === "restore" ? "放弃修改" : dialog.type === "createBranch" ? "新建分支" : dialog.type === "deleteBranch" ? "删除本地分支" : dialog.type === "sync" ? syncLabels[dialog.action] : "启用版本管理"} onClose={() => setDialog(null)} footer={<><button className="lbs-wb-button" onClick={() => setDialog(null)}>取消</button><button className={["restore", "deleteBranch", "sync", "init"].includes(dialog.type) ? "lbs-wb-button danger" : "lbs-wb-button primary"} onClick={submitDialog}>{dialog.type === "restore" ? "放弃修改" : dialog.type === "deleteBranch" ? "删除分支" : dialog.type === "sync" ? "继续" : dialog.type === "init" ? "启用" : "创建"}</button></>}>
        {dialog.type === "restore" ? <p>{`放弃“${dialog.change.path}”尚未暂存的修改？\n此操作不能直接撤销。`}</p> : null}
        {dialog.type === "createBranch" ? <label>分支名称<input autoFocus value={dialog.value} onChange={(event) => setDialog((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitDialog(); } }} /></label> : null}
        {dialog.type === "deleteBranch" ? <label>要删除的已合并本地分支名称<input autoFocus value={dialog.value} onChange={(event) => setDialog((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitDialog(); } }} /></label> : null}
        {dialog.type === "deleteBranch" ? <p>未合并分支会被 Git 拒绝。</p> : null}
        {dialog.type === "sync" ? <p>{`${syncLabels[dialog.action]}？\n不会执行强制推送或自动合并。`}</p> : null}
        {dialog.type === "init" ? <p>{`在以下目录启用 Git 版本管理？\n${state?.root || root}`}</p> : null}
      </Dialog> : null;

      if (!bridge()?.capabilities?.gitReview) return <div className="lbs-preview-empty">版本中心仅在桌面版中可用。</div>;
      if (!state && !error) return <div className="lbs-preview-empty">正在检查 Git 状态…</div>;
      if (state && !state.isRepository) return <div className="lbs-git-onboarding">
        <strong>这个项目还没有版本记录</strong>
        <p>启用后，劳博士可以为项目创建本地提交和任务分支；远端发布仍由你确认。</p>
        <code>{state.root}</code>
        <button className="lbs-wb-button primary" disabled={busy} onClick={() => setDialog({ type: "init" })}>启用版本管理</button>
        {error ? <div className="lbs-wb-error">{error}</div> : null}
        {dialogNode}
      </div>;
      if (!state) return <div className="lbs-git-onboarding"><strong>无法读取版本状态</strong><div className="lbs-wb-error">{error || desktop.error}</div><button className="lbs-wb-button" onClick={refresh}>重试</button></div>;

      const staged = state.changes.filter((change) => change.staged);
      const unstaged = state.changes.filter((change) => change.unstaged);
      const shownCommits = history || state.commits;
      const selectedTitle = selection?.path || reviewGroup.title || "版本差异";
      const selectReviewFile = (file) => void loadReviewFile({
        kind: reviewGroup.kind || "change",
        path: file.path,
        side: file.side || reviewGroup.side || "unstaged",
        ...(reviewGroup.ref ? { ref: reviewGroup.ref } : {}),
      });
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
            <section className="lbs-git-section"><div className="lbs-git-section-head">已暂存 <span>{staged.length}</span>{staged.length ? <button className="lbs-git-row-action" disabled={busy} onClick={() => unstageAll(staged)}>取消全部暂存</button> : null}</div>{staged.map((change) => <GitChange key={`s:${change.path}`} change={change} side="staged" active={selection?.side === "staged" && selection.path === change.path} busy={busy} onSelect={() => showChange(change, "staged", staged)} onAction={() => unstage(change)} actionLabel="取消暂存" />)}</section>
            <section className="lbs-git-section"><div className="lbs-git-section-head">工作区变更 <span>{unstaged.length}</span>{unstaged.length ? <button className="lbs-git-row-action" disabled={busy} onClick={() => stageAll(unstaged)}>全部暂存</button> : null}</div>{unstaged.map((change) => <GitChange key={`w:${change.path}`} change={change} side={change.untracked ? "untracked" : "unstaged"} active={selection?.side !== "staged" && selection?.path === change.path} busy={busy} onSelect={() => showChange(change, change.untracked ? "untracked" : "unstaged", unstaged)} onAction={() => stage(change)} actionLabel="暂存" />)}{unstaged.filter((change) => !change.untracked).map((change) => <button key={`r:${change.path}`} className="lbs-wb-button danger" onClick={() => restore(change)}>放弃 {change.path} 的修改</button>)}</section>
            <section className="lbs-git-section"><div className="lbs-git-section-head">提交历史 <span>{shownCommits.length}</span></div>{shownCommits.map((commit) => <button className="lbs-git-history" data-active={selection?.ref === commit.hash} key={commit.hash} onClick={() => showCommit(commit)}><strong>{commit.subject}</strong><small>{commit.shortHash} · {commit.author} · {new Date(commit.date).toLocaleString("zh-CN")}</small></button>)}{!historyEnd && shownCommits.length >= 50 ? <button className="lbs-wb-button" disabled={busy} onClick={() => void loadMoreHistory()}>加载更多历史</button> : null}</section>
          </div>
          <div className="lbs-git-commit-box"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="描述这次本地版本…" /><div className="lbs-git-commit-actions"><span>{staged.length} 个已暂存文件</span><button className="lbs-wb-button primary" disabled={!message.trim() || staged.length === 0 || busy} onClick={commit}>提交版本</button></div></div>
        </aside>
        <GitReviewFilesPane files={reviewGroup.files} title={reviewGroup.title} selectedPath={selection?.path || ""} onSelect={selectReviewFile} />
        <main className="lbs-git-main">
          <div className="lbs-git-diff-head"><strong>{selectedTitle}</strong><span>{state.root}</span><span className="lbs-git-toolbar-spacer" />{state.remotes.length ? <><button className="lbs-wb-button" onClick={() => sync("fetch")}>获取</button><button className="lbs-wb-button" onClick={() => sync("pull")}>拉取</button><button className="lbs-wb-button primary" onClick={() => sync("push")}>发布</button></> : <span>未配置远端</span>}</div>
          {diffLoading ? <div className="lbs-preview-empty">正在加载文件差异…</div> : diff ? <DiffViewer value={diff} path={selection?.path || ""} /> : <div className="lbs-preview-empty">从文件目录中选择一个文件查看 Diff。</div>}
        </main>
        {dialogNode}
      </div>;
    }

    function HubGlyph({ name, size = 16 }) {
      const props = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.35, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
      if (name === "hub") return <svg {...props}><rect x="2" y="2.5" width="5" height="5" rx="1.2" /><rect x="9" y="2.5" width="5" height="5" rx="1.2" /><rect x="2" y="9.5" width="5" height="4" rx="1.2" /><path d="M9 11.5h5M11.5 9v5" /></svg>;
      if (name === "git") return <svg {...props}><circle cx="4" cy="3" r="1.4" /><circle cx="4" cy="13" r="1.4" /><circle cx="12" cy="6.5" r="1.4" /><path d="M4 4.4v7.2M5.4 4.2c3.8 0 3.2 2.3 5.2 2.3" /></svg>;
      if (name === "changes") return <svg {...props}><path d="M3 2.5h7l3 3v8H3z" /><path d="M10 2.5v3h3M5.5 8h5M5.5 10.5h5" /></svg>;
      if (name === "branch") return <svg {...props}><circle cx="4" cy="3" r="1.3" /><circle cx="4" cy="13" r="1.3" /><circle cx="12" cy="5.5" r="1.3" /><path d="M4 4.3v7.4M5.3 11c0-3.5 5.4-2.2 6.4-4.2" /></svg>;
      if (name === "commit") return <svg {...props}><path d="M1.5 8h4M10.5 8h4" /><circle cx="8" cy="8" r="2.5" /></svg>;
      if (name === "push") return <svg {...props}><path d="M8 11V3M5 6l3-3 3 3M3 10.5v2h10v-2" /></svg>;
      if (name === "goal") return <svg {...props}><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><circle cx="8" cy="8" r=".7" fill="currentColor" stroke="none" /></svg>;
      if (name === "progress") return <svg {...props}><path d="M2.5 4h1.2l1 1.2 2-2.3M8.5 4h5M2.5 8h1.2l1 1.2 2-2.3M8.5 8h5M2.5 12h1.2l1 1.2 2-2.3M8.5 12h5" /></svg>;
      if (name === "refresh") return <svg {...props}><path d="M13 5V2.5l-1.6 1.2A5.5 5.5 0 1 0 13.1 9" /></svg>;
      if (name === "disclosure") return <svg {...props}><path d="m6 3 5 5-5 5" /></svg>;
      return <svg {...props}><path d="m5 5 6 6M11 5l-6 6" /></svg>;
    }

    function TodoStateGlyph({ status }) {
      if (status === "completed") return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" /><path d="m4.2 7.1 1.7 1.8 4-4.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
      if (status === "in_progress") return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.2" /><path d="M7 1a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
      return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeDasharray="2.2 2.2" strokeWidth="1.2" /></svg>;
    }

    const phaseLabels = { active: "进行中", paused: "已暂停", blocked: "受阻", complete: "已完成" };
    let projectHubMounts = 0;

    async function projectHubGitCounts(root, state) {
      if (!state?.isRepository) return { additions: 0, deletions: 0 };
      const [staged, unstaged] = await Promise.all([
        bridge().git.diff({ root, side: "staged" }).catch(() => ({ diff: "" })),
        bridge().git.diff({ root, side: "unstaged" }).catch(() => ({ diff: "" })),
      ]);
      return [staged.diff, unstaged.diff].reduce((total, value) => {
        if (!value) return total;
        const summary = parseUnifiedDiff(value, "");
        total.additions += summary.additions;
        total.deletions += summary.deletions;
        return total;
      }, { additions: 0, deletions: 0 });
    }

    async function projectHubCommitDiff(root, changes, includeUnstaged) {
      const requests = [bridge().git.diff({ root, side: "staged" })];
      if (includeUnstaged) {
        requests.push(bridge().git.diff({ root, side: "unstaged" }));
        for (const change of changes.filter((item) => item.untracked).slice(0, 40)) {
          requests.push(bridge().git.diff({ root, path: change.path, side: "untracked" }));
        }
      }
      const results = await Promise.all(requests);
      const diff = results.map((result) => result.diff || "").filter(Boolean).join("\n");
      if (!diff.trim()) throw new Error("没有可用于生成提交说明的文本变更，请手动填写说明。");
      const encoded = new TextEncoder().encode(diff);
      return encoded.byteLength > 140_000
        ? `${new TextDecoder().decode(encoded.subarray(0, 140_000))}\n\n[Git diff 已截断]`
        : diff;
    }

    async function selectedCommitModel(sessionId) {
      const effectiveSessionId = sessionId || module.ctx.sessions.list.getSnapshot().current;
      if (!effectiveSessionId) throw new Error("请先打开一个会话，以使用当前会话选择的模型生成提交说明。");
      const directory = module.ctx.modelDirectories.directoryFor(effectiveSessionId);
      let state = directory.store.getSnapshot();
      if (!state.current) {
        await directory.load();
        state = directory.store.getSnapshot();
      }
      if (!state.current) throw new Error("当前会话尚未选择模型，请先在输入框下方选择模型。");
      if (state.routable === false) throw new Error("当前选择的模型暂不可用，请切换模型或检查模型配置。");
      return { sessionId: effectiveSessionId, ...state.current };
    }

    async function generateProjectCommitMessage({ sessionId, state, changes, includeUnstaged, counts }) {
      const route = await selectedCommitModel(sessionId);
      const diff = await projectHubCommitDiff(state.root, changes, includeUnstaged);
      const response = await fetch("/laobos/api/workspace-tools/commit-message", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: route.provider,
          model: route.model,
          reasoningEffort: route.reasoningEffort,
          sessionId: route.sessionId,
          branch: state.branch,
          files: changes.filter((change) => change.staged || (includeUnstaged && change.unstaged)).slice(0, 80).map((change) => change.path.slice(0, 300)),
          additions: counts.additions,
          deletions: counts.deletions,
          diff,
        }),
        signal: AbortSignal.timeout(40_000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.message !== "string" || !result.message.trim()) {
        throw new Error(result.error || `提交说明生成失败（HTTP ${response.status}）。`);
      }
      return result.message.trim();
    }

    function ProjectTaskGitHub({ fallback = false, goalProjection = null, sessionId, todos = [] }) {
      const desktop = useDesktopContext();
      const currentWorkspaceRoot = useSessionWorkspaceRoot(sessionId);
      const root = currentWorkspaceRoot || desktop.context?.root || "";
      const rootRef = useRef(null);
      const triggerRef = useRef(null);
      const requestRef = useRef(0);
      const sidebarLinkedRef = useRef(false);
      const [open, setOpen] = useState(false);
      const [gitState, setGitState] = useState(null);
      const [gitCounts, setGitCounts] = useState({ additions: 0, deletions: 0 });
      const [gitLoading, setGitLoading] = useState(false);
      const [gitError, setGitError] = useState("");
      const [changesExpanded, setChangesExpanded] = useState(true);
      const [commitExpanded, setCommitExpanded] = useState(false);
      const [commitMessage, setCommitMessage] = useState("");
      const [includeUnstaged, setIncludeUnstaged] = useState(true);
      const [gitAction, setGitAction] = useState("");
      const [gitActionFeedback, setGitActionFeedback] = useState({ state: "", message: "" });
      const goal = goalProjection?.goal || null;
      const done = todos.filter((item) => item.status === "completed").length;

      useEffect(() => {
        projectHubMounts += 1;
        document.body.setAttribute("data-laobos-task-git-hub", "");
        return () => {
          projectHubMounts -= 1;
          if (projectHubMounts === 0) document.body.removeAttribute("data-laobos-task-git-hub");
        };
      }, []);

      const refreshGit = useCallback(async () => {
        if (!root || !bridge()?.capabilities?.gitReview) return;
        const request = ++requestRef.current;
        setGitLoading(true); setGitError("");
        try {
          const next = await bridge().git.inspect({ root });
          const counts = await projectHubGitCounts(root, next);
          if (request !== requestRef.current) return;
          setGitState(next); setGitCounts(counts);
        } catch (reason) {
          if (request === requestRef.current) setGitError(messageOf(reason));
        } finally {
          if (request === requestRef.current) setGitLoading(false);
        }
      }, [root]);

      useEffect(() => {
        requestRef.current += 1;
        setGitState(null); setGitCounts({ additions: 0, deletions: 0 }); setGitError("");
        setCommitExpanded(false); setCommitMessage(""); setIncludeUnstaged(true); setGitAction(""); setGitActionFeedback({ state: "", message: "" });
        if (root && !fallback) void refreshGit();
      }, [fallback, refreshGit, root]);

      useEffect(() => {
        if (fallback && open && root && !gitAction) void refreshGit();
      }, [fallback, gitAction, open, refreshGit, root]);

      const close = useCallback((restoreFocus = false) => {
        setOpen(false);
        if (sidebarLinkedRef.current) {
          sidebarLinkedRef.current = false;
          window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "git", source: "project-hub" } }));
        }
        if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
      }, []);

      useEffect(() => {
        const showFromProjectSidebar = (event) => {
          if (event.detail?.tool === "close") {
            if (sidebarLinkedRef.current) {
              sidebarLinkedRef.current = false;
              setOpen(false);
            }
            return;
          }
          if (event.detail?.tool !== "git" || event.detail?.source !== "project-sidebar" || event.detail?.mode === "full") return;
          const show = () => {
            sidebarLinkedRef.current = true;
            setOpen(true);
            if (!fallback && !gitAction) void refreshGit();
          };
          if (fallback) {
            queueMicrotask(() => {
              if (!event.detail?.projectHubHandled) show();
            });
            return;
          }
          event.detail.projectHubHandled = true;
          show();
        };
        window.addEventListener("laobos:open-desktop-tool", showFromProjectSidebar);
        return () => window.removeEventListener("laobos:open-desktop-tool", showFromProjectSidebar);
      }, [fallback, gitAction, refreshGit]);

      useEffect(() => {
        if (!open) return;
        const dismiss = (event) => {
          if (event.target instanceof Element && event.target.closest('button[aria-label="版本中心"]')) return;
          if (!rootRef.current?.contains(event.target)) close();
        };
        const keydown = (event) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", keydown);
        return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", keydown); };
      }, [close, open]);

      useEffect(() => {
        sidebarLinkedRef.current = false;
        setOpen(false);
        setChangesExpanded(true);
        setCommitExpanded(false);
        setIncludeUnstaged(true);
      }, [sessionId]);

      const changes = gitState?.changes || [];
      const stagedCount = changes.filter((change) => change.staged).length;
      const unstagedCount = changes.filter((change) => change.unstaged).length;
      const activeTodoCount = todos.length - done;
      const badgeCount = activeTodoCount + changes.length;
      const workspaceName = root.split(/[\\/]/u).filter(Boolean).at(-1) || "当前项目";
      const latestCommit = gitState?.commits?.[0];
      const remote = gitState?.remotes?.[0] || "";
      const commitCandidates = changes.filter((change) => change.staged || (includeUnstaged && change.unstaged));
      const canCommit = Boolean(commitCandidates.length > 0 && !gitAction);
      const canPublishBranch = Boolean(remote && gitState?.branch && gitState.branch !== "(detached)");
      const canPush = Boolean(canPublishBranch && gitState?.head && !gitAction);
      const canCommitAndPush = Boolean(canCommit && canPublishBranch);
      const commitSummary = stagedCount > 0 ? `${stagedCount} 个待提交` : gitState?.ahead > 0 ? `${gitState.ahead} 个待推送` : unstagedCount > 0 ? `${unstagedCount} 个未暂存` : "无待处理";

      const acceptGitActionState = async (next, request) => {
        const counts = await projectHubGitCounts(root, next);
        if (request !== requestRef.current) return false;
        setGitState(next);
        setGitCounts(counts);
        return true;
      };

      const commitChanges = async ({ pushAfter = false } = {}) => {
        if (!gitState || !canCommit || (pushAfter && !canPublishBranch)) return;
        const request = ++requestRef.current;
        let message = commitMessage.trim();
        const generated = !message;
        setGitAction(generated ? "generate" : includeUnstaged && unstagedCount > 0 ? "stage" : "commit");
        setGitActionFeedback({ state: "", message: generated ? "正在使用当前模型分析 Git 变更…" : "" });
        try {
          if (generated) {
            message = await generateProjectCommitMessage({ sessionId, state: gitState, changes, includeUnstaged, counts: gitCounts });
            if (request !== requestRef.current) return;
            setCommitMessage(message);
          }
          let prepared = gitState;
          const unstagedPaths = includeUnstaged
            ? [...new Set(changes.filter((change) => change.unstaged).map((change) => change.path))]
            : [];
          if (unstagedPaths.length) {
            setGitAction("stage");
            setGitActionFeedback({ state: "", message: `正在包含 ${unstagedPaths.length} 个未暂存文件…` });
            prepared = await bridge().git.stage({ root, paths: unstagedPaths, expectedStatusToken: prepared.statusToken });
            if (request !== requestRef.current) return;
          }
          setGitAction("commit");
          setGitActionFeedback({ state: "", message: generated ? `已生成：${message}` : "正在创建本地提交…" });
          const committed = await bridge().git.commit({ root, message, expectedHead: prepared.head, expectedStatusToken: prepared.statusToken });
          if (request !== requestRef.current) return;
          let next = committed;
          if (pushAfter) {
            setGitAction("push");
            setGitActionFeedback({ state: "", message: `本地已提交，正在推送到 ${remote}…` });
            try {
              next = await bridge().git.sync({ root, action: "push", remote, expectedHead: committed.head });
            } catch (reason) {
              if (await acceptGitActionState(committed, request)) {
                setCommitMessage("");
                setGitActionFeedback({ state: "error", message: `本地提交成功，但推送失败：${messageOf(reason)}` });
              }
              return;
            }
          }
          if (await acceptGitActionState(next, request)) {
            setCommitMessage("");
            const hash = next.commits?.[0]?.shortHash || "本地版本";
            setGitActionFeedback({ state: "success", message: pushAfter ? `已提交并推送 ${hash}` : `${generated ? "已自动生成说明并提交" : "已提交"} ${hash}` });
          }
        } catch (reason) {
          if (request === requestRef.current) setGitActionFeedback({ state: "error", message: messageOf(reason) });
        } finally {
          if (request === requestRef.current) setGitAction("");
        }
      };

      const pushCurrentBranch = async () => {
        if (!gitState || !remote || !canPush) return;
        const request = ++requestRef.current;
        setGitAction("push"); setGitActionFeedback({ state: "", message: "" });
        try {
          const next = await bridge().git.sync({ root, action: "push", remote, expectedHead: gitState.head });
          if (await acceptGitActionState(next, request)) setGitActionFeedback({ state: "success", message: `已推送 ${next.branch || gitState.branch} 到 ${remote}` });
        } catch (reason) {
          if (request === requestRef.current) setGitActionFeedback({ state: "error", message: messageOf(reason) });
        } finally {
          if (request === requestRef.current) setGitAction("");
        }
      };

      const openFullGit = (change) => {
        sidebarLinkedRef.current = false;
        setOpen(false);
        const side = change ? change.staged ? "staged" : change.untracked ? "untracked" : "unstaged" : undefined;
        openGitDetails({ root, path: change?.path, side, source: "project-hub" });
      };

      return <div className={`lbs-project-hub${fallback ? " is-shell-fallback" : ""}`} ref={rootRef} data-project-task-git-hub>
        {!fallback ? <button ref={triggerRef} type="button" className="lbs-project-hub-trigger" aria-label="任务与 Git" aria-haspopup="dialog" aria-expanded={open} title="任务与 Git" onClick={() => {
          if (open) close();
          else { sidebarLinkedRef.current = false; setOpen(true); if (!gitAction) void refreshGit(); }
        }}>
          <HubGlyph name="hub" size={17} />
          {badgeCount > 0 ? <span className="lbs-project-hub-count">{badgeCount > 99 ? "99+" : badgeCount}</span> : null}
        </button> : null}
        {open ? <section className="lbs-project-hub-panel" role="dialog" aria-label="任务与 Git 项目面板">
          <header className="lbs-project-hub-header"><strong>任务与 Git</strong><small title={root}>{workspaceName}</small><button type="button" className="lbs-project-hub-refresh" aria-label="刷新 Git 状态" title="刷新 Git 状态" disabled={gitLoading || Boolean(gitAction)} onClick={() => void refreshGit()}><HubGlyph name="refresh" /></button><button type="button" className="lbs-project-hub-close" aria-label="关闭任务与 Git" onClick={() => close(true)}><HubGlyph name="close" /></button></header>
          <div className="lbs-project-hub-scroll">
            <section className="lbs-project-hub-section">
              <div className="lbs-project-hub-section-head"><HubGlyph name="git" /><span>Git 工具</span><button type="button" className="lbs-project-hub-link" onClick={() => openFullGit()}>完整版本中心 ↗</button></div>
              {gitLoading && !gitState ? <div className="lbs-project-hub-loading">正在读取版本状态…</div> : gitError ? <div className="lbs-project-hub-error">{gitError}</div> : gitState && !gitState.isRepository ? <><div className="lbs-project-hub-empty">当前项目还没有启用 Git 版本管理。</div><button type="button" className="lbs-project-hub-full-button" onClick={() => openFullGit()}>打开版本中心并启用</button></> : gitState ? <>
                <div className="lbs-project-hub-metric"><span className="lbs-project-hub-metric-icon"><HubGlyph name="changes" /></span><span className="lbs-project-hub-metric-label">变更</span><span className="lbs-project-hub-metric-value">{changes.length} 项 <span className="lbs-project-hub-add">+{gitCounts.additions}</span><span className="lbs-project-hub-delete">−{gitCounts.deletions}</span></span></div>
                <button type="button" className="lbs-project-hub-metric lbs-project-hub-files-toggle" aria-expanded={changesExpanded} aria-label={changesExpanded ? "收起 Git 变更文件" : "展开 Git 变更文件"} title={changesExpanded ? "收起变更文件" : "展开变更文件"} onClick={() => setChangesExpanded((value) => !value)}><span className="lbs-project-hub-metric-icon"><HubGlyph name="branch" /></span><span className="lbs-project-hub-metric-label" title={gitState.branch}>{gitState.branch || "未命名分支"}</span><span className="lbs-project-hub-metric-value"><span>已暂存 {stagedCount} · 未暂存 {unstagedCount}{gitState.upstream ? ` · ↑${gitState.ahead} ↓${gitState.behind}` : ""}</span><span className="lbs-project-hub-disclosure"><HubGlyph name="disclosure" size={12} /></span></span></button>
                {latestCommit ? <div className="lbs-project-hub-metric"><span className="lbs-project-hub-metric-icon"><HubGlyph name="commit" /></span><span className="lbs-project-hub-metric-label" title={latestCommit.subject}>{latestCommit.subject}</span><span className="lbs-project-hub-metric-value">{latestCommit.shortHash}</span></div> : null}
                {changesExpanded ? changes.length ? <div className="lbs-project-hub-files">{changes.map((change) => {
                  const side = change.staged ? "staged" : change.untracked ? "untracked" : "unstaged";
                  const rawCode = side === "staged" ? change.index : change.worktree;
                  const code = change.conflict ? "!" : rawCode === "?" ? "U" : rawCode;
                  const stateLabel = change.conflict ? "冲突" : change.staged && change.unstaged ? "已暂存 · 有新修改" : change.staged ? "已暂存" : change.untracked ? "未跟踪" : "未暂存";
                  return <button type="button" className="lbs-project-hub-file" data-status={code} title={`${change.path} · ${stateLabel}`} key={`${change.path}:${change.index}:${change.worktree}`} onClick={() => openFullGit(change)}><span className="lbs-project-hub-file-code">{code}</span><span className="lbs-project-hub-file-name">{change.path}</span><span className="lbs-project-hub-file-state">{stateLabel}</span></button>;
                })}</div> : <div className="lbs-project-hub-empty">工作区干净，没有待处理变更。</div> : null}
                <button type="button" className="lbs-project-hub-metric lbs-project-hub-files-toggle lbs-project-hub-commit-toggle" aria-expanded={commitExpanded} aria-label={commitExpanded ? "收起提交或推送" : "展开提交或推送"} onClick={() => setCommitExpanded((value) => { const next = !value; if (next) setChangesExpanded(false); return next; })}><span className="lbs-project-hub-metric-icon"><HubGlyph name="commit" /></span><span className="lbs-project-hub-metric-label">提交或推送</span><span className="lbs-project-hub-metric-value"><span>{commitSummary}</span><span className="lbs-project-hub-disclosure"><HubGlyph name="disclosure" size={12} /></span></span></button>
                {commitExpanded ? <div className="lbs-project-hub-commit-panel">
                  <div className="lbs-project-hub-commit-context"><div className="lbs-project-hub-commit-branch"><HubGlyph name="branch" size={13} /><span title={gitState.branch}>{gitState.branch || "未命名分支"}</span></div><span className="lbs-project-hub-ai-badge">使用当前会话模型</span></div>
                  <div className="lbs-project-hub-commit-input-wrap"><textarea className="lbs-project-hub-commit-input" aria-label="Git 提交说明" maxLength={5000} placeholder="提交信息（留空将自动生成）…" value={commitMessage} disabled={Boolean(gitAction)} onChange={(event) => setCommitMessage(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canCommit) { event.preventDefault(); void commitChanges(); } }} /><span className="lbs-project-hub-commit-ai" title="留空时使用当前模型生成提交说明">{gitAction === "generate" ? "···" : "AI"}</span></div>
                  <label className="lbs-project-hub-commit-include"><input type="checkbox" checked={includeUnstaged} disabled={Boolean(gitAction) || unstagedCount === 0} onChange={(event) => setIncludeUnstaged(event.target.checked)} /><span>包含未暂存的更改</span><span className="lbs-project-hub-commit-stats"><span className="lbs-project-hub-add">+{gitCounts.additions}</span><span className="lbs-project-hub-delete">−{gitCounts.deletions}</span></span></label>
                  <span className="lbs-project-hub-commit-feedback" data-state={gitActionFeedback.state} role={gitActionFeedback.state === "error" ? "alert" : "status"}>{gitActionFeedback.message || `${remote ? `远端 ${remote} · ` : ""}留空将自动生成提交说明`}</span>
                  <div className="lbs-project-hub-commit-actions">
                    <button type="button" className="lbs-project-hub-commit-button primary" disabled={!canCommit} onClick={() => void commitChanges()}><HubGlyph name="commit" /><span>{gitAction === "generate" ? "正在生成提交说明…" : gitAction === "stage" ? "正在包含未暂存更改…" : gitAction === "commit" ? "正在提交…" : "提交"}</span><small>⌘↵</small></button>
                    <button type="button" className="lbs-project-hub-commit-button" disabled={!canCommitAndPush} title={!remote ? "未配置 Git 远端" : "提交后推送当前分支"} onClick={() => void commitChanges({ pushAfter: true })}><HubGlyph name="push" /><span>{gitAction === "push" ? "正在提交并推送…" : "提交并推送"}</span><small>{remote || "无远端"}</small></button>
                    <button type="button" className="lbs-project-hub-commit-button" disabled={!canPush} title={!remote ? "未配置 Git 远端" : !gitState?.head ? "当前没有可推送的提交" : "推送当前分支"} onClick={() => void pushCurrentBranch()}><HubGlyph name="push" /><span>{gitAction === "push" ? "正在推送…" : "推送"}</span><small>{gitState.upstream ? `↑${gitState.ahead}` : remote || "无远端"}</small></button>
                  </div>
                </div> : null}
              </> : <div className="lbs-project-hub-empty">正在定位项目工作区…</div>}
            </section>

            <section className="lbs-project-hub-section">
              <div className="lbs-project-hub-section-head"><HubGlyph name="goal" /><span>目标</span>{goal ? <span className="lbs-project-hub-phase" data-phase={goal.phase}>{phaseLabels[goal.phase] || goal.phase}</span> : null}</div>
              {goal ? <div className="lbs-project-hub-goal"><p className="lbs-project-hub-objective">{goal.objective}</p><div className="lbs-project-hub-goal-meta"><span>{goalProjection.roundsStarted}/{goal.maxGoalRounds} 轮</span><span>更新于 {new Date(goalProjection.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>{goal.blockedReason ? <div className="lbs-project-hub-blocker">{goal.blockedReason.message}</div> : null}</div> : <div className="lbs-project-hub-empty">当前会话还没有长期目标。</div>}
            </section>

            <section className="lbs-project-hub-section">
              <div className="lbs-project-hub-section-head"><HubGlyph name="progress" /><span>进展</span><span>{todos.length ? `${done}/${todos.length} 完成` : "暂无任务"}</span></div>
              {todos.length ? <ul className="lbs-project-hub-todos">{todos.map((item, index) => <li className="lbs-project-hub-todo" data-status={item.status} key={`${index}:${item.content}`}><span className="lbs-project-hub-todo-icon"><TodoStateGlyph status={item.status} /></span><span>{item.content}</span></li>)}</ul> : <div className="lbs-project-hub-empty">Agent 创建任务计划后，会在这里完整显示。</div>}
            </section>
          </div>
        </section> : null}
      </div>;
    }

    function SessionProjectTaskGitHub({ sessionId, useProjection }) {
      const goalProjection = useProjection("goal");
      const todos = useProjection("todos") || [];
      return <ProjectTaskGitHub goalProjection={goalProjection} sessionId={sessionId} todos={todos} />;
    }

    function ProjectTaskGitShellFallback() {
      return <ProjectTaskGitHub fallback />;
    }

    function WorkspaceWorkbench() {
      const currentWorkspaceRoot = useSessionWorkspaceRoot();
      const [page, setPage] = useState("");
      const [visitedPages, setVisitedPages] = useState(() => new Set());
      const [root, setRoot] = useState("");
      const [followCurrentWorkspace, setFollowCurrentWorkspace] = useState(false);
      const [requestedPath, setRequestedPath] = useState("");
      const [requestedGitSide, setRequestedGitSide] = useState("");
      const [sidebarOffset, setSidebarOffset] = useState(56);
      const pageRef = useRef(page);
      const filesDirtyRef = useRef(false);
      useEffect(() => { pageRef.current = page; }, [page]);
      const setFilesDirty = useCallback((value) => { filesDirtyRef.current = Boolean(value); }, []);
      useEffect(() => {
        if (!['files', 'git'].includes(page)) return undefined;
        const overlay = document.querySelector("[data-shell-overlay]");
        const frame = overlay?.parentElement;
        const sidebarColumn = frame?.firstElementChild;
        if (!(frame instanceof HTMLElement) || !(sidebarColumn instanceof HTMLElement)) return undefined;

        let restoreSidebar = false;
        let automaticCollapseSettled = frame.hasAttribute("data-sidebar-collapsed");
        const updateOffset = () => {
          const width = Math.round(sidebarColumn.getBoundingClientRect().width);
          setSidebarOffset(width > 0 ? width : frame.hasAttribute("data-sidebar-collapsed") ? 56 : 280);
        };
        const resizeObserver = new ResizeObserver(updateOffset);
        const attributeObserver = new MutationObserver(() => {
          const collapsed = frame.hasAttribute("data-sidebar-collapsed");
          if (restoreSidebar && !automaticCollapseSettled && collapsed) automaticCollapseSettled = true;
          else if (restoreSidebar && automaticCollapseSettled && !collapsed) restoreSidebar = false;
          updateOffset();
        });
        resizeObserver.observe(sidebarColumn);
        attributeObserver.observe(frame, { attributes: true, attributeFilter: ["data-sidebar-collapsed", "style"] });
        updateOffset();
        if (!automaticCollapseSettled) {
          restoreSidebar = true;
          module.ctx?.layout?.toggleSidebar();
        }
        return () => {
          resizeObserver.disconnect();
          attributeObserver.disconnect();
          if (restoreSidebar && frame.hasAttribute("data-sidebar-collapsed")) module.ctx?.layout?.toggleSidebar();
        };
      }, [page]);
      const close = useCallback(() => {
        const closing = pageRef.current;
        if (closing === "files" && filesDirtyRef.current && !window.confirm("当前文件有未保存的修改，确定放弃修改并关闭文件管理器吗？")) return false;
        if (closing === "files") {
          filesDirtyRef.current = false;
          setVisitedPages((previous) => { const next = new Set(previous); next.delete("files"); return next; });
        }
        pageRef.current = ""; setPage("");
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: closing } }));
        return true;
      }, []);
      useEffect(() => {
        const open = (event) => {
          const tool = event.detail?.tool;
          if (tool === "close") { close(); return; }
          if (!["files", "git"].includes(tool)) return;
          if (tool === "git" && event.detail?.source === "project-sidebar" && event.detail?.mode !== "full") return;
          if (pageRef.current === "files" && tool !== "files" && filesDirtyRef.current) {
            if (!window.confirm("当前文件有未保存的修改，确定放弃修改并离开文件管理器吗？")) return;
            filesDirtyRef.current = false;
            setVisitedPages((previous) => { const next = new Set(previous); next.delete("files"); return next; });
          }
          const followsWorkspace = event.detail?.source === "project-sidebar";
          setVisitedPages((previous) => previous.has(tool) ? previous : new Set([...previous, tool]));
          setFollowCurrentWorkspace(followsWorkspace);
          setRoot(followsWorkspace ? currentWorkspaceRoot || event.detail?.cwd || "" : event.detail?.cwd || currentWorkspaceRoot || "");
          if (tool === "files") setRequestedPath(event.detail?.path || "");
          if (tool === "git") { setRequestedPath(event.detail?.path || ""); setRequestedGitSide(event.detail?.side || ""); }
          pageRef.current = tool; setPage(tool);
        };
        window.addEventListener("laobos:open-desktop-tool", open);
        return () => window.removeEventListener("laobos:open-desktop-tool", open);
      }, [close, currentWorkspaceRoot]);
      useEffect(() => {
        if (followCurrentWorkspace && currentWorkspaceRoot) setRoot(currentWorkspaceRoot);
      }, [currentWorkspaceRoot, followCurrentWorkspace]);
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
      const renderedPages = ["files", "git"].filter((id) => id === page || visitedPages.has(id));
      if (!renderedPages.length) return null;
      return <>{renderedPages.map((id) => {
        const selected = page === id;
        const title = id === "files" ? "文件管理器" : "版本中心";
        const rootName = String(root || "").split(/[\\/]/u).filter(Boolean).at(-1) || "当前项目";
        return <section className="lbs-workbench" data-open={selected} data-tool={id} role="dialog" aria-label={title} aria-hidden={!selected} style={{ "--lbs-files-sidebar-offset": `${sidebarOffset}px` }} key={id}>
          <header className="lbs-workbench-header"><strong>{title}</strong>{id === "files" ? <span className="lbs-workbench-root" title={root}>{rootName}</span> : null}<button className="lbs-wb-button lbs-workbench-close" onClick={close}>关闭</button></header>
          {id === "files" ? <FilesPage requestedRoot={root} requestedPath={requestedPath} onDirtyChange={setFilesDirty} /> : <GitPage requestedRoot={root} requestedPath={requestedPath} requestedSide={requestedGitSide} />}
        </section>;
      })}</>;
    }

    const inject = ["slots", "sessions", "workspaces", "modelDirectories", "layout", "conversationEvents"];
    function apply(ctx) {
      module.ctx = ctx;
      ctx.conversationEvents.register(conversationChangeStatsDefinition);
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-task-git-hub-fallback", order: 34 }, ProjectTaskGitShellFallback));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-desktop-workbench", order: 35 }, WorkspaceWorkbench));
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({ name: "conversation.session.header.utilities", id: "laobos-task-git-hub", order: 12 }, SessionProjectTaskGitHub));
      ctx.slots.inject("conversation.chat.turnSummary", () => ctx.slots.register({ name: "conversation.chat.turnSummary", select: selectConversationChanges }, ConversationChangesCard));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
