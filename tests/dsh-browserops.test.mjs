import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import {
  browserElementFromReference,
  parseBrowserElementEnvelopes,
  serializeBrowserElementEnvelope,
} from "../packages/laobos-browserops/lib/element-envelope.js";
import { conversationBrowserUrlFromClick } from "../packages/laobos-browserops/lib/conversation-link.js";
import {
  boundsFromBoxModel,
  collectBrowserElementContext,
} from "../desktop/domains/browser-element-inspector.mjs";
import { friendlyInspectError, registerBrowserIpc } from "../desktop/domains/browser.mjs";

function authenticatedUrl(base, username = "test-user", password = "test-password") {
  const url = new URL(base);
  url.username = username;
  url.password = password;
  return url.href;
}

function sampleElement(overrides = {}) {
  return {
    version: 1,
    kind: "browser-element",
    id: "element-1",
    capturedAt: 123,
    page: {
      url: authenticatedUrl("https://example.com/products?token=secret&view=grid#private"),
      title: "商品编辑",
    },
    element: {
      tagName: "button",
      selector: "main > button.save",
      text: "保存 </laobos-browser-element> 修改",
      role: "button",
      accessibleName: "保存",
      attributes: {
        id: "save",
        value: "never-send-this",
        onclick: "steal()",
        href: "/submit?token=secret#private",
        src: "//cdn.example.com/icon.svg?signature=secret",
        "data-testid": "save-button",
      },
      styles: {
        display: "inline-flex",
        color: "rgb(1, 2, 3)",
        "background-image": "url(https://secret.example/token)",
      },
      bounds: { x: 10.125, y: 20.5, width: 120, height: 36 },
      source: { file: "/workspace/src/SaveButton.tsx", line: 42, column: 7, component: "SaveButton" },
    },
    ...overrides,
  };
}

function conversationLinkClick({
  href = "http://127.0.0.1:40500/path?view=1#section",
  insideConversation = true,
  download = false,
  ...event
} = {}) {
  const anchor = {
    closest: (selector) => selector === "[data-conversation-scroll]" && insideConversation ? {} : null,
    getAttribute: (name) => name === "href" ? href : null,
    hasAttribute: (name) => name === "download" && download,
  };
  return {
    button: 0,
    target: { closest: (selector) => selector === "a[href]" ? anchor : null },
    ...event,
  };
}

test("ordinary HTTP conversation links route to the built-in browser", () => {
  assert.equal(
    conversationBrowserUrlFromClick(conversationLinkClick(), "http://127.0.0.1:60000/"),
    "http://127.0.0.1:40500/path?view=1#section",
  );
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ metaKey: true })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ ctrlKey: true })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ shiftKey: true })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ button: 1 })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ defaultPrevented: true })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ insideConversation: false })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ download: true })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ href: "mailto:test@example.com" })), "");
  assert.equal(conversationBrowserUrlFromClick(conversationLinkClick({ href: authenticatedUrl("https://example.com/") })), "");
});

test("browser element envelopes are compact, typed and redact page secrets", () => {
  const context = browserElementFromReference(sampleElement());
  assert.equal(context.page.url, "https://example.com/products");
  assert.deepEqual(context.page.queryKeys, ["token", "view"]);
  assert.equal(context.element.attributes.href, "/submit");
  assert.equal(context.element.attributes.src, "https://cdn.example.com/icon.svg");
  assert.equal(context.element.attributes.value, undefined);
  assert.equal(context.element.attributes.onclick, undefined);
  assert.equal(context.element.styles["background-image"], undefined);
  assert.equal(context.trust, "untrusted-page-content");
  const malformed = browserElementFromReference(sampleElement({
    element: {
      ...sampleElement().element,
      attributes: { href: ["http://", "test-user:test-secret@", "[broken"].join("") },
    },
  }));
  assert.equal(malformed.element.attributes.href, undefined);

  const envelope = serializeBrowserElementEnvelope(context);
  const payload = envelope.slice("<laobos-browser-element>".length, -"</laobos-browser-element>".length);
  assert.doesNotMatch(payload, /<\/laobos-browser-element>/u);
  assert.doesNotMatch(payload, /secret/u);
  const parsed = parseBrowserElementEnvelopes(`请修改这个按钮\n${envelope}\n保持布局。`);
  assert.equal(parsed.text, "请修改这个按钮\n\n保持布局。");
  assert.deepEqual(parsed.elements, [context]);
});

test("invalid browser element envelopes remain visible and cannot enter context", () => {
  const wrongVersion = '<laobos-browser-element>{"version":2,"kind":"browser-element"}</laobos-browser-element>';
  const wrongKind = '<laobos-browser-element>{"version":1,"kind":"file"}</laobos-browser-element>';
  assert.deepEqual(parseBrowserElementEnvelopes(wrongVersion), { text: wrongVersion, elements: [] });
  assert.deepEqual(parseBrowserElementEnvelopes(wrongKind), { text: wrongKind, elements: [] });
  assert.throws(() => browserElementFromReference(sampleElement({ id: "" })), /标识/u);
  assert.throws(() => browserElementFromReference(sampleElement({ page: { url: "file:///tmp/private", title: "bad" } })), /页面地址/u);
});

test("browser element box bounds use the full border quad", () => {
  assert.deepEqual(boundsFromBoxModel({ border: [8, 10, 42, 7, 45, 31, 11, 34] }), {
    x: 8,
    y: 7,
    width: 37,
    height: 27,
  });
  assert.deepEqual(boundsFromBoxModel({ width: 12, height: 9 }), { x: 0, y: 0, width: 12, height: 9 });
});

test("CDP extraction preserves target sessions and keeps only useful element data", async () => {
  const calls = [];
  const sendCommand = async (method, params, sessionId) => {
    calls.push({ method, params, sessionId });
    if (method === "DOM.describeNode") return { node: {
      localName: "button",
      attributes: ["id", "save", "value", "private", "aria-label", "保存", "data-testid", "save-button"],
    } };
    if (method === "DOM.getBoxModel") return { model: { border: [10, 20, 130, 20, 130, 56, 10, 56] } };
    if (method === "Accessibility.getPartialAXTree") return { nodes: [{ backendDOMNodeId: 77, role: { value: "button" }, name: { value: "保存" }, value: { value: "private" } }] };
    if (method === "DOM.pushNodesByBackendIdsToFrontend") return { nodeIds: [42] };
    if (method === "DOM.resolveNode") return { object: { objectId: "object-1" } };
    if (method === "CSS.getComputedStyleForNode") return { computedStyle: [
      { name: "display", value: "inline-flex" },
      { name: "background-image", value: "url(private)" },
    ] };
    if (method === "Runtime.callFunctionOn") return { result: { value: {
      page: { url: "https://example.com/edit?id=42&token=private#row", title: "编辑" },
      selector: "main > button.save",
      text: "保存",
      source: { file: "/workspace/src/SaveButton.tsx", line: 42, component: "SaveButton" },
    } } };
    if (method === "Runtime.releaseObjectGroup") return {};
    throw new Error(`unexpected command ${method}`);
  };

  const context = await collectBrowserElementContext({
    sendCommand,
    backendNodeId: 77,
    sessionId: "oopif-session",
    id: "picked-77",
    capturedAt: 456,
  });

  assert.equal(context.id, "picked-77");
  assert.equal(context.page.url, "https://example.com/edit");
  assert.deepEqual(context.page.queryKeys, ["id", "token"]);
  assert.equal(context.element.role, "button");
  assert.equal(context.element.accessibleName, "保存");
  assert.equal(context.element.attributes.value, undefined);
  assert.equal(context.element.styles.display, "inline-flex");
  assert.equal(context.element.styles["background-image"], undefined);
  assert.deepEqual(context.element.bounds, { x: 10, y: 20, width: 120, height: 36 });
  assert.ok(calls.every((call) => call.sessionId === "oopif-session"));
  assert.ok(calls.some((call) => call.method === "CSS.getComputedStyleForNode" && call.params.nodeId === 42));
  assert.ok(calls.some((call) => call.method === "Runtime.callFunctionOn" && /sensitiveText/u.test(call.params.functionDeclaration)));
  assert.equal(calls.some((call) => call.method === "DOM.getOuterHTML"), false);
});

test("CDP extraction tolerates optional style and accessibility failures", async () => {
  const sendCommand = async (method) => {
    if (method === "DOM.describeNode") return { node: { localName: "div", attributes: [] } };
    if (method === "DOM.getBoxModel" || method === "Accessibility.getPartialAXTree" || method === "DOM.pushNodesByBackendIdsToFrontend" || method === "DOM.resolveNode") throw new Error("gone");
    throw new Error(`unexpected command ${method}`);
  };
  const context = await collectBrowserElementContext({
    sendCommand,
    backendNodeId: 2,
    id: "fallback",
    fallbackPage: { url: "http://127.0.0.1:5173/app?token=x", title: "App" },
  });
  assert.equal(context.page.url, "http://127.0.0.1:5173/app");
  assert.equal(context.element.tagName, "div");
  assert.deepEqual(context.element.styles, {});
  assert.equal(context.element.role, "");
});

test("inspect errors explain debugger contention and stale nodes", () => {
  assert.match(friendlyInspectError(new Error("Another debugger is already attached")), /DevTools/u);
  assert.match(friendlyInspectError(new Error("Internal error: highlight configuration parameter is missing")), /高亮配置/u);
  assert.match(friendlyInspectError(new Error("Could not find node with given id")), /重新选择/u);
});

test("browser IPC owns the debugger lifecycle and emits one sanitized selection", async () => {
  class FakeDebugger extends EventEmitter {
    attached = false;
    attachCount = 0;
    detachCount = 0;
    commands = [];
    attach() { this.attached = true; this.attachCount += 1; }
    detach() { this.attached = false; this.detachCount += 1; }
    isAttached() { return this.attached; }
    async sendCommand(method, params = {}, sessionId) {
      this.commands.push({ method, params, sessionId });
      if (method === "Overlay.setInspectMode" && !params.highlightConfig) {
        throw new Error("Internal error: highlight configuration parameter is missing");
      }
      if (method === "DOM.describeNode") return { node: { localName: "button", attributes: ["aria-label", "保存", "value", "private"] } };
      if (method === "DOM.getBoxModel") return { model: { border: [1, 2, 81, 2, 81, 34, 1, 34] } };
      if (method === "Accessibility.getPartialAXTree") return { nodes: [{ backendDOMNodeId: 9, role: { value: "button" }, name: { value: "保存" } }] };
      if (method === "DOM.pushNodesByBackendIdsToFrontend") return { nodeIds: [19] };
      if (method === "DOM.resolveNode") return { object: { objectId: "button-object" } };
      if (method === "CSS.getComputedStyleForNode") return { computedStyle: [{ name: "display", value: "flex" }] };
      if (method === "Runtime.callFunctionOn") return { result: { value: {
        page: { url: "http://127.0.0.1:5173/demo?token=private", title: "Demo" },
        selector: "button.save",
        text: "保存",
      } } };
      return {};
    }
  }
  class FakeWebContents extends EventEmitter {
    debugger = new FakeDebugger();
    navigationHistory = { canGoBack: () => false, canGoForward: () => false };
    destroyed = false;
    async loadURL() {}
    setWindowOpenHandler() {}
    isDestroyed() { return this.destroyed; }
    isLoading() { return false; }
    isDevToolsOpened() { return false; }
    getTitle() { return "Demo"; }
    reload() {}
    stop() {}
    close() { this.destroyed = true; }
  }
  class FakeView {
    webContents = new FakeWebContents();
    bounds = [];
    setBackgroundColor() {}
    setBounds(value) { this.bounds.push(value); }
    setVisible() {}
  }

  const handlers = new Map();
  const sent = [];
  let previewView;
  const mainWindow = {
    isDestroyed: () => false,
    getContentSize: () => [1_200, 800],
    contentView: { addChildView: (value) => { previewView = value; }, removeChildView: () => {} },
    webContents: { send: (channel, payload) => sent.push({ channel, payload }) },
  };
  const dispose = registerBrowserIpc({
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: (channel) => handlers.delete(channel),
    },
    WebContentsView: FakeView,
    app: { getAppPath: () => "/tmp/app" },
    authorize: () => {},
    getMainWindow: () => mainWindow,
  });
  const waitUntil = async (predicate) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (predicate()) return;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error("timed out waiting for browser IPC");
  };

  await handlers.get("laobos:browser:show")({}, { visible: true });
  await handlers.get("laobos:browser:navigate")({}, { url: "127.0.0.1:5173/demo" });
  const active = await handlers.get("laobos:browser:inspect-start")({});
  assert.equal(active.inspecting, true);
  assert.deepEqual(previewView.webContents.debugger.commands.slice(0, 7).map((entry) => entry.method), [
    "DOM.enable",
    "DOM.getDocument",
    "CSS.enable",
    "Overlay.enable",
    "Accessibility.enable",
    "Runtime.enable",
    "Overlay.setInspectMode",
  ]);
  previewView.webContents.debugger.emit("message", {}, "Overlay.nodeHighlightRequested", { nodeId: 19 }, "child-session");
  assert.equal(sent.some((event) => event.channel === "laobos:browser:element-selected"), false);
  previewView.webContents.debugger.emit("message", {}, "Overlay.inspectNodeRequested", { backendNodeId: 9 }, "child-session");
  await waitUntil(() => sent.some((event) => event.channel === "laobos:browser:element-selected"));
  const selected = sent.find((event) => event.channel === "laobos:browser:element-selected").payload;
  assert.equal(selected.page.url, "http://127.0.0.1:5173/demo");
  assert.deepEqual(selected.page.queryKeys, ["token"]);
  assert.equal(selected.element.attributes.value, undefined);
  await waitUntil(() => previewView.webContents.debugger.isAttached() === false);
  assert.equal(previewView.webContents.debugger.detachCount, 1);
  assert.ok(previewView.webContents.debugger.commands
    .filter((entry) => entry.method === "Overlay.setInspectMode")
    .every((entry) => entry.params.highlightConfig));
  const captureCommands = previewView.webContents.debugger.commands.filter((entry) => [
    "DOM.describeNode",
    "DOM.getBoxModel",
    "Accessibility.getPartialAXTree",
    "DOM.pushNodesByBackendIdsToFrontend",
    "DOM.resolveNode",
    "CSS.getComputedStyleForNode",
    "Runtime.callFunctionOn",
  ].includes(entry.method));
  assert.ok(captureCommands.every((entry) => entry.sessionId === "child-session"));

  await handlers.get("laobos:browser:inspect-start")({});
  await handlers.get("laobos:browser:show")({}, { visible: false });
  assert.equal(previewView.webContents.debugger.isAttached(), false);
  dispose();
  assert.equal(handlers.has("laobos:browser:inspect-start"), false);
  assert.equal(handlers.has("laobos:browser:inspect-stop"), false);
});

test("DSH send channel scopes, restores and removes pending browser context", async () => {
  const source = await readFile(new URL("../packages/laobos-file-attachments/lib/client.js", import.meta.url), "utf8");
  let definition;
  const listeners = new Map();
  const windowObject = {
    __ModuleLoader__: { load: (value) => { definition = value; } },
    addEventListener: (type, listener) => {
      const values = listeners.get(type) || new Set();
      values.add(listener);
      listeners.set(type, values);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    clearTimeout,
    setTimeout,
  };
  const documentObject = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: "" }),
    head: { append: () => {} },
  };
  vm.runInNewContext(source, {
    window: windowObject,
    document: documentObject,
    URL,
    console,
    setTimeout,
    clearTimeout,
  });
  assert.equal(definition.id, "@laobos/dsh-file-attachments");
  const React = {
    Fragment: Symbol("Fragment"),
    createElement: () => null,
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === "function" ? value() : value, () => {}],
  };
  const plugin = definition.factory((id) => {
    if (id === "react") return React;
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return { writeClipboard: async () => false };
    throw new Error(`unexpected module ${id}`);
  });
  const prompts = [];
  let failNext = false;
  const originalSend = async (_session, text) => {
    prompts.push(text);
    if (failNext) { failNext = false; throw new Error("send failed"); }
    return { sent: true };
  };
  const conversation = { sendSession: originalSend };
  const disposers = [];
  const ctx = {
    get: (name) => name === "conversation" ? conversation : undefined,
    effect: (install) => { const dispose = install(); if (typeof dispose === "function") disposers.push(dispose); },
    slots: { inject: () => {} },
    sessions: { list: { getSnapshot: () => ({ byId: { alpha: {}, beta: {} }, current: "alpha" }) } },
  };
  plugin.apply(ctx);
  const dispatchContext = (sessionId, element) => {
    const event = {
      detail: { sessionId, element },
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const listener of listeners.get("laobos:add-browser-element-context") || []) listener(event);
    return event.defaultPrevented;
  };
  const element = sampleElement();
  assert.equal(dispatchContext("alpha", element), true);
  assert.equal(dispatchContext("missing", element), false);

  await conversation.sendSession({ sessionId: "beta" }, "beta text", [], "normal");
  assert.equal(prompts.at(-1), "beta text");
  failNext = true;
  await assert.rejects(() => conversation.sendSession({ sessionId: "alpha" }, "修改颜色", [], "normal"), /send failed/u);
  assert.match(prompts.at(-1), /<laobos-browser-element>/u);
  assert.doesNotMatch(prompts.at(-1), /password|secret/u);
  await conversation.sendSession({ sessionId: "alpha" }, "重试", [], "normal");
  assert.match(prompts.at(-1), /<laobos-browser-element>/u, "failed sends must restore the compact context");
  await conversation.sendSession({ sessionId: "alpha" }, "完成", [], "normal");
  assert.equal(prompts.at(-1), "完成", "successful sends must clear pending context");

  for (const dispose of disposers.reverse()) dispose();
  assert.equal(conversation.sendSession, originalSend);
});

test("editing a user turn hides but preserves file and browser context envelopes", async () => {
  const source = await readFile(new URL("../packages/laobos-conversation-tools/lib/client.js", import.meta.url), "utf8");
  assert.match(source, /CONTEXT_ENVELOPE_PATTERN = \/<\(laobos-file\|laobos-browser-element\)>/u);
  assert.match(source, /context\.kind !== "browser-element"/u);
  assert.match(source, /appendContextEnvelopes\(value, projection\.envelopes\)/u);
  assert.doesNotMatch(source, /appendFileEnvelopes/u);
});
