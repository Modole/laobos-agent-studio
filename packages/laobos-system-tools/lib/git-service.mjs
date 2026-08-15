import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 8 * 1024 * 1024;
const MAX_PATHS = 200;

export class GitServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GitServiceError";
    this.code = code;
  }
}

export async function inspectGit(root) {
  const context = await resolveRepository(root, { allowMissing: true });
  if (!context.repository) {
    return {
      isRepository: false,
      root: context.cwd,
      branch: "",
      head: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      statusToken: null,
      changes: [],
      commits: [],
      branches: [],
      remotes: [],
    };
  }
  return inspectResolved(context.repository);
}

export async function diffGit(root, input = {}) {
  const repository = await requireRepository(root);
  const filePath = input.path === undefined ? undefined : safeRelativePath(input.path);
  const side = input.side || (input.staged ? "staged" : "unstaged");
  let args;
  let acceptedExitCodes = [0];

  if (side === "commit") {
    const ref = safeRef(input.ref);
    args = ["show", "--format=fuller", "--no-ext-diff", "--no-color", "--stat", "--patch", ref];
    if (filePath) args.push("--", filePath);
  } else if (side === "untracked") {
    if (!filePath) throw new GitServiceError("PATH_REQUIRED", "查看未跟踪文件必须提供路径。");
    const state = await inspectResolved(repository);
    if (!state.changes.some((change) => change.untracked && change.path === filePath)) {
      throw new GitServiceError("PATH_NOT_UNTRACKED", "该文件已不再是未跟踪文件，请刷新后重试。");
    }
    args = ["diff", "--no-index", "--no-ext-diff", "--no-color", "--unified=3", "--", "/dev/null", filePath];
    acceptedExitCodes = [0, 1];
  } else {
    args = ["diff", "--no-ext-diff", "--no-color", "--unified=3"];
    if (side === "staged") args.push("--cached");
    else if (side !== "unstaged") throw new GitServiceError("SIDE_INVALID", "Git Diff 类型无效。");
    if (filePath) args.push("--", filePath);
  }

  const result = await runGit(repository, args, { acceptedExitCodes });
  return { diff: result.stdout, side, path: filePath || null };
}

export async function initializeGit(root, input = {}) {
  const cwd = await realpath(path.resolve(root));
  const existing = await resolveRepository(cwd, { allowMissing: true });
  if (existing.repository) return inspectResolved(existing.repository);
  const branch = safeBranch(input.branch || "main");
  try {
    await runGit(cwd, ["init", "-b", branch]);
  } catch (error) {
    if (!(error instanceof GitServiceError) || error.code !== "GIT_FAILED") throw error;
    await runGit(cwd, ["init"]);
    await runGit(cwd, ["branch", "-M", branch]);
  }
  await ensureGitIdentity(cwd);
  return inspectGit(cwd);
}

export async function stageGit(root, input = {}) {
  const repository = await requireRepository(root);
  await assertExpectedState(repository, input, { status: true });
  const paths = safePaths(input.paths);
  await runGit(repository, ["add", "--", ...paths]);
  return inspectResolved(repository);
}

export async function unstageGit(root, input = {}) {
  const repository = await requireRepository(root);
  const before = await assertExpectedState(repository, input, { status: true });
  const paths = safePaths(input.paths);
  if (before.head) await runGit(repository, ["restore", "--staged", "--", ...paths]);
  else await runGit(repository, ["rm", "--cached", "-r", "--ignore-unmatch", "--", ...paths]);
  return inspectResolved(repository);
}

export async function commitGit(root, input = {}) {
  const repository = await requireRepository(root);
  const before = await assertExpectedState(repository, input, { status: true, head: true });
  if (!before.changes.some((change) => change.staged)) {
    throw new GitServiceError("NOTHING_STAGED", "没有已暂存的变更，无法提交。");
  }
  const message = boundedText(input.message, "提交说明", 5_000).trim();
  if (!message) throw new GitServiceError("MESSAGE_REQUIRED", "提交说明不能为空。");
  await ensureGitIdentity(repository);
  await runGit(repository, ["commit", "-m", message]);
  return inspectResolved(repository);
}

export async function branchGit(root, input = {}) {
  const repository = await requireRepository(root);
  const action = input.action;
  if (action === "list") return inspectResolved(repository);
  await assertExpectedState(repository, input, { head: true });
  const name = safeBranch(input.name);
  if (action === "create") await runGit(repository, ["switch", "-c", name]);
  else if (action === "switch") await runGit(repository, ["switch", name]);
  else if (action === "delete") await runGit(repository, ["branch", "-d", name]);
  else throw new GitServiceError("ACTION_INVALID", "不支持的分支操作。");
  return inspectResolved(repository);
}

export async function restoreGit(root, input = {}) {
  const repository = await requireRepository(root);
  const before = await assertExpectedState(repository, input, { status: true });
  const paths = safePaths(input.paths);
  for (const filePath of paths) {
    const change = before.changes.find((candidate) => candidate.path === filePath);
    if (!change || change.untracked || !change.unstaged) {
      throw new GitServiceError("RESTORE_UNSAFE", `不能恢复“${filePath}”：它不是已跟踪的工作区修改。`);
    }
  }
  await runGit(repository, ["restore", "--worktree", "--", ...paths]);
  return inspectResolved(repository);
}

export async function syncGit(root, input = {}) {
  const repository = await requireRepository(root);
  const before = await assertExpectedState(repository, input, { head: true });
  const action = input.action;
  const remote = boundedText(input.remote || "origin", "远端名称", 128);
  if (!before.remotes.includes(remote)) throw new GitServiceError("REMOTE_UNKNOWN", `找不到 Git 远端“${remote}”。`);
  if (!before.branch || before.branch === "(detached)") throw new GitServiceError("BRANCH_REQUIRED", "当前不在可同步的本地分支上。");
  if (action === "fetch") await runGit(repository, ["fetch", "--prune", remote], { timeout: 60_000 });
  else if (action === "pull") await runGit(repository, ["pull", "--ff-only", remote, before.branch], { timeout: 60_000 });
  else if (action === "push") await runGit(repository, ["push", "--set-upstream", remote, before.branch], { timeout: 60_000 });
  else throw new GitServiceError("ACTION_INVALID", "不支持的同步操作。");
  return inspectResolved(repository);
}

export function parseGitStatusV2(output) {
  const records = output.split("\0");
  const state = { branch: "", head: null, upstream: null, ahead: 0, behind: 0, changes: [] };
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith("# branch.oid ")) {
      const oid = record.slice(13);
      state.head = oid === "(initial)" ? null : oid;
      continue;
    }
    if (record.startsWith("# branch.head ")) {
      state.branch = record.slice(14) === "(detached)" ? "(detached)" : record.slice(14);
      continue;
    }
    if (record.startsWith("# branch.upstream ")) {
      state.upstream = record.slice(18) || null;
      continue;
    }
    if (record.startsWith("# branch.ab ")) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/u.exec(record);
      if (match) { state.ahead = Number(match[1]); state.behind = Number(match[2]); }
      continue;
    }
    if (record.startsWith("? ")) {
      state.changes.push(changeRecord("?", "?", record.slice(2), { kind: "untracked", untracked: true }));
      continue;
    }
    if (record.startsWith("! ")) continue;
    const ordinary = /^1 ([^ ]{2}) \S+ \S+ \S+ \S+ \S+ \S+ (.*)$/u.exec(record);
    if (ordinary) {
      state.changes.push(changeRecord(ordinary[1][0], ordinary[1][1], ordinary[2], { kind: "ordinary" }));
      continue;
    }
    const renamed = /^2 ([.?A-Z][.?A-Z]) \S+ \S+ \S+ \S+ \S+ \S+ \S+ (.*)$/u.exec(record);
    if (renamed) {
      state.changes.push(changeRecord(renamed[1][0], renamed[1][1], renamed[2], {
        kind: "renamed",
        originalPath: records[index + 1] || "",
      }));
      index += 1;
      continue;
    }
    const unmerged = /^u ([.?A-Z][.?A-Z]) \S+ \S+ \S+ \S+ \S+ \S+ \S+ \S+ (.*)$/u.exec(record);
    if (unmerged) state.changes.push(changeRecord(unmerged[1][0], unmerged[1][1], unmerged[2], { kind: "conflict", conflict: true }));
  }
  return state;
}

export function parseGitStatusV1(output) {
  const records = output.split("\0").filter(Boolean);
  let branch = "";
  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.startsWith("## ")) { branch = record.slice(3).split("...")[0]; continue; }
    if (record.length < 4) continue;
    const entry = { index: record[0], worktree: record[1], path: record.slice(3) };
    if (["R", "C"].includes(record[0]) || ["R", "C"].includes(record[1])) {
      entry.originalPath = records[index + 1] || "";
      index += 1;
    }
    changes.push(entry);
  }
  return { branch, changes };
}

async function inspectResolved(repository) {
  const statusResult = await runGit(repository, ["status", "--porcelain=v2", "--branch", "--untracked-files=all", "-z"]);
  const status = parseGitStatusV2(statusResult.stdout);
  const [commits, branches, remoteLines] = await Promise.all([
    status.head ? gitLog(repository, 50) : [],
    gitBranches(repository),
    runGit(repository, ["remote"], { acceptedExitCodes: [0] }).then((result) => result.stdout.split(/\r?\n/u).filter(Boolean)),
  ]);
  return {
    isRepository: true,
    root: repository,
    ...status,
    statusToken: createHash("sha256").update(statusResult.stdout).digest("hex"),
    commits,
    branches,
    remotes: remoteLines,
  };
}

async function gitLog(repository, limit) {
  const output = (await runGit(repository, ["log", `-${limit}`, "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e"])).stdout;
  return output.split("\x1e").filter(Boolean).map((record) => {
    const [hash, shortHash, author, date, subject] = record.replace(/^\n/u, "").split("\x1f");
    return { hash, shortHash, author, date, subject };
  });
}

async function gitBranches(repository) {
  const output = (await runGit(repository, ["for-each-ref", "--format=%(refname:short)%00%(HEAD)", "refs/heads"])).stdout;
  return output.split(/\r?\n/u).filter(Boolean).map((record) => {
    const [name, marker] = record.split("\0");
    return { name, current: marker === "*" };
  });
}

async function ensureGitIdentity(repository) {
  const [name, email] = await Promise.all([
    runGit(repository, ["config", "--get", "user.name"], { acceptedExitCodes: [0, 1] }),
    runGit(repository, ["config", "--get", "user.email"], { acceptedExitCodes: [0, 1] }),
  ]);
  if (!name.stdout.trim()) await runGit(repository, ["config", "--local", "user.name", "劳博士 Agent"]);
  if (!email.stdout.trim()) await runGit(repository, ["config", "--local", "user.email", "laobos-agent@local"]);
}

async function resolveRepository(root, { allowMissing = false } = {}) {
  const cwd = await realpath(path.resolve(root));
  try {
    const discovered = (await runGit(cwd, ["rev-parse", "--show-toplevel"])).stdout.trim();
    const repository = await realpath(discovered);
    if (!isPathInside(cwd, repository)) {
      throw new GitServiceError("REPOSITORY_OUTSIDE_ROOT", "当前目录位于上级 Git 仓库中。请直接打开仓库根目录，避免读取工作区外的内容。");
    }
    return { cwd, repository };
  } catch (error) {
    if (allowMissing && error instanceof GitServiceError && error.code === "NOT_REPOSITORY") return { cwd, repository: null };
    throw error;
  }
}

async function requireRepository(root) {
  return (await resolveRepository(root)).repository;
}

async function assertExpectedState(repository, input, required) {
  const state = await inspectResolved(repository);
  if (required.status && input.expectedStatusToken !== state.statusToken) {
    throw new GitServiceError("STATUS_CHANGED", "Git 状态已发生变化，请刷新后重试。");
  }
  if (required.head && (input.expectedHead ?? null) !== state.head) {
    throw new GitServiceError("HEAD_CHANGED", "当前版本已发生变化，请刷新后重试。");
  }
  return state;
}

function changeRecord(index, worktree, filePath, extra = {}) {
  return {
    index,
    worktree,
    path: filePath,
    staged: index !== "." && index !== "?",
    unstaged: worktree !== "." || extra.untracked === true,
    untracked: false,
    conflict: false,
    ...extra,
  };
}

function safePaths(values) {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_PATHS) {
    throw new GitServiceError("PATHS_INVALID", `必须提供 1–${MAX_PATHS} 个文件路径。`);
  }
  return [...new Set(values.map(safeRelativePath))];
}

function safeRelativePath(value) {
  const text = boundedText(value, "Git 文件路径", 4_096);
  if (!text || path.isAbsolute(text) || text.split(/[\\/]/u).includes("..") || text.includes("\0")) {
    throw new GitServiceError("PATH_INVALID", "Git 文件路径无效。");
  }
  return text;
}

function safeBranch(value) {
  const text = boundedText(value, "分支名称", 240).trim();
  if (!text || text.startsWith("-") || /[\s~^:?*[\\\x00-\x1f\x7f]/u.test(text) || text.includes("..") || text.includes("@{")) {
    throw new GitServiceError("BRANCH_INVALID", "Git 分支名称无效。");
  }
  return text;
}

function safeRef(value) {
  const text = boundedText(value, "提交引用", 128).trim();
  if (!/^[0-9a-f]{7,64}$/iu.test(text)) throw new GitServiceError("REF_INVALID", "提交引用无效。");
  return text;
}

function boundedText(value, label, maximum) {
  if (typeof value !== "string") throw new GitServiceError("INPUT_INVALID", `${label}必须是字符串。`);
  if (value.length > maximum) throw new GitServiceError("INPUT_INVALID", `${label}过长。`);
  return value;
}

function isPathInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function runGit(cwd, args, options = {}) {
  const acceptedExitCodes = options.acceptedExitCodes || [0];
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      timeout: options.timeout || 20_000,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" },
    });
    return { stdout, stderr, code: 0 };
  } catch (error) {
    const code = Number(error?.code);
    if (acceptedExitCodes.includes(code)) return { stdout: String(error?.stdout || ""), stderr: String(error?.stderr || ""), code };
    const message = String(error?.stderr || error?.message || error).trim();
    if (/not a git repository/iu.test(message)) throw new GitServiceError("NOT_REPOSITORY", "当前工作区还没有启用 Git 版本管理。");
    if (/Please tell me who you are|Author identity unknown/iu.test(message)) throw new GitServiceError("IDENTITY_REQUIRED", "Git 尚未配置提交者姓名和邮箱，请先配置后再提交。");
    if (/Authentication failed|could not read Username|Permission denied \(publickey\)/iu.test(message)) throw new GitServiceError("AUTH_REQUIRED", "Git 远端身份验证失败，请先配置凭据。");
    throw new GitServiceError("GIT_FAILED", message || "Git 命令执行失败。");
  }
}
