import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPlatformRuntime } from "../packages/laobos-platform-bridge/lib/index.js";
import { apply as applySshTools } from "../packages/laobos-ssh/lib/index.js";

const root = new URL("..", import.meta.url);

test("the browser bridge is bundled before every desktop-dependent client plugin", async () => {
  const [config, localPlugins, source, built, host, buildScript] = await Promise.all([
    readFile(new URL("config/laobos.cordis.patch.yml", root), "utf8"),
    readFile(new URL("desktop/local-plugins.mjs", root), "utf8"),
    readFile(new URL("packages/laobos-platform-bridge/src/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-platform-bridge/lib/client.js", root), "utf8"),
    readFile(new URL("packages/laobos-platform-bridge/lib/index.js", root), "utf8"),
    readFile(new URL("scripts/build-desktop-plugins.mjs", root), "utf8"),
  ]);

  assert.match(localPlugins, /"laobos-platform-bridge"/u);
  assert.match(buildScript, /laobos-platform-bridge\/src\/client\.js/u);
  assert.ok(config.indexOf("dsh-platform-bridge") < config.indexOf("dsh-workspace-tools"));
  assert.match(source, /Object\.defineProperty\(window, "laobosDesktop"/u);
  assert.match(source, /transport: "same-origin-loopback-http"/u);
  for (const capability of ["workspaceFiles", "gitReview", "fileAttachments", "terminal", "ssh", "apps"]) {
    assert.match(source, new RegExp(`${capability}: true`, "u"));
  }
  assert.match(source, /browserPreview: false/u);
  assert.match(source, /browserElementPicker: false/u);
  assert.match(source, /chooseFiles/u);
  assert.match(source, /summary: call\("git\.summary"\)/u);
  assert.match(source, /laobos:terminal:data/u);
  assert.match(source, /laobos:ssh:data/u);
  assert.match(built, /installLaobosBrowserBridge/u);
  assert.match(host, /LOOPBACK_REQUIRED/u);
  assert.match(host, /ORIGIN_REJECTED/u);
  assert.match(host, /MAX_RPC_BODY_BYTES/u);
  assert.match(host, /registerWorkspaceFilesIpc/u);
  assert.match(host, /\["git\.summary", "laobos:git:summary"\]/u);
  assert.match(host, /aes-256-gcm/u);
});

test("the platform runtime serves workspace, upload, SSH vault and PTY operations without Electron", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-platform-bridge-test-"));
  const dshHome = path.join(temporary, ".dsh");
  const textPath = path.join(temporary, "hello.txt");
  const previousUrl = process.env.LAOBOS_SSH_BRIDGE_URL;
  const previousToken = process.env.LAOBOS_SSH_BRIDGE_TOKEN;
  await writeFile(textPath, "before\n");
  const runtime = await createPlatformRuntime({
    studioRoot: fileURLToPath(new URL("..", import.meta.url)),
    dshHome,
    workspace: temporary,
  });
  let terminalId = "";
  try {
    const context = await runtime.invoke("workspace.context");
    assert.equal(context.root, temporary);
    assert.deepEqual(context.authorizedRoots, [temporary]);
    assert.equal((await runtime.invoke("git.summary", { root: temporary, paths: ["hello.txt"] })).isRepository, false);

    const preview = await runtime.invoke("workspace.read", { root: temporary, path: "hello.txt" });
    assert.equal(preview.content, "before\n");
    await runtime.invoke("workspace.write", {
      root: temporary,
      path: "hello.txt",
      content: "after\n",
      expectedModifiedAt: preview.modifiedAt,
    });
    assert.equal(await readFile(textPath, "utf8"), "after\n");
    const created = await runtime.invoke("workspace.create", { root: temporary, parent: ".", name: "created.txt", type: "file" });
    assert.equal(created.path, "created.txt");
    assert.equal(await readFile(path.join(temporary, created.path), "utf8"), "");
    assert.equal((await runtime.invoke("workspace.remove", { root: temporary, path: created.path })).removed, true);

    const uploaded = await runtime.invoke("uploads.pasteFiles", {
      sessionId: "browser-test",
      files: [{ name: "notes.txt", mimeType: "text/plain", bytes: new Uint8Array([111, 107, 10]) }],
    });
    assert.equal(uploaded.files[0].name, "notes.txt");
    assert.equal(await readFile(uploaded.files[0].path, "utf8"), "ok\n");

    const ssh = await runtime.invoke("ssh.list");
    assert.equal(ssh.encryptionAvailable, true);
    const tools = new Map();
    applySshTools({
      logger: { warn: () => {} },
      tools: { register: (definition) => { tools.set(definition.name, definition); return () => {}; } },
      systemPrompt: { section: () => () => {} },
      on: () => () => {},
    });
    assert.deepEqual((await tools.get("ssh_profiles").execute({}, {})).profiles, []);
    assert.equal(process.env.LAOBOS_SSH_BRIDGE_TOKEN, undefined);

    const terminal = await runtime.invoke("terminal.create", { cwd: temporary, cols: 80, rows: 24 });
    terminalId = terminal.id;
    await runtime.invoke("terminal.write", { id: terminal.id, data: "echo LAOBOS_BROWSER_BRIDGE_READY\r" });
    const deadline = Date.now() + 5_000;
    let cursor = 0;
    let output = "";
    while (Date.now() < deadline && !output.includes("LAOBOS_BROWSER_BRIDGE_READY")) {
      const events = await runtime.events.wait(cursor, 500);
      for (const event of events) {
        cursor = Math.max(cursor, event.seq);
        if (event.channel === "laobos:terminal:data" && event.payload.id === terminal.id) output += event.payload.data;
      }
    }
    assert.match(output, /LAOBOS_BROWSER_BRIDGE_READY/u);
    assert.equal((await runtime.invoke("terminal.close", { id: terminal.id })).closed, true);
    terminalId = "";
  } finally {
    if (terminalId) await runtime.invoke("terminal.close", { id: terminalId }).catch(() => {});
    await runtime.dispose();
    if (previousUrl === undefined) delete process.env.LAOBOS_SSH_BRIDGE_URL;
    else process.env.LAOBOS_SSH_BRIDGE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.LAOBOS_SSH_BRIDGE_TOKEN;
    else process.env.LAOBOS_SSH_BRIDGE_TOKEN = previousToken;
    await rm(temporary, { recursive: true, force: true });
  }
});
