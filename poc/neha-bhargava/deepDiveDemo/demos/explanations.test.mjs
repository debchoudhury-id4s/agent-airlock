import assert from "node:assert/strict";
import test from "node:test";
import { explainCase, formatExplanation } from "./explanations.mjs";
import { scenarios } from "./helpers.mjs";

test("every scripted case has a safe audience explanation", () => {
  for (const [gate, cases] of Object.entries(scenarios)) {
    for (const name of cases) {
      const calls = [{
        observed: name === "schema-override"
          ? { boundary: "MCP-input-validation", isError: true }
          : {
              status: "blocked", reason: "safe-reason", execution: "not-started",
              checks: [{ gate: "safe-gate", decision: "block", reason: "safe-reason",
                findings: [{ ruleId: "SAFE-RULE", line: 2 }] }],
            },
        verification: { businessArtifactsCreated: 0, receiptChecked: name !== "schema-override" },
      }];
      const explanation = explainCase(gate, name, calls, "runs/safe/result.json");
      const output = formatExplanation(explanation);
      for (const heading of ["VERIFIED", "REQUEST", "GATE CHECKS", "WHY THIS RESULT", "GATE OUTCOME",
        "SIDE EFFECT", "NEXT STEP", "BOUNDARY", "EVIDENCE"]) {
        assert.match(output, new RegExp(heading));
      }
      assert.doesNotMatch(output, /abcdefghijklmnopqrstuvwx|raw fixture|actual token/i);
    }
  }
});
