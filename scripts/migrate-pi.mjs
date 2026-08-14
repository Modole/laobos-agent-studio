#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { inspectPiData, migratePiData } from "../migrations/pi-data.mjs";
import { defaultDshHome } from "../migrations/auto-pi.mjs";

const arguments_ = process.argv.slice(2);
const apply = arguments_.includes("--apply");
const force = arguments_.includes("--force");

function option(name, fallback) {
  const index = arguments_.indexOf(name);
  if (index === -1) return fallback;
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} 需要路径参数。`);
  return path.resolve(value);
}

const piHome = option("--pi-home", path.join(os.homedir(), ".pi", "agent"));
const dshHome = option("--dsh-home", defaultDshHome());
const inspection = await inspectPiData(piHome);

if (!inspection.found) {
  throw new Error(`找不到 Pi 数据目录：${piHome}`);
}

if (!apply) {
  console.log("Pi → DSH 迁移预检（尚未写入）：");
  console.log(`  Pi 数据目录：${piHome}`);
  console.log(`  DSH 目标目录：${dshHome}`);
  console.log(`  模型凭据：${inspection.providers} 个`);
  console.log(`  历史会话：${inspection.sessions} 个`);
  console.log(`  SYSTEM：${inspection.hasSystemPrompt ? "有" : "无"}`);
  console.log(`  MEMORY：${inspection.hasMemory ? "有" : "无"}`);
  console.log(`  附件：${inspection.hasAttachments ? "有" : "无"}`);
  console.log(`  知识库/工作流：${inspection.hasSystemTools ? "有" : "无"}`);
  console.log("确认后追加 --apply；已有 DSH 值默认保留，--force 才覆盖同名配置。");
} else {
  const result = await migratePiData({ piHome, dshHome, force });
  console.log("Pi → DSH 迁移完成：");
  console.log(`  Settings 写入：${result.settings.changed} 项`);
  console.log(`  凭据写入：${result.credentials.changed} 项（值未输出）`);
  console.log(`  Skills：${result.skills.copied} 个`);
  console.log(`  会话：导入 ${result.sessions.imported}，跳过 ${result.sessions.skipped}`);
  console.log(`  附件：${result.attachments.copied ? "已复制" : "无变化"}`);
  console.log(
    `  知识库/工作流：${result.systemTools.copied ? "已快照迁移" : "无变化"}`,
  );
  if (result.sessions.failed.length > 0) {
    console.log(`  会话失败：${result.sessions.failed.length} 个；详情见迁移 manifest。`);
    process.exitCode = 2;
  }
}
