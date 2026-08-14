/**
 * 劳博士的 Plan 安全联动：Plan 期间强制只读，离开后恢复进入前的权限。
 * 状态从追加式会话日志推导，因此恢复、分叉和进程重启后仍然成立。
 */

export const name = "laobos-plan-permission-link";
export const inject = ["permissionPresets", "sessions"];

export function isPlanActive(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "plan/mode") return event.data.active === true;
  }
  return false;
}

export function presetBeforeLatestPlanEntry(events, permissionPresets) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "plan/mode" && event.data.active === true) {
      return permissionPresets.current(events.slice(0, index));
    }
  }
}

export function apply(ctx, config = {}) {
  const planPreset = config.planPreset || "read-only";
  const fallbackPreset = config.fallbackPreset || "workspace-write";
  const knownPresets = ctx.permissionPresets.names;

  for (const preset of [planPreset, fallbackPreset]) {
    if (!knownPresets.includes(preset)) {
      throw new Error(
        `laobos plan permission link: unknown preset ${JSON.stringify(preset)}`,
      );
    }
  }

  const scheduled = new WeakMap();

  function reconcile(session, shouldRestore) {
    if (isPlanActive(session.events)) {
      if (ctx.permissionPresets.current(session.events) !== planPreset) {
        ctx.permissionPresets.set(session, planPreset);
      }
      return;
    }

    if (!shouldRestore) return;
    const previous = presetBeforeLatestPlanEntry(
      session.events,
      ctx.permissionPresets,
    );
    const target = knownPresets.includes(previous) ? previous : fallbackPreset;
    if (ctx.permissionPresets.current(session.events) !== target) {
      ctx.permissionPresets.set(session, target);
    }
  }

  function schedule(session, shouldRestore = false) {
    const existing = scheduled.get(session);
    if (existing) {
      existing.shouldRestore ||= shouldRestore;
      return;
    }

    const request = { shouldRestore };
    scheduled.set(session, request);
    queueMicrotask(() => {
      scheduled.delete(session);
      try {
        reconcile(session, request.shouldRestore);
      } catch (error) {
        ctx.logger.warn(
          "laobos plan permission link failed to reconcile: %o",
          error,
        );
      }
    });
  }

  ctx.on("session/created", (session) => schedule(session));
  ctx.on("session/event", (session, event) => {
    if (event.type === "plan/mode") {
      schedule(session, event.data.active === false);
      return;
    }

    if (
      event.type === "permission/preset" ||
      event.type === "sandbox/mode" ||
      event.type === "approval/policy"
    ) {
      schedule(session);
    }
  });

  for (const session of ctx.sessions.list()) schedule(session);
}
