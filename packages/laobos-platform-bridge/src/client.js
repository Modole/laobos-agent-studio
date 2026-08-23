(function installLaobosBrowserBridge() {
  if (typeof window === "undefined" || window.laobosDesktop) return;

  const apiRoot = "/laobos/api/platform";
  const listeners = new Map();
  let cursor = 0;
  let polling = false;
  let retryDelay = 500;

  function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32_768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
    }
    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = window.atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function rpcPayload(method, params) {
    return JSON.stringify({ method, params }, (_key, value) => {
      if (value instanceof Uint8Array) return { __laobosBytes: bytesToBase64(value) };
      if (value instanceof ArrayBuffer) return { __laobosBytes: bytesToBase64(new Uint8Array(value)) };
      return value;
    });
  }

  async function rpc(method, params = {}) {
    const response = await fetch(`${apiRoot}/rpc`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: rpcPayload(method, params),
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(value?.error?.message || `跨平台调用失败（HTTP ${response.status}）`);
      error.code = value?.error?.code || "PLATFORM_BRIDGE_ERROR";
      throw error;
    }
    return value.result;
  }

  async function pollEvents() {
    if (polling) return;
    polling = true;
    while ([...listeners.values()].some((values) => values.size)) {
      try {
        const response = await fetch(`${apiRoot}/events?after=${cursor}&wait=15000`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const value = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(value?.error?.message || `事件通道 HTTP ${response.status}`);
        for (const event of value.events || []) {
          cursor = Math.max(cursor, Number(event.seq) || 0);
          for (const listener of listeners.get(event.channel) || []) {
            try { listener(event.payload); } catch (error) { window.setTimeout(() => { throw error; }, 0); }
          }
        }
        cursor = Math.max(cursor, Number(value.cursor) || 0);
        retryDelay = 500;
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, retryDelay));
        retryDelay = Math.min(5_000, retryDelay * 2);
      }
    }
    polling = false;
  }

  function subscribe(channel, listener) {
    if (typeof listener !== "function") throw new TypeError("事件监听器必须是函数。 ");
    const values = listeners.get(channel) || new Set();
    values.add(listener);
    listeners.set(channel, values);
    void pollEvents();
    return () => {
      values.delete(listener);
      if (!values.size) listeners.delete(channel);
    };
  }

  function chooseFiles({ multiple = true } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = multiple;
      input.hidden = true;
      document.body.append(input);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("focus", onFocus, true);
        const files = Array.from(input.files || []);
        input.remove();
        resolve(files);
      };
      const onFocus = () => window.setTimeout(finish, 350);
      input.addEventListener("change", finish, { once: true });
      window.addEventListener("focus", onFocus, true);
      input.click();
    });
  }

  async function filePayload(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error(`文件“${file.name}”超过 20 MB 上限。`);
    return {
      name: file.name || "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };
  }

  function assertTransferBatch(files) {
    if (files.length > 10) throw new Error("一次最多传输 10 个文件。 ");
    const total = files.reduce((size, file) => size + Number(file.size || 0), 0);
    if (total > 50 * 1024 * 1024) throw new Error("本次文件总大小超过 50 MB 上限。 ");
  }

  async function pickAttachments(sessionId) {
    const files = await chooseFiles({ multiple: true });
    if (!files.length) return { canceled: true, images: [], files: [] };
    assertTransferBatch(files);
    const nativeImages = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    const images = [];
    const ordinary = [];
    for (const file of files) {
      const payload = await filePayload(file);
      if (nativeImages.has(payload.mimeType)) {
        images.push({
          id: window.crypto.randomUUID(),
          name: payload.name,
          mediaType: payload.mimeType,
          size: payload.size,
          bytes: payload.bytes,
        });
      } else ordinary.push(payload);
    }
    const stored = ordinary.length ? await rpc("uploads.pasteFiles", { sessionId, files: ordinary }) : { files: [] };
    return { canceled: false, images, files: stored.files || [] };
  }

  async function uploadSsh(input) {
    const files = await chooseFiles({ multiple: true });
    if (!files.length) return { canceled: true, files: [] };
    assertTransferBatch(files);
    return rpc("ssh.upload", { ...input, files: await Promise.all(files.map(filePayload)) });
  }

  async function downloadSsh(input) {
    const result = await rpc("ssh.download", input);
    if (result?.canceled) return result;
    const blob = new Blob([base64ToBytes(result.base64)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.name || "download";
    anchor.rel = "noopener";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { ...result, base64: undefined };
  }

  const call = (method) => (input = {}) => rpc(method, input);
  const callId = (method) => (id) => rpc(method, { id });
  const capabilities = Object.freeze({
    conversationHtml: false,
    sessionTrash: false,
    workspaceFiles: true,
    gitReview: true,
    uploadSettings: true,
    fileAttachments: true,
    terminal: true,
    browserPreview: false,
    browserElementPicker: false,
    browserOps: false,
    ssh: true,
    apps: true,
    cloudAuth: false,
    clipboard: true,
    shellManager: false,
    softwareUpdate: false,
  });
  const bridge = Object.freeze({
    version: 2,
    platform: "browser",
    transport: "same-origin-loopback-http",
    capabilities,
    clipboard: Object.freeze({
      async writeText(text) {
        await navigator.clipboard.writeText(String(text));
        return { written: true };
      },
    }),
    workspace: Object.freeze({
      context: call("workspace.context"), list: call("workspace.list"), read: call("workspace.read"),
      write: call("workspace.write"), create: call("workspace.create"), rename: call("workspace.rename"), remove: call("workspace.remove"),
      reveal: call("workspace.reveal"), open: call("workspace.open"),
    }),
    git: Object.freeze({
      inspect: call("git.inspect"), status: call("git.status"), summary: call("git.summary"), diff: call("git.diff"), log: call("git.log"),
      init: call("git.init"), stage: call("git.stage"), unstage: call("git.unstage"), commit: call("git.commit"),
      branch: call("git.branch"), restore: call("git.restore"), sync: call("git.sync"),
    }),
    uploads: Object.freeze({
      setLocation: (location) => rpc("uploads.setLocation", { location }),
      pickFiles: pickAttachments,
      pasteFiles: (sessionId, files) => rpc("uploads.pasteFiles", { sessionId, files }),
      reveal: (filePath) => rpc("uploads.reveal", { path: filePath }),
    }),
    terminal: Object.freeze({
      create: call("terminal.create"), write: call("terminal.write"), resize: call("terminal.resize"), close: call("terminal.close"),
      onData: (listener) => subscribe("laobos:terminal:data", listener),
      onExit: (listener) => subscribe("laobos:terminal:exit", listener),
    }),
    ssh: Object.freeze({
      list: call("ssh.list"), saveCredential: call("ssh.saveCredential"), saveProfile: call("ssh.saveProfile"),
      deleteProfile: callId("ssh.deleteProfile"), deleteCredential: callId("ssh.deleteCredential"),
      forgetHostKey: callId("ssh.forgetHostKey"), importConfig: call("ssh.importConfig"), connect: call("ssh.connect"),
      write: call("ssh.write"), resize: call("ssh.resize"), disconnect: callId("ssh.disconnect"), sftp: call("ssh.sftp"),
      upload: uploadSsh, download: downloadSsh,
      onData: (listener) => subscribe("laobos:ssh:data", listener),
      onExit: (listener) => subscribe("laobos:ssh:exit", listener),
    }),
    apps: Object.freeze({
      list: call("apps.list"), detect: (cwd) => rpc("apps.detect", { cwd }), findPort: (start) => rpc("apps.findPort", { start }),
      save: call("apps.save"), start: callId("apps.start"), stop: callId("apps.stop"), logs: callId("apps.logs"),
      apiDoc: callId("apps.apiDoc"), saveApiDoc: (id, content) => rpc("apps.saveApiDoc", { id, content }),
      remove: callId("apps.remove"), open: callId("apps.open"),
      onLog: (listener) => subscribe("laobos:apps:log", listener),
      onState: (listener) => subscribe("laobos:apps:state", listener),
    }),
  });
  Object.defineProperty(window, "laobosDesktop", { value: bridge, configurable: false, enumerable: true, writable: false });
  window.dispatchEvent(new CustomEvent("laobos:platform-bridge-ready", { detail: { platform: "browser" } }));
}());

window.__ModuleLoader__.load({
  id: "@laobos/dsh-platform-bridge",
  factory: () => ({
    inject: [],
    apply() {},
  }),
});
