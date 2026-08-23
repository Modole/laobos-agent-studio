# 将插件导出为插件包

`@laobos/dsh-plugin-exporter` 是劳博士内置的纯 Host 后台插件。它把当前工作区中的 DSH 插件目录检查并导出为可在劳博士插件管理后台手动上传的 `.tar.gz`。

功能边界：

- 只在本机生成文件，不调用任何上传或发布 API；
- 不注册 Web Client、前台页面或本机 Web API；
- Agent 工具名为 `plugin_package_export`，`inspect` 只读，`export` 需要用户审批；
- 源目录和输出目录必须在当前工作区；
- 默认输出到 `<插件目录>/.laobos-exports`；
- 导出包使用 `package/` 单根目录，并输出 SHA-256；
- 验证规则与劳博士插件平台、客户端安装器保持兼容。

完整的目录规范、制作步骤、手动上传、分组、安装、升级和排错流程见[《DSH 插件包制作、导出与手动上传完整流程》](../../docs/dsh-plugin-package-guide.md)。

本地验证：

```bash
node --test tests/dsh-plugin-exporter.test.mjs
```
