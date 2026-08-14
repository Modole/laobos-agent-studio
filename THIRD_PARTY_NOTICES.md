# 第三方软件声明

劳博士包含或依赖第三方软件。第三方组件不受本项目 PolyForm Noncommercial License 重新许可，而是继续适用各自的许可证。安装依赖或分发桌面包时，应同时保留相应包内的许可证和版权声明。

## DeepSeek Harness

- Package: `@deepseek-ai/dsh` 0.1.0-rc.6
- Project: <https://github.com/deepseek-ai/deepseek-harness>
- License: MIT
- Copyright: Copyright (c) 2026 DeepSeek

劳博士基于 DeepSeek Harness 构建，但不是 DeepSeek 官方产品，也不代表双方存在认可、合作或隶属关系。

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 劳博士插件市场

- Package: `@laobos/dsh-market` 0.1.0
- Source snapshot: <https://github.com/Modole/dsh-plugin-market-laoboshi/commit/077e58c6c71224a855ae55a010ddb7bc680862af>
- Vendored path: `packages/laobos-market`
- License: MIT
- Copyright: Copyright (c) 2026 Modole (laoboshi)

完整 MIT 许可文本保存在 `packages/laobos-market/LICENSE`。该目录继续按 MIT 许可发布，不受本项目 PolyForm 非商业限制重新许可。

## 其他 npm 依赖

完整依赖及锁定版本见 `package.json` 和 `package-lock.json`。各依赖的许可证文本会在 `npm install` 后位于对应的 `node_modules/<package>/LICENSE*` 文件中；Electron 桌面分发物还包含 Electron/Chromium 随附的许可证文件。分发者有责任核对并保留所有适用声明。
