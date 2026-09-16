import { createSensitiveInformationGates } from "../gates/sensitive-information/index.mjs";
import { createPolicyEvaluator } from "./policies.mjs";
import { isSupportedText } from "./plain-text.mjs";

const replacement = "[Sensitive information removed.]";
const failure = () => ({
  status: "error",
  message: "Sensitive-information sanitization failed. No reusable text was cleared.",
});

/**
 * Explicit sanitizer for one Airlock-owned free-text record/display field.
 * Start-line-only findings cannot safely delimit a multiline secret: remove the whole field.
 * A candidate is never execution permission. No record is written by this helper.
 */
export function createRecordTextSanitizer(options = {}) {
  const gates = createSensitiveInformationGates(options);
  const evaluate = createPolicyEvaluator({
    policy: { id: "sensitive-record-text", version: "1", tools: { record_text: gates.map(gate => gate.id) } },
    gates,
  });
  const inspect = content => evaluate({ tool: "record_text", target: "local-record-display", input: { content } });
  return async function sanitizeText(content) {
    try {
      if (!isSupportedText(content)) return failure();
      const original = await inspect(content);
      // Block takes precedence over error in policy aggregation; do not hide an errored check.
      if (original.checks.some(check => check.decision === "error")) return failure();
      if (original.findings.some(finding => finding.ruleId === "internal-only-label")) return {
        status: "withheld",
        message: "The entire labelled field is withheld. Removing its label does not declassify its body.",
      };
      const removed = original.findings.length > 0;
      const candidate = removed ? replacement : content;
      const rescanned = await inspect(candidate);
      if (rescanned.decision !== "allow") return failure();
      return {
        status: removed ? "removed" : "unchanged",
        candidate: { content: candidate },
        message: removed
          ? "The entire field was removed and the replacement rescanned. Submit any new draft separately for all policy checks."
          : "No configured detector matched on rescan. This is not authorization to execute.",
      };
    } catch {
      return failure();
    }
  };
}
