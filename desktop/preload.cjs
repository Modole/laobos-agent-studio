/* eslint-disable @typescript-eslint/no-require-imports -- sandboxed Electron preloads cannot use ESM imports */
const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, input) => ipcRenderer.invoke(channel, input);

contextBridge.exposeInMainWorld("laobosDesktop", Object.freeze({
  version: 1,
  capabilities: Object.freeze({
    conversationHtml: true,
    sessionTrash: true,
    workspaceFiles: true,
    gitReview: true,
    uploadSettings: true,
    fileAttachments: true,
    terminal: true,
    browserPreview: true,
    browserOps: true,
    ssh: true,
    apps: true,
    clipboard: true,
    shellManager: true,
    softwareUpdate: true,
  }),
  clipboard: Object.freeze({
    writeText: (text) => invoke("laobos:clipboard:write-text", { text }),
  }),
  updates: Object.freeze({
    status: () => invoke("laobos:updates:status"),
    preferences: () => invoke("laobos:updates:preferences"),
    setPreferences: (input) => invoke("laobos:updates:set-preferences", input),
    check: () => invoke("laobos:updates:check"),
    download: () => invoke("laobos:updates:download"),
    install: () => invoke("laobos:updates:install"),
    onState: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:updates:state", wrapped);
      return () => ipcRenderer.removeListener("laobos:updates:state", wrapped);
    },
  }),
  html: Object.freeze({
    exportConversation: (input) => invoke("laobos:html:export-conversation", input),
  }),
  sessions: Object.freeze({
    trash: (input) => invoke("laobos:sessions:trash", input),
  }),
  workspace: Object.freeze({
    context: () => invoke("laobos:workspace:context"),
    list: (input) => invoke("laobos:workspace:list", input),
    read: (input) => invoke("laobos:workspace:read", input),
    write: (input) => invoke("laobos:workspace:write", input),
    rename: (input) => invoke("laobos:workspace:rename", input),
    remove: (input) => invoke("laobos:workspace:remove", input),
    reveal: (input) => invoke("laobos:workspace:reveal", input),
  }),
  git: Object.freeze({
    inspect: (input) => invoke("laobos:git:inspect", input),
    status: (input) => invoke("laobos:git:status", input),
    diff: (input) => invoke("laobos:git:diff", input),
    log: (input) => invoke("laobos:git:log", input),
    init: (input) => invoke("laobos:git:init", input),
    stage: (input) => invoke("laobos:git:stage", input),
    unstage: (input) => invoke("laobos:git:unstage", input),
    commit: (input) => invoke("laobos:git:commit", input),
    branch: (input) => invoke("laobos:git:branch", input),
    restore: (input) => invoke("laobos:git:restore", input),
    sync: (input) => invoke("laobos:git:sync", input),
  }),
  uploads: Object.freeze({
    setLocation: (location) => invoke("laobos:uploads:set-location", { location }),
    pickFiles: (sessionId) => invoke("laobos:uploads:pick-files", { sessionId }),
    pasteFiles: (sessionId, files) => invoke("laobos:uploads:paste-files", { sessionId, files }),
    reveal: (path) => invoke("laobos:uploads:reveal", { path }),
  }),
  terminal: Object.freeze({
    create: (input) => invoke("laobos:terminal:create", input),
    write: (input) => invoke("laobos:terminal:write", input),
    resize: (input) => invoke("laobos:terminal:resize", input),
    close: (input) => invoke("laobos:terminal:close", input),
    onData: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:terminal:data", wrapped);
      return () => ipcRenderer.removeListener("laobos:terminal:data", wrapped);
    },
    onExit: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:terminal:exit", wrapped);
      return () => ipcRenderer.removeListener("laobos:terminal:exit", wrapped);
    },
  }),
  browser: Object.freeze({
    show: (visible) => invoke("laobos:browser:show", { visible }),
    setBounds: (bounds) => invoke("laobos:browser:set-bounds", bounds),
    navigate: (url) => invoke("laobos:browser:navigate", { url }),
    action: (action) => invoke("laobos:browser:action", { action }),
    onState: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:browser:state", wrapped);
      return () => ipcRenderer.removeListener("laobos:browser:state", wrapped);
    },
  }),
  browserOps: Object.freeze({
    status: () => invoke("laobos:browserops:status"),
    start: () => invoke("laobos:browserops:start"),
    stop: () => invoke("laobos:browserops:stop"),
    onState: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:browserops:state", wrapped);
      return () => ipcRenderer.removeListener("laobos:browserops:state", wrapped);
    },
  }),
  shell: Object.freeze({
    status: () => invoke("laobos:shell:status"),
    refresh: () => invoke("laobos:shell:refresh"),
    installWsl: (distribution) => invoke("laobos:shell:install-wsl", { distribution }),
    initializeWsl: () => invoke("laobos:shell:initialize-wsl"),
    repairPrompt: () => invoke("laobos:shell:repair-prompt"),
    onState: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:shell:state", wrapped);
      return () => ipcRenderer.removeListener("laobos:shell:state", wrapped);
    },
  }),
  ssh: Object.freeze({
    list: () => invoke("laobos:ssh:list"),
    saveCredential: (input) => invoke("laobos:ssh:save-credential", input),
    saveProfile: (input) => invoke("laobos:ssh:save-profile", input),
    deleteProfile: (id) => invoke("laobos:ssh:delete-profile", { id }),
    deleteCredential: (id) => invoke("laobos:ssh:delete-credential", { id }),
    forgetHostKey: (id) => invoke("laobos:ssh:forget-host-key", { id }),
    connect: (input) => invoke("laobos:ssh:connect", input),
    write: (input) => invoke("laobos:ssh:write", input),
    resize: (input) => invoke("laobos:ssh:resize", input),
    disconnect: (id) => invoke("laobos:ssh:disconnect", { id }),
    onData: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:ssh:data", wrapped);
      return () => ipcRenderer.removeListener("laobos:ssh:data", wrapped);
    },
    onExit: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:ssh:exit", wrapped);
      return () => ipcRenderer.removeListener("laobos:ssh:exit", wrapped);
    },
  }),
  apps: Object.freeze({
    list: () => invoke("laobos:apps:list"),
    detect: (cwd) => invoke("laobos:apps:detect", { cwd }),
    findPort: (start) => invoke("laobos:apps:find-port", { start }),
    save: (input) => invoke("laobos:apps:save", input),
    start: (id) => invoke("laobos:apps:start", { id }),
    stop: (id) => invoke("laobos:apps:stop", { id }),
    logs: (id) => invoke("laobos:apps:logs", { id }),
    apiDoc: (id) => invoke("laobos:apps:api-doc", { id }),
    saveApiDoc: (id, content) => invoke("laobos:apps:save-api-doc", { id, content }),
    remove: (id) => invoke("laobos:apps:remove", { id }),
    open: (id) => invoke("laobos:apps:open", { id }),
    onLog: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:apps:log", wrapped);
      return () => ipcRenderer.removeListener("laobos:apps:log", wrapped);
    },
    onState: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on("laobos:apps:state", wrapped);
      return () => ipcRenderer.removeListener("laobos:apps:state", wrapped);
    },
  }),
}));
