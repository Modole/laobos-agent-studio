import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULTS = Object.freeze({
  version: 5,
  uploadLocation: "default",
  autoCheckUpdates: true,
  lastUpdateCheckAt: null,
  pendingUpdate: null,
  authorizedWorkspaces: [],
});

function normalizePendingUpdate(value) {
  if (!value || typeof value !== "object") return null;
  const version = typeof value.version === "string" ? value.version.slice(0, 64) : "";
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(version)) return null;
  return {
    version,
    releaseName: typeof value.releaseName === "string" ? value.releaseName.slice(0, 256) : "",
    releaseNotes: typeof value.releaseNotes === "string" ? value.releaseNotes.slice(0, 20_000) : "",
    releaseDate:
      typeof value.releaseDate === "string" && Number.isFinite(Date.parse(value.releaseDate))
        ? value.releaseDate
        : "",
    downloadedAt:
      typeof value.downloadedAt === "string" && Number.isFinite(Date.parse(value.downloadedAt))
        ? value.downloadedAt
        : null,
  };
}

export class DesktopSettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.value = { ...DEFAULTS };
    this.loaded = false;
    this.writes = Promise.resolve();
  }

  async get() {
    if (!this.loaded) await this.load();
    return { ...this.value };
  }

  async update(input) {
    if (!this.loaded) await this.load();
    const next = normalizeSettings({ ...this.value, ...input });
    this.value = next;
    this.writes = this.writes.then(() => this.persist(next));
    await this.writes;
    return { ...next };
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      this.value = normalizeSettings(parsed);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      this.value = { ...DEFAULTS };
    }
    this.loaded = true;
  }

  async persist(value) {
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, this.filePath);
  }
}

export function normalizeSettings(value) {
  const compatible = [2, 3, 4, 5].includes(value?.version);
  const lastUpdateCheckAt =
    [3, 4, 5].includes(value?.version) &&
    typeof value.lastUpdateCheckAt === "string" &&
    Number.isFinite(Date.parse(value.lastUpdateCheckAt))
      ? value.lastUpdateCheckAt
      : null;
  return {
    version: 5,
    uploadLocation:
      compatible && value?.uploadLocation === "workspace"
        ? "workspace"
        : "default",
    autoCheckUpdates:
      [3, 4, 5].includes(value?.version) ? value.autoCheckUpdates !== false : true,
    lastUpdateCheckAt,
    pendingUpdate: [4, 5].includes(value?.version) ? normalizePendingUpdate(value.pendingUpdate) : null,
    authorizedWorkspaces: value?.version === 5
      ? normalizeAuthorizedWorkspaces(value.authorizedWorkspaces)
      : [],
  };
}

function normalizeAuthorizedWorkspaces(value) {
  if (!Array.isArray(value)) return [];
  const roots = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !path.isAbsolute(entry) || entry.length > 4096) continue;
    const normalized = path.normalize(entry);
    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (!roots.some((root) => root.key === key)) roots.push({ key, value: normalized });
  }
  return roots.slice(-64).map((root) => root.value);
}
