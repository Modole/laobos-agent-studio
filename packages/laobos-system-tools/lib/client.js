/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
/* eslint-disable react-hooks/exhaustive-deps -- effects intentionally key off stable ids/revisions from the DSH store */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-system-tools",
  factory: (require) => {
    const brandName = "劳博士";
    const brandIcon = "/laobos/api/system-tools/brand/icon.png";
    const brandManifest = "/laobos/api/system-tools/brand/manifest.webmanifest";
    document.title = brandName;
    document.documentElement.lang = "zh-CN";
    document.querySelectorAll('link[rel~="icon"], link[rel="manifest"]').forEach((element) => element.remove());
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = brandIcon;
    document.head.appendChild(favicon);
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = brandManifest;
    document.head.appendChild(manifest);

    const brandCss = document.createElement("style");
    brandCss.dataset.laobosBrand = "true";
    brandCss.textContent = `
      [data-laobos-main-brand]{align-items:center!important;display:flex!important;gap:10px!important;justify-content:flex-start!important}
      [data-laobos-main-brand]>svg{display:none!important}
      [data-laobos-main-brand]::before{background:url("${brandIcon}") center/contain no-repeat;content:"";display:block;flex:none;height:30px;width:30px}
      [data-laobos-main-brand]::after{color:var(--dsw-alias-label-primary);content:"劳博士";font-size:20px;font-weight:650;letter-spacing:-.02em;white-space:nowrap}
      [data-laobos-hero-logo]{background:url("${brandIcon}") center/contain no-repeat;display:inline-block!important;flex:none;height:38px!important;width:38px!important}
      [data-laobos-hero-logo]>svg{display:none!important}
      [data-laobos-preview-badge]{display:none!important}
    `;
    document.head.appendChild(brandCss);

    function applyProductBranding() {
      document.title = document.title.replace(/DeepSeek Harness/giu, brandName);
      for (const button of document.querySelectorAll('button[aria-label="新建会话"], button[aria-label="New session"]')) {
        if (button.querySelector('svg[viewBox="0 0 182 24"]')) {
          button.dataset.laobosMainBrand = "true";
        }
      }
      for (const element of document.querySelectorAll("span, div")) {
        if (element.children.length === 0 && ["探索未至之境", "Explore the uncharted"].includes(element.textContent?.trim())) {
          element.textContent = brandName;
          const headline = element.parentElement;
          const logo = headline?.querySelector("span:has(> svg[viewBox=\"0 0 23.16 17.04\"])");
          if (logo instanceof HTMLElement) logo.dataset.laobosHeroLogo = "true";
          const badge = headline?.querySelector("span:last-child");
          if (badge instanceof HTMLElement && ["预览版", "Preview"].includes(badge.textContent?.trim())) {
            badge.dataset.laobosPreviewBadge = "true";
          }
        }
      }
    }
    let brandingQueued = false;
    const queueBranding = () => {
      if (brandingQueued) return;
      brandingQueued = true;
      requestAnimationFrame(() => {
        brandingQueued = false;
        applyProductBranding();
      });
    };
    const brandingObserver = new MutationObserver(queueBranding);
    brandingObserver.observe(document.documentElement, { childList: true, subtree: true });
    queueBranding();

    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const Primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const {
      createElement: h,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = React;

    const css = `
      .lbs-page{color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px;padding:4px 0 24px}
      .lbs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lbs-title{font-size:20px;font-weight:600;line-height:28px}.lbs-sub{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;margin-top:3px}
      .lbs-grid{display:grid;grid-template-columns:minmax(190px,240px) minmax(0,1fr);gap:12px;min-height:430px}.lbs-panel{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:14px;padding:12px;min-width:0}.lbs-stack{display:flex;flex-direction:column;gap:8px}.lbs-row{display:flex;align-items:center;gap:8px}.lbs-between{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .lbs-card{appearance:none;background:transparent;border:1px solid var(--dsw-alias-line-border);border-radius:10px;color:inherit;cursor:pointer;padding:10px;text-align:left;width:100%}.lbs-card:hover,.lbs-card[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-line-border-hover)}.lbs-card-title{font-size:14px;font-weight:550}.lbs-meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
      .lbs-button{appearance:none;background:var(--dsw-alias-interactive-bg-primary);border:0;border-radius:9px;color:var(--dsw-alias-label-on-primary);cursor:pointer;font:inherit;font-size:13px;height:34px;padding:0 13px}.lbs-button.secondary{background:var(--dsw-alias-interactive-bg-secondary);color:var(--dsw-alias-label-primary)}.lbs-button.danger{background:rgba(218,70,70,.13);color:#d94b4b}.lbs-button:disabled{cursor:not-allowed;opacity:.5}
      .lbs-input,.lbs-area{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:9px;color:inherit;font:inherit;font-size:13px;outline:none;padding:8px 10px;width:100%}.lbs-input:focus,.lbs-area:focus{border-color:var(--dsw-alias-line-border-focus)}.lbs-area{min-height:110px;resize:vertical}.lbs-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:220px;tab-size:2}.lbs-label{font-size:12px;font-weight:550;margin-bottom:4px}.lbs-empty{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;justify-content:center;min-height:180px;text-align:center}.lbs-error{background:rgba(218,70,70,.1);border-radius:9px;color:#d94b4b;font-size:12px;padding:9px}.lbs-ok{background:rgba(44,168,110,.1);border-radius:9px;color:#2a9b67;font-size:12px;padding:9px;white-space:pre-wrap;word-break:break-word}
      .lbs-svg{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:12px;height:260px;width:100%}.lbs-node{fill:var(--dsw-alias-bg-layer-1);stroke:var(--dsw-alias-line-border);stroke-width:1.5}.lbs-node-group[data-selectable=true]{cursor:pointer;outline:none}.lbs-node-group[data-selectable=true]:hover .lbs-node,.lbs-node-group[data-selected=true] .lbs-node{stroke:var(--dsw-alias-brand-primary);stroke-width:2}.lbs-edge{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:1.4}.lbs-node-title{fill:var(--dsw-alias-label-primary);font-size:12px;font-weight:600}.lbs-node-type{fill:var(--dsw-alias-label-tertiary);font-size:10px}.lbs-workflow-node-editor{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:11px;display:flex;flex-direction:column;gap:9px;padding:11px}.lbs-workflow-node-head{align-items:center;display:flex;gap:8px;justify-content:space-between}.lbs-workflow-node-head strong{font-size:13px}.lbs-workflow-node-editor .lbs-code{min-height:130px}.lbs-check{accent-color:var(--dsw-alias-brand-primary)}
      .lbs-workflow-list-panel{overflow:hidden;padding:0}.lbs-workflow-table-scroll{overflow:auto}.lbs-workflow-table{min-width:840px}.lbs-workflow-table-head,.lbs-workflow-row{align-items:center;display:grid;grid-template-columns:minmax(280px,1fr) minmax(150px,.62fr) 104px 74px 132px 154px}.lbs-workflow-table-head{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:550;min-height:38px}.lbs-workflow-table-head>span,.lbs-workflow-cell{box-sizing:border-box;padding:0 12px}.lbs-workflow-row{border-bottom:1px solid var(--dsw-alias-line-border);min-height:68px}.lbs-workflow-row:last-child{border-bottom:0}.lbs-workflow-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-workflow-primary{align-items:center;display:flex;gap:10px;min-width:0}.lbs-workflow-primary-button{align-items:center;appearance:none;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;gap:10px;min-width:0;padding:0;text-align:left}.lbs-workflow-list-icon{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:8px;color:var(--dsw-alias-label-secondary);display:flex;flex:none;height:32px;justify-content:center;width:32px}.lbs-workflow-row-copy{display:flex;flex-direction:column;min-width:0}.lbs-workflow-row-copy>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-workflow-tool-name{font:11px/18px ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-workflow-list-status{align-items:center;color:var(--dsw-alias-label-secondary);display:inline-flex;gap:6px;white-space:nowrap}.lbs-workflow-list-status>span{background:var(--dsw-alias-label-quaternary);border-radius:50%;height:7px;width:7px}.lbs-workflow-list-status[data-enabled=true]{color:#2a9b67}.lbs-workflow-list-status[data-enabled=true]>span{background:#2a9b67}.lbs-workflow-list-actions{display:flex;gap:4px;justify-content:flex-end}.lbs-workflow-modal{max-width:980px}.lbs-workflow-modal-summary{display:grid;gap:10px;grid-template-columns:repeat(4,1fr)}.lbs-workflow-summary-item{background:var(--dsw-alias-bg-layer-2);border-radius:9px;display:flex;flex-direction:column;gap:2px;padding:10px}.lbs-workflow-summary-item strong{font-size:14px}.lbs-workflow-summary-item span{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-workflow-readonly{display:grid;gap:10px;grid-template-columns:1fr 1fr}.lbs-workflow-readonly>div{min-width:0}.lbs-workflow-readonly code{display:block;margin-top:4px}.lbs-workflow-run-output{max-height:180px;overflow:auto}@media(max-width:700px){.lbs-workflow-modal-summary,.lbs-workflow-readonly{grid-template-columns:1fr 1fr}}
      .lbs-automation-list{display:flex;flex-direction:column;gap:6px}.lbs-automation-card{appearance:none;align-items:center;background:transparent;border:1px solid var(--dsw-alias-line-border);border-radius:10px;color:inherit;cursor:pointer;display:grid;gap:10px;grid-template-columns:minmax(0,1fr) auto;padding:11px;text-align:left;width:100%}.lbs-automation-card:hover,.lbs-automation-card[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-line-border-hover)}.lbs-automation-card-copy{display:flex;flex-direction:column;min-width:0}.lbs-automation-card-copy>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-automation-state{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:11px;gap:6px;white-space:nowrap}.lbs-automation-state>span{background:var(--dsw-alias-label-quaternary);border-radius:50%;height:7px;width:7px}.lbs-automation-state[data-enabled=true]{color:#2a9b67}.lbs-automation-state[data-enabled=true]>span{background:#2a9b67}.lbs-automation-detail{display:flex;flex-direction:column;gap:12px}.lbs-automation-detail-head{align-items:flex-start;display:flex;gap:12px;justify-content:space-between}.lbs-automation-detail-head h2{font-size:18px;line-height:25px;margin:0}.lbs-automation-tool{background:var(--dsw-alias-bg-layer-2);border-radius:7px;color:var(--dsw-alias-label-secondary);display:block;font:11px/18px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;padding:7px 9px}.lbs-automation-actions{display:flex;flex-wrap:wrap;gap:8px}.lbs-automation-note{border-top:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;padding-top:10px}
      [data-laobos-right-sidebar]{grid-template-columns:var(--lbs-left-column,280px) minmax(0,1fr) var(--lbs-right-column,56px)!important}[data-laobos-native-settings-trigger]{display:none!important}body:has([data-laobos-native-settings-trigger][aria-expanded="true"])>[role="presentation"]:has(>[role="dialog"][aria-modal="true"]){z-index:2147483600!important}.lbs-right-sidebar{background:var(--dsw-specific-sidebar-fill);border-left:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;overflow-y:auto;pointer-events:auto;position:absolute;right:0;top:0;bottom:0;transition:width var(--ds-transition-duration-slow,.2s) var(--ds-ease-in-out,ease);width:var(--lbs-right-column,56px)}.lbs-right-sidebar[data-dragging=true]{transition:none}.lbs-right-top{align-items:center;box-sizing:border-box;display:flex;flex:none;height:60px;justify-content:center;padding:8px 10px}.lbs-right-sidebar[data-expanded=true] .lbs-right-top{justify-content:space-between;padding:8px 16px}.lbs-right-brand{display:flex;flex-direction:column;min-width:0}.lbs-right-brand-title{font-size:14px;font-weight:600;line-height:19px}.lbs-right-brand-sub{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px}.lbs-right-toggle{appearance:none;align-items:center;background:transparent;border:0;border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;height:32px;justify-content:center;padding:0;width:32px}.lbs-right-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-right-nav{display:flex;flex:none;flex-direction:column;gap:2px;padding:4px 10px}.lbs-right-nav-group+.lbs-right-nav-group{border-top:1px solid var(--dsw-alias-border-l1);margin-top:6px;padding-top:8px}.lbs-right-nav-title{color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:550;letter-spacing:.04em;line-height:22px;overflow:hidden;padding:0 10px;text-overflow:ellipsis;white-space:nowrap}.lbs-right-nav-bottom{border-top:1px solid var(--dsw-alias-border-l1);margin-top:auto;padding-bottom:8px;padding-top:8px}.lbs-right-sidebar[data-expanded=false] .lbs-right-nav{align-items:center;padding-left:8px;padding-right:8px}.lbs-right-sidebar[data-expanded=false] .lbs-right-nav-title{display:none}.lbs-nav-button{appearance:none;background:transparent;border:0;border-radius:9px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;align-items:center;gap:10px;font:inherit;font-size:13px;height:38px;padding:0 10px;text-align:left;transition:background .12s,color .12s;width:100%}.lbs-nav-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-nav-button[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-right-sidebar[data-expanded=false] .lbs-nav-button{justify-content:center;padding:0;width:36px}.lbs-nav-icon{align-items:center;color:currentColor;display:inline-flex;flex:none;height:18px;justify-content:center;width:18px}.lbs-nav-svg{display:block}.lbs-nav-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-right-spacer{flex:1;min-height:8px}.lbs-right-resizer{cursor:col-resize;position:absolute;bottom:0;left:-5px;top:0;width:10px}.lbs-right-resizer:after{background:var(--dsw-alias-border-l2);content:"";opacity:0;position:absolute;bottom:0;left:4px;top:0;width:1px;transition:opacity .15s}.lbs-right-resizer:hover:after,.lbs-right-sidebar[data-dragging=true] .lbs-right-resizer:after{opacity:1}.lbs-center-page{background:var(--dsw-alias-bg-base);box-sizing:border-box;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;pointer-events:auto;position:absolute;left:var(--lbs-left-column,280px);right:var(--lbs-right-column,56px);top:0;bottom:0}.lbs-center-bar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;display:flex;flex:none;height:56px;justify-content:space-between;padding:0 clamp(16px,2.4vw,32px)}.lbs-center-crumb{align-items:center;display:flex;gap:9px}.lbs-center-crumb-icon{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;height:20px;justify-content:center;width:20px}.lbs-center-crumb-title{font-size:15px;font-weight:600}.lbs-center-close{appearance:none;background:transparent;border:0;border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;height:32px;padding:0 10px}.lbs-center-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-center-scroll{box-sizing:border-box;flex:1;min-height:0;overflow:auto;padding:22px clamp(16px,3vw,40px) 32px}.lbs-center-content{margin:0 auto;max-width:1180px}.lbs-settings-actions{display:flex;flex-wrap:wrap;gap:8px}.lbs-settings-note{margin-top:2px}.lbs-upload-options{display:flex;flex-direction:column;gap:8px;margin-top:10px}.lbs-upload-option{align-items:flex-start;border:1px solid var(--dsw-alias-line-border);border-radius:10px;cursor:pointer;display:flex;gap:9px;padding:11px 12px}.lbs-upload-option:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-upload-option input{accent-color:var(--dsw-alias-brand-primary);margin-top:3px}.lbs-upload-option-title{font-size:13px;font-weight:550;line-height:19px}.lbs-upload-option-path{color:var(--dsw-alias-label-tertiary);font:11px/18px ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
      .lbs-toggle-icon{display:block;transition:transform .16s ease}.lbs-toggle-icon[data-expanded=true]{transform:rotate(180deg)}.lbs-nav-icon{background:transparent;border:0;height:18px;width:18px}.lbs-right-sidebar[data-expanded=false] .lbs-nav-icon{height:18px;width:18px}
      .lbs-settings-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:16px}.lbs-settings-section{padding:2px 0}.lbs-settings-list{display:flex;flex-direction:column;gap:0}.lbs-settings-row{appearance:none;background:transparent;border:0;border-bottom:1px solid var(--dsw-alias-line-border);border-radius:8px;color:inherit;cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 0;text-align:left;width:100%}.lbs-settings-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-settings-row>div:first-child{flex:1;min-width:0}.lbs-settings-row:last-child{border-bottom:0}.lbs-settings-row-arrow{color:var(--dsw-alias-label-tertiary);display:flex;flex:none}@media(max-width:900px){.lbs-settings-grid{grid-template-columns:1fr}}
      .lbs-right-sidebar[data-expanded=true] .lbs-right-nav{padding-left:6px;padding-right:6px}.lbs-right-sidebar[data-expanded=true] .lbs-nav-button{gap:8px;padding-left:8px;padding-right:8px}.lbs-right-sidebar[data-expanded=true] .lbs-right-top{padding-left:10px;padding-right:10px}
      .lbs-badge{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);display:inline-flex;font-size:11px;line-height:20px;padding:0 8px}.lbs-card-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.lbs-help{background:var(--dsw-alias-bg-layer-2);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;padding:10px 12px}.lbs-select{appearance:auto}.lbs-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lbs-status-dot{border-radius:50%;display:inline-block;height:7px;margin-right:6px;width:7px}.lbs-status-dot[data-state=running]{background:#2a9b67}.lbs-status-dot[data-state=connecting],.lbs-status-dot[data-state=restarting],.lbs-status-dot[data-state=pending]{background:#d49a29}.lbs-status-dot[data-state=error]{background:#d94b4b}.lbs-status-dot[data-state=disabled]{background:var(--dsw-alias-label-quaternary)}.lbs-tool-list{display:flex;flex-wrap:wrap;gap:5px}.lbs-tool{background:var(--dsw-alias-bg-layer-2);border-radius:6px;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;padding:3px 6px}
      .lbs-prompt-area{min-height:280px}.lbs-char-count{color:var(--dsw-alias-label-tertiary);font-size:11px;text-align:right}.lbs-page .lbs-head{flex:none}.lbs-extension-slot{border:1px dashed var(--dsw-alias-line-border);border-radius:10px;display:flex;flex-direction:column;gap:8px;padding:10px}.lbs-slot-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.lbs-management-layout{display:flex;flex-direction:column;gap:12px}.lbs-management-toolbar{align-items:center;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between}.lbs-management-search{max-width:340px;min-width:200px}.lbs-management-toolbar-actions{display:flex;flex-wrap:wrap;gap:8px}.lbs-management-table-wrap{border:1px solid var(--dsw-alias-line-border);border-radius:12px;overflow:auto}.lbs-management-table{border-collapse:collapse;min-width:790px;width:100%}.lbs-management-table th{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:550;letter-spacing:.02em;padding:9px 10px;text-align:left;white-space:nowrap}.lbs-management-table td{border-bottom:1px solid var(--dsw-alias-line-border);font-size:12px;padding:10px;vertical-align:middle}.lbs-management-table tr:last-child td{border-bottom:0}.lbs-management-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover)}.lbs-table-primary{font-size:13px;font-weight:550;line-height:19px}.lbs-table-description{color:var(--dsw-alias-label-secondary);line-height:18px;max-width:330px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-table-status{align-items:center;display:inline-flex;gap:5px;white-space:nowrap}.lbs-table-actions{display:flex;gap:5px;justify-content:flex-end;white-space:nowrap}.lbs-table-action,.lbs-path-button{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-brand-primary);cursor:pointer;font:inherit;font-size:12px;line-height:24px;padding:0 6px;text-align:left}.lbs-table-action:hover,.lbs-path-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-table-action.danger{color:#d94b4b}.lbs-path-button{color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;max-width:250px;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;white-space:nowrap}.lbs-management-editor{min-width:0}.lbs-compat-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.lbs-editor-location{align-items:center;display:flex;gap:8px;min-width:0}.lbs-editor-location .lbs-path-button{max-width:min(680px,72vw)}
      .lbs-knowledge-layout{display:grid;grid-template-columns:240px minmax(0,1fr);gap:14px;align-items:start}.lbs-knowledge-sidebar{padding:10px;position:sticky;top:0}.lbs-knowledge-sidebar-head{align-items:center;display:flex;justify-content:space-between;padding:3px 4px 10px}.lbs-knowledge-list{display:flex;flex-direction:column;gap:4px}.lbs-knowledge-collection{appearance:none;align-items:center;background:transparent;border:1px solid transparent;border-radius:10px;color:inherit;cursor:pointer;display:grid;gap:9px;grid-template-columns:30px minmax(0,1fr) 8px;padding:9px;text-align:left;width:100%}.lbs-knowledge-collection:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-knowledge-collection[data-active=true]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-line-border)}.lbs-knowledge-collection-icon,.lbs-knowledge-document-icon{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:8px;color:var(--dsw-alias-label-secondary);display:flex;font-size:12px;height:28px;justify-content:center;width:28px}.lbs-knowledge-collection-copy,.lbs-knowledge-document-copy{display:flex;flex-direction:column;min-width:0}.lbs-knowledge-collection-copy>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-status-dot{background:var(--dsw-alias-label-quaternary);border-radius:50%;height:7px;width:7px}.lbs-knowledge-status-dot[data-enabled=true]{background:#2a9b67}.lbs-knowledge-empty{min-height:220px;padding:10px}.lbs-knowledge-main{display:flex;flex-direction:column;gap:12px;min-width:0}.lbs-knowledge-overview{display:grid;gap:14px;grid-template-columns:minmax(0,1fr) auto;padding:16px}.lbs-knowledge-name{font-size:19px;font-weight:600;line-height:26px;margin:0}.lbs-knowledge-overview-main{min-width:0}.lbs-knowledge-toggle{appearance:none;align-items:center;align-self:start;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;font:inherit;gap:7px;height:32px;padding:0 10px}.lbs-knowledge-toggle>span{background:var(--dsw-alias-label-quaternary);border-radius:50%;height:8px;width:8px}.lbs-knowledge-toggle>strong{font-size:12px;font-weight:550}.lbs-knowledge-toggle.is-on{background:rgba(44,168,110,.09);border-color:rgba(44,168,110,.25);color:#2a9b67}.lbs-knowledge-toggle.is-on>span{background:#2a9b67}.lbs-knowledge-stats{border-top:1px solid var(--dsw-alias-line-border);display:grid;gap:8px;grid-column:1/-1;grid-template-columns:repeat(3,1fr);padding-top:13px}.lbs-knowledge-stats>div{display:flex;flex-direction:column;gap:2px}.lbs-knowledge-stats strong{font-size:17px;font-weight:600}.lbs-knowledge-stats span{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-knowledge-section{display:flex;flex-direction:column;gap:12px;padding:14px}.lbs-knowledge-section-head{align-items:flex-start;display:flex;justify-content:space-between;gap:10px}.lbs-retrieval-form{display:flex;gap:8px}.lbs-retrieval-form .lbs-input{flex:1}.lbs-retrieval-results{display:flex;flex-direction:column;gap:8px}.lbs-retrieval-result{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:10px;padding:11px 12px}.lbs-relevance{background:rgba(44,168,110,.1);border-radius:999px;color:#2a9b67;flex:none;font-size:10px;line-height:21px;padding:0 8px}.lbs-relevance[data-level="可能相关"]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary)}.lbs-retrieval-snippet{color:var(--dsw-alias-label-secondary);display:-webkit-box;font-size:12px;line-height:19px;margin:8px 0 0;overflow:hidden;white-space:pre-wrap;-webkit-box-orient:vertical;-webkit-line-clamp:5}.lbs-knowledge-documents{display:flex;flex-direction:column}.lbs-knowledge-document{align-items:center;border-bottom:1px solid var(--dsw-alias-line-border);display:grid;gap:10px;grid-template-columns:30px minmax(0,1fr) auto;padding:10px 2px}.lbs-knowledge-document:last-child{border-bottom:0}.lbs-knowledge-document-copy .lbs-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-editor{background:var(--dsw-alias-bg-layer-2);border-radius:10px;display:flex;flex-direction:column;gap:10px;margin-top:3px;padding:12px}.lbs-knowledge-editor>.lbs-button{align-self:flex-start}.lbs-knowledge-settings{gap:11px}.lbs-knowledge-main-empty{min-height:360px}@media(max-width:860px){.lbs-knowledge-layout{grid-template-columns:1fr}.lbs-knowledge-sidebar{position:static}.lbs-knowledge-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.lbs-knowledge-list,.lbs-knowledge-stats,.lbs-split{grid-template-columns:1fr}.lbs-knowledge-overview{grid-template-columns:1fr}.lbs-retrieval-form{align-items:stretch;flex-direction:column}.lbs-knowledge-document{grid-template-columns:30px minmax(0,1fr)}.lbs-knowledge-document>.lbs-row{grid-column:2}}
      .lbs-knowledge-list-panel{overflow:hidden;padding:0}.lbs-knowledge-list-scroll{overflow:auto}.lbs-knowledge-table{min-width:820px}.lbs-knowledge-table-head,.lbs-knowledge-row{align-items:center;display:grid;grid-template-columns:minmax(260px,1fr) 88px 112px 74px 82px 132px 80px}.lbs-knowledge-table-head{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:550;letter-spacing:.02em;min-height:38px}.lbs-knowledge-table-head>span,.lbs-knowledge-cell{box-sizing:border-box;padding:0 12px}.lbs-knowledge-row{border-bottom:1px solid var(--dsw-alias-line-border);min-height:66px;transition:background .12s}.lbs-knowledge-row:last-child{border-bottom:0}.lbs-knowledge-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-knowledge-primary{align-items:center;display:flex;gap:10px;min-width:0}.lbs-knowledge-list-icon{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:8px;color:var(--dsw-alias-label-secondary);display:flex;flex:none;height:32px;justify-content:center;width:32px}.lbs-knowledge-row-copy{display:flex;flex-direction:column;min-width:0}.lbs-knowledge-row-title{font-size:13px;font-weight:550;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-row-description{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-cell{color:var(--dsw-alias-label-secondary);font-size:12px}.lbs-knowledge-list-status{align-items:center;display:inline-flex;white-space:nowrap}.lbs-knowledge-list-actions{display:flex;gap:4px;justify-content:flex-end}.lbs-icon-action{appearance:none;align-items:center;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;height:30px;justify-content:center;padding:0;width:30px}.lbs-icon-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-icon-action.danger:hover{background:rgba(218,70,70,.1);color:#d94b4b}.lbs-knowledge-list-empty{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:10px;justify-content:center;min-height:240px;padding:24px;text-align:center}.lbs-knowledge-list-empty .lbs-knowledge-list-icon{height:40px;width:40px}.lbs-knowledge-modal-layer{align-items:center;bottom:0;display:flex;justify-content:center;left:var(--lbs-left-column,280px);padding:24px;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:90}.lbs-knowledge-modal-backdrop{appearance:none;background:rgba(0,0,0,.48);border:0;bottom:0;cursor:default;left:0;padding:0;position:absolute;right:0;top:0;width:100%}.lbs-knowledge-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:16px;box-shadow:0 22px 64px rgba(0,0,0,.28);display:flex;flex-direction:column;max-height:calc(100vh - 48px);max-width:860px;min-height:0;position:relative;width:100%;z-index:1}.lbs-knowledge-modal-head{align-items:center;border-bottom:1px solid var(--dsw-alias-line-border);display:flex;flex:none;gap:11px;padding:15px 18px}.lbs-knowledge-modal-head-copy{display:flex;flex:1;flex-direction:column;min-width:0}.lbs-knowledge-modal-title{font-size:16px;font-weight:600;line-height:23px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-modal-scroll{min-height:0;overflow:auto}.lbs-knowledge-modal-feedback{padding:12px 20px 0}.lbs-knowledge-modal-section{display:flex;flex-direction:column;gap:12px;padding:17px 20px}.lbs-knowledge-modal-section+.lbs-knowledge-modal-section{border-top:1px solid var(--dsw-alias-line-border)}.lbs-knowledge-modal-section-head{align-items:flex-start;display:flex;gap:12px;justify-content:space-between}.lbs-knowledge-modal-section-title{font-size:14px;font-weight:600;line-height:21px}.lbs-knowledge-modal-stats{display:grid;grid-template-columns:repeat(3,1fr)}.lbs-knowledge-modal-stat{display:flex;flex-direction:column;gap:2px;padding:4px 0}.lbs-knowledge-modal-stat+.lbs-knowledge-modal-stat{border-left:1px solid var(--dsw-alias-line-border);padding-left:20px}.lbs-knowledge-modal-stat strong{font-size:18px;font-weight:600;line-height:25px}.lbs-knowledge-modal-stat span{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-knowledge-modal-footer{align-items:center;border-top:1px solid var(--dsw-alias-line-border);display:flex;flex:none;gap:8px;justify-content:space-between;padding:13px 18px}.lbs-knowledge-modal-footer-actions{display:flex;gap:8px}.lbs-knowledge-document-icon{font-size:0}.lbs-knowledge-document-actions{display:flex;gap:4px}.lbs-knowledge-document-actions .lbs-icon-action{height:28px;width:28px}@media(max-width:900px){.lbs-knowledge-modal-layer{left:0;right:0}}@media(max-width:600px){.lbs-knowledge-modal-layer{padding:10px}.lbs-knowledge-modal{border-radius:12px;max-height:calc(100vh - 20px)}.lbs-knowledge-modal-section{padding:15px}.lbs-knowledge-modal-stats{grid-template-columns:1fr}.lbs-knowledge-modal-stat+.lbs-knowledge-modal-stat{border-left:0;border-top:1px solid var(--dsw-alias-line-border);padding-left:0;padding-top:10px}.lbs-knowledge-modal-footer{align-items:stretch;flex-direction:column}.lbs-knowledge-modal-footer-actions{display:grid;grid-template-columns:1fr 1fr}.lbs-knowledge-modal-footer .lbs-button{width:100%}}
      /* ── 知识库列表：统一搜索、筛选、表格与操作控件 ── */
      .lbs-knowledge-page{gap:18px}.lbs-knowledge-head-summary{align-items:baseline;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);display:flex;font-size:12px;gap:4px;height:30px;padding:0 11px;white-space:nowrap}.lbs-knowledge-head-summary strong{color:var(--dsw-alias-label-primary);font-size:13px;font-variant-numeric:tabular-nums;font-weight:600}.lbs-knowledge-list-panel{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.lbs-knowledge-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-line-border);display:flex;gap:10px;min-height:60px;padding:10px 12px}.lbs-knowledge-search{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:10px;box-sizing:border-box;color:var(--dsw-alias-label-tertiary);display:flex;flex:1;gap:8px;height:36px;max-width:420px;min-width:220px;padding:0 9px;transition:border-color .14s,box-shadow .14s,background .14s}.lbs-knowledge-search:focus-within{background:var(--dsw-alias-bg-layer-1);border-color:var(--dsw-alias-line-border-focus);box-shadow:0 0 0 2px rgba(88,132,255,.12);color:var(--dsw-alias-label-secondary)}.lbs-knowledge-search input{appearance:none;background:transparent;border:0;color:var(--dsw-alias-label-primary);flex:1;font:inherit;font-size:12px;min-width:0;outline:0;padding:0}.lbs-knowledge-search input::placeholder{color:var(--dsw-alias-label-quaternary)}.lbs-knowledge-search>button{appearance:none;align-items:center;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:flex;flex:none;height:24px;justify-content:center;padding:0;width:24px}.lbs-knowledge-search>button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-knowledge-filters{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:10px;display:inline-flex;flex:none;gap:2px;padding:3px}.lbs-knowledge-filters button{appearance:none;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:12px;height:28px;padding:0 11px;transition:background .12s,color .12s,box-shadow .12s;white-space:nowrap}.lbs-knowledge-filters button:hover{color:var(--dsw-alias-label-primary)}.lbs-knowledge-filters button[data-active=true]{background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px rgba(0,0,0,.12);color:var(--dsw-alias-label-primary);font-weight:550}.lbs-knowledge-toolbar-count{color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;margin-left:auto;min-width:38px;text-align:right;white-space:nowrap}.lbs-knowledge-toolbar>.lbs-icon-action{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);height:32px;width:32px}.lbs-knowledge-toolbar>.lbs-icon-action:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-line-border-hover)}.lbs-icon-action:disabled{cursor:not-allowed;opacity:.45}.lbs-icon-action.is-spinning svg{animation:lbs-knowledge-spin .8s linear infinite}@keyframes lbs-knowledge-spin{to{transform:rotate(360deg)}}.lbs-knowledge-table{min-width:900px}.lbs-knowledge-table-head,.lbs-knowledge-row{grid-template-columns:minmax(300px,1fr) 96px 116px 76px 76px 142px 112px}.lbs-knowledge-table-head{background:var(--dsw-alias-bg-layer-2);min-height:42px}.lbs-knowledge-table-head>span{padding:0 14px}.lbs-knowledge-actions-heading{text-align:right}.lbs-knowledge-row{background:var(--dsw-alias-bg-layer-1);min-height:72px}.lbs-knowledge-cell{padding:0 14px}.lbs-knowledge-primary{gap:0;padding-right:8px}.lbs-knowledge-primary-button{appearance:none;align-items:center;background:transparent;border:0;border-radius:9px;color:inherit;cursor:pointer;display:flex;gap:11px;min-width:0;padding:6px 8px;text-align:left;width:100%}.lbs-knowledge-primary-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-knowledge-primary-button:focus-visible{box-shadow:0 0 0 2px rgba(88,132,255,.2);outline:1px solid var(--dsw-alias-line-border-focus)}.lbs-knowledge-primary-button:hover .lbs-knowledge-list-icon{border-color:var(--dsw-alias-line-border-hover);color:var(--dsw-alias-label-primary)}.lbs-knowledge-list-icon{background:var(--dsw-alias-bg-layer-2);border-radius:9px;height:34px;width:34px}.lbs-knowledge-row-title{font-size:13px;line-height:19px}.lbs-knowledge-row-description{font-size:11px;line-height:17px}.lbs-knowledge-scope,.lbs-knowledge-list-status{align-items:center;border:1px solid var(--dsw-alias-line-border);border-radius:999px;box-sizing:border-box;display:inline-flex;font-size:11px;height:24px;padding:0 8px;white-space:nowrap}.lbs-knowledge-scope{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}.lbs-knowledge-list-status{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);gap:6px}.lbs-knowledge-list-status[data-enabled=true]{background:rgba(44,168,110,.08);border-color:rgba(44,168,110,.2);color:#2a9b67}.lbs-knowledge-list-status .lbs-knowledge-status-dot{height:6px;width:6px}.lbs-knowledge-number{font-variant-numeric:tabular-nums}.lbs-knowledge-list-actions{gap:3px}.lbs-knowledge-list-actions .lbs-icon-action{border:1px solid transparent;height:30px;width:30px}.lbs-knowledge-list-actions .lbs-icon-action:hover{border-color:var(--dsw-alias-line-border)}.lbs-knowledge-list-actions .lbs-icon-action.danger:hover{border-color:rgba(218,70,70,.2)}.lbs-knowledge-list-empty.compact{min-height:150px}.lbs-knowledge-loading{animation:lbs-knowledge-spin .8s linear infinite;border:2px solid var(--dsw-alias-line-border);border-radius:50%;border-top-color:var(--dsw-alias-label-secondary);display:block;height:18px;width:18px}.lbs-retrieval-form .lbs-input{height:38px}.lbs-retrieval-form .lbs-button{flex:none;height:38px;min-width:92px}.lbs-knowledge-modal .lbs-input{min-height:38px}.lbs-knowledge-modal-footer .lbs-button{min-width:84px}.lbs-knowledge-modal-footer>.lbs-button.danger{background:transparent;border:1px solid rgba(218,70,70,.24)}.lbs-knowledge-modal-footer>.lbs-button.danger:hover{background:rgba(218,70,70,.1)}
      .lbs-knowledge-activity-modal{max-width:720px}.lbs-knowledge-activity-overview{border-bottom:1px solid var(--dsw-alias-line-border);display:grid;grid-template-columns:repeat(3,1fr);padding:16px 20px}.lbs-knowledge-activity-stat{display:flex;flex-direction:column;gap:2px}.lbs-knowledge-activity-stat+.lbs-knowledge-activity-stat{border-left:1px solid var(--dsw-alias-line-border);padding-left:20px}.lbs-knowledge-activity-stat strong{font-size:17px;font-weight:600}.lbs-knowledge-activity-stat span{color:var(--dsw-alias-label-tertiary);font-size:11px}.lbs-knowledge-activity-note{background:var(--dsw-alias-bg-layer-2);border-radius:9px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px;margin:14px 20px 0;padding:9px 11px}.lbs-knowledge-activity-section{padding:16px 20px 20px}.lbs-knowledge-activity-heading{align-items:flex-start;display:flex;gap:10px;justify-content:space-between;margin-bottom:10px}.lbs-knowledge-activity-loading,.lbs-knowledge-activity-empty{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:12px;gap:8px;justify-content:center;min-height:100px}.lbs-knowledge-timeline{display:flex;flex-direction:column}.lbs-knowledge-timeline-item{display:grid;gap:10px;grid-template-columns:12px minmax(0,1fr) auto;padding:10px 0}.lbs-knowledge-timeline-item+.lbs-knowledge-timeline-item{border-top:1px solid var(--dsw-alias-line-border)}.lbs-knowledge-timeline-marker{background:var(--dsw-alias-label-quaternary);border:3px solid var(--dsw-alias-bg-layer-1);border-radius:50%;box-shadow:0 0 0 1px var(--dsw-alias-line-border);height:7px;margin-top:6px;width:7px}.lbs-knowledge-timeline-marker[data-type=document]{background:#2a9b67}.lbs-knowledge-timeline-copy{min-width:0}.lbs-knowledge-timeline-time{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}
      @media(max-width:760px){.lbs-knowledge-head-summary{display:none}.lbs-knowledge-toolbar{align-items:stretch;flex-wrap:wrap}.lbs-knowledge-search{max-width:none;width:100%}.lbs-knowledge-filters{order:2}.lbs-knowledge-toolbar-count{margin-left:auto;order:2}.lbs-knowledge-toolbar>.lbs-icon-action{order:2}.lbs-knowledge-activity-overview{grid-template-columns:1fr}.lbs-knowledge-activity-stat+.lbs-knowledge-activity-stat{border-left:0;border-top:1px solid var(--dsw-alias-line-border);margin-top:9px;padding-left:0;padding-top:9px}}
      .lbs-knowledge-page{gap:12px}.lbs-knowledge-head-summary{align-items:baseline;color:var(--dsw-alias-label-tertiary);display:flex;flex:none;font-size:12px;gap:5px;white-space:nowrap}.lbs-knowledge-head-summary strong{color:var(--dsw-alias-label-primary);font-size:18px;font-weight:600}.lbs-knowledge-list-panel{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-line-border);border-radius:11px;overflow:hidden;padding:0}.lbs-knowledge-toolbar{align-items:center;border-bottom:1px solid var(--dsw-alias-line-border);display:grid;gap:10px;grid-template-columns:minmax(220px,380px) auto minmax(24px,1fr) 30px;min-height:52px;padding:8px 10px}.lbs-knowledge-search{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid transparent;border-radius:8px;box-sizing:border-box;color:var(--dsw-alias-label-tertiary);display:flex;gap:7px;height:34px;padding:0 9px}.lbs-knowledge-search:focus-within{border-color:var(--dsw-alias-line-border-focus);color:var(--dsw-alias-label-secondary)}.lbs-knowledge-search input{background:transparent;border:0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;min-width:0;outline:0;width:100%}.lbs-knowledge-search input::placeholder{color:var(--dsw-alias-label-tertiary)}.lbs-knowledge-search button{appearance:none;align-items:center;background:transparent;border:0;border-radius:5px;color:inherit;cursor:pointer;display:flex;flex:none;height:24px;justify-content:center;padding:0;width:24px}.lbs-knowledge-search button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-knowledge-filters{align-items:center;background:var(--dsw-alias-bg-layer-2);border-radius:8px;display:flex;padding:2px}.lbs-knowledge-filters button{appearance:none;background:transparent;border:0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px;height:28px;padding:0 10px;white-space:nowrap}.lbs-knowledge-filters button:hover{color:var(--dsw-alias-label-primary)}.lbs-knowledge-filters button[data-active=true]{background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 3px rgba(0,0,0,.08);color:var(--dsw-alias-label-primary);font-weight:550}.lbs-knowledge-toolbar-count{color:var(--dsw-alias-label-tertiary);font-size:11px;justify-self:end;white-space:nowrap}.lbs-icon-action:disabled{cursor:not-allowed;opacity:.45}.lbs-icon-action.is-spinning svg{animation:lbs-knowledge-spin .75s linear infinite}@keyframes lbs-knowledge-spin{to{transform:rotate(360deg)}}
      .lbs-knowledge-list-scroll{overflow:auto}.lbs-knowledge-table{min-width:680px}.lbs-knowledge-table-head,.lbs-knowledge-row{align-items:center;display:grid;grid-template-columns:minmax(220px,1fr) 70px 84px 46px 50px 96px 116px}.lbs-knowledge-table-head{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:550;letter-spacing:.04em;min-height:34px;text-transform:none}.lbs-knowledge-row{border-bottom:1px solid var(--dsw-alias-line-border);min-height:58px;transition:background .12s}.lbs-knowledge-row:last-child{border-bottom:0}.lbs-knowledge-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-knowledge-table-head>span,.lbs-knowledge-cell{box-sizing:border-box;padding:0 8px}.lbs-knowledge-primary{display:block;min-width:0;padding:0 3px}.lbs-knowledge-primary-button{appearance:none;align-items:center;background:transparent;border:0;border-radius:7px;color:inherit;cursor:pointer;display:flex;gap:10px;min-width:0;padding:7px 8px;text-align:left;width:100%}.lbs-knowledge-primary-button:hover .lbs-knowledge-row-title{color:var(--dsw-alias-brand-primary)}.lbs-knowledge-list-icon{border-radius:7px;height:30px;width:30px}.lbs-knowledge-row-copy{display:flex;flex-direction:column;min-width:0}.lbs-knowledge-row-title{font-size:13px;font-weight:550;line-height:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-row-description{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-cell{color:var(--dsw-alias-label-secondary);font-size:11px}.lbs-knowledge-scope{color:var(--dsw-alias-label-tertiary);white-space:nowrap}.lbs-knowledge-list-status{align-items:center;display:inline-flex;gap:5px;white-space:nowrap}.lbs-knowledge-list-status[data-enabled=true]{color:#2a9b67}.lbs-knowledge-number{font-variant-numeric:tabular-nums}.lbs-knowledge-list-actions{display:flex;gap:3px;justify-content:flex-end;padding-left:10px;padding-right:10px}.lbs-knowledge-actions-heading{text-align:right}.lbs-icon-action{height:28px;width:28px}.lbs-knowledge-list-actions .lbs-icon-action{border:1px solid transparent}.lbs-knowledge-list-actions .lbs-icon-action:hover{border-color:var(--dsw-alias-line-border)}.lbs-knowledge-list-empty{min-height:220px}.lbs-knowledge-list-empty.compact{flex-direction:row;min-height:140px}.lbs-knowledge-loading{animation:lbs-knowledge-spin .8s linear infinite;border:2px solid var(--dsw-alias-line-border);border-radius:50%;border-top-color:var(--dsw-alias-brand-primary);display:inline-block;flex:none;height:16px;width:16px}.lbs-knowledge-primary-button:focus-visible,.lbs-icon-action:focus-visible,.lbs-knowledge-filters button:focus-visible,.lbs-knowledge-search button:focus-visible{outline:2px solid var(--dsw-alias-line-border-focus);outline-offset:1px}
      .lbs-knowledge-modal{border-radius:13px}.lbs-knowledge-modal-head{padding:13px 16px}.lbs-knowledge-modal-section{padding:16px 18px}.lbs-knowledge-modal-footer{padding:11px 16px}.lbs-knowledge-activity-modal{max-width:700px}.lbs-knowledge-activity-overview{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);display:grid;grid-template-columns:repeat(3,1fr);padding:14px 18px}.lbs-knowledge-activity-stat{display:flex;flex-direction:column;gap:1px}.lbs-knowledge-activity-stat+.lbs-knowledge-activity-stat{border-left:1px solid var(--dsw-alias-line-border);padding-left:18px}.lbs-knowledge-activity-stat strong{font-size:16px;font-weight:600;line-height:23px}.lbs-knowledge-activity-stat span{color:var(--dsw-alias-label-tertiary);font-size:10px}.lbs-knowledge-activity-note{background:rgba(92,117,255,.07);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;padding:10px 18px}.lbs-knowledge-activity-section{padding:15px 18px 18px}.lbs-knowledge-activity-heading{align-items:center;display:flex;justify-content:space-between;margin-bottom:9px}.lbs-knowledge-timeline{display:flex;flex-direction:column}.lbs-knowledge-timeline-item{align-items:center;display:grid;grid-template-columns:15px 30px minmax(0,1fr) 106px;min-height:54px}.lbs-knowledge-timeline-rail{align-self:stretch;position:relative}.lbs-knowledge-timeline-rail:before{background:var(--dsw-alias-line-border);bottom:0;content:"";left:7px;position:absolute;top:0;width:1px}.lbs-knowledge-timeline-rail>span{background:var(--dsw-alias-brand-primary);border:3px solid var(--dsw-alias-bg-layer-1);border-radius:50%;height:7px;left:4px;position:absolute;top:23px;width:7px;z-index:1}.lbs-knowledge-timeline-icon{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:7px;color:var(--dsw-alias-label-secondary);display:flex;height:26px;justify-content:center;width:26px}.lbs-knowledge-timeline-copy{min-width:0;padding:6px 10px}.lbs-knowledge-timeline-copy>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-knowledge-timeline-item time{color:var(--dsw-alias-label-tertiary);font-size:10px;text-align:right;white-space:nowrap}.lbs-knowledge-activity-loading,.lbs-knowledge-activity-empty{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:11px;gap:8px;justify-content:center;min-height:110px}.lbs-knowledge-activity-empty{border:1px dashed var(--dsw-alias-line-border);border-radius:9px}
      @media(max-width:760px){.lbs-knowledge-toolbar{grid-template-columns:minmax(0,1fr) auto 30px}.lbs-knowledge-search{grid-column:1/-1}.lbs-knowledge-toolbar-count{justify-self:end}.lbs-knowledge-table{min-width:0}.lbs-knowledge-table-head,.lbs-knowledge-row{grid-template-columns:minmax(0,1fr) 96px 108px}.lbs-knowledge-table-head>span:nth-child(2),.lbs-knowledge-table-head>span:nth-child(4),.lbs-knowledge-table-head>span:nth-child(5),.lbs-knowledge-table-head>span:nth-child(6),.lbs-knowledge-row>.lbs-knowledge-cell:nth-child(2),.lbs-knowledge-row>.lbs-knowledge-cell:nth-child(4),.lbs-knowledge-row>.lbs-knowledge-cell:nth-child(5),.lbs-knowledge-row>.lbs-knowledge-cell:nth-child(6){display:none}.lbs-knowledge-head-summary span{display:none}.lbs-knowledge-timeline-item{grid-template-columns:15px 30px minmax(0,1fr)}.lbs-knowledge-timeline-item time{grid-column:3;padding:0 10px 7px;text-align:left}.lbs-knowledge-modal-head .lbs-badge{display:none}}
      @media(max-width:600px){.lbs-knowledge-toolbar{grid-template-columns:minmax(0,1fr) 30px}.lbs-knowledge-filters{overflow:auto}.lbs-knowledge-toolbar-count{display:none}.lbs-knowledge-table-head,.lbs-knowledge-row{grid-template-columns:minmax(0,1fr) 100px}.lbs-knowledge-table-head>span:nth-child(3),.lbs-knowledge-row>.lbs-knowledge-cell:nth-child(3){display:none}.lbs-knowledge-activity-overview{grid-template-columns:repeat(3,1fr);padding:12px 14px}.lbs-knowledge-activity-stat+.lbs-knowledge-activity-stat{padding-left:10px}.lbs-knowledge-activity-note,.lbs-knowledge-activity-section{padding-left:14px;padding-right:14px}.lbs-knowledge-activity-modal .lbs-knowledge-modal-footer>.lbs-meta{display:none}}
      @media(min-width:761px){.lbs-knowledge-table{min-width:780px}.lbs-knowledge-table-head,.lbs-knowledge-row{grid-template-columns:minmax(220px,1fr) 78px 94px 62px 62px 124px 126px}}
      .lbs-knowledge-modal .lbs-button{border:1px solid transparent;transition:background .12s,border-color .12s,filter .12s}.lbs-knowledge-modal .lbs-button:not(.secondary):not(.danger){background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}.lbs-knowledge-modal .lbs-button:not(.secondary):not(.danger):hover{filter:brightness(.92)}.lbs-knowledge-modal .lbs-button.secondary{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-line-border);color:var(--dsw-alias-label-primary)}.lbs-knowledge-modal .lbs-button.secondary:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-line-border-hover)}.lbs-knowledge-modal .lbs-button:disabled{filter:none;opacity:.42}
      @media(max-width:720px){.lbs-grid,.lbs-split{grid-template-columns:1fr}.lbs-panel{min-height:auto}}
      /* ── 设置面板平坦化：去遮罩、去圆角，平坦覆盖中央设置区（左右止于项目栏） ── */
      .VOzbGW_overlay{z-index:2147483000;justify-content:flex-start;align-items:stretch;left:var(--lbs-left-column,0px);right:var(--lbs-right-column,0px)}
      .VOzbGW_mask{display:none!important}
      .VOzbGW_panel{flex:1;width:auto;height:100vh;max-width:none;max-height:none;border-radius:0;box-shadow:none;background:var(--dsw-alias-bg-base)}
      .VOzbGW_nav{border-right:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;width:218px;padding:26px 14px 0;gap:22px}
      .VOzbGW_navTitle{padding:0 12px;font-size:15px}
      .VOzbGW_content{background:var(--dsw-alias-bg-base)}
      .VOzbGW_header{box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1);height:62px;padding:22px 28px 10px 20px}
      .VOzbGW_options{padding:0 clamp(24px,4vw,56px) 44px}
      /* ── 会话头视图 tabs（对话/轨迹）隐藏，切换入口移至右侧项目栏 ── */
      header [role="tablist"]{display:none!important}
      /* ── 隐藏统计行；输入框（对话框）下移一格 ── */
      .FJxK0a_root{display:none!important}
      [data-composer-seat]{padding-top:26px}
      /* ── Session log 按钮从会话头移入设置 ── */
      .nL4_yW_sessionLogButton{display:none!important}
      /* ── Codex 风格的整轮任务过程折叠 ── */
      .lbs-task-process-hidden{display:none!important}.lbs-task-final-collapsed [data-variant=think]{display:none!important}.lbs-task-summary{border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 0 8px}.lbs-task-summary-button{appearance:none;align-items:center;background:transparent;border:0;border-radius:7px;color:var(--dsw-alias-label-tertiary);cursor:pointer;display:flex;font:inherit;gap:7px;max-width:100%;min-height:28px;padding:2px 4px;text-align:left}.lbs-task-summary-button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.lbs-task-summary-status{border:1.5px solid currentColor;border-radius:50%;box-sizing:border-box;display:inline-block;flex:none;height:10px;opacity:.72;width:10px}.lbs-task-summary[data-state=done] .lbs-task-summary-status{display:none}.lbs-task-summary[data-state=running] .lbs-task-summary-status{border-right-color:transparent;animation:lbs-task-spin .8s linear infinite}.lbs-task-summary-label{font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-task-summary-chevron{display:inline-block;flex:none;font-size:17px;line-height:18px;transition:transform .16s ease}.lbs-task-summary[data-expanded=true] .lbs-task-summary-chevron{transform:rotate(90deg)}@keyframes lbs-task-spin{to{transform:rotate(360deg)}}
      /* ── 长对话定位轨道：刻度、当前轮和悬停摘要 ── */
      .lbs-conversation-locator{pointer-events:none;position:fixed;width:30px;z-index:40}.lbs-conversation-locator[hidden]{display:none}.lbs-conversation-locator-track{display:flex;flex-direction:column;gap:6px;left:2px;max-height:calc(100% - 8px);overflow-y:auto;pointer-events:auto;position:absolute;scrollbar-width:none;top:50%;transform:translateY(-50%);width:24px}.lbs-conversation-locator-track::-webkit-scrollbar{display:none}.lbs-conversation-locator-mark{appearance:none;background:transparent;border:0;cursor:pointer;flex:none;height:3px;margin:0;padding:0;position:relative;width:24px}.lbs-conversation-locator-mark:after{background:var(--dsw-alias-label-caption);content:"";height:1px;left:0;position:absolute;top:1px;transition:background .12s,width .12s;width:6px}.lbs-conversation-locator-mark:hover:after,.lbs-conversation-locator-mark:focus-visible:after{background:var(--dsw-alias-label-secondary);width:10px}.lbs-conversation-locator-mark[data-active=true]:after{background:var(--dsw-alias-label-primary);height:2px;top:0;width:18px}.lbs-conversation-locator-mark[data-loading=true]:after{animation:lbs-locator-pulse .8s ease-in-out infinite;background:var(--dsw-alias-state-business-primary);width:18px}@keyframes lbs-locator-pulse{50%{opacity:.35}}.lbs-conversation-locator-preview{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:var(--dsw-shadow-lv2);box-sizing:border-box;color:var(--dsw-alias-label-primary);opacity:0;padding:12px 14px;pointer-events:none;position:fixed;transform:translateX(-4px);transition:opacity .12s,transform .12s;width:min(320px,calc(100vw - 72px));z-index:41}.lbs-conversation-locator-preview[data-visible=true]{opacity:1;transform:translateX(0)}.lbs-conversation-locator-title{font-size:14px;font-weight:600;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-conversation-locator-answer{color:var(--dsw-alias-label-secondary);display:-webkit-box;font-size:13px;line-height:20px;margin-top:4px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2}.lbs-conversation-locator-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:900px){.lbs-conversation-locator,.lbs-conversation-locator-preview{display:none!important}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-system-tools"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-system-tools";
      style.textContent = css;
      document.head.appendChild(style);
    }

    const API = "/laobos/api/system-tools";
    async function request(path, options = {}) {
      const response = await fetch(API + path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) },
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value?.error?.message || `请求失败：${response.status}`);
      return value;
    }
    async function copyText(value) {
      const text = String(value || "");
      if (!text) return false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {}
      try {
        const element = document.createElement("textarea");
        element.value = text;
        element.setAttribute("readonly", "");
        element.style.cssText = "left:-9999px;position:fixed;top:0";
        document.body.append(element);
        element.select();
        const copied = document.execCommand("copy");
        element.remove();
        return copied;
      } catch {
        return false;
      }
    }
    function shortPath(value, limit = 54) {
      const text = String(value || "");
      return text.length <= limit ? text : `…${text.slice(1 - limit)}`;
    }
    const classNames = (...values) => values.filter(Boolean).join(" ");
    const projectIcons = {
      conversation: Primitives.IconNewChatOutline16,
      files: Primitives.IconFolderOpenOutline16,
      git: Primitives.IconBranchOutline16,
      workflows: Primitives.IconChecklistOutline14,
      knowledge: Primitives.IconDataOutline16,
      skills: Primitives.IconSkillOutline16,
      mcp: Primitives.IconApiOutline14,
      terminal: Primitives.IconCodeOutline16,
      browser: Primitives.IconBrowseOutline16,
      ssh: Primitives.IconLinkOutline16,
      apps: Primitives.IconCordisPluginOutline14,
      settings: Primitives.IconSettingsOutline16,
    };
    const ProjectNavIcon = ({ id }) => {
      const Icon = projectIcons[id] || Primitives.IconFolderOpenOutline16;
      return h(Icon, { size: 16, className: "lbs-nav-svg" });
    };
    const LineIcon = ({ name, size = 16 }) => {
      const props = { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
      const paths = {
        database: [h("ellipse", { key: "a", cx: 12, cy: 5, rx: 8, ry: 3 }), h("path", { key: "b", d: "M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" }), h("path", { key: "c", d: "M4 11v6c0 1.7 3.6 3 8 3 1.1 0 2.1-.1 3-.2" }), h("path", { key: "d", d: "m18 16 .7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2Z" })],
        edit: [h("path", { key: "a", d: "M4 20h4l11-11-4-4L4 16v4Z" }), h("path", { key: "b", d: "m13.5 6.5 4 4" })],
        activity: [h("path", { key: "a", d: "M3 12a9 9 0 1 0 3-6.7" }), h("path", { key: "b", d: "M3 4v5h5" }), h("path", { key: "c", d: "M12 7v5l3 2" })],
        refresh: [h("path", { key: "a", d: "M20 6v5h-5" }), h("path", { key: "b", d: "M4 18v-5h5" }), h("path", { key: "c", d: "M18.4 9A7 7 0 0 0 6.7 6.7L4 9" }), h("path", { key: "d", d: "M5.6 15A7 7 0 0 0 17.3 17.3L20 15" })],
        search: [h("circle", { key: "a", cx: 11, cy: 11, r: 7 }), h("path", { key: "b", d: "m20 20-4-4" })],
        eye: [h("path", { key: "a", d: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" }), h("circle", { key: "b", cx: 12, cy: 12, r: 2.5 })],
        power: [h("path", { key: "a", d: "M12 2v10" }), h("path", { key: "b", d: "M6.3 5.7a8 8 0 1 0 11.4 0" })],
        workflow: [h("rect", { key: "a", x: 3, y: 4, width: 7, height: 5, rx: 1 }), h("rect", { key: "b", x: 14, y: 15, width: 7, height: 5, rx: 1 }), h("path", { key: "c", d: "M10 6.5h2a4 4 0 0 1 4 4V15" }), h("path", { key: "d", d: "m13.5 12.5 2.5 2.5 2.5-2.5" })],
        trash: [h("path", { key: "a", d: "M3 6h18" }), h("path", { key: "b", d: "M8 6V4h8v2" }), h("path", { key: "c", d: "m19 6-1 15H6L5 6" }), h("path", { key: "d", d: "M10 11v5M14 11v5" })],
        close: [h("path", { key: "a", d: "m6 6 12 12" }), h("path", { key: "b", d: "M18 6 6 18" })],
        document: [h("path", { key: "a", d: "M6 3h8l4 4v14H6Z" }), h("path", { key: "b", d: "M14 3v5h5" }), h("path", { key: "c", d: "M9 13h6M9 17h6" })],
      };
      return h("svg", props, ...(paths[name] || paths.database));
    };
    const Button = ({ secondary, danger, ...props }) => h("button", { ...props, className: classNames("lbs-button", secondary && "secondary", danger && "danger", props.className) });
    const Field = ({ label, area, code, ...props }) => h("label", null,
      h("div", { className: "lbs-label" }, label),
      area
        ? h("textarea", { ...props, className: classNames("lbs-area", code && "lbs-code", props.className) })
        : h("input", { ...props, className: classNames("lbs-input", props.className) }),
    );
    const Status = ({ error, message }) => message ? h("div", { className: error ? "lbs-error" : "lbs-ok" }, message) : null;

    function PageHeader({ title, subtitle, action }) {
      return h("div", { className: "lbs-head" },
        h("div", null, h("div", { className: "lbs-title" }, title), subtitle ? h("div", { className: "lbs-sub" }, subtitle) : null),
        action || null,
      );
    }

    const conversationNavigation = [
      { id: "conversation", label: "对话", icon: "聊" },
      { id: "trajectory", label: "轨迹", icon: "迹" },
    ];
    const workbenchNavigation = [
      { id: "files", label: "文件管理器", icon: "文" },
      { id: "git", label: "版本中心", icon: "G" },
      { id: "workflows", label: "工作流", icon: "流" },
      { id: "knowledge", label: "知识库", icon: "知" },
    ];
    const integrationNavigation = [
      { id: "skills", label: "Skills", icon: "S" },
      { id: "mcp", label: "MCP", icon: "M" },
      { id: "terminal", label: "终端", icon: ">" },
      { id: "browser", label: "浏览器", icon: "览" },
      { id: "ssh", label: "SSH", icon: "远" },
      { id: "apps", label: "应用管理", icon: "应" },
    ];
    const primaryNavigation = [
      ...conversationNavigation,
      ...workbenchNavigation,
      ...integrationNavigation,
    ];
    const desktopToolPages = new Set(["files", "git", "terminal", "browser", "ssh", "apps"]);
    const settingsNavigation = { id: "settings", label: "设置", icon: "设" };
    let activePage = "conversation";
    const pageListeners = new Set();
    function setActivePage(page) {
      if (activePage === page) return;
      activePage = page;
      for (const listener of pageListeners) listener();
    }
    const managementCloseGuards = new Set();
    function registerManagementCloseGuard(guard) {
      managementCloseGuards.add(guard);
      return () => managementCloseGuards.delete(guard);
    }
    function requestCloseManagement(onClosed) {
      for (const guard of managementCloseGuards) {
        if (guard() === false) return false;
      }
      const closingPage = activePage;
      setActivePage("conversation");
      if (desktopToolPages.has(closingPage)) {
        window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", {
          detail: { tool: "close", source: "project-sidebar" },
        }));
      }
      if (closingPage === "settings") closeNativeSettings();
      onClosed?.();
      return true;
    }
    function isConversationNavigationClick(target, leftSidebar) {
      if (!(target instanceof Element)) return false;
      const newSession = target.closest(
        'button[aria-label="新建会话"], button[aria-label="New session"]',
      );
      if (newSession && leftSidebar.contains(newSession)) return true;
      const session = target.closest('[role="treeitem"][aria-selected]');
      if (!session || !leftSidebar.contains(session)) return false;
      const nestedButton = target.closest("button");
      return nestedButton === null || nestedButton === session;
    }
    function useActivePage() {
      return useSyncExternalStore(
        (listener) => {
          pageListeners.add(listener);
          return () => pageListeners.delete(listener);
        },
        () => activePage,
      );
    }
    // 会话视图（chat/trajectory）当前状态：与 DSH 隐藏 tab 的 aria-selected 同步。
    let nativeView = "chat";
    const nativeViewListeners = new Set();
    function setNativeView(view) {
      if (nativeView === view) return;
      nativeView = view;
      for (const listener of nativeViewListeners) listener();
    }
    function useNativeView() {
      return useSyncExternalStore(
        (listener) => {
          nativeViewListeners.add(listener);
          return () => nativeViewListeners.delete(listener);
        },
        () => nativeView,
      );
    }
    // 通过被隐藏的 DSH 视图 tab 桥接切换：轨迹内容显示在对话区，入口在右侧项目栏。
    function switchNativeView(viewId) {
      setActivePage("conversation");
      const label = viewId === "chat" ? "对话" : "轨迹";
      const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
      const tab = tabs.find((button) => button.textContent?.trim() === label);
      if (tab === undefined) return;
      if (tab.getAttribute("aria-selected") === "true") return;
      tab.click();
    }
    function ProjectNavigation({ items, expanded, onNavigate, bottom, groupLabel }) {
      const active = useActivePage();
      const view = useNativeView();
      const isActive = (item) =>
        item.id === "trajectory"
          ? view === "trajectory"
          : item.id === "conversation"
            ? view === "chat" && active === "conversation"
            : active === item.id;
      return h(
        "nav",
        {
          className: classNames(
            "lbs-right-nav",
            groupLabel && "lbs-right-nav-group",
            bottom && "lbs-right-nav-bottom",
          ),
          "aria-label": bottom ? "项目设置" : groupLabel || "项目功能",
        },
        expanded && groupLabel
          ? h("div", { className: "lbs-right-nav-title" }, groupLabel)
          : null,
        items.map((item) =>
          h(
            "button",
            {
              key: item.id,
              type: "button",
              className: "lbs-nav-button",
              "data-active": isActive(item),
              "aria-label": item.label,
              title: expanded ? undefined : item.label,
              onClick: () => onNavigate(item.id),
            },
            h("span", { className: "lbs-nav-icon", "aria-hidden": true }, h(ProjectNavIcon, { id: item.id })),
            expanded ? h("span", { className: "lbs-nav-label" }, item.label) : null,
          ),
        ),
      );
    }

    function KnowledgeSection() {
      const [collections, setCollections] = useState([]);
      const [selectedId, setSelectedId] = useState("");
      const [activityId, setActivityId] = useState("");
      const [activityDocuments, setActivityDocuments] = useState([]);
      const [activityLoading, setActivityLoading] = useState(false);
      const [activityRefreshToken, setActivityRefreshToken] = useState(0);
      const [collectionQuery, setCollectionQuery] = useState("");
      const [collectionFilter, setCollectionFilter] = useState("all");
      const [loading, setLoading] = useState(true);
      const [refreshing, setRefreshing] = useState(false);
      const [documents, setDocuments] = useState([]);
      const [name, setName] = useState("");
      const [description, setDescription] = useState("");
      const [agentEnabled, setAgentEnabled] = useState(false);
      const [documentId, setDocumentId] = useState("");
      const [documentRevision, setDocumentRevision] = useState("");
      const [documentTitle, setDocumentTitle] = useState("");
      const [documentSource, setDocumentSource] = useState("");
      const [documentContent, setDocumentContent] = useState("");
      const [searchQuery, setSearchQuery] = useState("");
      const [searchResults, setSearchResults] = useState([]);
      const [searching, setSearching] = useState(false);
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const selected = collections.find((item) => item.id === selectedId);
      const activityCollection = collections.find((item) => item.id === activityId);
      const visibleCollections = useMemo(() => {
        const needle = collectionQuery.trim().toLowerCase();
        return collections.filter((item) => {
          if (collectionFilter === "enabled" && !item.agentEnabled) return false;
          if (collectionFilter === "paused" && item.agentEnabled) return false;
          return !needle || `${item.name} ${item.description || ""} ${item.scope || ""}`.toLowerCase().includes(needle);
        });
      }, [collectionFilter, collectionQuery, collections]);
      const collectionTotals = useMemo(() => collections.reduce((total, item) => ({ documents: total.documents + Number(item.documentCount || 0), chunks: total.chunks + Number(item.chunkCount || 0) }), { documents: 0, chunks: 0 }), [collections]);
      const activityEntries = useMemo(() => {
        if (!activityCollection) return [];
        return [
          { id: `collection-${activityCollection.id}`, type: "collection", title: "知识库配置最近更新", description: `${activityCollection.agentEnabled ? "可召回" : "已暂停"} · ${activityCollection.scope === "workspace" ? "当前项目" : "全局"}`, updatedAt: activityCollection.updatedAt },
          ...activityDocuments.map((document) => ({ id: document.id, type: "document", title: document.title, description: `${document.chunkCount} 个片段 · ${document.contentLength} 字符${document.source ? ` · ${document.source}` : ""}`, updatedAt: document.updatedAt })),
        ].sort((left, right) => Number(new Date(right.updatedAt || 0)) - Number(new Date(left.updatedAt || 0)));
      }, [activityCollection, activityDocuments]);

      const load = useCallback(async (preferred, indicate = false) => {
        if (indicate) setRefreshing(true);
        try {
          const next = await request("/knowledge/collections");
          setCollections(next);
          setSelectedId((current) => {
            if (preferred && next.some((item) => item.id === preferred)) return preferred;
            return next.some((item) => item.id === current) ? current : "";
          });
          setError("");
        } catch (reason) { setError(reason.message); }
        finally { setLoading(false); if (indicate) setRefreshing(false); }
      }, []);
      useEffect(() => {
        load();
        const timer = setInterval(() => load(), 2_000);
        return () => clearInterval(timer);
      }, [load]);
      useEffect(() => {
        if (!selectedId) { setDocuments([]); return; }
        request(`/knowledge/documents?collectionId=${encodeURIComponent(selectedId)}`).then(setDocuments).catch((reason) => setError(reason.message));
      }, [selectedId, selected?.revision]);
      useEffect(() => {
        if (!activityId) { setActivityDocuments([]); return; }
        let disposed = false;
        setActivityLoading(true);
        request(`/knowledge/documents?collectionId=${encodeURIComponent(activityId)}`).then((items) => { if (!disposed) setActivityDocuments(items); }).catch((reason) => { if (!disposed) setError(reason.message); }).finally(() => { if (!disposed) setActivityLoading(false); });
        return () => { disposed = true; };
      }, [activityId, activityCollection?.revision, activityRefreshToken]);
      useEffect(() => {
        setName(selected?.name || ""); setDescription(selected?.description || "");
        setAgentEnabled(selected?.agentEnabled || false);
      }, [selectedId, selected?.revision]);
      useEffect(() => {
        setSearchQuery(""); setSearchResults([]); cancelDocumentEdit();
      }, [selectedId]);
      useEffect(() => {
        if (!selectedId && !activityId) return undefined;
        const closeOnEscape = (event) => {
          if (event.key !== "Escape") return;
          event.stopImmediatePropagation();
          if (activityId) setActivityId(""); else setSelectedId("");
        };
        window.addEventListener("keydown", closeOnEscape, true);
        return () => window.removeEventListener("keydown", closeOnEscape, true);
      }, [activityId, selectedId]);

      async function persistCollection(nextEnabled, successMessage) {
        if (!selected) return;
        try {
          const saved = await request("/knowledge/collections", { method: "POST", body: JSON.stringify({ id: selected.id, expectedRevision: selected.revision, name, description, toolName: selected.toolName, agentEnabled: nextEnabled, retrievalMode: selected.retrievalMode }) });
          await load(saved.id); setMessage(successMessage); setError("");
        } catch (reason) { setError(reason.message); }
      }
      async function saveCollection() {
        await persistCollection(agentEnabled, "召回设置已保存。");
      }
      async function toggleCollection() {
        if (!selected) return;
        await persistCollection(!selected.agentEnabled, selected.agentEnabled ? "Agent 已暂停使用这个知识库。" : "Agent 现在可以召回这个知识库。");
      }
      async function removeCollection(collection = selected) {
        if (!collection || !confirm(`删除知识库“${collection.name}”及其全部文档？`)) return;
        try {
          await request(`/knowledge/collections/${encodeURIComponent(collection.id)}?revision=${encodeURIComponent(collection.revision)}`, { method: "DELETE" });
          if (collection.id === selectedId) setSelectedId("");
          if (collection.id === activityId) setActivityId("");
          await load(); setMessage("知识库已删除。"); setError("");
        } catch (reason) { setError(reason.message); }
      }
      function editCollection(collection) {
        setActivityId(""); setSelectedId(collection.id); setMessage(""); setError("");
      }
      function showActivity(collection) {
        setSelectedId(""); setActivityId(collection.id); setMessage(""); setError("");
      }
      function cancelDocumentEdit() {
        setDocumentId(""); setDocumentRevision(""); setDocumentTitle(""); setDocumentSource(""); setDocumentContent("");
      }
      async function editDocument(document) {
        try {
          const detail = await request(`/knowledge/documents/${encodeURIComponent(document.id)}`);
          setDocumentId(detail.id); setDocumentRevision(detail.revision); setDocumentTitle(detail.title);
          setDocumentSource(detail.source || ""); setDocumentContent(detail.content); setMessage(""); setError("");
        } catch (reason) { setError(reason.message); }
      }
      async function saveDocument() {
        if (!selected) return;
        try {
          await request("/knowledge/documents", { method: "POST", body: JSON.stringify({ id: documentId, expectedRevision: documentRevision, collectionId: selected.id, title: documentTitle, source: documentSource, content: documentContent }) });
          cancelDocumentEdit(); await load(selected.id); setMessage("知识内容已更新并重新建立索引。"); setError("");
        } catch (reason) { setError(reason.message); }
      }
      async function removeDocument(document) {
        if (!selected || !confirm(`删除文档“${document.title}”？`)) return;
        try {
          await request(`/knowledge/documents/${encodeURIComponent(document.id)}?revision=${encodeURIComponent(document.revision)}`, { method: "DELETE" });
          if (document.id === documentId) cancelDocumentEdit();
          await load(selected.id); setMessage("文档已删除。"); setError("");
        } catch (reason) { setError(reason.message); }
      }
      async function testRetrieval(event) {
        event.preventDefault();
        if (!selected || !searchQuery.trim()) return;
        setSearching(true); setError(""); setMessage("");
        try {
          const results = await request("/knowledge/search", { method: "POST", body: JSON.stringify({ query: searchQuery, collectionId: selected.id, topK: 6 }) });
          setSearchResults(results);
          if (!results.length) setMessage("没有召回结果。可以补充资料，或换一个更具体的问法。");
        } catch (reason) { setError(reason.message); }
        finally { setSearching(false); }
      }
      function relevanceLabel(score) {
        if (score >= 0.72) return "高相关";
        if (score >= 0.48) return "相关";
        return "可能相关";
      }
      function formatUpdatedAt(value) {
        if (!value) return "—";
        try { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
        catch { return "—"; }
      }

      return h("div", { className: "lbs-page lbs-knowledge-page" },
        h(PageHeader, { title: "知识库", subtitle: "Agent 自动维护知识；以列表统一管理资料索引和召回状态。", action: h("div", { className: "lbs-knowledge-head-summary" }, h("strong", null, String(collections.length)), h("span", null, `个知识库 · ${collectionTotals.documents} 份资料`)) }),
        h(Status, { error: true, message: error }), h(Status, { message }),
        h("section", { className: "lbs-knowledge-list-panel" },
          h("div", { className: "lbs-knowledge-toolbar" },
            h("label", { className: "lbs-knowledge-search" }, h(LineIcon, { name: "search", size: 15 }), h("input", { value: collectionQuery, onChange: (event) => setCollectionQuery(event.target.value), placeholder: "搜索知识库名称或说明", "aria-label": "搜索知识库" }), collectionQuery ? h("button", { type: "button", onClick: () => setCollectionQuery(""), title: "清空搜索", "aria-label": "清空知识库搜索" }, h(LineIcon, { name: "close", size: 14 })) : null),
            h("div", { className: "lbs-knowledge-filters", role: "group", "aria-label": "知识库状态筛选" },
              [{ id: "all", label: "全部" }, { id: "enabled", label: "可召回" }, { id: "paused", label: "已暂停" }].map((filter) => h("button", { key: filter.id, type: "button", "data-active": collectionFilter === filter.id, onClick: () => setCollectionFilter(filter.id) }, filter.label)),
            ),
            h("span", { className: "lbs-knowledge-toolbar-count", "aria-live": "polite" }, collectionQuery || collectionFilter !== "all" ? `${visibleCollections.length} / ${collections.length}` : `${collections.length} 项`),
            h("button", { type: "button", className: classNames("lbs-icon-action", refreshing && "is-spinning"), onClick: () => load(undefined, true), title: "刷新列表", "aria-label": "刷新知识库列表", disabled: refreshing }, h(LineIcon, { name: "refresh" })),
          ),
          loading ? h("div", { className: "lbs-knowledge-list-empty compact" }, h("span", { className: "lbs-knowledge-loading" }), h("div", null, h("div", { className: "lbs-card-title" }, "正在加载知识库"), h("div", { className: "lbs-meta" }, "正在同步资料与索引状态…")))
            : visibleCollections.length ? h("div", { className: "lbs-knowledge-list-scroll" },
              h("div", { className: "lbs-knowledge-table", role: "table", "aria-label": "知识库列表" },
                h("div", { className: "lbs-knowledge-table-head", role: "row" },
                  h("span", { role: "columnheader" }, "知识库"), h("span", { role: "columnheader" }, "范围"), h("span", { role: "columnheader" }, "状态"), h("span", { role: "columnheader" }, "资料"), h("span", { role: "columnheader" }, "片段"), h("span", { role: "columnheader" }, "最近更新"), h("span", { role: "columnheader", className: "lbs-knowledge-actions-heading" }, "操作"),
                ),
                visibleCollections.map((item) => h("article", { key: item.id, className: "lbs-knowledge-row", role: "row" },
                  h("div", { className: "lbs-knowledge-cell lbs-knowledge-primary", role: "cell" },
                    h("button", { type: "button", className: "lbs-knowledge-primary-button", onClick: () => editCollection(item), title: `编辑 ${item.name}` }, h("span", { className: "lbs-knowledge-list-icon" }, h(LineIcon, { name: "database", size: 16 })), h("span", { className: "lbs-knowledge-row-copy" }, h("span", { className: "lbs-knowledge-row-title" }, item.name), h("span", { className: "lbs-knowledge-row-description" }, item.description || "Agent 管理的本地知识"))),
                  ),
                  h("div", { className: "lbs-knowledge-cell", role: "cell" }, h("span", { className: "lbs-knowledge-scope" }, item.scope === "workspace" ? "当前项目" : "全局")),
                  h("div", { className: "lbs-knowledge-cell", role: "cell" }, h("span", { className: "lbs-knowledge-list-status", "data-enabled": item.agentEnabled }, h("span", { className: "lbs-knowledge-status-dot", "data-enabled": item.agentEnabled }), item.agentEnabled ? "可召回" : "已暂停")),
                  h("div", { className: "lbs-knowledge-cell lbs-knowledge-number", role: "cell" }, String(item.documentCount)),
                  h("div", { className: "lbs-knowledge-cell lbs-knowledge-number", role: "cell" }, String(item.chunkCount)),
                  h("time", { className: "lbs-knowledge-cell", role: "cell", dateTime: item.updatedAt || undefined }, formatUpdatedAt(item.updatedAt)),
                  h("div", { className: "lbs-knowledge-cell lbs-knowledge-list-actions", role: "cell" },
                    h("button", { type: "button", className: "lbs-icon-action", onClick: () => showActivity(item), title: "活动日志", "aria-label": `查看 ${item.name} 活动日志` }, h(LineIcon, { name: "activity" })),
                    h("button", { type: "button", className: "lbs-icon-action", onClick: () => editCollection(item), title: "编辑", "aria-label": `编辑 ${item.name}` }, h(LineIcon, { name: "edit" })),
                    h("button", { type: "button", className: "lbs-icon-action danger", onClick: () => removeCollection(item), title: "删除", "aria-label": `删除 ${item.name}` }, h(LineIcon, { name: "trash" })),
                  ),
                )),
              ),
            ) : h("div", { className: "lbs-knowledge-list-empty" }, h("span", { className: "lbs-knowledge-list-icon" }, h(LineIcon, { name: collectionQuery || collectionFilter !== "all" ? "search" : "database", size: 20 })), h("div", null, h("div", { className: "lbs-card-title" }, collections.length ? "没有匹配的知识库" : "暂无知识库"), h("div", { className: "lbs-meta" }, collections.length ? "调整搜索词或状态筛选后再试。" : "在对话中让 Agent 记住重要信息后，会自动出现在这里。"))),
        ),
        selected ? h("div", { className: "lbs-knowledge-modal-layer" },
          h("button", { type: "button", className: "lbs-knowledge-modal-backdrop", onClick: () => setSelectedId(""), "aria-label": "关闭知识库编辑" }),
          h("section", { className: "lbs-knowledge-modal", role: "dialog", "aria-modal": true, "aria-labelledby": "lbs-knowledge-modal-title" },
            h("header", { className: "lbs-knowledge-modal-head" },
              h("span", { className: "lbs-knowledge-list-icon" }, h(LineIcon, { name: "database", size: 17 })),
              h("div", { className: "lbs-knowledge-modal-head-copy" }, h("div", { id: "lbs-knowledge-modal-title", className: "lbs-knowledge-modal-title" }, selected.name), h("div", { className: "lbs-meta" }, selected.description || "Agent 管理的本地知识")),
              h("span", { className: "lbs-badge" }, selected.scope === "workspace" ? "当前项目" : "全局"),
              h("button", { type: "button", className: "lbs-icon-action", onClick: () => setSelectedId(""), title: "关闭", "aria-label": "关闭" }, h(LineIcon, { name: "close", size: 18 })),
            ),
            h("div", { className: "lbs-knowledge-modal-scroll" },
              error || message ? h("div", { className: "lbs-knowledge-modal-feedback" }, h(Status, { error: true, message: error }), h(Status, { message })) : null,
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", { className: "lbs-knowledge-modal-section-head" }, h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "使用状态"), h("div", { className: "lbs-meta" }, "控制 Agent 是否可以在回答时召回这组知识。")), h("button", { type: "button", className: classNames("lbs-knowledge-toggle", selected.agentEnabled && "is-on"), onClick: toggleCollection, "aria-label": selected.agentEnabled ? "暂停 Agent 召回" : "启用 Agent 召回" }, h("span", null), h("strong", null, selected.agentEnabled ? "可召回" : "已暂停"))),
                h("div", { className: "lbs-knowledge-modal-stats" },
                  h("div", { className: "lbs-knowledge-modal-stat" }, h("strong", null, String(selected.documentCount)), h("span", null, "资料")),
                  h("div", { className: "lbs-knowledge-modal-stat" }, h("strong", null, String(selected.chunkCount)), h("span", null, "索引片段")),
                  h("div", { className: "lbs-knowledge-modal-stat" }, h("strong", null, selected.retrievalMode === "smart" ? "智能" : "本地"), h("span", null, "召回方式")),
                ),
              ),
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "召回测试"), h("div", { className: "lbs-meta" }, "使用和 Agent 相同的检索方式，检查真实问题能否找到资料。")),
                h("form", { className: "lbs-retrieval-form", onSubmit: testRetrieval },
                  h("input", { className: "lbs-input", value: searchQuery, onChange: (event) => setSearchQuery(event.target.value), placeholder: "输入一个真实问题，例如：生产发布需要满足什么条件？" }),
                  h(Button, { type: "submit", disabled: searching || !searchQuery.trim() }, searching ? "召回中…" : "测试召回"),
                ),
                searchResults.length ? h("div", { className: "lbs-retrieval-results" }, searchResults.map((result, index) => h("article", { key: `${result.chunkId || result.documentId}-${index}`, className: "lbs-retrieval-result" },
                  h("div", { className: "lbs-between" }, h("div", null, h("div", { className: "lbs-card-title" }, result.title), h("div", { className: "lbs-meta" }, result.source || `片段 ${Number(result.ordinal || 0) + 1}`)), h("span", { className: "lbs-relevance", "data-level": relevanceLabel(result.score) }, relevanceLabel(result.score))),
                  h("p", { className: "lbs-retrieval-snippet" }, result.content),
                ))) : null,
              ),
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", { className: "lbs-knowledge-modal-section-head" }, h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "资料"), h("div", { className: "lbs-meta" }, "Agent 写入后会自动切片并建立本地索引。")), h("span", { className: "lbs-meta" }, "自动同步")),
                h("div", { className: "lbs-knowledge-documents" }, documents.length ? documents.map((document) => h("article", { key: document.id, className: "lbs-knowledge-document" },
                  h("span", { className: "lbs-knowledge-document-icon" }, h(LineIcon, { name: "document", size: 15 })),
                  h("div", { className: "lbs-knowledge-document-copy" }, h("div", { className: "lbs-card-title" }, document.title), h("div", { className: "lbs-meta" }, `${document.chunkCount} 个片段 · ${document.contentLength} 字符${document.source ? ` · ${document.source}` : ""}`)),
                  h("div", { className: "lbs-knowledge-document-actions" }, h("button", { type: "button", className: "lbs-icon-action", onClick: () => editDocument(document), title: "编辑资料", "aria-label": `编辑资料 ${document.title}` }, h(LineIcon, { name: "edit" })), h("button", { type: "button", className: "lbs-icon-action danger", onClick: () => removeDocument(document), title: "删除资料", "aria-label": `删除资料 ${document.title}` }, h(LineIcon, { name: "trash" }))),
                )) : h("div", { className: "lbs-help" }, "暂无资料。你可以在对话中让 Agent 记住重要信息。")),
                documentId ? h("div", { className: "lbs-knowledge-editor" },
                  h("div", { className: "lbs-between" }, h("div", { className: "lbs-card-title" }, "编辑资料"), h("button", { type: "button", className: "lbs-icon-action", onClick: cancelDocumentEdit, title: "收起", "aria-label": "收起资料编辑" }, h(LineIcon, { name: "close" }))),
                  h("div", { className: "lbs-split" }, h(Field, { label: "标题", value: documentTitle, onChange: (event) => setDocumentTitle(event.target.value) }), h(Field, { label: "来源", value: documentSource, onChange: (event) => setDocumentSource(event.target.value) })),
                  h(Field, { label: "正文", area: true, code: true, value: documentContent, onChange: (event) => setDocumentContent(event.target.value) }),
                  h(Button, { onClick: saveDocument, disabled: !documentTitle.trim() || !documentContent.trim() }, "保存并重新索引"),
                ) : null,
              ),
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "基础设置"), h("div", { className: "lbs-meta" }, "召回说明会帮助 Agent 判断什么时候使用这组知识。")),
                h("div", { className: "lbs-split" }, h(Field, { label: "名称", value: name, onChange: (event) => setName(event.target.value) }), h(Field, { label: "召回说明", value: description, onChange: (event) => setDescription(event.target.value), placeholder: "例如：产品发布规范和上线检查清单" })),
              ),
            ),
            h("footer", { className: "lbs-knowledge-modal-footer" },
              h(Button, { danger: true, onClick: () => removeCollection(selected) }, "删除知识库"),
              h("div", { className: "lbs-knowledge-modal-footer-actions" }, h(Button, { secondary: true, onClick: () => setSelectedId("") }, "取消"), h(Button, { onClick: saveCollection, disabled: !name.trim() }, "保存设置")),
            ),
          ),
        ) : null,
        activityCollection ? h("div", { className: "lbs-knowledge-modal-layer" },
          h("button", { type: "button", className: "lbs-knowledge-modal-backdrop", onClick: () => setActivityId(""), "aria-label": "关闭知识库活动日志" }),
          h("section", { className: "lbs-knowledge-modal lbs-knowledge-activity-modal", role: "dialog", "aria-modal": true, "aria-labelledby": "lbs-knowledge-activity-title" },
            h("header", { className: "lbs-knowledge-modal-head" },
              h("span", { className: "lbs-knowledge-list-icon" }, h(LineIcon, { name: "activity", size: 17 })),
              h("div", { className: "lbs-knowledge-modal-head-copy" }, h("div", { id: "lbs-knowledge-activity-title", className: "lbs-knowledge-modal-title" }, `${activityCollection.name} · 活动日志`), h("div", { className: "lbs-meta" }, "检查知识库与资料的最近同步状态")),
              h("span", { className: "lbs-badge" }, activityCollection.scope === "workspace" ? "当前项目" : "全局"),
              h("button", { type: "button", className: "lbs-icon-action", onClick: () => setActivityId(""), title: "关闭", "aria-label": "关闭活动日志" }, h(LineIcon, { name: "close", size: 18 })),
            ),
            h("div", { className: "lbs-knowledge-modal-scroll" },
              error ? h("div", { className: "lbs-knowledge-modal-feedback" }, h(Status, { error: true, message: error })) : null,
              h("section", { className: "lbs-knowledge-activity-overview" },
                h("div", { className: "lbs-knowledge-activity-stat" }, h("strong", null, String(activityCollection.documentCount)), h("span", null, "资料")),
                h("div", { className: "lbs-knowledge-activity-stat" }, h("strong", null, String(activityCollection.chunkCount)), h("span", null, "索引片段")),
                h("div", { className: "lbs-knowledge-activity-stat" }, h("strong", null, activityCollection.agentEnabled ? "可召回" : "已暂停"), h("span", null, "当前状态")),
              ),
              h("div", { className: "lbs-knowledge-activity-note" }, "这里展示当前知识库和资料的最近更新时间，用于快速检查同步状态；当前版本暂不保留历史版本快照。"),
              h("section", { className: "lbs-knowledge-activity-section" },
                h("div", { className: "lbs-knowledge-activity-heading" }, h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "最近活动"), h("div", { className: "lbs-meta" }, `${activityEntries.length} 条当前记录`)), h("button", { type: "button", className: classNames("lbs-icon-action", activityLoading && "is-spinning"), onClick: () => setActivityRefreshToken((value) => value + 1), title: "刷新活动", "aria-label": "刷新知识库活动", disabled: activityLoading }, h(LineIcon, { name: "refresh" }))),
                activityLoading ? h("div", { className: "lbs-knowledge-activity-loading" }, h("span", { className: "lbs-knowledge-loading" }), "正在读取活动…")
                  : activityEntries.length ? h("div", { className: "lbs-knowledge-timeline", role: "log", "aria-label": "知识库最近活动" }, activityEntries.map((entry) => h("article", { key: entry.id, className: "lbs-knowledge-timeline-item" },
                    h("span", { className: "lbs-knowledge-timeline-rail", "aria-hidden": true }, h("span", null)),
                    h("span", { className: "lbs-knowledge-timeline-icon" }, h(LineIcon, { name: entry.type === "document" ? "document" : "database", size: 15 })),
                    h("div", { className: "lbs-knowledge-timeline-copy" }, h("div", { className: "lbs-card-title" }, entry.title), h("div", { className: "lbs-meta" }, entry.description)),
                    h("time", { dateTime: entry.updatedAt || undefined }, formatUpdatedAt(entry.updatedAt)),
                  ))) : h("div", { className: "lbs-knowledge-activity-empty" }, "暂无可显示的活动记录。"),
              ),
            ),
            h("footer", { className: "lbs-knowledge-modal-footer" },
              h("span", { className: "lbs-meta" }, "活动按最近更新时间排序"),
              h("div", { className: "lbs-knowledge-modal-footer-actions" }, h(Button, { secondary: true, onClick: () => setActivityId("") }, "关闭"), h(Button, { onClick: () => editCollection(activityCollection) }, "编辑知识库")),
            ),
          ),
        ) : null,
      );
    }

    function WorkflowGraph({ definition, selectedNodeId, onSelectNode }) {
      const graph = useMemo(() => {
        const nodes = definition?.nodes || [];
        if (!nodes.length) return null;
        const minX = Math.min(...nodes.map((node) => node.position?.x || 0));
        const minY = Math.min(...nodes.map((node) => node.position?.y || 0));
        const maxX = Math.max(...nodes.map((node) => node.position?.x || 0));
        const maxY = Math.max(...nodes.map((node) => node.position?.y || 0));
        const width = Math.max(500, maxX - minX + 220), height = Math.max(260, maxY - minY + 140);
        const positions = Object.fromEntries(nodes.map((node) => [node.id, { x: (node.position?.x || 0) - minX + 20, y: (node.position?.y || 0) - minY + 30 }]));
        return { nodes, edges: definition.edges || [], positions, width, height };
      }, [definition]);
      if (!graph) return h("div", { className: "lbs-empty" }, "没有可视化节点");
      return h("svg", { className: "lbs-svg", viewBox: `0 0 ${graph.width} ${graph.height}`, preserveAspectRatio: "xMidYMid meet" },
        h("defs", null, h("marker", { id: "lbs-arrow", markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: "auto" }, h("path", { d: "M0,0 L8,4 L0,8 Z", fill: "var(--dsw-alias-label-tertiary)" }))),
        graph.edges.map((edge) => { const a = graph.positions[edge.source], b = graph.positions[edge.target]; return a && b ? h("path", { key: edge.id, className: "lbs-edge", markerEnd: "url(#lbs-arrow)", d: `M${a.x + 150},${a.y + 30} C${a.x + 190},${a.y + 30} ${b.x - 40},${b.y + 30} ${b.x},${b.y + 30}` }) : null; }),
        graph.nodes.map((node) => {
          const p = graph.positions[node.id];
          const selectable = typeof onSelectNode === "function";
          return h("g", {
            key: node.id,
            className: "lbs-node-group",
            transform: `translate(${p.x} ${p.y})`,
            "data-selectable": selectable,
            "data-selected": node.id === selectedNodeId,
            role: selectable ? "button" : undefined,
            tabIndex: selectable ? 0 : undefined,
            onClick: selectable ? () => onSelectNode(node) : undefined,
            onKeyDown: selectable ? (event) => { if (["Enter", " "].includes(event.key)) onSelectNode(node); } : undefined,
          }, h("rect", { className: "lbs-node", width: 150, height: 60, rx: 10 }), h("text", { className: "lbs-node-title", x: 12, y: 25 }, node.label || node.id), h("text", { className: "lbs-node-type", x: 12, y: 44 }, node.type));
        }),
      );
    }

    function WorkflowsSection() {
      const [workflows, setWorkflows] = useState([]);
      const [selectedId, setSelectedId] = useState("");
      const [dialogMode, setDialogMode] = useState("view");
      const [loading, setLoading] = useState(true);
      const [refreshing, setRefreshing] = useState(false);
      const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [toolName, setToolName] = useState("");
      const [definition, setDefinition] = useState(null);
      const [selectedNodeId, setSelectedNodeId] = useState("");
      const [nodeLabel, setNodeLabel] = useState("");
      const [nodeConfigText, setNodeConfigText] = useState("{}");
      const [runInput, setRunInput] = useState('{"message":"你好","count":2}');
      const [message, setMessage] = useState(""); const [error, setError] = useState("");
      const selected = workflows.find((item) => item.id === selectedId);
      const selectedNode = definition?.nodes.find((node) => node.id === selectedNodeId);
      const load = useCallback(async (preferred, background = false) => {
        if (background) setRefreshing(true);
        try {
          const next = await request("/workflows");
          setWorkflows(next);
          setSelectedId((current) => {
            const candidate = preferred || current;
            return candidate && next.some((item) => item.id === candidate) ? candidate : "";
          });
          setError("");
        } catch (reason) { setError(reason.message); }
        finally { setLoading(false); setRefreshing(false); }
      }, []);
      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        if (!selected) return;
        setName(selected.name); setDescription(selected.description); setToolName(selected.toolName);
        setDefinition(selected.definition);
        loadNodeEditor(selected.definition.nodes[0]);
      }, [selectedId, selected?.revision]);

      function loadNodeEditor(node) {
        if (!node) { setSelectedNodeId(""); setNodeLabel(""); setNodeConfigText("{}"); return; }
        const config = { ...node };
        delete config.id; delete config.type; delete config.label;
        setSelectedNodeId(node.id);
        setNodeLabel(node.label || "");
        setNodeConfigText(JSON.stringify(config, null, 2));
      }

      function openWorkflow(workflow, mode) {
        setDialogMode(mode);
        setSelectedId(workflow.id);
        setMessage("");
        setError("");
      }

      function closeWorkflow() {
        setSelectedId("");
        setMessage("");
        setError("");
      }

      function selectNode(node) {
        try {
          const nextDefinition = editedDefinition();
          const nextNode = nextDefinition?.nodes.find((item) => item.id === node.id) || node;
          setDefinition(nextDefinition);
          loadNodeEditor(nextNode);
          setError("");
        } catch (reason) {
          setError(`请先修正当前节点参数：${reason.message}`);
        }
      }

      function editedDefinition() {
        if (!selectedNode || !definition) return definition;
        const config = JSON.parse(nodeConfigText);
        if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("节点参数必须是 JSON 对象。");
        delete config.id; delete config.type; delete config.label;
        return {
          ...definition,
          nodes: definition.nodes.map((node) => node.id === selectedNode.id ? {
            id: node.id,
            type: node.type,
            ...(nodeLabel.trim() ? { label: nodeLabel.trim() } : {}),
            ...config,
          } : node),
        };
      }

      async function save(notify = true) {
        try {
          const nextDefinition = editedDefinition();
          const saved = await request("/workflows", { method: "POST", body: JSON.stringify({ id: selected.id, expectedRevision: selected.revision, name, description, toolName, definition: nextDefinition }) });
          setDefinition(nextDefinition);
          await load(saved.id);
          if (notify) setMessage("工作流微调已保存。");
          setError("");
          return saved;
        } catch (reason) {
          setError(reason.message);
          return null;
        }
      }
      async function publish() {
        try {
          const saved = await save(false);
          if (!saved) return;
          const value = await request(`/workflows/${encodeURIComponent(saved.id)}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: saved.revision }) });
          await load(saved.id);
          setMessage(`已发布并${value.enabled ? "启用" : "保持停用"} v${value.version}，虚拟插件：${value.toolName}`);
          setError("");
        }
        catch (reason) { setError(reason.message); }
      }
      async function setEnabled(workflow, enabled) {
        try {
          const value = await request(`/workflows/${encodeURIComponent(workflow.id)}/enabled`, { method: "POST", body: JSON.stringify({ enabled, expectedRevision: workflow.revision }) });
          await load(selectedId === workflow.id ? value.id : undefined);
          setMessage(enabled ? "虚拟工作流插件已启用。" : "虚拟工作流插件已停用，工作流和版本仍然保留。");
          setError("");
        } catch (reason) { setError(reason.message); }
      }
      async function run() {
        try {
          const input = JSON.parse(runInput);
          const saved = await save(false);
          if (!saved) return;
          const value = await request(`/workflows/${encodeURIComponent(saved.id)}/run`, { method: "POST", body: JSON.stringify({ input }) });
          setMessage(JSON.stringify(value.output, null, 2));
          setError("");
        }
        catch (reason) { setError(reason.message); }
      }
      async function remove(workflow = selected) {
        if (!workflow || !confirm(`删除工作流“${workflow.name}”？对应的虚拟插件和全部发布版本也会删除。`)) return;
        try { await request(`/workflows/${encodeURIComponent(workflow.id)}?revision=${encodeURIComponent(workflow.revision)}`, { method: "DELETE" }); setSelectedId(""); await load(); setMessage("工作流及虚拟插件已删除。"); }
        catch (reason) { setError(reason.message); }
      }

      function formatUpdatedAt(value) {
        if (!value) return "—";
        try { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
        catch { return "—"; }
      }

      return h("div", { className: "lbs-page lbs-workflow-page" },
        h(PageHeader, { title: "工作流", subtitle: "Agent 负责创建和维护；你可以从列表查看、编辑、启停或删除。", action: h("div", { className: "lbs-row" }, h("span", { className: "lbs-meta" }, `${workflows.length} 个工作流 · ${workflows.filter((item) => item.enabled).length} 个已启用`), h("button", { type: "button", className: classNames("lbs-icon-action", refreshing && "is-spinning"), onClick: () => load(undefined, true), title: "刷新列表", "aria-label": "刷新工作流列表", disabled: refreshing }, h(LineIcon, { name: "refresh" }))) }),
        h(Status, { error: true, message: error }), h(Status, { message }),
        h("section", { className: "lbs-panel lbs-workflow-list-panel" },
          loading ? h("div", { className: "lbs-knowledge-list-empty compact" }, h("span", { className: "lbs-knowledge-loading" }), h("div", null, h("div", { className: "lbs-card-title" }, "正在加载工作流"), h("div", { className: "lbs-meta" }, "正在同步 Agent 自动化状态…")))
            : workflows.length ? h("div", { className: "lbs-workflow-table-scroll" },
              h("div", { className: "lbs-workflow-table", role: "table", "aria-label": "工作流列表" },
                h("div", { className: "lbs-workflow-table-head", role: "row" },
                  h("span", { role: "columnheader" }, "工作流"), h("span", { role: "columnheader" }, "Agent 工具"), h("span", { role: "columnheader" }, "状态"), h("span", { role: "columnheader" }, "节点"), h("span", { role: "columnheader" }, "最近更新"), h("span", { role: "columnheader" }, "操作"),
                ),
                workflows.map((item) => h("article", { key: item.id, className: "lbs-workflow-row", role: "row" },
                  h("div", { className: "lbs-workflow-cell lbs-workflow-primary", role: "cell" },
                    h("button", { type: "button", className: "lbs-workflow-primary-button", onClick: () => openWorkflow(item, "view"), title: `查看 ${item.name}` }, h("span", { className: "lbs-workflow-list-icon" }, h(LineIcon, { name: "workflow", size: 16 })), h("span", { className: "lbs-workflow-row-copy" }, h("span", { className: "lbs-card-title" }, item.name), h("span", { className: "lbs-meta" }, item.description || "Agent 创建的可复用自动化"))),
                  ),
                  h("code", { className: "lbs-workflow-cell lbs-workflow-tool-name", role: "cell", title: item.toolName }, item.toolName),
                  h("div", { className: "lbs-workflow-cell", role: "cell" }, h("span", { className: "lbs-workflow-list-status", "data-enabled": item.enabled }, h("span", null), item.publishedVersion ? (item.enabled ? `已启用 v${item.publishedVersion}` : `已停用 v${item.publishedVersion}`) : "草稿")),
                  h("div", { className: "lbs-workflow-cell", role: "cell" }, String(item.definition.nodes.length)),
                  h("time", { className: "lbs-workflow-cell", role: "cell", dateTime: item.updatedAt || undefined }, formatUpdatedAt(item.updatedAt)),
                  h("div", { className: "lbs-workflow-cell lbs-workflow-list-actions", role: "cell" },
                    h("button", { type: "button", className: "lbs-icon-action", onClick: () => openWorkflow(item, "view"), title: "查看", "aria-label": `查看 ${item.name}` }, h(LineIcon, { name: "eye" })),
                    h("button", { type: "button", className: "lbs-icon-action", onClick: () => openWorkflow(item, "edit"), title: "编辑", "aria-label": `编辑 ${item.name}` }, h(LineIcon, { name: "edit" })),
                    item.publishedVersion ? h("button", { type: "button", className: "lbs-icon-action", onClick: () => setEnabled(item, !item.enabled), title: item.enabled ? "停用" : "启用", "aria-label": `${item.enabled ? "停用" : "启用"} ${item.name}` }, h(LineIcon, { name: "power" })) : null,
                    h("button", { type: "button", className: "lbs-icon-action danger", onClick: () => remove(item), title: "删除", "aria-label": `删除 ${item.name}` }, h(LineIcon, { name: "trash" })),
                  ),
                )),
              ),
            ) : h("div", { className: "lbs-knowledge-list-empty" }, h("span", { className: "lbs-workflow-list-icon" }, h(LineIcon, { name: "workflow", size: 19 })), h("div", null, h("div", { className: "lbs-card-title" }, "暂无工作流"), h("div", { className: "lbs-meta" }, "直接在对话中让 Agent 创建一个可复用流程。"))),
        ),
        selected ? h("div", { className: "lbs-knowledge-modal-layer" },
          h("button", { type: "button", className: "lbs-knowledge-modal-backdrop", onClick: closeWorkflow, "aria-label": "关闭工作流窗口" }),
          h("section", { className: "lbs-knowledge-modal lbs-workflow-modal", role: "dialog", "aria-modal": true, "aria-labelledby": "lbs-workflow-modal-title" },
            h("header", { className: "lbs-knowledge-modal-head" },
              h("span", { className: "lbs-workflow-list-icon" }, h(LineIcon, { name: "workflow", size: 17 })),
              h("div", { className: "lbs-knowledge-modal-head-copy" }, h("div", { id: "lbs-workflow-modal-title", className: "lbs-knowledge-modal-title" }, selected.name), h("div", { className: "lbs-meta" }, dialogMode === "edit" ? "编辑工作流信息和节点参数" : "查看工作流结构和发布状态")),
              h("span", { className: "lbs-badge" }, dialogMode === "edit" ? "编辑" : "查看"),
              h("button", { type: "button", className: "lbs-icon-action", onClick: closeWorkflow, title: "关闭", "aria-label": "关闭" }, h(LineIcon, { name: "close", size: 18 })),
            ),
            h("div", { className: "lbs-knowledge-modal-scroll" },
              error || message ? h("div", { className: "lbs-knowledge-modal-feedback" }, h(Status, { error: true, message: error }), h(Status, { message })) : null,
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", { className: "lbs-workflow-modal-summary" },
                  h("div", { className: "lbs-workflow-summary-item" }, h("strong", null, selected.publishedVersion ? `v${selected.publishedVersion}` : "草稿"), h("span", null, "当前版本")),
                  h("div", { className: "lbs-workflow-summary-item" }, h("strong", null, selected.publishedVersion ? (selected.enabled ? "已启用" : "已停用") : "未发布"), h("span", null, "插件状态")),
                  h("div", { className: "lbs-workflow-summary-item" }, h("strong", null, String(selected.definition.nodes.length)), h("span", null, "流程节点")),
                  h("div", { className: "lbs-workflow-summary-item" }, h("strong", null, String(selected.definition.edges.length)), h("span", null, "节点连线")),
                ),
              ),
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "基础信息"), h("div", { className: "lbs-meta" }, dialogMode === "edit" ? "修改名称、说明和注册给 Agent 的工具名。" : `最近更新：${formatUpdatedAt(selected.updatedAt)}`)),
                dialogMode === "edit" ? [
                  h("div", { key: "fields", className: "lbs-split" }, h(Field, { label: "名称", value: name, onChange: (event) => setName(event.target.value) }), h(Field, { label: "Agent 工具名", value: toolName, onChange: (event) => setToolName(event.target.value) })),
                  h(Field, { key: "description", label: "说明", area: true, value: description, onChange: (event) => setDescription(event.target.value) }),
                ] : h("div", { className: "lbs-workflow-readonly" },
                  h("div", null, h("div", { className: "lbs-label" }, "Agent 工具名"), h("code", { className: "lbs-automation-tool" }, selected.toolName)),
                  h("div", null, h("div", { className: "lbs-label" }, "说明"), h("div", { className: "lbs-meta" }, selected.description || "暂无说明")),
                ),
              ),
              h("section", { className: "lbs-knowledge-modal-section" },
                h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "流程图"), h("div", { className: "lbs-meta" }, dialogMode === "edit" ? "点击节点可在下方进行微调。" : "工作流结构由 Agent 维护。")),
                h(WorkflowGraph, { definition: selectedNode && dialogMode === "edit" ? { ...definition, nodes: definition.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...(nodeLabel.trim() ? { label: nodeLabel.trim() } : {}) } : node) } : selected.definition, selectedNodeId: dialogMode === "edit" ? selectedNodeId : undefined, onSelectNode: dialogMode === "edit" ? selectNode : undefined }),
                dialogMode === "edit" && selectedNode ? h("div", { className: "lbs-workflow-node-editor" },
                  h("div", { className: "lbs-workflow-node-head" }, h("strong", null, "节点微调"), h("span", { className: "lbs-badge" }, selectedNode.type)),
                  h("div", { className: "lbs-meta" }, `节点 ID：${selectedNode.id}`),
                  h(Field, { label: "显示名称", value: nodeLabel, onChange: (event) => setNodeLabel(event.target.value), placeholder: selectedNode.id }),
                  h(Field, { label: "节点参数", area: true, code: true, value: nodeConfigText, onChange: (event) => setNodeConfigText(event.target.value) }),
                ) : null,
              ),
              dialogMode === "edit" ? h("section", { className: "lbs-knowledge-modal-section" },
                h("div", null, h("div", { className: "lbs-knowledge-modal-section-title" }, "试运行"), h("div", { className: "lbs-meta" }, "保存当前微调后使用下面的 JSON 输入执行一次。")),
                h(Field, { label: "输入参数", area: true, code: true, value: runInput, onChange: (event) => setRunInput(event.target.value) }),
                h(Button, { secondary: true, onClick: run }, "试运行"),
              ) : null,
            ),
            h("footer", { className: "lbs-knowledge-modal-footer" },
              h(Button, { danger: true, onClick: () => remove(selected) }, "删除工作流"),
              dialogMode === "edit" ? h("div", { className: "lbs-knowledge-modal-footer-actions" },
                selected.publishedVersion ? h(Button, { secondary: true, onClick: () => setEnabled(selected, !selected.enabled) }, selected.enabled ? "停用" : "启用") : null,
                h(Button, { secondary: true, onClick: closeWorkflow }, "取消"),
                h(Button, { secondary: true, onClick: publish }, selected.publishedVersion ? "发布新版本" : "发布并启用"),
                h(Button, { onClick: () => save(), disabled: !name.trim() || !toolName.trim() }, "保存修改"),
              ) : h("div", { className: "lbs-knowledge-modal-footer-actions" }, h(Button, { secondary: true, onClick: closeWorkflow }, "关闭"), h(Button, { onClick: () => setDialogMode("edit") }, "编辑")),
            ),
          ),
        ) : null,
      );
    }

    function WorkflowPluginsTab() {
      const [workflows, setWorkflows] = useState([]);
      const [selectedId, setSelectedId] = useState("");
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const published = workflows.filter((item) => item.publishedVersion);
      const selected = published.find((item) => item.id === selectedId) || published[0];
      const load = useCallback(async (preferred) => {
        try {
          const next = await request("/workflows");
          const available = next.filter((item) => item.publishedVersion);
          setWorkflows(next);
          setSelectedId((current) => preferred || (available.some((item) => item.id === current) ? current : available[0]?.id || ""));
          setError("");
        } catch (reason) { setError(reason.message); }
      }, []);
      useEffect(() => {
        load();
        const timer = window.setInterval(() => load(), 2_000);
        return () => window.clearInterval(timer);
      }, [load]);

      async function setEnabled(workflow, enabled) {
        try {
          const value = await request(`/workflows/${encodeURIComponent(workflow.id)}/enabled`, {
            method: "POST",
            body: JSON.stringify({ enabled, expectedRevision: workflow.revision }),
          });
          await load(value.id);
          setMessage(enabled ? `“${workflow.name}”已启用并注册为 Agent 工具。` : `“${workflow.name}”已停用，流程和版本仍然保留。`);
          setError("");
        } catch (reason) { setError(reason.message); }
      }

      async function remove(workflow) {
        if (!confirm(`删除虚拟工作流插件“${workflow.name}”？工作流和全部发布版本会同步删除。`)) return;
        try {
          await request(`/workflows/${encodeURIComponent(workflow.id)}?revision=${encodeURIComponent(workflow.revision)}`, { method: "DELETE" });
          await load();
          setMessage(`“${workflow.name}”及其虚拟插件已删除。`);
          setError("");
        } catch (reason) { setError(reason.message); }
      }

      return h("div", { className: "lbs-page" },
        h(PageHeader, { title: "Agent 自动化", subtitle: "已发布工作流会作为虚拟插件统一出现在这里；启停和删除会与工作流页面实时同步。" }),
        h(Status, { error: true, message: error }),
        h(Status, { message }),
        published.length ? h("div", { className: "lbs-grid" },
          h("section", { className: "lbs-panel lbs-automation-list", "aria-label": "虚拟工作流插件列表" }, published.map((workflow) => h("button", {
            type: "button",
            key: workflow.id,
            className: "lbs-automation-card",
            "data-active": workflow.id === selected?.id,
            onClick: () => setSelectedId(workflow.id),
          },
          h("span", { className: "lbs-automation-card-copy" }, h("strong", { className: "lbs-card-title" }, workflow.name), h("small", { className: "lbs-meta" }, `${workflow.toolName} · v${workflow.publishedVersion}`)),
          h("span", { className: "lbs-automation-state", "data-enabled": workflow.enabled }, h("span", null), workflow.enabled ? "已启用" : "已停用")))),
          selected ? h("section", { className: "lbs-panel lbs-automation-detail" },
            h("div", { className: "lbs-automation-detail-head" }, h("div", null, h("h2", null, selected.name), h("div", { className: "lbs-sub" }, selected.description || "Agent 生成的可复用工作流。")), h("span", { className: "lbs-badge" }, `虚拟插件 · v${selected.publishedVersion}`)),
            h("code", { className: "lbs-automation-tool" }, selected.toolName),
            h(WorkflowGraph, { definition: selected.definition }),
            h("div", { className: "lbs-automation-actions" },
              h(Button, { onClick: () => setEnabled(selected, !selected.enabled) }, selected.enabled ? "停用" : "启用"),
              h(Button, { danger: true, onClick: () => remove(selected) }, "删除"),
            ),
            h("div", { className: "lbs-automation-note" }, `${selected.definition.nodes.length} 个节点 · ${selected.definition.edges.length} 条连线 · 删除后工作流管理页会同步移除`),
          ) : null,
        ) : h("div", { className: "lbs-empty" }, "还没有已发布的工作流。Agent 创建并发布后，会自动注册到这里。"),
      );
    }

    function SkillsSection() {
      const [catalog, setCatalog] = useState({ roots: [], skills: [] });
      const [selectedId, setSelectedId] = useState("");
      const [rootId, setRootId] = useState("project-dsh");
      const [skillName, setSkillName] = useState("");
      const [description, setDescription] = useState("");
      const [whenToUse, setWhenToUse] = useState("");
      const [skillBody, setSkillBody] = useState("");
      const [enabled, setEnabled] = useState(true);
      const [disableModelInvocation, setDisableModelInvocation] = useState(false);
      const [userInvocable, setUserInvocable] = useState(true);
      const [query, setQuery] = useState("");
      const [showCompatibility, setShowCompatibility] = useState(false);
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const [dirty, setDirty] = useState(false);
      const selected = catalog.skills.find((item) => item.id === selectedId);
      const nativeSkills = useMemo(
        () => catalog.skills.filter((item) => item.source !== "Agents"),
        [catalog.skills],
      );
      const compatibilityCount = catalog.skills.length - nativeSkills.length;
      const listedSkills = useMemo(() => {
        const candidates =
          showCompatibility || nativeSkills.length === 0
            ? catalog.skills
            : nativeSkills;
        const normalized = query.trim().toLocaleLowerCase();
        if (!normalized) return candidates;
        return candidates.filter((item) =>
          `${item.name} ${item.description} ${item.path}`
            .toLocaleLowerCase()
            .includes(normalized),
        );
      }, [catalog.skills, nativeSkills, query, showCompatibility]);
      const writableRoots = useMemo(() => {
        const roots = catalog.roots.filter((root) => root.writable);
        const native = roots.filter((root) => root.source !== "Agents");
        return native.length ? native : roots;
      }, [catalog.roots]);

      useEffect(
        () => registerManagementCloseGuard(() => {
          if (!dirty) return true;
          return window.confirm("当前 Skill 有未保存更改，确定收起管理页吗？");
        }),
        [dirty],
      );

      const load = useCallback(async (preferred) => {
        try {
          const next = await request("/skills");
          setCatalog(next);
          setSelectedId((current) =>
            preferred === "new"
              ? "new"
              : preferred ||
                (next.skills.some((item) => item.id === current)
                  ? current
                  : next.skills[0]?.id || "new"),
          );
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }, []);
      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        if (!selected) return;
        setRootId(selected.rootId);
        setSkillName(selected.name);
        setDescription(selected.description);
        setWhenToUse(selected.whenToUse || "");
        setSkillBody(selected.body || "");
        setEnabled(selected.enabled);
        setDisableModelInvocation(selected.disableModelInvocation);
        setUserInvocable(selected.userInvocable);
        setDirty(false);
      }, [selectedId, selected?.revision]);

      async function saveSkill(nextEnabled = enabled) {
        try {
          const saved = await request("/skills", {
            method: "POST",
            body: JSON.stringify({
              ...(selected
                ? { id: selected.id, expectedRevision: selected.revision }
                : { rootId }),
              name: skillName,
              description,
              whenToUse,
              body: skillBody,
              enabled: nextEnabled,
              disableModelInvocation,
              userInvocable,
            }),
          });
          setEnabled(nextEnabled);
          setDirty(false);
          await load(saved.id);
          setMessage("Skill 已保存，DSH 文件系统提供方会自动热更新。");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function setSkillEnabled(item, nextEnabled) {
        try {
          const saved = await request("/skills", {
            method: "POST",
            body: JSON.stringify({
              id: item.id,
              expectedRevision: item.revision,
              name: item.name,
              description: item.description,
              whenToUse: item.whenToUse,
              body: item.body,
              enabled: nextEnabled,
              disableModelInvocation: item.disableModelInvocation,
              userInvocable: item.userInvocable,
            }),
          });
          await load(saved.id);
          setMessage(nextEnabled ? "Skill 已启用。" : "Skill 已停用。");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function removeSkill(item = selected) {
        if (!item || !confirm(`删除 Skill“${item.name}”？`)) return;
        try {
          await request(
            `/skills/${encodeURIComponent(item.id)}?revision=${encodeURIComponent(item.revision)}`,
            { method: "DELETE" },
          );
          setDirty(false);
          await load();
          setMessage("Skill 已删除。");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function copyLocation(item) {
        const copied = await copyText(item.path);
        setMessage(copied ? "已复制 Skill 文件位置。" : "无法复制文件位置，请手动复制。" );
      }
      const invocationLabel = (item) => {
        if (!item.enabled) return "已停用";
        if (item.disableModelInvocation) return "仅手动";
        return item.userInvocable ? "模型可用" : "仅模型";
      };
      const sourceLabel = (item) =>
        item.source === "Agents" ? "兼容目录（.agents/skills）" : "DSH 原生目录";

      return h(
        "div",
        { className: "lbs-page" },
        h(PageHeader, {
          title: "Skills",
        }),
        h(Status, { error: true, message: error }),
        h(Status, { message }),
        h(
          "div",
          { className: "lbs-management-layout" },
          h(
            "section",
            { className: "lbs-panel lbs-stack", "aria-label": "Skill 列表" },
            h(
              "div",
              { className: "lbs-management-toolbar" },
              h("input", {
                className: "lbs-input lbs-management-search",
                value: query,
                placeholder: "搜索名称、简介或文件位置",
                onChange: (event) => setQuery(event.target.value),
              }),
              h(
                "div",
                { className: "lbs-management-toolbar-actions" },
                compatibilityCount
                  ? h(
                      Button,
                      {
                        secondary: true,
                        onClick: () => setShowCompatibility((value) => !value),
                      },
                      showCompatibility
                        ? "隐藏兼容 Skills"
                        : `显示兼容 Skills（${compatibilityCount}）`,
                    )
                  : null,
              ),
            ),
            h(
              "div",
              { className: "lbs-management-table-wrap" },
              h(
                "table",
                { className: "lbs-management-table" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "名称"),
                    h("th", null, "简介"),
                    h("th", null, "范围"),
                    h("th", null, "状态"),
                    h("th", null, "文件位置"),
                    h("th", null, "操作"),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  listedSkills.length
                    ? listedSkills.map((item) =>
                        h(
                          "tr",
                          {
                            key: item.id,
                          },
                          h("td", null, h("div", { className: "lbs-table-primary" }, item.name)),
                          h(
                            "td",
                            { title: item.description || "暂无说明" },
                            h("div", { className: "lbs-table-description" }, item.description || "暂无说明"),
                          ),
                          h("td", null, item.scope),
                          h(
                            "td",
                            null,
                            h("span", { className: "lbs-table-status" }, invocationLabel(item)),
                          ),
                          h(
                            "td",
                            null,
                            h(
                              "button",
                              {
                                type: "button",
                                className: "lbs-path-button",
                                title: item.path,
                                onClick: (event) => {
                                  event.stopPropagation();
                                  void copyLocation(item);
                                },
                              },
                              shortPath(item.path),
                            ),
                          ),
                          h(
                            "td",
                            null,
                            h(
                              "div",
                              { className: "lbs-table-actions" },
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action",
                                  onClick: () => void setSkillEnabled(item, !item.enabled),
                                },
                                item.enabled ? "停用" : "启用",
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action",
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    void copyLocation(item);
                                  },
                                },
                                "复制位置",
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action danger",
                                  onClick: () => void removeSkill(item),
                                },
                                "删除",
                              ),
                            ),
                          ),
                        ),
                      )
                    : h(
                        "tr",
                        null,
                        h("td", { colSpan: 6, className: "lbs-meta" }, "没有匹配的 Skills。"),
                      ),
                ),
              ),
            ),
          ),
          false && h(
            "section",
            { className: "lbs-panel lbs-stack lbs-management-editor", "aria-label": "Skill 编辑器" },
            h("div", { className: "lbs-card-title" }, selected ? `编辑：${selected.name}` : "新建 Skill"),
            h(
              "div",
              { className: "lbs-help" },
              "Skill 正文由 DSH 按需加载；这里只管理原生文件，不会另起一套 Skill 运行机制。",
            ),
            !selected
              ? h(
                  "label",
                  null,
                  h("div", { className: "lbs-label" }, "保存范围"),
                  h(
                    "select",
                    {
                      className: "lbs-input lbs-select",
                      value: rootId,
                      onChange: (event) => {
                        setRootId(event.target.value);
                        setDirty(true);
                      },
                    },
                    writableRoots.map((root) =>
                      h("option", { key: root.id, value: root.id }, `${root.scope} Skills`),
                    ),
                  ),
                )
              : h(
                  "div",
                  { className: "lbs-editor-location" },
                  h("span", { className: "lbs-meta" }, `${selected.scope} · ${sourceLabel(selected)}`),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "lbs-path-button",
                      title: selected.path,
                      onClick: () => void copyLocation(selected),
                    },
                    shortPath(selected.path, 92),
                  ),
                ),
            h(Field, {
              label: "Skill 名称（kebab-case）",
              value: skillName,
              onChange: (event) => {
                setSkillName(event.target.value);
                setDirty(true);
              },
            }),
            h(Field, {
              label: "简介（会进入模型目录）",
              value: description,
              onChange: (event) => {
                setDescription(event.target.value);
                setDirty(true);
              },
            }),
            h(Field, {
              label: "适用时机",
              area: true,
              value: whenToUse,
              onChange: (event) => {
                setWhenToUse(event.target.value);
                setDirty(true);
              },
            }),
            h(Field, {
              label: "SKILL.md 正文",
              area: true,
              code: true,
              value: skillBody,
              onChange: (event) => {
                setSkillBody(event.target.value);
                setDirty(true);
              },
            }),
            h(
              "label",
              { className: "lbs-row lbs-meta" },
              h("input", {
                className: "lbs-check",
                type: "checkbox",
                checked: !disableModelInvocation,
                onChange: (event) => {
                  setDisableModelInvocation(!event.target.checked);
                  setDirty(true);
                },
              }),
              "允许模型自动发现并调用",
            ),
            h(
              "label",
              { className: "lbs-row lbs-meta" },
              h("input", {
                className: "lbs-check",
                type: "checkbox",
                checked: userInvocable,
                onChange: (event) => {
                  setUserInvocable(event.target.checked);
                  setDirty(true);
                },
              }),
              "允许用户显式调用",
            ),
            h(
              "div",
              { className: "lbs-row" },
              h(Button, { onClick: () => saveSkill(enabled) }, "保存"),
              selected
                ? h(
                    Button,
                    { secondary: true, onClick: () => saveSkill(!enabled) },
                    enabled ? "停用" : "启用",
                  )
                : null,
              selected ? h(Button, { danger: true, onClick: removeSkill }, "删除") : null,
            ),
            h(
              "section",
              {
                className: "lbs-extension-slot",
                "data-slot": "skills-resources",
                "aria-label": "Skill 资源扩展区",
              },
              h(
                "div",
                { className: "lbs-between" },
                h("div", { className: "lbs-label" }, "资源文件"),
                h("span", { className: "lbs-badge" }, "预留"),
              ),
              h("div", { className: "lbs-slot-empty" }, "后续可在此管理 references、scripts 和 assets。"),
            ),
          ),
        ),
      );
    }

    function McpSection() {
      const [servers, setServers] = useState([]);
      const [selectedId, setSelectedId] = useState("new");
      const [serverName, setServerName] = useState("");
      const [enabled, setEnabled] = useState(true);
      const [configText, setConfigText] = useState("");
      const [query, setQuery] = useState("");
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const [dirty, setDirty] = useState(false);
      const selected = servers.find((item) => item.id === selectedId);
      const listedServers = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        if (!normalized) return servers;
        return servers.filter((item) =>
          `${item.serverName} ${item.config?.transport || ""} ${connectionTarget(item)} ${(item.status?.tools || []).join(" ")}`
            .toLocaleLowerCase()
            .includes(normalized),
        );
      }, [query, servers]);

      useEffect(
        () => registerManagementCloseGuard(() => {
          if (!dirty) return true;
          return window.confirm("当前 MCP 配置有未保存更改，确定收起管理页吗？");
        }),
        [dirty],
      );

      const newConfig = () =>
        JSON.stringify(
          {
            transport: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"],
            env: {},
            reconnect: { enabled: true, maxAttempts: 10 },
          },
          null,
          2,
        );
      const load = useCallback(async (preferred) => {
        try {
          const next = await request("/mcp");
          setServers(next);
          setSelectedId((current) =>
            preferred ||
            (next.some((item) => item.id === current)
              ? current
              : next[0]?.id || "new"),
          );
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }, []);
      useEffect(() => { load(); }, [load]);
      useEffect(() => {
        if (!selected) return;
        setServerName(selected.serverName);
        setEnabled(selected.enabled);
        setConfigText(JSON.stringify(selected.config, null, 2));
        setDirty(false);
      }, [selectedId, selected?.revision]);
      useEffect(() => {
        if (!servers.some((item) => ["connecting", "restarting", "pending"].includes(item.status?.state))) {
          return undefined;
        }
        const timer = setInterval(() => load(), 2_000);
        return () => clearInterval(timer);
      }, [load, servers]);

      async function saveServer(nextEnabled = enabled) {
        try {
          const config = JSON.parse(configText || newConfig());
          const saved = await request("/mcp", {
            method: "POST",
            body: JSON.stringify({
              ...(selected
                ? { id: selected.id, expectedRevision: selected.revision }
                : {}),
              serverName,
              enabled: nextEnabled,
              config,
            }),
          });
          setEnabled(nextEnabled);
          setDirty(false);
          await load(saved.id);
          setMessage(nextEnabled ? "MCP 已保存并开始连接。" : "MCP 已停用。");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function setServerEnabled(item, nextEnabled) {
        try {
          const saved = await request("/mcp", {
            method: "POST",
            body: JSON.stringify({
              id: item.id,
              expectedRevision: item.revision,
              serverName: item.serverName,
              enabled: nextEnabled,
              config: item.config,
            }),
          });
          await load(saved.id);
          setMessage(nextEnabled ? "MCP 已启用。" : "MCP 已停用。");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function restart(item = selected) {
        if (!item) return;
        try {
          await request(`/mcp/${encodeURIComponent(item.id)}/restart`, {
            method: "POST",
            body: "{}",
          });
          await load(item.id);
          setMessage("MCP 正在重新连接。");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function remove(item = selected) {
        if (!item || !confirm(`删除 MCP“${item.serverName}”？`)) return;
        try {
          await request(
            `/mcp/${encodeURIComponent(item.id)}?revision=${encodeURIComponent(item.revision)}`,
            { method: "DELETE" },
          );
          setDirty(false);
          await load();
          setMessage("MCP 已删除。");
        } catch (reason) {
          setError(reason.message);
        }
      }
      async function copyConnection(item) {
        const copied = await copyText(connectionTarget(item));
        setMessage(copied ? "已复制 MCP 连接目标。" : "无法复制连接目标，请手动复制。");
      }
      const statusLabel = {
        running: "运行中",
        connecting: "连接中",
        restarting: "重连中",
        pending: "等待中",
        error: "错误",
        disabled: "已停用",
      };
      function connectionTarget(item) {
        const config = item.config || {};
        if (config.transport === "stdio") {
          return [config.command, ...(config.args || [])].filter(Boolean).join(" ") || "未配置 command";
        }
        return config.url || config.endpoint || "未配置 URL";
      }
      function transportLabel(item) {
        return item.config?.transport === "streamable-http" ? "Streamable HTTP" : item.config?.transport || "未配置";
      }

      return h(
        "div",
        { className: "lbs-page" },
        h(PageHeader, {
          title: "MCP",
        }),
        h(Status, { error: true, message: error }),
        h(Status, { message }),
        h(
          "div",
          { className: "lbs-management-layout" },
          h(
            "section",
            { className: "lbs-panel lbs-stack", "aria-label": "MCP 列表" },
            h(
              "div",
              { className: "lbs-management-toolbar" },
              h("input", {
                className: "lbs-input lbs-management-search",
                value: query,
                placeholder: "搜索 Server、连接目标或工具",
                onChange: (event) => setQuery(event.target.value),
              }),
            ),
            h(
              "div",
              { className: "lbs-management-table-wrap" },
              h(
                "table",
                { className: "lbs-management-table" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "Server"),
                    h("th", null, "连接方式"),
                    h("th", null, "连接目标"),
                    h("th", null, "工具"),
                    h("th", null, "状态"),
                    h("th", null, "操作"),
                  ),
                ),
                h(
                  "tbody",
                  null,
                  listedServers.length
                    ? listedServers.map((item) =>
                        h(
                          "tr",
                          {
                            key: item.id,
                          },
                          h("td", null, h("div", { className: "lbs-table-primary" }, item.serverName)),
                          h("td", null, transportLabel(item)),
                          h(
                            "td",
                            { title: connectionTarget(item) },
                            h(
                              "button",
                              {
                                type: "button",
                                className: "lbs-path-button",
                                onClick: (event) => {
                                  event.stopPropagation();
                                  void copyConnection(item);
                                },
                              },
                              shortPath(connectionTarget(item)),
                            ),
                          ),
                          h("td", null, `${item.status?.toolCount || 0} 个`),
                          h(
                            "td",
                            null,
                            h(
                              "span",
                              { className: "lbs-table-status" },
                              h("span", {
                                className: "lbs-status-dot",
                                "data-state": item.status?.state,
                              }),
                              statusLabel[item.status?.state] || item.status?.state || "未知",
                            ),
                          ),
                          h(
                            "td",
                            null,
                            h(
                              "div",
                              { className: "lbs-table-actions" },
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action",
                                  onClick: () => void setServerEnabled(item, !item.enabled),
                                },
                                item.enabled ? "停用" : "启用",
                              ),
                              item.enabled
                                ? h(
                                    "button",
                                    {
                                      type: "button",
                                      className: "lbs-table-action",
                                      onClick: () => void restart(item),
                                    },
                                    "重连",
                                  )
                                : null,
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action",
                                  onClick: (event) => {
                                    event.stopPropagation();
                                    void copyConnection(item);
                                  },
                                },
                                "复制目标",
                              ),
                              h(
                                "button",
                                {
                                  type: "button",
                                  className: "lbs-table-action danger",
                                  onClick: () => void remove(item),
                                },
                                "删除",
                              ),
                            ),
                          ),
                        ),
                      )
                    : h("tr", null, h("td", { colSpan: 6, className: "lbs-meta" }, "没有匹配的 MCP Server。")),
                ),
              ),
            ),
          ),
          false && h(
            "section",
            { className: "lbs-panel lbs-stack lbs-management-editor", "aria-label": "MCP 编辑器" },
            h("div", { className: "lbs-card-title" }, selected ? `编辑：${selected.serverName}` : "添加 MCP"),
            h(
              "div",
              { className: "lbs-help" },
              "MCP 适合连接外部系统和动态工具；每个工具 schema 都会增加请求上下文。只启用当前项目需要的 Server，并仅对可信 stdio command 授权。",
            ),
            selected
              ? h(
                  "div",
                  { className: "lbs-meta" },
                  h("span", {
                    className: "lbs-status-dot",
                    "data-state": selected.status?.state,
                  }),
                  `${statusLabel[selected.status?.state] || selected.status?.state || "未知"} · 上次更新 ${selected.status?.changedAt ? new Date(selected.status.changedAt).toLocaleString() : "--"}`,
                )
              : null,
            h(Field, {
              label: "Server 名称（工具 namespace）",
              value: serverName,
              onChange: (event) => {
                setServerName(event.target.value);
                setDirty(true);
              },
              placeholder: "github",
            }),
            h(Field, {
              label: "连接配置（JSON）",
              area: true,
              code: true,
              value: configText || newConfig(),
              onChange: (event) => {
                setConfigText(event.target.value);
                setDirty(true);
              },
            }),
            selected?.status?.message
              ? h("div", { className: "lbs-error" }, selected.status.message)
              : null,
            selected?.status?.tools?.length
              ? h(
                  "div",
                  { className: "lbs-stack" },
                  h("div", { className: "lbs-label" }, "已暴露工具"),
                  h(
                    "div",
                    { className: "lbs-tool-list" },
                    selected.status.tools.map((tool) =>
                      h("span", { key: tool, className: "lbs-tool" }, tool),
                    ),
                  ),
                )
              : null,
            h(
              "div",
              { className: "lbs-row" },
              h(Button, { onClick: () => saveServer(enabled) }, "保存"),
              selected
                ? h(
                    Button,
                    { secondary: true, onClick: () => saveServer(!enabled) },
                    enabled ? "停用" : "启用",
                  )
                : null,
              selected && enabled
                ? h(Button, { secondary: true, onClick: restart }, "重连")
                : null,
              selected
                ? h(Button, { danger: true, onClick: remove }, "删除")
                : null,
            ),
            h(
              "section",
              {
                className: "lbs-extension-slot",
                "data-slot": "mcp-diagnostics",
                "aria-label": "MCP 诊断扩展区",
              },
              h(
                "div",
                { className: "lbs-between" },
                h("div", { className: "lbs-label" }, "连接诊断"),
                h("span", { className: "lbs-badge" }, "预留"),
              ),
              h(
                "div",
                { className: "lbs-slot-empty" },
                "后续可在此展示连接日志、重连历史和权限提示。",
              ),
            ),
          ),
        ),
      );
    }

    function openNativeSettings() {
      const trigger = getNativeSettingsTrigger();
      if (!trigger) return false;
      trigger.click();
      return true;
    }

    function getNativeSettingsTrigger() {
      return (
        document.querySelector("[data-laobos-native-settings-trigger]") ||
        document
          .querySelector("[data-shell-overlay]")
          ?.parentElement?.firstElementChild?.querySelector(
            'button[aria-haspopup="dialog"]',
          ) || null
      );
    }

    function closeNativeSettings() {
      const trigger = getNativeSettingsTrigger();
      if (!trigger || trigger.getAttribute("aria-expanded") !== "true") return false;
      const dialog = trigger.parentElement?.querySelector(
        '[role="dialog"][aria-modal="true"]',
      );
      const mask = dialog?.parentElement?.firstElementChild;
      if (!(mask instanceof HTMLElement)) return false;
      mask.click();
      return true;
    }

    function SystemPromptSection() {
      const [prompt, setPrompt] = useState("");
      const [defaultPrompt, setDefaultPrompt] = useState("");
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      useEffect(() => {
        request("/settings/system-prompt")
          .then((value) => {
            setPrompt(value.value || "");
            setDefaultPrompt(value.defaultValue || "");
          })
          .catch((reason) => setError(reason.message));
      }, []);
      async function savePrompt() {
        try {
          await request("/settings/system-prompt", {
            method: "PUT",
            body: JSON.stringify({ value: prompt }),
          });
          setMessage("系统提示词已保存，将从下一轮对话开始生效。");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }
      return h(
        "section",
        { className: "lbs-page" },
        h(PageHeader, {
          title: "系统提示词",
          subtitle: "默认使用劳博士身份；你可以直接修改名称、人设和行为规则，保存后从下一轮对话生效。",
        }),
        h(Status, { error: true, message: error }),
        h(Status, { message }),
        h(
          "div",
          { className: "lbs-help" },
          "这里是身份与角色设定的最高优先级来源。例如改为“你的名字是小劳同学。”后，Agent 只会使用新名称，不会把劳博士保留为别名。临时任务信息应留在对话中。",
        ),
        h(Field, {
          label: "全局系统提示词",
          area: true,
          className: "lbs-prompt-area",
          value: prompt,
          onChange: (event) => setPrompt(event.target.value),
          placeholder: "例如：你是劳博士项目的高级研发 Agent……",
        }),
        h("div", { className: "lbs-char-count" }, `${prompt.length} / 200000`),
        h(
          "div",
          { className: "lbs-row" },
          h(Button, { secondary: true, onClick: () => setPrompt(defaultPrompt) }, "恢复默认"),
          h(Button, { onClick: savePrompt }, "保存系统提示词"),
        ),
      );
    }

    function UploadCacheSettingsSection() {
      const desktop = window.laobosDesktop;
      const [context, setContext] = useState(null);
      const [busy, setBusy] = useState(false);
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const available = desktop?.capabilities?.uploadSettings === true;
      const location = context?.settings?.uploadLocation === "workspace"
        ? "workspace"
        : "default";
      const workspacePath = context?.root
        ? `${String(context.root).replace(/[\\/]$/u, "")}/update`
        : "当前工作区/update";

      useEffect(() => {
        if (!available) return;
        desktop.workspace.context()
          .then((value) => setContext(value))
          .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
      }, [available]);

      async function selectLocation(next) {
        if (!available || next === location || busy) return;
        setBusy(true);
        setMessage("");
        setError("");
        try {
          const settings = await desktop.uploads.setLocation(next);
          setContext((current) => ({ ...(current || {}), settings }));
          setMessage(
            next === "workspace"
              ? "上传缓存将保存到工作区的 update 文件夹。"
              : "已恢复默认上传缓存位置。",
          );
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setBusy(false);
        }
      }

      return h(
        "section",
        { className: "lbs-settings-section lbs-stack" },
        h(
          "div",
          null,
          h("div", { className: "lbs-card-title" }, "文件上传路径"),
          h(
            "div",
            { className: "lbs-sub" },
            "设置用户上传文件的缓存位置。该设置仅影响后续上传。",
          ),
        ),
        h(Status, { error: true, message: error }),
        h(Status, { message }),
        available
          ? h(
              "div",
              { className: "lbs-upload-options", role: "radiogroup", "aria-label": "上传缓存位置" },
              h(
                "label",
                { className: "lbs-upload-option" },
                h("input", {
                  type: "radio",
                  name: "laobos-upload-location",
                  checked: location === "default",
                  disabled: busy,
                  onChange: () => void selectLocation("default"),
                }),
                h(
                  "span",
                  null,
                  h("div", { className: "lbs-upload-option-title" }, "默认"),
                  h("div", { className: "lbs-meta" }, "普通文件保存到 DSH Home 私有目录；图片继续使用 DSH 原生附件存储。"),
                ),
              ),
              h(
                "label",
                { className: "lbs-upload-option" },
                h("input", {
                  type: "radio",
                  name: "laobos-upload-location",
                  checked: location === "workspace",
                  disabled: busy,
                  onChange: () => void selectLocation("workspace"),
                }),
                h(
                  "span",
                  null,
                  h("div", { className: "lbs-upload-option-title" }, "工作区内"),
                  h("div", { className: "lbs-meta" }, "普通文件保存到当前工作区的 update 文件夹。"),
                  h("div", { className: "lbs-upload-option-path" }, workspacePath),
                ),
              ),
            )
          : h("div", { className: "lbs-help" }, "上传路径设置仅在桌面版中可用。"),
      );
    }

    function SessionLogSection({ useSessions, download }) {
      const current = useSessions((state) => state.current);
      const [busy, setBusy] = useState(false);
      const hasSession = typeof current === "string" && current !== "";
      const exportLog = () => {
        if (!hasSession || download === undefined || busy) return;
        setBusy(true);
        Promise.resolve(download(current)).finally(() => setBusy(false));
      };
      return h(
        "section",
        { className: "lbs-settings-section lbs-stack" },
        h(
          "div",
          null,
          h("div", { className: "lbs-card-title" }, "会话日志"),
          h(
            "div",
            { className: "lbs-sub" },
            "把当前会话及其子会话、附件打包为 ZIP 下载。",
          ),
        ),
        h(
          "div",
          { className: "lbs-row" },
          h(
            Button,
            {
              onClick: exportLog,
              disabled: !hasSession || download === undefined || busy,
            },
            busy ? "正在导出…" : hasSession ? "导出当前会话日志" : "当前没有可导出的会话",
          ),
        ),
        hasSession
          ? h(
              "div",
              { className: "lbs-meta" },
              `会话 ID：${current}`,
            )
          : null,
      );
    }

    const RIGHT_SIDEBAR_DEFAULT_WIDTH = 120;
    const RIGHT_SIDEBAR_MIN_WIDTH = 112;
    const RIGHT_SIDEBAR_MAX_WIDTH = 180;

    function ProjectRightSidebar() {
      const rootRef = useRef(null);
      const resizeRef = useRef(null);
      const active = useActivePage();
      const [expanded, setExpanded] = useState(
        () => localStorage.getItem("laobos:right-sidebar") === "expanded",
      );
      const [panelWidth, setPanelWidth] = useState(() => {
        const saved = Number(localStorage.getItem("laobos:right-sidebar-width"));
        return Number.isFinite(saved) &&
          saved >= RIGHT_SIDEBAR_MIN_WIDTH &&
          saved <= RIGHT_SIDEBAR_MAX_WIDTH
          ? saved
          : RIGHT_SIDEBAR_DEFAULT_WIDTH;
      });
      const [frameWidth, setFrameWidth] = useState(() => window.innerWidth);
      const [dragging, setDragging] = useState(false);
      const autoCollapsed = frameWidth < 1140;
      const visibleExpanded = expanded && !autoCollapsed;

      useEffect(() => {
        const overlay = rootRef.current?.closest("[data-shell-overlay]");
        const frame = overlay?.parentElement;
        const leftSidebar = frame?.firstElementChild;
        if (!frame || !leftSidebar) return undefined;
        frame.setAttribute("data-laobos-right-sidebar", "");
        const markNativeSettings = () => {
          const trigger = leftSidebar.querySelector(
            'button[aria-haspopup="dialog"]',
          );
          if (trigger) {
            trigger.setAttribute("data-laobos-native-settings-trigger", "");
          }
        };
        let lastLeft = "";
        const syncLeftColumn = () => {
          const inlineColumns = frame.style.gridTemplateColumns || "";
          const inlineWidth = /^\s*([\d.]+)px/u.exec(inlineColumns)?.[1];
          const next = inlineWidth
            ? `${Math.round(Number(inlineWidth))}px`
            : `${Math.round(leftSidebar.getBoundingClientRect().width)}px`;
          if (next === lastLeft) return;
          lastLeft = next;
          frame.style.setProperty("--lbs-left-column", next);
        };
        const resizeObserver = new ResizeObserver(() => {
          setFrameWidth(Math.round(frame.getBoundingClientRect().width));
          syncLeftColumn();
        });
        const mutationObserver = new MutationObserver(syncLeftColumn);
        const syncNativeSettings = () => {
          markNativeSettings();
          const trigger = getNativeSettingsTrigger();
          if (trigger?.getAttribute("aria-expanded") === "true") {
            setActivePage("settings");
          } else if (activePage === "settings") {
            setActivePage("conversation");
          }
        };
        const sidebarObserver = new MutationObserver(syncNativeSettings);
        const closeFeaturePageFromConversationNavigation = (event) => {
          if (!isConversationNavigationClick(event.target, leftSidebar)) return;
          if (activePage === "conversation" && nativeView === "chat") return;
          const closed = requestCloseManagement(() => switchNativeView("chat"));
          if (!closed) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        resizeObserver.observe(frame);
        resizeObserver.observe(leftSidebar);
        mutationObserver.observe(frame, {
          attributes: true,
          attributeFilter: ["style"],
        });
        sidebarObserver.observe(leftSidebar, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-expanded"],
        });
        leftSidebar.addEventListener(
          "click",
          closeFeaturePageFromConversationNavigation,
          true,
        );
        setFrameWidth(Math.round(frame.getBoundingClientRect().width));
        syncLeftColumn();
        syncNativeSettings();
        // 同步 DSH 会话视图（隐藏的“对话/轨迹”tab）到右侧栏高亮。
        const syncNativeView = () => {
          const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
          const selected = tabs.find(
            (button) => button.getAttribute("aria-selected") === "true",
          );
          if (selected === undefined) return;
          const text = selected.textContent?.trim();
          if (text === "轨迹") setNativeView("trajectory");
          else if (text === "对话") setNativeView("chat");
        };
        const viewObserver = new MutationObserver(syncNativeView);
        viewObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-selected"],
        });
        syncNativeView();
        return () => {
          resizeObserver.disconnect();
          mutationObserver.disconnect();
          sidebarObserver.disconnect();
          viewObserver.disconnect();
          leftSidebar.removeEventListener(
            "click",
            closeFeaturePageFromConversationNavigation,
            true,
          );
          leftSidebar
            .querySelector("[data-laobos-native-settings-trigger]")
            ?.removeAttribute("data-laobos-native-settings-trigger");
          frame.removeAttribute("data-laobos-right-sidebar");
          frame.style.removeProperty("--lbs-left-column");
          frame.style.removeProperty("--lbs-right-column");
        };
      }, []);

      useEffect(() => {
        const overlay = rootRef.current?.closest("[data-shell-overlay]");
        const frame = overlay?.parentElement;
        if (!frame) return;
        frame.style.setProperty(
          "--lbs-right-column",
          `${visibleExpanded ? panelWidth : 56}px`,
        );
      }, [panelWidth, visibleExpanded]);

      useEffect(() => {
        localStorage.setItem(
          "laobos:right-sidebar",
          expanded ? "expanded" : "collapsed",
        );
      }, [expanded]);

      useEffect(() => {
        localStorage.setItem("laobos:right-sidebar-width", String(panelWidth));
      }, [panelWidth]);

      useEffect(() => {
        const syncOpenedTool = (event) => {
          const tool = event.detail?.tool;
          if (desktopToolPages.has(tool)) setActivePage(tool);
        };
        const syncClosedTool = (event) => {
          const tool = event.detail?.tool;
          if (tool === activePage && desktopToolPages.has(tool)) {
            setActivePage("conversation");
          }
        };
        window.addEventListener("laobos:open-desktop-tool", syncOpenedTool);
        window.addEventListener("laobos:desktop-tool-closed", syncClosedTool);
        return () => {
          window.removeEventListener("laobos:open-desktop-tool", syncOpenedTool);
          window.removeEventListener("laobos:desktop-tool-closed", syncClosedTool);
        };
      }, []);

      function navigate(page) {
        if (page === "trajectory") {
          requestCloseManagement(() => switchNativeView("trajectory"));
          return;
        }
        if (page === "conversation") {
          requestCloseManagement(() => switchNativeView("chat"));
          return;
        }
        if (page === "settings") {
          if (active === "settings") {
            requestCloseManagement();
            return;
          }
          requestCloseManagement(() => {
            if (openNativeSettings()) setActivePage("settings");
          });
          return;
        }
        if (active === page) {
          requestCloseManagement();
          return;
        }
        const activate = () => {
          setActivePage(page);
          if (desktopToolPages.has(page)) {
            const sessions = module.ctx?.sessions?.list?.getSnapshot?.();
            const cwd = sessions?.current ? sessions.byId?.[sessions.current]?.cwd : undefined;
            window.dispatchEvent(new CustomEvent("laobos:open-desktop-tool", {
              detail: { tool: page, cwd, source: "project-sidebar" },
            }));
          }
        };
        if (active !== "conversation") requestCloseManagement(activate);
        else activate();
      }

      function beginResize(event) {
        if (!visibleExpanded) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeRef.current = { x: event.clientX, width: panelWidth };
        setDragging(true);
      }

      function continueResize(event) {
        if (!resizeRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const next = resizeRef.current.width - (event.clientX - resizeRef.current.x);
        setPanelWidth(
          Math.min(
            RIGHT_SIDEBAR_MAX_WIDTH,
            Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.round(next)),
          ),
        );
      }

      function endResize(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        resizeRef.current = null;
        setDragging(false);
      }

      return h(
        "aside",
        {
          ref: rootRef,
          className: "lbs-right-sidebar",
          "data-expanded": visibleExpanded,
          "data-dragging": dragging,
          "aria-label": "项目侧边栏",
        },
        visibleExpanded
          ? h("div", {
              className: "lbs-right-resizer",
              role: "separator",
              "aria-label": "调整项目侧边栏宽度",
              "aria-orientation": "vertical",
              onPointerDown: beginResize,
              onPointerMove: continueResize,
              onPointerUp: endResize,
              onPointerCancel: endResize,
            })
          : null,
        h(
          "div",
          { className: "lbs-right-top" },
          visibleExpanded
            ? h(
                "div",
                { className: "lbs-right-brand" },
                h("span", { className: "lbs-right-brand-title" }, "项目空间"),
                h("span", { className: "lbs-right-brand-sub" }, "页面导航"),
              )
            : null,
          h(
            "button",
            {
              type: "button",
              className: "lbs-right-toggle",
              "aria-label": visibleExpanded ? "折叠项目侧边栏" : "展开项目侧边栏",
              "aria-expanded": visibleExpanded,
              disabled: autoCollapsed && !visibleExpanded && active === "conversation",
              title: autoCollapsed && active === "conversation" ? "窗口加宽后可展开" : undefined,
              onClick: () => {
                if (active !== "conversation" && active !== "trajectory") {
                  requestCloseManagement(() => setExpanded(false));
                  return;
                }
                setExpanded((value) => !value);
              },
            },
            h(Primitives.IconPanelLeftOutline16, {
              size: 16,
              className: "lbs-toggle-icon",
              "data-expanded": visibleExpanded,
            }),
          ),
        ),
        h(ProjectNavigation, {
          items: conversationNavigation,
          groupLabel: "对话",
          expanded: visibleExpanded,
          onNavigate: navigate,
        }),
        h(ProjectNavigation, {
          items: workbenchNavigation,
          groupLabel: "工作台",
          expanded: visibleExpanded,
          onNavigate: navigate,
        }),
        h(ProjectNavigation, {
          items: integrationNavigation,
          groupLabel: "集成管理",
          expanded: visibleExpanded,
          onNavigate: navigate,
        }),
        h("div", { className: "lbs-right-spacer" }),
        h(ProjectNavigation, {
          items: [settingsNavigation],
          expanded: visibleExpanded,
          onNavigate: navigate,
          bottom: true,
        }),
      );
    }

    function CenterWorkspacePage() {
      const active = useActivePage();
      useEffect(() => {
        if (active === "conversation") return undefined;
        const onKeyDown = (event) => {
          if (event.key === "Escape") requestCloseManagement();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [active]);
      if (active === "conversation") return null;
      const Page = {
        workflows: WorkflowsSection,
        knowledge: KnowledgeSection,
        skills: SkillsSection,
        mcp: McpSection,
      }[active];
      const item = primaryNavigation.find(
        (candidate) => candidate.id === active,
      );
      if (!Page || !item) return null;
      return h(
        "main",
        { className: "lbs-center-page", "aria-label": `${item.label}页面` },
        h(
          "header",
          { className: "lbs-center-bar" },
          h(
            "div",
            { className: "lbs-center-crumb" },
            h("span", { className: "lbs-center-crumb-icon", "aria-hidden": true }, h(ProjectNavIcon, { id: item.id })),
            h("span", { className: "lbs-center-crumb-title" }, item.label),
          ),
          h(
            "button",
            {
              type: "button",
              className: "lbs-center-close",
              "aria-label": "收起管理页面",
              onClick: () => requestCloseManagement(),
            },
            "收起",
          ),
        ),
        h(
          "div",
          { className: "lbs-center-scroll" },
          h(
            "div",
            { className: "lbs-center-content" },
            h(Page),
          ),
        ),
      );
    }

    // 整轮任务折叠桥接：运行时显示完整过程和进度；turn-tail 出现后把思考、
    // 工具调用及中间回答收进一个摘要，只留下该轮最终回答。摘要可手动重新展开。
    function TaskRecordFoldBridge() {
      useEffect(() => {
        if (typeof document === "undefined") return undefined;

        const records = new Map();

        // 从被隐藏的统计行提取“首 token 平均 · tok/s · 缓存命中”等进度信息。
        const readProgressStats = () => {
          const el = document.querySelector(".FJxK0a_root");
          if (el === null) return "";
          const text = el.textContent?.trim() || "";
          const groups = text.split("|").map((part) => part.trim()).filter(Boolean);
          const kept = groups.filter((group) =>
            /首\s*token|tok\/s|缓存命中|cache/i.test(group),
          );
          return kept.join(" | ");
        };
        const formatElapsed = (ms) => {
          const total = Math.max(0, Math.floor(ms / 1000));
          const hours = Math.floor(total / 3600);
          const minutes = Math.floor((total % 3600) / 60);
          const seconds = total % 60;
          if (hours > 0) return `${hours} 小时 ${minutes} 分钟 ${seconds} 秒`;
          if (minutes > 0) return `${minutes} 分钟 ${seconds} 秒`;
          return `${seconds} 秒`;
        };
        const flowKind = (node) => node.getAttribute("data-chat-flow-kind") || "";
        const flowKey = (node) => node.getAttribute("data-chat-flow-key") || "";
        const completedDuration = (tail) => {
          const text = tail.textContent?.replace(/\s+/g, " ") || "";
          const match = /(?:用时|Ran for)\s*([^·|]+)/i.exec(text);
          return match?.[1]?.trim() || "";
        };
        const summaryFor = (column, group, record) => {
          let summary = [...column.children].find(
            (child) =>
              child instanceof HTMLElement &&
              child.dataset.lbsTaskSummary === group.key,
          );
          if (summary instanceof HTMLElement) return summary;

          summary = document.createElement("div");
          summary.className = "lbs-task-summary";
          summary.dataset.lbsTaskSummary = group.key;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "lbs-task-summary-button";
          const state = document.createElement("span");
          state.className = "lbs-task-summary-status";
          state.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.className = "lbs-task-summary-label";
          const chevron = document.createElement("span");
          chevron.className = "lbs-task-summary-chevron";
          chevron.setAttribute("aria-hidden", "true");
          chevron.textContent = "›";
          button.append(state, label, chevron);
          button.addEventListener("click", () => {
            record.expanded = !record.expanded;
            schedule();
          });
          summary.appendChild(button);
          column.insertBefore(summary, group.nodes[0] || group.tail || null);
          return summary;
        };
        const clearNode = (node) => {
          node.classList.remove("lbs-task-process-hidden");
          delete node.dataset.lbsTaskProcess;
        };
        const clearFinalAnswer = (node) => {
          node.classList.remove("lbs-task-final-collapsed");
          delete node.dataset.lbsTaskFinal;
        };
        const groupsIn = (column) => {
          const nodes = [...column.children].filter(
            (child) =>
              child instanceof HTMLElement &&
              child.hasAttribute("data-chat-flow-kind"),
          );
          const groups = [];
          let start = 0;
          let boundaryKey = "";

          for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            const kind = flowKind(node);
            if (kind === "user") {
              start = index + 1;
              boundaryKey = flowKey(node);
              continue;
            }
            if (kind !== "turn-tail") continue;
            const turnId =
              node.querySelector("[data-turn-tail]")?.getAttribute("data-turn-tail") ||
              flowKey(node);
            groups.push({
              key: boundaryKey || `turn:${turnId}`,
              nodes: nodes.slice(start, index),
              tail: node,
              completed: true,
            });
            start = index + 1;
            boundaryKey = "";
          }

          const runningStatus = [...column.children].find(
            (child) =>
              child instanceof HTMLElement &&
              child.getAttribute("role") === "status" &&
              child.textContent?.includes("Deep diving"),
          );
          if (runningStatus !== undefined) {
            const runningNodes = nodes.slice(start);
            groups.push({
              key:
                boundaryKey ||
                `running:${flowKey(runningNodes[0] || runningStatus) || "current"}`,
              nodes: runningNodes,
              tail: runningStatus,
              completed: false,
            });
          }
          return groups;
        };
        const renderGroup = (column, group, activeKeys) => {
          const assistants = group.nodes.filter(
            (node) => flowKind(node) === "assistant-step",
          );
          const finalAnswer = group.completed ? assistants.at(-1) : undefined;
          const preserved = new Set(
            group.completed
              ? group.nodes.filter((node) =>
                  ["turn-error", "turn-max-tokens"].includes(flowKind(node)),
                )
              : [],
          );
          if (finalAnswer !== undefined) preserved.add(finalAnswer);
          const processNodes = group.completed
            ? group.nodes.filter((node) => !preserved.has(node))
            : group.nodes;
          const hasTaskProcess = processNodes.some((node) =>
            [
              "assistant-step",
              "tool-call",
              "command",
              "manual-compaction",
              "model-retry",
            ].includes(flowKind(node)),
          );
          if (!hasTaskProcess) return;

          activeKeys.add(group.key);
          let record = records.get(group.key);
          if (record === undefined) {
            record = {
              completed: group.completed,
              expanded: !group.completed,
              startedAt: Date.now(),
            };
            records.set(group.key, record);
          } else if (!record.completed && group.completed) {
            record.completed = true;
            record.expanded = false;
          }
          const summary = summaryFor(column, group, record);
          summary.dataset.state = group.completed ? "done" : "running";
          summary.dataset.expanded = String(record.expanded);
          const button = summary.querySelector(".lbs-task-summary-button");
          const label = summary.querySelector(".lbs-task-summary-label");
          const stats = group.completed ? "" : readProgressStats();
          const duration = group.completed
            ? completedDuration(group.tail)
            : formatElapsed(Date.now() - record.startedAt);
          const toolCount = group.nodes.filter(
            (node) => flowKind(node) === "tool-call",
          ).length;
          const operations = `已执行 ${toolCount} 项操作`;
          const text = group.completed
            ? duration
              ? `${operations} · 工作了 ${duration}`
              : operations
            : `${operations} · 已处理 ${duration}${stats ? ` | ${stats}` : ""}`;
          if (label !== null && label.textContent !== text) label.textContent = text;
          if (button !== null) {
            button.setAttribute("aria-expanded", String(record.expanded));
            button.setAttribute(
              "aria-label",
              `${text}，${record.expanded ? "收起" : "展开"}任务过程`,
            );
          }
          for (const node of processNodes) {
            node.dataset.lbsTaskProcess = group.key;
            node.classList.toggle("lbs-task-process-hidden", !record.expanded);
          }
          if (finalAnswer !== undefined) {
            finalAnswer.dataset.lbsTaskFinal = group.key;
            finalAnswer.classList.toggle(
              "lbs-task-final-collapsed",
              !record.expanded,
            );
          }
        };
        const scan = () => {
          const activeKeys = new Set();
          for (const column of document.querySelectorAll("[data-chat-flow]")) {
            for (const group of groupsIn(column)) {
              renderGroup(column, group, activeKeys);
            }
            for (const summary of column.querySelectorAll(".lbs-task-summary")) {
              if (!activeKeys.has(summary.dataset.lbsTaskSummary || "")) summary.remove();
            }
            for (const node of column.querySelectorAll("[data-lbs-task-process]")) {
              if (!activeKeys.has(node.dataset.lbsTaskProcess || "")) clearNode(node);
            }
            for (const node of column.querySelectorAll("[data-lbs-task-final]")) {
              if (!activeKeys.has(node.dataset.lbsTaskFinal || "")) {
                clearFinalAnswer(node);
              }
            }
          }
          for (const key of records.keys()) {
            if (!activeKeys.has(key)) records.delete(key);
          }
        };
        let rafPending = false;
        const schedule = () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            scan();
          });
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        const tick = setInterval(schedule, 1000);
        const onKeyDown = (event) => {
          if (event.key !== "Escape") return;
          const close = document.querySelector(".VOzbGW_panel .VOzbGW_close");
          if (close !== null) close.click();
        };
        window.addEventListener("keydown", onKeyDown);
        scan();
        return () => {
          observer.disconnect();
          clearInterval(tick);
          window.removeEventListener("keydown", onKeyDown);
          for (const summary of document.querySelectorAll(".lbs-task-summary")) {
            summary.remove();
          }
          for (const node of document.querySelectorAll("[data-lbs-task-process]")) {
            clearNode(node);
          }
          for (const node of document.querySelectorAll("[data-lbs-task-final]")) {
            clearFinalAnswer(node);
          }
        };
      }, []);
      return null;
    }

    function createConversationLocatorSource(sessions) {
      const listeners = new Set();
      let currentId;
      let currentSession;
      let stopList;
      let stopSession;
      let stopProjection;
      let projectionFace;

      const emit = () => {
        for (const listener of listeners) listener();
      };
      const syncSession = (force = false) => {
        const nextId = sessions.list.getSnapshot().current;
        const nextSession = nextId === undefined
          ? undefined
          : sessions.binding(nextId)?.session;
        if (!force && nextId === currentId && nextSession === currentSession) return;
        stopSession?.();
        stopProjection?.();
        stopSession = undefined;
        stopProjection = undefined;
        projectionFace = undefined;
        currentId = nextId;
        currentSession = nextSession;
        if (listeners.size > 0 && currentSession !== undefined) {
          stopSession = currentSession.subscribe(emit);
          projectionFace = currentSession.projections.faceOf("laobosConversationLocator");
          stopProjection = projectionFace.subscribe(emit);
        }
      };

      return {
        read: () => {
          syncSession();
          return {
            sessionId: currentId,
            session: currentSession,
            snapshot: currentSession?.getSnapshot(),
            locatorIndex: projectionFace?.getSnapshot(),
          };
        },
        subscribe: (listener) => {
          listeners.add(listener);
          if (listeners.size === 1) {
            stopList = sessions.list.subscribe(() => {
              syncSession();
              emit();
            });
            syncSession(true);
          }
          return () => {
            listeners.delete(listener);
            if (listeners.size > 0) return;
            stopList?.();
            stopSession?.();
            stopProjection?.();
            stopList = undefined;
            stopSession = undefined;
            stopProjection = undefined;
            projectionFace = undefined;
          };
        },
        loadOlder: async (expectedSessionId) => {
          syncSession();
          if (currentId !== expectedSessionId || currentSession === undefined) return false;
          await currentSession.loadOlder();
          return currentId === expectedSessionId;
        },
      };
    }

    // 对话记录定位桥接：优先使用宿主的轻量全量消息索引，而不是只扫描当前 DOM。
    // 分页外的消息先显示紧凑占位刻度；点击时逐页载入对应消息后再平滑定位。
    function ConversationLocatorBridge({ locatorSource }) {
      useEffect(() => {
        if (typeof document === "undefined") return undefined;
        const singletonKey = "__laobosConversationLocatorBridge";
        window[singletonKey]?.dispose?.();

        let host;
        let rail;
        let track;
        let preview;
        let previewTitle;
        let previewAnswer;
        let previewHint;
        let signature = "";
        let activeKey = "";
        let loadingKey = "";
        let currentEntries = new Map();
        let rafPending = false;
        let jumpGeneration = 0;
        let locatorVisible = false;

        const cleanText = (value) =>
          String(value || "").replace(/\s+/g, " ").trim();
        const clipped = (value, limit) => {
          const text = cleanText(value);
          return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
        };
        const flowKind = (node) => node.getAttribute("data-chat-flow-kind") || "";
        const flowKey = (node) => node.getAttribute("data-chat-flow-key") || "";
        const isHumanKind = (kind) => kind === "user" || kind === "steering";

        const contentText = (content) => cleanText(
          Array.isArray(content)
            ? content
                .map((block) => {
                  if (block?.type === "text" && typeof block.text === "string") {
                    return block.text;
                  }
                  return "";
                })
                .join(" ")
            : "",
        );
        const assistantText = (nodes) => {
          const assistant = nodes.findLast((node) => node?.data?.kind === "assistant");
          if (assistant === undefined) return "正在等待回答…";
          const text = cleanText(
            assistant.data.blocks
              ?.filter((block) => block.kind === "text")
              .map((block) => block.text)
              .join(" "),
          );
          return text || "正在处理这条消息…";
        };

        const finalAnswerText = (nodes) => {
          const assistant = nodes.findLast(
            (node) => flowKind(node) === "assistant-step",
          );
          if (assistant === undefined) return "正在等待回答…";
          const clone = assistant.cloneNode(true);
          for (const thinking of clone.querySelectorAll("[data-variant=think]")) {
            thinking.remove();
          }
          return cleanText(clone.textContent) || "正在处理这条消息…";
        };
        const domEntriesIn = (column) => {
          const nodes = [...column.children].filter(
            (child) =>
              child instanceof HTMLElement &&
              child.hasAttribute("data-chat-flow-kind"),
          );
          const users = nodes
            .map((node, index) => ({ node, index }))
            .filter(({ node }) => isHumanKind(flowKind(node)));
          return users.map(({ node, index }, userIndex) => {
            const end = users[userIndex + 1]?.index ?? nodes.length;
            const turnNodes = nodes.slice(index + 1, end);
            const question = cleanText(node.innerText || node.textContent).replace(
              /\s+\d{1,2}:\d{2}(?:\s*·.*)?$/,
              "",
            );
            return {
              key: flowKey(node) || `user:${index}`,
              anchor: node,
              question: clipped(question, 90) || `第 ${userIndex + 1} 轮对话`,
              answer: clipped(finalAnswerText(turnNodes), 180),
              index: userIndex,
              loaded: true,
            };
          });
        };
        const turnForNode = (node, timeline) => {
          const location = node?.location;
          if (location?.kind === "turn" || location?.kind === "step") {
            return location.turn.turn;
          }
          const seq = Number(node?.data?.seq ?? node?.anchorSeq);
          if (!Number.isFinite(seq)) return undefined;
          let previous;
          for (const turn of timeline.turnOrder) {
            const position = timeline.turns.get(turn);
            const startSeq = position?.start?.seq;
            if (startSeq === undefined) continue;
            if (startSeq > seq) {
              const previousEnd = previous?.end?.seq;
              if (previous !== undefined && (previousEnd === undefined || seq <= previousEnd)) {
                return previous.turn;
              }
              return turn;
            }
            previous = position;
          }
          return previous?.turn;
        };
        const sourceEntriesIn = (column) => {
          const model = locatorSource?.read();
          const snapshot = model?.snapshot;
          if (snapshot === undefined) return domEntriesIn(column);
          const order = snapshot.chat.order;
          const store = snapshot.chat.nodes;
          const timeline = snapshot.chat.timeline;
          const domByKey = new Map(
            [...column.querySelectorAll("[data-chat-flow-key]")]
              .map((node) => [flowKey(node), node]),
          );
          const domFlow = [...column.children].filter(
            (node) =>
              node instanceof HTMLElement &&
              node.hasAttribute("data-chat-flow-kind"),
          );
          const ordered = order
            .map((key) => store.get(key))
            .filter((node) => node !== undefined);
          const inputIndexes = ordered
            .map((node, index) => ({ node, index }))
            .filter(({ node }) => isHumanKind(node.data?.kind));
          const inputs = inputIndexes.map(({ node, index }, inputIndex) => {
            const end = inputIndexes[inputIndex + 1]?.index ?? ordered.length;
            const anchor = domByKey.get(node.key);
            const question = contentText(node.data?.content);
            const domIndex = anchor === undefined ? -1 : domFlow.indexOf(anchor);
            const nextDomIndex = domIndex < 0
              ? -1
              : domFlow.findIndex(
                  (candidate, candidateIndex) =>
                    candidateIndex > domIndex && isHumanKind(flowKind(candidate)),
                );
            const answer = domIndex < 0
              ? assistantText(ordered.slice(index + 1, end))
              : finalAnswerText(
                  domFlow.slice(domIndex + 1, nextDomIndex < 0 ? undefined : nextDomIndex),
                );
            return {
              key: node.key,
              anchor: anchor instanceof HTMLElement ? anchor : undefined,
              question: clipped(question, 90) || "历史对话",
              answer: clipped(answer, 180),
              loaded: anchor instanceof HTMLElement,
              sessionId: model.sessionId,
              seq: Number(node?.data?.seq ?? node?.anchorSeq),
              turn: turnForNode(node, timeline),
            };
          });
          const projected = Array.isArray(model.locatorIndex)
            ? model.locatorIndex
            : [];
          if (projected.length > 0) {
            const loadedBySeq = new Map(
              inputs
                .filter((entry) => Number.isFinite(entry.seq))
                .map((entry) => [entry.seq, entry]),
            );
            return projected.map((item, index) => {
              const loaded = loadedBySeq.get(item.seq);
              if (loaded !== undefined) return { ...loaded, index };
              return {
                key: `history:${model.sessionId || "current"}:${item.seq}`,
                question: clipped(item.question, 90) || `第 ${index + 1} 条历史对话`,
                answer: "该条对话尚未载入，点击刻度后会自动加载并定位。",
                loaded: false,
                sessionId: model.sessionId,
                seq: item.seq,
                turn: item.turn ?? undefined,
                index,
              };
            });
          }
          const byTurn = new Map();
          const unplaced = [];
          for (const entry of inputs) {
            if (entry.turn === undefined) {
              unplaced.push(entry);
              continue;
            }
            const bucket = byTurn.get(entry.turn) || [];
            bucket.push(entry);
            byTurn.set(entry.turn, bucket);
          }
          const turns = timeline.turnOrder;
          const maximumTurn = turns.length > 0 ? Math.max(...turns) : undefined;
          const firstTurn = turns.includes(0) ? 0 : 1;
          const entries = [];
          if (maximumTurn !== undefined) {
            for (let turn = firstTurn; turn <= maximumTurn; turn += 1) {
              const bucket = byTurn.get(turn);
              if (bucket !== undefined && bucket.length > 0) {
                entries.push(...bucket);
                continue;
              }
              entries.push({
                key: `history:${model.sessionId || "current"}:${turn}`,
                question: `第 ${turn} 轮历史对话`,
                answer: "该轮尚未载入，点击刻度后会自动加载并定位。",
                loaded: false,
                sessionId: model.sessionId,
                turn,
              });
            }
          }
          entries.push(...unplaced);
          if (entries.length === 0) return domEntriesIn(column);
          return entries.map((entry, index) => ({ ...entry, index }));
        };
        const hidePreview = () => {
          if (preview !== undefined) preview.dataset.visible = "false";
        };
        const conversationPageIsActive = () =>
          activePage === "conversation" && nativeView === "chat";
        const hideLocator = () => {
          if (rail !== undefined) rail.hidden = true;
          if (locatorVisible) jumpGeneration += 1;
          locatorVisible = false;
          loadingKey = "";
          hidePreview();
        };
        const showPreview = (key, marker) => {
          const entry = currentEntries.get(key);
          if (
            entry === undefined ||
            preview === undefined ||
            rail === undefined ||
            !(marker instanceof HTMLElement)
          ) return;
          previewTitle.textContent = entry.question;
          previewAnswer.textContent = entry.answer;
          previewHint.textContent = entry.loaded
            ? `第 ${entry.index + 1} 条对话 · 点击定位`
            : `第 ${entry.index + 1} 条对话 · 点击自动加载`;
          preview.dataset.visible = "true";
          const railRect = rail.getBoundingClientRect();
          const markerRect = marker.getBoundingClientRect();
          const hostRect = host.getBoundingClientRect();
          const composer = host.querySelector("[data-composer-seat]");
          const bottom = composer?.getBoundingClientRect().top || hostRect.bottom;
          const previewRect = preview.getBoundingClientRect();
          const left = Math.min(
            window.innerWidth - previewRect.width - 14,
            railRect.right + 12,
          );
          const top = Math.max(
            hostRect.top + 8,
            Math.min(markerRect.top - 18, bottom - previewRect.height - 8),
          );
          preview.style.left = `${Math.max(8, left)}px`;
          preview.style.top = `${top}px`;
        };
        const scrollToLoadedEntry = (entry) => {
          if (entry?.anchor === undefined || host === undefined) return false;
          const hostRect = host.getBoundingClientRect();
          const anchorRect = entry.anchor.getBoundingClientRect();
          const targetTop = Math.max(
            0,
            host.scrollTop + anchorRect.top - hostRect.top - 18,
          );
          host.scrollTo({
            top: targetTop,
            behavior: "auto",
          });
          hidePreview();
          return true;
        };
        const ensureChrome = () => {
          if (rail !== undefined && document.body.contains(rail)) return;
          signature = "";
          activeKey = "";
          rail = document.createElement("nav");
          rail.className = "lbs-conversation-locator";
          rail.setAttribute("aria-label", "对话记录定位");
          track = document.createElement("div");
          track.className = "lbs-conversation-locator-track";
          rail.appendChild(track);

          preview = document.createElement("aside");
          preview.className = "lbs-conversation-locator-preview";
          preview.dataset.visible = "false";
          previewTitle = document.createElement("div");
          previewTitle.className = "lbs-conversation-locator-title";
          previewAnswer = document.createElement("div");
          previewAnswer.className = "lbs-conversation-locator-answer";
          previewHint = document.createElement("div");
          previewHint.className = "lbs-conversation-locator-hint";
          preview.append(previewTitle, previewAnswer, previewHint);
          document.body.append(rail, preview);
        };
        const rebuildMarkers = (entries) => {
          const nextSignature = entries
            .map((entry) => `${entry.key}:${entry.loaded}:${entry.question}`)
            .join("|");
          if (nextSignature === signature) return;
          signature = nextSignature;
          activeKey = "";
          track.replaceChildren();
          entries.forEach((entry, index) => {
            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "lbs-conversation-locator-mark";
            marker.dataset.locatorKey = entry.key;
            marker.dataset.loaded = String(entry.loaded);
            marker.setAttribute(
              "aria-label",
              `${entry.loaded ? "定位到" : "加载并定位到"}第 ${index + 1} 条对话：${entry.question}`,
            );
            marker.addEventListener("mouseenter", () => showPreview(entry.key, marker));
            marker.addEventListener("mouseleave", hidePreview);
            marker.addEventListener("focus", () => showPreview(entry.key, marker));
            marker.addEventListener("blur", hidePreview);
            marker.addEventListener("click", () => {
              void activateEntry(entry.key);
            });
            track.appendChild(marker);
          });
        };
        const positionChrome = (column) => {
          if (host === undefined || rail === undefined) return;
          const hostRect = host.getBoundingClientRect();
          const columnRect = column?.getBoundingClientRect();
          const composer = host.querySelector("[data-composer-seat]");
          const bottom = composer?.getBoundingClientRect().top || hostRect.bottom;
          const contentLeft = columnRect?.left ?? hostRect.left + 52;
          const railWidth = rail.getBoundingClientRect().width || 30;
          const minimumLeft = hostRect.left + 8;
          const maximumLeft = Math.max(minimumLeft, contentLeft - railWidth - 12);
          const marginCenterLeft =
            hostRect.left + (contentLeft - hostRect.left - railWidth) / 2;
          rail.style.left = `${Math.min(
            maximumLeft,
            Math.max(minimumLeft, marginCenterLeft),
          )}px`;
          rail.style.top = `${hostRect.top + 18}px`;
          rail.style.height = `${Math.max(72, bottom - hostRect.top - 36)}px`;
        };
        const conversationIsVisible = (column) => {
          if (!(column instanceof HTMLElement) || host === undefined) return false;
          const hostRect = host.getBoundingClientRect();
          const columnRect = column.getBoundingClientRect();
          if (
            hostRect.width <= 0 ||
            hostRect.height <= 0 ||
            columnRect.width <= 0 ||
            columnRect.height <= 0
          ) return false;
          const probeX = Math.max(
            hostRect.left + 1,
            Math.min(hostRect.right - 1, columnRect.right - 8),
          );
          const probeY = Math.max(
            hostRect.top + 1,
            Math.min(hostRect.bottom - 1, hostRect.top + 80),
          );
          const foreground = document.elementFromPoint(probeX, probeY);
          return foreground !== null && host.contains(foreground);
        };
        const applyMarkerStates = () => {
          const displayedKey = loadingKey || activeKey;
          let longMarkerAssigned = false;
          for (const marker of track.querySelectorAll("[data-locator-key]")) {
            const isDisplayed =
              !longMarkerAssigned && marker.dataset.locatorKey === displayedKey;
            marker.dataset.active = String(isDisplayed);
            marker.dataset.loading = String(
              isDisplayed && marker.dataset.locatorKey === loadingKey,
            );
            if (isDisplayed) longMarkerAssigned = true;
          }
          const current = track.querySelector('[data-active="true"]');
          if (current instanceof HTMLElement) {
            const above = current.offsetTop < track.scrollTop;
            const below = current.offsetTop + current.offsetHeight > track.scrollTop + track.clientHeight;
            if (above || below) {
              track.scrollTop = Math.max(
                0,
                current.offsetTop - track.clientHeight / 2 + current.offsetHeight / 2,
              );
            }
          }
        };
        const updateActive = () => {
          if (host === undefined || currentEntries.size === 0) return;
          const hostRect = host.getBoundingClientRect();
          const readingLine = hostRect.top + 24;
          const loaded = [...currentEntries.values()].filter(
            (entry) => entry.anchor !== undefined,
          );
          let next = loaded[0];
          for (const entry of loaded) {
            if (entry.anchor.getBoundingClientRect().top <= readingLine) next = entry;
            else break;
          }
          if (next?.key === activeKey) return;
          activeKey = next?.key || "";
          applyMarkerStates();
        };
        const detachHost = () => {
          host?.removeEventListener("scroll", onScroll);
        };
        const attachHost = (nextHost) => {
          if (host === nextHost) return;
          detachHost();
          host = nextHost;
          host?.addEventListener("scroll", onScroll, { passive: true });
        };
        const scan = () => {
          ensureChrome();
          const column = document.querySelector("[data-chat-flow]");
          const nextHost = column?.closest("[data-conversation-scroll]");
          attachHost(nextHost instanceof HTMLElement ? nextHost : undefined);
          const entries = column instanceof HTMLElement ? sourceEntriesIn(column) : [];
          currentEntries = new Map(entries.map((entry) => [entry.key, entry]));
          const blocked = [...document.querySelectorAll(".lbs-center-page,.VOzbGW_overlay")]
            .some((element) => element.getClientRects().length > 0);
          const visible =
            conversationPageIsActive() &&
            !blocked &&
            conversationIsVisible(column);
          rail.hidden = !visible || entries.length === 0;
          if (rail.hidden) {
            hideLocator();
            return;
          }
          locatorVisible = true;
          rebuildMarkers(entries);
          positionChrome(column);
          updateActive();
          applyMarkerStates();
        };
        const schedule = () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            scan();
          });
        };
        const onPageVisibilityChange = () => {
          if (!conversationPageIsActive()) hideLocator();
          schedule();
        };
        const onScroll = () => {
          hidePreview();
          updateActive();
        };
        const afterRender = () => new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const activateEntry = async (key) => {
          let entry = currentEntries.get(key);
          if (entry === undefined) return;
          if (scrollToLoadedEntry(entry)) return;
          if (
            locatorSource === undefined ||
            entry.sessionId === undefined ||
            (entry.seq === undefined && entry.turn === undefined)
          ) return;
          const generation = ++jumpGeneration;
          const targetTurn = entry.turn;
          const targetSeq = entry.seq;
          const expectedSessionId = entry.sessionId;
          loadingKey = key;
          activeKey = key;
          applyMarkerStates();
          showPreview(key, track.querySelector(`[data-locator-key="${CSS.escape(key)}"]`));
          let stalled = 0;
          try {
            for (let page = 0; page < 64; page += 1) {
              if (generation !== jumpGeneration) return;
              scan();
              const loadedTarget = [...currentEntries.values()].find(
                (candidate) =>
                  candidate.anchor !== undefined &&
                  (targetSeq !== undefined
                    ? candidate.seq === targetSeq
                    : candidate.turn === targetTurn),
              );
              if (loadedTarget !== undefined) {
                entry = loadedTarget;
                break;
              }
              const before = locatorSource.read();
              if (
                before.sessionId !== expectedSessionId ||
                before.snapshot?.hasMore !== true
              ) break;
              const beforeHead = before.snapshot.chat.order[0];
              await locatorSource.loadOlder(before.sessionId);
              await afterRender();
              const after = locatorSource.read();
              const afterHead = after.snapshot?.chat.order[0];
              stalled = beforeHead === afterHead ? stalled + 1 : 0;
              if (stalled >= 2) break;
            }
            if (generation !== jumpGeneration) return;
            scan();
            const target = [...currentEntries.values()].find(
              (candidate) =>
                candidate.anchor !== undefined &&
                (targetSeq !== undefined
                  ? candidate.seq === targetSeq
                  : candidate.turn === targetTurn),
            );
            if (target !== undefined) {
              await afterRender();
              scrollToLoadedEntry(target);
              activeKey = target.key;
            }
          } finally {
            if (generation === jumpGeneration) {
              loadingKey = "";
              applyMarkerStates();
            }
          }
        };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
        });
        const unsubscribeLocator = locatorSource?.subscribe(schedule);
        pageListeners.add(onPageVisibilityChange);
        nativeViewListeners.add(onPageVisibilityChange);
        window.addEventListener("resize", schedule);
        let disposed = false;
        const dispose = () => {
          if (disposed) return;
          disposed = true;
          jumpGeneration += 1;
          observer.disconnect();
          unsubscribeLocator?.();
          pageListeners.delete(onPageVisibilityChange);
          nativeViewListeners.delete(onPageVisibilityChange);
          window.removeEventListener("resize", schedule);
          detachHost();
          rail?.remove();
          preview?.remove();
        };
        window[singletonKey] = { dispose };
        scan();
        return () => {
          if (window[singletonKey]?.dispose === dispose) {
            delete window[singletonKey];
          }
          dispose();
        };
      }, [locatorSource]);
      return null;
    }

    // The package manifest's dsh.client.inject controls module download order.
    // Cordis activation waits on runtime service names, not package ids.
    const inject = ["slots", "sessions"];
    function SkipWelcomeNotice({ complete }) {
      useEffect(() => complete(), [complete]);
      return null;
    }
    function apply(ctx) {
      module.ctx = ctx;
      const locatorSource = createConversationLocatorSource(ctx.sessions);
      ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
        name: "settings.onboarding",
        id: "welcome-notice",
        order: -100,
        priority: -1000,
      }, SkipWelcomeNotice));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "laobos-project-sidebar",
        order: 10,
      }, ProjectRightSidebar));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "laobos-project-workspace",
        order: 5,
      }, CenterWorkspacePage));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "laobos-task-record-fold-bridge",
        order: 20,
      }, TaskRecordFoldBridge));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay",
        id: "laobos-conversation-locator-bridge",
        order: 21,
        inject: () => ({ locatorSource }),
      }, ConversationLocatorBridge));
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "laobos-session-log",
        order: 25,
        label: () => "会话日志",
        inject: () => {
          const sessionLogDownload = ctx.get("sessionLogDownload");
          return {
            download:
              sessionLogDownload === undefined
                ? undefined
                : (sessionId) => sessionLogDownload.download(sessionId),
          };
        },
      }, SessionLogSection));
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "laobos-system-prompt",
        order: 5,
        label: () => "系统提示词",
      }, SystemPromptSection));
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "laobos-upload-cache",
        order: 15,
        label: () => "文件上传",
      }, UploadCacheSettingsSection));
      ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
        name: "settings.plugins.tab",
        id: "laobos-workflow-plugins",
        order: 20,
        label: () => "Agent 自动化",
      }, WorkflowPluginsTab));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
