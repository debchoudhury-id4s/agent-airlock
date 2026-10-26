import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import defaultRules from "./rules.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const rulesSchema = z.object({
  rules: z.array(z.object({
    id: identifier,
    pattern: z.string().min(1).max(256),
    flags: z.enum(["i", "m", "im", "mi"]).optional(),
    gitCommand: z.enum(["push", "rebase"]).optional(),
  }).strict()).min(1).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length),
}).strict();

function compile(rules) {
  const parsed = rulesSchema.parse(rules);
  return parsed.rules.map(rule => {
    const regex = new RegExp(rule.pattern, rule.flags ?? "");
    return { id: rule.id, regex, gitCommand: rule.gitCommand };
  });
}

function gitArguments(text, match) {
  const tail = text.slice(match.index + match[0].length).split(/[;&|\r\n]/, 1)[0];
  return [...tail.matchAll(/"([^"]*)"|'([^']*)'|([^\s"'`]+)/g)]
    .map(token => (token[1] ?? token[2] ?? token[3]).replace(/[.,]$/, ""));
}

function protectedGitTarget(command, args) {
  if (command === "push" && args.some(arg => /^(?:--dry-run|-n)$/.test(arg))) return false;
  if (command === "rebase" && args.some(arg => /^(?:--abort|--continue|--skip|--quit)$/.test(arg))) return false;
  const operands = [];
  const valueOptions = command === "push"
    ? new Set(["--repo", "--receive-pack", "--exec", "-o", "--push-option"])
    : new Set(["--onto", "--exec", "-x", "--strategy", "-s", "--strategy-option", "-X",
      "--empty", "--whitespace"]);
  let repoOption = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      operands.push(...args.slice(index + 1));
      break;
    }
    if (command === "push" && /^(?:--all|--mirror)(?:=|$)/.test(arg)) return true;
    const [option] = arg.split("=", 1);
    if (valueOptions.has(option)) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++index];
      if (option === "--repo") repoOption = true;
      if (option === "--onto") return isOriginMaster(value);
      continue;
    }
    if (!arg.startsWith("-")) operands.push(arg);
  }
  if (command === "rebase") return isOriginMaster(operands[0]);
  const refspecs = repoOption ? operands : operands.slice(1);
  if (!refspecs.length) return true;
  return refspecs.some(refspec => {
    const destination = refspec.replace(/^\+/, "").split(":").at(-1);
    return destination === "master" || destination === "refs/heads/master"
      || /[*$`{}]/.test(destination);
  });
}

function isOriginMaster(ref) {
  return ref === "origin/master" || ref === "refs/remotes/origin/master";
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
          const matches = text.matchAll(new RegExp(rule.regex.source, `${rule.regex.flags}g`));
          for (const match of matches) {
            if (!rule.gitCommand || protectedGitTarget(rule.gitCommand, gitArguments(text, match))) {
              findings.push({ ruleId: rule.id, line: index + 1 });
              break;
            }
          }
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
