import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import {
  detectApplication,
  findFreeApplicationPort,
  MANAGED_APP_MAX_PORT,
  MANAGED_APP_MIN_PORT,
  normalizeManagedAppPort,
  registerAppsIpc,
  splitArgs,
} from "../desktop/domains/apps.mjs";
import { normalizeBrowserUrl } from "../desktop/domains/browser.mjs";
import { safePdfName } from "../desktop/domains/conversation-export.mjs";
import { DesktopSettingsStore } from "../desktop/domains/desktop-settings.mjs";
import { parseGitStatus } from "../desktop/domains/git-review.mjs";
import { isPathInside, resolveAuthorizedPath } from "../desktop/ipc-security.mjs";
import { findSessionDirectory } from "../desktop/domains/session-trash.mjs";
import { fingerprint } from "../desktop/domains/ssh.mjs";
import {
  copyManagedUploadFiles,
  managedUploadRoot,
  readPickedAttachments,
  safeUploadFileName,
  storeManagedPastedFiles,
} from "../desktop/domains/workspace-files.mjs";
import {
  findExecutable,
  prepareTmuxWorkspace,
  registerTerminalIpc,
  tmuxSessionName,
} from "../desktop/domains/terminal.mjs";

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

test("desktop settings persist upload location atomically", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-settings-"));
  const file = path.join(temporary, "settings.json");
  try {
    const store = new DesktopSettingsStore(file);
    assert.equal((await store.get()).uploadLocation, "default");
    await store.update({ uploadLocation: "workspace" });
    const restored = new DesktopSettingsStore(file);
    assert.deepEqual(await restored.get(), {
      version: 2,
      uploadLocation: "workspace",
    });
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
    assert.equal(workspaceFile.name, "报告 <最终>.txt");
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

test("native helper contracts normalize PDF, Git, browser, SSH and tmux values", () => {
  assert.equal(safePdfName('项目/A: "会话"'), "项目-A- -会话-.pdf");
  assert.deepEqual(parseGitStatus("## main...origin/main\0 M src/a.js\0?? notes.txt\0"), {
    branch: "main",
    changes: [
      { index: " ", worktree: "M", path: "src/a.js" },
      { index: "?", worktree: "?", path: "notes.txt" },
    ],
  });
  assert.equal(normalizeBrowserUrl("localhost:3000"), "http://localhost:3000/");
  assert.throws(() => normalizeBrowserUrl("file:///tmp/a"), /HTTP\(S\)/u);
  assert.match(fingerprint(Buffer.from("host-key")), /^SHA256:/u);
  assert.equal(tmuxSessionName("/tmp/workspace"), tmuxSessionName("/tmp/workspace"));
  assert.notEqual(tmuxSessionName("/tmp/a"), tmuxSessionName("/tmp/b"));
  assert.notEqual(tmuxSessionName("/tmp/workspace", "terminal-1"), tmuxSessionName("/tmp/workspace", "terminal-2"));
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
  const [main, preload, config, conversation, workspace, systemTools, fileAttachments, fileAttachmentsSource, terminal, browser, ssh, apps, sshSource, appsSource, buildScript, packageJson] = await Promise.all([
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
    readFile(new URL("packages/laobos-ssh/src/client.jsx", root), "utf8"),
    readFile(new URL("packages/laobos-app-manager/src/client.jsx", root), "utf8"),
    readFile(new URL("scripts/build-desktop-plugins.mjs", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(main, /preload,/u);
  assert.match(main, /sandbox:\s*true/u);
  assert.match(main, /registerDesktopDomains/u);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/u);
  for (const capability of ["conversationPdf", "sessionTrash", "workspaceFiles", "gitReview", "uploadSettings", "fileAttachments", "terminal", "browserPreview", "browserOps", "ssh", "apps"]) assert.match(preload, new RegExp(`${capability}: true`, "u"));
  for (const name of ["dsh-conversation-tools", "dsh-file-attachments", "dsh-workspace-tools", "dsh-terminal-ui", "dsh-browserops", "dsh-ssh", "dsh-app-manager"]) assert.match(config, new RegExp(name, "u"));
  assert.match(conversation, /editAndResend/u); assert.match(conversation, /sessions\.fork/u); assert.match(conversation, /导出会话为 PDF/u); assert.match(conversation, /contextmenu/u);
  assert.match(workspace, /文件管理器/u); assert.match(workspace, /版本中心/u); assert.doesNotMatch(workspace, /文件上传路径/u); assert.doesNotMatch(workspace, /lbs-desktop-launcher/u);
  assert.match(systemTools, /id: "laobos-upload-cache"/u); assert.match(systemTools, /DSH Home 私有目录/u); assert.match(systemTools, /当前工作区的 update 文件夹/u);
  assert.doesNotMatch(fileAttachments, /slash\/input-insert-reference/u); assert.match(fileAttachments, /<laobos-file>/u); assert.match(fileAttachments, /priority: -10/u);
  assert.match(fileAttachmentsSource, /lbs-file-card/u); assert.match(fileAttachmentsSource, /pickFiles\(sessionId\)/u); assert.match(fileAttachmentsSource, /serializeFileEnvelope/u);
  assert.match(fileAttachmentsSource, /conversation\.input\.dock/u); assert.match(fileAttachmentsSource, /lbs-file-composer-zone/u); assert.match(fileAttachmentsSource, /function FileSvgIcon/u);
  assert.match(fileAttachmentsSource, /createDraftImages/u); assert.match(fileAttachmentsSource, /添加图片或文件/u);
  assert.match(fileAttachmentsSource, /@keyframes lbs-file-attach-spin/u); assert.match(fileAttachmentsSource, /data-busy=\{busy/u); assert.match(fileAttachmentsSource, /background:transparent;border:0/u);
  assert.match(fileAttachmentsSource, /pendingFilesBySession/u); assert.match(fileAttachmentsSource, /independent file send channel/u); assert.doesNotMatch(fileAttachmentsSource, /insertFileReference/u);
  assert.match(fileAttachmentsSource, /addEventListener\("paste"/u);
  assert.match(fileAttachmentsSource, /clipboardData\?\.items/u);
  assert.match(fileAttachmentsSource, /pasteFiles\(sessionId/u);
  assert.match(preload, /laobos:uploads:paste-files/u);
  assert.match(buildScript, /jsxFactory: "React\.createElement"/u);
  assert.match(terminal, /laobosDesktop\.terminal\.create/u); assert.match(terminal, /tmuxKey/u); assert.match(terminal, /workspace\.context/u); assert.match(terminal, /\.lbs-terminal-toolbar \.lbs-terminal-tabs\{display:flex!important/u); assert.match(terminal, /desktop-tool-opened/u); assert.doesNotMatch(terminal, /existingTmux/u);
  assert.match(browser, /WebContentsView|browser\.setBounds/u); assert.match(browser, /BrowserOps/u);
  assert.match(ssh, /HOST_KEY_UNKNOWN/u); assert.match(sshSource, /SSH 凭据管理/u); assert.match(ssh, /desktop-tool-opened/u);
  assert.match(appsSource, /登记应用/u); assert.match(appsSource, /移出管理/u); assert.match(appsSource, /40000/u); assert.match(appsSource, /自动分配/u); assert.match(apps, /desktop-tool-opened/u);
  assert.match(appsSource, /lbs-apps-list-head/u); assert.match(appsSource, /function Icon/u); assert.doesNotMatch(appsSource, /lbs-apps-sidebar/u);
  for (const action of ["打开应用", "API 文档", "查看应用", "编辑应用", "移出应用"]) assert.match(appsSource, new RegExp(`aria-label=\\{?[^\\n]*${action}`, "u"));
  for (const method of ["findPort", "apiDoc", "saveApiDoc", "deleteCredential", "forgetHostKey", "inspect", "stage", "unstage", "commit", "branch", "restore", "sync"]) assert.match(preload, new RegExp(`${method}:`, "u"));
  for (const dependency of ["@browserops/bridge", "@xterm/xterm", "node-pty", "ssh2"]) assert.match(packageJson, new RegExp(dependency.replace("/", "\\/"), "u"));
});
