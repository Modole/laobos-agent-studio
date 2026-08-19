/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import xtermCss from "@xterm/xterm/css/xterm.css";

window.__ModuleLoader__.load({
  id: "@laobos/dsh-ssh",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const css = `${xtermCss}\n
      .lbs-ssh-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:grid;grid-template-rows:42px minmax(0,1fr) 24px;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}.lbs-ssh-toolbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:4px;padding:0 8px}.lbs-ssh-toolbar strong{font-size:13px;margin:0 4px}.lbs-ssh-toolbar-spacer{flex:1}.lbs-ssh-button,.lbs-ssh-icon{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:inherit;font-size:11px;height:29px;padding:0 9px}.lbs-ssh-icon{display:grid;padding:0;place-items:center;width:29px}.lbs-ssh-button:hover,.lbs-ssh-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-ssh-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-ssh-button:disabled,.lbs-ssh-icon:disabled{cursor:not-allowed;opacity:.42}.lbs-ssh-layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:0}.lbs-ssh-sidebar{background:var(--dsw-alias-bg-layer-1);border-right:1px solid var(--dsw-alias-border-l1);display:grid;grid-template-rows:42px minmax(0,1fr);min-height:0}.lbs-ssh-search{align-items:center;display:flex;padding:7px}.lbs-ssh-search input{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:11px inherit;height:28px;padding:0 8px;width:100%}.lbs-ssh-groups{min-height:0;overflow:auto;padding:0 5px 8px}.lbs-ssh-group h3{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;height:24px;margin:0;padding:0 5px}.lbs-ssh-group h3 span{margin-left:auto}.lbs-ssh-row{align-items:center;border-radius:6px;display:grid;grid-template-columns:minmax(0,1fr) 27px 27px 27px;margin-bottom:2px}.lbs-ssh-row[data-active=true],.lbs-ssh-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-ssh-row-main{background:transparent;border:0;color:inherit;cursor:pointer;display:grid;font:inherit;gap:2px;min-width:0;padding:7px 5px 7px 8px;text-align:left}.lbs-ssh-row-main strong,.lbs-ssh-row-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-row-main strong{font-size:11px}.lbs-ssh-row-main small{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-ssh-row-action{background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;height:25px;opacity:.1}.lbs-ssh-row:hover .lbs-ssh-row-action,.lbs-ssh-row-action:focus-visible{opacity:1}.lbs-ssh-row-action:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.lbs-ssh-row-action.danger:hover{color:#d94b4b}.lbs-ssh-empty-list{align-content:center;color:var(--dsw-alias-label-tertiary);display:grid;font-size:10px;gap:8px;justify-items:center;min-height:150px;padding:14px;text-align:center}.lbs-ssh-workspace{background:#101419;display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;min-width:0}.lbs-ssh-tabs{background:#181d23;border-bottom:1px solid #2b323b;display:flex;min-height:34px;overflow:auto hidden}.lbs-ssh-tab{align-items:center;border-right:1px solid #2b323b;border-top:2px solid transparent;color:#95a0ab;display:flex;max-width:200px;min-width:125px}.lbs-ssh-tab[data-active=true]{background:#101419;border-top-color:#55b58a;color:#e8edf2}.lbs-ssh-tab-main{align-items:center;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;flex:1;font:10px inherit;gap:6px;min-width:0;padding:0 8px}.lbs-ssh-tab-main span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-tab-close{background:transparent;border:0;color:inherit;height:25px;width:25px}.lbs-ssh-dot{background:#87929d;border-radius:50%;height:6px;width:6px}.lbs-ssh-dot[data-state=connected]{background:#39b87b}.lbs-ssh-dot[data-state=connecting],.lbs-ssh-dot[data-state=awaiting]{background:#e1a83d}.lbs-ssh-dot[data-state=error]{background:#e25d68}.lbs-ssh-stage{min-height:0;position:relative}.lbs-ssh-surface{inset:0;pointer-events:none;position:absolute;visibility:hidden}.lbs-ssh-surface[data-active=true]{pointer-events:auto;visibility:visible}.lbs-ssh-host{box-sizing:border-box;height:100%;padding:8px}.lbs-ssh-empty{align-content:center;color:#8f9aa6;display:grid;gap:9px;height:100%;justify-items:center;padding:28px;text-align:center}.lbs-ssh-empty strong{color:#e3e9ee;font-size:13px}.lbs-ssh-empty p{font-size:11px;line-height:1.5;margin:0;max-width:430px}.lbs-ssh-error{background:#482129;color:#ffc4ca;font-size:11px;left:10px;max-width:calc(100% - 20px);padding:7px 10px;position:absolute;top:9px;z-index:3}.lbs-ssh-global-error{background:#482129;border:1px solid #6d303a;border-radius:6px;color:#ffc4ca;font-size:10px;max-width:min(520px,calc(100% - 20px));padding:7px 10px;pointer-events:none;position:absolute;right:10px;top:48px;z-index:6}.lbs-ssh-status{align-items:center;background:var(--dsw-alias-bg-layer-1);border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;gap:12px;padding:0 8px}.lbs-ssh-status span:last-child{margin-left:auto}.lbs-ssh-modal-backdrop{align-items:center;background:rgba(0,0,0,.46);display:flex;inset:0;justify-content:center;padding:22px;position:fixed;z-index:2147483220}.lbs-ssh-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);display:grid;grid-template-rows:46px minmax(0,1fr) auto;max-height:min(760px,92vh);overflow:hidden;width:min(610px,calc(100vw - 34px))}.lbs-ssh-modal.wide{width:min(820px,calc(100vw - 34px))}.lbs-ssh-modal-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;padding:0 14px}.lbs-ssh-modal-header h2{font-size:14px;margin:0}.lbs-ssh-modal-header button{margin-left:auto}.lbs-ssh-modal-body{min-height:0;overflow:auto;padding:15px}.lbs-ssh-modal-footer{border-top:1px solid var(--dsw-alias-border-l1);display:flex;gap:7px;justify-content:flex-end;padding:10px 14px}.lbs-ssh-form{display:grid;gap:12px}.lbs-ssh-form-grid{display:grid;gap:10px;grid-template-columns:1fr 110px}.lbs-ssh-form label{color:var(--dsw-alias-label-secondary);display:grid;font-size:10px;gap:5px}.lbs-ssh-form .wide{grid-column:1/-1}.lbs-ssh-form input,.lbs-ssh-form select,.lbs-ssh-form textarea{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:11px inherit;height:32px;padding:0 8px;width:100%}.lbs-ssh-form textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;height:112px;padding:8px;resize:vertical}.lbs-ssh-check{align-items:center!important;display:flex!important;gap:7px!important}.lbs-ssh-check input{height:14px!important;width:14px!important}.lbs-ssh-help{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.5;margin:0}.lbs-ssh-form-error{color:#d94b4b;font-size:10px;margin:0}.lbs-ssh-credentials{display:grid;gap:7px}.lbs-ssh-credential{align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:9px}.lbs-ssh-credential span{display:grid;gap:2px}.lbs-ssh-credential small{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-ssh-fingerprint{background:var(--dsw-alias-bg-base);border-radius:6px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px;word-break:break-all}@media(max-width:850px){.lbs-ssh-panel{left:0;right:0}.lbs-ssh-layout{grid-template-columns:195px minmax(0,1fr)}}@media(max-width:620px){.lbs-ssh-layout{grid-template-columns:1fr}.lbs-ssh-sidebar{display:none}.lbs-ssh-toolbar strong{display:none}}
      .lbs-ssh-workspace,.lbs-ssh-stage{background:var(--dsw-alias-bg-base)}.lbs-ssh-tabs{background:var(--dsw-alias-bg-layer-1);border-bottom-color:var(--dsw-alias-border-l1)}.lbs-ssh-tab{border-right-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary)}.lbs-ssh-tab[data-active=true]{background:var(--dsw-alias-bg-base);border-top-color:var(--dsw-alias-state-success-primary,#39b87b);color:var(--dsw-alias-label-primary)}.lbs-ssh-empty{color:var(--dsw-alias-label-tertiary)}.lbs-ssh-empty strong{color:var(--dsw-alias-label-primary)}.lbs-ssh-error,.lbs-ssh-global-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b4b) 10%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b4b) 28%,transparent);color:var(--dsw-alias-state-error-primary,#d94b4b)}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-ssh"]')) {
      const style = document.createElement("style"); style.dataset.pluginCss = "@laobos/dsh-ssh"; style.textContent = css; document.head.append(style);
    }

    function terminalTheme(element) {
      const styles = getComputedStyle(element);
      const color = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
      const dark = document.body.hasAttribute("data-ds-dark-theme");
      return {
        background: color("--dsw-alias-bg-base", dark ? "#151517" : "#ffffff"),
        foreground: color("--dsw-alias-label-primary", dark ? "#f1f3f5" : "#0f1115"),
        cursor: color("--dsw-alias-label-primary", dark ? "#f1f3f5" : "#0f1115"),
        cursorAccent: color("--dsw-alias-bg-base", dark ? "#151517" : "#ffffff"),
        selectionBackground: color("--dsw-alias-interactive-bg-active", dark ? "rgba(88,166,255,.28)" : "rgba(9,105,218,.18)"),
        black: dark ? "#484f58" : "#24292f", red: dark ? "#ff7b72" : "#cf222e", green: dark ? "#3fb950" : "#1a7f37", yellow: dark ? "#d29922" : "#9a6700",
        blue: dark ? "#58a6ff" : "#0969da", magenta: dark ? "#bc8cff" : "#8250df", cyan: dark ? "#39c5cf" : "#1b7c83", white: dark ? "#b1bac4" : "#6e7781",
        brightBlack: dark ? "#6e7681" : "#57606a", brightRed: dark ? "#ffa198" : "#a40e26", brightGreen: dark ? "#56d364" : "#116329", brightYellow: dark ? "#e3b341" : "#4d2d00",
        brightBlue: dark ? "#79c0ff" : "#218bff", brightMagenta: dark ? "#d2a8ff" : "#a475f9", brightCyan: dark ? "#56d4dd" : "#3192aa", brightWhite: dark ? "#f0f6fc" : "#24292f",
      };
    }

    function syncTerminalTheme(terminal, element) {
      const applyTheme = () => { terminal.options.theme = terminalTheme(element); };
      const observer = new MutationObserver(applyTheme);
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      media?.addEventListener?.("change", applyTheme);
      applyTheme();
      return () => { observer.disconnect(); media?.removeEventListener?.("change", applyTheme); };
    }

    function Modal({ title, wide, children, footer, onClose }) {
      return <div className="lbs-ssh-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className={`lbs-ssh-modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
          <header className="lbs-ssh-modal-header"><h2>{title}</h2><button className="lbs-ssh-icon" aria-label="关闭" onClick={onClose}>×</button></header>
          <div className="lbs-ssh-modal-body">{children}</div>
          {footer ? <footer className="lbs-ssh-modal-footer">{footer}</footer> : null}
        </section>
      </div>;
    }

    function ProfileEditor({ profile, credentials, encryptionAvailable, onClose, onSaved, onForgetHostKey }) {
      const [form, setForm] = useState({
        name: profile?.name || "", host: profile?.host || "", port: String(profile?.port || 22),
        username: profile?.username || "", group: profile?.group || "", favorite: profile?.favorite === true,
        credentialId: profile?.credentialId || "new", credentialName: "", type: "password",
        password: "", privateKey: "", passphrase: "",
      });
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });
      const save = async () => {
        setError("");
        const port = Number(form.port);
        if (!form.name.trim() || !form.host.trim() || !form.username.trim()) { setError("请填写连接名称、主机和用户名。"); return; }
        if (!Number.isInteger(port) || port < 1 || port > 65535) { setError("SSH 端口必须是 1-65535 的整数。"); return; }
        if (form.credentialId === "new" && (form.type === "password" ? !form.password : !form.privateKey.trim())) { setError(form.type === "password" ? "请输入登录密码。" : "请输入私钥。"); return; }
        setBusy(true);
        try {
          let credentialId = form.credentialId;
          if (credentialId === "new") {
            if (!encryptionAvailable) throw new Error("系统安全存储不可用，当前不能持久保存 SSH 凭据。");
            const credential = await window.laobosDesktop.ssh.saveCredential({
              name: form.credentialName.trim() || `${form.name.trim()} 凭据`,
              type: form.type,
              password: form.password,
              privateKey: form.privateKey,
              passphrase: form.passphrase,
            });
            credentialId = credential.id;
          }
          await window.laobosDesktop.ssh.saveProfile({
            id: profile?.id,
            name: form.name.trim(), host: form.host.trim(), port, username: form.username.trim(),
            credentialId, group: form.group.trim(), favorite: form.favorite,
          });
          await onSaved();
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      return <Modal title={profile ? `编辑连接 · ${profile.name}` : "新建 SSH 连接"} wide onClose={onClose} footer={<><button className="lbs-ssh-button" disabled={busy} onClick={onClose}>取消</button><button className="lbs-ssh-button primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存连接"}</button></>}>
        <div className="lbs-ssh-form">
          <div className="lbs-ssh-form-grid">
            <label>连接名称<input autoFocus {...field("name")} placeholder="生产服务器" /></label>
            <label>端口<input {...field("port")} type="number" min="1" max="65535" /></label>
            <label className="wide">主机地址<input {...field("host")} placeholder="server.example.com 或 192.168.1.10" /></label>
            <label>分组<input {...field("group")} placeholder="例如：生产环境" /></label>
            <label className="lbs-ssh-check"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm((current) => ({ ...current, favorite: event.target.checked }))} />收藏连接</label>
          </div>
          <div className="lbs-ssh-form-grid">
            <label>登录用户名<input {...field("username")} placeholder="root" /></label>
            <label>凭据来源<select {...field("credentialId")}><option value="new">新建凭据</option>{credentials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {form.credentialId === "new" ? <>
              <label>凭据名称<input {...field("credentialName")} placeholder="可选" /></label>
              <label>认证方式<select {...field("type")}><option value="password">密码</option><option value="privateKey">私钥</option></select></label>
              {form.type === "password" ? <label className="wide">密码<input {...field("password")} type="password" autoComplete="new-password" /></label> : <>
                <label className="wide">私钥<textarea {...field("privateKey")} spellCheck="false" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" /></label>
                <label>私钥口令<input {...field("passphrase")} type="password" /></label>
              </>}
            </> : <p className="lbs-ssh-help wide">此连接会复用所选凭据；用户名仍按当前连接单独保存。</p>}
          </div>
          {profile?.fingerprint ? <div><p className="lbs-ssh-help">已信任的主机指纹</p><div className="lbs-ssh-fingerprint">{profile.fingerprint}</div><button className="lbs-ssh-button" onClick={() => onForgetHostKey(profile)}>忘记指纹</button></div> : null}
          <p className="lbs-ssh-help">密码和私钥通过 Electron 系统安全存储加密保存；首次连接仍需核对服务器指纹。</p>
          {error ? <p className="lbs-ssh-form-error" role="alert">{error}</p> : null}
        </div>
      </Modal>;
    }

    function CredentialManager({ credentials, profiles, encryptionAvailable, onClose, onChanged }) {
      const [form, setForm] = useState({ name: "", type: "password", password: "", privateKey: "", passphrase: "" });
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });
      const create = async () => {
        setError("");
        if (!form.name.trim()) { setError("请输入凭据名称。"); return; }
        if (form.type === "password" ? !form.password : !form.privateKey.trim()) { setError(form.type === "password" ? "请输入密码。" : "请输入私钥。"); return; }
        setBusy(true);
        try {
          await window.laobosDesktop.ssh.saveCredential(form);
          setForm({ name: "", type: "password", password: "", privateKey: "", passphrase: "" });
          await onChanged();
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      const remove = async (credential) => {
        if (!window.confirm(`确定删除凭据“${credential.name}”？`)) return;
        setBusy(true); setError("");
        try { await window.laobosDesktop.ssh.deleteCredential(credential.id); await onChanged(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      return <Modal title="SSH 凭据管理" wide onClose={onClose} footer={<button className="lbs-ssh-button" onClick={onClose}>关闭</button>}>
        <div className="lbs-ssh-form">
          <div className="lbs-ssh-credentials">
            {credentials.map((credential) => {
              const usage = profiles.filter((profile) => profile.credentialId === credential.id).length;
              return <div className="lbs-ssh-credential" key={credential.id}><span><strong>{credential.name}</strong><small>{credential.type === "privateKey" ? "私钥" : "密码"} · {usage ? `${usage} 个连接正在使用` : "未使用"}</small></span><button className="lbs-ssh-button" disabled={busy || usage > 0} onClick={() => remove(credential)}>删除</button></div>;
            })}
            {!credentials.length ? <p className="lbs-ssh-help">尚未保存凭据。可以在这里预先创建，也可以在新建连接时创建。</p> : null}
          </div>
          <div className="lbs-ssh-form-grid">
            <label>新凭据名称<input {...field("name")} placeholder="运维账号" /></label>
            <label>认证方式<select {...field("type")}><option value="password">密码</option><option value="privateKey">私钥</option></select></label>
            {form.type === "password" ? <label className="wide">密码<input {...field("password")} type="password" /></label> : <><label className="wide">私钥<textarea {...field("privateKey")} spellCheck="false" /></label><label>私钥口令<input {...field("passphrase")} type="password" /></label></>}
          </div>
          <button className="lbs-ssh-button primary" disabled={busy || !encryptionAvailable} onClick={create}>保存新凭据</button>
          {!encryptionAvailable ? <p className="lbs-ssh-form-error">系统安全存储当前不可用。</p> : null}
          {error ? <p className="lbs-ssh-form-error" role="alert">{error}</p> : null}
        </div>
      </Modal>;
    }

    function HostKeyDialog({ challenge, onClose }) {
      if (!challenge) return null;
      return <Modal title="确认 SSH 主机身份" onClose={() => { challenge.reject(); onClose(); }} footer={<><button className="lbs-ssh-button" onClick={() => { challenge.reject(); onClose(); }}>取消连接</button><button className="lbs-ssh-button primary" onClick={() => { challenge.accept(); onClose(); }}>信任并连接</button></>}>
        <div className="lbs-ssh-form"><p>这是首次连接该服务器。请通过可信渠道核对指纹，确认无误后再继续。</p><div className="lbs-ssh-fingerprint">{challenge.fingerprint}</div><p className="lbs-ssh-help">{challenge.profile.username}@{challenge.profile.host}:{challenge.profile.port}</p></div>
      </Modal>;
    }

    function SshSurface({ session, active, onState, onError, onChallenge }) {
      const host = useRef(null);
      const terminalRef = useRef(null);
      const activeRef = useRef(active);
      useEffect(() => {
        activeRef.current = active;
        if (active) terminalRef.current?.focus();
      }, [active]);
      useEffect(() => {
        if (!host.current || !window.laobosDesktop?.capabilities?.ssh) { onError(session.id, "SSH 仅在桌面版中可用。"); return undefined; }
        let connectionId = ""; let disposed = false;
        const terminal = new Terminal({ cursorBlink: true, fontSize: 13, lineHeight: 1.2, scrollback: 10000, theme: terminalTheme(host.current) });
        terminalRef.current = terminal;
        const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(host.current);
        const stopThemeSync = syncTerminalTheme(terminal, host.current);
        const fitTerminal = () => { try { fit.fit(); if (connectionId) void window.laobosDesktop.ssh.resize({ id: connectionId, cols: terminal.cols, rows: terminal.rows }); } catch {} };
        fitTerminal();
        const offData = window.laobosDesktop.ssh.onData((event) => { if (event.id === connectionId) terminal.write(event.data); });
        const offExit = window.laobosDesktop.ssh.onExit((event) => { if (event.id === connectionId) { terminal.write("\r\n[SSH 连接已关闭]\r\n"); onState(session.id, "disconnected", "已断开"); } });
        const input = terminal.onData((data) => { if (connectionId) void window.laobosDesktop.ssh.write({ id: connectionId, data }); });
        const resize = new ResizeObserver(fitTerminal); resize.observe(host.current);
        const connect = async (acceptUnknownHostKey = false) => {
          try {
            onState(session.id, "connecting", "正在连接…");
            const value = await window.laobosDesktop.ssh.connect({ profileId: session.profile.id, cols: terminal.cols, rows: terminal.rows, acceptUnknownHostKey });
            if (disposed) { void window.laobosDesktop.ssh.disconnect(value.id); return; }
            connectionId = value.id; onState(session.id, "connected", `${value.profile.username}@${value.profile.host}`); if (activeRef.current) terminal.focus();
          } catch (reason) {
            if (disposed) return;
            const message = reason instanceof Error ? reason.message : String(reason);
            const unknown = message.match(/HOST_KEY_UNKNOWN:(SHA256:[A-Za-z0-9+/]+)/u);
            if (unknown) {
              onState(session.id, "awaiting", "等待确认主机指纹");
              onChallenge({ profile: session.profile, fingerprint: unknown[1], accept: () => void connect(true), reject: () => onError(session.id, "已取消首次连接。") });
              return;
            }
            onError(session.id, message.includes("HOST_KEY_CHANGED:") ? "主机密钥与历史记录不一致，连接已阻止。请核实服务器身份并重置信任指纹。" : message);
          }
        };
        void connect();
        return () => { disposed = true; terminalRef.current = null; stopThemeSync(); resize.disconnect(); input.dispose(); offData(); offExit(); terminal.dispose(); if (connectionId) void window.laobosDesktop.ssh.disconnect(connectionId); };
      }, [onChallenge, onError, onState, session.generation, session.id, session.profile]);
      return <div className="lbs-ssh-host" ref={host} />;
    }

    let sessionSequence = 0;
    function SshPlugin() {
      const [open, setOpen] = useState(false);
      const [profiles, setProfiles] = useState([]);
      const [credentials, setCredentials] = useState([]);
      const [encryptionAvailable, setEncryptionAvailable] = useState(true);
      const [query, setQuery] = useState("");
      const [selected, setSelected] = useState("");
      const [sessions, setSessions] = useState([]);
      const [activeId, setActiveId] = useState("");
      const [editorOpen, setEditorOpen] = useState(false);
      const [editingProfile, setEditingProfile] = useState(null);
      const [credentialsOpen, setCredentialsOpen] = useState(false);
      const [deleteTarget, setDeleteTarget] = useState(null);
      const [challenge, setChallenge] = useState(null);
      const [error, setError] = useState("");
      const activeSession = useMemo(() => sessions.find((item) => item.id === activeId) || null, [sessions, activeId]);
      const filtered = useMemo(() => profiles.filter((profile) => !query.trim() || `${profile.name} ${profile.host} ${profile.group || ""}`.toLowerCase().includes(query.trim().toLowerCase())).sort((left, right) => Number(right.favorite) - Number(left.favorite) || left.name.localeCompare(right.name, "zh-CN")), [profiles, query]);
      const groups = useMemo(() => {
        const result = new Map();
        for (const profile of filtered) { const group = profile.group || "未分组"; result.set(group, [...(result.get(group) || []), profile]); }
        return [...result.entries()];
      }, [filtered]);
      const refresh = useCallback(async () => {
        if (!window.laobosDesktop?.ssh) throw new Error("当前环境不支持 SSH 管理。");
        const value = await window.laobosDesktop.ssh.list();
        setProfiles(value.profiles || []); setCredentials(value.credentials || []); setEncryptionAvailable(value.encryptionAvailable !== false);
        setSelected((current) => value.profiles.some((profile) => profile.id === current) ? current : value.profiles[0]?.id || "");
      }, []);
      const safeRefresh = useCallback(async () => { try { setError(""); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } }, [refresh]);
      const updateSession = useCallback((id, status, message) => setSessions((items) => items.map((item) => item.id === id ? { ...item, status, message, error: status === "error" ? message : "" } : item)), []);
      const sessionError = useCallback((id, message) => updateSession(id, "error", message), [updateSession]);
      const connect = (profile) => {
        const session = { id: `ssh-session-${Date.now().toString(36)}-${++sessionSequence}`, profile, generation: 0, status: "connecting", message: "正在连接…", error: "" };
        setSessions((items) => [...items, session]); setActiveId(session.id); setSelected(profile.id);
      };
      const closeSession = (id) => {
        const index = sessions.findIndex((item) => item.id === id); const remaining = sessions.filter((item) => item.id !== id);
        setSessions(remaining); if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id || "");
      };

      useEffect(() => {
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-ready", { detail: { tool: "ssh" } }));
        const show = (event) => {
          if (event.detail?.tool === "close") { setOpen(false); setSessions([]); setActiveId(""); return; }
          if (event.detail?.tool !== "ssh") return;
          setOpen(true); void safeRefresh();
        };
        window.addEventListener("laobos:open-desktop-tool", show);
        return () => window.removeEventListener("laobos:open-desktop-tool", show);
      }, [safeRefresh]);
      useEffect(() => { if (open) window.dispatchEvent(new CustomEvent("laobos:desktop-tool-opened", { detail: { tool: "ssh" } })); }, [open]);
      if (!open) return null;
      const close = () => { setOpen(false); setSessions([]); setActiveId(""); window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "ssh" } })); };
      const saveFinished = async () => { await safeRefresh(); setEditorOpen(false); setEditingProfile(null); };
      const removeProfile = async () => {
        const profile = deleteTarget; if (!profile) return;
        try {
          setSessions((items) => items.filter((item) => item.profile.id !== profile.id));
          await window.laobosDesktop.ssh.deleteProfile(profile.id); setDeleteTarget(null); await safeRefresh();
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      };
      const forgetHostKey = async (profile) => {
        if (!window.confirm(`确定忘记“${profile.name}”已信任的主机指纹？下次连接必须重新确认。`)) return;
        try { await window.laobosDesktop.ssh.forgetHostKey(profile.id); await safeRefresh(); setEditorOpen(false); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      };
      return <section className="lbs-ssh-panel" role="dialog" aria-label="SSH">
        <header className="lbs-ssh-toolbar">
          <strong>SSH</strong>
          <button className="lbs-ssh-button primary" onClick={() => { setEditingProfile(null); setEditorOpen(true); }}>＋ 新建连接</button>
          <button className="lbs-ssh-button" onClick={() => setCredentialsOpen(true)}>凭据管理</button>
          <button className="lbs-ssh-icon" title="刷新" onClick={safeRefresh}>↻</button>
          <div className="lbs-ssh-toolbar-spacer" />
          <button className="lbs-ssh-button" disabled={!activeSession} onClick={() => activeSession && setSessions((items) => items.map((item) => item.id === activeSession.id ? { ...item, generation: item.generation + 1, status: "connecting", message: "正在重新连接…", error: "" } : item))}>重新连接</button>
          <button className="lbs-ssh-icon" aria-label="关闭 SSH 页面" onClick={close}>×</button>
        </header>
        <div className="lbs-ssh-layout">
          <aside className="lbs-ssh-sidebar">
            <div className="lbs-ssh-search"><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索 SSH 服务器" placeholder="搜索连接、主机或分组" /></div>
            <div className="lbs-ssh-groups">
              {groups.map(([group, items]) => <section className="lbs-ssh-group" key={group}><h3>{group}<span>{items.length}</span></h3>{items.map((profile) => <div className="lbs-ssh-row" data-active={selected === profile.id} key={profile.id}>
                <button className="lbs-ssh-row-main" onClick={() => setSelected(profile.id)} onDoubleClick={() => connect(profile)}><strong>{profile.favorite ? "★ " : ""}{profile.name}</strong><small>{profile.username}@{profile.host}:{profile.port}</small></button>
                <button className="lbs-ssh-row-action" title="连接" aria-label={`连接 ${profile.name}`} onClick={() => connect(profile)}>▶</button>
                <button className="lbs-ssh-row-action" title="编辑" aria-label={`编辑 ${profile.name}`} onClick={() => { setEditingProfile(profile); setEditorOpen(true); }}>✎</button>
                <button className="lbs-ssh-row-action danger" title="删除" aria-label={`删除 ${profile.name}`} onClick={() => setDeleteTarget(profile)}>×</button>
              </div>)}</section>)}
              {!filtered.length ? <div className="lbs-ssh-empty-list"><span>{profiles.length ? "没有匹配的连接" : "尚未配置 SSH 连接"}</span><button className="lbs-ssh-button" onClick={() => { setEditingProfile(null); setEditorOpen(true); }}>添加连接</button></div> : null}
            </div>
          </aside>
          <main className="lbs-ssh-workspace">
            {sessions.length ? <div className="lbs-ssh-tabs" role="tablist" aria-label="SSH 终端会话">{sessions.map((session) => <div className="lbs-ssh-tab" data-active={activeId === session.id} key={session.id} role="tab" aria-selected={activeId === session.id}><button className="lbs-ssh-tab-main" onClick={() => setActiveId(session.id)}><span className="lbs-ssh-dot" data-state={session.status} /><span>{session.profile.name}</span></button><button className="lbs-ssh-tab-close" aria-label={`关闭 ${session.profile.name}`} onClick={() => closeSession(session.id)}>×</button></div>)}</div> : null}
            <div className="lbs-ssh-stage">
              {!sessions.length ? <div className="lbs-ssh-empty"><strong>选择服务器并建立连接</strong><p>连接配置、登录凭据和服务器指纹分别管理；密码和私钥会使用系统安全存储加密。</p>{selected ? <button className="lbs-ssh-button primary" onClick={() => connect(profiles.find((item) => item.id === selected))}>连接所选服务器</button> : <button className="lbs-ssh-button primary" onClick={() => setEditorOpen(true)}>新建连接</button>}</div> : null}
              {sessions.map((session) => <div className="lbs-ssh-surface" data-active={activeId === session.id} key={`${session.id}:${session.generation}`}><SshSurface session={session} active={activeId === session.id} onState={updateSession} onError={sessionError} onChallenge={setChallenge} /></div>)}
              {activeSession?.error ? <div className="lbs-ssh-error" role="alert">{activeSession.error}</div> : null}
            </div>
          </main>
        </div>
        <footer className="lbs-ssh-status"><span>{sessions.filter((item) => item.status === "connected").length} 个连接</span><span>{profiles.length} 台服务器 · {credentials.length} 份凭据</span><span>{activeSession?.message || "未连接"}</span></footer>
        {editorOpen ? <ProfileEditor key={editingProfile?.id || "new"} profile={editingProfile} credentials={credentials} encryptionAvailable={encryptionAvailable} onClose={() => { setEditorOpen(false); setEditingProfile(null); }} onSaved={saveFinished} onForgetHostKey={forgetHostKey} /> : null}
        {credentialsOpen ? <CredentialManager credentials={credentials} profiles={profiles} encryptionAvailable={encryptionAvailable} onClose={() => setCredentialsOpen(false)} onChanged={safeRefresh} /> : null}
        {deleteTarget ? <Modal title="删除 SSH 连接" onClose={() => setDeleteTarget(null)} footer={<><button className="lbs-ssh-button" onClick={() => setDeleteTarget(null)}>取消</button><button className="lbs-ssh-button primary" onClick={removeProfile}>删除连接</button></>}><p>确定删除“{deleteTarget.name}”？相关活动终端会先断开，保存的项目文件不会受到影响。</p></Modal> : null}
        <HostKeyDialog challenge={challenge} onClose={() => setChallenge(null)} />
        {error ? <div className="lbs-ssh-global-error" role="alert">{error}</div> : null}
      </section>;
    }
    const inject = ["slots"]; function apply(ctx) { ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-ssh", order: 42 }, SshPlugin)); }
    exports.apply = apply; exports.inject = inject; return module.exports;
  },
});
