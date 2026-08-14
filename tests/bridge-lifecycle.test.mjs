import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("embedded bridge starts on a dynamic port, authenticates, and stops", async () => {
  const agentDir = await mkdtemp(path.join(os.tmpdir(), "pi-studio-bridge-"));
  const sessionDir = path.join(agentDir, "sessions", "pi-studio");
  await mkdir(sessionDir, { recursive: true });
  await writeFile(
    path.join(sessionDir, "fixture.jsonl"),
    [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "ff206091-c677-42f9-9c52-626f8db8c8dd",
        timestamp: "2026-07-25T07:00:00.000Z",
        cwd: "/tmp/project",
      }),
      JSON.stringify({
        type: "message",
        id: "12345678",
        parentId: null,
        timestamp: "2026-07-25T07:00:01.000Z",
        message: {
          role: "user",
          content: "恢复这段历史会话",
          timestamp: 1_753_430_401_000,
        },
      }),
      "",
    ].join("\n"),
  );

  process.env.PI_STUDIO_AGENT_DIR = agentDir;
  const { startBridge } = await import(
    `../bridge/server.mjs?bridge-test=${Date.now()}`
  );
  let bridge;

  try {
    bridge = await startBridge({
      host: "127.0.0.1",
      port: 0,
      token: "test-bridge-token",
    });
    const healthResponse = await fetch(`${bridge.url}/api/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal((await healthResponse.json()).ok, true);

    const unauthorizedResponse = await fetch(`${bridge.url}/api/config`);
    assert.equal(unauthorizedResponse.status, 401);

    const sessionsResponse = await fetch(`${bridge.url}/api/sessions`, {
      headers: { "X-Pi-Bridge-Token": "test-bridge-token" },
    });
    assert.equal(sessionsResponse.status, 200);
    const sessions = (await sessionsResponse.json()).sessions;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].title, "恢复这段历史会话");

    const authorizedHeaders = {
      "Content-Type": "application/json",
      "X-Pi-Bridge-Token": "test-bridge-token",
    };
    const localMarkdownImagePath = path.join(agentDir, "markdown-preview.png");
    const localMarkdownImageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await writeFile(localMarkdownImagePath, localMarkdownImageBytes);
    const localMarkdownImageResponse = await fetch(
      `${bridge.url}/api/files/image?path=${encodeURIComponent(localMarkdownImagePath)}`,
      { headers: authorizedHeaders },
    );
    assert.equal(localMarkdownImageResponse.status, 200);
    assert.equal(localMarkdownImageResponse.headers.get("content-type"), "image/png");
    assert.deepEqual(
      Buffer.from(await localMarkdownImageResponse.arrayBuffer()),
      localMarkdownImageBytes,
    );

    const attachmentId = "826ff0be-99c7-4f85-a724-7451a0052723";
    const uploadResponse = await fetch(
      `${bridge.url}/api/chat/ff206091-c677-42f9-9c52-626f8db8c8dd/attachments`,
      {
        method: "POST",
        headers: authorizedHeaders,
        body: JSON.stringify({
          attachments: [
            {
              id: attachmentId,
              name: "../../notes.md",
              mimeType: "text/markdown",
              size: 5,
              data: Buffer.from("hello").toString("base64"),
            },
          ],
        }),
      },
    );
    assert.equal(uploadResponse.status, 201);
    const upload = await uploadResponse.json();
    assert.equal(upload.attachments[0].name, "notes.md");
    assert.equal(upload.attachments[0].kind, "file");
    assert.equal(upload.attachments[0].storedName, undefined);

    const downloadResponse = await fetch(
      `${bridge.url}${upload.attachments[0].downloadPath}`,
      { headers: authorizedHeaders },
    );
    assert.equal(downloadResponse.status, 200);
    assert.equal(await downloadResponse.text(), "hello");
    assert.match(
      downloadResponse.headers.get("content-disposition") || "",
      /^attachment;/,
    );

    const invalidAttachmentResponse = await fetch(
      `${bridge.url}/api/chat/ff206091-c677-42f9-9c52-626f8db8c8dd/attachments`,
      {
        method: "POST",
        headers: authorizedHeaders,
        body: JSON.stringify({
          attachments: [
            {
              id: attachmentId,
              name: "broken.txt",
              mimeType: "text/plain",
              size: 99,
              data: Buffer.from("hello").toString("base64"),
            },
          ],
        }),
      },
    );
    assert.equal(invalidAttachmentResponse.status, 400);

    const customProviderResponse = await fetch(
      `${bridge.url}/api/providers/custom`,
      {
        method: "PUT",
        headers: authorizedHeaders,
        body: JSON.stringify({
          id: "acme-gateway",
          name: "Acme Gateway",
          baseUrl: "https://ai.acme.test/v1/",
          api: "openai-completions",
          key: "secret-third-party-key",
          models: [
            {
              id: "acme-reasoner",
              name: "Acme Reasoner",
              reasoning: true,
              vision: true,
              contextWindow: 200000,
              maxTokens: 32000,
            },
          ],
        }),
      },
    );
    assert.equal(customProviderResponse.status, 200);

    const modelsConfig = JSON.parse(
      await readFile(path.join(agentDir, "models.json"), "utf8"),
    );
    assert.deepEqual(modelsConfig.providers["acme-gateway"], {
      name: "Acme Gateway",
      baseUrl: "https://ai.acme.test/v1",
      api: "openai-completions",
      models: [
        {
          id: "acme-reasoner",
          name: "Acme Reasoner",
          reasoning: true,
          input: ["text", "image"],
          contextWindow: 200000,
          maxTokens: 32000,
        },
      ],
    });

    const auth = JSON.parse(await readFile(path.join(agentDir, "auth.json"), "utf8"));
    assert.equal(auth["acme-gateway"].key, "secret-third-party-key");

    const configResponse = await fetch(`${bridge.url}/api/config`, {
      headers: authorizedHeaders,
    });
    const configText = await configResponse.text();
    assert.doesNotMatch(configText, /secret-third-party-key/);
    const customProvider = JSON.parse(configText).providers.find(
      (provider) => provider.id === "acme-gateway",
    );
    assert.equal(customProvider.custom, true);
    assert.equal(customProvider.models[0].id, "acme-reasoner");

    const builtInProviderResponse = await fetch(
      `${bridge.url}/api/providers/key`,
      {
        method: "PUT",
        headers: authorizedHeaders,
        body: JSON.stringify({
          provider: "openai",
          key: "secret-openai-key",
          baseUrl: "https://gateway.acme.test/v1/",
        }),
      },
    );
    assert.equal(builtInProviderResponse.status, 200);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(agentDir, "models.json"), "utf8")).providers.openai,
      { baseUrl: "https://gateway.acme.test/v1" },
    );
    assert.equal(
      JSON.parse(await readFile(path.join(agentDir, "auth.json"), "utf8")).openai.key,
      "secret-openai-key",
    );

    const endpointOnlyResponse = await fetch(`${bridge.url}/api/providers/key`, {
      method: "PUT",
      headers: authorizedHeaders,
      body: JSON.stringify({
        provider: "openai",
        baseUrl: "https://second-gateway.acme.test/v1",
      }),
    });
    assert.equal(endpointOnlyResponse.status, 200);
    assert.equal(
      JSON.parse(await readFile(path.join(agentDir, "auth.json"), "utf8")).openai.key,
      "secret-openai-key",
    );

    const configWithEndpointResponse = await fetch(`${bridge.url}/api/config`, {
      headers: authorizedHeaders,
    });
    const openaiProvider = (await configWithEndpointResponse.json()).providers.find(
      (provider) => provider.id === "openai",
    );
    assert.equal(openaiProvider.baseUrl, "https://second-gateway.acme.test/v1");
    assert.equal(openaiProvider.defaultBaseUrl, "https://api.openai.com/v1");
    assert.equal(openaiProvider.endpointCustomized, true);

    const deleteProviderResponse = await fetch(
      `${bridge.url}/api/providers/custom`,
      {
        method: "DELETE",
        headers: authorizedHeaders,
        body: JSON.stringify({ provider: "acme-gateway" }),
      },
    );
    assert.equal(deleteProviderResponse.status, 200);
    const deletedModelsConfig = JSON.parse(
      await readFile(path.join(agentDir, "models.json"), "utf8"),
    );
    const deletedAuth = JSON.parse(
      await readFile(path.join(agentDir, "auth.json"), "utf8"),
    );
    assert.equal(deletedModelsConfig.providers["acme-gateway"], undefined);
    assert.equal(deletedAuth["acme-gateway"], undefined);

    await writeFile(path.join(agentDir, "models.json"), "{ broken json\n");
    const invalidConfigResponse = await fetch(
      `${bridge.url}/api/providers/custom`,
      {
        method: "PUT",
        headers: authorizedHeaders,
        body: JSON.stringify({
          id: "safe-local",
          name: "Safe Local",
          baseUrl: "http://127.0.0.1:11434/v1",
          api: "openai-completions",
          localNoKey: true,
          models: [{ id: "local-model" }],
        }),
      },
    );
    assert.equal(invalidConfigResponse.status, 409);
    assert.equal(
      await readFile(path.join(agentDir, "models.json"), "utf8"),
      "{ broken json\n",
    );
  } finally {
    await bridge?.close();
    await rm(agentDir, { recursive: true, force: true });
    delete process.env.PI_STUDIO_AGENT_DIR;
  }

  assert.ok(bridge);
  await assert.rejects(fetch(`${bridge.url}/api/health`));
});
