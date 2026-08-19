/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-updater",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useState } = React;

    const css = `
      .lbs-update{display:flex;flex-direction:column;gap:12px}
      .lbs-update-head{align-items:flex-start;display:flex;gap:14px;justify-content:space-between}
      .lbs-update-title{font-size:13px;font-weight:600;line-height:20px}.lbs-update-sub{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}
      .lbs-update-version{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);font:11px/26px ui-monospace,SFMono-Regular,Menlo,monospace;padding:0 10px;white-space:nowrap}
      .lbs-update-card{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:10px;display:flex;flex-direction:column;gap:9px;padding:12px}
      .lbs-update-status{align-items:center;display:flex;gap:8px}.lbs-update-dot{background:var(--dsw-alias-label-quaternary);border-radius:50%;height:8px;width:8px}.lbs-update-dot[data-active=true]{background:#2a9b67}.lbs-update-dot[data-error=true]{background:#d94b4b}
      .lbs-update-status strong{font-size:12px;font-weight:600}.lbs-update-notes{color:var(--dsw-alias-label-secondary);font:11px/18px inherit;margin:0;max-height:160px;overflow:auto;white-space:pre-wrap}
      .lbs-update-progress{background:var(--dsw-alias-bg-layer-1);border-radius:999px;height:6px;overflow:hidden}.lbs-update-progress>span{background:var(--dsw-alias-brand-primary);display:block;height:100%;transition:width .18s ease}
      .lbs-update-actions{display:flex;flex-wrap:wrap;gap:8px}.lbs-update-button{appearance:none;background:transparent;border:1px solid var(--dsw-alias-line-border);border-radius:8px;color:inherit;cursor:pointer;font:11px inherit;height:31px;padding:0 11px}.lbs-update-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.lbs-update-button.primary{background:var(--dsw-alias-interactive-bg-primary);border-color:transparent;color:var(--dsw-alias-label-on-primary)}.lbs-update-button:disabled{cursor:not-allowed;opacity:.45}
      .lbs-update-option{align-items:center;display:flex;font-size:11px;gap:8px}.lbs-update-option input{accent-color:var(--dsw-alias-brand-primary)}.lbs-update-error{color:#d94b4b;font-size:11px;line-height:18px}
    `;

    const labels = {
      disabled: "开发环境不启用自动更新",
      idle: "尚未检查更新",
      restoring: "正在恢复本地更新缓存…",
      checking: "正在检查更新…",
      available: "发现新版本",
      downloading: "正在下载更新…",
      downloaded: "更新已下载，可以安装",
      installing: "正在退出并安装更新…",
      "up-to-date": "当前已经是最新版本",
      error: "更新失败",
    };

    function formatBytes(value) {
      if (!Number.isFinite(value) || value <= 0) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
      return `${(value / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
    }

    function UpdateSettingsSection() {
      const api = window.laobosDesktop?.updates;
      const available = window.laobosDesktop?.capabilities?.softwareUpdate === true && Boolean(api);
      const [state, setState] = useState(null);
      const [preferences, setPreferences] = useState({ autoCheckUpdates: true });
      const [busy, setBusy] = useState(false);
      const [localError, setLocalError] = useState("");

      useEffect(() => {
        if (!available) return undefined;
        let active = true;
        Promise.all([api.status(), api.preferences()])
          .then(([nextState, nextPreferences]) => {
            if (!active) return;
            setState(nextState);
            setPreferences(nextPreferences);
          })
          .catch((error) => active && setLocalError(error instanceof Error ? error.message : String(error)));
        const remove = api.onState((next) => active && setState(next));
        return () => {
          active = false;
          remove?.();
        };
      }, [api, available]);

      const run = useCallback(async (action) => {
        if (!available || busy) return;
        setBusy(true);
        setLocalError("");
        try {
          const next = await action();
          if (next?.schema === 1) setState(next);
        } catch (error) {
          setLocalError(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      }, [available, busy]);

      async function toggleAutoCheck(event) {
        const autoCheckUpdates = event.target.checked;
        setPreferences((current) => ({ ...current, autoCheckUpdates }));
        try {
          const next = await api.setPreferences({ autoCheckUpdates });
          setPreferences(next);
        } catch (error) {
          setPreferences((current) => ({ ...current, autoCheckUpdates: !autoCheckUpdates }));
          setLocalError(error instanceof Error ? error.message : String(error));
        }
      }

      const phase = state?.phase || (available ? "idle" : "disabled");
      const progress = state?.progress;
      const percent = Math.max(0, Math.min(100, progress?.percent || 0));
      const error = localError || state?.error?.message || "";
      const active = ["restoring", "available", "downloading", "downloaded", "installing", "up-to-date"].includes(phase);

      return (
        <section className="lbs-update">
          <style>{css}</style>
          <div className="lbs-update-head">
            <div>
              <div className="lbs-update-title">软件更新</div>
              <div className="lbs-update-sub">从劳博士官方 GitHub Release 获取经过签名的软件版本。</div>
            </div>
            <span className="lbs-update-version">v{state?.currentVersion || "—"}</span>
          </div>
          <div className="lbs-update-card">
            <div className="lbs-update-status">
              <span className="lbs-update-dot" data-active={active} data-error={phase === "error"} />
              <strong>{labels[phase] || "更新状态未知"}</strong>
            </div>
            {state?.availableVersion ? <div className="lbs-update-sub">可用版本：v{state.availableVersion}{state.releaseDate ? ` · ${state.releaseDate.slice(0, 10)}` : ""}</div> : null}
            {state?.cached ? <div className="lbs-update-sub">安装包已安全缓存到本地，重启应用后无需重新下载。</div> : null}
            {state?.releaseNotes ? <pre className="lbs-update-notes">{state.releaseNotes}</pre> : null}
            {phase === "downloading" ? (
              <>
                <div className="lbs-update-progress"><span style={{ width: `${percent}%` }} /></div>
                <div className="lbs-update-sub">{percent.toFixed(1)}% · {formatBytes(progress?.transferred)} / {formatBytes(progress?.total)} · {formatBytes(progress?.bytesPerSecond)}/s</div>
              </>
            ) : null}
            {error ? <div className="lbs-update-error">{error}</div> : null}
            <div className="lbs-update-actions">
              <button className="lbs-update-button" disabled={!available || busy || ["restoring", "checking", "downloading", "downloaded", "installing"].includes(phase)} onClick={() => void run(() => api.check())}>检查更新</button>
              {phase === "available" ? <button className="lbs-update-button primary" disabled={busy} onClick={() => void run(() => api.download())}>下载更新</button> : null}
              {phase === "downloaded" ? <button className="lbs-update-button primary" disabled={busy} onClick={() => void run(() => api.install())}>重启并安装</button> : null}
            </div>
          </div>
          <label className="lbs-update-option">
            <input type="checkbox" checked={preferences.autoCheckUpdates !== false} disabled={!available} onChange={(event) => void toggleAutoCheck(event)} />
            启动后自动检查更新（每天最多一次，不自动下载）
          </label>
        </section>
      );
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "laobos-software-update",
        order: 35,
        label: () => "软件更新",
      }, UpdateSettingsSection));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
