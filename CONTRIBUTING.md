# 为劳博士贡献

感谢你帮助改进劳博士。提交贡献即表示你已阅读并接受以下约定。

## 开始之前

1. 先搜索现有 Issue，避免重复工作；较大改动建议先开 Issue 说明目标和设计。
2. 不要提交 API Key、令牌、工作区内容、会话、知识库、工作流实例数据、SSH 配置、私钥、数据库或本机绝对路径。
3. 新增依赖前确认许可证与本项目的非商业发布方式兼容，并在必要时更新 `THIRD_PARTY_NOTICES.md`。

## 本地检查

```bash
npm install
npm run lint
npm test
npm run audit:public
```

Pull Request 应说明改动目的、用户影响、验证方式，以及是否涉及数据迁移、权限、网络访问或依赖许可。

## 桌面与发布改动

涉及 Electron、DSH 内置插件、安装器、平台原生依赖或更新器时，请先阅读[桌面打包与应用内更新手册](docs/desktop-release-playbook.md)，并满足以下要求：

- 插件运行时资源必须放在插件自身目录，不能跨目录引用根 `public/` 或开发机路径。
- Windows 原生依赖必须在 `app.asar.unpacked` 中验证真实的 x64 PE 文件，不能只检查 package.json。
- macOS 更新必须验证基线版与新版的完整签名和 designated requirement。
- 修改功能、架构或发布流程时同步更新 `README.md`、`docs/` 中对应文档及必要的回归测试。
- Release 先使用草稿聚合资产，安装器和 blockmap 上传成功后再发布 `latest*.yml`。

## 贡献许可

提交代码、文档或资源即表示：

- 你有权提交该内容，且该内容不侵犯第三方权利；
- 你同意按本仓库根目录 `LICENSE` 中相同的 PolyForm Noncommercial License 1.0.0 条款许可你的贡献；
- 你理解本项目是仅限非商业用途的 source-available 项目，而不是 OSI 认证的开源项目。

项目维护者可拒绝包含凭据、个人数据、来源不明素材或不兼容许可证内容的贡献。
