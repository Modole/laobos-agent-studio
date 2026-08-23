/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { attachTerminalEnhancements } from "../../laobos-terminal-kit/index.mjs";
import xtermCss from "@xterm/xterm/css/xterm.css";

window.__ModuleLoader__.load({
  id: "@laobos/dsh-ssh",
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const css = `${xtermCss}\n
      .lbs-ssh-panel{background:var(--dsw-alias-bg-base);bottom:0;color:var(--dsw-alias-label-primary);display:grid;grid-template-rows:42px minmax(0,1fr) 24px;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}.lbs-ssh-toolbar{align-items:center;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:4px;padding:0 8px}.lbs-ssh-toolbar strong{font-size:13px;margin:0 4px}.lbs-ssh-toolbar-spacer{flex:1}.lbs-ssh-button,.lbs-ssh-icon{appearance:none;background:transparent;border:0;border-radius:6px;color:inherit;cursor:pointer;font:inherit;font-size:11px;height:29px;padding:0 9px}.lbs-ssh-icon{display:grid;padding:0;place-items:center;width:29px}.lbs-ssh-button:hover,.lbs-ssh-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-ssh-button.primary{background:var(--dsw-alias-interactive-bg-primary);color:var(--dsw-alias-label-on-primary)}.lbs-ssh-button:disabled,.lbs-ssh-icon:disabled{cursor:not-allowed;opacity:.42}.lbs-ssh-layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:0}.lbs-ssh-sidebar{background:var(--dsw-alias-bg-layer-1);border-right:1px solid var(--dsw-alias-border-l1);display:grid;grid-template-rows:42px minmax(0,1fr);min-height:0}.lbs-ssh-search{align-items:center;display:flex;padding:7px}.lbs-ssh-search input{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:11px inherit;height:28px;padding:0 8px;width:100%}.lbs-ssh-groups{min-height:0;overflow:auto;padding:0 5px 8px}.lbs-ssh-group h3{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;height:24px;margin:0;padding:0 5px}.lbs-ssh-group h3 span{margin-left:auto}.lbs-ssh-row{align-items:center;border-radius:6px;display:grid;grid-template-columns:minmax(0,1fr) 27px 27px 27px;margin-bottom:2px}.lbs-ssh-row[data-active=true],.lbs-ssh-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-ssh-row-main{background:transparent;border:0;color:inherit;cursor:pointer;display:grid;font:inherit;gap:2px;min-width:0;padding:7px 5px 7px 8px;text-align:left}.lbs-ssh-row-main strong,.lbs-ssh-row-main small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-row-main strong{font-size:11px}.lbs-ssh-row-main small{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-ssh-row-action{background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;height:25px;opacity:.45}.lbs-ssh-row:hover .lbs-ssh-row-action,.lbs-ssh-row-action:focus-visible{opacity:1}.lbs-ssh-row-action:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.lbs-ssh-row-action.danger:hover{color:var(--dsw-alias-state-error-primary,#d94b4b)}.lbs-ssh-empty-list{align-content:center;color:var(--dsw-alias-label-tertiary);display:grid;font-size:10px;gap:8px;justify-items:center;min-height:150px;padding:14px;text-align:center}.lbs-ssh-workspace{background:#101419;display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;min-width:0}.lbs-ssh-tabs{background:#181d23;border-bottom:1px solid #2b323b;display:flex;min-height:34px;overflow:auto hidden}.lbs-ssh-tab{align-items:center;border-right:1px solid #2b323b;border-top:2px solid transparent;color:#95a0ab;display:flex;max-width:200px;min-width:125px}.lbs-ssh-tab[data-active=true]{background:#101419;border-top-color:#55b58a;color:#e8edf2}.lbs-ssh-tab-main{align-items:center;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;flex:1;font:10px inherit;gap:6px;min-width:0;padding:0 8px}.lbs-ssh-tab-main span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-tab-close{background:transparent;border:0;color:inherit;height:25px;width:25px}.lbs-ssh-dot{background:#87929d;border-radius:50%;height:6px;width:6px}.lbs-ssh-dot[data-state=connected]{background:#39b87b}.lbs-ssh-dot[data-state=connecting],.lbs-ssh-dot[data-state=awaiting]{background:#e1a83d}.lbs-ssh-dot[data-state=error]{background:#e25d68}.lbs-ssh-stage{min-height:0;position:relative}.lbs-ssh-surface{inset:0;pointer-events:none;position:absolute;visibility:hidden}.lbs-ssh-surface[data-active=true]{pointer-events:auto;visibility:visible}.lbs-ssh-host{box-sizing:border-box;height:100%;padding:8px}.lbs-ssh-empty{align-content:center;color:#8f9aa6;display:grid;gap:9px;height:100%;justify-items:center;padding:28px;text-align:center}.lbs-ssh-empty strong{color:#e3e9ee;font-size:13px}.lbs-ssh-empty p{font-size:11px;line-height:1.5;margin:0;max-width:430px}.lbs-ssh-error{background:#482129;color:#ffc4ca;font-size:11px;left:10px;max-width:calc(100% - 20px);padding:7px 10px;position:absolute;top:9px;z-index:3}.lbs-ssh-global-error{background:#482129;border:1px solid #6d303a;border-radius:6px;color:#ffc4ca;font-size:10px;max-width:min(520px,calc(100% - 20px));padding:7px 10px;pointer-events:none;position:absolute;right:10px;top:48px;z-index:6}.lbs-ssh-status{align-items:center;background:var(--dsw-alias-bg-layer-1);border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);display:flex;font-size:9px;gap:12px;padding:0 8px}.lbs-ssh-status span:last-child{margin-left:auto}.lbs-ssh-modal-backdrop{align-items:center;background:rgba(0,0,0,.46);display:flex;inset:0;justify-content:center;padding:22px;position:fixed;z-index:2147483220}.lbs-ssh-modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);display:grid;grid-template-rows:46px minmax(0,1fr) auto;max-height:min(760px,92vh);overflow:hidden;width:min(610px,calc(100vw - 34px))}.lbs-ssh-modal.wide{width:min(820px,calc(100vw - 34px))}.lbs-ssh-modal-header{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;padding:0 14px}.lbs-ssh-modal-header h2{font-size:14px;margin:0}.lbs-ssh-modal-header button{margin-left:auto}.lbs-ssh-modal-body{min-height:0;overflow:auto;padding:15px}.lbs-ssh-modal-footer{border-top:1px solid var(--dsw-alias-border-l1);display:flex;gap:7px;justify-content:flex-end;padding:10px 14px}.lbs-ssh-form{display:grid;gap:12px}.lbs-ssh-form-grid{display:grid;gap:10px;grid-template-columns:1fr 110px}.lbs-ssh-form label{color:var(--dsw-alias-label-secondary);display:grid;font-size:10px;gap:5px}.lbs-ssh-form .wide{grid-column:1/-1}.lbs-ssh-form input,.lbs-ssh-form select,.lbs-ssh-form textarea{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;box-sizing:border-box;color:inherit;font:11px inherit;height:32px;padding:0 8px;width:100%}.lbs-ssh-form textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;height:112px;padding:8px;resize:vertical}.lbs-ssh-check{align-items:center!important;display:flex!important;gap:7px!important}.lbs-ssh-check input{height:14px!important;width:14px!important}.lbs-ssh-help{color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:1.5;margin:0}.lbs-ssh-form-error{color:var(--dsw-alias-state-error-primary,#d94b4b);font-size:10px;margin:0}.lbs-ssh-credentials{display:grid;gap:7px}.lbs-ssh-credential{align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:9px}.lbs-ssh-credential span{display:grid;gap:2px}.lbs-ssh-credential small{color:var(--dsw-alias-label-tertiary);font-size:9px}.lbs-ssh-fingerprint{background:var(--dsw-alias-bg-base);border-radius:6px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px;word-break:break-all}@media(max-width:850px){.lbs-ssh-panel{left:0;right:0}.lbs-ssh-layout{grid-template-columns:195px minmax(0,1fr)}}@media(max-width:620px){.lbs-ssh-layout{grid-template-columns:1fr}.lbs-ssh-sidebar{display:none}.lbs-ssh-toolbar strong{display:none}}
      .lbs-ssh-workspace,.lbs-ssh-stage{background:var(--dsw-alias-bg-base)}.lbs-ssh-tabs{background:var(--dsw-alias-bg-layer-1);border-bottom-color:var(--dsw-alias-border-l1)}.lbs-ssh-tab{border-right-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary)}.lbs-ssh-tab[data-active=true]{background:var(--dsw-alias-bg-base);border-top-color:var(--dsw-alias-state-success-primary,#39b87b);color:var(--dsw-alias-label-primary)}.lbs-ssh-empty{color:var(--dsw-alias-label-tertiary)}.lbs-ssh-empty strong{color:var(--dsw-alias-label-primary)}.lbs-ssh-error,.lbs-ssh-global-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b4b) 10%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d94b4b) 28%,transparent);color:var(--dsw-alias-state-error-primary,#d94b4b)}
      .lbs-ssh-workspace[data-sftp=true]{grid-template-columns:minmax(0,1fr) 360px}.lbs-ssh-workspace[data-sftp=true] .lbs-ssh-tabs{grid-column:1/-1}.lbs-ssh-sftp{background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l1);display:grid;grid-template-rows:38px 36px minmax(0,1fr);min-height:0;min-width:0}.lbs-ssh-sftp-head,.lbs-ssh-sftp-path{align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex;gap:5px;padding:4px 7px}.lbs-ssh-sftp-head strong{font-size:11px}.lbs-ssh-sftp-head span{color:var(--dsw-alias-label-tertiary);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-sftp-head button:first-of-type{margin-left:auto}.lbs-ssh-sftp-path input{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;color:inherit;flex:1;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;height:26px;padding:0 7px}.lbs-ssh-sftp-body{min-height:0;overflow:auto;padding:5px}.lbs-ssh-sftp-row{align-items:center;border-radius:5px;display:grid;font-size:10px;gap:6px;grid-template-columns:18px minmax(0,1fr) 64px 25px 25px 25px;padding:4px}.lbs-ssh-sftp-row:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-ssh-sftp-name{background:transparent;border:0;color:inherit;cursor:pointer;overflow:hidden;padding:3px;text-align:left;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-sftp-size{color:var(--dsw-alias-label-tertiary);font-size:9px;text-align:right}.lbs-ssh-sftp-editor{display:grid;gap:7px;height:100%;grid-template-rows:32px minmax(0,1fr);padding:7px}.lbs-ssh-sftp-editor header{align-items:center;display:flex;gap:5px;min-width:0}.lbs-ssh-sftp-editor header strong{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-ssh-sftp-editor header button:first-of-type{margin-left:auto}.lbs-ssh-sftp-editor textarea{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;color:inherit;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px;resize:none}.lbs-ssh-global-notice{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#39b87b) 10%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#39b87b) 28%,transparent);border-radius:6px;color:var(--dsw-alias-state-success-primary,#26895d);font-size:10px;max-width:min(520px,calc(100% - 20px));padding:7px 10px;position:absolute;right:10px;top:48px;z-index:6}@media(max-width:1000px){.lbs-ssh-workspace[data-sftp=true]{grid-template-columns:minmax(0,1fr) 300px}}
      .lbs-ssh-panel[data-open=false],.lbs-ssh-panel[data-open=false] .lbs-ssh-surface{pointer-events:none!important;visibility:hidden!important}
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
        authMode: profile?.authMode || "credential", credentialId: profile?.credentialId || "new",
        credentialName: "", type: "password", password: "", privateKey: "", passphrase: "",
        identityFile: profile?.identityFile || "", proxyJump: profile?.proxyJump || "",
      });
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const field = (name) => ({ value: form[name], onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });
      const save = async () => {
        setError("");
        const port = Number(form.port);
        if (!form.name.trim() || !form.host.trim() || !form.username.trim()) { setError("请填写连接名称、主机和用户名。"); return; }
        if (!Number.isInteger(port) || port < 1 || port > 65535) { setError("SSH 端口必须是 1-65535 的整数。"); return; }
        if (form.authMode === "credential" && form.credentialId === "new" && (form.type === "password" ? !form.password : !form.privateKey.trim())) { setError(form.type === "password" ? "请输入登录密码。" : "请输入私钥。"); return; }
        if (form.authMode === "identityFile" && !form.identityFile.trim()) { setError("请输入私钥文件路径。"); return; }
        setBusy(true);
        try {
          let credentialId = form.authMode === "credential" ? form.credentialId : "";
          if (form.authMode === "credential" && credentialId === "new") {
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
            authMode: form.authMode, credentialId, identityFile: form.identityFile.trim(), proxyJump: form.proxyJump.trim(),
            group: form.group.trim(), favorite: form.favorite, configAlias: profile?.configAlias || "", source: profile?.source || "manual",
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
            <label>认证来源<select {...field("authMode")}><option value="credential">应用安全凭据</option><option value="agent">系统 ssh-agent</option><option value="identityFile">私钥文件路径</option></select></label>
            {form.authMode === "credential" ? <>
              <label>凭据来源<select {...field("credentialId")}><option value="new">新建凭据</option>{credentials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              {form.credentialId === "new" ? <>
                <label>凭据名称<input {...field("credentialName")} placeholder="可选" /></label>
                <label>凭据类型<select {...field("type")}><option value="password">密码</option><option value="privateKey">私钥内容</option></select></label>
                {form.type === "password" ? <label className="wide">密码<input {...field("password")} type="password" autoComplete="new-password" /></label> : <>
                  <label className="wide">私钥<textarea {...field("privateKey")} spellCheck="false" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" /></label>
                  <label>私钥口令<input {...field("passphrase")} type="password" /></label>
                </>}
              </> : <p className="lbs-ssh-help">复用已加密保存的凭据。</p>}
            </> : null}
            {form.authMode === "agent" ? <p className="lbs-ssh-help wide">使用系统 SSH Agent，不会向应用或 Agent 工具暴露私钥。Windows 可使用 Pageant，macOS/Linux 使用 SSH_AUTH_SOCK。</p> : null}
            {form.authMode === "identityFile" ? <label className="wide">私钥文件路径<input {...field("identityFile")} placeholder="~/.ssh/id_ed25519" spellCheck="false" /></label> : null}
            <label className="wide">跳板机（可选）<input {...field("proxyJump")} placeholder="已保存连接名称、SSH Config 别名，或 user@host:22" spellCheck="false" /></label>
          </div>
          {profile?.fingerprint ? <div><p className="lbs-ssh-help">已信任的主机指纹</p><div className="lbs-ssh-fingerprint">{profile.fingerprint}</div><button className="lbs-ssh-button" onClick={() => onForgetHostKey(profile)}>忘记指纹</button></div> : null}
          <p className="lbs-ssh-help">支持系统 Agent、私钥文件和多级连接；应用安全凭据通过 Electron safeStorage 加密。首次连接仍需人工核对服务器指纹。</p>
          {error ? <p className="lbs-ssh-form-error" role="alert">{error}</p> : null}
        </div>
      </Modal>;
    }

    function CredentialManager({ credentials, profiles, encryptionAvailable, onClose, onChanged }) {
      const [form, setForm] = useState({ name: "", type: "password", password: "", privateKey: "", passphrase: "" });
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [confirmRemove, setConfirmRemove] = useState(null);
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
        setConfirmRemove(null);
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
              return <div className="lbs-ssh-credential" key={credential.id}><span><strong>{credential.name}</strong><small>{credential.type === "privateKey" ? "私钥" : "密码"} · {usage ? `${usage} 个连接正在使用` : "未使用"}</small></span><button className="lbs-ssh-button" disabled={busy || usage > 0} onClick={() => setConfirmRemove(credential)}>删除</button></div>;
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
        {confirmRemove ? <Modal title="删除 SSH 凭据" onClose={() => setConfirmRemove(null)} footer={<><button className="lbs-ssh-button" onClick={() => setConfirmRemove(null)}>取消</button><button className="lbs-ssh-button primary" onClick={() => void remove(confirmRemove)}>删除凭据</button></>}><p>确定删除凭据“{confirmRemove.name}”？使用该凭据的连接需要重新选择认证方式。</p></Modal> : null}
      </Modal>;
    }

    function HostKeyDialog({ challenge, onClose }) {
      if (!challenge) return null;
      return <Modal title="确认 SSH 主机身份" onClose={() => { challenge.reject(); onClose(); }} footer={<><button className="lbs-ssh-button" onClick={() => { challenge.reject(); onClose(); }}>取消连接</button><button className="lbs-ssh-button primary" onClick={() => { challenge.accept(); onClose(); }}>信任并连接</button></>}>
        <div className="lbs-ssh-form"><p>这是首次连接该服务器。请通过可信渠道核对指纹，确认无误后再继续。</p><div className="lbs-ssh-fingerprint">{challenge.fingerprint}</div><p className="lbs-ssh-help">{challenge.profile.username}@{challenge.profile.host}:{challenge.profile.port}</p></div>
      </Modal>;
    }

    function remoteJoin(directory, name) {
      const root = directory === "/" ? "" : String(directory || ".").replace(/\/+$/u, "");
      return `${root}/${String(name).replace(/^\/+/, "")}`;
    }

    function remoteParent(directory) {
      const value = String(directory || ".").replace(/\/+$/u, "") || "/";
      if (value === "/" || value === ".") return value;
      const index = value.lastIndexOf("/");
      if (index < 0) return ".";
      return index === 0 ? "/" : value.slice(0, index);
    }

    function formatSize(value) {
      const size = Number(value) || 0;
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }

    function SftpPanel({ session, onClose }) {
      const connectionId = session.connectionId;
      const [cwd, setCwd] = useState(".");
      const [pathInput, setPathInput] = useState(".");
      const [entries, setEntries] = useState([]);
      const [editor, setEditor] = useState(null);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [dialog, setDialog] = useState(null);
      const load = useCallback(async (target) => {
        setBusy(true); setError("");
        try {
          const value = await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "list", path: target });
          const sorted = (value.entries || []).filter((entry) => ![".", ".."].includes(entry.name)).sort((left, right) => {
            if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
            return left.name.localeCompare(right.name, "zh-CN");
          });
          setCwd(value.path); setPathInput(value.path); setEntries(sorted); setEditor(null);
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      }, [connectionId]);
      useEffect(() => { void load("."); }, [load]);
      const openEntry = async (entry) => {
        const target = remoteJoin(cwd, entry.name);
        if (entry.type === "directory") { await load(target); return; }
        setBusy(true); setError("");
        try {
          const value = await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "read", path: target });
          setEditor({ path: target, content: value.content, dirty: false });
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      const saveEditor = async () => {
        if (!editor) return;
        setBusy(true); setError("");
        try {
          await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "write", path: editor.path, content: editor.content });
          await load(cwd);
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
      };
      const createDirectory = () => setDialog({ type: "mkdir", value: "" });
      const renameEntry = (entry) => setDialog({ type: "rename", entry, value: entry.name });
      const removeEntry = (entry) => setDialog({ type: "delete", entry });
      const discardEditor = () => {
        if (!editor?.dirty) { setEditor(null); return; }
        setDialog({ type: "discard" });
      };
      const cancelDialog = () => setDialog(null);
      const submitDialog = async () => {
        if (!dialog) return;
        if (dialog.type === "discard") { setDialog(null); setEditor(null); return; }
        if (dialog.type === "delete") {
          const entry = dialog.entry;
          setDialog(null);
          setBusy(true); setError("");
          try {
            await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "remove", path: remoteJoin(cwd, entry.name), resourceType: entry.type === "directory" ? "directory" : "file" });
            await load(cwd);
          } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
          return;
        }
        const name = dialog.value.trim();
        if (!name || (dialog.type === "rename" && name === dialog.entry.name)) { setDialog(null); return; }
        setDialog(null);
        setBusy(true); setError("");
        try {
          if (dialog.type === "mkdir") await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "mkdir", path: remoteJoin(cwd, name) });
          else await window.laobosDesktop.ssh.sftp({ id: connectionId, action: "rename", path: remoteJoin(cwd, dialog.entry.name), destination: remoteJoin(cwd, name) });
          await load(cwd);
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
      };
      const upload = async () => {
        setBusy(true); setError("");
        try { const value = await window.laobosDesktop.ssh.upload({ id: connectionId, remoteDirectory: cwd }); if (!value.canceled) await load(cwd); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      const download = async (entry) => {
        setBusy(true); setError("");
        try { await window.laobosDesktop.ssh.download({ id: connectionId, remotePath: remoteJoin(cwd, entry.name) }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
      };
      return <aside className="lbs-ssh-sftp" aria-label="SFTP 文件管理">
        <header className="lbs-ssh-sftp-head"><strong>SFTP</strong><span>{session.profile.name}</span><button className="lbs-ssh-button" disabled={busy} onClick={upload}>上传</button><button className="lbs-ssh-button" disabled={busy} onClick={createDirectory}>新建目录</button><button className="lbs-ssh-icon" aria-label="关闭 SFTP" onClick={onClose}>×</button></header>
        <form className="lbs-ssh-sftp-path" onSubmit={(event) => { event.preventDefault(); void load(pathInput); }}><button className="lbs-ssh-icon" type="button" disabled={busy || ["/", "."].includes(cwd)} onClick={() => void load(remoteParent(cwd))}>↑</button><input aria-label="远程路径" value={pathInput} onChange={(event) => setPathInput(event.target.value)} /><button className="lbs-ssh-button" disabled={busy} type="submit">前往</button><button className="lbs-ssh-icon" type="button" disabled={busy} title="刷新" onClick={() => void load(cwd)}>↻</button></form>
        <div className="lbs-ssh-sftp-body">
          {editor ? <div className="lbs-ssh-sftp-editor"><header><strong>{editor.path}</strong><button className="lbs-ssh-button" disabled={busy} onClick={saveEditor}>保存</button><button className="lbs-ssh-button" onClick={discardEditor}>返回</button></header><textarea spellCheck="false" value={editor.content} onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value, dirty: true }))} /></div> : <>
            {entries.map((entry) => <div className="lbs-ssh-sftp-row" key={entry.name}><span>{entry.type === "directory" ? "▸" : "·"}</span><button className="lbs-ssh-sftp-name" title={entry.name} onDoubleClick={() => void openEntry(entry)} onClick={() => entry.type === "directory" && void openEntry(entry)}>{entry.name}</button><span className="lbs-ssh-sftp-size">{entry.type === "directory" ? "目录" : formatSize(entry.size)}</span><button className="lbs-ssh-icon" title="重命名" aria-label={`重命名 ${entry.name}`} disabled={busy} onClick={() => void renameEntry(entry)}>✎</button>{entry.type === "directory" ? <span /> : <button className="lbs-ssh-icon" title="下载" aria-label={`下载 ${entry.name}`} disabled={busy} onClick={() => void download(entry)}>↓</button>}<button className="lbs-ssh-icon" title="删除" aria-label={`删除 ${entry.name}`} disabled={busy} onClick={() => void removeEntry(entry)}>×</button></div>)}
            {!entries.length && !busy ? <div className="lbs-ssh-empty-list">远程目录为空</div> : null}
          </>}
          {busy ? <p className="lbs-ssh-help">正在处理远程文件…</p> : null}
          {error ? <p className="lbs-ssh-form-error" role="alert">{error}</p> : null}
        </div>
        {dialog ? <Modal title={dialog.type === "mkdir" ? "新建远程目录" : dialog.type === "rename" ? `重命名 ${dialog.entry.name}` : dialog.type === "delete" ? `删除远程${dialog.entry.type === "directory" ? "目录" : "文件"}` : "放弃未保存的修改"} onClose={cancelDialog} footer={<><button className="lbs-ssh-button" onClick={cancelDialog}>取消</button><button className="lbs-ssh-button primary" onClick={() => void submitDialog()}>{dialog.type === "delete" || dialog.type === "discard" ? "确认" : "确定"}</button></>}>
          <div className="lbs-ssh-form">
            {dialog.type === "delete" ? <p>确定删除远程{dialog.entry.type === "directory" ? "目录" : "文件"}“{dialog.entry.name}”？{dialog.entry.type === "directory" ? "目录必须为空。" : ""}</p> : null}
            {dialog.type === "discard" ? <p>当前文件有未保存的修改，返回后将丢弃这些修改。</p> : null}
            {dialog.type === "mkdir" || dialog.type === "rename" ? <label>{dialog.type === "mkdir" ? "目录名称" : "新名称"}<input autoFocus value={dialog.value} onChange={(event) => setDialog((current) => ({ ...current, value: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitDialog(); } }} /></label> : null}
          </div>
        </Modal> : null}
      </aside>;
    }

    function SshSurface({ session, active, onState, onError, onChallenge, onConnection }) {
      const host = useRef(null);
      const terminalRef = useRef(null);
      const activeRef = useRef(active);
      useEffect(() => {
        activeRef.current = active;
        if (active) terminalRef.current?.focus();
        else terminalRef.current?.blur();
      }, [active]);
      useEffect(() => {
        if (!host.current || !window.laobosDesktop?.capabilities?.ssh) { onError(session.id, "SSH 仅在桌面版中可用。"); return undefined; }
        let connectionId = ""; let disposed = false;
        const terminal = new Terminal({ cursorBlink: true, fontSize: 13, lineHeight: 1.2, scrollback: 10000, theme: terminalTheme(host.current) });
        terminalRef.current = terminal;
        const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(host.current);
        const stopThemeSync = syncTerminalTheme(terminal, host.current);
        const detachEnhancements = attachTerminalEnhancements(terminal, host.current, { isActive: () => activeRef.current });
        const fitTerminal = () => { try { fit.fit(); if (connectionId) void window.laobosDesktop.ssh.resize({ id: connectionId, cols: terminal.cols, rows: terminal.rows }); } catch {} };
        fitTerminal();
        const offData = window.laobosDesktop.ssh.onData((event) => { if (event.id === connectionId) terminal.write(event.data); });
        const offExit = window.laobosDesktop.ssh.onExit((event) => { if (event.id === connectionId) { connectionId = ""; onConnection(session.id, ""); terminal.write("\r\n[SSH 连接已关闭]\r\n"); onState(session.id, "disconnected", "已断开"); } });
        const input = terminal.onData((data) => { if (connectionId) void window.laobosDesktop.ssh.write({ id: connectionId, data }); });
        const resize = new ResizeObserver(fitTerminal); resize.observe(host.current);
        const connect = async (acceptUnknownHostKey = false) => {
          try {
            onState(session.id, "connecting", "正在连接…");
            const value = await window.laobosDesktop.ssh.connect({ profileId: session.profile.id, cols: terminal.cols, rows: terminal.rows, acceptUnknownHostKey });
            if (disposed) { void window.laobosDesktop.ssh.disconnect(value.id); return; }
            connectionId = value.id; onConnection(session.id, value.id); onState(session.id, "connected", `${value.profile.username}@${value.profile.host}`); if (activeRef.current) terminal.focus();
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
        return () => { disposed = true; terminalRef.current = null; onConnection(session.id, ""); detachEnhancements(); stopThemeSync(); resize.disconnect(); input.dispose(); offData(); offExit(); terminal.dispose(); if (connectionId) void window.laobosDesktop.ssh.disconnect(connectionId); };
      }, [onChallenge, onConnection, onError, onState, session.generation, session.id, session.profile]);
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
      const [notice, setNotice] = useState("");
      const [sftpOpen, setSftpOpen] = useState(false);
      const [forgetTarget, setForgetTarget] = useState(null);
      const [closeTarget, setCloseTarget] = useState(null);
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
      const updateConnection = useCallback((id, connectionId) => setSessions((items) => items.map((item) => item.id === id ? { ...item, connectionId } : item)), []);
      const sessionError = useCallback((id, message) => updateSession(id, "error", message), [updateSession]);
      const connect = (profile) => {
        const session = { id: `ssh-session-${Date.now().toString(36)}-${++sessionSequence}`, profile, generation: 0, connectionId: "", status: "connecting", message: "正在连接…", error: "" };
        setSessions((items) => [...items, session]); setActiveId(session.id); setSelected(profile.id);
      };
      const closeSession = (id) => {
        const index = sessions.findIndex((item) => item.id === id); const remaining = sessions.filter((item) => item.id !== id);
        setSessions(remaining); if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id || "");
      };

      useEffect(() => {
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-ready", { detail: { tool: "ssh" } }));
        const show = (event) => {
          if (event.detail?.tool === "close") { setOpen(false); return; }
          if (event.detail?.tool !== "ssh") return;
          setOpen(true); void safeRefresh();
        };
        window.addEventListener("laobos:open-desktop-tool", show);
        return () => window.removeEventListener("laobos:open-desktop-tool", show);
      }, [safeRefresh]);
      useEffect(() => { if (open) window.dispatchEvent(new CustomEvent("laobos:desktop-tool-opened", { detail: { tool: "ssh" } })); }, [open]);
      useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(timer); }, [notice]);
      const close = () => { setOpen(false); window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "ssh" } })); };
      const saveFinished = async () => { await safeRefresh(); setEditorOpen(false); setEditingProfile(null); };
      const removeProfile = async () => {
        const profile = deleteTarget; if (!profile) return;
        try {
          setSessions((items) => items.filter((item) => item.profile.id !== profile.id));
          await window.laobosDesktop.ssh.deleteProfile(profile.id); setDeleteTarget(null); await safeRefresh();
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      };
      const forgetHostKey = async (profile) => {
        try { await window.laobosDesktop.ssh.forgetHostKey(profile.id); await safeRefresh(); setEditorOpen(false); setForgetTarget(null); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setForgetTarget(null); }
      };
      const importConfig = async () => {
        try {
          setError("");
          const value = await window.laobosDesktop.ssh.importConfig();
          await refresh();
          setNotice(value.imported ? `已从 ${value.configPath} 导入或更新 ${value.imported} 个连接${value.skipped ? `，跳过 ${value.skipped} 个不完整配置` : ""}。` : `${value.configPath} 中没有可导入的完整主机配置。`);
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      };
      return <section className="lbs-ssh-panel" data-open={open} role="dialog" aria-label="SSH" aria-hidden={!open}>
        <header className="lbs-ssh-toolbar">
          <strong>SSH</strong>
          <button className="lbs-ssh-button primary" onClick={() => { setEditingProfile(null); setEditorOpen(true); }}>＋ 新建连接</button>
          <button className="lbs-ssh-button" onClick={importConfig}>导入 SSH Config</button>
          <button className="lbs-ssh-button" onClick={() => setCredentialsOpen(true)}>凭据管理</button>
          <button className="lbs-ssh-icon" title="刷新" onClick={safeRefresh}>↻</button>
          <div className="lbs-ssh-toolbar-spacer" />
          <button className="lbs-ssh-button" disabled={!activeSession?.connectionId || activeSession.status !== "connected"} onClick={() => setSftpOpen((current) => !current)}>{sftpOpen ? "关闭 SFTP" : "SFTP 文件"}</button>
          <button className="lbs-ssh-button" disabled={!activeSession} onClick={() => activeSession && setSessions((items) => items.map((item) => item.id === activeSession.id ? { ...item, generation: item.generation + 1, connectionId: "", status: "connecting", message: "正在重新连接…", error: "" } : item))}>重新连接</button>
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
          <main className="lbs-ssh-workspace" data-sftp={sftpOpen && Boolean(activeSession?.connectionId)}>
            {sessions.length ? <div className="lbs-ssh-tabs" role="tablist" aria-label="SSH 终端会话">{sessions.map((session) => <div className="lbs-ssh-tab" data-active={activeId === session.id} key={session.id} role="tab" aria-selected={activeId === session.id}><button className="lbs-ssh-tab-main" onClick={() => setActiveId(session.id)}><span className="lbs-ssh-dot" data-state={session.status} /><span>{session.profile.name}</span></button><button className="lbs-ssh-tab-close" aria-label={`关闭 ${session.profile.name}`} onClick={() => (session.connectionId ? setCloseTarget(session) : closeSession(session.id))}>×</button></div>)}</div> : null}
            <div className="lbs-ssh-stage">
              {!sessions.length ? <div className="lbs-ssh-empty"><strong>选择服务器并建立连接</strong><p>连接配置、登录凭据和服务器指纹分别管理；密码和私钥会使用系统安全存储加密。</p>{selected ? <button className="lbs-ssh-button primary" onClick={() => connect(profiles.find((item) => item.id === selected))}>连接所选服务器</button> : <button className="lbs-ssh-button primary" onClick={() => setEditorOpen(true)}>新建连接</button>}</div> : null}
              {sessions.map((session) => <div className="lbs-ssh-surface" data-active={open && activeId === session.id} key={`${session.id}:${session.generation}`}><SshSurface session={session} active={open && activeId === session.id} onState={updateSession} onError={sessionError} onChallenge={setChallenge} onConnection={updateConnection} /></div>)}
              {activeSession?.error ? <div className="lbs-ssh-error" role="alert">{activeSession.error}</div> : null}
            </div>
            {sftpOpen && activeSession?.connectionId ? <SftpPanel key={activeSession.connectionId} session={activeSession} onClose={() => setSftpOpen(false)} /> : null}
          </main>
        </div>
        <footer className="lbs-ssh-status"><span>{sessions.filter((item) => item.status === "connected").length} 个连接</span><span>{profiles.length} 台服务器 · {credentials.length} 份凭据</span><span>{activeSession?.message || "未连接"}</span></footer>
        {editorOpen ? <ProfileEditor key={editingProfile?.id || "new"} profile={editingProfile} credentials={credentials} encryptionAvailable={encryptionAvailable} onClose={() => { setEditorOpen(false); setEditingProfile(null); }} onSaved={saveFinished} onForgetHostKey={setForgetTarget} /> : null}
        {credentialsOpen ? <CredentialManager credentials={credentials} profiles={profiles} encryptionAvailable={encryptionAvailable} onClose={() => setCredentialsOpen(false)} onChanged={safeRefresh} /> : null}
        {deleteTarget ? <Modal title="删除 SSH 连接" onClose={() => setDeleteTarget(null)} footer={<><button className="lbs-ssh-button" onClick={() => setDeleteTarget(null)}>取消</button><button className="lbs-ssh-button primary" onClick={removeProfile}>删除连接</button></>}><p>确定删除“{deleteTarget.name}”？相关活动终端会先断开，保存的项目文件不会受到影响。</p></Modal> : null}
        {forgetTarget ? <Modal title="忘记主机指纹" onClose={() => setForgetTarget(null)} footer={<><button className="lbs-ssh-button" onClick={() => setForgetTarget(null)}>取消</button><button className="lbs-ssh-button primary" onClick={() => void forgetHostKey(forgetTarget)}>忘记指纹</button></>}><p>确定忘记“{forgetTarget.name}”已信任的主机指纹？下次连接必须重新确认。</p></Modal> : null}
        {closeTarget ? <Modal title="关闭 SSH 会话" onClose={() => setCloseTarget(null)} footer={<><button className="lbs-ssh-button" onClick={() => setCloseTarget(null)}>取消</button><button className="lbs-ssh-button primary" onClick={() => { closeSession(closeTarget.id); setCloseTarget(null); }}>断开连接</button></>}><p>确定断开与“{closeTarget.profile.name}”的连接？</p></Modal> : null}
        <HostKeyDialog challenge={challenge} onClose={() => setChallenge(null)} />
        {notice ? <div className="lbs-ssh-global-notice" role="status">{notice}</div> : null}
        {error ? <div className="lbs-ssh-global-error" role="alert">{error}</div> : null}
      </section>;
    }
    const inject = ["slots"]; function apply(ctx) { ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-ssh", order: 42 }, SshPlugin)); }
    exports.apply = apply; exports.inject = inject; return module.exports;
  },
});
