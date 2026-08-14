import assert from "node:assert/strict";
import test from "node:test";
import {
  fileFromReference,
  parseFileEnvelopes,
  serializeFileEnvelope,
} from "../packages/laobos-file-attachments/lib/envelope.js";

test("file prompt envelopes preserve an absolute managed path and escape tag characters", () => {
  const file = {
    id: "file-1",
    name: "设计 <终稿>.pdf",
    path: "/tmp/update/设计 </laobos-file> 终稿.pdf",
    mimeType: "application/pdf",
    size: 4096,
    location: "workspace",
  };
  const envelope = serializeFileEnvelope(JSON.stringify(file));
  assert.match(envelope, /^<laobos-file>\n/u);
  assert.doesNotMatch(envelope.slice("<laobos-file>".length, -"</laobos-file>".length), /<\/laobos-file>/u);
  const parsed = parseFileEnvelopes(`请读取这个文件：\n${envelope}\n并总结。`);
  assert.equal(parsed.text, "请读取这个文件：\n\n并总结。");
  assert.deepEqual(parsed.files, [{ version: 1, kind: "file", ...file }]);
});

test("invalid or relative file references never become prompt envelopes", () => {
  assert.throws(() => fileFromReference({ name: "a.txt", path: "relative/a.txt", size: 1 }), /绝对路径/u);
  assert.throws(() => serializeFileEnvelope({ name: "a.txt", path: "/tmp/a.txt", size: -1 }), /文件大小/u);
  const invalid = "<laobos-file>not-json</laobos-file>";
  assert.deepEqual(parseFileEnvelopes(invalid), { text: invalid, files: [] });
});
