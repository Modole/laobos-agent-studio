import path from "node:path";
import { boundedString, resolveAuthorizedPath } from "../ipc-security.mjs";
import {
  branchGit,
  commitGit,
  diffGit,
  initializeGit,
  inspectGit,
  parseGitStatusV1,
  parseGitStatusV2,
  restoreGit,
  stageGit,
  syncGit,
  unstageGit,
} from "../../packages/laobos-system-tools/lib/git-service.mjs";

const channels = [
  "laobos:git:inspect",
  "laobos:git:status",
  "laobos:git:diff",
  "laobos:git:log",
  "laobos:git:init",
  "laobos:git:stage",
  "laobos:git:unstage",
  "laobos:git:commit",
  "laobos:git:branch",
  "laobos:git:restore",
  "laobos:git:sync",
];

export function registerGitReviewIpc({ ipcMain, workspace, authorize }) {
  const handle = (channel, operation) => ipcMain.handle(channel, async (event, input = {}) => {
    authorize(event);
    const root = await gitRoot(workspace, input.root);
    return operation(root, input);
  });

  handle("laobos:git:inspect", (root) => inspectGit(root));
  handle("laobos:git:status", async (root) => {
    const value = await inspectGit(root);
    if (!value.isRepository) throw new Error("当前工作区还没有启用 Git 版本管理。");
    return value;
  });
  handle("laobos:git:diff", (root, input) => diffGit(root, input));
  handle("laobos:git:log", async (root, input) => {
    const value = await inspectGit(root);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 30));
    return { commits: value.commits.slice(0, limit) };
  });
  handle("laobos:git:init", (root, input) => initializeGit(root, input));
  handle("laobos:git:stage", (root, input) => stageGit(root, input));
  handle("laobos:git:unstage", (root, input) => unstageGit(root, input));
  handle("laobos:git:commit", (root, input) => commitGit(root, input));
  handle("laobos:git:branch", (root, input) => branchGit(root, input));
  handle("laobos:git:restore", (root, input) => restoreGit(root, input));
  handle("laobos:git:sync", (root, input) => syncGit(root, input));

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}

async function gitRoot(workspace, requested) {
  const root = requested ? boundedString(requested, "工作区路径", 4_096) : workspace;
  const relative = path.relative(workspace, path.resolve(root));
  return (await resolveAuthorizedPath(workspace, relative, { kind: "directory" })).path;
}

// Kept for compatibility with existing callers and fixtures.
export const parseGitStatus = parseGitStatusV1;
export { parseGitStatusV2 };
