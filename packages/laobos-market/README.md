# 劳博士插件市场（dsh-plugin-market-laoboshi）

> 劳博士专属版 DSH 插件市场：在 **DeepSeek Harness (DSH)** 的 Web GUI 与**对话工具**中，一站式完成插件生态的 **查询（正则筛选）· 下载安装 · 上传发布**。

市场数据源为 GitHub 的 [`dsh-plugin` topic](https://github.com/topics/dsh-plugin)（2200+ 插件，持续增长）。

## ✨ 功能

| 功能 | 说明 |
| --- | --- |
| 🔍 查询 + 正则筛选 | 关键词搜索 GitHub `dsh-plugin` 市场（分页拉取、按星数/Fork/更新时间排序），支持对 **仓库名 / owner·仓库 / 描述 / 全部字段** 做正则二次筛选（不区分大小写） |
| 📦 下载安装 | 下载仓库 tarball → 解压到 `<DSH_HOME>/profiles/<profile>/node_modules/<name>` → 在 `cordis.patch.yml` 注册插件条目（幂等去重）→ 提示重启生效；支持 `force` 覆盖 |
| 🚀 上传发布 | 本地插件目录（含 package.json）→ 自动 `git init` / 提交（缺 README、LICENSE 自动生成）→ `gh repo create` 公开/私有仓库并推送 → 自动添加 `dsh-plugin` topic 上架市场 |
| 🤖 对话工具 | 同时注册 `plugin_market_search` / `plugin_market_install` / `plugin_market_upload` 三个工具，在对话中直接操作市场 |
| 🛡 零依赖 | host 端仅使用 Node 内置模块；自带 HTTP 代理（CONNECT 隧道）支持，可走 `http://127.0.0.1:7890` 等本地代理访问 GitHub |

## 📥 安装

### 方式一：dsh CLI

```bash
dsh plugin --profile web add dsh-plugin-market-laoboshi
```

### 方式二：手动安装

```bash
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE=web
mkdir -p "$DSH_HOME/profiles/$PROFILE/node_modules"
git clone --depth 1 https://github.com/Modole/dsh-plugin-market-laoboshi.git \
  "$DSH_HOME/profiles/$PROFILE/node_modules/@laobos/dsh-market"

# 在 $DSH_HOME/profiles/$PROFILE/cordis.patch.yml 中注册（若文件为 [] 则整体替换）：
# - insert:
#     - id: laobos-market
#       name: '@laobos/dsh-market'
```

然后重启 `dsh web`。打开 **设置 → 插件市场** 即可使用。

### 劳博士 Studio（本机部署）

在 `config/laobos.cordis.patch.yml` 的 insert 列表中注册：

```yaml
    - id: laobos-market
      name: '@laobos/dsh-market'
      config:
        proxyUrl: http://127.0.0.1:7890   # 可选：本地代理
        uploadOwner: Modole                # 可选：上传默认 owner
        profile: web
```

## 🧰 使用

**界面（设置 → 插件市场）：**

- **市场浏览**：输入关键词 + 正则（如 `^(dsh|awesome).*market`），选择作用字段与条数，点击搜索；结果表格可一键安装，已安装插件带绿色标识。
- **已安装**：查看当前 profile 全部插件条目与生效状态（含"待重启生效"）。
- **上传发布**：填写本地插件目录、仓库名、简介，勾选是否私有，点击"发布到 GitHub"。
- **设置**：代理地址、GitHub API 地址、上传默认 owner、安装目标 profile。

**对话工具：**

```
plugin_market_search(query="market", regex="^dsh", field="any", sort="stars")
plugin_market_install(owner="dsh-market", repo="dsh-market")
plugin_market_upload(dir="/path/to/plugin", repo="my-plugin", isPrivate=false)
```

## ⚠️ 安全与信任

- 安装即信任：第三方插件会进入你的 profile 并被加载执行。安装前建议先查看目标仓库的 README 与源码。
- 本插件全部操作面向本机 loopback 接口（仅 `127.0.0.1` 可调用），不接受跨域请求。
- 上传发布通过你本机已登录的 `gh` CLI 完成，插件本身不保存、不读取你的 GitHub 凭据。

## 📄 License

MIT
