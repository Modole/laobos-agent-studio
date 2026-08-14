const OPEN_TAG = "<laobos-file>";
const CLOSE_TAG = "</laobos-file>";
const ENVELOPE_PATTERN = /<laobos-file>\s*([\s\S]*?)\s*<\/laobos-file>/gu;

export function fileFromReference(value) {
  const candidate = typeof value === "string" ? JSON.parse(value) : value;
  if (!candidate || typeof candidate !== "object") throw new Error("文件引用无效。 ");
  const name = String(candidate.name || "").trim();
  const absolutePath = String(candidate.path || "").trim();
  const size = Number(candidate.size);
  const isAbsolute = absolutePath.startsWith("/")
    || /^[a-zA-Z]:[\\/]/u.test(absolutePath)
    || absolutePath.startsWith("\\\\");
  if (!name || name.length > 180) throw new Error("文件名称无效。 ");
  if (!isAbsolute || absolutePath.length > 4096) throw new Error("文件绝对路径无效。 ");
  if (!Number.isSafeInteger(size) || size < 0) throw new Error("文件大小无效。 ");
  return {
    version: 1,
    kind: "file",
    id: String(candidate.id || "").slice(0, 128),
    name,
    path: absolutePath,
    mimeType: String(candidate.mimeType || "application/octet-stream").slice(0, 255),
    size,
    location: candidate.location === "workspace" ? "workspace" : "default",
  };
}

export function serializeFileEnvelope(value) {
  const file = fileFromReference(value);
  const json = JSON.stringify(file).replace(/[<>&]/gu, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
  })[character]);
  return `${OPEN_TAG}\n${json}\n${CLOSE_TAG}`;
}

export function parseFileEnvelopes(value) {
  const files = [];
  const text = String(value || "").replace(ENVELOPE_PATTERN, (match, payload) => {
    try {
      files.push(fileFromReference(JSON.parse(payload)));
      return "";
    } catch {
      return match;
    }
  }).replace(/\n{3,}/gu, "\n\n").trim();
  return { text, files };
}
