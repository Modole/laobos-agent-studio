import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULTS = Object.freeze({
  version: 2,
  uploadLocation: "default",
});

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
  return {
    version: 2,
    uploadLocation:
      value?.version === 2 && value?.uploadLocation === "workspace"
        ? "workspace"
        : "default",
  };
}
