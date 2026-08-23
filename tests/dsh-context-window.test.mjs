import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { bundledPluginNames } from "../desktop/local-plugins.mjs";
import {
  ContextWindowPolicy,
  EXTENDED_CONTEXT_WINDOW,
  STANDARD_CONTEXT_WINDOW,
} from "../packages/laobos-context-window/lib/index.js";

test("context window policy persists the 200K/1M switch", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "laobos-context-window-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "context-window.json");
  const policy = new ContextWindowPolicy({ statePath });

  assert.deepEqual(policy.snapshot(), {
    schema: 1,
    enabled: false,
    standardContextWindow: STANDARD_CONTEXT_WINDOW,
    extendedContextWindow: EXTENDED_CONTEXT_WINDOW,
    effectiveContextWindow: STANDARD_CONTEXT_WINDOW,
  });

  assert.equal(policy.setEnabled(true).effectiveContextWindow, EXTENDED_CONTEXT_WINDOW);
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), {
    schema: 1,
    enabled: true,
  });
  assert.equal(
    new ContextWindowPolicy({ statePath }).snapshot().effectiveContextWindow,
    EXTENDED_CONTEXT_WINDOW,
  );
  assert.throws(() => policy.setEnabled("yes"), /enabled 必须是布尔值/u);
});

test("context window plugin is bundled and shadows the stock model menu", async () => {
  const [patch, buildScript, packageJson, clientSource] = await Promise.all([
    readFile(new URL("../config/laobos.cordis.patch.yml", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-desktop-plugins.mjs", import.meta.url), "utf8"),
    readFile(new URL("../packages/laobos-context-window/package.json", import.meta.url), "utf8"),
    readFile(new URL("../packages/laobos-context-window/src/client.jsx", import.meta.url), "utf8"),
  ]);

  assert.equal(bundledPluginNames.includes("laobos-context-window"), true);
  assert.match(patch, /id:\s+laobos-context-window[\s\S]*extendedContextWindow:\s+1000000/u);
  assert.match(buildScript, /laobos-context-window\/src\/client\.jsx/u);
  assert.equal(JSON.parse(packageJson).dsh.client.platform, "web");
  assert.match(clientSource, /上下文调节开关/u);
  assert.match(clientSource, /priority:\s*-100/u);
  assert.match(clientSource, /role="switch"/u);
  assert.doesNotMatch(clientSource, /cloud-auth|modelAuthorization/u);
  assert.doesNotMatch(clientSource, />用量统计|余额 无限积分/u);
  assert.match(clientSource, /lbs-context-multiplier/u);
  assert.match(clientSource, />倍率</u);
  assert.match(clientSource, /inputModalities/u);
  assert.match(clientSource, /split\(" · "\)\.includes\("多模态"\)/u);
  assert.match(clientSource, /<svg[^>]+aria-label="支持图片输入"/u);
  assert.match(clientSource, /<rect[\s\S]*<circle[\s\S]*<path/u);
  assert.doesNotMatch(clientSource, />多模态<\/span>/u);
});
