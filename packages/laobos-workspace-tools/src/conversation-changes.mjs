export const CONVERSATION_CHANGE_STATS_KEY = "laobosConversationChangeStats";

function diffTextLineCount(text) {
  if (text === "") return 0;
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  return body.split("\n").length;
}

function normalizeChangePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

/**
 * Extract trustworthy, per-file line totals from a successful diff result.
 * The result-side view is authoritative and uses the same visible-line
 * convention as DSH's inline diff footer and folded Edit/Write rows.
 */
export function conversationDiffChanges(view, seq) {
  if (view?.card !== "diff" || !Array.isArray(view.diffs) || view.diffs.length === 0) return [];
  const changes = [];
  for (const hunk of view.diffs) {
    if (typeof hunk !== "object" || hunk === null) return [];
    if (typeof hunk.path !== "string" || (hunk.oldText !== null && typeof hunk.oldText !== "string") || typeof hunk.newText !== "string") return [];
    changes.push({
      seq,
      path: hunk.path,
      additions: diffTextLineCount(hunk.newText),
      deletions: hunk.oldText === null ? 0 : diffTextLineCount(hunk.oldText),
    });
  }
  return changes;
}

/**
 * Conversation projection that preserves successful Edit/Write diff totals in
 * turn data. Unlike a live Git query, these facts remain available after the
 * user commits or otherwise cleans the worktree.
 */
export function createConversationChangeStatsDefinition(isAppendSurfaceEvent) {
  return {
    kind: CONVERSATION_CHANGE_STATS_KEY,
    match(event) {
      if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
      if (event.type === "tool/result" && isAppendSurfaceEvent(event)) return { id: String(event.data.turn), role: "update" };
      return null;
    },
    start(_context, match) {
      if (match.event.type !== "turn/start") throw new Error("conversation change stats start requires turn/start");
      return { turn: match.event.data.turn, changes: [] };
    },
    update(context, match) {
      if (match.event.type !== "tool/result" || match.event.data.message.content[0]?.isError === true) return context.state;
      const view = match.view?.for === "result" ? match.view.view : null;
      const changes = conversationDiffChanges(view, match.event.seq);
      return changes.length === 0 ? context.state : { ...context.state, changes: [...context.state.changes, ...changes] };
    },
    buildLocationData(context, scope) {
      return scope !== "turn" || context.state === undefined ? null : {
        kind: "turn",
        turn: context.state.turn,
        key: CONVERSATION_CHANGE_STATS_KEY,
        value: { changes: context.state.changes },
      };
    },
  };
}

/**
 * Return the successful mutation paths published for one completed DSH turn.
 * Paths keep tool order, are deduplicated, and exclude settlements after the
 * closing assistant node.
 */
export function selectConversationChangePaths(owner) {
  const produced = owner.turn?.data?.get?.("deliverables")?.produced;
  if (!Array.isArray(produced)) return null;
  const paths = [];
  const seen = new Set();
  for (const entry of produced) {
    if (entry?.seq > owner.seq || typeof entry?.path !== "string" || seen.has(entry.path)) continue;
    seen.add(entry.path);
    paths.push(entry.path);
  }
  return paths.length ? paths : null;
}

/**
 * Select the files and durable cumulative Edit/Write totals for one closing
 * assistant node. The stats are optional so older sessions can fall back to a
 * current Git summary without losing the produced-file card.
 */
export function selectConversationChanges(owner) {
  const paths = selectConversationChangePaths(owner);
  if (paths === null) return null;
  const fileTotals = new Map(paths.map((path) => [normalizeChangePath(path), {
    path,
    additions: 0,
    deletions: 0,
    counted: 0,
  }]));
  const changes = owner.turn?.data?.get?.(CONVERSATION_CHANGE_STATS_KEY)?.changes;
  let additions = 0;
  let deletions = 0;
  let counted = 0;
  if (Array.isArray(changes)) {
    for (const change of changes) {
      const file = fileTotals.get(normalizeChangePath(change?.path));
      if (change?.seq > owner.seq || file === undefined) continue;
      if (!Number.isInteger(change?.additions) || change.additions < 0 || !Number.isInteger(change?.deletions) || change.deletions < 0) continue;
      additions += change.additions;
      deletions += change.deletions;
      counted += 1;
      file.additions += change.additions;
      file.deletions += change.deletions;
      file.counted += 1;
    }
  }
  return {
    paths,
    stats: counted === 0 ? null : {
      additions,
      deletions,
      files: [...fileTotals.values()].filter((file) => file.counted > 0).map(({ path, additions: fileAdditions, deletions: fileDeletions }) => ({
        path,
        additions: fileAdditions,
        deletions: fileDeletions,
      })),
    },
  };
}
