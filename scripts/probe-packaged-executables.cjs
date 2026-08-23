/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");

const appAsar = path.resolve(process.argv[2] || "");
assert.equal(path.basename(appAsar), "app.asar", "需要传入打包后的 resources/app.asar");

const requireFromApp = createRequire(path.join(appAsar, "package.json"));
const { rgPath } = requireFromApp("@vscode/ripgrep");
const unpackedBoundary = `.asar.unpacked${path.sep}`;

assert.ok(
  rgPath.includes(unpackedBoundary),
  `ripgrep 必须解析到 app.asar.unpacked，实际为：${rgPath}`,
);
assert.ok(fs.existsSync(rgPath), `ripgrep 真实文件不存在：${rgPath}`);

const ripgrep = spawnSync(rgPath, ["--version"], {
  encoding: "utf8",
  windowsHide: true,
});
if (ripgrep.error) throw ripgrep.error;
assert.equal(
  ripgrep.status,
  0,
  `ripgrep 启动失败（status=${String(ripgrep.status)}）：${ripgrep.stderr}`,
);
assert.match(ripgrep.stdout, /^ripgrep\s/u);

if (process.platform === "win32") {
  const ssh2Entry = requireFromApp.resolve("ssh2");
  const agentPath = path.join(path.dirname(ssh2Entry), "agent.js");
  const agentSource = fs.readFileSync(agentPath, "utf8");
  assert.match(
    agentSource,
    /const EXEPATH = physicalAsarPath\(/u,
    "ssh2 Pageant 启动路径未应用 ASAR 解包修复",
  );
  const pagentPath = path.resolve(path.dirname(ssh2Entry), "..", "util", "pagent.exe")
    .replace(/\.asar([\\/])/u, ".asar.unpacked$1");
  assert.ok(fs.existsSync(pagentPath), `ssh2 Pageant 辅助程序不存在：${pagentPath}`);
}

if (process.platform === "linux") {
  const { launcherPath } = requireFromApp("@deepseek-ai/node-addon-landlock-run");
  const landlockPath = launcherPath();
  assert.ok(
    landlockPath.includes(unpackedBoundary),
    `Landlock 必须解析到 app.asar.unpacked，实际为：${landlockPath}`,
  );
  assert.ok(fs.existsSync(landlockPath), `Landlock 启动器不存在：${landlockPath}`);
}

console.log(`打包可执行组件启动校验通过：${ripgrep.stdout.trim().split("\n")[0]}`);
