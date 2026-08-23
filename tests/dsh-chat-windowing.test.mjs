import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CHAT_BOTTOM_THRESHOLD_PX,
  CHAT_VIRTUAL_THRESHOLD,
  chatAnchorScrollTop,
  isNearChatBottom,
  virtualChatPadding,
} from "../packages/laobos-performance/src/chat-window.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("chat windowing enables only after the short-conversation fast path", () => {
  assert.equal(CHAT_VIRTUAL_THRESHOLD, 40);
  assert.equal(isNearChatBottom(1_000, 375, 600), true);
  assert.equal(isNearChatBottom(1_000, 374, 600), false);
  assert.equal(CHAT_BOTTOM_THRESHOLD_PX, 25);
});

test("chat virtual padding retains the full scroll geometry", () => {
  const items = [
    { start: 340, end: 460 },
    { start: 460, end: 600 },
  ];
  assert.deepEqual(virtualChatPadding(items, 1_240, 40), {
    top: 300,
    bottom: 680,
  });
  assert.deepEqual(virtualChatPadding([], 1_240, 40), { top: 0, bottom: 0 });
  assert.equal(chatAnchorScrollTop({ start: 720 }, 18), 702);
  assert.equal(chatAnchorScrollTop(undefined, 18), undefined);
});

test("performance plugin delegates from the official chat cell and keeps its child slots", async () => {
  const [manifestText, source, client, buildScript, locator, conversationPatch] = await Promise.all([
    readFile(path.join(projectRoot, "packages/laobos-performance/package.json"), "utf8"),
    readFile(path.join(projectRoot, "packages/laobos-performance/src/client.jsx"), "utf8"),
    readFile(path.join(projectRoot, "packages/laobos-performance/lib/client.js"), "utf8"),
    readFile(path.join(projectRoot, "scripts/build-desktop-plugins.mjs"), "utf8"),
    readFile(path.join(projectRoot, "packages/laobos-system-tools/lib/client.js"), "utf8"),
    readFile(path.join(projectRoot, "patches/@deepseek-ai+dsh-client-ui-conversation+0.1.0-rc.8.patch"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.dsh.client.platform, "web");
  assert.ok(manifest.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-conversation"));
  assert.match(buildScript, /laobos-performance\/src\/client\.jsx/u);
  assert.match(source, /__laobosChatPerformance = chatPerformanceRegistration/u);
  assert.match(source, /laobos:chat-performance-change/u);
  assert.match(source, /renderSlot\("conversation\.chat\.node"/u);
  assert.match(source, /CHAT_VIRTUAL_THRESHOLD/u);
  assert.match(source, /function taskTurnMetadata\(order, nodeStore\)/u);
  assert.match(source, /data-chat-session-id=\{sessionId\}/u);
  assert.match(source, /data-chat-flow-host=""/u);
  assert.match(source, /data-chat-flow-turn=\{turn \?\? undefined\}/u);
  assert.match(client, /new Virtualizer/u);
  assert.match(client, /data-chat-windowed/u);
  assert.match(client, /__laobosChatWindowing/u);
  assert.match(locator, /scrollToWindowedEntry/u);
  assert.match(locator, /__laobosChatWindowing/u);
  assert.match(conversationPatch, /function DefaultChatView/u);
  assert.match(conversationPatch, /CHAT_PERFORMANCE_KIT/u);
  assert.match(conversationPatch, /useSyncExternalStore/u);
  assert.match(conversationPatch, /chatKit: CHAT_PERFORMANCE_KIT/u);
});

test("optimized chat view renders the official empty snapshot contract", async () => {
  const client = await readFile(
    path.join(projectRoot, "packages/laobos-performance/lib/client.js"),
    "utf8",
  );
  const context = {
    console,
    Event: class Event {},
    window: {
      addEventListener() {},
      dispatchEvent() {},
      removeEventListener() {},
      __ModuleLoader__: {
        load(definition) {
          context.definition = definition;
        },
      },
    },
  };
  vm.runInNewContext(client, context, { filename: "laobos-performance-client.js" });
  context.definition.factory((id) => {
    if (id === "react") return React;
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
    throw new Error(`unexpected browser module: ${id}`);
  });
  const ChatView = context.window.__laobosChatPerformance.ChatView;
  const sessionSnapshot = {
    blank: false,
    chat: {
      order: [],
      nodes: new Map(),
      timeline: { turns: new Map() },
    },
    queue: [],
    running: false,
    openState: "open",
    openError: null,
    hasMore: false,
    loadingOlder: false,
  };
  const renderChat = () => renderToStaticMarkup(React.createElement(ChatView, {
    useSession: (selector) => selector(sessionSnapshot),
    useSessions: (selector) => selector({ byId: { session: { cwd: projectRoot } } }),
    useStore: (selector) => selector({ selection: null }),
    renderSlot: () => null,
    sessionId: "session",
    openFile: async () => {},
    loadOlder: () => {},
    loadImage: async () => undefined,
    inspectCall: () => {},
    chatScroll: { read: () => null, save: () => {} },
    forkAt: () => {},
    fileMentions: () => undefined,
    t: (key) => key,
  }));
  const markup = renderChat();
  assert.match(markup, /class="lbs-chat-window-root"/u);
  assert.match(markup, /data-chat-windowed="false"/u);
  assert.match(markup, /data-chat-rendered-count="0"/u);

  sessionSnapshot.chat.order = ["user-1", "tool-1", "answer-1", "tail-1"];
  sessionSnapshot.chat.nodes = new Map([
    ["user-1", { key: "user-1", kind: "user", data: {} }],
    ["tool-1", {
      key: "tool-1",
      kind: "tool-call",
      location: { kind: "turn", turn: { turn: 1 } },
      data: { turn: 1 },
    }],
    ["answer-1", {
      key: "answer-1",
      kind: "assistant-step",
      location: { kind: "step", turn: { turn: 1 } },
      data: { turn: 1, finalNode: { seq: 12 } },
    }],
    ["tail-1", {
      key: "tail-1",
      kind: "turn-tail",
      location: { kind: "turn", turn: { turn: 1 } },
      data: { turn: 1, closing: { finalNode: { seq: 12 } } },
    }],
  ]);
  const turnMarkup = renderChat();
  assert.match(
    turnMarkup,
    /data-chat-flow=""[\s\S]*class="lbs-chat-window-list"[\s\S]*class="lbs-chat-window-row"[\s\S]*data-chat-flow-kind="tool-call"/u,
  );
  assert.match(turnMarkup, /data-chat-session-id="session"/u);
  assert.match(turnMarkup, /data-chat-flow-host=""/u);
  assert.match(turnMarkup, /data-chat-flow-row=""/u);
  assert.match(turnMarkup, /data-chat-flow-turn="1"/u);
  assert.match(turnMarkup, /data-chat-flow-completed="true"/u);
  assert.match(turnMarkup, /data-chat-flow-final="true"/u);
  assert.match(turnMarkup, /data-chat-flow-process-count="1"/u);
  assert.match(turnMarkup, /data-chat-flow-tool-count="1"/u);

  sessionSnapshot.chat.order = Array.from({ length: 1_000 }, (_, index) => `node-${index}`);
  sessionSnapshot.chat.nodes = new Map(sessionSnapshot.chat.order.map((key) => [key, {
    key,
    kind: "user",
    data: {},
  }]));
  const longMarkup = renderChat();
  const renderedRows = longMarkup.match(/class="lbs-chat-window-row"/gu)?.length || 0;
  assert.match(longMarkup, /data-chat-windowed="true"/u);
  assert.ok(renderedRows > 0 && renderedRows < 30, `expected a bounded row window, got ${renderedRows}`);
});
