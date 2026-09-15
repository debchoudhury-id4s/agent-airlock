import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import defaultRules from "./rules.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const rulesSchema = z.object({
  rules: z.array(z.object({
    id: identifier,
    pattern: z.string().min(1).max(256),
    flags: z.enum(["i", "m", "im", "mi"]).optional(),
  }).strict()).min(1).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length),
}).strict();

function compile(rules) {
  const parsed = rulesSchema.parse(rules);
  return parsed.rules.map(rule => {
    const regex = new RegExp(rule.pattern, rule.flags ?? "");
    return { id: rule.id, regex };
  });
}

/** Read-only online-write intent check. Team rules are trusted plugin files, not MCP arguments. */
export function createNoOnlineWritesGate({ rules = defaultRules } = {}) {
  let compiled;
  try { compiled = compile(rules); }
  catch { throw new Error("Invalid Airlock online-write rules."); }
  return Object.freeze({
    id: "no-online-writes",
    failureReason: "intent-check-failed",
    async evaluate(action) {
      const prompt = action.input.prompt;
      if (typeof prompt !== "string") throw new Error("Expected a text prompt.");
      const lines = prompt.split(/\r?\n/);
      const findings = [];
      for (const rule of compiled) {
        lines.forEach((text, index) => {
          if (rule.regex.test(text)) findings.push({ ruleId: rule.id, line: index + 1 });
        });
      }
      const parsed = findingsSchema.parse(findings);
      return {
        decision: parsed.length ? "block" : "allow",
        reason: parsed.length ? "online-write-intent" : "no-online-write-match",
        findings: parsed,
      };
    },
  });
}
