/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import xtermCss from "@xterm/xterm/css/xterm.css";

window.__ModuleLoader__.load({
  id: "@laobos/dsh-terminal-ui",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const css = `${xtermCss}\n
      .lbs-terminal-panel{background:#101419;bottom:0;color:#e8edf2;display:grid;grid-template-rows:44px minmax(0,1fr) 24px;left:var(--lbs-left-column,280px);pointer-events:auto;position:fixed;right:var(--lbs-right-column,56px);top:0;z-index:2147483060}
      .lbs-terminal-toolbar{align-items:center;background:#181d23;border-bottom:1px solid #2b323b;display:flex;gap:6px;min-width:0;padding:0 9px}.lbs-terminal-toolbar strong{font-size:13px;margin-right:2px}.lbs-terminal-toolbar .lbs-terminal-tabs{display:flex!important;flex:1;gap:3px;min-width:0;overflow:auto hidden}.lbs-terminal-tab{align-items:center;background:transparent;border:1px solid transparent;border-radius:6px;color:#9aa7b5;display:flex;height:30px;max-width:190px;min-width:112px;padding:0 4px 0 8px}.lbs-terminal-tab[data-active=true]{background:#242b33;border-color:#35404b;color:#edf3f8}.lbs-terminal-tab-main{align-items:center;background:transparent;border:0;color:inherit;cursor:pointer;display:flex;flex:1;font:inherit;font-size:11px;gap:6px;min-width:0;padding:0}.lbs-terminal-tab-main span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbs-terminal-dot{background:#8b96a1;border-radius:50%;flex:none;height:6px;width:6px}.lbs-terminal-dot[data-state=connected]{background:#39b87b}.lbs-terminal-dot[data-state=creating]{background:#e1a83d}.lbs-terminal-dot[data-state=error]{background:#e25d68}.lbs-terminal-tab-close,.lbs-terminal-icon{appearance:none;background:transparent;border:0;border-radius:5px;color:inherit;cursor:pointer;display:grid;flex:none;height:26px;place-items:center;width:26px}.lbs-terminal-tab-close:hover,.lbs-terminal-icon:hover{background:#303944}.lbs-terminal-select{background:#252c34;border:1px solid #35404b;border-radius:6px;color:#d5dde5;font:11px inherit;height:29px;padding:0 7px}.lbs-terminal-new{appearance:none;background:#e8edf2;border:0;border-radius:6px;color:#14191f;cursor:pointer;font:600 11px inherit;height:29px;padding:0 10px}.lbs-terminal-stage{min-height:0;position:relative}.lbs-terminal-surface{inset:0;pointer-events:none;position:absolute;visibility:hidden}.lbs-terminal-surface[data-active=true]{pointer-events:auto;visibility:visible}.lbs-terminal-host{box-sizing:border-box;height:100%;padding:8px}.lbs-terminal-host .xterm{height:100%}.lbs-terminal-empty{align-content:center;color:#8f9aa6;display:grid;gap:9px;height:100%;justify-items:center;padding:28px;text-align:center}.lbs-terminal-empty strong{color:#dfe6ec;font-size:13px}.lbs-terminal-empty p{font-size:11px;line-height:1.5;margin:0;max-width:460px}.lbs-terminal-empty button{background:#e8edf2;border:0;border-radius:6px;color:#14191f;height:31px;padding:0 11px}.lbs-terminal-message{background:#482129;color:#ffc4ca;font-size:11px;left:10px;max-width:calc(100% - 20px);padding:7px 10px;position:absolute;top:8px;z-index:3}.lbs-terminal-status{align-items:center;background:#181d23;border-top:1px solid #2b323b;color:#8995a1;display:flex;font-size:9px;gap:12px;padding:0 9px}.lbs-terminal-status span:last-child{margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:850px){.lbs-terminal-panel{left:0;right:0}.lbs-terminal-toolbar strong{display:none}.lbs-terminal-tab{min-width:96px}.lbs-terminal-select{max-width:94px}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-terminal-ui"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-terminal-ui";
      style.textContent = css;
      document.head.append(style);
    }

    let tabSequence = 0;
    const nextTmuxSlot = (tabs) => {
      const used = new Set(tabs.filter((tab) => tab.tmux).map((tab) => tab.sessionKey));
      let slot = 1;
      while (used.has(`tmux-${slot}`)) slot += 1;
      return slot;
    };
    const newTab = (tmux, tabs = []) => {
      const sequence = ++tabSequence;
      const id = `terminal-${Date.now().toString(36)}-${sequence}`;
      const tmuxSlot = tmux ? nextTmuxSlot(tabs) : 0;
      return {
        id,
        sessionKey: tmux ? `tmux-${tmuxSlot}` : id,
        title: tmux ? `tmux ${tmuxSlot}` : `终端 ${sequence}`,
        tmux,
        generation: 0,
        state: "creating",
        warning: "",
        error: "",
        cwd: "",
      };
    };

    function TerminalSurface({ tab, cwd, active, onReady, onError, onExit }) {
      const host = useRef(null);
      const terminalRef = useRef(null);
      const activeRef = useRef(active);
      useEffect(() => {
        activeRef.current = active;
        if (active) terminalRef.current?.focus();
      }, [active]);
      useEffect(() => {
        if (!window.laobosDesktop?.capabilities?.terminal || !host.current) {
          onError(tab.id, "终端仅在桌面版中可用。");
          return undefined;
        }
        let disposed = false;
        let sessionId = "";
        const terminal = new Terminal({
          cursorBlink: true,
          convertEol: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          lineHeight: 1.2,
          scrollback: 10000,
          theme: { background: "#101419", foreground: "#e8edf2", cursor: "#d8e6f3", selectionBackground: "#38506a" },
        });
        terminalRef.current = terminal;
        const fit = new FitAddon();
        terminal.loadAddon(fit);
        terminal.open(host.current);
        const fitTerminal = () => {
          try {
            fit.fit();
            if (sessionId) void window.laobosDesktop.terminal.resize({ id: sessionId, cols: terminal.cols, rows: terminal.rows });
          } catch {}
        };
        fitTerminal();
        const offData = window.laobosDesktop.terminal.onData((event) => { if (event?.id === sessionId) terminal.write(event.data); });
        const offExit = window.laobosDesktop.terminal.onExit((event) => {
          if (event?.id !== sessionId) return;
          terminal.write(`\r\n[进程已退出：${event.exitCode}]\r\n`);
          onExit(tab.id, event);
        });
        const input = terminal.onData((data) => { if (sessionId) void window.laobosDesktop.terminal.write({ id: sessionId, data }); });
        const resize = new ResizeObserver(fitTerminal);
        resize.observe(host.current);
        window.laobosDesktop.terminal.create({
          cwd,
          tmux: tab.tmux,
          tmuxKey: tab.tmux ? tab.sessionKey : undefined,
          cols: terminal.cols,
          rows: terminal.rows,
        }).then((created) => {
          if (disposed) { void window.laobosDesktop.terminal.close({ id: created.id }); return; }
          sessionId = created.id;
          onReady(tab.id, created);
          if (created.warning) terminal.writeln(`\r\n[${created.warning}]\r\n`);
          if (activeRef.current) terminal.focus();
        }).catch((reason) => {
          if (!disposed) onError(tab.id, reason instanceof Error ? reason.message : String(reason));
        });
        return () => {
          disposed = true; terminalRef.current = null;
          resize.disconnect(); input.dispose(); offData(); offExit(); terminal.dispose();
          if (sessionId) void window.laobosDesktop.terminal.close({ id: sessionId });
        };
      }, [cwd, onError, onExit, onReady, tab.generation, tab.id, tab.sessionKey, tab.tmux]);
      return <div className="lbs-terminal-host" ref={host} />;
    }

    function TerminalPlugin() {
      const [open, setOpen] = useState(false);
      const [cwd, setCwd] = useState("");
      const [tabs, setTabs] = useState([]);
      const [activeId, setActiveId] = useState("");
      const [newBackend, setNewBackend] = useState("tmux");
      const cwdRef = useRef("");
      const openRequest = useRef(0);
      const tabsRef = useRef([]);
      const active = useMemo(() => tabs.find((tab) => tab.id === activeId) || null, [tabs, activeId]);
      const updateTabs = useCallback((updater) => {
        const next = updater(tabsRef.current);
        tabsRef.current = next;
        setTabs(next);
        return next;
      }, []);

      const addTab = useCallback((backend = newBackend) => {
        const tmux = backend === "tmux";
        const tab = newTab(tmux, tabsRef.current);
        updateTabs((items) => [...items, tab]);
        setActiveId(tab.id);
      }, [newBackend, updateTabs]);
      const updateTab = useCallback((id, update) => updateTabs((items) => items.map((tab) => tab.id === id ? { ...tab, ...update } : tab)), [updateTabs]);
      const handleReady = useCallback((id, created) => updateTab(id, {
        state: "connected",
        cwd: created.cwd,
        warning: created.warning || "",
      }), [updateTab]);
      const handleError = useCallback((id, error) => updateTab(id, { state: "error", error }), [updateTab]);
      const handleExit = useCallback((id) => updateTab(id, { state: "exited" }), [updateTab]);

      useEffect(() => {
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-ready", { detail: { tool: "terminal" } }));
        const openWorkspace = async (requestedCwd) => {
          const request = ++openRequest.current;
          let nextCwd = requestedCwd || "";
          if (!nextCwd && window.laobosDesktop?.workspace?.context) {
            try {
              const context = await window.laobosDesktop.workspace.context();
              nextCwd = context?.root || "";
            } catch {}
          }
          if (request !== openRequest.current) return;
          const workspaceChanged = Boolean(cwdRef.current && nextCwd && cwdRef.current !== nextCwd);
          cwdRef.current = nextCwd;
          setCwd(nextCwd);
          setOpen(true);
          if (!tabsRef.current.length || workspaceChanged) {
            const tab = newTab(true, []);
            setActiveId(tab.id);
            updateTabs(() => [tab]);
          }
        };
        const show = (event) => {
          if (event.detail?.tool === "close") { openRequest.current += 1; setOpen(false); return; }
          if (event.detail?.tool !== "terminal") return;
          void openWorkspace(event.detail.cwd);
        };
        window.addEventListener("laobos:open-desktop-tool", show);
        return () => window.removeEventListener("laobos:open-desktop-tool", show);
      }, [updateTabs]);
      useEffect(() => {
        if (open) window.dispatchEvent(new CustomEvent("laobos:desktop-tool-opened", { detail: { tool: "terminal" } }));
      }, [open]);

      if (!open) return null;
      const closeTab = (id) => {
        const index = tabsRef.current.findIndex((tab) => tab.id === id);
        const remaining = updateTabs((items) => items.filter((tab) => tab.id !== id));
        if (activeId === id) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id || "");
      };
      const close = () => {
        openRequest.current += 1;
        setOpen(false);
        window.dispatchEvent(new CustomEvent("laobos:desktop-tool-closed", { detail: { tool: "terminal" } }));
      };
      return <section className="lbs-terminal-panel" role="dialog" aria-label="终端">
        <header className="lbs-terminal-toolbar">
          <strong>终端</strong>
          <div className="lbs-terminal-tabs" role="tablist" aria-label="终端会话">
            {tabs.map((tab) => <div className="lbs-terminal-tab" data-active={activeId === tab.id} key={tab.id} role="tab" aria-selected={activeId === tab.id}>
              <button className="lbs-terminal-tab-main" onClick={() => setActiveId(tab.id)}><span className="lbs-terminal-dot" data-state={tab.state} /><span>{tab.title}</span></button>
              <button className="lbs-terminal-tab-close" aria-label={`关闭 ${tab.title}`} onClick={() => closeTab(tab.id)}>×</button>
            </div>)}
          </div>
          <select className="lbs-terminal-select" aria-label="新终端后端" value={newBackend} onChange={(event) => setNewBackend(event.target.value)}><option value="tmux">tmux 持久</option><option value="local">本地 Shell</option></select>
          <button className="lbs-terminal-new" onClick={() => addTab()}>新建</button>
          <button className="lbs-terminal-icon" title="重新连接" aria-label="重新连接当前终端" disabled={!active} onClick={() => active && updateTab(active.id, { generation: active.generation + 1, state: "creating", error: "", warning: "" })}>↻</button>
          <button className="lbs-terminal-icon" aria-label="关闭终端页面" onClick={close}>×</button>
        </header>
        <main className="lbs-terminal-stage">
          {!tabs.length ? <div className="lbs-terminal-empty"><strong>打开当前工作区终端</strong><p>可使用本地 Shell，或通过 tmux 保留工作区会话。终端目录始终限制在当前工作区。</p><button onClick={() => addTab()}>新建终端</button></div> : null}
          {tabs.map((tab) => <div className="lbs-terminal-surface" data-active={activeId === tab.id} key={`${tab.id}:${tab.generation}`}><TerminalSurface tab={tab} cwd={cwd} active={activeId === tab.id} onReady={handleReady} onError={handleError} onExit={handleExit} /></div>)}
          {active?.error ? <div className="lbs-terminal-message" role="alert">{active.error}</div> : null}
        </main>
        <footer className="lbs-terminal-status"><span>{tabs.filter((tab) => tab.state === "connected").length} 个活动会话</span><span>{active?.warning || (active?.tmux ? "tmux 会话会在关闭页面后保留" : "本地 Shell 会在关闭页面后结束")}</span><span title={active?.cwd || cwd}>{active?.cwd || cwd || "当前工作区"}</span></footer>
      </section>;
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "laobos-terminal-ui", order: 40 }, TerminalPlugin));
    }
    exports.apply = apply; exports.inject = inject; return module.exports;
  },
});
