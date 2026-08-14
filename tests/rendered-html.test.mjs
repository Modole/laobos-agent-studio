import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the 劳博士 shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>劳博士 — Agent 客户端<\/title>/i);
  assert.match(html, /New task/);
  assert.match(html, /劳博士 Agent/);
  assert.match(html, /系统提示词/);
  assert.match(html, /AI Keys/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("removes disposable starter assets and keeps the local bridge script", async () => {
  const [packageJson, bridge] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../bridge/server.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"name": "laobos-agent-studio"/);
  assert.match(packageJson, /"pi:bridge": "node bridge\/server\.mjs"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(bridge, /127\.0\.0\.1/);
  assert.match(bridge, /timingSafeEqual/);
  assert.match(bridge, /--mode", "rpc"/);

  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});
