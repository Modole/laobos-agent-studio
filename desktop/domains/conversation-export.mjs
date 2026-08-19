import { writeFile } from "node:fs/promises";
import path from "node:path";
import { boundedString } from "../ipc-security.mjs";

const MAX_EXPORT_HTML_BYTES = 100 * 1024 * 1024;

export function registerConversationExportIpc({
  ipcMain,
  dialog,
  app,
  authorize,
  getMainWindow,
}) {
  ipcMain.handle("laobos:html:export-conversation", async (event, input = {}) => {
    authorize(event);
    const html = boundedString(input.html, "导出内容", MAX_EXPORT_HTML_BYTES);
    const suggestedName = safeHtmlName(input.suggestedName);
    const parent = getMainWindow();
    const result = await dialog.showSaveDialog(parent, {
      title: "导出会话为 HTML",
      defaultPath: path.join(app.getPath("documents"), suggestedName),
      filters: [{ name: "HTML 文档", extensions: ["html"] }],
      properties: ["showOverwriteConfirmation", "createDirectory"],
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    await writeFile(result.filePath, html, { encoding: "utf8", mode: 0o600 });
    return { canceled: false, filePath: result.filePath };
  });

  return () => ipcMain.removeHandler("laobos:html:export-conversation");
}

export function safeHtmlName(value) {
  const base = typeof value === "string" && value.trim() ? value.trim() : "劳博士会话";
  const sanitized = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-")
    .replace(/\s+/gu, " ")
    .slice(0, 120)
    .replace(/[. ]+$/gu, "");
  return `${sanitized || "劳博士会话"}.html`;
}
