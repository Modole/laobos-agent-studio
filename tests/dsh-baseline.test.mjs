import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  extractDshUrl,
  startDshRuntime,
} from "../desktop/dsh-runtime.mjs";
import {
  ensureExecutableFile,
  ensureNodePtySpawnHelper,
} from "../scripts/ensure-node-pty-helper.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "..");

test("DSH runtime is pinned to the validated release", async () => {
  const packageJson = JSON.parse(
    await readFile(join(projectRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.dependencies["@deepseek-ai/dsh"], "0.1.0-rc.6");
});

test("the node-pty spawn helper permission is repaired deterministically", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "laobos-pty-mode-test-"));
  const helper = join(temporaryRoot, "spawn-helper");

  try {
    await writeFile(helper, "test");
    await chmod(helper, 0o644);
    assert.equal(ensureExecutableFile(helper), true);
    assert.equal((await stat(helper)).mode & 0o111, 0o111);
    assert.equal(ensureExecutableFile(helper), false);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test(
  "macOS Bash PTY starts after the runtime permission repair",
  { skip: process.platform !== "darwin" },
  async () => {
    const helper = ensureNodePtySpawnHelper(projectRoot);
    assert.equal((await stat(helper)).mode & 0o111, 0o111);

    const imported = await import("node-pty");
    const nodePty = imported.default || imported;
    let output = "";
    const terminal = nodePty.spawn("/bin/sh", ["-c", "printf pty-ok"], {
      cwd: projectRoot,
      env: process.env,
    });
    await new Promise((resolveAfterExit, rejectAfterTimeout) => {
      const timeout = setTimeout(() => {
        terminal.kill();
        rejectAfterTimeout(new Error("node-pty smoke test timed out"));
      }, 5_000);
      terminal.onData((chunk) => {
        output += chunk;
      });
      terminal.onExit(() => {
        clearTimeout(timeout);
        resolveAfterExit();
      });
    });
    assert.match(output, /pty-ok/);
  },
);

test("the project sidebar uses compact persisted width bounds", async () => {
  const client = await readFile(
    join(projectRoot, "packages", "laobos-system-tools", "lib", "client.js"),
    "utf8",
  );

  assert.match(client, /RIGHT_SIDEBAR_DEFAULT_WIDTH = 120/);
  assert.match(client, /RIGHT_SIDEBAR_MIN_WIDTH = 112/);
  assert.match(client, /RIGHT_SIDEBAR_MAX_WIDTH = 180/);
});

test("completed task records collapse as a turn and preserve the final answer", async () => {
  const client = await readFile(
    join(projectRoot, "packages", "laobos-system-tools", "lib", "client.js"),
    "utf8",
  );

  assert.match(client, /function TaskRecordFoldBridge\(\)/);
  assert.match(client, /data-chat-flow-kind/);
  assert.match(client, /data-turn-tail/);
  assert.match(client, /lbs-task-process-hidden/);
  assert.match(client, /lbs-task-final-collapsed/);
  assert.match(client, /已执行 \$\{toolCount\} 项操作/);
  assert.match(client, /工作了 \$\{duration\}/);
  assert.doesNotMatch(client, /lbs-tool-running-info/);
});

test("conversation locator exposes turn markers, previews and click navigation", async () => {
  const client = await readFile(
    join(projectRoot, "packages", "laobos-system-tools", "lib", "client.js"),
    "utf8",
  );

  assert.match(client, /function ConversationLocatorBridge\(\{ locatorSource \}\)/);
  assert.match(client, /function createConversationLocatorSource\(sessions\)/);
  assert.match(client, /aria-label", "对话记录定位"/);
  assert.match(client, /lbs-conversation-locator-mark/);
  assert.match(client, /kind === "user" \|\| kind === "steering"/);
  assert.match(client, /snapshot\.chat\.timeline/);
  assert.match(client, /laobosConversationLocator/);
  assert.match(client, /locatorIndex/);
  assert.match(client, /candidate\.seq === targetSeq/);
  assert.match(client, /currentSession\.loadOlder\(\)/);
  assert.match(client, /点击自动加载/);
  assert.match(client, /const conversationIsVisible/);
  assert.match(client, /document\.elementFromPoint\(probeX, probeY\)/);
  assert.match(client, /marginCenterLeft/);
  assert.match(client, /attributes: true/);
  assert.match(client, /__laobosConversationLocatorBridge/);
  assert.match(client, /window\[singletonKey\]\?\.dispose\?\.\(\)/);
  assert.match(client, /const displayedKey = loadingKey \|\| activeKey/);
  assert.match(client, /let longMarkerAssigned = false/);
  assert.match(client, /width:18px/);
  assert.match(client, /activePage === "conversation" && nativeView === "chat"/);
  assert.match(client, /pageListeners\.add\(onPageVisibilityChange\)/);
  assert.match(client, /nativeViewListeners\.add\(onPageVisibilityChange\)/);
  assert.match(client, /if \(!conversationPageIsActive\(\)\) hideLocator\(\)/);
  assert.match(client, /host\.scrollTo\(\{/);
});

test("conversation locator projection indexes every direct human message", async () => {
  const server = await readFile(
    join(projectRoot, "packages", "laobos-system-tools", "lib", "index.js"),
    "utf8",
  );

  assert.match(server, /key: "laobosConversationLocator"/);
  assert.match(server, /event\.type !== "user\/message"/);
  assert.match(server, /event\.data\.source\?\.kind !== "user"/);
  assert.match(server, /seq: event\.seq/);
  assert.match(server, /question: locatorQuestion/);
});

test("conversation actions stay compact and attach edit/retry to only the latest user message", async () => {
  const client = await readFile(
    join(projectRoot, "packages", "laobos-conversation-tools", "lib", "client.js"),
    "utf8",
  );

  assert.match(client, /\.lbs-conv-menu\.fixed\{[^}]*right:auto/);
  assert.match(client, /conversation\.session\.header[^}]*padding:6px 28px 6px 20px!important/);
  assert.match(client, /function latestUserActionTarget\(nodeKey\)/);
  assert.match(client, /ReactDOM\.createPortal/);
  assert.match(client, /IconEditOutline16/);
  assert.match(client, /IconRefreshOutline16/);
  assert.match(client, /data-chat-anchor-key/);
  assert.match(client, /data-time-hover-root[^}]*flex-direction:column!important/);
});

test("the 劳博士 browser plugin injects Cordis services rather than package ids", async () => {
  const client = await readFile(
    join(projectRoot, "packages", "laobos-system-tools", "lib", "client.js"),
    "utf8",
  );
  assert.match(client, /const inject = \["slots", "sessions"\]/);
  assert.match(client, /const brandName = "劳博士"/);
  assert.match(client, /document\.title = brandName/);
  assert.match(client, /brand\/manifest\.webmanifest/);
  assert.match(client, /dataset\.laobosMainBrand = "true"/);
  assert.match(client, /element\.textContent = brandName/);
  assert.match(client, /dataset\.laobosPreviewBadge = "true"/);
  assert.match(client, /function SkipWelcomeNotice/);
  assert.match(client, /id: "welcome-notice"/);
  assert.match(client, /priority: -1000/);
  assert.doesNotMatch(
    client,
    /const inject = \["@deepseek-ai\/dsh-client-runtime"/,
  );
});

test("the four official Agent presets are installed", async () => {
  const presetRoot = join(
    projectRoot,
    "node_modules",
    "@deepseek-ai",
    "dsh",
    "config",
    "agent-presets",
  );
  const expectedPresets = {
    standard: "标准模式",
    code: "PTC 模式",
    minimal: "极简模式",
    cordis: "创造模式",
  };

  for (const [presetId, displayName] of Object.entries(expectedPresets)) {
    const metadata = await readFile(
      join(presetRoot, presetId, "preset.yml"),
      "utf8",
    );
    assert.match(metadata, new RegExp(`name:\\s*[\"']?${displayName}`));
  }
});

test("composed web profile contains safety, approval and mode UI", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "laobos-dsh-test-"));
  const dshHome = join(temporaryRoot, "home");
  const workspace = join(temporaryRoot, "workspace");

  try {
    const mkdir = await import("node:fs/promises").then(({ mkdir }) => mkdir);
    await mkdir(workspace);
    const result = spawnSync(
      process.execPath,
      [join(projectRoot, "scripts", "start-dsh.mjs"), "--dump-config"],
      {
        cwd: workspace,
        env: {
          ...process.env,
          LAOBOS_DSH_HOME: dshHome,
          DSH_TELEMETRY_DISABLED: "1",
        },
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );

    assert.equal(
      result.status,
      0,
      `配置合成失败：${result.stderr || result.stdout}`,
    );

    const composed = `${result.stdout}\n${result.stderr}`;
    for (const pluginId of [
      "sandbox-policy",
      "approval",
      "permission",
      "agent-presets",
      "ui-agent-preset",
      "ui-permission",
      "ui-plan",
    ]) {
      assert.match(composed, new RegExp(`id:\\s+${pluginId}(?:\\s|$)`));
    }
    assert.match(composed, /defaultPreset:\s+workspace-write/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("desktop runtime lifecycle boots DSH on a private random port", async () => {
  assert.equal(extractDshUrl("dsh web: http://127.0.0.1:4317\n"), "http://127.0.0.1:4317");

  const temporaryRoot = await mkdtemp(join(tmpdir(), "laobos-desktop-test-"));
  const workspace = join(temporaryRoot, "workspace");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(workspace);

  const runtime = startDshRuntime({
    nodeExecutable: process.execPath,
    dshBin: join(
      projectRoot,
      "node_modules",
      "@deepseek-ai",
      "dsh",
      "lib",
      "bin.js",
    ),
    patchFile: join(projectRoot, "config", "laobos.cordis.patch.yml"),
    workspace,
    dshHome: join(temporaryRoot, "home"),
  });

  try {
    const url = await runtime.ready;
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /DeepSeek Harness/);
    assert.match(html, /@laobos\/dsh-system-tools/);
    const brandManifest = await fetch(
      `${url}/laobos/api/system-tools/brand/manifest.webmanifest`,
      { signal: AbortSignal.timeout(10_000) },
    );
    assert.equal(brandManifest.status, 200);
    assert.match(brandManifest.headers.get("content-type") || "", /^application\/manifest\+json/);
    assert.equal((await brandManifest.json()).name, "劳博士");
    const brandIcon = await fetch(`${url}/laobos/api/system-tools/brand/icon.png`, {
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(brandIcon.status, 200);
    assert.equal(brandIcon.headers.get("content-type"), "image/png");
    assert.ok((await brandIcon.arrayBuffer()).byteLength > 100_000);
    const systemTools = await fetch(`${url}/laobos/api/system-tools/overview`, {
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(systemTools.status, 200);
    assert.deepEqual(await systemTools.json(), {
      collections: [],
      workflows: [],
      skills: [],
      mcp: [],
    });
    await new Promise((resolveAfterDelay) => setTimeout(resolveAfterDelay, 300));
    assert.equal(runtime.child.exitCode, null);
    assert.equal(runtime.child.signalCode, null);
  } finally {
    await runtime.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
