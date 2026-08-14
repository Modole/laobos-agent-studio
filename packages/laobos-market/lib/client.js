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
      useState,
    } = React;

    const css = `
      .lbsm-page{color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:14px;padding:2px 0 24px}
      .lbsm-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .lbsm-title{font-size:18px;font-weight:600;line-height:26px}
      .lbsm-sub{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;margin-top:2px}
      .lbsm-brand{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:11px;padding:2px 10px}
      .lbsm-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-line-border)}
      .lbsm-tab{appearance:none;background:transparent;border:0;border-bottom:2px solid transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:13px;padding:8px 12px}
      .lbsm-tab:hover{color:var(--dsw-alias-label-primary)}
      .lbsm-tab[data-active=true]{border-bottom-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);font-weight:600}
      .lbsm-stack{display:flex;flex-direction:column;gap:10px}
      .lbsm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .lbsm-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
      .lbsm-field{display:flex;flex-direction:column;gap:4px;min-width:0}
      .lbsm-label{font-size:12px;font-weight:550;color:var(--dsw-alias-label-secondary)}
      .lbsm-input,.lbsm-select{box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:9px;color:inherit;font:inherit;font-size:13px;outline:none;padding:7px 10px;width:100%}
      .lbsm-input:focus,.lbsm-select:focus{border-color:var(--dsw-alias-line-border-focus)}
      .lbsm-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .lbsm-button{appearance:none;background:var(--dsw-alias-interactive-bg-primary);border:0;border-radius:9px;color:var(--dsw-alias-label-on-primary);cursor:pointer;font:inherit;font-size:13px;height:34px;padding:0 14px;white-space:nowrap}
      .lbsm-button.secondary{background:var(--dsw-alias-interactive-bg-secondary);color:var(--dsw-alias-label-primary)}
      .lbsm-button.danger{background:rgba(218,70,70,.13);color:#d94b4b}
      .lbsm-button:disabled{cursor:not-allowed;opacity:.5}
      .lbsm-table-wrap{border:1px solid var(--dsw-alias-line-border);border-radius:12px;overflow:auto}
      .lbsm-table{border-collapse:collapse;min-width:760px;width:100%}
      .lbsm-table th{background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-line-border);color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:550;padding:9px 10px;text-align:left;white-space:nowrap}
      .lbsm-table td{border-bottom:1px solid var(--dsw-alias-line-border);font-size:12px;padding:9px 10px;vertical-align:middle}
      .lbsm-table tr:last-child td{border-bottom:0}
      .lbsm-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover)}
      .lbsm-name{font-size:13px;font-weight:600;line-height:19px}
      .lbsm-name a{color:inherit;text-decoration:none}.lbsm-name a:hover{text-decoration:underline}
      .lbsm-desc{color:var(--dsw-alias-label-secondary);line-height:18px;max-width:360px}
      .lbsm-meta{color:var(--dsw-alias-label-tertiary);font-size:11px}
      .lbsm-badge{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-line-border);border-radius:999px;color:var(--dsw-alias-label-secondary);display:inline-flex;font-size:11px;line-height:18px;padding:0 8px;white-space:nowrap}
      .lbsm-badge.ok{border-color:rgba(44,168,110,.4);color:#2a9b67}
      .lbsm-badge.warn{border-color:rgba(212,154,41,.5);color:#b8860b}
      .lbsm-badge.err{border-color:rgba(218,70,70,.5);color:#d94b4b}
      .lbsm-ok{background:rgba(44,168,110,.1);border:1px solid rgba(44,168,110,.25);border-radius:10px;color:#2a9b67;font-size:12px;line-height:18px;padding:10px 12px;white-space:pre-wrap;word-break:break-word}
      .lbsm-error{background:rgba(218,70,70,.1);border:1px solid rgba(218,70,70,.25);border-radius:10px;color:#d94b4b;font-size:12px;line-height:18px;padding:10px 12px;white-space:pre-wrap;word-break:break-word}
      .lbsm-help{background:var(--dsw-alias-bg-layer-2);border-radius:10px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px;padding:10px 12px}
      .lbsm-empty{align-items:center;color:var(--dsw-alias-label-secondary);display:flex;justify-content:center;min-height:140px;text-align:center}
      .lbsm-check{display:flex;align-items:center;gap:6px;font-size:13px}
      .lbsm-dot{border-radius:50%;display:inline-block;height:7px;margin-right:6px;width:7px}
      .lbsm-dot[data-state=active]{background:#2a9b67}
      .lbsm-dot[data-state=failed]{background:#d94b4b}
      .lbsm-dot[data-state=pending]{background:#d49a29}
      .lbsm-dot[data-state=null]{background:var(--dsw-alias-label-quaternary)}
      @media(max-width:760px){.lbsm-form-grid{grid-template-columns:1fr!important}}
      .lbsm-form-grid{display:grid;grid-template-columns:minmax(200px,1.2fr) minmax(200px,1fr) 120px 110px;gap:8px;align-items:end}
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

    /* ─────────────────────────── 市场浏览 ─────────────────────────── */
    function BrowseTab({ refreshInstalled }) {
      const [form, setForm] = useState({ keywords: "", regex: "", field: "any", sort: "stars", maxResults: 50 });
      const [result, setResult] = useState(null);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [installed, setInstalled] = useState([]);
      const [installing, setInstalling] = useState("");
      const [installResult, setInstallResult] = useState(null);

      const loadInstalled = useCallback(async () => {
        try {
          const data = await request("/installed");
          setInstalled(data.items || []);
        } catch {}
      }, []);
      useEffect(() => { loadInstalled(); }, [loadInstalled]);

      const search = async (event) => {
        event?.preventDefault();
        setBusy(true);
        setError("");
        setResult(null);
        try {
          const params = new URLSearchParams();
          if (form.keywords) params.set("keywords", form.keywords);
          if (form.regex) params.set("regex", form.regex);
          params.set("field", form.field);
          params.set("sort", form.sort);
          params.set("maxResults", String(form.maxResults));
          const data = await request(`/search?${params.toString()}`);
          setResult(data);
        } catch (err) {
          setError(err.message || String(err));
        } finally {
          setBusy(false);
        }
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

      return h("form", { className: "lbsm-stack", onSubmit: search },
        h("div", { className: "lbsm-form-grid" },
          h(Field, { label: "关键词（GitHub 搜索，可留空）" },
            h("input", { className: "lbsm-input", value: form.keywords, placeholder: "如：market、vision、store",
              onChange: (event) => setForm({ ...form, keywords: event.target.value }) })),
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
        ),
        h("div", { className: "lbsm-row" },
          h(Field, { label: "排序", style: { width: 140 } },
            h("select", { className: "lbsm-select", value: form.sort, onChange: (event) => setForm({ ...form, sort: event.target.value }) },
              h("option", { value: "stars" }, "⭐ 星数"),
              h("option", { value: "forks" }, "Fork 数"),
              h("option", { value: "updated" }, "最近更新"))),
          h(Button, { type: "submit", disabled: busy, style: { marginTop: 18 } }, busy ? "搜索中…" : "搜索市场"),
          result ? h("span", { className: "lbsm-meta" }, `市场共 ${result.total} 个插件，命中 ${result.matched} 个`) : null),
        error ? h("div", { className: "lbsm-error" }, error) : null,
        installResult ? h("div", { className: "lbsm-ok" }, installResult.message + (installResult.restartRequired ? "\n⚠️ 重启 dsh web / 劳博士 Studio 后生效。" : "")) : null,
        result && result.items.length === 0 ? h("div", { className: "lbsm-empty" }, "没有匹配的插件，试试放宽关键词或正则。") : null,
        result && result.items.length > 0
          ? h("div", { className: "lbsm-table-wrap" },
              h("table", { className: "lbsm-table" },
                h("thead", null, h("tr", null,
                  h("th", null, "插件"),
                  h("th", null, "描述"),
                  h("th", null, "⭐"),
                  h("th", null, "状态"),
                  h("th", null, "操作"))),
                h("tbody", null, result.items.map((item) =>
                  h("tr", { key: item.fullName },
                    h("td", null,
                      h("div", { className: "lbsm-name" }, h("a", { href: item.htmlUrl, target: "_blank", rel: "noreferrer" }, item.fullName)),
                      h("div", { className: "lbsm-meta" }, item.license ? `license: ${item.license} · 更新 ${item.updatedAt.slice(0, 10)}` : `更新 ${item.updatedAt.slice(0, 10)}`)),
                    h("td", null, h("div", { className: "lbsm-desc" }, item.description || "—")),
                    h("td", null, String(item.stars)),
                    h("td", null, isInstalled(item)
                      ? h("span", { className: "lbsm-badge ok" }, "已安装")
                      : h("span", { className: "lbsm-badge" }, "未安装")),
                    h("td", null,
                      h(Button, { secondary: true, disabled: installing === item.fullName, onClick: () => install(item) },
                        installing === item.fullName ? "安装中…" : "安装")))))))
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
      return h("div", { className: "lbsm-stack" },
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

      return h("form", { className: "lbsm-stack", onSubmit: submit },
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
      return h("form", { className: "lbsm-stack", onSubmit: save },
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
      { id: "browse", label: "市场浏览" },
      { id: "installed", label: "已安装" },
      { id: "upload", label: "上传发布" },
      { id: "settings", label: "设置" },
    ];

    function MarketPage() {
      const [tab, setTab] = useState("browse");
      const [status, setStatus] = useState(null);
      useEffect(() => {
        request("/status").then(setStatus).catch(() => {});
      }, []);
      return h("div", { className: "lbsm-page" },
        h("div", { className: "lbsm-head" },
          h("div", null,
            h("div", { className: "lbsm-title" }, "劳博士插件市场"),
            h("div", { className: "lbsm-sub" }, "查询（正则筛选）· 下载安装 · 上传发布 —— GitHub dsh-plugin 生态")),
          status ? h("span", { className: "lbsm-brand" }, `gh ${status.ghCli ? "✓" : "✗"} · token ${status.ghTokenConfigured ? "✓" : "✗"} · ${status.profile || "web"} profile`) : null),
        h("div", { className: "lbsm-tabs" }, TABS.map((item) =>
          h("button", { key: item.id, type: "button", className: "lbsm-tab", "data-active": tab === item.id, onClick: () => setTab(item.id) }, item.label))),
        tab === "browse" ? h(BrowseTab, null)
          : tab === "installed" ? h(InstalledTab, null)
          : tab === "upload" ? h(UploadTab, null)
          : h(SettingsTab, null));
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
