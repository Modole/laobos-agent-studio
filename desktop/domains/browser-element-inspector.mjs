import { randomUUID } from "node:crypto";
import { browserElementFromReference } from "../../packages/laobos-browserops/lib/element-envelope.js";

export const BROWSER_ELEMENT_HIGHLIGHT = Object.freeze({
  showInfo: true,
  showStyles: false,
  showRulers: false,
  showAccessibilityInfo: true,
  contentColor: { r: 92, g: 117, b: 255, a: 0.18 },
  paddingColor: { r: 92, g: 117, b: 255, a: 0.10 },
  borderColor: { r: 92, g: 117, b: 255, a: 0.95 },
  marginColor: { r: 246, g: 178, b: 107, a: 0.12 },
});

function inspectedElementMetadata() {
  const element = this; // eslint-disable-line @typescript-eslint/no-this-alias -- CDP binds the selected node as `this`.
  const cssEscape = (value) => {
    try { if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value)); } catch {}
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  };
  const selectorSegment = (target) => {
    const tag = String(target.localName || target.tagName || "element").toLowerCase();
    const id = target.getAttribute?.("id");
    if (id) return `${tag}#${cssEscape(id)}`;
    const classes = Array.from(target.classList || [])
      .filter((value) => value && value.length <= 80)
      .slice(0, 2)
      .map((value) => `.${cssEscape(value)}`)
      .join("");
    const parent = target.parentElement;
    if (!parent) return `${tag}${classes}`;
    const siblings = Array.from(parent.children || []).filter((candidate) => candidate.localName === target.localName);
    const ordinal = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(target) + 1})` : "";
    return `${tag}${classes}${ordinal}`;
  };
  const selector = () => {
    const parts = [];
    let target = element;
    for (let depth = 0; target && depth < 8; depth += 1) {
      parts.unshift(selectorSegment(target));
      if (target.getAttribute?.("id")) break;
      if (target.parentElement) target = target.parentElement;
      else {
        const root = target.getRootNode?.();
        target = root?.host || null;
        if (target) parts.unshift(">>>");
      }
    }
    return parts.join(" > ").replace(/ > >>> > /g, " >>> ").slice(0, 1_024);
  };
  const sourceFromLocation = (location) => {
    const value = String(location || "");
    const match = /^(.*?):(\d+)(?::(\d+))?$/.exec(value);
    return match ? { file: match[1], line: Number(match[2]), column: Number(match[3] || 0) } : { file: value };
  };
  const sourceHint = () => {
    let target = element;
    for (let depth = 0; target && depth < 6; depth += 1, target = target.parentElement) {
      const sourceFile = target.getAttribute?.("data-source-file") || target.getAttribute?.("data-source");
      const location = target.getAttribute?.("data-loc");
      const component = target.getAttribute?.("data-component");
      if (sourceFile || location || component) return { ...sourceFromLocation(sourceFile || location), component: component || "" };
      try {
        const vue = target.__vueParentComponent;
        if (vue) {
          const type = vue.type || {};
          const file = type.__file || "";
          const name = type.name || type.__name || "";
          if (file || name) return { file, component: name };
        }
      } catch {}
      try {
        const property = Object.getOwnPropertyNames(target).find((name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
        let fiber = property ? target[property] : null;
        for (let index = 0; fiber && index < 32; index += 1, fiber = fiber.return) {
          const type = fiber.elementType || fiber.type || {};
          const owner = fiber._debugOwner || {};
          const debugSource = fiber._debugSource || owner._debugSource || type._debugSource;
          const componentName = type.displayName || type.name || owner.type?.displayName || owner.type?.name || "";
          if (debugSource?.fileName || componentName) {
            return {
              file: debugSource?.fileName || "",
              line: debugSource?.lineNumber || 0,
              column: debugSource?.columnNumber || 0,
              component: componentName,
            };
          }
        }
      } catch {}
    }
    return undefined;
  };
  const tagName = String(element.localName || element.tagName || "").toLowerCase();
  const inputType = String(element.getAttribute?.("type") || "").toLowerCase();
  const sensitiveText = ["input", "textarea", "select", "option"].includes(tagName)
    || inputType === "password"
    || element.isContentEditable === true;
  let text = "";
  if (!sensitiveText) {
    try { text = String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 600); } catch {}
  }
  return {
    page: { url: String(globalThis.location?.href || ""), title: String(globalThis.document?.title || "") },
    selector: selector(),
    text,
    source: sourceHint(),
  };
}

function commandValue(result) {
  return result?.status === "fulfilled" ? result.value : undefined;
}

function attributesFromDescription(node) {
  const values = Array.isArray(node?.attributes) ? node.attributes : [];
  const attributes = {};
  for (let index = 0; index + 1 < values.length; index += 2) attributes[String(values[index])] = String(values[index + 1]);
  return attributes;
}

function stylesFromResponse(response) {
  const styles = {};
  for (const declaration of response?.computedStyle || []) {
    if (typeof declaration?.name === "string" && typeof declaration?.value === "string") styles[declaration.name] = declaration.value;
  }
  return styles;
}

export function boundsFromBoxModel(model) {
  const quad = Array.isArray(model?.border) && model.border.length >= 8 ? model.border : model?.content;
  if (!Array.isArray(quad) || quad.length < 8) {
    return { x: 0, y: 0, width: Number(model?.width) || 0, height: Number(model?.height) || 0 };
  }
  const xs = quad.filter((_value, index) => index % 2 === 0).map(Number).filter(Number.isFinite);
  const ys = quad.filter((_value, index) => index % 2 === 1).map(Number).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export async function collectBrowserElementContext({
  sendCommand,
  backendNodeId,
  sessionId,
  id = randomUUID(),
  capturedAt = Date.now(),
  fallbackPage = {},
}) {
  if (!Number.isSafeInteger(Number(backendNodeId)) || Number(backendNodeId) <= 0) throw new Error("选中的网页元素已经失效，请重新选择。 ");
  const command = (method, params = {}) => sendCommand(method, params, sessionId || undefined);
  const objectGroup = `laobos-browser-element-${id}`.slice(0, 180);
  const [describedResult, boxResult, accessibilityResult, pushedResult, resolvedResult] = await Promise.allSettled([
    command("DOM.describeNode", { backendNodeId, depth: 0, pierce: true }),
    command("DOM.getBoxModel", { backendNodeId }),
    command("Accessibility.getPartialAXTree", { backendNodeId, fetchRelatives: false }),
    command("DOM.pushNodesByBackendIdsToFrontend", { backendNodeIds: [backendNodeId] }),
    command("DOM.resolveNode", { backendNodeId, objectGroup }),
  ]);
  const node = commandValue(describedResult)?.node;
  if (!node) throw new Error("选中的网页元素已经变化，请重新选择。 ");
  const resolved = commandValue(resolvedResult)?.object;
  let metadata = {};
  let nodeId = commandValue(pushedResult)?.nodeIds?.[0];
  if (!nodeId && resolved?.objectId) {
    try { nodeId = (await command("DOM.requestNode", { objectId: resolved.objectId }))?.nodeId; } catch {}
  }
  const [styleResult, metadataResult] = await Promise.allSettled([
    nodeId ? command("CSS.getComputedStyleForNode", { nodeId }) : Promise.resolve(undefined),
    resolved?.objectId ? command("Runtime.callFunctionOn", {
      objectId: resolved.objectId,
      functionDeclaration: inspectedElementMetadata.toString(),
      returnByValue: true,
      silent: true,
    }) : Promise.resolve(undefined),
  ]);
  try { metadata = commandValue(metadataResult)?.result?.value || {}; } catch {}
  try { await command("Runtime.releaseObjectGroup", { objectGroup }); } catch {}
  const accessibilityNodes = commandValue(accessibilityResult)?.nodes || [];
  const accessibility = accessibilityNodes.find((candidate) => candidate?.backendDOMNodeId === Number(backendNodeId)) || accessibilityNodes[0] || {};
  const rawTagName = node.localName || node.nodeName || "element";
  return browserElementFromReference({
    version: 1,
    kind: "browser-element",
    id,
    capturedAt,
    page: {
      url: metadata.page?.url || fallbackPage.url,
      title: metadata.page?.title || fallbackPage.title,
    },
    element: {
      tagName: String(rawTagName).toLowerCase(),
      selector: metadata.selector,
      text: metadata.text,
      role: accessibility.role?.value,
      accessibleName: accessibility.name?.value,
      attributes: attributesFromDescription(node),
      styles: stylesFromResponse(commandValue(styleResult)),
      bounds: boundsFromBoxModel(commandValue(boxResult)?.model),
      source: metadata.source,
    },
  });
}
