import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createBroker } from "../runtime/broker.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "airlock-broker-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const action = { tool: "sample_write", target: "local-fixture", input: { content: "synthetic payload" } };
function evaluator(decisions) {
  const gates = decisions.map((decision, i) => ({
    id: `gate-${i}`,
    async evaluate() { return { decision, reason: `gate-${i}-result`, findings: [] }; },
  }));
  return createPolicyEvaluator({
    policy: { id: "broker-test", version: "1", tools: { sample_write: gates.map(gate => gate.id) } }, gates,
  });
}

test("only all-allow runs once, after its redacted decision receipt exists", async t => {
  const root = await scratch(t);
  const run = createBroker({ root, evaluate: evaluator(["allow", "allow"]) });
  let executions = 0;
  const result = await run(action, async (snapshot, id) => {
    executions++;
    assert.deepEqual(snapshot, action);
    assert.equal(Object.isFrozen(snapshot.input), true);
    const text = await readFile(join(root, "receipts", `${id}.jsonl`), "utf8");
    assert.equal(JSON.parse(text).event, "allowed");
    assert.doesNotMatch(text, /synthetic payload/);
    return { artifactPath: "local-fixture" };
  });
  assert.equal(executions, 1);
  assert.equal(result.status, "completed");
  const lines = (await readFile(result.receiptPath, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines.map(line => line.event), ["allowed", "completed"]);
  assert.equal(lines[1].execution, "completed");
});

test("block and ask-first create receipts with zero executions", async t => {
  const root = await scratch(t);
  for (const decisions of [["allow", "block"], ["allow", "ask-first"], ["ask-first", "block"]]) {
    const run = createBroker({ root, evaluate: evaluator(decisions) });
    const result = await run(action, async () => assert.fail("must not execute"));
    assert.equal(result.status, "blocked");
    assert.equal(result.execution, "not-started");
    const receipt = JSON.parse(await readFile(result.receiptPath, "utf8"));
    assert.equal(receipt.checks.length, decisions.length);
    if (!decisions.includes("block")) assert.equal(result.reason, "approval-required");
  }
});

test("unknown actions, malformed evaluations, and errors never execute", async t => {
  const root = await scratch(t);
  for (const evaluate of [
    evaluator(["allow"]),
    async () => ({ decision: "allow" }),
    async () => { throw new Error("NEVER_LOG_PAYLOAD"); },
    async () => ({ ...(await evaluator(["block"])(action)), decision: "allow" }),
  ]) {
    const result = await createBroker({ root, evaluate })({ ...action, tool: "unknown" }, async () => assert.fail("must not execute"));
    assert.notEqual(result.status, "completed");
    assert.equal(result.execution, "not-started");
    assert.doesNotMatch(await readFile(result.receiptPath, "utf8"), /NEVER_LOG_PAYLOAD/);
  }
});

test("the executor receives the snapshot evaluated before an await", async t => {
  const root = await scratch(t);
  const input = structuredClone(action);
  const evaluate = evaluator(["allow"]);
  const run = createBroker({ root, evaluate: async snapshot => {
    input.input.content = "changed";
    input.target = "elsewhere";
    return evaluate(snapshot);
  } });
  await run(input, async snapshot => { assert.deepEqual(snapshot, action); return {}; });
});

test("executor failure never claims completion or automatically retries", async t => {
  const root = await scratch(t);
  let executions = 0;
  const result = await createBroker({ root, evaluate: evaluator(["allow"]) })(action, async () => {
    executions++;
    throw new Error("NEVER_LOG_PAYLOAD");
  });
  assert.equal(executions, 1);
  assert.equal(result.status, "error");
  assert.equal(result.execution, "unknown");
  assert.equal((await readdir(join(root, "receipts"))).length, 1);
  assert.doesNotMatch(await readFile(result.receiptPath, "utf8"), /NEVER_LOG_PAYLOAD/);
});
