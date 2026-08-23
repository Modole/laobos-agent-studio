import path from "node:path";
import { SshService, fingerprint, parseOpenSshConfig } from "../ssh-service.mjs";

export { fingerprint, parseOpenSshConfig };

export function registerSshIpc({
  ipcMain,
  app,
  safeStorage,
  dialog,
  authorize,
  getMainWindow,
  sshService,
}) {
  const service = sshService || new SshService({ app, safeStorage });
  const handlers = new Map([
    ["laobos:ssh:list", () => service.list()],
    ["laobos:ssh:save-credential", (input) => service.saveCredential(input)],
    ["laobos:ssh:save-profile", (input) => service.saveProfile(input)],
    ["laobos:ssh:delete-profile", (input) => service.deleteProfile(input)],
    ["laobos:ssh:delete-credential", (input) => service.deleteCredential(input)],
    ["laobos:ssh:forget-host-key", (input) => service.forgetHostKey(input)],
    ["laobos:ssh:import-config", () => service.importOpenSshConfig()],
    ["laobos:ssh:connect", (input) => service.connect(input)],
    ["laobos:ssh:write", (input) => service.write(input)],
    ["laobos:ssh:resize", (input) => service.resize(input)],
    ["laobos:ssh:disconnect", (input) => ({ disconnected: service.close(input.id, "user") })],
    ["laobos:ssh:sftp", (input) => service.sftpConnection(input)],
  ]);
  for (const [channel, handler] of handlers) {
    ipcMain.handle(channel, (event, input = {}) => {
      authorize(event);
      return handler(input);
    });
  }

  ipcMain.handle("laobos:ssh:upload", async (event, input = {}) => {
    authorize(event);
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled) return { canceled: true, files: [] };
    const remoteDirectory = remotePath(input.remoteDirectory || ".");
    const files = [];
    for (const localPath of result.filePaths) {
      const target = joinRemote(remoteDirectory, path.basename(localPath));
      files.push(await service.uploadLocal({ id: input.id, localPath, remotePath: target }));
    }
    return { canceled: false, files };
  });

  ipcMain.handle("laobos:ssh:download", async (event, input = {}) => {
    authorize(event);
    const source = remotePath(input.remotePath);
    const result = await dialog.showSaveDialog(getMainWindow(), {
      defaultPath: path.basename(source),
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return {
      canceled: false,
      ...(await service.downloadLocal({ id: input.id, remotePath: source, localPath: result.filePath })),
    };
  });

  const sendData = (payload) => send(getMainWindow, "laobos:ssh:data", payload);
  const sendExit = (payload) => send(getMainWindow, "laobos:ssh:exit", payload);
  service.on("data", sendData);
  service.on("exit", sendExit);

  return () => {
    service.off("data", sendData);
    service.off("exit", sendExit);
    for (const channel of [...handlers.keys(), "laobos:ssh:upload", "laobos:ssh:download"]) {
      ipcMain.removeHandler(channel);
    }
    if (!sshService) service.dispose();
  };
}

function remotePath(value) {
  const result = String(value || "").trim();
  if (!result || result.includes("\0") || result.length > 4096) throw new Error("远程路径无效。 ");
  return result;
}

function joinRemote(directory, name) {
  const root = directory === "/" ? "" : directory.replace(/\/+$/u, "");
  return `${root}/${name.replace(/^\/+/, "")}`;
}

function send(getMainWindow, channel, payload) {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}
