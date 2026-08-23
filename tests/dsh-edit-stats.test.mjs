import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadFileMutationRows() {
  const source = await readFile(
    path.join(projectRoot, "node_modules/@deepseek-ai/dsh-client-ui-tool/lib/client.js"),
    "utf8",
  );
  const context = {
    console,
    window: {
      __ModuleLoader__: {
        load(definition) {
          context.definition = definition;
        },
      },
    },
  };
  vm.runInNewContext(source, context, { filename: "dsh-client-ui-tool.js" });

  const primitives = {
    DisclosureRow({ title, collapsedContent }) {
      return React.createElement("div", { "data-disclosure-row": true },
        React.createElement("span", null, title),
        collapsedContent,
      );
    },
    DiffBlock() {
      return React.createElement("div", { "data-diff-block": true });
    },
    IconEditOutline16() {
      return React.createElement("i", { "data-edit-icon": true });
    },
    StateDot() {
      return React.createElement("i", { "data-state-dot": true });
    },
  };
  const runtime = { abbreviateHomePath: (value) => value };
  const client = context.definition.factory((id) => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return awaitableJsxRuntime;
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
    if (id === "@deepseek-ai/dsh-client-runtime/client") return runtime;
    throw new Error(`unexpected browser module: ${id}`);
  });

  const plugins = [];
  const rows = new Map();
  const ctx = {
    get(name) {
      if (name === "connection") return { hostDescription: { home: "/Users/test" } };
      throw new Error(`unexpected service: ${name}`);
    },
    plugin(plugin) {
      plugins.push(plugin);
    },
    slots: {
      inject(_name, factory) {
        const registrations = factory();
        if (registrations && typeof registrations[Symbol.iterator] === "function") {
          for (const registration of registrations) void registration;
        }
      },
      register(meta, component) {
        if (meta.name === "tool.call.toolview") rows.set(meta.key, component);
        return { dispose() {} };
      },
    },
  };
  client.apply(ctx);
  const fileMutationPlugin = plugins.find((plugin) => plugin.name === "file-mutation-toolview");
  assert.ok(fileMutationPlugin, "expected the built-in file mutation toolview plugin");
  fileMutationPlugin.apply(ctx);
  return rows;
}

const awaitableJsxRuntime = await import("react/jsx-runtime");

function settledBlock({ isError = false, resultView } = {}) {
  return {
    kind: "tool-result",
    callId: "call-1",
    call: { argsRaw: JSON.stringify({ file_path: "src/app.js" }) },
    content: [{ type: "text", text: isError ? "edit failed" : "ok" }],
    isError,
    resultView,
  };
}

const diffs = [{
  path: "src/app.js",
  oldText: "before\nold\n",
  newText: "before\nnew one\nnew two\n",
}];

function renderRow(Row, toolName, block) {
  return renderToStaticMarkup(React.createElement(Row, {
    toolName,
    block,
    cwd: projectRoot,
    home: "/Users/test",
    openFile() {},
    t: (key) => key,
  }));
}

test("settled Edit and Write rows append their applied diff totals after the path", async () => {
  const rows = await loadFileMutationRows();
  const block = settledBlock({ resultView: { card: "diff", diffs } });
  for (const toolName of ["edit", "write"]) {
    const markup = renderRow(rows.get(toolName), toolName, block);
    assert.match(markup, /src\/app\.js[\s\S]*data-diff-additions="true"[\s\S]*\+3/u);
    assert.match(
      markup,
      /data-diff-additions="true" style="color:var\(--dsw-alias-state-success-primary\)">\+3/u,
    );
    assert.match(
      markup,
      /data-diff-deletions="true" style="color:var\(--dsw-alias-state-error-primary\)">-2/u,
    );
  }
});

test("running or failed file mutations do not claim applied line totals", async () => {
  const rows = await loadFileMutationRows();
  const running = {
    callId: "call-2",
    argsRaw: JSON.stringify({ file_path: "src/app.js" }),
    callView: { card: "diff", diffs },
  };
  assert.doesNotMatch(
    renderRow(rows.get("edit"), "edit", running),
    /data-diff-(?:additions|deletions)/u,
  );

  const failed = settledBlock({ isError: true, resultView: { card: "generic" } });
  const markup = renderRow(rows.get("edit"), "edit", failed);
  assert.match(markup, /edit failed/u);
  assert.doesNotMatch(markup, /data-diff-(?:additions|deletions)/u);
});

test("the suffix aggregates multiple valid hunks and ignores malformed diff cards", async () => {
  const rows = await loadFileMutationRows();
  const multiHunk = settledBlock({ resultView: { card: "diff", diffs: [
    { path: "src/app.js", oldText: "old\n", newText: "new\nmore\n" },
    { path: "src/new.js", oldText: null, newText: "created" },
    { path: "src/old.js", oldText: "gone\nline", newText: "" },
  ] } });
  const multiHunkMarkup = renderRow(rows.get("edit"), "edit", multiHunk);
  assert.match(multiHunkMarkup, /data-diff-additions="true"[\s\S]*\+3/u);
  assert.match(multiHunkMarkup, /data-diff-deletions="true"[\s\S]*-3/u);

  const malformed = settledBlock({ resultView: {
    card: "diff",
    diffs: [{ path: "src/app.js", oldText: 42, newText: "new" }],
  } });
  assert.doesNotMatch(
    renderRow(rows.get("edit"), "edit", malformed),
    /data-diff-(?:additions|deletions)/u,
  );
});

test("runtime patch verification includes the Edit line-stat suffix", async () => {
  const [patch, verifier] = await Promise.all([
    readFile(path.join(projectRoot, "patches/@deepseek-ai+dsh-client-ui-tool+0.1.0-rc.8.patch"), "utf8"),
    readFile(path.join(projectRoot, "scripts/verify-runtime-patches.mjs"), "utf8"),
  ]);
  assert.match(patch, /function diffSummarySuffix/u);
  assert.match(patch, /model\.state === "ok"/u);
  assert.match(patch, /--dsw-alias-state-success-primary/u);
  assert.match(patch, /--dsw-alias-state-error-primary/u);
  assert.match(verifier, /文件编辑命令增删行统计补丁/u);
});
