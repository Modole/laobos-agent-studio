import assert from "node:assert/strict";
import test from "node:test";
import {
  approveEscalation,
  validateEscalationArgs,
} from "@deepseek-ai/dsh-sandbox";

function request(requestedMode, effectiveMode) {
  return {
    requestedMode,
    effectiveMode,
    justification: "The command needs the requested file access.",
    subject: "command",
  };
}

test("a redundant same-mode sandbox request is an idempotent no-op", async () => {
  let approvalRequests = 0;
  const mode = await approveEscalation(
    request("danger-full-access", "danger-full-access"),
    {
      approver: {
        request: async () => {
          approvalRequests += 1;
          return "allowed-once";
        },
      },
    },
  );

  assert.equal(mode, "danger-full-access");
  assert.equal(approvalRequests, 0);
});

test("a stray sandbox target without justification keeps the standing policy", () => {
  assert.doesNotThrow(() => {
    validateEscalationArgs("workspace-write", undefined);
  });
  assert.throws(
    () => validateEscalationArgs(undefined, "Escalate without a target."),
    /justification is only valid together with sandbox_permissions/u,
  );
});

test("a narrower sandbox request keeps the wider standing mode", async () => {
  let approvalRequests = 0;
  const mode = await approveEscalation(
    request("workspace-write", "danger-full-access"),
    {
      approver: {
        request: async () => {
          approvalRequests += 1;
          return "allowed-once";
        },
      },
    },
  );

  assert.equal(mode, "danger-full-access");
  assert.equal(approvalRequests, 0);
});

test("a real sandbox escalation still requires and records approval", async () => {
  let approvalReason;
  const mode = await approveEscalation(
    request("danger-full-access", "workspace-write"),
    {
      approver: {
        request: async ({ reason }) => {
          approvalReason = reason;
          return "allowed-once";
        },
      },
      agent: {},
      callId: "call-1",
      toolName: "bash",
    },
  );

  assert.equal(mode, "danger-full-access");
  assert.match(approvalReason, /^escalate sandbox to danger-full-access:/u);
});
