import assert from "node:assert/strict";
import { test } from "node:test";
import { createPolicyEvaluator } from "../runtime/policies.mjs";

const action = { tool: "publish_draft", target: "local-review-outbox", input: { content: "hello" } };
const policy = gates => ({ id: "test-policy", version: "1", tools: { publish_draft: gates } });
const gate = (id, decision) => ({
  id,
  async evaluate() { return { decision, reason: `${id}-result`, findings: [] }; },
});

test("every configured gate must allow; record each decision", async () => {
  const evaluate = createPolicyEvaluator({ policy: policy(["first", "second"]), gates: [gate("first", "allow"), gate("second", "allow")] });
  const result = await evaluate(action);
  assert.equal(result.decision, "allow");
  assert.deepEqual(result.checks.map(check => check.gate), ["first", "second"]);
  assert.equal(result.policyVersion, "1");
  assert.match(result.policySha256, /^[a-f0-9]{64}$/);
});

test("block wins over ask-first, allow, and gate failures regardless of order", async () => {
  for (const ids of [["ask", "broken", "deny", "pass"], ["pass", "deny", "broken", "ask"]]) {
    const evaluate = createPolicyEvaluator({
      policy: policy(ids),
      gates: [gate("ask", "ask-first"), gate("deny", "block"), gate("pass", "allow"), {
        id: "broken", async evaluate() { throw new Error("DO_NOT_RECORD_THIS"); },
      }],
    });
    const result = await evaluate(action);
    assert.equal(result.decision, "block");
    assert.equal(result.reason, "deny-result");
    assert.equal(result.checks.length, 4);
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_RECORD_THIS/);
  }
});

test("exceptions, malformed results, and inconsistent allows fail closed", async () => {
  for (const evaluateGate of [
    async () => undefined,
    async () => ({ decision: "allow", reason: "ok", findings: [], approved: true }),
    async () => ({ decision: "allow", reason: "ok", findings: [{ ruleId: "match", line: 1 }] }),
    async () => { throw new Error("raw draft"); },
  ]) {
    const evaluate = createPolicyEvaluator({ policy: policy(["check"]), gates: [{ id: "check", evaluate: evaluateGate }] });
    const result = await evaluate(action);
    assert.equal(result.decision, "error");
    assert.equal(result.reason, "gate-failed");
    assert.doesNotMatch(JSON.stringify(result), /raw draft/);
  }
});

test("unknown tools and invalid actions never run gates", async () => {
  const evaluate = createPolicyEvaluator({
    policy: policy(["check"]), gates: [{ id: "check", evaluate: async () => assert.fail("must not run") }],
  });
  assert.equal((await evaluate({ ...action, tool: "unknown" })).reason, "unknown-tool");
  assert.equal((await evaluate({ ...action, approved: true })).reason, "invalid-action");
});

test("invalid configuration is rejected at startup", () => {
  for (const config of [
    policy([]), policy(["missing"]), policy(["check", "check"]),
    { ...policy(["check"]), version: "" }, { ...policy(["check"]), override: true },
    { ...policy(["check"]), tools: {} },
  ]) {
    assert.throws(() => createPolicyEvaluator({ policy: config, gates: [gate("check", "allow")] }));
  }
  assert.throws(() => createPolicyEvaluator({ policy: policy(["check"]), gates: [gate("check", "allow"), gate("check", "block")] }));
});

test("policy bindings and gate functions are snapshotted; action inputs are immutable", async () => {
  const config = policy(["check"]);
  const check = { id: "check", async evaluate(snapshot) {
    assert.equal(Object.isFrozen(snapshot.input), true);
    assert.throws(() => { snapshot.input.content = "changed"; });
    return { decision: "block", reason: "original-rule", findings: [] };
  } };
  const evaluate = createPolicyEvaluator({ policy: config, gates: [check] });
  config.tools.publish_draft.length = 0;
  config.version = "changed";
  check.evaluate = async () => ({ decision: "allow", reason: "changed", findings: [] });
  const result = await evaluate(action);
  assert.equal(result.decision, "block");
  assert.equal(result.policyVersion, "1");
});
