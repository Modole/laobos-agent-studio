/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-app-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const css = `
      .lbs-apps-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:grid;grid-template-rows:44px auto 48px minmax(0,1fr) 25px;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}
      .lbs-apps-toolbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:5px;padding:0 10px}.lbs-apps-toolbar-title{align-items:baseline;display:flex;gap:8px;min-width:0}.lbs-apps-toolbar-title strong{font-size:13px}.lbs-apps-toolbar-title span{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-apps-toolbar-spacer{flex:1}.lbs-apps-button,.lbs-apps-icon,.lbs-apps-action{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:inherit}.lbs-apps-button{align-items:center;display:inline-flex;font-size:11px;gap:5px;height:30px;padding:0 10px}.lbs-apps-icon,.lbs-apps-action{align-items:center;display:inline-flex;height:29px;justify-content:center;padding:0;width:29px}.lbs-apps-button:hover,.lbs-apps-icon:hover,.lbs-apps-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.lbs-apps-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-apps-button.primary:hover{filter:brightness(1.06)}.lbs-apps-action.primary-action{color:var(--dsw-alias-interactive-bg-primary)}.lbs-apps-button.danger,.lbs-apps-action.danger{color:#d94b4b}.lbs-apps-button:disabled,.lbs-apps-icon:disabled,.lbs-apps-action:disabled{cursor:not-allowed;opacity:.35}.lbs-apps-spin{animation:lbs-apps-spin .8s linear infinite}@keyframes lbs-apps-spin{to{transform:rotate(360deg)}}
      .lbs-apps-notice{align-items:center;background:color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 7%,transparent);border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);display:flex;font-size:10px;gap:8px;line-height:1.45;min-height:34px;padding:5px 12px}.lbs-apps-notice strong{color:var(--dsw-alias-label-primary);font-size:10px}.lbs-apps-notice-summary{margin-left:auto;white-space:nowrap}.lbs-apps-notice-dot{background:#2ba36d;border-radius:50%;display:inline-block;height:6px;margin-right:5px;width:6px}
      .lbs-apps-filterbar{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:10px;padding:8px 12px}.lbs-apps-search{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:var(--dsw-alias-label-tertiary);display:flex;gap:7px;max-width:430px;padding:0 8px;width:100%}.lbs-apps-search:focus-within{border-color:color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 70%,var(--dsw-alias-border-l1));color:var(--dsw-alias-label-secondary)}.lbs-apps-search input{background:transparent;border:0;color:inherit;font:11px inherit;height:30px;min-width:0;outline:0;padding:0;width:100%}.lbs-apps-filter-meta{color:var(--dsw-alias-label-tertiary);font-size:9px;margin-left:auto;white-space:nowrap}
      .lbs-apps-list-wrap{min-height:0;overflow:auto}.lbs-apps-list-head,.lbs-apps-row{display:grid;gap:14px;grid-template-columns:minmax(250px,1.7fr) minmax(180px,1fr) 132px minmax(218px,auto);padding-left:14px;padding-right:10px}.lbs-apps-list-head{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:8px;font-weight:600;height:29px;letter-spacing:.06em;position:sticky;text-transform:uppercase;top:0;z-index:2}.lbs-apps-row{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);min-height:72px;padding-bottom:9px;padding-top:9px;transition:background .14s ease}.lbs-apps-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-apps-row-main{align-items:center;display:grid;gap:9px;grid-template-columns:9px minmax(0,1fr);min-width:0}.lbs-apps-dot{background:#89939e;border-radius:50%;display:block;flex:none;height:7px;width:7px}.lbs-apps-dot[data-state=running]{background:#2ba36d;box-shadow:0 0 0 3px color-mix(in srgb,#2ba36d 16%,transparent)}.lbs-apps-dot[data-state=online]{background:#4b8ed6;box-shadow:0 0 0 3px color-mix(in srgb,#4b8ed6 15%,transparent)}.lbs-apps-dot[data-state=starting],.lbs-apps-dot[data-state=stopping]{background:#d49a29}.lbs-apps-dot[data-state=error]{background:#d94b4b}.lbs-apps-row-copy,.lbs-apps-service,.lbs-apps-status-copy{display:grid;gap:4px;min-width:0}.lbs-apps-row-title{align-items:center;display:flex;gap:7px;min-width:0}.lbs-apps-row-title strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-badge{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-tertiary);flex:none;font-size:8px;padding:1px 4px;text-transform:uppercase}.lbs-apps-row-sub,.lbs-apps-service span,.lbs-apps-service code,.lbs-apps-status-copy small{color:var(--dsw-alias-label-tertiary);font:9px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-row-command{color:var(--dsw-alias-label-secondary);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-service strong{font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-service span{font-family:inherit}.lbs-apps-status-line{align-items:center;display:flex;font-size:10px;font-weight:600;gap:6px}.lbs-apps-status-line .lbs-apps-dot{box-shadow:none;height:6px;width:6px}.lbs-apps-row-actions{align-items:center;display:flex;gap:2px;justify-content:flex-end}.lbs-apps-action{color:var(--dsw-alias-label-tertiary);position:relative}.lbs-apps-action-separator{background:var(--dsw-alias-border-l1);height:18px;margin:0 3px;width:1px}.lbs-apps-row-error{color:#d94b4b;font-size:9px;grid-column:1/-1;margin:-3px 0 0 18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-empty-list{align-content:center;color:var(--dsw-alias-label-tertiary);display:grid;font-size:10px;gap:10px;justify-items:center;min-height:260px;padding:28px;text-align:center}.lbs-apps-empty-icon{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;display:flex;height:42px;justify-content:center;width:42px}.lbs-apps-empty-list strong{color:var(--dsw-alias-label-primary);font-size:12px}.lbs-apps-empty-list p{line-height:1.55;margin:0;max-width:360px}
      .lbs-apps-statusbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;gap:12px;padding:0 10px}.lbs-apps-statusbar span:last-child{margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-apps-error{background:#482129;border:1px solid #6d303a;border-radius:6px;color:#ffc4ca;font-size:10px;max-width:min(520px,calc(100% - 20px));padding:7px 10px;position:absolute;right:10px;top:84px;z-index:5}
      .lbs-apps-modal-backdrop{align-items:center;background:rgba(0,0,0,.46);display:flex;inset:0;justify-content:center;padding:22px;position:fixed;z-index:2147483220}.lbs-apps-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);display:grid;grid-template-rows:46px minmax(0,1fr) auto;max-height:min(780px,92vh);overflow:hidden;width:min(680px,calc(100vw - 34px))}.lbs-apps-modal.wide{width:min(850px,calc(100vw - 34px))}.lbs-apps-modal-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;padding:0 14px}.lbs-apps-modal-header h2{font-size:14px;margin:0}.lbs-apps-modal-header button{margin-left:auto}.lbs-apps-modal-body{min-height:0;overflow:auto;padding:15px}.lbs-apps-modal-footer{border-top:1px solid var(--dsw-alias-border-l1);display:flex;gap:7px;justify-content:flex-end;padding:10px 14px}
      .lbs-apps-log-viewer{background:#101419;border:1px solid #2b323b;border-radius:8px;color:#dce5ed;display:grid;grid-template-rows:34px minmax(0,1fr);height:min(560px,65vh);min-height:280px;overflow:hidden}.lbs-apps-log-header{align-items:center;background:#181d23;border-bottom:1px solid #2b323b;color:#a9b5c0;display:flex;font-size:9px;gap:7px;padding:0 10px}.lbs-apps-log-header strong{color:#e1e8ee;font-size:10px}.lbs-apps-log-header span{margin-left:auto}.lbs-apps-log{font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;min-height:0;overflow:auto;padding:10px;white-space:pre-wrap}.lbs-apps-log-empty{align-content:center;color:#74808b;display:grid;font-size:10px;height:100%;justify-items:center}
      .lbs-apps-form{display:grid;gap:13px}.lbs-apps-form-grid{display:grid;gap:10px;grid-template-columns:1fr 1fr}.lbs-apps-form label{color:var(--dsw-alias-label-secondary);display:grid;font-size:10px;gap:5px}.lbs-apps-form .wide{grid-column:1/-1}.lbs-apps-form input,.lbs-apps-form select,.lbs-apps-form textarea{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:11px inherit;min-height:32px;padding:6px 8px;width:100%}.lbs-apps-form textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:330px;resize:vertical}.lbs-apps-port-field{display:grid;gap:5px;grid-template-columns:minmax(0,1fr) auto}.lbs-apps-help{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.5;margin:0}.lbs-apps-rule{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;display:grid;font-size:9px;gap:5px;line-height:1.5;padding:10px}.lbs-apps-rule strong{font-size:10px}.lbs-apps-form-error{color:#d94b4b;font-size:10px;margin:0}.lbs-apps-delete-copy{font-size:11px;line-height:1.6;margin:0}.lbs-apps-delete-copy strong{display:block;margin-bottom:5px}
      @media(max-width:1050px){.lbs-apps-list-head,.lbs-apps-row{grid-template-columns:minmax(220px,1.5fr) minmax(150px,1fr) 112px minmax(196px,auto);gap:9px}.lbs-apps-action{height:27px;width:27px}}@media(max-width:900px){.lbs-apps-panel{left:0;right:0}.lbs-apps-list-head,.lbs-apps-row{grid-template-columns:minmax(220px,1.5fr) minmax(150px,1fr) 105px minmax(190px,auto)}.lbs-apps-notice-summary{display:none}}@media(max-width:700px){.lbs-apps-panel{grid-template-rows:44px auto 48px minmax(0,1fr) 25px}.lbs-apps-list-head{display:none}.lbs-apps-row{gap:7px;grid-template-columns:minmax(0,1fr) auto;min-height:94px;padding:10px 9px 10px 12px}.lbs-apps-service{grid-column:1}.lbs-apps-status-copy{grid-column:2;grid-row:1}.lbs-apps-row-actions{grid-column:2;grid-row:2}.lbs-apps-row-error{grid-column:1/-1;margin-left:18px}.lbs-apps-notice>span:not(.lbs-apps-notice-summary){display:none}.lbs-apps-filter-meta{display:none}.lbs-apps-form-grid{grid-template-columns:1fr}.lbs-apps-form .wide{grid-column:auto}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-app-manager"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-app-manager";
      style.textContent = css;
      document.head.append(style);
    }

    const statusLabels = {
      stopped: "已停止",
      starting: "启动中",
      running: "运行中",
      stopping: "停止中",
      online: "外部运行",
      error: "异常",
    };
    const kindLabels = { node: "Node", python: "Python", compose: "Compose", docker: "Docker", native: "自定义", unknown: "未知" };
    const messageOf = (reason) => reason instanceof Error ? reason.message : String(reason);
    const commandLine = (app) => [app.command, ...(app.args || [])].filter(Boolean).join(" ");
    const formatTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "—";

    function Icon({ name, size = 15, className = "" }) {
      let content = null;
      if (name === "plus") content = <><path d="M12 5v14" /><path d="M5 12h14" /></>;
      else if (name === "refresh") content = <><path d="M20 11a8 8 0 1 0-2.34 5.66" /><path d="M20 4v7h-7" /></>;
      else if (name === "close") content = <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>;
      else if (name === "search") content = <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>;
      else if (name === "apps") content = <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>;
      else if (name === "play") content = <path d="m8 5 11 7-11 7Z" />;
      else if (name === "stop") content = <rect x="6" y="6" width="12" height="12" rx="2" />;
      else if (name === "external") content = <><path d="M15 4h5v5" /><path d="m10 14 10-10" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>;
      else if (name === "document") content = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></>;
      else if (name === "code") content = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="m10 13-2 2 2 2M14 13l2 2-2 2" /></>;
      else if (name === "edit") content = <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>;
      else if (name === "trash") content = <><path d="M3 6h18" /><path d="M8 6V4h8v2M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>;
      else if (name === "loader") content = <><path d="M21 12a9 9 0 1 1-6.22-8.56" /><path d="M21 3v6h-6" /></>;
      return <svg aria-hidden="true" className={className} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width={size}>{content}</svg>;
    }

    function Modal({ title, children, footer, onClose, wide = false }) {
      return <div className="lbs-apps-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
        <section className={`lbs-apps-modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
          <header className="lbs-apps-modal-header"><h2>{title}</h2><button className="lbs-apps-icon" aria-label={`关闭${title}`} title="关闭" onClick={onClose}><Icon name="close" /></button></header>
          <div className="lbs-apps-modal-body">{children}</div>
          {footer ? <footer className="lbs-apps-modal-footer">{footer}</footer> : null}
        </section>
      </div>;
    }

    function AppEditor({ app, initialCwd, portRange, onClose, onSaved }) {
      const [form, setForm] = useState(() => ({
        id: app?.id || "",
        name: app?.name || "",
        cwd: app?.cwd || initialCwd || "",
        command: app?.command || "",
        args: (app?.args || []).join(" "),
        kind: app?.kind || "native",
        port: app?.port ? String(app.port) : "",
        url: app?.url || "",
      }));
      const [busy, setBusy] = useState(false);
      const [detecting, setDetecting] = useState(false);
      const [error, setError] = useState("");
      const autoDetectStarted = useRef(false);
      const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });
      const setPort = (port, url) => setForm((current) => ({ ...current, port: String(port), url: url || `http://127.0.0.1:${port}` }));
      const findPort = useCallback(async () => {
        setDetecting(true); setError("");
        try {
          const value = await window.laobosDesktop.apps.findPort(form.port || portRange.minimum);
          setPort(value.port, value.url);
        } catch (reason) { setError(messageOf(reason)); }
        finally { setDetecting(false); }
      }, [form.port, portRange.minimum]);
      const detect = useCallback(async () => {
        if (!form.cwd.trim()) { setError("请先填写工作目录。"); return; }
        setDetecting(true); setError("");
        try {
          const value = await window.laobosDesktop.apps.detect(form.cwd);
          if (!value.detected) throw new Error("未识别到可自动登记的应用，请手动填写启动命令。");
          const portValue = await window.laobosDesktop.apps.findPort(form.port || portRange.minimum);
          setForm((current) => ({
            ...current,
            name: current.name || value.name,
            command: value.command,
            args: (value.args || []).join(" "),
            kind: value.kind || "native",
            port: String(portValue.port),
            url: portValue.url,
          }));
        } catch (reason) { setError(messageOf(reason)); }
        finally { setDetecting(false); }
      }, [form.cwd, form.port, portRange.minimum]);
      useEffect(() => {
        if (autoDetectStarted.current || app || !initialCwd || form.command) return;
        autoDetectStarted.current = true;
        void detect();
      }, [app, detect, form.command, initialCwd]);
      const save = async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const saved = await window.laobosDesktop.apps.save({ ...form, port: form.port ? Number(form.port) : 0 });
          await onSaved(saved.id); onClose();
        } catch (reason) { setError(messageOf(reason)); }
        finally { setBusy(false); }
      };
      return <Modal title={app ? "编辑应用" : "登记应用"} onClose={() => !busy && onClose()} wide footer={<><button className="lbs-apps-button" disabled={busy} onClick={onClose}>取消</button><button className="lbs-apps-button primary" disabled={busy || detecting} form="lbs-app-editor-form" type="submit">{busy ? "正在校验并保存…" : "校验并保存"}</button></>}>
        <form className="lbs-apps-form" id="lbs-app-editor-form" onSubmit={save}>
          <div className="lbs-apps-rule"><strong>应用登记规则</strong><span>端口必须在 {portRange.minimum}–{portRange.maximum} 范围内。保存时会同时检查登记冲突和系统端口占用；启动后只有端口实际就绪，状态才会变为“运行中”。</span><span>命令中的端口请写成 <code>{"{PORT}"}</code>，启动时会替换为登记端口；固定端口必须与登记值一致。</span></div>
          <div className="lbs-apps-form-grid">
            <label>应用名称<input {...field("name")} maxLength="120" required placeholder="例如：项目预览" /></label>
            <label>应用类型<select {...field("kind")}><option value="node">Node</option><option value="python">Python</option><option value="compose">Docker Compose</option><option value="docker">Docker</option><option value="native">自定义</option></select></label>
            <label className="wide">工作目录<div className="lbs-apps-port-field"><input {...field("cwd")} required placeholder="当前工作区内的项目目录" /><button className="lbs-apps-button" disabled={busy || detecting} onClick={detect} type="button">{detecting ? "检测中…" : "识别项目"}</button></div></label>
            <label>启动命令<input {...field("command")} required placeholder="npm" /></label>
            <label>启动参数<input {...field("args")} placeholder={'run dev -- --port {PORT}'} /></label>
            <label>服务端口<div className="lbs-apps-port-field"><input {...field("port")} inputMode="numeric" min={portRange.minimum} max={portRange.maximum} required type="number" /><button className="lbs-apps-button" disabled={busy || detecting} onClick={findPort} type="button">自动分配</button></div></label>
            <label>访问地址<input {...field("url")} required placeholder={`http://127.0.0.1:${portRange.minimum}`} /></label>
          </div>
          <p className="lbs-apps-help">应用目录必须位于当前工作区。为了避免误暴露服务，访问地址只允许 localhost / 127.0.0.1，且端口必须与登记端口一致。</p>
          {error ? <p className="lbs-apps-form-error" role="alert">{error}</p> : null}
        </form>
      </Modal>;
    }

    function ApiDocEditor({ app, onClose }) {
      const [content, setContent] = useState("");
      const [loading, setLoading] = useState(true);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState("");
      useEffect(() => {
        let disposed = false;
        window.laobosDesktop.apps.apiDoc(app.id).then((value) => { if (!disposed) setContent(value.content || ""); }).catch((reason) => { if (!disposed) setError(messageOf(reason)); }).finally(() => { if (!disposed) setLoading(false); });
        return () => { disposed = true; };
      }, [app.id]);
      const save = async () => {
        setSaving(true); setError("");
        try { await window.laobosDesktop.apps.saveApiDoc(app.id, content); onClose(); }
        catch (reason) { setError(messageOf(reason)); }
        finally { setSaving(false); }
      };
      return <Modal title={`${app.name} · API 文档`} onClose={() => !saving && onClose()} wide footer={<><button className="lbs-apps-button" disabled={saving} onClick={onClose}>取消</button><button className="lbs-apps-button primary" disabled={saving || loading} onClick={save}>{saving ? "保存中…" : "保存文档"}</button></>}>
        <div className="lbs-apps-form"><p className="lbs-apps-help">可使用 Markdown 记录接口地址、鉴权方式、请求示例和联调说明。文档保存在应用管理数据目录，不会修改项目源码。</p><textarea aria-label="API 文档" disabled={loading} onChange={(event) => setContent(event.target.value)} placeholder="# API 文档" spellCheck="false" value={loading ? "正在加载…" : content} />{error ? <p className="lbs-apps-form-error" role="alert">{error}</p> : null}</div>
      </Modal>;
    }

    function LogViewer({ app, log, loading, onClose, onRefresh }) {
      return <Modal title={`${app.name} · 运行日志`} onClose={onClose} wide footer={<><button className="lbs-apps-button" disabled={loading} onClick={onRefresh}><Icon className={loading ? "lbs-apps-spin" : ""} name={loading ? "loader" : "refresh"} />刷新日志</button><button className="lbs-apps-button primary" onClick={onClose}>关闭</button></>}>
        <div className="lbs-apps-log-viewer">
          <header className="lbs-apps-log-header"><strong>stdout / stderr</strong><span>{loading ? "正在读取…" : log ? `${log.length.toLocaleString()} 字符` : "暂无输出"}</span></header>
          {log ? <pre className="lbs-apps-log">{log}</pre> : <div className="lbs-apps-log-empty">{loading ? "正在加载运行日志…" : "启动应用后，运行输出会显示在这里。"}</div>}
        </div>
      </Modal>;
    }

    function AppsPlugin() {
      const [open, setOpen] = useState(false);
      const [apps, setApps] = useState([]);
      const [portRange, setPortRange] = useState({ minimum: 40000, maximum: 65535 });
      const [query, setQuery] = useState("");
      const [log, setLog] = useState("");
      const [logLoading, setLogLoading] = useState(false);
      const [workspaceCwd, setWorkspaceCwd] = useState("");
      const [editor, setEditor] = useState(null);
      const [apiTarget, setApiTarget] = useState(null);
      const [logTarget, setLogTarget] = useState(null);
      const [deleteTarget, setDeleteTarget] = useState(null);
      const [busyId, setBusyId] = useState("");
      const [error, setError] = useState("");
      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return apps.filter((item) => !needle || `${item.name} ${item.cwd} ${item.command} ${item.kind} ${item.port} ${item.url}`.toLowerCase().includes(needle)).sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
      }, [apps, query]);
      const refresh = useCallback(async () => {
        if (!window.laobosDesktop?.apps) throw new Error("应用管理仅在桌面版中可用。");
        const value = await window.laobosDesktop.apps.list();
        setApps(value.apps || []);
        setPortRange(value.portRange || { minimum: 40000, maximum: 65535 });
      }, []);
      const safeRefresh = useCallback(async () => { try { setError(""); await refresh(); } catch (reason) { setError(messageOf(reason)); } }, [refresh]);
      const readLog = useCallback(async (id) => {
        if (!window.laobosDesktop?.apps || !id) return;
        setLogLoading(true); setError("");
        try { const value = await window.laobosDesktop.apps.logs(id); setLog(value.log || ""); }
        catch (reason) { setError(messageOf(reason)); }
        finally { setLogLoading(false); }
      }, []);
      const bootstrap = useCallback(async (hint = "") => {
        if (hint) setWorkspaceCwd(hint);
        else if (window.laobosDesktop?.workspace?.context) {
          try {
            const context = await window.laobosDesktop.workspace.context();
            setWorkspaceCwd(context.root || "");
          } catch (reason) { setError(messageOf(reason)); }
        }
        await safeRefresh();
      }, [safeRefresh]);
      useEffect(() => {
        if (!logTarget) { setLog(""); return; }
        void readLog(logTarget.id);
      }, [logTarget, readLog]);
      useEffect(() => {
        const offLog = window.laobosDesktop?.apps?.onLog((event) => {
          if (event.id === logTarget?.id) setLog((current) => `${current}${event.chunk}`.slice(-1_500_000));
        });
        const offState = window.laobosDesktop?.apps?.onState((event) => {
          setApps((items) => items.map((item) => item.id === event.id ? { ...item, runtime: event.runtime } : item));
        });
        return () => { offLog?.(); offState?.(); };
      }, [logTarget?.id]);
      useEffect(() => {
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-ready", { detail: { tool: "apps" } }));
        const show = (event) => {
          if (event.detail?.tool === "close") { setOpen(false); setLogTarget(null); return; }
          if (event.detail?.tool !== "apps") return;
          setOpen(true); setError(""); void bootstrap(event.detail.cwd || "");
        };
        window.addEventListener("laobos:open-desktop-tool", show);
        return () => window.removeEventListener("laobos:open-desktop-tool", show);
      }, [bootstrap]);
      useEffect(() => { if (open) window.dispatchEvent(new CustomEvent("laobos:desktop-tool-opened", { detail: { tool: "apps" } })); }, [open]);
      if (!open) return null;
      const close = () => { setOpen(false); setLogTarget(null); window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "apps" } })); };
      const run = async (id, task) => {
        setBusyId(id); setError("");
        try { await task(); await refresh(); }
        catch (reason) { setError(messageOf(reason)); await safeRefresh(); }
        finally { setBusyId(""); }
      };
      const remove = async () => {
        const target = deleteTarget; if (!target) return;
        setBusyId(target.id); setError("");
        try { await window.laobosDesktop.apps.remove(target.id); setDeleteTarget(null); if (logTarget?.id === target.id) setLogTarget(null); await refresh(); }
        catch (reason) { setError(messageOf(reason)); }
        finally { setBusyId(""); }
      };
      const runningCount = apps.filter((item) => ["running", "online", "starting"].includes(item.runtime?.state)).length;
      return <section className="lbs-apps-panel" role="dialog" aria-label="应用管理">
        <header className="lbs-apps-toolbar"><div className="lbs-apps-toolbar-title"><strong>应用管理</strong><span>{apps.length} 项已登记应用</span></div><div className="lbs-apps-toolbar-spacer" /><button className="lbs-apps-icon" aria-label="刷新应用列表" title="刷新应用列表" onClick={safeRefresh}><Icon name="refresh" /></button><button className="lbs-apps-button primary" onClick={() => setEditor({ mode: "create" })}><Icon name="plus" />登记应用</button><button className="lbs-apps-icon" aria-label="关闭应用管理" title="关闭" onClick={close}><Icon name="close" /></button></header>
        <div className="lbs-apps-notice"><strong>受管端口 {portRange.minimum}–{portRange.maximum}</strong><span>登记与启动时会检查端口占用，端口实际就绪后才显示为运行中。</span><span className="lbs-apps-notice-summary"><i className="lbs-apps-notice-dot" />{runningCount} 个在线 · {apps.length} 个应用</span></div>
        <div className="lbs-apps-filterbar"><div className="lbs-apps-search"><Icon name="search" size={14} /><input aria-label="搜索应用" onChange={(event) => setQuery(event.target.value)} placeholder="搜索应用名称、目录、命令、地址或端口" value={query} />{query ? <button className="lbs-apps-icon" aria-label="清空搜索" title="清空搜索" onClick={() => setQuery("")} type="button"><Icon name="close" size={13} /></button> : null}</div><span className="lbs-apps-filter-meta">显示 {filtered.length} / {apps.length}</span></div>
        <main className="lbs-apps-list-wrap">
          {filtered.length ? <><div className="lbs-apps-list-head" aria-hidden="true"><span>应用</span><span>服务</span><span>状态</span><span>操作</span></div>{filtered.map((item) => {
            const state = item.runtime?.state || "stopped";
            const transitioning = ["starting", "stopping"].includes(state) || busyId === item.id;
            const controlledRunning = ["running", "starting", "stopping"].includes(state);
            const canOpen = ["running", "online"].includes(state);
            const activityTitle = state === "online" ? "端口由外部进程占用，无法在此停止" : controlledRunning ? `停止应用 ${item.name}` : `启动应用 ${item.name}`;
            return <article className="lbs-apps-row" key={item.id}>
              <div className="lbs-apps-row-main"><span className="lbs-apps-dot" data-state={state} /><div className="lbs-apps-row-copy"><div className="lbs-apps-row-title"><strong title={item.name}>{item.name}</strong><span className="lbs-apps-badge">{kindLabels[item.kind] || item.kind}</span></div><span className="lbs-apps-row-command" title={commandLine(item)}>{commandLine(item)}</span><span className="lbs-apps-row-sub" title={item.cwd}>{item.cwd}</span></div></div>
              <div className="lbs-apps-service"><strong title={item.url}>{item.url || `http://127.0.0.1:${item.port}`}</strong><span>受管端口 :{item.port} · 更新 {formatTime(item.updatedAt)}</span></div>
              <div className="lbs-apps-status-copy"><span className="lbs-apps-status-line"><i className="lbs-apps-dot" data-state={state} />{statusLabels[state] || state}</span><small>{item.runtime?.pid ? `PID ${item.runtime.pid}` : state === "stopped" ? "进程未启动" : "正在检测进程"}</small></div>
              <div className="lbs-apps-row-actions">
                <button className="lbs-apps-action primary-action" aria-label={activityTitle} title={activityTitle} disabled={state === "online" || transitioning} onClick={() => run(item.id, () => controlledRunning ? window.laobosDesktop.apps.stop(item.id) : window.laobosDesktop.apps.start(item.id))}>{transitioning ? <Icon className="lbs-apps-spin" name="loader" /> : <Icon name={controlledRunning ? "stop" : "play"} />}</button>
                <button className="lbs-apps-action" aria-label={`打开应用 ${item.name}`} title="在浏览器中打开" disabled={!canOpen || transitioning} onClick={() => run(item.id, () => window.laobosDesktop.apps.open(item.id))}><Icon name="external" /></button>
                <button className="lbs-apps-action" aria-label={`编辑应用 ${item.name} API 文档`} title="API 文档" onClick={() => setApiTarget(item)}><Icon name="code" /></button>
                <button className="lbs-apps-action" aria-label={`查看应用 ${item.name} 日志`} title="查看日志" onClick={() => { setLog(""); setLogTarget(item); }}><Icon name="document" /></button>
                <button className="lbs-apps-action" aria-label={`编辑应用 ${item.name}`} title="编辑应用" disabled={transitioning} onClick={() => setEditor({ mode: "edit", app: item })}><Icon name="edit" /></button>
                <span className="lbs-apps-action-separator" />
                <button className="lbs-apps-action danger" aria-label={`移出应用 ${item.name}`} title="从管理中移出" disabled={transitioning} onClick={() => setDeleteTarget(item)}><Icon name="trash" /></button>
              </div>
              {item.runtime?.error ? <p className="lbs-apps-row-error" role="alert" title={item.runtime.error}>{item.runtime.error}</p> : null}
            </article>;
          })}</> : <div className="lbs-apps-empty-list"><span className="lbs-apps-empty-icon"><Icon name={query ? "search" : "apps"} size={19} /></span><strong>{apps.length ? "没有匹配的应用" : "尚未登记应用"}</strong><p>{apps.length ? "换一个名称、目录或端口继续搜索。" : "登记当前工作区项目后，可以在这里统一启动、打开、查看日志和维护配置。"}</p>{query ? <button className="lbs-apps-button" onClick={() => setQuery("")}>清空搜索</button> : <button className="lbs-apps-button primary" onClick={() => setEditor({ mode: "create" })}><Icon name="plus" />登记当前项目</button>}</div>}
        </main>
        <footer className="lbs-apps-statusbar"><span>{apps.length} 个已登记应用</span><span>{runningCount} 个在线</span><span>{workspaceCwd || "当前工作区"}</span></footer>
        {editor ? <AppEditor key={editor.app?.id || `new:${workspaceCwd}`} app={editor.app} initialCwd={workspaceCwd} portRange={portRange} onClose={() => setEditor(null)} onSaved={refresh} /> : null}
        {apiTarget ? <ApiDocEditor app={apiTarget} onClose={() => setApiTarget(null)} /> : null}
        {logTarget ? <LogViewer app={logTarget} loading={logLoading} log={log} onClose={() => setLogTarget(null)} onRefresh={() => readLog(logTarget.id)} /> : null}
        {deleteTarget ? <Modal title="移出应用管理" onClose={() => !busyId && setDeleteTarget(null)} footer={<><button className="lbs-apps-button" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)}>取消</button><button className="lbs-apps-button danger" disabled={Boolean(busyId)} onClick={remove}>{busyId ? "正在移出…" : "移出管理"}</button></>}><p className="lbs-apps-delete-copy"><strong>确定移出“{deleteTarget.name}”？</strong>受管进程会先停止，应用日志和 API 文档会从管理数据中清除；项目目录和源码文件不会被删除。</p></Modal> : null}
        {error ? <div className="lbs-apps-error" role="alert">{error}</div> : null}
      </section>;
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-app-manager", order: 43 }, AppsPlugin));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
