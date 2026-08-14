import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { boundedString } from "../ipc-security.mjs";

const MAX_EXPORT_HTML_BYTES = 20 * 1024 * 1024;

export function registerConversationExportIpc({
  ipcMain,
  BrowserWindow,
  dialog,
  app,
  authorize,
  getMainWindow,
}) {
  ipcMain.handle("laobos:pdf:export-conversation", async (event, input = {}) => {
    authorize(event);
    const html = boundedString(input.html, "导出内容", MAX_EXPORT_HTML_BYTES);
    const suggestedName = safePdfName(input.suggestedName);
    const parent = getMainWindow();
    const result = await dialog.showSaveDialog(parent, {
      title: "导出会话为 PDF",
      defaultPath: path.join(app.getPath("documents"), suggestedName),
      filters: [{ name: "PDF 文档", extensions: ["pdf"] }],
      properties: ["showOverwriteConfirmation", "createDirectory"],
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    const tempRoot = path.join(app.getPath("temp"), "laobos-conversation-export");
    await mkdir(tempRoot, { recursive: true, mode: 0o700 });
    const tempFile = path.join(tempRoot, `${crypto.randomUUID()}.html`);
    await writeFile(tempFile, html, { encoding: "utf8", mode: 0o600 });

    const exportWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      await exportWindow.loadURL(pathToFileURL(tempFile).toString());
      const pdf = await exportWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        preferCSSPageSize: true,
      });
      await writeFile(result.filePath, pdf, { mode: 0o600 });
      return { canceled: false, filePath: result.filePath };
    } finally {
      if (!exportWindow.isDestroyed()) exportWindow.destroy();
      await rm(tempFile, { force: true });
    }
  });

  return () => ipcMain.removeHandler("laobos:pdf:export-conversation");
}

export function safePdfName(value) {
  const base = typeof value === "string" && value.trim() ? value.trim() : "劳博士会话";
  const sanitized = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-")
    .replace(/\s+/gu, " ")
    .slice(0, 120)
    .replace(/[. ]+$/gu, "");
  return `${sanitized || "劳博士会话"}.pdf`;
}
