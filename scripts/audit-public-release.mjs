#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gitFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    { cwd: projectRoot, encoding: "buffer" },
  );
  return output.toString("utf8").split("\0").filter(Boolean).sort();
}

const forbiddenExactNames = new Set([
  "authorized_keys",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "known_hosts",
]);
const forbiddenRootDirectories = new Set([
  ".dsh",
  ".laobos",
  ".pi",
  ".ssh",
  "sessions",
  "uploads",
  "workspaces",
]);
const forbiddenDataExtension = /\.(?:db|db-shm|db-wal|jsonl|key|p12|pem|pfx|sqlite|sqlite3)$/iu;

function forbiddenPathReason(file) {
  const normalized = file.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const basename = parts.at(-1) || "";
  if (forbiddenRootDirectories.has(parts[0])) return `本机运行数据目录 ${parts[0]}`;
  if (parts.some((part) => [".dsh", ".laobos", ".pi", ".ssh"].includes(part))) {
    return "嵌套的本机运行数据目录";
  }
  if (basename === ".env" || basename.startsWith(".env.")) return "环境变量文件";
  if (forbiddenExactNames.has(basename)) return "SSH 凭据或主机配置";
  if (forbiddenDataExtension.test(basename)) return "数据库、会话或凭据文件";
  return "";
}

const contentChecks = [
  {
    label: "完整私钥块",
    pattern: new RegExp(
      "-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\\s\\S]{80,}-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
      "gu",
    ),
  },
  { label: "GitHub Token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu },
  { label: "AWS Access Key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { label: "Google API Key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/gu },
  { label: "Slack Token", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/gu },
  { label: "Stripe Live Key", pattern: /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/gu },
  { label: "API Key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/gu },
  {
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu,
  },
  { label: "带明文认证的 URL", pattern: /https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/gu },
  { label: "macOS/Linux 本机绝对路径", pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//gu },
  { label: "macOS 临时目录", pattern: /\/var\/folders\/[A-Za-z0-9_\/-]+/gu },
  { label: "Windows 本机用户路径", pattern: /\b[A-Za-z]:\\Users\\[^\\\s]+\\/gu },
];

const safeExample = /^(?:change-?me|dummy|example|fake|mock|new|not-a-real|old|placeholder|redacted|sample|test|your)[-_ ]/iu;
const literalCredential = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|private[_-]?key)\b\s*[:=]\s*["'`]([^"'`\r\n]{8,})["'`]/giu;
const violations = [];

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

for (const file of gitFiles()) {
  const pathReason = forbiddenPathReason(file);
  if (pathReason) violations.push({ file, line: 1, reason: pathReason });

  let buffer;
  try {
    buffer = readFileSync(path.join(projectRoot, file));
  } catch {
    continue;
  }
  if (buffer.length > 25 * 1024 * 1024 || buffer.includes(0)) continue;
  const text = buffer.toString("utf8");

  for (const check of contentChecks) {
    check.pattern.lastIndex = 0;
    let match;
    while ((match = check.pattern.exec(text))) {
      violations.push({ file, line: lineNumber(text, match.index), reason: check.label });
      if (match[0].length === 0) check.pattern.lastIndex += 1;
    }
  }

  literalCredential.lastIndex = 0;
  let credentialMatch;
  while ((credentialMatch = literalCredential.exec(text))) {
    const value = credentialMatch[2].trim();
    if (safeExample.test(value) || /^(?:process|import)\./u.test(value)) continue;
    violations.push({
      file,
      line: lineNumber(text, credentialMatch.index),
      reason: `疑似硬编码凭据字段 ${credentialMatch[1]}`,
    });
  }
}

const unique = [
  ...new Map(
    violations.map((violation) => [
      `${violation.file}:${violation.line}:${violation.reason}`,
      violation,
    ]),
  ).values(),
];

if (unique.length > 0) {
  console.error("公开发布审计失败。以下位置需要人工确认；为避免泄露，不输出命中内容：");
  for (const violation of unique) {
    console.error(`- ${violation.file}:${violation.line} — ${violation.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("公开发布审计通过：未发现常见密钥、私钥、本机路径或本地运行数据文件。");
}
