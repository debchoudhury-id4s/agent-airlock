import { detectLines } from "./findings.mjs";

/** The literal label classifies the entire supplied field, not just the marker. */
export function detectInternalLabel(content) {
  return detectLines(content, [{
    ruleId: "internal-only-label",
    pattern: /(?<![A-Za-z0-9_])INTERNAL-ONLY(?![A-Za-z0-9_])/gi,
  }]);
}
