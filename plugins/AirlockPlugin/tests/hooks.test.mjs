import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { decidePreToolUse, describePotentialOnlineWrite } from "../runtime/hook-enforcement.mjs";
import { loadMissionState, removeMissionState, saveMissionState } from "../runtime/session-state.mjs";

// These tests exercise the security boundary independently of the Copilot host:
// state must be atomic, missing/blocked state must deny, and allowed local tools
// must still fall through to the host's normal permission system.
const sessionId = "test-session";
const event = { sessionId, toolName: "view", toolArgs: { path: "README.md" } };
const allowed = {
  sessionId, decision: "allow", reason: "no-online-write-match", promptTimestamp: Date.now(),
};

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "airlock-hook-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("mission state is replaced atomically and removed at session end", async t => {
  const root = await scratch(t);
  await saveMissionState(allowed, root);
  assert.deepEqual(await loadMissionState(sessionId, root), allowed);
  const blocked = { ...allowed, decision: "block", reason: "online-write-intent" };
  await saveMissionState(blocked, root);
  assert.deepEqual(await loadMissionState(sessionId, root), blocked);
  await removeMissionState(sessionId, root);
  assert.equal(await loadMissionState(sessionId, root), null);
});

test("blocked or missing mission state denies every tool", async () => {
  const check = async () => assert.fail("tool check must not run");
  assert.equal((await decidePreToolUse({ event, mission: null, check })).permissionDecision, "deny");
  assert.equal((await decidePreToolUse({
    event, mission: { ...allowed, decision: "block", reason: "online-write-intent" }, check,
  })).permissionDecision, "deny");
});

test("allowed local tools fall through to normal host permissions", async () => {
  assert.deepEqual(await decidePreToolUse({
    event, mission: allowed, check: async () => assert.fail("tool check must not run"),
  }), {});
});

test("shell commands are rechecked and direct online mutation tools are denied", async () => {
  assert.deepEqual(describePotentialOnlineWrite("powershell", { command: "git push origin main" }), {
    prompt: "git push origin main",
  });
  assert.equal(describePotentialOnlineWrite("mail-SendEmailWithAttachments", {}).reason, "direct-online-write");
  assert.equal(describePotentialOnlineWrite("airlock-outbound_publish_draft", {}), null);

  const denied = await decidePreToolUse({
    event: { ...event, toolName: "bash", toolArgs: { command: "git push origin main" } },
    mission: allowed,
    check: async () => ({ status: "blocked", reason: "online-write-intent" }),
  });
  assert.equal(denied.permissionDecision, "deny");
  assert.match(denied.permissionDecisionReason, /online-write-intent/);
});

test("uninspectable shell requests fail closed", async () => {
  const result = await decidePreToolUse({
    event: { ...event, toolName: "powershell", toolArgs: {} },
    mission: allowed,
    check: async () => assert.fail("tool check must not run"),
  });
  assert.equal(result.permissionDecision, "deny");
  assert.match(result.permissionDecisionReason, /uninspectable-shell-command/);
});
