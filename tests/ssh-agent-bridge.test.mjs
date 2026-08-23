import assert from "node:assert/strict";
import test from "node:test";
import { startSshAgentBridge } from "../desktop/ssh-agent-bridge.mjs";

test("SSH Agent bridge authenticates requests and DSH tools preserve approvals", async () => {
  const calls = [];
  const service = {
    listAgentProfiles: async () => [{ id: "profile-1", name: "Production", host: "prod.example.com", port: 22, username: "deploy", trusted: true }],
    executeCommand: async (input) => { calls.push(["execute", input]); return { stdout: "ok\n", stderr: "", exitCode: 0 }; },
    sftpProfile: async (input) => { calls.push(["sftp", input]); return { path: input.path, entries: [] }; },
  };
  const bridge = await startSshAgentBridge({ service, token: "ssh-test-token" });
  const previousUrl = process.env.LAOBOS_SSH_BRIDGE_URL;
  const previousToken = process.env.LAOBOS_SSH_BRIDGE_TOKEN;
  try {
    assert.equal((await fetch(`${bridge.url}/v1/profiles`)).status, 401);
    const headers = { "x-laobos-ssh-token": bridge.token, "content-type": "application/json" };
    const profilesResponse = await fetch(`${bridge.url}/v1/profiles`, { headers });
    assert.equal(profilesResponse.status, 200);
    assert.equal((await profilesResponse.json()).profiles[0].id, "profile-1");

    process.env.LAOBOS_SSH_BRIDGE_URL = bridge.url;
    process.env.LAOBOS_SSH_BRIDGE_TOKEN = bridge.token;
    const { apply: applySshPlugin } = await import(`../packages/laobos-ssh/lib/index.js?ssh-test=${Date.now()}`);
    const tools = new Map();
    const listeners = new Map();
    const promptSections = [];
    applySshPlugin({
      logger: { warn: () => {} },
      tools: { register: (definition) => { tools.set(definition.name, definition); return () => tools.delete(definition.name); } },
      systemPrompt: { section: (definition) => { promptSections.push(definition); return () => {}; } },
      on: (name, listener) => { listeners.set(name, listener); return () => listeners.delete(name); },
    });
    assert.equal(process.env.LAOBOS_SSH_BRIDGE_URL, undefined);
    assert.equal(process.env.LAOBOS_SSH_BRIDGE_TOKEN, undefined);

    assert.deepEqual([...tools.keys()], ["ssh_profiles", "ssh_execute", "ssh_file"]);
    assert.match(promptSections[0].text(), /Agent 不得自动接受主机密钥/u);
    assert.equal((await tools.get("ssh_profiles").execute({}, {})).profiles[0].name, "Production");
    const execution = await tools.get("ssh_execute").execute({
      profileId: "profile-1",
      command: "uname -a",
      timeoutMs: 5_000,
      reason: "检查系统信息",
    }, {});
    assert.equal(execution.stdout, "ok\n");
    assert.deepEqual(calls[0], ["execute", { profileId: "profile-1", command: "uname -a", timeoutMs: 5_000 }]);

    await tools.get("ssh_file").execute({ action: "list", profileId: "profile-1", path: "/tmp" }, {});
    assert.deepEqual(calls[1], ["sftp", { action: "list", profileId: "profile-1", path: "/tmp" }]);
    await assert.rejects(() => tools.get("ssh_file").execute({
      action: "write",
      profileId: "profile-1",
      path: "/tmp/a.txt",
      content: "changed",
    }, {}), /必须提供 reason/u);

    const approve = listeners.get("tools/pre-execute");
    const commandDecision = await approve({
      name: "ssh_execute",
      arguments: { profileId: "profile-1", command: "uname -a", reason: "检查系统信息" },
    }, () => Promise.resolve({ kind: "allow" }));
    assert.equal(commandDecision.kind, "ask");
    assert.match(commandDecision.reason, /uname -a/u);
    assert.match(commandDecision.reason, /Production/u);
    const writeDecision = await approve({
      name: "ssh_file",
      arguments: { action: "write", profileId: "profile-1", path: "/tmp/a.txt", reason: "更新配置" },
    }, () => Promise.resolve({ kind: "allow" }));
    assert.equal(writeDecision.kind, "ask");
    const readDecision = await approve({
      name: "ssh_file",
      arguments: { action: "read", path: "/tmp/a.txt" },
    }, () => Promise.resolve({ kind: "allow" }));
    assert.equal(readDecision.kind, "allow");
  } finally {
    if (previousUrl === undefined) delete process.env.LAOBOS_SSH_BRIDGE_URL; else process.env.LAOBOS_SSH_BRIDGE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.LAOBOS_SSH_BRIDGE_TOKEN; else process.env.LAOBOS_SSH_BRIDGE_TOKEN = previousToken;
    await bridge.close();
  }
});
