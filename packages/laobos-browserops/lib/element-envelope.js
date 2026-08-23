const OPEN_TAG = "<laobos-browser-element>";
const CLOSE_TAG = "</laobos-browser-element>";
const ENVELOPE_PATTERN = /<laobos-browser-element>\s*([\s\S]*?)\s*<\/laobos-browser-element>/gu;

const ATTRIBUTE_NAMES = new Set([
  "id",
  "class",
  "role",
  "name",
  "type",
  "alt",
  "title",
  "href",
  "src",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "data-testid",
  "data-test-id",
  "data-component",
  "data-source-file",
  "data-loc",
]);

const STYLE_NAMES = new Set([
  "display",
  "position",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "padding",
  "gap",
  "color",
  "background-color",
  "border",
  "border-radius",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "opacity",
  "overflow",
  "z-index",
  "flex-direction",
  "align-items",
  "justify-content",
  "grid-template-columns",
]);

function limitedString(value, maximum) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").slice(0, maximum);
}

function finiteNumber(value, minimum = -1_000_000, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(minimum, Math.round(number * 100) / 100));
}

function safePageUrl(value, suppliedQueryKeys) {
  const input = limitedString(value, 4_096);
  if (!input) return { url: "", queryKeys: [] };
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { url: "", queryKeys: [] };
    const queryKeys = [...new Set([
      ...url.searchParams.keys(),
      ...(Array.isArray(suppliedQueryKeys) ? suppliedQueryKeys : []),
    ].map((key) => limitedString(key, 80)).filter(Boolean))].slice(0, 16);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return { url: url.toString(), queryKeys };
  } catch {
    return { url: "", queryKeys: [] };
  }
}

function safeResourceReference(value, pageUrl) {
  const input = limitedString(value, 1_024).trim();
  if (!input || /^data:/iu.test(input) || /^javascript:/iu.test(input)) return "";
  try {
    const absolute = /^[a-z][a-z\d+.-]*:/iu.test(input) || input.startsWith("//");
    const url = new URL(input, pageUrl || "http://laobos.invalid/");
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return absolute ? url.toString() : `${url.pathname}${url.hash}`;
  } catch {
    return "";
  }
}

function safeAttributes(value, pageUrl) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const attributes = {};
  for (const name of ATTRIBUTE_NAMES) {
    if (!Object.hasOwn(value, name)) continue;
    const raw = name === "href" || name === "src"
      ? safeResourceReference(value[name], pageUrl)
      : limitedString(value[name], 512);
    if (raw) attributes[name] = raw;
  }
  return attributes;
}

function safeStyles(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const styles = {};
  for (const name of STYLE_NAMES) {
    if (!Object.hasOwn(value, name)) continue;
    const style = limitedString(value[name], 160);
    if (style) styles[name] = style;
  }
  return styles;
}

function safeSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const file = limitedString(value.file, 1_024).trim();
  const component = limitedString(value.component, 200).trim();
  const line = Math.max(0, Math.min(10_000_000, Math.trunc(Number(value.line) || 0)));
  const column = Math.max(0, Math.min(100_000, Math.trunc(Number(value.column) || 0)));
  if (!file && !component) return undefined;
  return { file, component, line, column };
}

export function browserElementFromReference(value) {
  const candidate = typeof value === "string" ? JSON.parse(value) : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("网页元素上下文无效。 ");
  if (candidate.version !== 1 || candidate.kind !== "browser-element") throw new Error("网页元素上下文版本无效。 ");
  const page = safePageUrl(candidate.page?.url, candidate.page?.queryKeys);
  if (!page.url) throw new Error("网页元素页面地址无效。 ");
  const tagName = limitedString(candidate.element?.tagName, 80).trim().toLowerCase();
  const id = limitedString(candidate.id, 128).trim();
  if (!id) throw new Error("网页元素上下文标识无效。 ");
  if (!/^[a-z][a-z\d:-]*$/u.test(tagName)) throw new Error("网页元素标签无效。 ");
  const bounds = candidate.element?.bounds || {};
  return {
    version: 1,
    kind: "browser-element",
    trust: "untrusted-page-content",
    id,
    capturedAt: Math.max(0, Math.trunc(Number(candidate.capturedAt) || 0)),
    page: {
      url: page.url,
      title: limitedString(candidate.page?.title, 240).trim(),
      queryKeys: page.queryKeys,
    },
    element: {
      tagName,
      selector: limitedString(candidate.element?.selector, 1_024).trim(),
      text: limitedString(candidate.element?.text, 600).trim(),
      role: limitedString(candidate.element?.role, 120).trim(),
      accessibleName: limitedString(candidate.element?.accessibleName, 320).trim(),
      attributes: safeAttributes(candidate.element?.attributes, page.url),
      styles: safeStyles(candidate.element?.styles),
      bounds: {
        x: finiteNumber(bounds.x),
        y: finiteNumber(bounds.y),
        width: finiteNumber(bounds.width, 0),
        height: finiteNumber(bounds.height, 0),
      },
      source: safeSource(candidate.element?.source),
    },
  };
}

export function serializeBrowserElementEnvelope(value) {
  const context = browserElementFromReference(value);
  const json = JSON.stringify(context).replace(/[<>&]/gu, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
  })[character]);
  return `${OPEN_TAG}\n${json}\n${CLOSE_TAG}`;
}

export function parseBrowserElementEnvelopes(value) {
  const elements = [];
  const text = String(value || "").replace(ENVELOPE_PATTERN, (match, payload) => {
    try {
      elements.push(browserElementFromReference(JSON.parse(payload)));
      return "";
    } catch {
      return match;
    }
  }).replace(/\n{3,}/gu, "\n\n").trim();
  return { text, elements };
}

export function browserElementLabel(context) {
  const element = browserElementFromReference(context).element;
  return element.accessibleName || element.text || element.selector || `<${element.tagName}>`;
}
