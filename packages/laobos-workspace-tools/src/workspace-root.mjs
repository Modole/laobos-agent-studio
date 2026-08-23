function pathValue(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

export function resolveWorkspaceRoot(sessionSnapshot, workspaceSnapshot, sessionId) {
  const workspaces = Array.isArray(workspaceSnapshot?.items) ? workspaceSnapshot.items : [];
  const resolvedSessionId = sessionId || sessionSnapshot?.current;

  if (resolvedSessionId) {
    const workspace = workspaces.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(resolvedSessionId));
    const workspacePath = pathValue(workspace?.path);
    if (workspacePath) return workspacePath;

    const sessionPath = pathValue(sessionSnapshot?.byId?.[resolvedSessionId]?.cwd);
    if (sessionPath) return sessionPath;
    return "";
  }

  const recentWorkspace = workspaces.find((item) => item?.workspaceId === workspaceSnapshot?.recentWorkspaceId);
  return pathValue(recentWorkspace?.path);
}
