import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectPiData, migratePiData } from "./pi-data.mjs";

export function defaultDshHome() {
  if (process.env.LAOBOS_DSH_HOME) {
    return path.resolve(process.env.LAOBOS_DSH_HOME);
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "劳博士",
      "dsh",
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "劳博士",
      "dsh",
    );
  }

  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "劳博士",
    "dsh",
  );
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function migratePiOnFirstRun({
  dshHome = defaultDshHome(),
  piHome = path.join(os.homedir(), ".pi", "agent"),
  logger = console,
} = {}) {
  const manifestPath = path.join(dshHome, "imports", "pi", "manifest.json");
  if (await exists(manifestPath)) {
    return { status: "already-migrated", dshHome, piHome };
  }

  const inspection = await inspectPiData(piHome);
  if (!inspection.found) {
    return { status: "pi-not-found", dshHome, piHome };
  }

  logger.log(
    `检测到 Pi 数据，首次启动将迁移到 DSH：${inspection.sessions} 个会话、${inspection.providers} 个凭据。`,
  );
  const result = await migratePiData({ piHome, dshHome });
  logger.log(
    `Pi → DSH 迁移完成：${result.sessions.imported} 个会话、${result.skills.copied} 个技能。`,
  );
  return { status: "migrated", dshHome, piHome, result };
}
