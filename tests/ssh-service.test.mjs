import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ssh2 from "ssh2";
import { SshService } from "../desktop/ssh-service.mjs";

const { Server } = ssh2;

test("shared SSH service enforces TOFU before shell and Agent command access", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "laobos-ssh-service-"));
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const server = new Server({
    hostKeys: [privateKey.export({ type: "pkcs1", format: "pem" })],
  }, (client) => {
    client.on("error", () => {});
    client.on("authentication", (context) => {
      if (context.method === "password" && context.username === "tester" && context.password === "secret") context.accept();
      else if (context.method === "publickey" && context.username === "tester") context.accept();
      else context.reject();
    });
    client.on("ready", () => {
      client.on("session", (accept) => {
        const session = accept();
        session.on("pty", (acceptPty) => acceptPty?.());
        session.on("shell", (acceptShell) => {
          const stream = acceptShell();
          stream.on("data", (data) => stream.write(`echo:${String(data)}`));
        });
        session.on("exec", (acceptExec, _rejectExec, info) => {
          const stream = acceptExec();
          stream.write(`ran:${info.command}\n`);
          stream.exit(0);
          stream.end();
        });
      });
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await mkdir(path.join(temporary, ".ssh"));
  await writeFile(path.join(temporary, ".ssh", "id_ed25519"), privateKey.export({ type: "pkcs1", format: "pem" }), { mode: 0o600 });

  const service = new SshService({
    app: { getPath: (name) => { assert.equal(name, "userData"); return temporary; } },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value, "utf8"),
      decryptString: (value) => value.toString("utf8"),
    },
    homeDirectory: temporary,
  });
  try {
    const credential = await service.saveCredential({ name: "Test", type: "password", password: "secret" });
    const profile = await service.saveProfile({
      name: "Local test server",
      host: "127.0.0.1",
      port: address.port,
      username: "tester",
      authMode: "credential",
      credentialId: credential.id,
    });

    await assert.rejects(() => service.executeCommand({ profileId: profile.id, command: "whoami" }), /HOST_KEY_UNKNOWN:SHA256:/u);
    await assert.rejects(() => service.connect({ profileId: profile.id }), /HOST_KEY_UNKNOWN:SHA256:/u);

    const connection = await service.connect({ profileId: profile.id, acceptUnknownHostKey: true, cols: 80, rows: 24 });
    const data = new Promise((resolve) => service.once("data", resolve));
    service.write({ id: connection.id, data: "hello\n" });
    assert.match((await data).data, /echo:hello/u);
    assert.equal(service.resize({ id: connection.id, cols: 100, rows: 32 }).accepted, true);
    assert.equal(service.close(connection.id), true);

    const result = await service.executeCommand({ profileId: profile.id, command: "whoami" });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "ran:whoami\n");
    const [agentProfile] = await service.listAgentProfiles();
    assert.equal(agentProfile.trusted, true);
    assert.equal(agentProfile.authentication, "stored credential");
    assert.equal("credentialId" in agentProfile, false);
    assert.equal("identityFile" in agentProfile, false);

    const importedStyleProfile = await service.saveProfile({
      name: "OpenSSH default identity",
      host: "127.0.0.1",
      port: address.port,
      username: "tester",
      authMode: "agent",
    });
    const publicKeyResult = await service.executeCommand({ profileId: importedStyleProfile.id, command: "id" });
    assert.equal(publicKeyResult.stdout, "ran:id\n");
  } finally {
    service.dispose();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(temporary, { recursive: true, force: true });
  }
});
