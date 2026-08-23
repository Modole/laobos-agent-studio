import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import {
  detectApplication,
  findFreeApplicationPort,
  isTcpPortFree,
  MANAGED_APP_MAX_PORT,
  MANAGED_APP_MIN_PORT,
  normalizeManagedAppPort,
  registerAppsIpc,
  splitArgs,
} from "../desktop/domains/apps.mjs";
import { friendlyNavigationError, normalizeBrowserUrl } from "../desktop/domains/browser.mjs";
import { registerClipboardIpc } from "../desktop/domains/clipboard.mjs";
import { safeHtmlName } from "../desktop/domains/conversation-export.mjs";
import { DesktopSettingsStore } from "../desktop/domains/desktop-settings.mjs";
import { parseGitStatus } from "../desktop/domains/git-review.mjs";
import { isPathInside, resolveAuthorizedPath } from "../desktop/ipc-security.mjs";
import { WorkspaceAuthorization } from "../desktop/workspace-authorization.mjs";
import { installPermissionPolicy, isTrustedRuntimePermission } from "../desktop/permissions.mjs";
import { findSessionDirectory } from "../desktop/domains/session-trash.mjs";
import { fingerprint, parseOpenSshConfig } from "../desktop/domains/ssh.mjs";
import {
  copyManagedUploadFiles,
  managedUploadRoot,
  mediaTypeFor,
  readPickedAttachments,
  registerWorkspaceFilesIpc,
  safeUploadFileName,
  storeManagedPastedFiles,
} from "../desktop/domains/workspace-files.mjs";
import {
  findExecutable,
  prepareTmuxWorkspace,
  registerTerminalIpc,
  tmuxSessionName,
} from "../desktop/domains/terminal.mjs";
import { languageForPath, parseUnifiedDiff, tokenizeCodeLine } from "../packages/laobos-workspace-tools/src/code-renderer.mjs";
import {
  CONVERSATION_CHANGE_STATS_KEY,
  conversationDiffChanges,
  createConversationChangeStatsDefinition,
  selectConversationChangePaths,
  selectConversationChanges,
} from "../packages/laobos-workspace-tools/src/conversation-changes.mjs";
import { buildGitReviewTree, gitReviewDirectoryPaths } from "../packages/laobos-workspace-tools/src/git-review-tree.mjs";
import { resolveWorkspaceRoot } from "../packages/laobos-workspace-tools/src/workspace-root.mjs";
import {
  generateCommitMessage,
  normalizeGeneratedCommitMessage,
  truncateCommitDiff,
} from "../packages/laobos-workspace-tools/lib/index.js";

test("workspace commit helper normalizes and generates a concise message through the shared LLM", async () => {
  assert.equal(normalizeGeneratedCommitMessage("```text\n提交说明：feat: 优化任务与 Git 弹窗\n```"), "feat: 优化任务与 Git 弹窗");
  assert.match(truncateCommitDiff("改".repeat(100), 24), /Git diff 已截断/u);

  let request;
  const ctx = {
    llm: {
      async *stream(options) {
        request = options;
        yield { type: "text-delta", index: 0, text: "fix: 自动生成提交说明" };
        yield { type: "finish", reason: { kind: "stop" } };
      },
    },
  };
  const message = await generateCommitMessage(ctx, {
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningEffort: "high",
    sessionId: "session-test",
    branch: "main",
    files: ["packages/example.js"],
    additions: 4,
    deletions: 1,
    diff: "diff --git a/packages/example.js b/packages/example.js\n+const enabled = true;",
  }, new AbortController().signal);
  assert.equal(message, "fix: 自动生成提交说明");
  assert.equal(request.provider, "deepseek");
  assert.equal(request.model, "deepseek-chat");
  assert.equal(request.reasoningEffort, "high");
  assert.equal(request.maxTokens, 2_048);
  assert.match(request.system, /不可信数据/u);
  assert.match(request.messages[0].content[0].text, /packages\/example\.js/u);
});

test("workspace commit helper recovers when reasoning consumes the first output budget", async () => {
  const requests = [];
  const ctx = {
    llm: {
      async *stream(options) {
        requests.push(options);
        if (requests.length === 1) {
          yield { type: "finish", reason: { kind: "max-tokens" } };
          return;
        }
        yield { type: "text-delta", index: 0, text: "refactor: 优化 Git 提交面板" };
        yield { type: "finish", reason: { kind: "stop" } };
      },
    },
  };
  const message = await generateCommitMessage(ctx, {
    provider: "deepseek",
    model: "deepseek-v4-flash-0731",
    reasoningEffort: "high",
    diff: "diff --git a/panel.js b/panel.js\n+const compact = true;",
  }, new AbortController().signal);

  assert.equal(message, "refactor: 优化 Git 提交面板");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].provider, requests[1].provider);
  assert.equal(requests[0].model, requests[1].model);
  assert.equal(requests[0].reasoningEffort, "high");
  assert.equal(requests[1].reasoningEffort, undefined);
  assert.equal(requests[1].maxTokens, 4_096);
});

test("workspace commit helper accepts a usable final subject from a truncated stream", async () => {
  let calls = 0;
  const ctx = {
    llm: {
      async *stream() {
        calls += 1;
        yield { type: "text-delta", index: 0, text: "fix: 修复提交说明截断" };
        yield { type: "finish", reason: { kind: "max-tokens" } };
      },
    },
  };
  const message = await generateCommitMessage(ctx, {
    provider: "deepseek",
    model: "deepseek-chat",
    diff: "diff --git a/commit.js b/commit.js\n+const fixed = true;",
  }, new AbortController().signal);

  assert.equal(message, "fix: 修复提交说明截断");
  assert.equal(calls, 1);
});

test("workspace commit helper does not accept partial text from a failed stream", async () => {
  const ctx = {
    llm: {
      async *stream() {
        yield { type: "text-delta", index: 0, text: "fix: 不完整的说明" };
        yield { type: "finish", reason: { kind: "error", failure: { code: "UPSTREAM_ERROR", message: "模型服务不可用" } } };
      },
    },
  };

  await assert.rejects(() => generateCommitMessage(ctx, {
    provider: "deepseek",
    model: "deepseek-chat",
    diff: "diff --git a/error.js b/error.js\n+const failed = true;",
  }, new AbortController().signal), /模型服务不可用/u);
});

test("desktop clipboard writes through the trusted main process", () => {
  const handlers = new Map();
  const removed = [];
  const writes = [];
  let authorized = false;
  const dispose = registerClipboardIpc({
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: (channel) => removed.push(channel),
    },
    clipboard: { writeText: (text) => writes.push(text) },
    authorize: () => { authorized = true; },
  });

  assert.deepEqual(handlers.get("laobos:clipboard:write-text")({}, { text: "省心复制" }), { written: true });
  assert.equal(authorized, true);
  assert.deepEqual(writes, ["省心复制"]);
  assert.throws(() => handlers.get("laobos:clipboard:write-text")({}, { text: 42 }), /必须是字符串/u);
  dispose();
  assert.deepEqual(removed, ["laobos:clipboard:write-text"]);
});

test("desktop permission policy allows clipboard writes only from the DSH runtime", () => {
  let checkHandler;
  let requestHandler;
  installPermissionPolicy({
    session: {
      setPermissionCheckHandler: (handler) => { checkHandler = handler; },
      setPermissionRequestHandler: (handler) => { requestHandler = handler; },
    },
    getRuntimeUrl: () => "http://127.0.0.1:49163/",
  });

  const runtimeContents = { getURL: () => "http://127.0.0.1:49163/session/example" };
  assert.equal(checkHandler(runtimeContents, "clipboard-sanitized-write", "http://127.0.0.1:49163"), true);
  assert.equal(checkHandler(runtimeContents, "clipboard-read", "http://127.0.0.1:49163"), false);
  assert.equal(checkHandler(runtimeContents, "clipboard-sanitized-write", "https://example.com"), false);
  assert.equal(isTrustedRuntimePermission({
    webContents: { getURL: () => "https://example.com" },
    requestingOrigin: "http://127.0.0.1:49163",
    runtimeUrl: "http://127.0.0.1:49163",
  }), false);

  const decisions = [];
  requestHandler(runtimeContents, "clipboard-sanitized-write", (allowed) => decisions.push(allowed), {
    requestingUrl: "http://127.0.0.1:49163/session/example",
  });
  requestHandler(runtimeContents, "notifications", (allowed) => decisions.push(allowed), {
    requestingUrl: "http://127.0.0.1:49163/session/example",
  });
  assert.deepEqual(decisions, [true, false]);
});

test("desktop path authorization rejects traversal and symlink escapes", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-paths-"));
  const root = path.join(temporary, "root");
  const outside = path.join(temporary, "outside");
  await mkdir(root); await mkdir(outside);
  await writeFile(path.join(root, "safe.txt"), "safe");
  await symlink(outside, path.join(root, "escape"));
  try {
    assert.equal(isPathInside(root, path.join(root, "safe.txt")), true);
    assert.equal(isPathInside(root, outside), false);
    await assert.rejects(() => resolveAuthorizedPath(root, "../outside"), /超出已授权工作区/u);
    await assert.rejects(() => resolveAuthorizedPath(root, "escape"), /符号链接/u);
    assert.match((await resolveAuthorizedPath(root, "safe.txt", { kind: "file" })).path, /safe\.txt$/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("workspace file manager edits, renames, reveals, opens and removes authorized files", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-file-manager-"));
  const workspace = path.join(temporary, "workspace");
  const dshHome = path.join(temporary, "dsh-home");
  await mkdir(workspace); await mkdir(dshHome);
  await writeFile(path.join(workspace, "notes.txt"), "first\n");
  const handlers = new Map();
  const revealed = [];
  const trashed = [];
  const dispose = registerWorkspaceFilesIpc({
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: (channel) => handlers.delete(channel),
    },
    dialog: {},
    shell: {
      openPath: async (target) => { revealed.push(target); return ""; },
      showItemInFolder: (target) => revealed.push(target),
      trashItem: async (target) => { trashed.push(target); await rm(target, { recursive: true, force: false }); },
    },
    workspace,
    dshHome,
    settings: { get: async () => ({ uploadLocation: "default" }), update: async (value) => value },
    authorize: () => {},
  });
  try {
    const listing = await handlers.get("laobos:workspace:list")({}, { root: workspace, path: "." });
    assert.equal(listing.entries.find((entry) => entry.name === "notes.txt")?.mediaType, "text/plain");
    const first = await handlers.get("laobos:workspace:read")({}, { root: workspace, path: "notes.txt" });
    assert.equal(first.content, "first\n");
    assert.equal(Number.isFinite(first.modifiedAt), true);
    const saved = await handlers.get("laobos:workspace:write")({}, {
      root: workspace,
      path: "notes.txt",
      content: "second\n",
      expectedModifiedAt: first.modifiedAt,
    });
    assert.equal(saved.saved, true);
    assert.equal(await readFile(path.join(workspace, "notes.txt"), "utf8"), "second\n");
    await assert.rejects(() => handlers.get("laobos:workspace:write")({}, {
      root: workspace,
      path: "notes.txt",
      content: "stale",
      expectedModifiedAt: 0,
    }), /其他程序修改/u);

    const createdDirectory = await handlers.get("laobos:workspace:create")({}, { root: workspace, parent: ".", name: "drafts", type: "directory" });
    assert.equal(createdDirectory.path, "drafts");
    const createdFile = await handlers.get("laobos:workspace:create")({}, { root: workspace, parent: "drafts", name: "idea.md", type: "file" });
    assert.equal(createdFile.path, path.join("drafts", "idea.md"));
    assert.equal(await readFile(path.join(workspace, createdFile.path), "utf8"), "");
    await assert.rejects(() => handlers.get("laobos:workspace:create")({}, { root: workspace, parent: "drafts", name: "idea.md", type: "file" }), /已存在/u);

    const renamed = await handlers.get("laobos:workspace:rename")({}, { root: workspace, path: "notes.txt", name: "renamed.txt" });
    assert.equal(renamed.path, "renamed.txt");
    const renamedPath = await realpath(path.join(workspace, "renamed.txt"));
    await handlers.get("laobos:workspace:reveal")({}, { root: workspace, path: renamed.path });
    await handlers.get("laobos:workspace:open")({}, { root: workspace, path: renamed.path });
    assert.deepEqual(revealed, [renamedPath, renamedPath]);
    assert.equal((await handlers.get("laobos:workspace:remove")({}, { root: workspace, path: renamed.path })).recoverable, true);
    await assert.rejects(readFile(path.join(workspace, "renamed.txt")), /ENOENT/u);
    assert.equal((await handlers.get("laobos:workspace:remove")({}, { root: workspace, path: createdDirectory.path })).removed, true);
    assert.equal(trashed.length, 2);
    await assert.rejects(readFile(path.join(workspace, createdFile.path)), /ENOENT/u);
    await assert.rejects(() => handlers.get("laobos:workspace:rename")({}, { root: workspace, path: ".", name: "bad" }), /根目录/u);
  } finally {
    dispose();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("desktop settings persist upload location atomically", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-settings-"));
  const file = path.join(temporary, "settings.json");
  try {
    const store = new DesktopSettingsStore(file);
    assert.equal((await store.get()).uploadLocation, "default");
    await store.update({ uploadLocation: "workspace" });
    const restored = new DesktopSettingsStore(file);
    assert.deepEqual(await restored.get(), {
      version: 5,
      uploadLocation: "workspace",
      autoCheckUpdates: true,
      lastUpdateCheckAt: null,
      pendingUpdate: null,
      authorizedWorkspaces: [],
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("desktop workspace authorization persists a native approval for projects outside Documents", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-workspace-approval-"));
  const documents = path.join(temporary, "Documents");
  const project = path.join(temporary, "D-drive", "projects", "demo");
  const settingsFile = path.join(temporary, "settings.json");
  await mkdir(documents, { recursive: true });
  await mkdir(project, { recursive: true });
  let prompts = 0;
  const settings = new DesktopSettingsStore(settingsFile);
  const authorizer = new WorkspaceAuthorization({
    defaultRoot: documents,
    settings,
    dialog: { showMessageBox: async () => { prompts += 1; return { response: 0 }; } },
  });
  try {
    assert.equal(await authorizer.resolve(project), await realpath(project));
    assert.equal(prompts, 1);
    assert.deepEqual((await settings.get()).authorizedWorkspaces, [await realpath(project)]);
    assert.equal(await authorizer.resolve(path.join(project, ".")), await realpath(project));
    assert.equal(prompts, 1, "a persisted workspace approval must not prompt again");

    const rejected = path.join(temporary, "rejected");
    await mkdir(rejected);
    const denying = new WorkspaceAuthorization({
      defaultRoot: documents,
      settings: new DesktopSettingsStore(path.join(temporary, "denied-settings.json")),
      dialog: { showMessageBox: async () => ({ response: 1 }) },
    });
    await assert.rejects(() => denying.resolve(rejected), /尚未授权/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("ordinary uploads are copied to the configured managed location", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-upload-"));
  const workspace = path.join(temporary, "workspace");
  const dshHome = path.join(temporary, "dsh-home");
  const source = path.join(temporary, "报告 <最终>.txt");
  await mkdir(workspace); await mkdir(dshHome); await writeFile(source, "managed upload");
  let uploadLocation = "workspace";
  const settings = { get: async () => ({ version: 2, uploadLocation }) };
  try {
    const [workspaceFile] = await copyManagedUploadFiles({
      sourcePaths: [source], sessionId: "session/unsafe", workspace, dshHome, settings,
    });
    assert.equal(path.dirname(workspaceFile.path), path.join(workspace, "update"));
    assert.equal(await readFile(workspaceFile.path, "utf8"), "managed upload");
    assert.equal(workspaceFile.name, "报告 _最终_.txt");
    assert.equal(path.basename(workspaceFile.path).includes("报告 _最终_.txt"), true);
    assert.equal(workspaceFile.location, "workspace");
    assert.equal(path.isAbsolute(workspaceFile.path), true);

    uploadLocation = "default";
    const [defaultFile] = await copyManagedUploadFiles({
      sourcePaths: [source], sessionId: "session/unsafe", workspace, dshHome, settings,
    });
    assert.equal(path.dirname(defaultFile.path), managedUploadRoot({
      workspace, dshHome, location: "default", sessionId: "session/unsafe",
    }));
    assert.equal(defaultFile.location, "default");
    assert.equal(safeUploadFileName("../bad\\name.txt"), "name.txt");
    assert.equal(safeUploadFileName("附录1.1:需求说明书 1.1.docx"), "附录1.1_需求说明书 1.1.docx");
    assert.equal(safeUploadFileName('报告<最终>|草稿?.txt'), "报告_最终__草稿_.txt");
    assert.equal(safeUploadFileName("report. "), "report");
    assert.equal(safeUploadFileName("CON.txt"), "_CON.txt");

    const link = path.join(temporary, "linked.txt");
    await symlink(source, link);
    await assert.rejects(() => copyManagedUploadFiles({
      sourcePaths: [link], sessionId: "session", workspace, dshHome, settings,
    }), /普通文件/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the unified attachment picker routes supported images to multimodal input", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-attachment-route-"));
  const image = path.join(temporary, "preview.png");
  const document = path.join(temporary, "notes.pdf");
  await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(document, "pdf");
  try {
    const routed = await readPickedAttachments([image, document]);
    assert.equal(routed.images.length, 1);
    assert.equal(routed.images[0].name, "preview.png");
    assert.equal(routed.images[0].mediaType, "image/png");
    assert.deepEqual([...routed.images[0].bytes], [0x89, 0x50, 0x4e, 0x47]);
    assert.deepEqual(routed.filePaths, [document]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("pasted non-image files are stored in the configured managed location", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-pasted-file-"));
  const workspace = path.join(temporary, "workspace");
  const dshHome = path.join(temporary, "dsh-home");
  await mkdir(workspace); await mkdir(dshHome);
  try {
    const [stored] = await storeManagedPastedFiles({
      files: [{ name: "粘贴报告.pdf", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3, 4]) }],
      sessionId: "paste-session",
      workspace,
      dshHome,
      settings: { get: async () => ({ uploadLocation: "workspace" }) },
    });
    assert.equal(stored.name, "粘贴报告.pdf");
    assert.equal(stored.location, "workspace");
    assert.deepEqual([...await readFile(stored.path)], [1, 2, 3, 4]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("session trash discovery identifies DSH JSONL headers without trusting directory names", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-trash-"));
  const sessionDirectory = path.join(temporary, "project", "opaque");
  await mkdir(sessionDirectory, { recursive: true });
  await writeFile(path.join(sessionDirectory, "session.jsonl"), `${JSON.stringify({ type: "session", version: 1, id: "session-42", createdAt: 1, delegationDepth: 0 })}\n`);
  try {
    const found = await findSessionDirectory(temporary, "session-42");
    assert.equal(found?.directory, sessionDirectory);
    assert.equal(found?.header.id, "session-42");
    assert.equal(await findSessionDirectory(temporary, "missing"), undefined);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("native helper contracts normalize HTML, Git, browser, SSH and tmux values", () => {
  assert.equal(safeHtmlName('项目/A: "会话"'), "项目-A- -会话-.html");
  assert.deepEqual(parseGitStatus("## main...origin/main\0 M src/a.js\0?? notes.txt\0"), {
    branch: "main",
    changes: [
      { index: " ", worktree: "M", path: "src/a.js" },
      { index: "?", worktree: "?", path: "notes.txt" },
    ],
  });
  assert.equal(normalizeBrowserUrl("localhost:3000"), "http://localhost:3000/");
  assert.throws(() => normalizeBrowserUrl(""), /请输入/u);
  assert.throws(() => normalizeBrowserUrl("file:///tmp/a"), /HTTP\(S\)/u);
  assert.match(friendlyNavigationError({ code: -102, message: "ERR_CONNECTION_REFUSED" }, "http://127.0.0.1:3000"), /先启动开发服务/u);
  assert.match(fingerprint(Buffer.from("host-key")), /^SHA256:/u);
  const importedProfiles = parseOpenSshConfig(`
Host production
  HostName prod.example.com
  User deploy
  Port 2222
  IdentityFile ~/.ssh/id_production
  ProxyJump bastion

Host bastion *.internal
  HostName bastion.example.com
  User ops
`);
  assert.equal(importedProfiles.length, 2);
  assert.deepEqual(importedProfiles[0], {
    name: "production",
    configAlias: "production",
    host: "prod.example.com",
    port: 2222,
    username: "deploy",
    authMode: "identityFile",
    credentialId: "",
    identityFile: path.join(os.homedir(), ".ssh", "id_production"),
    proxyJump: "bastion",
    group: "OpenSSH Config",
    favorite: false,
    source: "openssh",
  });
  assert.equal(importedProfiles[1].configAlias, "bastion");
  assert.equal(importedProfiles[1].authMode, "agent");
  assert.equal(tmuxSessionName("/tmp/workspace"), tmuxSessionName("/tmp/workspace"));
  assert.notEqual(tmuxSessionName("/tmp/a"), tmuxSessionName("/tmp/b"));
  assert.notEqual(tmuxSessionName("/tmp/workspace", "terminal-1"), tmuxSessionName("/tmp/workspace", "terminal-2"));
});

test("workspace code and Git diff renderers preserve line numbers and token classes", () => {
  assert.equal(languageForPath("src/client.tsx"), "typescript");
  assert.equal(mediaTypeFor(".gitignore"), "text/plain");
  assert.equal(mediaTypeFor("src/native.cpp"), "text/plain");
  assert.ok(tokenizeCodeLine('const answer = "ok";', "typescript").some((token) => token.type === "keyword" && token.value === "const"));
  const model = parseUnifiedDiff([
    "diff --git a/src/a.js b/src/a.js",
    "--- a/src/a.js",
    "+++ b/src/a.js",
    "@@ -1,2 +1,2 @@",
    "-const color = 'black';",
    "+const color = 'blue';",
    " console.log(color);",
  ].join("\n"));
  assert.equal(model.additions, 1);
  assert.equal(model.deletions, 1);
  assert.deepEqual(model.lines.filter((line) => ["delete", "insert", "normal"].includes(line.type)).map((line) => [line.type, line.oldLine, line.newLine]), [
    ["delete", 1, null],
    ["insert", null, 1],
    ["normal", 2, 2],
  ]);
  const tree = buildGitReviewTree([
    { path: "src/ui/app.js", status: "M" },
    { path: "src/index.js", status: "A" },
    { path: "README.md", status: "M" },
  ]);
  assert.deepEqual(tree.map((node) => [node.type, node.name]), [["directory", "src"], ["file", "README.md"]]);
  assert.deepEqual(gitReviewDirectoryPaths(tree), ["src", "src/ui"]);
  assert.equal(tree[0].children[0].children[0].path, "src/ui/app.js");
});

test("workspace tools prefer the selected DSH workspace over the desktop startup root", () => {
  const sessions = {
    current: "session-v1",
    byId: {
      "session-v1": { cwd: "/projects/session-documents" },
      legacy: { cwd: "/projects/legacy" },
    },
  };
  const workspaces = {
    items: [
      { workspaceId: "workspace-v1", path: "/projects/v1", sessionIds: ["session-v1"] },
      { workspaceId: "workspace-v2", path: "/projects/v2", sessionIds: [] },
    ],
    recentWorkspaceId: "workspace-v2",
  };

  assert.equal(resolveWorkspaceRoot(sessions, workspaces), "/projects/v1");
  assert.equal(resolveWorkspaceRoot(sessions, workspaces, "legacy"), "/projects/legacy");
  assert.equal(resolveWorkspaceRoot({ current: undefined, byId: {} }, workspaces), "/projects/v2");
  assert.equal(resolveWorkspaceRoot(sessions, { items: [] }), "/projects/session-documents");
});

test("conversation change summaries stay scoped to the closing turn sequence", () => {
  const owner = {
    seq: 8,
    turn: {
      data: new Map([["deliverables", { produced: [
        { seq: 3, path: "/workspace/a.js" },
        { seq: 5, path: "/workspace/a.js" },
        { seq: 7, path: "/workspace/b.js" },
        { seq: 9, path: "/workspace/later.js" },
      ] }]]),
    },
  };
  assert.deepEqual(selectConversationChangePaths(owner), ["/workspace/a.js", "/workspace/b.js"]);
  assert.equal(selectConversationChangePaths({ seq: 1, turn: { data: new Map() } }), null);
});

test("conversation change summaries preserve turn-local Edit and Write line totals", () => {
  assert.deepEqual(conversationDiffChanges({ card: "diff", diffs: [
    { path: "./src/a.js", oldText: "old\nline\n", newText: "new\nline\nextra\n" },
    { path: "src/b.js", oldText: null, newText: "created\n" },
  ] }, 7), [
    { seq: 7, path: "./src/a.js", additions: 3, deletions: 2 },
    { seq: 7, path: "src/b.js", additions: 1, deletions: 0 },
  ]);
  assert.deepEqual(conversationDiffChanges({ card: "diff", diffs: [{ path: "bad", oldText: 1, newText: "ok" }] }, 7), []);

  const owner = {
    seq: 8,
    turn: {
      data: new Map([
        ["deliverables", { produced: [
          { seq: 3, path: "src/a.js" },
          { seq: 5, path: "src/b.js" },
          { seq: 9, path: "src/later.js" },
        ] }],
        [CONVERSATION_CHANGE_STATS_KEY, { changes: [
          { seq: 4, path: "./src/a.js", additions: 3, deletions: 2 },
          { seq: 7, path: "src/b.js", additions: 1, deletions: 0 },
          { seq: 9, path: "src/later.js", additions: 99, deletions: 99 },
          { seq: 6, path: "src/unlisted.js", additions: 99, deletions: 99 },
        ] }],
      ]),
    },
  };
  assert.deepEqual(selectConversationChanges(owner), {
    paths: ["src/a.js", "src/b.js"],
    stats: {
      additions: 4,
      deletions: 2,
      files: [
        { path: "src/a.js", additions: 3, deletions: 2 },
        { path: "src/b.js", additions: 1, deletions: 0 },
      ],
    },
  });
  assert.deepEqual(selectConversationChanges({ ...owner, turn: { data: new Map([["deliverables", owner.turn.data.get("deliverables")]]) } }), {
    paths: ["src/a.js", "src/b.js"],
    stats: null,
  });
});

test("conversation change projection records only successful authoritative diff results", () => {
  const definition = createConversationChangeStatsDefinition(() => true);
  const startMatch = { event: { type: "turn/start", data: { turn: 2 } } };
  let state = definition.start({}, startMatch);
  const successful = {
    event: {
      type: "tool/result",
      seq: 12,
      data: { turn: 2, message: { content: [{ isError: false }] } },
    },
    view: { for: "result", view: { card: "diff", diffs: [{ path: "src/a.js", oldText: "a", newText: "a\nb" }] } },
  };
  state = definition.update({ state }, successful);
  assert.deepEqual(state.changes, [{ seq: 12, path: "src/a.js", additions: 2, deletions: 1 }]);
  const failed = { ...successful, event: { ...successful.event, seq: 13, data: { ...successful.event.data, message: { content: [{ isError: true }] } } } };
  assert.strictEqual(definition.update({ state }, failed), state);
  assert.deepEqual(definition.buildLocationData({ state }, "turn"), {
    kind: "turn",
    turn: 2,
    key: CONVERSATION_CHANGE_STATS_KEY,
    value: { changes: state.changes },
  });
});

test("application detection and argument parsing never require a shell", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-app-"));
  await writeFile(path.join(temporary, "package.json"), JSON.stringify({ name: "demo", scripts: { dev: "vite" } }));
  try {
    assert.deepEqual(splitArgs('run dev --host "127.0.0.1"'), ["run", "dev", "--host", "127.0.0.1"]);
    assert.throws(() => splitArgs('"unfinished'), /引号未闭合/u);
    assert.deepEqual(await detectApplication(temporary), {
      detected: true,
      kind: "node",
      name: "demo",
      command: "npm",
      args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", "{PORT}"],
      port: 0,
      url: "",
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("managed applications reserve only available ports at 40000 or above", async () => {
  assert.equal(normalizeManagedAppPort(MANAGED_APP_MIN_PORT), 40_000);
  assert.equal(normalizeManagedAppPort(MANAGED_APP_MAX_PORT), 65_535);
  assert.throws(() => normalizeManagedAppPort(39_999), /40000-65535/u);
  assert.throws(() => normalizeManagedAppPort(65_536), /40000-65535/u);
  const occupiedPort = await findFreeApplicationPort([], MANAGED_APP_MIN_PORT);
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: occupiedPort }, resolve);
  });
  try {
    const freePort = await findFreeApplicationPort([], occupiedPort);
    assert.notEqual(freePort, occupiedPort);
    assert.ok(freePort >= MANAGED_APP_MIN_PORT && freePort <= MANAGED_APP_MAX_PORT);
    assert.notEqual(await findFreeApplicationPort([{ id: "reserved", port: freePort }], freePort), freePort);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("port readiness detects both wildcard and loopback listeners on macOS", async () => {
  const port = await findFreeApplicationPort([], MANAGED_APP_MIN_PORT);
  assert.equal(await isTcpPortFree(port), true);
  const wildcard = net.createServer();
  await new Promise((resolve, reject) => {
    wildcard.once("error", reject);
    wildcard.listen({ host: "0.0.0.0", port }, resolve);
  });
  try {
    assert.equal(await isTcpPortFree(port), false, "wildcard 0.0.0.0 listener must count as busy");
  } finally {
    await new Promise((resolve) => wildcard.close(resolve));
  }
  const loopback = net.createServer();
  await new Promise((resolve, reject) => {
    loopback.once("error", reject);
    loopback.listen({ host: "127.0.0.1", port }, resolve);
  });
  try {
    assert.equal(await isTcpPortFree(port), false, "loopback 127.0.0.1 listener must count as busy");
  } finally {
    await new Promise((resolve) => loopback.close(resolve));
  }
  assert.equal(await isTcpPortFree(port), true);
});

test("application manager validates registration and waits for the managed port", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-managed-app-"));
  const workspace = path.join(temporary, "workspace");
  const userData = path.join(temporary, "user-data");
  await mkdir(workspace); await mkdir(userData);
  await mkdir(path.join(userData, "apps"));
  await writeFile(path.join(userData, "apps", "registry.json"), JSON.stringify([{
    id: "legacy-app", name: "legacy", cwd: workspace, command: process.execPath,
    args: ["-e", "setInterval(()=>{},1000)"], url: "http://127.0.0.1:3000",
  }]));
  const handlers = new Map();
  const events = [];
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: (channel) => handlers.delete(channel),
  };
  const cleanup = registerAppsIpc({
    ipcMain,
    app: { getPath: () => userData },
    shell: { openExternal: async () => {} },
    workspace,
    authorize: () => {},
    getMainWindow: () => ({ isDestroyed: () => false, webContents: { send: (channel, payload) => events.push({ channel, payload }) } }),
  });
  let appId = "";
  try {
    const migrated = (await handlers.get("laobos:apps:list")({})).apps[0];
    assert.ok(migrated.port >= MANAGED_APP_MIN_PORT);
    assert.equal(new URL(migrated.url).port, String(migrated.port));
    await handlers.get("laobos:apps:remove")({}, { id: migrated.id });
    const port = await findFreeApplicationPort([], MANAGED_APP_MIN_PORT);
    const saved = await handlers.get("laobos:apps:save")({}, {
      name: "managed-test",
      cwd: workspace,
      command: process.execPath,
      args: ["-e", "require('node:http').createServer((_request,response)=>response.end('ok')).listen(Number(process.env.PORT),'127.0.0.1')"],
      port,
      url: `http://127.0.0.1:${port}`,
      kind: "node",
    });
    appId = saved.id;
    assert.equal(saved.port, port);
    await assert.rejects(() => handlers.get("laobos:apps:save")({}, {
      name: "conflict", cwd: workspace, command: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], port,
    }), /已登记给应用/u);
    const running = await handlers.get("laobos:apps:start")({}, { id: appId });
    assert.equal(running.state, "running");
    assert.ok(events.some((event) => event.channel === "laobos:apps:state" && event.payload.runtime.state === "running"));
    assert.ok(events.some((event) => event.channel === "laobos:apps:log" && event.payload.chunk.includes(`端口 ${port} 已就绪`)));
    assert.equal((await handlers.get("laobos:apps:stop")({}, { id: appId })).stopped, true);
  } finally {
    if (appId) await handlers.get("laobos:apps:stop")?.({}, { id: appId }).catch(() => {});
    cleanup();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("terminal executable discovery supports a safe shell fallback when tmux is absent", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-bin-"));
  const executable = path.join(temporary, "tmux");
  await writeFile(executable, "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o755);
  try {
    assert.equal(findExecutable("tmux", temporary), executable);
    assert.equal(findExecutable("tmux", path.join(temporary, "missing")), undefined);
    assert.equal(findExecutable("../tmux", temporary), undefined);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("reused tmux terminals return to the workspace without interrupting busy panes", () => {
  assert.deepEqual(
    prepareTmuxWorkspace("/usr/bin/tmux", "laobos-test", "/tmp/project", () => ({ status: 1 })),
    { action: "create" },
  );

  const idleCalls = [];
  const runIdle = (_executable, args) => {
    idleCalls.push(args);
    if (args[0] === "display-message") return { status: 0, stdout: "%7\tzsh\n" };
    return { status: 0, stdout: "" };
  };
  assert.deepEqual(
    prepareTmuxWorkspace("/usr/bin/tmux", "laobos-test", "/tmp/project", runIdle),
    { action: "respawn" },
  );
  assert.deepEqual(idleCalls, [
    ["has-session", "-t", "=laobos-test"],
    ["display-message", "-p", "-t", "=laobos-test:", "#{pane_id}\t#{pane_current_command}"],
    ["respawn-pane", "-k", "-t", "%7", "-c", "/tmp/project"],
  ]);

  const busyCalls = [];
  const runBusy = (_executable, args) => {
    busyCalls.push(args);
    if (args[0] === "display-message") return { status: 0, stdout: "%9\tnode\n" };
    return { status: 0, stdout: "" };
  };
  assert.deepEqual(
    prepareTmuxWorkspace("/usr/bin/tmux", "laobos-test", "/tmp/project", runBusy),
    {
      action: "new-window",
      warning: "原 tmux 窗口正在运行任务，已保留任务并在当前工作区打开新窗口。",
    },
  );
  assert.deepEqual(busyCalls.at(-1), ["new-window", "-t", "=laobos-test", "-c", "/tmp/project"]);
});

test("terminal IPC creates a PTY and streams shell output", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-terminal-"));
  const handlers = new Map();
  const output = [];
  let resolveMarker;
  let markerTimer;
  const markerSeen = new Promise((resolve) => { resolveMarker = resolve; });
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
    removeHandler: (channel) => handlers.delete(channel),
  };
  const cleanup = registerTerminalIpc({
    ipcMain,
    workspace: temporary,
    authorize: () => {},
    getMainWindow: () => ({
      isDestroyed: () => false,
      webContents: {
        send: (channel, payload) => {
          if (channel !== "laobos:terminal:data") return;
          output.push(payload.data);
          if ((output.join("").match(/LAOBOS_PTY_READY/gu) || []).length >= 2) resolveMarker();
        },
      },
    }),
  });
  try {
    const created = await handlers.get("laobos:terminal:create")({}, { tmux: false, cols: 80, rows: 24 });
    assert.equal(created.cwd, await realpath(temporary));
    handlers.get("laobos:terminal:write")({}, { id: created.id, data: "echo LAOBOS_PTY_READY\r" });
    await Promise.race([
      markerSeen,
      new Promise((_, reject) => { markerTimer = setTimeout(() => reject(new Error("终端未返回测试输出。")), 3_000); }),
    ]);
    assert.ok((output.join("").match(/LAOBOS_PTY_READY/gu) || []).length >= 2);
    assert.equal(handlers.get("laobos:terminal:close")({}, { id: created.id }).closed, true);
  } finally {
    clearTimeout(markerTimer);
    cleanup();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("DSH desktop plugins expose every planned capability through a sandboxed preload", async () => {
  const root = new URL("..", import.meta.url);
  const [main, preload, config, conversation, workspace, systemTools, fileAttachments, fileAttachmentsSource, terminal, browser, ssh, apps, sshHost, sshSource, appsSource, buildScript, packageJson] = await Promise.all([
    readFile(new URL("desktop/main.mjs", root), "utf8"),
    readFile(new URL("desktop/preload.cjs", root), "utf8"),
    readFile(new URL("config/laobos.cordis.patch.yml", root), "utf8"),
    readFile(new URL("packages/laobos-conversation-tools/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-workspace-tools/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-system-tools/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-file-attachments/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-file-attachments/src/client.jsx", root), "utf8"),
    readFile(new URL("packages/laobos-terminal-ui/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-browserops/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-ssh/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-app-manager/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-ssh/lib/index.js", root), "utf8"),
    readFile(new URL("packages/laobos-ssh/src/client.jsx", root), "utf8"),
    readFile(new URL("packages/laobos-app-manager/src/client.jsx", root), "utf8"),
    readFile(new URL("scripts/build-desktop-plugins.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(main, /preload,/u);
  assert.match(main, /sandbox:\s*true/u);
  assert.match(main, /registerDesktopDomains/u);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/u);
  for (const capability of ["conversationHtml", "sessionTrash", "workspaceFiles", "gitReview", "uploadSettings", "fileAttachments", "terminal", "browserPreview", "browserElementPicker", "browserOps", "ssh", "apps", "clipboard", "shellManager", "softwareUpdate"]) assert.match(preload, new RegExp(`${capability}: true`, "u"));
  assert.doesNotMatch(preload, /cloudAuth|laobos:cloud-auth/u);
  for (const name of ["dsh-conversation-tools", "dsh-file-attachments", "dsh-workspace-tools", "dsh-terminal-ui", "dsh-browserops", "dsh-ssh", "dsh-app-manager"]) assert.match(config, new RegExp(name, "u"));
  assert.match(conversation, /editAndResend/u); assert.match(conversation, /sessions\.fork/u); assert.match(conversation, /导出为 HTML/u); assert.match(conversation, /contextmenu/u); assert.match(conversation, /closest\("\.lbs-workbench"\)/u);
  assert.match(conversation, /在系统文件管理器中打开/u); assert.match(conversation, /workspace\?\.reveal/u); assert.match(conversation, /清空可恢复目录名称/u); assert.match(conversation, /清空可恢复默认名称/u);
  assert.doesNotMatch(conversation, /"aria-label": "会话操作"/u);
  assert.match(workspace, /文件管理器/u); assert.match(workspace, /版本中心/u); assert.doesNotMatch(workspace, /文件上传路径/u); assert.doesNotMatch(workspace, /lbs-desktop-launcher/u);
  assert.match(workspace, /任务与 Git/u); assert.match(workspace, /conversation\.session\.header\.utilities/u); assert.match(workspace, /data-laobos-task-git-hub/u);
  assert.match(workspace, /conversation\.chat\.turnSummary/u); assert.match(workspace, /data-laobos-conversation-changes/u); assert.match(workspace, /git\.summary/u); assert.match(workspace, /source: "conversation-changes"/u);
  assert.match(workspace, /已编辑.*个文件/u); assert.match(workspace, /lbs-turn-changes-file-stats/u); assert.match(workspace, /本轮 Edit\/Write 操作累计修改的代码行/u);
  assert.match(workspace, /\.lbs-turn-changes-add\{color:var\(--dsw-alias-state-success-primary\)\}/u); assert.match(workspace, /\.lbs-turn-changes-delete\{color:var\(--dsw-alias-state-error-primary\)\}/u);
  assert.match(workspace, /进入版本中心审查/u); assert.doesNotMatch(workspace, /仍可直接打开文件/u);
  assert.match(workspace, /function GitReviewFilesPane/u); assert.match(workspace, /版本变更文件目录树/u); assert.match(workspace, /lbs-git-files-pane/u);
  assert.match(workspace, /grid-template-columns:minmax\(230px,270px\) minmax\(220px,280px\) minmax\(0,1fr\)/u); assert.match(workspace, /\.lbs-git-main \.lbs-diff-scroll\{height:0;overscroll-behavior:contain;scrollbar-gutter:stable\}/u);
  assert.match(workspace, /laobos-task-git-hub-fallback/u); assert.match(workspace, /ProjectTaskGitShellFallback/u); assert.match(workspace, /projectHubHandled/u);
  assert.match(workspace, /收起 Git 变更文件/u); assert.match(workspace, /展开 Git 变更文件/u); assert.match(workspace, /setChangesExpanded/u); assert.match(workspace, /"aria-expanded": changesExpanded/u);
  assert.match(workspace, /提交或推送/u); assert.match(workspace, /Git 提交说明/u); assert.match(workspace, /提交信息（留空将自动生成）/u); assert.match(workspace, /包含未暂存的更改/u);
  assert.match(workspace, /提交并推送/u); assert.match(workspace, /使用当前会话模型/u); assert.match(workspace, /workspace-tools\/commit-message/u); assert.match(workspace, /modelDirectories\.directoryFor/u); assert.match(workspace, /if \(next\) setChangesExpanded\(false\)/u);
  assert.match(workspace, /git\.commit\(\{ root, message, expectedHead: prepared\.head, expectedStatusToken: prepared\.statusToken \}\)/u); assert.match(workspace, /git\.sync\(\{ root, action: "push", remote, expectedHead: committed\.head \}\)/u);
  assert.match(workspace, /event\.detail\?\.source === "project-sidebar"/u); assert.match(workspace, /mode: "full"/u); assert.match(workspace, /useProjection\("todos"\)/u); assert.match(workspace, /useProjection\("goal"\)/u);
  assert.match(preload, /summary: \(input\) => invoke\("laobos:git:summary", input\)/u);
  assert.match(workspace, /body\[data-ds-dark-theme\] \.lbs-workbench/u); assert.match(workspace, /--dsw-alias-markdown-code-block/u); assert.doesNotMatch(workspace, /\.lbs-code-viewer\{background:#0d1117/u);
  assert.match(workspace, /file-open-fallback/u); assert.match(workspace, /lbs-file-menu/u); assert.match(workspace, /lbs-preview-editor/u); assert.match(workspace, /workspace\.write/u); assert.match(workspace, /workspace\.create/u); assert.match(workspace, /workspace\.open/u); assert.match(workspace, /保存并切换/u);
  assert.match(workspace, /function CodeEditor/u); assert.match(workspace, /EditorView/u); assert.match(workspace, /MarkdownText/u); assert.match(workspace, /Markdown 显示方式/u); assert.match(workspace, /使用系统默认方式打开/u);
  assert.match(workspace, /"data-tool": id/u); assert.match(workspace, /grid-template-columns:260px minmax\(0,1fr\)/u); assert.match(workspace, /新建文件夹/u);
  assert.match(workspace, /data-sidebar-collapsed/u); assert.match(workspace, /layout\?\.toggleSidebar/u); assert.match(workspace, /ResizeObserver/u);
  assert.match(workspace, /scrollbar-gutter:stable/u); assert.match(workspace, /function FileIcon/u); assert.match(workspace, /data-kind/u);
  assert.match(systemTools, /id: "laobos-upload-cache"/u); assert.match(systemTools, /DSH Home 私有目录/u); assert.match(systemTools, /当前工作区的 update 文件夹/u); assert.match(systemTools, /id === "trajectory"/u); assert.match(systemTools, /M4\.75 3h1\.5/u);
  assert.doesNotMatch(systemTools, /\{ id: "git", label: "版本中心"/u); assert.match(systemTools, /desktopToolPages = new Set\(\["files", "git"/u);
  assert.doesNotMatch(fileAttachments, /slash\/input-insert-reference/u); assert.match(fileAttachments, /<laobos-file>/u); assert.match(fileAttachments, /priority: -10/u);
  assert.match(fileAttachmentsSource, /lbs-file-card/u); assert.match(fileAttachmentsSource, /pickFiles\(sessionId\)/u); assert.match(fileAttachmentsSource, /serializeFileEnvelope/u);
  assert.match(fileAttachmentsSource, /conversation\.input\.dock/u); assert.match(fileAttachmentsSource, /lbs-file-composer-zone/u); assert.match(fileAttachmentsSource, /function FileSvgIcon/u);
  assert.match(fileAttachmentsSource, /createDraftImages/u); assert.match(fileAttachmentsSource, /添加图片或文件/u);
  assert.match(fileAttachmentsSource, /@keyframes lbs-file-attach-spin/u); assert.match(fileAttachmentsSource, /data-busy=\{busy/u); assert.match(fileAttachmentsSource, /background:transparent;border:0/u);
  assert.match(fileAttachmentsSource, /pendingFilesBySession/u); assert.match(fileAttachmentsSource, /independent file send channel/u); assert.doesNotMatch(fileAttachmentsSource, /insertFileReference/u);
  assert.match(fileAttachmentsSource, /selectedModelSupportsImages/u);
  assert.match(fileAttachmentsSource, /persistImagesAsFiles/u);
  assert.match(fileAttachmentsSource, /selectedModelSupportsImages\(ctx, session\.sessionId\) !== true/u);
  assert.match(fileAttachmentsSource, /renderMessageImages/u);
  assert.match(fileAttachmentsSource, /routedSendSession\(session, text, imageIds, mode, signal\)/u);
  assert.match(fileAttachmentsSource, /return outcome/u);
  assert.doesNotMatch(fileAttachmentsSource, /AttachmentUI/u);
  assert.match(fileAttachmentsSource, /downgradeImages \? \[\] : imageIds/u);
  assert.match(fileAttachmentsSource, /"modelDirectories"/u);
  assert.match(fileAttachmentsSource, /addEventListener\("paste"/u);
  assert.match(fileAttachmentsSource, /addEventListener\("drop", drop, true\)/u);
  assert.match(fileAttachmentsSource, /clipboardData\?\.items/u);
  assert.match(fileAttachmentsSource, /dataTransfer\?\.files/u);
  assert.match(fileAttachmentsSource, /stopImmediatePropagation/u);
  assert.match(fileAttachmentsSource, /pasteFiles\(sessionId/u);
  assert.match(fileAttachmentsSource, /laobosDesktop\?\.clipboard\?\.writeText/u);
  assert.match(fileAttachmentsSource, /复制失败，请重试/u);
  assert.match(fileAttachmentsSource, /pendingBrowserElementsBySession/u); assert.match(fileAttachmentsSource, /BrowserElementGroup/u); assert.match(fileAttachmentsSource, /laobos:add-browser-element-context/u);
  assert.match(preload, /laobos:uploads:paste-files/u);
  assert.match(preload, /laobos:browser:inspect-start/u); assert.match(preload, /laobos:browser:inspect-stop/u); assert.match(preload, /laobos:browser:element-selected/u);
  for (const channel of ["laobos:workspace:write", "laobos:workspace:create", "laobos:workspace:rename", "laobos:workspace:remove", "laobos:workspace:open"]) assert.match(preload, new RegExp(channel, "u"));
  assert.match(buildScript, /jsxFactory: "React\.createElement"/u);
  assert.match(terminal, /laobosDesktop\.terminal\.create/u); assert.match(terminal, /tmuxKey/u); assert.match(terminal, /workspace\.context/u); assert.match(terminal, /\.lbs-terminal-toolbar \.lbs-terminal-tabs\{display:flex!important/u); assert.match(terminal, /desktop-tool-opened/u); assert.doesNotMatch(terminal, /existingTmux/u); assert.match(terminal, /function terminalTheme/u); assert.match(terminal, /data-ds-dark-theme/u); assert.doesNotMatch(terminal, /\.lbs-terminal-panel\{background:#101419/u);
  assert.match(terminal, /\.lbs-terminal-panel\[data-open=false\],\.lbs-terminal-panel\[data-open=false\] \.lbs-terminal-surface\{pointer-events:none!important;visibility:hidden!important\}/u); assert.match(terminal, /"data-open": open/u); assert.doesNotMatch(terminal, /if \(!open\) return null/u);
  assert.match(terminal, /"data-active": open && activeId === tab\.id/u); assert.match(terminal, /active: open && activeId === tab\.id/u); assert.match(terminal, /else terminalRef\.current\?\.blur\(\)/u);
  assert.match(browser, /WebContentsView|browser\.setBounds/u); assert.doesNotMatch(browser, /启动 BrowserOps|停止 BrowserOps/u); assert.match(browser, /点选元素/u); assert.match(browser, /laobos:add-browser-element-context/u);
  assert.match(browser, /conversationBrowserUrlFromClick/u); assert.match(browser, /source: "conversation-link"/u); assert.match(browser, /browser\.navigate\(target\)/u);
  assert.match(ssh, /HOST_KEY_UNKNOWN/u); assert.match(sshSource, /SSH 凭据管理/u); assert.match(ssh, /desktop-tool-opened/u); assert.match(sshSource, /function syncTerminalTheme/u); assert.match(sshSource, /--dsw-alias-bg-base/u);
  assert.match(sshSource, /导入 SSH Config/u); assert.match(sshSource, /系统 ssh-agent/u); assert.match(sshSource, /跳板机/u); assert.match(sshSource, /SFTP 文件管理/u);
  assert.match(sshSource, /\.lbs-ssh-panel\[data-open=false\],\.lbs-ssh-panel\[data-open=false\] \.lbs-ssh-surface\{pointer-events:none!important;visibility:hidden!important\}/u);
  assert.match(sshSource, /data-open=\{open\}/u); assert.match(sshSource, /aria-hidden=\{!open\}/u); assert.match(sshSource, /data-active=\{open && activeId === session\.id\}/u); assert.match(sshSource, /active=\{open && activeId === session\.id\}/u);
  assert.match(sshSource, /else terminalRef\.current\?\.blur\(\)/u); assert.doesNotMatch(sshSource, /if \(!open\) return null/u);
  assert.doesNotMatch(sshSource, /event\.detail\?\.tool === "close"\) \{ setOpen\(false\); setSessions\(\[\]\)/u);
  for (const tool of ["ssh_profiles", "ssh_execute", "ssh_file", "tools/pre-execute"]) assert.match(sshHost, new RegExp(tool.replace("/", "\\/"), "u"));
  assert.match(appsSource, /登记应用/u); assert.match(appsSource, /移出管理/u); assert.match(appsSource, /40000/u); assert.match(appsSource, /自动分配/u); assert.match(apps, /desktop-tool-opened/u); assert.match(appsSource, /--dsw-alias-markdown-code-block/u);
  assert.match(appsSource, /lbs-apps-list-head/u); assert.match(appsSource, /function Icon/u); assert.doesNotMatch(appsSource, /lbs-apps-sidebar/u);
  assert.match(appsSource, /\.lbs-apps-panel\[data-open=false\]\{pointer-events:none!important;visibility:hidden!important\}/u); assert.match(appsSource, /data-open=\{open\}/u); assert.doesNotMatch(appsSource, /if \(!open\) return null/u);
  assert.match(browser, /\.lbs-browser-panel\[data-open=false\]\{pointer-events:none!important;visibility:hidden!important\}/u); assert.match(browser, /"data-open": open/u); assert.doesNotMatch(browser, /if \(!open\) return null/u);
  assert.match(workspace, /const \[visitedPages, setVisitedPages\]/u); assert.match(workspace, /\.lbs-workbench\[data-open=false\]\{pointer-events:none!important;visibility:hidden!important\}/u); assert.match(workspace, /"data-open": selected/u);
  for (const action of ["打开应用", "API 文档", "查看应用", "编辑应用", "移出应用"]) assert.match(appsSource, new RegExp(`aria-label=\\{?[^\\n]*${action}`, "u"));
  for (const method of ["findPort", "apiDoc", "saveApiDoc", "deleteCredential", "forgetHostKey", "importConfig", "sftp", "upload", "download", "inspect", "stage", "unstage", "commit", "branch", "restore", "sync"]) assert.match(preload, new RegExp(`${method}:`, "u"));
  for (const dependency of ["@browserops/bridge", "@xterm/xterm", "node-pty", "ssh2"]) assert.match(packageJson, new RegExp(dependency.replace("/", "\\/"), "u"));
});
