# 劳博士

> [!IMPORTANT]
> 本仓库采用“源代码开放（source-available）、仅限非商业用途”的方式发布。它不属于 OSI 认证的开源软件；商业使用必须事先取得单独授权。完整条款见 [LICENSE](LICENSE)。

劳博士的 Agent 主引擎已经替换为 DeepSeek Harness（DSH）。开发服务与 Electron 桌面端都直接启动官方 DSH Web UI，不再经过 Pi Bridge；原 Vinext 界面和 Pi Bridge 源码仅作为兼容层保留。

## 当前主链路

```text
DSH 官方 Web UI
      │  loopback HTTP
      ▼
DeepSeek Harness 0.1.0-rc.6
      ├─ Agent presets（标准 / PTC / 极简 / 创造）
      ├─ Sandbox + Approval + Permission presets
      ├─ Plan 模式安全联动
      └─ 劳博士项目资源插件（知识库 / 工作流 / Skills / MCP）
```

DSH 只监听本机回环地址。Electron 使用随机端口启动运行时，渲染进程保持 `sandbox: true`、`nodeIntegration: false`，并拒绝网页权限请求。

## 开发启动

```bash
npm install
npm run dev
```

默认工作区是 `pi-client` 的上级项目目录。也可以显式指定工作区或让 DSH 选择随机端口：

```bash
npm run dev -- --workspace /absolute/path/to/project --port 0
```

Electron 开发模式：

```bash
npm run desktop:dev
```

## 桌面安装包

公开发布提供两个原生安装包：macOS Apple 芯片版（DMG）与 Windows x64 版（NSIS EXE）。两者都由 GitHub Actions 在对应系统的原生 Runner 上构建，避免原生模块交叉编译导致不兼容。

```bash
# macOS Apple Silicon
npm run desktop:installer -- --mac dmg --arm64

# Windows x64
npm run desktop:installer -- --win nsis --x64
```

当前公开构建未配置 Apple Developer ID 或 Windows Authenticode 证书，因此首次安装会出现系统的“未知开发者/未知发布者”安全提示；发布页同时提供 SHA-256 校验值用于核对文件完整性。签名证书和密码只允许通过 CI Secret 注入，禁止提交到仓库。

常用诊断：

```bash
npm run dump-config
npm run test:dsh
npm test
npm run lint
```

## 四种 Agent 模式

项目直接使用 DSH 官方 presets：

| preset | 界面名称 | 适用场景 |
| --- | --- | --- |
| `standard` | 标准模式 | 通用 Agent 工作 |
| `code` | PTC 模式 | 代码与工具密集任务 |
| `minimal` | 极简模式 | 更少上下文与更轻执行 |
| `cordis` | 创造模式 | Cordis / 创造型工作流 |

模式选择、会话、模型配置和运行状态均由 DSH 官方 UI 管理。

## 安全审批

`config/laobos.cordis.patch.yml` 提供三档权限预设：

| preset | 沙箱 | 审批策略 |
| --- | --- | --- |
| `read-only` | 只读 | 越权操作询问 |
| `workspace-write` | 工作区可写 | 敏感操作询问（默认） |
| `danger-full-access` | 完全访问 | 不询问，仅限可信环境 |

进入 Plan 模式会强制切换到 `read-only`；退出 Plan 后恢复进入前的权限。状态来自 DSH 会话事件，因此恢复会话或重启后仍可正确联动。

## Pi 数据迁移

首次启动时，如果发现 `~/.pi/agent` 且 DSH 尚无迁移 manifest，会自动迁移，并保留原 Pi 数据不动。迁移内容包括：

- Provider 配置与 API Key（写入 DSH 凭据文件，不打印明文）
- 默认模型与推理级别
- SYSTEM、MEMORY、Skills 与附件
- Pi JSONL 历史会话到 DSH 原生会话
- 原知识库与工作流 SQLite 快照

手动预检和执行：

```bash
npm run migrate:pi
npm run migrate:pi -- --apply
```

已有 DSH 配置默认不会覆盖；只有显式追加 `--force` 才覆盖同名配置。

macOS 默认数据目录：

```text
~/Library/Application Support/劳博士/dsh
```

可通过 `LAOBOS_DSH_HOME` 指定其他目录，通过 `LAOBOS_WORKSPACE` 指定默认工作区。

## 项目侧栏与资源管理

`@laobos/dsh-system-tools` 作为 DSH 插件运行。官方会话栏保持在左侧；项目导航固定在最右侧，与中间工作区组成三列布局。右栏折叠时保留 56px 图标轨道，展开宽度默认为 224px，并可在 200–300px 之间拖动调整。点击“对话、工作流、知识库、Skills、MCP、设置”都会复用中间工作区进行独立页面切换；设置页包含系统提示词编辑，以及可直达模型、Agent 预设、安全审批、插件分区的 DSH 系统设置入口；原左侧设置入口已迁移到右栏底部。

- 本地 SQLite + FTS 全文检索，支持自然问句拆词、标题加权和相邻片段扩展
- Agent 可按需自动创建、读取和更新知识；删除经过 DSH 审批，暂停的知识库不会被全局搜索访问
- Agent 默认把知识写入当前工作区；只有明确的跨项目知识才进入全局作用域
- 知识库页面保持轻量插件形态，支持召回测试、资料编辑、重新索引、启停和删除
- DAG 工作流由 Agent 通过 `workflow_manager` 创建、读取、更新、测试、发布和启停，删除经 `workflow_delete` 审批
- 工作流页面使用纯列表和 SVG 快捷操作；查看、编辑会打开弹窗，用户可在弹窗内查看流程图、微调节点、试运行、发布版本、启停和删除，不提供手动新建入口
- 首次发布会自动启用并注册为 DSH Agent 工具；后续发布保留用户设置的启停状态
- 已发布工作流同时投影到“设置 > Plugins > Agent 自动化”虚拟插件页，任一侧启停或删除都会同步
- Skills 以名称、简介、范围、状态和实际文件位置的管理表展示；默认管理 DSH 原生目录，可按需查看 `.agents/skills` 兼容内容，并支持一键复制位置、启停、删除和 DSH 热更新
- MCP 支持 stdio 与 streamable HTTP，以 Server、连接方式、连接目标、工具数量和连接状态的管理表展示；可启停、重连和删除，密钥只以遮罩返回界面
- 插件市场源码内置于 `packages/laobos-market`，可在“设置 > 插件市场”搜索、安装和管理带有 `dsh-plugin` topic 的插件；代理地址和上传账号默认留空，由使用者自行配置
- 管理页支持右栏折叠按钮、再次点击当前菜单项、页面“收起”按钮和 Esc 快速返回对话；未保存的 Skills/MCP 修改会先确认
- 设置中的“系统提示词”默认展示可编辑的“劳博士”身份，以 `order: 39` 注册在 preset persona 与旧迁移指令之后、工具说明之前；用户修改姓名或角色后会覆盖冲突设定，不会保留旧名称作为别名
- 实体插件清单与虚拟工作流插件统一使用 DSH 官方“设置 > Plugins”页面，不占用项目主侧栏
- HTTP 管理接口只接受本机请求并校验 Origin

数据位于 DSH Home 的 `data/system-tools.db`。

## 桌面增强与插件

桌面版把右侧项目栏分成“对话 / 工作台 / 集成管理”三组，并把高权限能力收敛到 Electron 主进程。网页侧只能调用经过校验的最小化 preload API，文件路径会做工作区边界、真实路径和符号链接检查。

- 会话：编辑上一轮并从稳定边界创建分支、重试上一轮、完整分页导出 PDF、重命名和可恢复删除
- 右键菜单：工作区可打开文件管理器、Git 审查和终端；会话可打开、编辑、重试、导出、重命名和删除
- 文件工作台：目录浏览、文本/图片/PDF/音视频预览和 Finder 定位；敏感文件名、二进制内容和超大文件会被限制
- 版本中心：状态与 staged/unstaged diff、未跟踪文件预览、提交历史、初始化、暂存、提交、分支管理，以及需确认的恢复和远端同步；桌面 UI 与 Agent 共用结构化 Git 服务
- 文件上传：图片继续使用 DSH 原生图片附件；普通文件通过输入框回形针选择，复制到受管目录后以文件 Chip 显示，并把受管副本的绝对路径封装进提示词
- 上传路径：在“设置 > 文件上传”中选择“默认”或“工作区内”；默认写入 DSH Home 的 `uploads/v1`，后者使用当前工作区的 `update` 文件夹
- 终端插件：基于 `node-pty` 与 xterm；每个标签使用独立的稳定命名 tmux 会话，打开或重连时自动回到当前工作区，未安装 tmux 时明确提示并回退到登录 Shell
- 浏览器插件：使用隔离的 `WebContentsView` 预览 HTTP(S) 地址；BrowserOps daemon 仅在用户点击后启动，并可随时停止
- SSH 插件：密码和私钥使用系统 `safeStorage` 加密，主机密钥采用 TOFU 校验，发生变更时阻止连接
- 应用管理插件：登记、探测、启动、停止和查看日志；进程始终以 `shell: false` 启动，“移出管理”不会删除项目文件

删除的会话会先归档，再移动到 DSH Home 下的劳博士回收站；不会直接永久擦除。Terminal、BrowserOps、SSH 和应用管理均为独立 DSH 客户端插件，配置位于 `config/laobos.cordis.patch.yml`。修改终端或 SSH 的 JSX 源码后，可单独重建浏览器插件：

```bash
npm run build:desktop-plugins
```

## 兼容入口

旧代码没有删除，但不再是默认 Agent 引擎：

```bash
npm run site:dev             # 原 Vinext 管理界面
npm run pi:bridge            # 原 Pi Bridge
npm run pi:dev               # 原 Pi Bridge + Vinext 全量开发
```

## 桌面打包

```bash
npm run desktop:package
npm run desktop:make
```

桌面包会携带 DSH 及其运行依赖，不再打包或查找 Pi 二进制。macOS 签名身份可通过 `LAOBOS_CODESIGN_IDENTITY` 设置；未设置时使用临时签名。

## 发布与隐私检查

用户创建的 API Key、工作区选择、会话、知识库、工作流数据和 SSH 配置均属于本机运行数据，不是本仓库源码的一部分。桌面版数据默认保存在系统的应用数据目录；开发模式的 `.dsh`、`.pi`、数据库、JSONL、SSH 凭据和环境变量文件已加入 `.gitignore`。

公开提交前请执行：

```bash
npm run audit:public
```

该检查会扫描所有待提交源码，阻止常见真实密钥、私钥块、本机绝对路径，以及数据库、会话和 SSH 配置等高风险文件进入版本库。它不能替代密钥轮换；如果密钥曾被提交到任何远端，应立即撤销并重新生成。

## 贡献

提交 Issue 或代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请遵循 [SECURITY.md](SECURITY.md)，不要在公开 Issue 中披露漏洞或凭据。

## 许可与非商业声明

本项目自有代码和自有资源采用 [PolyForm Noncommercial License 1.0.0](LICENSE)：

- 允许符合许可定义的个人学习、研究、实验和非商业组织使用。
- 允许在许可范围内修改和再分发，但必须保留许可条款及 Required Notice。
- 任何商业使用、预期商业应用或商业分发均须另行取得书面授权。
- “劳博士”名称、Logo 和其他品牌标识不因源码许可而授予商标权。

第三方组件以及内置插件市场继续适用各自的许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。如本说明与 LICENSE 冲突，以 LICENSE 原文为准。
