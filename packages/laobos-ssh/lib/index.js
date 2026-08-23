import { defineTool } from "@deepseek-ai/dsh-tools";

export const name = "laobos-ssh";
export const inject = ["tools", "systemPrompt"];

// Consume the bridge when the plugin is applied, after earlier plugins had a
// chance to create the browser-hosted fallback. Then keep the token out of
// every terminal or managed-app child process started later.
function consumeBridgeConfig() {
  const value = {
    url: process.env.LAOBOS_SSH_BRIDGE_URL,
    token: process.env.LAOBOS_SSH_BRIDGE_TOKEN,
  };
  delete process.env.LAOBOS_SSH_BRIDGE_URL;
  delete process.env.LAOBOS_SSH_BRIDGE_TOKEN;
  return value;
}

const jsonOutput = {
  schema: { type: "json" },
  render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
};

export function apply(ctx) {
  const { url: bridgeUrl, token: bridgeToken } = consumeBridgeConfig();
  if (!bridgeUrl || !bridgeToken) {
    ctx.logger.warn("laobos-ssh: SSH bridge is unavailable; Agent SSH tools were not registered");
    return;
  }

  const request = async (route, { method = "GET", body, signal } = {}) => {
    const response = await fetch(`${bridgeUrl}${route}`, {
      method,
      headers: {
        "x-laobos-ssh-token": bridgeToken,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = value?.error?.message || `SSH bridge HTTP ${response.status}`;
      if (message.includes("HOST_KEY_UNKNOWN:")) {
        throw new Error(`${message}。请先在 SSH 页面中连接一次并核对、信任服务器指纹。`);
      }
      throw new Error(message);
    }
    return value;
  };
  const profileLabel = async (profileId) => {
    const fallback = String(profileId || "未知 SSH 配置");
    try {
      const value = await request("/v1/profiles");
      const profile = value.profiles?.find((item) => item.id === profileId);
      return profile ? `${profile.name}（${profile.username}@${profile.host}:${profile.port}）` : fallback;
    } catch {
      return fallback;
    }
  };

  ctx.systemPrompt.section({
    name: "laobos:ssh-guidance",
    order: 44,
    text: () => `# SSH 远程操作规则

用户已在劳博士 SSH 页面中管理远程服务器。需要操作远程主机时，先调用 ssh_profiles 获取精确 profileId；不要猜测主机、用户名或凭据。
任意远程命令必须使用 ssh_execute，它会显示命令并请求用户确认。远程文件使用 ssh_file；写入、重命名、创建和删除会请求确认。
DSH 工具只能引用凭据，不能读取密码、私钥或系统安全存储中的明文。首次连接或主机密钥变化必须回到 SSH 页面由用户核验，Agent 不得自动接受主机密钥。`,
  });

  ctx.tools.register(defineTool({
    name: "ssh_profiles",
    description: "List SSH profiles configured in the desktop app, without exposing credentials or private-key paths. This is read-only.",
    parameters: {},
    output: jsonOutput,
    execute: async (_args, exec) => request("/v1/profiles", { signal: exec.signal }),
    isConcurrencySafe: () => true,
  }));

  ctx.tools.register(defineTool({
    name: "ssh_execute",
    description: "Execute one exact command on a configured, already-trusted SSH profile. Every call requires user approval and returns stdout, stderr, and exitCode.",
    parameters: {
      profileId: { type: "string", required: true, description: "Exact id returned by ssh_profiles." },
      command: { type: "string", required: true, description: "Exact remote shell command. Do not hide additional commands in encoded payloads." },
      timeoutMs: { type: "integer", description: "Timeout from 1000 to 120000 milliseconds; defaults to 30000." },
      reason: { type: "string", required: true, description: "Why this remote command is needed, shown to the user during approval." },
    },
    output: jsonOutput,
    timeoutMs: 135_000,
    execute: async (args, exec) => request("/v1/execute", {
      method: "POST",
      body: { profileId: args.profileId, command: args.command, timeoutMs: args.timeoutMs },
      signal: exec.signal,
    }),
  }));

  ctx.tools.register(defineTool({
    name: "ssh_file",
    description: "List, read, write, create, rename, or remove a remote file through SFTP. Reads are capped at 2 MiB; mutating actions require user approval.",
    parameters: {
      action: { type: "string", required: true, enum: ["list", "read", "write", "mkdir", "rename", "remove"] },
      profileId: { type: "string", required: true, description: "Exact id returned by ssh_profiles." },
      path: { type: "string", required: true, description: "Exact remote path." },
      destination: { type: "string", description: "Destination remote path for rename." },
      content: { type: "string", description: "Complete replacement content for write." },
      encoding: { type: "string", enum: ["utf8", "base64"], description: "Defaults to utf8." },
      resourceType: { type: "string", enum: ["file", "directory"], description: "Required by remove; directories must be empty." },
      reason: { type: "string", description: "Required for mutating actions and shown during approval." },
    },
    output: jsonOutput,
    timeoutMs: 135_000,
    execute: async (args, exec) => {
      if (!["list", "read"].includes(args.action) && !String(args.reason || "").trim()) {
        throw new Error("远程文件写操作必须提供 reason。 ");
      }
      return request("/v1/sftp", {
        method: "POST",
        body: args,
        signal: exec.signal,
      });
    },
    isConcurrencySafe: (args) => ["list", "read"].includes(args.action),
  }));

  ctx.on("tools/pre-execute", async (exec, next) => {
    const decision = await next();
    const args = exec.arguments || {};
    if (decision.kind !== "allow") return decision;
    if (exec.name === "ssh_execute") {
      const target = await profileLabel(args.profileId);
      return {
        kind: "ask",
        reason: `Agent 请求在远程服务器 ${target} 执行命令：${String(args.command || "").slice(0, 500)}\n原因：${String(args.reason || "未说明")}`,
      };
    }
    if (exec.name === "ssh_file" && !["list", "read"].includes(args.action)) {
      const target = await profileLabel(args.profileId);
      return {
        kind: "ask",
        reason: `Agent 请求修改 ${target} 上的远程文件：${args.action || "write"} ${args.path || ""}\n原因：${String(args.reason || "未说明")}`,
      };
    }
    return decision;
  });
}
