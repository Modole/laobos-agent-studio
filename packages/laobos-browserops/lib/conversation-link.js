function clickTargetElement(target) {
  if (target?.nodeType === 3) return target.parentElement;
  return target;
}

export function conversationBrowserUrlFromClick(event, baseUrl = globalThis.location?.href) {
  if (!event || event.defaultPrevented) return "";
  if (event.button !== undefined && event.button !== 0) return "";
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return "";
  const anchor = clickTargetElement(event.target)?.closest?.("a[href]");
  if (!anchor || !anchor.closest?.("[data-conversation-scroll]") || anchor.hasAttribute?.("download")) return "";
  const raw = String(anchor.getAttribute?.("href") || "").trim();
  if (!/^(?:https?:)?\/\//iu.test(raw)) return "";
  try {
    const url = new URL(raw, baseUrl || "http://laobos.invalid/");
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}
