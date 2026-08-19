const EXTENSION_LANGUAGE = new Map([
  ["js", "javascript"], ["jsx", "javascript"], ["mjs", "javascript"], ["cjs", "javascript"],
  ["ts", "typescript"], ["tsx", "typescript"],
  ["json", "json"], ["jsonc", "json"],
  ["py", "python"], ["rb", "ruby"], ["rs", "rust"], ["go", "go"],
  ["java", "java"], ["kt", "kotlin"], ["kts", "kotlin"],
  ["c", "c"], ["h", "c"], ["cc", "cpp"], ["cpp", "cpp"], ["cxx", "cpp"], ["hpp", "cpp"],
  ["css", "css"], ["scss", "css"], ["less", "css"],
  ["html", "markup"], ["htm", "markup"], ["xml", "markup"], ["svg", "markup"],
  ["md", "markdown"], ["mdx", "markdown"],
  ["yaml", "yaml"], ["yml", "yaml"], ["toml", "toml"],
  ["sh", "shell"], ["bash", "shell"], ["zsh", "shell"], ["fish", "shell"],
  ["sql", "sql"], ["graphql", "graphql"], ["gql", "graphql"],
]);

const KEYWORDS = new Set(`
  abstract as async await break case catch class const continue debugger default delete do else
  enum export extends false finally for from function get if implements import in instanceof interface
  let new null of package private protected public readonly return set static super switch this throw true
  try type typeof undefined var void while with yield
  and assert def del elif except False finally for from global if import in is lambda None nonlocal not or
  pass raise return True try while with yield
  bool byte char decimal double dynamic float int long object sbyte short string uint ulong ushort
  fn impl match mod move mut pub ref self Self struct trait use where
  func go map range select chan defer fallthrough package
  SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER ON AS INSERT UPDATE DELETE CREATE ALTER DROP TABLE
  INTO VALUES SET AND OR NOT NULL PRIMARY KEY FOREIGN REFERENCES GROUP BY ORDER LIMIT OFFSET HAVING
`.trim().split(/\s+/u));

export function languageForPath(filePath = "") {
  const clean = String(filePath).split(/[?#]/u)[0];
  const name = clean.split(/[\\/]/u).at(-1)?.toLowerCase() || "";
  if (["dockerfile", "makefile", "procfile"].includes(name)) return "shell";
  const extension = name.includes(".") ? name.split(".").at(-1) : "";
  return EXTENSION_LANGUAGE.get(extension) || "text";
}

export function isCodePath(filePath = "") {
  return languageForPath(filePath) !== "text";
}

export function tokenizeCodeLine(value, language = "text") {
  const text = String(value ?? "");
  if (!text || language === "text") return [{ type: "plain", value: text }];
  const commentMarker = ["python", "ruby", "shell", "yaml", "toml"].includes(language) ? "#" : "//";
  const pattern = commentMarker === "#"
    ? /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b|\b[A-Za-z_$][\w$]*\b)/giu
    : /(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$|\/\*.*?\*\/|\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b|\b[A-Za-z_$][\w$]*\b)/giu;
  const tokens = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) tokens.push({ type: "plain", value: text.slice(cursor, match.index) });
    const token = match[0];
    let type = "plain";
    if (token.startsWith(commentMarker) || token.startsWith("/*")) type = "comment";
    else if (/^[`"']/u.test(token)) type = "string";
    else if (/^(?:\d|0x)/iu.test(token)) type = "number";
    else if (KEYWORDS.has(token) || KEYWORDS.has(token.toUpperCase())) type = "keyword";
    else if (/^[A-Z]/u.test(token)) type = "type";
    else if (text.slice((match.index || 0) + token.length).trimStart().startsWith("(")) type = "function";
    tokens.push({ type, value: token });
    cursor = (match.index || 0) + token.length;
  }
  if (cursor < text.length) tokens.push({ type: "plain", value: text.slice(cursor) });
  return tokens.length ? tokens : [{ type: "plain", value: text }];
}

export function parseUnifiedDiff(value, fallbackPath = "") {
  const rawLines = String(value || "").replace(/\r\n?/gu, "\n").split("\n");
  const lines = [];
  let oldLine = null;
  let newLine = null;
  let currentPath = fallbackPath;
  let additions = 0;
  let deletions = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/u.exec(raw);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      lines.push({ key: index, type: "hunk", oldLine: null, newLine: null, prefix: "", content: raw, path: currentPath });
      continue;
    }
    if (raw.startsWith("+++ ")) {
      const candidate = raw.slice(4).replace(/^b\//u, "");
      if (candidate !== "/dev/null") currentPath = candidate;
      lines.push({ key: index, type: "file", oldLine: null, newLine: null, prefix: "", content: raw, path: currentPath });
      continue;
    }
    if (raw.startsWith("--- ") || raw.startsWith("diff --git ")) {
      if (raw.startsWith("diff --git ")) { oldLine = null; newLine = null; }
      lines.push({ key: index, type: "file", oldLine: null, newLine: null, prefix: "", content: raw, path: currentPath });
      continue;
    }
    if (oldLine !== null && raw.startsWith("+") && !raw.startsWith("+++")) {
      lines.push({ key: index, type: "insert", oldLine: null, newLine, prefix: "+", content: raw.slice(1), path: currentPath });
      newLine += 1;
      additions += 1;
      continue;
    }
    if (oldLine !== null && raw.startsWith("-") && !raw.startsWith("---")) {
      lines.push({ key: index, type: "delete", oldLine, newLine: null, prefix: "-", content: raw.slice(1), path: currentPath });
      oldLine += 1;
      deletions += 1;
      continue;
    }
    if (oldLine !== null && raw.startsWith(" ")) {
      lines.push({ key: index, type: "normal", oldLine, newLine, prefix: " ", content: raw.slice(1), path: currentPath });
      oldLine += 1;
      newLine += 1;
      continue;
    }
    const type = raw.startsWith("\\ No newline") ? "notice" : "meta";
    lines.push({ key: index, type, oldLine: null, newLine: null, prefix: "", content: raw, path: currentPath });
  }
  return { lines, additions, deletions };
}

export function codeLines(value) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").split("\n");
}
