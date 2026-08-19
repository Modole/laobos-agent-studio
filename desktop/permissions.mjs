const CLIPBOARD_WRITE_PERMISSION = "clipboard-sanitized-write";

function normalizedOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedRuntimePermission({ webContents, requestingOrigin, runtimeUrl }) {
  const expectedOrigin = normalizedOrigin(runtimeUrl);
  if (!expectedOrigin) return false;

  const requestedOrigin = normalizedOrigin(requestingOrigin);
  const pageOrigin = normalizedOrigin(webContents?.getURL?.());
  return requestedOrigin === expectedOrigin && (!pageOrigin || pageOrigin === expectedOrigin);
}

export function installPermissionPolicy({ session, getRuntimeUrl }) {
  const mayWriteClipboard = (webContents, permission, requestingOrigin) => (
    permission === CLIPBOARD_WRITE_PERMISSION
    && isTrustedRuntimePermission({
      webContents,
      requestingOrigin,
      runtimeUrl: getRuntimeUrl(),
    })
  );

  session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    mayWriteClipboard(webContents, permission, requestingOrigin)
  ));
  session.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const requestingOrigin = details.requestingOrigin
      || details.requestingUrl
      || webContents?.getURL?.();
    callback(mayWriteClipboard(webContents, permission, requestingOrigin));
  });
}
