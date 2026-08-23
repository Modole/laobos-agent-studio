export const CHAT_VIRTUAL_THRESHOLD = 40;
export const CHAT_VIRTUAL_OVERSCAN = 6;
export const CHAT_ROW_ESTIMATE_PX = 112;
export const CHAT_BOTTOM_THRESHOLD_PX = 25;

export function isNearChatBottom(
  scrollHeight,
  scrollTop,
  clientHeight,
  threshold = CHAT_BOTTOM_THRESHOLD_PX,
) {
  return Math.max(0, scrollHeight - scrollTop - clientHeight) <= threshold;
}

export function virtualChatPadding(items, totalSize, scrollMargin = 0) {
  if (items.length === 0) return { top: 0, bottom: 0 };
  return {
    top: Math.max(0, items[0].start - scrollMargin),
    bottom: Math.max(
      0,
      totalSize + scrollMargin - items[items.length - 1].end,
    ),
  };
}

export function chatAnchorScrollTop(measurement, anchorTop) {
  if (measurement === undefined) return undefined;
  return Math.max(0, measurement.start - Math.max(0, anchorTop));
}
