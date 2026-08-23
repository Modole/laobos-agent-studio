# 劳博士跨平台桥接

该内置插件让同一套 `window.laobosDesktop` 调用契约同时运行在 Electron 与本机浏览器中：

- Electron 渲染器继续使用受限 preload IPC；
- 浏览器使用同源、仅回环地址可访问的 HTTP RPC；
- 终端、SSH 与应用事件通过带游标的长轮询传输；
- 文件操作始终限制在当前 DSH 工作区，上传和 SSH 传输带数量与大小上限；
- 内置浏览器、自动更新、系统 Shell 管理等 Electron 专属能力明确标记为不可用。

浏览器 SSH 凭据使用 DSH Home 下仅当前用户可读的随机密钥加密，与桌面系统安全存储相互隔离。
