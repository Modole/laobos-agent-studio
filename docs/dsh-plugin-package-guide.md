# DSH 插件包制作与本地导出流程

劳博士插件导出器生成 gzip 压缩的 TAR 制品，文件扩展名为 `.tar.gz`。制品只有一个 `package/` 顶层目录：

```text
my-plugin-1.0.0.tar.gz
└─ package/
   ├─ package.json
   ├─ lib/
   │  ├─ index.js       # DSH Host 入口
   │  └─ client.js      # 可选的 Web Client 入口
   ├─ README.md
   └─ 其他运行时资源
```

劳博士内置的纯后台插件“将插件导出为插件包”负责检查目录并生成上述制品。它没有前台页面或 Web API，只能由当前会话中的 Agent 调用；它只写本地文件，不登录账号、不上传、不发布。导出的归档可以自行校验、留存，或通过你选择的公开渠道分发。

## 一、准备 DSH 插件目录

一个最小的 Host + Web Client 插件可以使用以下结构：

```text
my-dsh-plugin/
├─ package.json
├─ README.md
├─ src/
│  └─ client.jsx        # 如果使用 JSX，可保留源码
└─ lib/
   ├─ index.js           # 必须已经可由 Node.js 直接加载
   └─ client.js          # 必须已经构建成浏览器可加载文件
```

导出的是运行制品，不是构建任务。`exports` 指向的 Host 和 Client 文件在导出前必须已经存在；如果 Client 使用 JSX、TypeScript 或 CSS import，应先在插件项目里执行自己的构建命令。

### package.json 示例

```json
{
  "name": "@your-company/dsh-example",
  "version": "1.0.0",
  "description": "示例 DSH 插件",
  "license": "MIT",
  "type": "module",
  "main": "./lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-runtime"
      ],
      "platform": "web"
    }
  }
}
```

关键规则：

1. `name` 使用合法 npm 包名，支持 `@scope/name`；它也是插件安装后的模块名。
2. `version` 每次发布新版本时必须递增，建议使用 SemVer，例如 `1.0.0`、`1.0.1`。
3. Host 入口取 `exports["."]`，没有时回退到 `main`；入口必须在插件目录中并实际存在。
4. 声明 `dsh.client.platform: "web"` 时，必须同时提供 `exports["./client"]`。
5. `dsh.client.inject` 只能是字符串数组，`dsh.client.immediately` 如果存在必须是布尔值。

### Host 入口示例

```js
export const name = "dsh-example";
export const inject = ["tools"];

export function apply(ctx) {
  // 在这里注册 Host 服务、工具或生命周期逻辑。
}
```

### Web Client 入口示例

Client bundle 必须通过 DSH 模块加载器注册，并且 `id` 与 `package.json.name` 完全一致：

```js
window.__ModuleLoader__.load({
  id: "@your-company/dsh-example",
  factory: () => ({
    inject: ["slots"],
    apply(ctx) {
      // 在这里注册设置页、工作台页面或其他 Client 插槽。
    }
  })
});
```

导出器会检查 `__ModuleLoader__.load` 和同名 `id`。这样可以在生成归档之前发现“Host 安装成功但 Client 无法加载”的常见错误。

## 二、通过劳博士后台工具检查并导出

1. 启动劳博士，并把插件项目自身或其上级目录设为当前工作区。
2. 直接在对话中告诉劳博士：

> 检查 `packages/my-dsh-plugin`，通过后把它导出为插件包。

3. Agent 使用后台工具 `plugin_package_export`，先执行只读的 `inspect`。检查不通过时，Agent 会报告需要修复的结构问题，不会生成归档。
4. 检查通过后，Agent 发起 `export` 写文件审批。确认框会列出插件目录、输出目录和导出原因；只有用户允许后才会写入文件。
5. 导出成功后，Agent 在对话中返回 `.tar.gz` 的绝对路径、工作区相对路径、文件大小和 SHA-256。请保存哈希并通过你信任的渠道分发归档。

插件路径必须相对于当前工作区：插件就是工作区根目录时使用 `.`；位于子目录时使用类似 `packages/my-dsh-plugin`。默认输出到 `<插件目录>/.laobos-exports/`，默认文件名为 `<包名>-<版本>.tar.gz`，例如 `your-company-dsh-example-1.0.0.tar.gz`。

后台工具参数如下：

| 参数 | 说明 |
| --- | --- |
| `action` | `inspect` 只检查，`export` 生成归档；应先检查再导出。 |
| `sourceDir` | 当前工作区内的插件相对路径，默认 `.`。 |
| `outputDir` | 当前工作区内的输出目录；不填时使用插件目录下的 `.laobos-exports/`。 |
| `outputName` | 可选的 `.tar.gz` 文件名；不填时根据包名和版本生成。 |
| `overwrite` | 是否事务替换同名旧归档，默认 `false`。 |
| `reason` | `export` 必填，用于审批时解释写文件原因。 |

同名文件默认不会覆盖。只有明确要求 `overwrite: true` 并批准导出时才会事务替换：新包完整生成并校验后才替换旧文件。该插件没有前台入口、上传接口或发布权限。

## 三、导出器会自动检查什么

导出成功表示制品满足插件归档的基础结构与安全约束：

- 归档只有一个 `package/` 根目录；
- `package.json` 是普通文件、合法 JSON，并且不超过 1 MiB；
- 包名、版本、Host 入口和可选 Client 入口有效；
- Web Client 注册的模块 ID 与包名一致；
- 所有路径都能在 Windows、macOS 和 Linux 安全使用；
- 不包含绝对路径、路径穿越、大小写/Unicode 冲突路径；
- 不包含符号链接、硬链接、设备、FIFO、稀疏文件或其他特殊文件；
- 最多 2,000 个 TAR 条目、解压文件总量最多 64 MiB、压缩包最多 8 MiB；
- 文件按稳定顺序写入，时间、UID 和 GID 固定，便于重复导出和哈希核对。

以下内容默认不会进入插件包：

- `node_modules`、`.git`、`.svn`、`.hg`、`.next`、`.turbo`、`coverage`；
- `.env`、`.env.*`、`.npmrc`、`.pypirc`、常见私钥和密码文件；
- `.db`、`.sqlite*`、`.log`、`.pem`、`.key`、`.p12`、`.pfx`；
- `.DS_Store`、`Thumbs.db`、`__MACOSX` 和 AppleDouble 文件；
- 已有 `.tar.gz`、`.tgz`、`.zip` 归档和 `.laobos-exports` 输出目录。

如果运行时确实需要某个被安全规则排除的文件，不要改成绕过规则。应把非秘密的必要内容转换成明确的静态资源格式，并修改插件入口去读取该资源。

## 四、发布新版本

1. 修改代码并完成插件自己的构建、测试。
2. 递增 `package.json.version`，不要使用同一版本号表示不同内容。
3. 再次让 Agent 先检查插件，再通过后台工具导出 `.tar.gz`。
4. 保留每个发布制品的 SHA-256、源码提交号和测试记录，便于回滚与审计。
5. 接收方安装前应再次核对 SHA-256，并检查归档中的包名、版本与入口。

## 五、常见错误

| 错误 | 原因与处理 |
| --- | --- |
| `PACKAGE_JSON_MISSING` | 所选目录不是插件根目录；应选择直接包含 `package.json` 的目录。 |
| `PACKAGE_HOST_MISSING` | `exports["."]` 或 `main` 指向的构建文件不存在；先运行插件构建。 |
| `PACKAGE_CLIENT_MISSING` | 声明了 Web Client，但 `exports["./client"]` 不存在或文件未构建。 |
| `CLIENT_REGISTRATION_MISMATCH` | Client bundle 没有调用模块加载器，或注册 `id` 与包名不一致。 |
| `PACKAGE_SYMLINK_UNSUPPORTED` | 插件目录包含符号链接；复制实际运行文件并移除链接。 |
| `PACKAGE_PATH_NOT_PORTABLE` | 文件名包含 Windows 保留名、非法字符、尾随空格/点或路径过长。 |
| `PACKAGE_COMPRESSED_LIMIT` | 压缩结果超过 8 MiB；删除不必要源码、测试数据和大型媒体资源。 |
| `OUTPUT_EXISTS` | 同名制品已经存在；递增版本，或明确选择事务覆盖。 |
| `WORKSPACE_BOUNDARY` | 源目录或输出目录不在当前工作区；切换工作区或移动插件目录。 |

不要通过关闭验包或手工修改归档头解决错误。修复插件目录后重新导出，才能保证制品始终使用相同的安全契约。
