import assert from "node:assert/strict";
import test from "node:test";
import {
  apply,
  isPlanActive,
  presetBeforeLatestPlanEntry,
} from "../plugins/plan-permission-link.mjs";

function event(type, data) {
  return { type, data };
}

function createFixture(initialPreset = "workspace-write") {
  const listeners = new Map();
  const session = {
    events: [event("permission/preset", { preset: initialPreset })],
  };
  const permissionPresets = {
    names: ["read-only", "workspace-write", "danger-full-access"],
    current(events) {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const candidate = events[index];
        if (candidate.type === "permission/preset") {
          return candidate.data.preset;
        }
      }
      return "workspace-write";
    },
    set(targetSession, preset) {
      const added = event("permission/preset", { preset });
      targetSession.events.push(added);
      listeners.get("session/event")?.(targetSession, added);
    },
  };
  const warnings = [];
  const ctx = {
    permissionPresets,
    sessions: { list: () => [] },
    logger: { warn: (...args) => warnings.push(args) },
    on(name, listener) {
      listeners.set(name, listener);
    },
  };

  apply(ctx, {
    planPreset: "read-only",
    fallbackPreset: "workspace-write",
  });

  function append(type, data) {
    const added = event(type, data);
    session.events.push(added);
    listeners.get("session/event")?.(session, added);
  }

  return { append, listeners, permissionPresets, session, warnings };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("plan state and restore target are derived from durable events", () => {
  const permissionPresets = {
    current(events) {
      return events.findLast((item) => item.type === "permission/preset")?.data
        .preset;
    },
  };
  const events = [
    event("permission/preset", { preset: "danger-full-access" }),
    event("plan/mode", { active: true }),
    event("permission/preset", { preset: "read-only" }),
  ];

  assert.equal(isPlanActive(events), true);
  assert.equal(
    presetBeforeLatestPlanEntry(events, permissionPresets),
    "danger-full-access",
  );
});

test("entering Plan forces read-only and leaving restores the prior preset", async () => {
  const fixture = createFixture("workspace-write");
  fixture.append("plan/mode", { active: true });
  await flushMicrotasks();
  assert.equal(
    fixture.permissionPresets.current(fixture.session.events),
    "read-only",
  );

  fixture.append("plan/mode", { active: false });
  await flushMicrotasks();
  assert.equal(
    fixture.permissionPresets.current(fixture.session.events),
    "workspace-write",
  );
  assert.deepEqual(fixture.warnings, []);
});

test("permission changes attempted during Plan are reverted to read-only", async () => {
  const fixture = createFixture("workspace-write");
  fixture.append("plan/mode", { active: true });
  await flushMicrotasks();

  fixture.permissionPresets.set(fixture.session, "danger-full-access");
  await flushMicrotasks();
  assert.equal(
    fixture.permissionPresets.current(fixture.session.events),
    "read-only",
  );
});
