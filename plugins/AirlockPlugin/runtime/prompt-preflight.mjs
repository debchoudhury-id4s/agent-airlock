function intentDecision(result) {
  if (result?.status === "cleared") return "allow";
  if (result?.decision === "ask-first") return "ask-first";
  if (result?.status === "error" || result?.decision === "error") return "error";
  return "block";
}

function normalizedCheck(source, result, decision = result?.decision) {
  return {
    source,
    decision,
    reason: result?.reason ?? `${source}-failed`,
    policy: result?.policy,
    policyVersion: result?.policyVersion,
    policySha256: result?.policySha256,
  };
}

/** Combine prompt-level policies so preToolUse enforces the most restrictive result. */
export function combinePromptPreflight(costResult, intentResult) {
  const checks = [
    normalizedCheck("trending-cost", costResult?.result),
    normalizedCheck("intent", intentResult, intentDecision(intentResult)),
  ];
  const decisive = ["block", "error", "ask-first"]
    .map(decision => checks.find(check => check.decision === decision))
    .find(Boolean);
  return decisive ?? {
    source: "prompt-preflight",
    decision: "allow",
    reason: "all-prompt-checks-passed",
  };
}
