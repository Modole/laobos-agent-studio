#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const checks = [
  {
    label: "ripgrep ASAR 路径补丁",
    entry: require.resolve("@vscode/ripgrep"),
    pattern: /physicalAsarPath\(require\.resolve/u,
  },
  {
    label: "ssh2 Pageant ASAR 路径补丁",
    entry: path.join(path.dirname(require.resolve("ssh2")), "agent.js"),
    pattern: /const EXEPATH = physicalAsarPath\(/u,
  },
  {
    label: "Landlock ASAR 路径补丁",
    entry: require.resolve("@deepseek-ai/node-addon-landlock-run"),
    pattern: /return physicalAsarPath\(join\(/u,
  },
  {
    label: "设置面板状态保活补丁",
    entry: require.resolve("@deepseek-ai/dsh-client-ui-settings-general/client"),
    pattern: /(?=[\s\S]*const \[hasOpened, setHasOpened\])(?=[\s\S]*visitedIds)(?=[\s\S]*"data-open": open)/u,
  },
  {
    label: "对话回合变更摘要插槽补丁",
    entry: require.resolve("@deepseek-ai/dsh-client-ui-conversation/client"),
    pattern: /(?=[\s\S]*conversation\.chat\.turnSummary)(?=[\s\S]*fallback: tail)/u,
  },
  {
    label: "文件编辑命令增删行统计补丁",
    entry: require.resolve("@deepseek-ai/dsh-client-ui-tool/client"),
    pattern: /(?=[\s\S]*function diffSummarySuffix)(?=[\s\S]*model\.state === "ok")(?=[\s\S]*data-diff-additions)(?=[\s\S]*--dsw-alias-state-success-primary)(?=[\s\S]*data-diff-deletions)(?=[\s\S]*--dsw-alias-state-error-primary)(?=[\s\S]*summarySuffix)/u,
  },
];

export async function verifyRuntimePatches() {
  for (const check of checks) {
    const source = await readFile(check.entry, "utf8");
    if (!check.pattern.test(source)) {
      throw new Error(`${check.label}未应用：${check.entry}`);
    }
  }
  return { patchCount: checks.length };
}

const isCommandLineEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCommandLineEntry) {
  const result = await verifyRuntimePatches();
  console.log(`运行时补丁校验通过：${result.patchCount} 项。`);
}
