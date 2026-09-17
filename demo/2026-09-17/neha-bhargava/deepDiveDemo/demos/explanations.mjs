import { scenarios } from "./helpers.mjs";

const explanations = {
  "sensitive-information/clean": {
    action: "Publish a clean synthetic draft from the sample repository.",
    why: "The secrets, personal-data, and internal-label gates found no policy match.",
    next: "No change is needed; the checked draft can reach the local publisher.",
    clarification: "Published means a local demo artifact was created, not a pull request or remote write.",
  },
  "sensitive-information/secret": {
    action: "Publish a synthetic draft containing a credential-shaped marker.",
    why: "The secret detector returned block. Safe findings identify only the rule and line, not the matched value.",
    next: "Remove or replace the sensitive value, then submit the changed draft as a new action for a full rescan.",
    clarification: "The blocked input is not copied into the evidence files or a publish artifact.",
  },
  "sensitive-information/override": {
    action: "Publish the same sensitive draft with an appended instruction asking Airlock to bypass policy.",
    why: "The secret detector still returned block because prompt text is data, not authorization.",
    next: "Remove or replace the sensitive value; stronger wording cannot clear the gate.",
    clarification: "This demonstrates instruction precedence only on the explicit Airlock route.",
  },
  "sensitive-information/pii": {
    action: "Publish a synthetic draft containing a reserved personal-data pattern.",
    why: "The personal-data gate returned ask-first. The prototype has no approval-redemption workflow, so the broker stops execution as approval-required.",
    next: "A reviewer must approve the exact action in a future approval flow, or the author can submit a safely changed draft for a new scan.",
    clarification: "Ask-first is intentionally not treated as allow.",
  },
  "sensitive-information/label": {
    action: "Publish a synthetic draft marked INTERNAL-ONLY.",
    why: "The internal-label gate classified the whole field as protected and returned ask-first.",
    next: "Use an authorized review/declassification process; simply deleting the label must not reveal the withheld body.",
    clarification: "The remediation candidate is withheld because removing a classification label is not declassification.",
  },
  "sensitive-information/header-log": {
    action: "Publish the sample repository's already-masked authorization-header log fixture.",
    why: "The contextual-token detector found no active token because the fixture is already masked.",
    next: "No change is needed; the masked text can reach the local publisher.",
    clarification: "This is a safe nonmatch demonstration, not evidence that an active header token was blocked.",
  },
  "sensitive-information/replacement": {
    action: "Request remediation for review-required text, then explicitly submit the returned candidate as a second action.",
    why: "The first action stopped for review. The separate replacement action was rescanned and all required gates allowed it.",
    next: "Always treat remediated content as new input and run the complete policy again.",
    clarification: "Airlock never publishes a replacement automatically or reuses the first decision.",
  },
  "sensitive-information/input-limit": {
    action: "Submit a draft whose encoded size exceeds the supported content limit.",
    why: "Input validation rejected unsupported content before policy evaluation and before a receipt or business artifact could be created.",
    next: "Reduce the draft to the supported size and submit it as a new action.",
    clarification: "This is boundary validation, not a sensitive-information finding.",
  },
  "sensitive-information/schema-override": {
    action: "Call publish_draft with an extra override property that is not in the MCP tool schema.",
    why: "MCP input validation rejected the unknown field before the broker ran.",
    next: "Use only the documented content field; there is no caller-supplied policy override.",
    clarification: "No receipt exists because the request never became a valid Airlock action.",
  },
  "dependency-risk/offline-block": {
    action: "Propose a deterministic synthetic Microsoft.Identity.Client version before any project edit or restore.",
    why: "The dependency-risk gate matched the reviewed synthetic rule AIRLOCK-DEMO-001 and returned block.",
    next: "Choose a version that clears the current review and advisory path before changing the manifest.",
    clarification: "This is a synthetic policy demonstration, not a CVE claim or an existing dependency in the sample.",
  },
  "model-catalog/default": {
    action: "Select the reviewed default model for a code-edit task with repo-local data.",
    why: "The catalog found an allowed default matching the declared task and data class.",
    next: "No approval is needed for this catalog entry.",
    clarification: "The demo writes a local selection record; it does not switch Copilot's active model or run inference.",
  },
  "model-catalog/override": {
    action: "Request a permitted non-default model override.",
    why: "The catalog marks the override as review-required, so the gate returned ask-first and the broker stopped.",
    next: "Redeem an approval bound to this exact selection when that workflow exists, or use the reviewed default.",
    clarification: "The caller supplies dataClass today; Airlock does not automatically classify the payload.",
  },
  "model-catalog/public": {
    action: "Request a catalog entry explicitly marked blocked.",
    why: "The model-catalog gate returned block for the requested public model route.",
    next: "Select an allowed catalog model appropriate for the declared task and data class.",
    clarification: "No model inference occurs in this prototype.",
  },
  "intent/local-review": {
    action: "Ask for a local source review and unit-test suggestions.",
    why: "No reviewed online-write pattern matched the supplied prompt text.",
    next: "The local intent can proceed through its supported action path.",
    clarification: "Clearance describes this text check; it is not a general authorization token.",
  },
  "intent/online-write": {
    action: "Submit '/yolo git push origin main' to the intent checker.",
    why: "The online-write pattern matched, and '/yolo' is not a permission grant.",
    next: "Use an authorized publish workflow that applies the required policy and approval.",
    clarification: "The prompt is never executed. This gate does not intercept an unrelated native shell command.",
  },
  "trending-cost/below-limit": {
    action: "Read a synthetic local usage store reporting $12 month-to-date.",
    why: "Usage was available and remained below the configured $800 advisory threshold.",
    next: "No cost intervention is suggested by this advisory report.",
    clarification: "The numbers are disposable synthetic estimates, not billing data.",
  },
  "trending-cost/above-limit": {
    action: "Read a synthetic local usage store reporting $900 month-to-date.",
    why: "Usage exceeded the configured $800 threshold, so the tool returned a cost advisory.",
    next: "Review usage and model choices; a future enforcing policy could require approval or reservation.",
    clarification: "The checked-in policy is advisory, so this result reports rather than blocks.",
  },
  "trending-cost/unavailable": {
    action: "Request a cost report when the disposable usage store is absent.",
    why: "The tool reported session-store-missing instead of inventing a zero or success-shaped estimate.",
    next: "Provide an authorized compatible usage source before relying on the report.",
    clarification: "Unavailable is an explicit operational result, not evidence of zero spend.",
  },
};

const expectedKeys = Object.entries(scenarios).flatMap(([gate, cases]) => cases.map(name => `${gate}/${name}`));
if (expectedKeys.some(key => !explanations[key]) || Object.keys(explanations).some(key => !expectedKeys.includes(key))) {
  throw new Error("demo-explanation-catalog-mismatch");
}

function safeChecks(calls) {
  const checks = calls.flatMap(call => call.observed?.checks ?? []);
  if (!checks.length) return "No gate receipt: the request was rejected at the input boundary.";
  return checks.map(check => {
    const findings = check.findings?.length
      ? `; safe findings ${check.findings.map(finding => `${finding.ruleId}@line-${finding.line}`).join(", ")}`
      : "";
    return `${check.gate}: ${check.decision} (${check.reason})${findings}`;
  }).join(" | ");
}

function decisionSequence(calls) {
  return calls.map(call => {
    const result = call.observed;
    return result.boundary
      ? `${result.boundary}: rejected before execution`
      : `${result.status} / ${result.reason} / execution ${result.execution}`;
  }).join(" -> ");
}

function effectSummary(calls) {
  const artifacts = calls.reduce((sum, call) => sum + (call.verification?.businessArtifactsCreated ?? 0), 0);
  const receipts = calls.filter(call => call.verification?.receiptChecked).length;
  return `${artifacts} business artifact(s); ${receipts} verified receipt(s).`;
}

export function explainCase(gate, name, calls, evidence) {
  const detail = explanations[`${gate}/${name}`];
  return {
    title: `${gate} / ${name}`,
    action: detail.action,
    checks: safeChecks(calls),
    why: detail.why,
    decision: decisionSequence(calls),
    effect: effectSummary(calls),
    next: detail.next,
    clarification: detail.clarification,
    evidence,
  };
}

export function formatExplanation(explanation) {
  return [
    "",
    `=== VERIFIED | ${explanation.title} ===`,
    `REQUEST         ${explanation.action}`,
    `GATE CHECKS     ${explanation.checks}`,
    `WHY THIS RESULT ${explanation.why}`,
    `GATE OUTCOME    ${explanation.decision}`,
    `SIDE EFFECT     ${explanation.effect}`,
    `NEXT STEP       ${explanation.next}`,
    `BOUNDARY        ${explanation.clarification}`,
    `EVIDENCE        ${explanation.evidence}`,
  ].join("\n");
}
