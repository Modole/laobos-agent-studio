# 安全策略

## 报告漏洞

请通过 GitHub 的 [Private Vulnerability Reporting](https://github.com/Modole/laobos-agent-studio/security/advisories/new) 私下报告安全问题。不要在公开 Issue、讨论区、日志或截图中提交漏洞细节、API Key、访问令牌、SSH 私钥或个人数据。

报告中请包含受影响版本、复现条件、预期影响和尽可能精简的复现步骤。请先删除或替换所有真实凭据和个人路径。

## 支持范围

当前仅维护公开仓库默认分支上的最新版本。安全修复会在完成验证后发布；具体响应和修复时间不作保证。

## 凭据泄露

如果凭据曾进入 Git 历史、Issue、构建日志或发布包，请立即在对应服务撤销并轮换。仅删除文件或提交并不能使已公开的凭据恢复安全。

## 软件更新与发布完整性

桌面客户端只从固定的劳博士 GitHub Release 仓库读取更新。渲染进程不能指定任意下载地址或安装路径，安装资产通过 `latest*.yml` 中的 SHA-512 和 Release 的 SHA-256 清单校验。

正式 macOS 包必须使用 Apple Developer ID 签名并完成公证；正式 Windows 包必须使用 Authenticode。ad-hoc 或未签名构建只允许用于受控测试，不能被描述为可信生产发行版。发现 Release 资产、更新元数据、签名或校验和不一致时，应立即停止发布和更新测试，替换资产并从公网重新下载复核。详细流程见[桌面打包与应用内更新手册](docs/desktop-release-playbook.md)。
