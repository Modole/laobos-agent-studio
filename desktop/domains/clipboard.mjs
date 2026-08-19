import { boundedString } from "../ipc-security.mjs";

const MAX_CLIPBOARD_TEXT_LENGTH = 10 * 1024 * 1024;

export function registerClipboardIpc({ ipcMain, clipboard, authorize }) {
  ipcMain.handle("laobos:clipboard:write-text", (event, input = {}) => {
    authorize(event);
    const text = boundedString(input.text, "剪贴板内容", MAX_CLIPBOARD_TEXT_LENGTH);
    clipboard.writeText(text);
    return { written: true };
  });

  return () => ipcMain.removeHandler("laobos:clipboard:write-text");
}
