import crypto from "node:crypto";
import { mkdir, open, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { boundedString, isPathInside } from "../ipc-security.mjs";

const MAX_HEADER_BYTES = 64 * 1024;

export function registerSessionTrashIpc({ ipcMain, dshHome, authorize }) {
  ipcMain.handle("laobos:sessions:trash", async (event, input = {}) => {
    authorize(event);
    const sessionId = boundedString(input.sessionId, "会话 ID", 512).trim();
    if (!sessionId || sessionId.includes("\0")) throw new Error("会话 ID 无效。 ");

    const sessionsRoot = path.join(dshHome, "sessions");
    const source = await findSessionDirectory(sessionsRoot, sessionId);
    if (!source) return { moved: false, reason: "not-found" };

    const trashRoot = path.join(dshHome, "trash", "sessions");
    await mkdir(trashRoot, { recursive: true, mode: 0o700 });
    const target = path.join(
      trashRoot,
      `${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID()}`,
    );
    await rename(source.directory, target);
    await writeFile(
      path.join(target, "laobos-trash.json"),
      `${JSON.stringify({
        version: 1,
        sessionId,
        cwd: source.header.cwd,
        trashedAt: new Date().toISOString(),
        sourceDirectory: source.directory,
      }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    return { moved: true };
  });

  return () => ipcMain.removeHandler("laobos:sessions:trash");
}

export async function findSessionDirectory(sessionsRoot, sessionId) {
  let projects;
  try {
    projects = await readdir(sessionsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }

  for (const project of projects) {
    if (!project.isDirectory() || project.isSymbolicLink()) continue;
    const projectPath = path.join(sessionsRoot, project.name);
    const entries = await readdir(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const directory = path.join(projectPath, entry.name);
      if (!isPathInside(sessionsRoot, directory)) continue;
      for (const filename of ["session.jsonl", "session.jsonl.zst"]) {
        const artifact = path.join(directory, filename);
        const header = await readJsonlHeader(artifact, filename.endsWith(".zst"));
        if (header?.id === sessionId) return { directory, header };
      }
    }
  }
  return undefined;
}

async function readJsonlHeader(filePath, compressed) {
  if (compressed) return undefined;
  let handle;
  try {
    handle = await open(filePath, "r");
    const buffer = Buffer.alloc(MAX_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const lineEnd = buffer.indexOf(0x0a, 0);
    const end = lineEnd === -1 ? bytesRead : lineEnd;
    if (end === 0 || (lineEnd === -1 && bytesRead === buffer.length)) return undefined;
    const value = JSON.parse(buffer.subarray(0, end).toString("utf8"));
    return value?.type === "session" && typeof value.id === "string"
      ? value
      : undefined;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return undefined;
    throw error;
  } finally {
    await handle?.close();
  }
}
