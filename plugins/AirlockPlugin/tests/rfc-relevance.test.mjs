import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  createRfcRelevanceGate,
  recommendationsFor,
  rfcSnapshot,
} from "../gates/rfc-relevance/index.mjs";
import { runRfcRelevanceHook } from "../hooks/rfc-relevance.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import { pluginRoot } from "../gates/secrets/scanner.mjs";
import policy from "../policies/rfc-relevance.json" with { type: "json" };

function evaluator(snapshot = rfcSnapshot) {
  return createPolicyEvaluator({
    policy,
    gates: [createRfcRelevanceGate({ snapshot })],
  });
}

test("bearer-token work reports the mapped RFCs without blocking", async () => {
  const result = await evaluator()({
    tool: "review_rfc_relevance",
    target: "submitted-prompt",
    input: { prompt: "Design bearer token authentication for this API." },
  });
  assert.equal(result.decision, "report");
  assert.equal(result.reason, "relevant-rfcs-found");
  assert.deepEqual(result.findings, [{ ruleId: "bearer-tokens", line: 1 }]);
  const [recommendation] = recommendationsFor(result.findings);
  assert.equal(recommendation.topic, "OAuth bearer tokens");
  assert.deepEqual(recommendation.rfcs.map(rfc => rfc.id), ["RFC6750", "RFC9700"]);
});

test("multiple topic matches retain prompt line numbers and deduplicate each topic", async () => {
  const result = await evaluator()({
    tool: "review_rfc_relevance",
    target: "submitted-prompt",
    input: { prompt: "Use PKCE with a code verifier and code challenge.\nThen validate JWT responses." },
  });
  assert.equal(result.decision, "report");
  assert.deepEqual(result.findings, [
    { ruleId: "jwt-validation", line: 2 },
    { ruleId: "pkce", line: 1 },
  ]);
});

test("unrelated work is allowed without findings", async () => {
  const result = await evaluator()({
    tool: "review_rfc_relevance",
    target: "submitted-prompt",
    input: { prompt: "Rename the local cache helper." },
  });
  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "no-rfc-topic-match");
  assert.deepEqual(result.findings, []);
});

test("invalid snapshots and prompt inputs fail safely", async () => {
  assert.throws(() => createRfcRelevanceGate({
    snapshot: { ...rfcSnapshot, topics: [{ ...rfcSnapshot.topics[0], rfcIds: ["RFC9999"] }] },
  }), /Invalid Airlock RFC relevance snapshot/);
  const result = await evaluator()({
    tool: "review_rfc_relevance",
    target: "submitted-prompt",
    input: { prompt: "\0bearer token" },
  });
  assert.equal(result.decision, "error");
  assert.equal(result.reason, "rfc-relevance-check-failed");
});

test("prompt hook suggests RFC Editor links only when a topic matches", async () => {
  for (const [prompt, expectedLines] of [
    ["Implement OAuth 2.0 with PKCE.", 2],
    ["Update a unit-test name.", 1],
  ]) {
    const chunks = [];
    const result = await runRfcRelevanceHook({ prompt, write: text => chunks.push(text) });
    const lines = chunks.join("").trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(lines.length, expectedLines);
    assert.deepEqual(lines.at(-1), {});
    if (result.decision === "report") {
      assert.match(lines[0].message, /RFC6749/);
      assert.match(lines[0].message, /RFC7636/);
      assert.match(lines[0].message, /https:\/\/www\.rfc-editor\.org/);
      assert.doesNotMatch(lines[0].message, /Implement OAuth/);
    }
  }
});

test("registered hook executable consumes the submitted prompt", async () => {
  const config = JSON.parse(await readFile(join(pluginRoot, "hooks", "hooks.json"), "utf8"));
  assert.match(config.hooks.userPromptSubmitted[1].powershell, /rfc-relevance\.mjs/);
  const child = spawnSync(process.execPath, [join(pluginRoot, "hooks", "rfc-relevance.mjs")], {
    encoding: "utf8",
    input: JSON.stringify({ prompt: "Review bearer tokens." }),
  });
  assert.equal(child.status, 0, child.stderr);
  const lines = child.stdout.trim().split(/\r?\n/).map(JSON.parse);
  assert.match(lines[0].message, /RFC6750/);
  assert.deepEqual(lines[1], {});
});
