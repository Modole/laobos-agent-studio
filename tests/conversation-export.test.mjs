import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  registerConversationExportIpc,
  safeHtmlName,
} from "../desktop/domains/conversation-export.mjs";

test("conversation export saves the complete standalone DSH HTML", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-conversation-export-"));
  const output = path.join(temporary, "完整会话.html");
  const handlers = new Map();
  const removed = [];
  let authorized = false;

  const dispose = registerConversationExportIpc({
    ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: (channel) => removed.push(channel),
    },
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: output }) },
    app: { getPath: () => temporary },
    authorize: () => { authorized = true; },
    getMainWindow: () => ({}),
  });

  try {
    const html = "<!doctype html><title>完整会话</title><p>用户输入与 Agent 回复</p>";
    const result = await handlers.get("laobos:html:export-conversation")(
      {},
      { html, suggestedName: "完整会话" },
    );
    assert.equal(authorized, true);
    assert.deepEqual(result, { canceled: false, filePath: output });
    assert.equal(await readFile(output, "utf8"), html);
    assert.equal(safeHtmlName('项目/A: "会话"'), "项目-A- -会话-.html");
  } finally {
    dispose();
    assert.deepEqual(removed, ["laobos:html:export-conversation"]);
    await rm(temporary, { recursive: true, force: true });
  }
});

test("conversation client expands folded DSH content before serializing standalone HTML", async () => {
  const source = await readFile(new URL("../packages/laobos-conversation-tools/lib/client.js", import.meta.url), "utf8");
  assert.match(source, /expandFoldedContent/u);
  assert.match(source, /aria-expanded=\\?"false\\?"/u);
  assert.match(source, /annotateFoldedContent/u);
  assert.match(source, /data-lbs-export-toggle/u);
  assert.match(source, /addEventListener\("click",flip\)/u);
  assert.match(source, /standaloneConversationHtml/u);
  assert.match(source, /inlineImageAssets/u);
  assert.match(source, /\[data-chat-flow-kind=\\?"context\\?"\]\{display:none!important\}/u);
  assert.doesNotMatch(source, /printToPDF|window\.print/u);
});
