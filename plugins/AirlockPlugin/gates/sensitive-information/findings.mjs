import { isSupportedText } from "../../runtime/plain-text.mjs";

/** Fixed rule IDs only; deduplicate each rule per LF-based line, never retain matches. */
export function detectLines(content, rules) {
  if (!isSupportedText(content)) throw new Error("Unsupported sensitive-information text.");
  const findings = [];
  for (const [index, line] of content.split("\n").entries()) {
    const seen = new Set();
    for (const { ruleId, pattern, accept = () => true } of rules) {
      if (seen.has(ruleId)) continue;
      for (const match of line.matchAll(pattern)) {
        if (!accept(match[0])) continue;
        findings.push({ ruleId, line: index + 1 });
        seen.add(ruleId);
        if (findings.length > 4096) throw new Error("Too many sensitive-information findings.");
        break;
      }
    }
  }
  return findings;
}
