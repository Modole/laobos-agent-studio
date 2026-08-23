/* eslint-disable @next/next/no-assign-module-variable -- DSH browser plugins use a CommonJS-style module factory */
window.__ModuleLoader__.load({
  id: "@laobos/dsh-market",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const {
      createElement: h,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
    } = React;

    const css = `
      .lbsm-page{color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px;max-width:920px;padding:2px 0 28px}
      .lbsm-head{align-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 16%,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2) 68%);border:1px solid color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 24%,var(--dsw-alias-line-border));border-radius:16px;display:flex;gap:18px;justify-content:space-between;overflow:hidden;padding:18px 20px;position:relative}
      .lbsm-head:after{background:radial-gradient(circle,color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 20%,transparent),transparent 68%);content:"";height:180px;pointer-events:none;position:absolute;right:-55px;top:-90px;width:180px}
      .lbsm-head-main{align-items:center;display:flex;gap:13px;min-width:0;position:relative;z-index:1}
      .lbsm-head-mark{align-items:center;background:linear-gradient(145deg,var(--dsw-alias-interactive-bg-primary),color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 58%,#745cff));border-radius:12px;box-shadow:0 8px 22px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 25%,transparent);color:var(--dsw-alias-label-on-primary);display:flex;flex:none;font-size:17px;font-weight:750;height:42px;justify-content:center;width:42px}
      .lbsm-eyebrow{color:var(--dsw-alias-interactive-bg-primary);font-size:9px;font-weight:700;letter-spacing:.12em;margin-bottom:2px;text-transform:uppercase}
      .lbsm-title{font-size:20px;font-weight:680;letter-spacing:-.01em;line-height:27px}
      .lbsm-sub{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin-top:2px}
      .lbsm-brand-cluster{align-items:flex-end;display:flex;flex-direction:column;gap:6px;position:relative;z-index:1}
      .lbsm-brand{align-items:center;background:color-mix(in srgb,var(--dsw-alias-bg-layer-3) 88%,transparent);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);display:inline-flex;font-size:10px;gap:6px;line-height:20px;padding:0 9px;white-space:nowrap}
      .lbsm-brand-dot{background:#89939e;border-radius:50%;height:6px;width:6px}.lbsm-brand-dot.online{background:#2ba36d;box-shadow:0 0 0 3px rgba(43,163,109,.12)}
      .lbsm-tabs{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:11px;display:flex;gap:3px;padding:4px}
      .lbsm-tab{appearance:none;background:transparent;border:0;border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:1;font:inherit;font-size:12px;height:34px;padding:0 12px;transition:background .16s ease,color .16s ease,box-shadow .16s ease}
      .lbsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .lbsm-tab[data-active=true]{background:var(--dsw-alias-bg-layer-3);box-shadow:0 1px 4px rgba(0,0,0,.1);color:var(--dsw-alias-label-primary);font-weight:620}
      .lbsm-stack{display:flex;flex-direction:column;gap:14px}.lbsm-panel{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:14px;padding:16px}
      .lbsm-row{align-items:center;display:flex;flex-wrap:wrap;gap:8px}.lbsm-grid{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}
      .lbsm-field{display:flex;flex-direction:column;gap:6px;min-width:0}.lbsm-label{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600}
      .lbsm-input,.lbsm-select{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-line-border);border-radius:9px;box-sizing:border-box;color:inherit;font:inherit;font-size:12px;height:38px;outline:none;padding:0 11px;width:100%}
      .lbsm-input:hover,.lbsm-select:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-tertiary) 58%,var(--dsw-alias-line-border))}.lbsm-input:focus,.lbsm-select:focus{border-color:var(--dsw-alias-line-border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 12%,transparent)}
      .lbsm-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.lbsm-search-input{font-size:14px;height:44px;padding:0 14px}
      .lbsm-button{appearance:none;background:var(--dsw-alias-interactive-bg-primary);border:1px solid transparent;border-radius:9px;box-shadow:0 4px 12px color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 20%,transparent);color:var(--dsw-alias-label-on-primary);cursor:pointer;font:inherit;font-size:12px;font-weight:600;height:38px;padding:0 15px;transition:filter .15s ease,transform .15s ease;white-space:nowrap}.lbsm-button:hover:not(:disabled){filter:brightness(1.06);transform:translateY(-1px)}
      .lbsm-button.secondary{background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-line-border);box-shadow:none;color:var(--dsw-alias-label-primary)}.lbsm-button.danger{background:rgba(218,70,70,.13);box-shadow:none;color:#d94b4b}.lbsm-button:disabled{box-shadow:none;cursor:not-allowed;opacity:.45;transform:none}
      .lbsm-search-panel{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.05);display:grid;gap:14px;padding:16px}
      .lbsm-search-primary{align-items:end;display:grid;gap:10px;grid-template-columns:minmax(0,1fr) auto}.lbsm-search-primary .lbsm-button{height:44px;min-width:104px}
      .lbsm-filter-head{align-items:center;border-top:1px solid var(--dsw-alias-line-border);display:flex;justify-content:space-between;padding-top:12px}.lbsm-filter-title{color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:650;letter-spacing:.05em;text-transform:uppercase}.lbsm-filter-note{color:var(--dsw-alias-label-tertiary);font-size:10px}
      .lbsm-form-grid{align-items:end;display:grid;gap:9px;grid-template-columns:minmax(190px,1.5fr) minmax(128px,.8fr) 110px}
      .lbsm-ranking{align-items:center;display:flex;flex-wrap:wrap;gap:7px}.lbsm-ranking-label{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-right:2px}.lbsm-rank-button,.lbsm-category{appearance:none;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px;height:29px;padding:0 11px}.lbsm-rank-button:hover,.lbsm-category:hover{border-color:var(--dsw-alias-label-tertiary);color:var(--dsw-alias-label-primary)}.lbsm-rank-button[data-active=true],.lbsm-category[data-active=true]{background:color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 12%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 48%,var(--dsw-alias-line-border));color:var(--dsw-alias-interactive-bg-primary);font-weight:620}
      .lbsm-category-count{opacity:.65;padding-left:4px}.lbsm-results-head{align-items:flex-end;display:flex;gap:12px;justify-content:space-between}.lbsm-results-title{font-size:14px;font-weight:650}.lbsm-results-sub{color:var(--dsw-alias-label-tertiary);font-size:10px;margin-top:3px}.lbsm-meta{color:var(--dsw-alias-label-tertiary);font-size:10px}
      .lbsm-table-wrap{border:1px solid var(--dsw-alias-line-border);border-radius:12px;overflow:auto}.lbsm-table{border-collapse:collapse;min-width:620px;width:100%}.lbsm-table th{background:var(--dsw-alias-bg-layer-3);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:600;padding:10px 12px;text-align:left;white-space:nowrap}.lbsm-table td{border-bottom:1px solid var(--dsw-alias-line-border);font-size:12px;padding:11px 12px;vertical-align:middle}.lbsm-table tr:last-child td{border-bottom:0}.lbsm-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover)}
      .lbsm-name{font-size:13px;font-weight:650;line-height:19px}.lbsm-name a{color:inherit;text-decoration:none}.lbsm-name a:hover{color:var(--dsw-alias-interactive-bg-primary)}.lbsm-desc{color:var(--dsw-alias-label-secondary);line-height:18px;max-width:360px}
      .lbsm-market-list{display:grid;gap:9px}.lbsm-market-item{align-items:center;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:13px;display:grid;gap:12px;grid-template-columns:38px minmax(0,1fr) auto;padding:12px 13px;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}.lbsm-market-item:hover{border-color:color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 36%,var(--dsw-alias-line-border));box-shadow:0 8px 22px rgba(0,0,0,.07);transform:translateY(-1px)}
      .lbsm-market-icon{align-items:center;background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-interactive-bg-primary) 78%,#745cff),var(--dsw-alias-interactive-bg-primary));border-radius:10px;color:var(--dsw-alias-label-on-primary);display:flex;font-size:14px;font-weight:720;height:38px;justify-content:center;text-transform:uppercase;width:38px}.lbsm-market-main{display:grid;gap:4px;min-width:0}.lbsm-market-title{align-items:center;display:flex;gap:7px;min-width:0}.lbsm-market-title .lbsm-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lbsm-rank{align-items:center;background:var(--dsw-alias-bg-layer-3);border-radius:5px;color:var(--dsw-alias-label-tertiary);display:inline-flex;font-size:9px;font-variant-numeric:tabular-nums;height:18px;padding:0 5px}.lbsm-rank.top{background:rgba(212,154,41,.12);color:#c39129}.lbsm-stars{color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:nowrap}.lbsm-market-desc{color:var(--dsw-alias-label-secondary);display:-webkit-box;font-size:11px;line-height:17px;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:1}.lbsm-market-meta{align-items:center;color:var(--dsw-alias-label-tertiary);display:flex;flex-wrap:wrap;font-size:9px;gap:4px 9px}.lbsm-category-tag{background:var(--dsw-alias-bg-layer-3);border-radius:4px;color:var(--dsw-alias-label-secondary);padding:1px 5px}.lbsm-market-actions{align-items:center;display:flex;gap:7px;justify-content:flex-end}.lbsm-market-link{color:var(--dsw-alias-label-tertiary);font-size:10px;text-decoration:none}.lbsm-market-link:hover{color:var(--dsw-alias-label-primary)}.lbsm-install{height:32px;min-width:62px;padding:0 12px}
      .lbsm-badge{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);display:inline-flex;font-size:10px;line-height:20px;padding:0 8px;white-space:nowrap}.lbsm-badge.ok{border-color:rgba(44,168,110,.4);color:#2a9b67}.lbsm-badge.warn{border-color:rgba(212,154,41,.5);color:#b8860b}.lbsm-badge.err{border-color:rgba(218,70,70,.5);color:#d94b4b}
      .lbsm-ok{background:rgba(44,168,110,.1);border:1px solid rgba(44,168,110,.25);border-radius:10px;color:#2a9b67;font-size:11px;line-height:18px;padding:10px 12px;white-space:pre-wrap;word-break:break-word}.lbsm-error{background:rgba(218,70,70,.1);border:1px solid rgba(218,70,70,.25);border-radius:10px;color:#d94b4b;font-size:11px;line-height:18px;padding:10px 12px;white-space:pre-wrap;word-break:break-word}.lbsm-help{background:var(--dsw-alias-bg-layer-3);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:19px;padding:11px 12px}.lbsm-empty{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;justify-content:center;min-height:150px;text-align:center}
      .lbsm-discovery{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:13px;display:grid;gap:12px;padding:14px}.lbsm-discovery-copy{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;font-size:11px;gap:9px}.lbsm-spinner{animation:lbsm-spin .8s linear infinite;border:2px solid var(--dsw-alias-line-border);border-radius:50%;border-top-color:var(--dsw-alias-interactive-bg-primary);height:13px;width:13px}.lbsm-skeleton{animation:lbsm-pulse 1.25s ease-in-out infinite;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-3),var(--dsw-alias-interactive-bg-hover),var(--dsw-alias-bg-layer-3));background-size:200% 100%;border-radius:7px;height:54px}@keyframes lbsm-spin{to{transform:rotate(360deg)}}@keyframes lbsm-pulse{to{background-position:-200% 0}}
      .lbsm-check{align-items:center;display:flex;font-size:12px;gap:6px}.lbsm-dot{border-radius:50%;display:inline-block;height:7px;margin-right:6px;width:7px}.lbsm-dot[data-state=active]{background:#2a9b67}.lbsm-dot[data-state=failed]{background:#d94b4b}.lbsm-dot[data-state=pending]{background:#d49a29}.lbsm-dot[data-state=null]{background:var(--dsw-alias-label-quaternary)}
      @media(max-width:760px){.lbsm-head{align-items:flex-start}.lbsm-brand-cluster{display:none}.lbsm-form-grid{grid-template-columns:1fr 1fr}.lbsm-market-item{align-items:start;grid-template-columns:38px minmax(0,1fr)}.lbsm-market-actions{grid-column:2;justify-content:flex-start}.lbsm-results-head{align-items:flex-start;flex-direction:column}.lbsm-filter-note{display:none}}
      @media(max-width:520px){.lbsm-search-primary,.lbsm-form-grid{grid-template-columns:1fr}.lbsm-tabs{overflow:auto}.lbsm-tab{flex:none}.lbsm-market-item{grid-template-columns:34px minmax(0,1fr)}.lbsm-market-icon{height:34px;width:34px}.lbsm-market-actions{grid-column:1/-1}.lbsm-head{padding:15px}.lbsm-head-mark{display:none}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="@laobos/dsh-market"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "@laobos/dsh-market";
      style.textContent = css;
      document.head.appendChild(style);
    }

    const API = "/laobos/api/plugin-market";
    async function request(path, options = {}) {
      const response = await fetch(API + path, {
        ...options,
        headers: { "content-type": "application/json", ...(options.headers || {}) },
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value?.error?.message || `请求失败：${response.status}`);
      return value;
    }
    const classNames = (...values) => values.filter(Boolean).join(" ");
    const Button = ({ secondary, danger, ...props }) =>
      h("button", { ...props, className: classNames("lbsm-button", secondary && "secondary", danger && "danger", props.className) });
    const Field = ({ label, children, style }) =>
      h("div", { className: "lbsm-field", style }, h("span", { className: "lbsm-label" }, label), children);

    const STATUS_LABEL = { active: "已生效", pending: "待重启", loading: "加载中", failed: "加载失败", disposed: "已停用" };
    const DEFAULT_SEARCH = Object.freeze({ keywords: "", regex: "", field: "any", sort: "stars", maxResults: 50 });
    const RANKINGS = [
      { id: "stars", label: "热门榜", note: "按 GitHub Star" },
      { id: "updated", label: "活跃榜", note: "按最近更新" },
      { id: "forks", label: "Fork 榜", note: "按社区参与" },
    ];
    const CATEGORIES = [
      { id: "all", label: "全部" },
      { id: "experience", label: "交互体验", pattern: /\b(ui|ux|theme|skin|chat|conversation|sidebar|status|notify|notification|desktop|visual|design|widget|audio)\b|界面|主题|交互|通知|桌面/u },
      { id: "tools", label: "工具能力", pattern: /\b(tool|vision|search|browser|memory|knowledge|document|pdf|image|data|email|rag|mcp|git|file|database)\b|工具|视觉|搜索|知识|文档|记忆/u },
      { id: "automation", label: "自动化与 Agent", pattern: /\b(workflow|automation|agent|multi-agent|schedule|loop|research|orchestrat|team|planner|task)\b|工作流|自动化|多智能体|代理|任务/u },
      { id: "ecosystem", label: "开发生态", pattern: /\b(runtime|sandbox|provider|integration|diagnostic|developer|devtool|plugin-market|template|bridge|telemetry|security)\b|运行时|沙箱|开发|生态|诊断|安全/u },
    ];
    const compactNumber = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });

    function categoryFor(item) {
      const text = [item.repo, item.fullName, item.description, ...(item.topics || [])].join(" ").toLowerCase();
      return CATEGORIES.slice(1).find((category) => category.pattern.test(text)) || CATEGORIES[2];
    }

    function rankingLabel(sort) {
      return RANKINGS.find((ranking) => ranking.id === sort) || RANKINGS[0];
    }

    function searchMarket(values) {
      const params = new URLSearchParams();
      if (values.keywords) params.set("keywords", values.keywords);
      if (values.regex) params.set("regex", values.regex);
      params.set("field", values.field);
      params.set("sort", values.sort);
      params.set("maxResults", String(values.maxResults));
      return request(`/search?${params.toString()}`);
    }

    /* ─────────────────────────── 市场浏览 ─────────────────────────── */
    function BrowseTab({ refreshInstalled }) {
      const [form, setForm] = useState(() => ({ ...DEFAULT_SEARCH }));
      const [result, setResult] = useState(null);
      const [busy, setBusy] = useState(true);
      const [error, setError] = useState("");
      const [installed, setInstalled] = useState([]);
      const [installing, setInstalling] = useState("");
      const [installResult, setInstallResult] = useState(null);
      const [category, setCategory] = useState("all");
      const searchSequence = useRef(0);

      const loadInstalled = useCallback(async () => {
        try {
          const data = await request("/installed");
          setInstalled(data.items || []);
        } catch {}
      }, []);
      useEffect(() => { loadInstalled(); }, [loadInstalled]);

      const runSearch = useCallback(async (values) => {
        const sequence = searchSequence.current + 1;
        searchSequence.current = sequence;
        setBusy(true);
        setError("");
        try {
          const data = await searchMarket(values);
          if (sequence !== searchSequence.current) return;
          setResult(data);
        } catch (err) {
          if (sequence !== searchSequence.current) return;
          setError(err.message || String(err));
        } finally {
          if (sequence === searchSequence.current) setBusy(false);
        }
      }, []);

      useEffect(() => {
        void runSearch(DEFAULT_SEARCH);
        return () => { searchSequence.current += 1; };
      }, [runSearch]);

      const search = (event) => {
        event?.preventDefault();
        void runSearch(form);
      };

      const install = async (item) => {
        if (!window.confirm(`确认安装 ${item.fullName}？\n\n将下载仓库并写入当前 profile 的 node_modules 与 cordis.patch.yml，重启 dsh web 后生效。`)) return;
        setInstalling(item.fullName);
        setInstallResult(null);
        setError("");
        try {
          const data = await request("/install", {
            method: "POST",
            body: JSON.stringify({ owner: item.owner, repo: item.repo }),
          });
          setInstallResult(data);
          refreshInstalled?.();
          loadInstalled();
        } catch (err) {
          setError(err.message || String(err));
        } finally {
          setInstalling("");
        }
      };

      const installedSet = useMemo(() => new Set(installed.map((entry) => (entry.moduleName || "").toLowerCase())), [installed]);
      const isInstalled = (item) => {
        const repo = item.repo.toLowerCase();
        for (const name of installedSet) {
          if (name === repo || name.endsWith(`/${repo}`) || name.includes(`-${repo}`) || name.includes(repo)) return true;
        }
        return false;
      };

      const categoryCounts = useMemo(() => {
        const counts = Object.fromEntries(CATEGORIES.map((item) => [item.id, 0]));
        for (const item of result?.items || []) {
          counts.all += 1;
          counts[categoryFor(item).id] += 1;
        }
        return counts;
      }, [result]);
      const visibleItems = useMemo(() => (result?.items || []).filter((item) => category === "all" || categoryFor(item).id === category), [category, result]);
      const activeCategory = CATEGORIES.find((item) => item.id === category) || CATEGORIES[0];
      const activeRanking = rankingLabel(form.sort);
      const selectRanking = (sort) => {
        if (busy || sort === form.sort) return;
        const next = { ...form, sort };
        setForm(next);
        void runSearch(next);
      };

      return h("form", { className: "lbsm-stack", onSubmit: search, "aria-busy": busy },
        h("div", { className: "lbsm-search-panel" },
          h("div", { className: "lbsm-search-primary" },
            h(Field, { label: "搜索 DSH 插件" },
              h("input", { className: "lbsm-input lbsm-search-input", value: form.keywords, placeholder: "搜索名称、能力或使用场景…",
                onChange: (event) => setForm({ ...form, keywords: event.target.value }) })),
            h(Button, { type: "submit", disabled: busy }, busy ? "正在搜索…" : result ? "搜索" : "发现插件")),
          h("div", { className: "lbsm-filter-head" },
            h("span", { className: "lbsm-filter-title" }, "高级筛选"),
            h("span", { className: "lbsm-filter-note" }, "数据来自 GitHub dsh-plugin 生态")),
          h("div", { className: "lbsm-form-grid" },
          h(Field, { label: "正则筛选（可选，不区分大小写）" },
            h("input", { className: "lbsm-input mono", value: form.regex, placeholder: "如：^(dsh|awesome).*market",
              onChange: (event) => setForm({ ...form, regex: event.target.value }) })),
          h(Field, { label: "正则作用字段" },
            h("select", { className: "lbsm-select", value: form.field, onChange: (event) => setForm({ ...form, field: event.target.value }) },
              h("option", { value: "any" }, "全部字段"),
              h("option", { value: "name" }, "仓库名"),
              h("option", { value: "full_name" }, "owner/仓库"),
              h("option", { value: "description" }, "描述"))),
          h(Field, { label: "条数上限" },
            h("select", { className: "lbsm-select", value: String(form.maxResults), onChange: (event) => setForm({ ...form, maxResults: Number(event.target.value) }) },
              [10, 20, 50, 100, 200].map((n) => h("option", { key: n, value: String(n) }, String(n))))),
          )),
        h("div", { className: "lbsm-ranking", "aria-label": "排行榜" },
          h("span", { className: "lbsm-ranking-label" }, "排行榜"),
          RANKINGS.map((item) => h("button", { key: item.id, type: "button", className: "lbsm-rank-button", "data-active": form.sort === item.id, disabled: busy, onClick: () => selectRanking(item.id), title: item.note }, item.label))),
        h("div", { className: "lbsm-ranking", "aria-label": "插件分类" },
          h("span", { className: "lbsm-ranking-label" }, "分类"),
          CATEGORIES.map((item) => h("button", { key: item.id, type: "button", className: "lbsm-category", "data-active": category === item.id, onClick: () => setCategory(item.id) },
            item.label,
            result ? h("span", { className: "lbsm-category-count" }, categoryCounts[item.id]) : null))),
        result ? h("div", { className: "lbsm-results-head" },
          h("div", null,
            h("div", { className: "lbsm-results-title" }, `${activeRanking.label} · ${activeCategory.label}`),
            h("div", { className: "lbsm-results-sub" }, activeRanking.note, " · 热度仅代表 GitHub 社区信号，不等同安装量或安全背书")),
          h("span", { className: "lbsm-meta", role: "status", "aria-live": "polite" }, busy ? `正在更新 · 当前显示 ${visibleItems.length} 个` : `显示 ${visibleItems.length} 个 · 本次检索 ${result.matched} 个 · 市场共 ${result.total} 个`)) : null,
        error ? h("div", { className: "lbsm-error", role: "alert" },
          error,
          !result ? h(Button, { type: "button", secondary: true, onClick: () => { void runSearch(form); }, style: { marginLeft: 10 } }, "重新加载") : null) : null,
        installResult ? h("div", { className: "lbsm-ok" }, installResult.message + (installResult.restartRequired ? "\n⚠️ 重启 dsh web / 劳博士 Studio 后生效。" : "")) : null,
        busy && !result ? h("div", { className: "lbsm-discovery", role: "status", "aria-live": "polite" },
          h("div", { className: "lbsm-discovery-copy" }, h("span", { className: "lbsm-spinner", "aria-hidden": "true" }), "正在自动发现并整理 DSH 插件…"),
          [0, 1, 2].map((item) => h("div", { className: "lbsm-skeleton", key: item, "aria-hidden": "true" }))) : null,
        result && visibleItems.length === 0 ? h("div", { className: "lbsm-empty" }, category === "all" ? "没有匹配的插件，试试放宽关键词或正则。" : `当前结果中没有“${activeCategory.label}”插件，试试其他分类。`) : null,
        result && visibleItems.length > 0
          ? h("div", { className: "lbsm-market-list", role: "list", "aria-label": "DSH 插件搜索结果" },
              visibleItems.map((item, index) => {
                const installedItem = isInstalled(item);
                const itemCategory = categoryFor(item);
                return h("article", { className: "lbsm-market-item", key: item.fullName, role: "listitem" },
                  h("div", { className: "lbsm-market-icon", "aria-hidden": "true" }, (item.repo || "P").slice(0, 1)),
                  h("div", { className: "lbsm-market-main" },
                    h("div", { className: "lbsm-market-title" },
                      h("span", { className: classNames("lbsm-rank", index < 3 && "top") }, `#${index + 1}`),
                      h("div", { className: "lbsm-name" }, h("a", { href: item.htmlUrl, target: "_blank", rel: "noreferrer", title: item.fullName }, item.fullName)),
                      h("span", { className: "lbsm-stars", title: `${item.stars} stars` }, `★ ${compactNumber.format(item.stars)}`)),
                    h("div", { className: "lbsm-market-desc" }, item.description || "暂无描述"),
                    h("div", { className: "lbsm-market-meta" },
                      h("span", { className: "lbsm-category-tag" }, itemCategory.label),
                      item.license ? h("span", null, `许可证 ${item.license}`) : null,
                      h("span", null, `更新 ${item.updatedAt.slice(0, 10)}`),
                      h("span", null, `${compactNumber.format(item.forks)} Fork`))),
                  h("div", { className: "lbsm-market-actions" },
                    h("a", { className: "lbsm-market-link", href: item.htmlUrl, target: "_blank", rel: "noreferrer" }, "详情 ↗"),
                    installedItem ? h("span", { className: "lbsm-badge ok" }, "已安装") : null,
                    h(Button, { type: "button", className: "lbsm-install", secondary: installedItem, disabled: installedItem || installing === item.fullName, onClick: () => install(item) },
                      installedItem ? "已安装" : installing === item.fullName ? "安装中…" : "安装")));
              }))
          : null);
    }

    /* ─────────────────────────── 已安装 ─────────────────────────── */
    function InstalledTab() {
      const [items, setItems] = useState(null);
      const [error, setError] = useState("");
      const load = useCallback(async () => {
        setError("");
        try {
          const data = await request("/installed");
          setItems(data.items || []);
        } catch (err) {
          setError(err.message || String(err));
        }
      }, []);
      useEffect(() => { load(); }, [load]);
      return h("div", { className: "lbsm-stack lbsm-panel" },
        h("div", { className: "lbsm-row" },
          h(Button, { secondary: true, onClick: load }, "刷新")),
        error ? h("div", { className: "lbsm-error" }, error) : null,
        !items ? h("div", { className: "lbsm-empty" }, "加载中…") :
          items.length === 0 ? h("div", { className: "lbsm-empty" }, "当前 profile 没有注册任何插件。") :
            h("div", { className: "lbsm-table-wrap" },
              h("table", { className: "lbsm-table" },
                h("thead", null, h("tr", null, h("th", null, "模块名"), h("th", null, "条目 id"), h("th", null, "状态"))),
                h("tbody", null, items.map((item) => {
                  const state = item.pending ? "pending" : item.fiberPhase;
                  const label = item.pending ? "待重启生效" : (STATUS_LABEL[state] || state || "未知");
                  const badge = item.pending ? "warn" : state === "active" ? "ok" : state === "failed" ? "err" : "";
                  return h("tr", { key: `${item.entryId}:${item.moduleName}` },
                    h("td", null, h("div", { className: "lbsm-name" }, item.moduleName || "?")),
                    h("td", null, h("span", { className: "lbsm-meta" }, item.entryId || "?")),
                    h("td", null, h("span", { className: classNames("lbsm-badge", badge) }, label)));
                })))));
    }

    /* ─────────────────────────── 上传发布 ─────────────────────────── */
    function UploadTab() {
      const [form, setForm] = useState({ dir: "", repo: "", description: "", isPrivate: false, topics: "" });
      const [result, setResult] = useState(null);
      const [error, setError] = useState("");
      const [busy, setBusy] = useState(false);

      const submit = async (event) => {
        event.preventDefault();
        if (!form.dir || !form.repo) { setError("请填写插件目录与仓库名。"); return; }
        setBusy(true);
        setError("");
        setResult(null);
        try {
          const data = await request("/upload", {
            method: "POST",
            body: JSON.stringify({
              dir: form.dir,
              repo: form.repo,
              description: form.description,
              isPrivate: form.isPrivate,
              topics: form.topics.split(/[,，\s]+/).filter(Boolean),
            }),
          });
          setResult(data);
        } catch (err) {
          setError(err.message || String(err));
        } finally {
          setBusy(false);
        }
      };

      return h("form", { className: "lbsm-stack lbsm-panel", onSubmit: submit },
        h("div", { className: "lbsm-help" },
          "把本地插件目录发布到 GitHub 市场：自动 git init/提交、创建仓库并推送、添加 dsh-plugin topic。",
          h("br"), "要求：目录含 package.json；本机已登录 gh CLI（gh auth login）。私有仓库不会出现在市场搜索中。"),
        h(Field, { label: "插件目录（绝对路径，含 package.json）" },
          h("input", { className: "lbsm-input mono", value: form.dir, placeholder: "/path/to/my-dsh-plugin",
            onChange: (event) => setForm({ ...form, dir: event.target.value }) })),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 } },
          h(Field, { label: "仓库名" },
            h("input", { className: "lbsm-input mono", value: form.repo, placeholder: "my-dsh-plugin",
              onChange: (event) => setForm({ ...form, repo: event.target.value }) })),
          h(Field, { label: "仓库简介" },
            h("input", { className: "lbsm-input", value: form.description, placeholder: "留空则使用 package.json 的 description",
              onChange: (event) => setForm({ ...form, description: event.target.value }) }))),
        h("div", { className: "lbsm-row" },
          h(Field, { label: "额外 topics（逗号分隔）" },
            h("input", { className: "lbsm-input", value: form.topics, placeholder: "如：vision, cli",
              onChange: (event) => setForm({ ...form, topics: event.target.value }) })),
          h("label", { className: "lbsm-check", style: { marginTop: 16 } },
            h("input", { type: "checkbox", checked: form.isPrivate, onChange: (event) => setForm({ ...form, isPrivate: event.target.checked }) }),
            "私有仓库")),
        h("div", { className: "lbsm-row" },
          h(Button, { type: "submit", disabled: busy }, busy ? "发布中…" : "发布到 GitHub")),
        error ? h("div", { className: "lbsm-error" }, error) : null,
        result ? h("div", { className: "lbsm-ok" }, result.message + "\ncommit: " + result.commit) : null);
    }

    /* ─────────────────────────── 设置 ─────────────────────────── */
    function SettingsTab() {
      const [form, setForm] = useState(null);
      const [status, setStatus] = useState(null);
      const [saved, setSaved] = useState("");
      const [error, setError] = useState("");

      const load = useCallback(async () => {
        try {
          const [settings, statusData] = await Promise.all([request("/settings"), request("/status")]);
          setForm(settings);
          setStatus(statusData);
        } catch (err) {
          setError(err.message || String(err));
        }
      }, []);
      useEffect(() => { load(); }, [load]);

      const save = async (event) => {
        event.preventDefault();
        setError("");
        setSaved("");
        try {
          const next = await request("/settings", { method: "PUT", body: JSON.stringify(form) });
          setForm(next);
          setSaved("已保存。");
        } catch (err) {
          setError(err.message || String(err));
        }
      };

      if (!form) return h("div", { className: "lbsm-empty" }, error || "加载中…");
      return h("form", { className: "lbsm-stack lbsm-panel", onSubmit: save },
        h(Field, { label: "HTTP 代理（GitHub 访问需要时填写，如 http://127.0.0.1:7890）" },
          h("input", { className: "lbsm-input mono", value: form.proxyUrl || "", placeholder: "留空直连",
            onChange: (event) => setForm({ ...form, proxyUrl: event.target.value }) })),
        h(Field, { label: "GitHub API 地址" },
          h("input", { className: "lbsm-input mono", value: form.registry || "", onChange: (event) => setForm({ ...form, registry: event.target.value }) })),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
          h(Field, { label: "上传默认 owner（GitHub 账号）" },
            h("input", { className: "lbsm-input mono", value: form.uploadOwner || "", onChange: (event) => setForm({ ...form, uploadOwner: event.target.value }) })),
          h(Field, { label: "安装目标 profile" },
            h("input", { className: "lbsm-input mono", value: form.profile || "", onChange: (event) => setForm({ ...form, profile: event.target.value }) }))),
        h("div", { className: "lbsm-row" },
          h(Button, { type: "submit" }, "保存设置"),
          saved ? h("span", { className: "lbsm-ok", style: { padding: "4px 10px" } }, saved) : null),
        error ? h("div", { className: "lbsm-error" }, error) : null,
        status ? h("div", { className: "lbsm-help" },
          `运行状态：gh CLI ${status.ghCli ? "可用" : "不可用"} · GitHub 令牌 ${status.ghTokenConfigured ? "已配置" : "未配置"} · `,
          `DSH_HOME: ${status.dshHome || "未知"} · profile: ${status.profile}`, h("br"),
          `插件目录：${status.profileDir || "未知"}`) : null);
    }

    /* ─────────────────────────── 页面 ─────────────────────────── */
    const TABS = [
      { id: "browse", label: "发现插件" },
      { id: "installed", label: "已安装" },
      { id: "upload", label: "发布插件" },
      { id: "settings", label: "市场设置" },
    ];

    function MarketPage() {
      const [tab, setTab] = useState("browse");
      const [visitedTabs, setVisitedTabs] = useState(() => new Set(["browse"]));
      const [status, setStatus] = useState(null);
      useEffect(() => {
        request("/status").then(setStatus).catch(() => {});
      }, []);
      useEffect(() => {
        setVisitedTabs((previous) => {
          if (previous.has(tab)) return previous;
          return new Set([...previous, tab]);
        });
      }, [tab]);
      return h("div", { className: "lbsm-page" },
        h("div", { className: "lbsm-head" },
          h("div", { className: "lbsm-head-main" },
            h("div", { className: "lbsm-head-mark", "aria-hidden": "true" }, "L"),
            h("div", null,
              h("div", { className: "lbsm-eyebrow" }, "LAOBOS ECOSYSTEM"),
              h("div", { className: "lbsm-title" }, "插件市场"),
              h("div", { className: "lbsm-sub" }, "发现、评估并安装适合你的 DSH 扩展"))),
          status ? h("div", { className: "lbsm-brand-cluster" },
            h("span", { className: "lbsm-brand" },
              h("span", { className: classNames("lbsm-brand-dot", status.ghCli && "online") }),
              status.ghCli ? "GitHub 已连接" : "GitHub 未连接"),
            h("span", { className: "lbsm-brand" }, `${status.profile || "web"} profile · 安装前安全预检`)) : null),
        h("div", { className: "lbsm-tabs" }, TABS.map((item) =>
          h("button", { key: item.id, type: "button", className: "lbsm-tab", "data-active": tab === item.id, onClick: () => setTab(item.id) }, item.label))),
        TABS.filter((item) => item.id === tab || visitedTabs.has(item.id)).map((item) => {
          const Page = {
            browse: BrowseTab,
            installed: InstalledTab,
            upload: UploadTab,
            settings: SettingsTab,
          }[item.id];
          return h("div", {
            key: item.id,
            className: "lbsm-tab-panel",
            hidden: item.id !== tab,
            "aria-hidden": item.id !== tab,
          }, h(Page, null));
        }));
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "laobos-plugin-market",
        order: 20,
        label: () => "插件市场",
      }, MarketPage));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
