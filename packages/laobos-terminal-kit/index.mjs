/* Shared terminal enhancements for laobos terminal plugins.
 * Bundled by esbuild into each consumer plugin (src/client.jsx), so the module
 * must stay free of React and use DOM APIs only. */
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";

const css = `
      .lbs-term-search{align-items:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:var(--dsw-shadow-lv3,0 8px 24px rgba(0,0,0,.18));display:none;gap:4px;padding:3px 4px;position:absolute;right:14px;top:8px;z-index:5}.lbs-term-search[data-open=true]{display:flex}.lbs-term-search input{background:var(--dsw-alias-bg-base);border:0;border-radius:5px;color:var(--dsw-alias-label-primary);font:11px inherit;height:24px;outline:0;padding:0 7px;width:172px}.lbs-term-search-count{color:var(--dsw-alias-label-tertiary);font-size:9px;min-width:40px;text-align:center;white-space:nowrap}.lbs-term-search button{appearance:none;background:transparent;border:0;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;height:24px;width:24px}.lbs-term-search button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
    `;

function ensureCss() {
  if (typeof document === "undefined") return;
  if (!document.querySelector('style[data-plugin-css="@laobos/terminal-kit"]')) {
    const style = document.createElement("style");
    style.dataset.pluginCss = "@laobos/terminal-kit";
    style.textContent = css;
    document.head.append(style);
  }
}

export function attachTerminalEnhancements(terminal, host, options = {}) {
  if (typeof document === "undefined" || !host) return () => {};
  ensureCss();
  const isActive = options.isActive || (() => true);
  const search = new SearchAddon();
  terminal.loadAddon(search);
  const links = new WebLinksAddon();
  terminal.loadAddon(links);

  const bar = document.createElement("div");
  bar.className = "lbs-term-search";
  bar.setAttribute("data-open", "false");
  bar.innerHTML = [
    '<input type="text" placeholder="搜索终端内容" aria-label="搜索终端内容" spellcheck="false" />',
    '<span class="lbs-term-search-count"></span>',
    '<button type="button" data-nav="prev" aria-label="上一个匹配">↑</button>',
    '<button type="button" data-nav="next" aria-label="下一个匹配">↓</button>',
    '<button type="button" data-close="1" aria-label="关闭搜索">×</button>',
  ].join("");
  const input = bar.querySelector("input");
  const count = bar.querySelector(".lbs-term-search-count");
  host.append(bar);

  const decorations = {
    matchBackground: "rgba(250,190,50,.38)",
    activeMatchBackground: "rgba(255,150,40,.55)",
    matchOverviewRuler: "rgba(250,190,50,.5)",
    activeMatchOverviewRuler: "rgba(255,150,40,.7)",
  };
  let debounce = 0;
  const run = (backwards = false) => {
    const query = input.value;
    if (!query) { count.textContent = ""; try { search.clearDecorations(); } catch {} return; }
    try {
      if (backwards) search.findPrevious(query, { decorations, incremental: true });
      else search.findNext(query, { decorations, incremental: true });
    } catch {}
  };
  const open = () => {
    bar.setAttribute("data-open", "true");
    input.focus();
    input.select();
    if (input.value) run();
  };
  const close = () => {
    bar.setAttribute("data-open", "false");
    try { search.clearDecorations(); } catch {}
    count.textContent = "";
    if (isActive()) terminal.focus();
  };
  const onResults = search.onDidChangeResults((event) => {
    const total = Number(event?.resultCount ?? 0);
    count.textContent = total ? `${Number(event?.resultIndex ?? 0) + 1}/${total}` : "无匹配";
  });
  input.addEventListener("input", () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => run(), 120);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); run(event.shiftKey); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  bar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.nav === "prev") run(true);
    else if (button.dataset.nav === "next") run(false);
    else if (button.dataset.close) close();
  });
  const shortcut = (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return;
    if (!isActive()) return;
    event.preventDefault();
    const selection = window.getSelection?.()?.toString() || "";
    if (selection && document.activeElement !== input) input.value = selection.slice(0, 200);
    open();
  };
  window.addEventListener("keydown", shortcut, true);

  return () => {
    window.removeEventListener("keydown", shortcut, true);
    window.clearTimeout(debounce);
    onResults.dispose();
    bar.remove();
    try { search.dispose(); links.dispose(); } catch {}
  };
}
