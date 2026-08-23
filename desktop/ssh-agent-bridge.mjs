import crypto from "node:crypto";
import { createServer } from "node:http";

const MAX_BODY_BYTES = 3 * 1024 * 1024;

export async function startSshAgentBridge({ service, host = "127.0.0.1", port = 0, token }) {
  if (!service) throw new Error("SSH Agent bridge requires an SSH service.");
  const bridgeToken = token || crypto.randomBytes(32).toString("base64url");
  const server = createServer((request, response) => {
    handleRequest(request, response, service, bridgeToken).catch((error) => {
      sendJson(response, error?.status || 500, {
        error: {
          code: error?.code || "SSH_BRIDGE_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("SSH Agent bridge failed to bind a TCP port.");
  return {
    url: `http://${host}:${address.port}`,
    token: bridgeToken,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections?.();
    }),
  };
}

async function handleRequest(request, response, service, token) {
  if (!isLoopback(request.socket.remoteAddress)) {
    sendJson(response, 403, { error: { code: "LOOPBACK_REQUIRED", message: "SSH bridge only accepts loopback requests." } });
    return;
  }
  if (!authorized(request.headers["x-laobos-ssh-token"], token)) {
    sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "SSH bridge token is invalid." } });
    return;
  }
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/v1/profiles") {
    sendJson(response, 200, { profiles: await service.listAgentProfiles() });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/execute") {
    sendJson(response, 200, await service.executeCommand(await requestBody(request)));
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/sftp") {
    sendJson(response, 200, await service.sftpProfile(await requestBody(request)));
    return;
  }
  sendJson(response, 404, { error: { code: "NOT_FOUND", message: "SSH bridge route does not exist." } });
}

async function requestBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error("SSH bridge request is too large.");
      error.status = 413;
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch {
    const error = new Error("SSH bridge request JSON is invalid.");
    error.status = 400;
    error.code = "JSON_INVALID";
    throw error;
  }
}

function sendJson(response, status, value) {
  if (response.headersSent) return;
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function authorized(value, expected) {
  if (typeof value !== "string") return false;
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function isLoopback(value) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(value || "");
}
