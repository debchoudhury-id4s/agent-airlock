import { z } from "zod";
import { resolve } from "node:path";
import { findingsSchema } from "../../runtime/policies.mjs";
import defaultRules from "./rules.json" with { type: "json" };
import { resolvePrBase } from "./pr-base.mjs";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const rulesSchema = z.object({
  rules: z.array(z.object({
    id: identifier,
    pattern: z.string().min(1).max(256),
    flags: z.enum(["i", "m", "im", "mi"]).optional(),
    gitCommand: z.enum(["push", "push-intent"]).optional(),
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

function protectedGitTarget(args, base) {
  if (args.some(arg => /^(?:--dry-run|-n)$/.test(arg))) return false;
  const operands = [];
  const valueOptions = new Set(["--repo", "--receive-pack", "--exec", "-o", "--push-option"]);
  let repoOption = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      operands.push(...args.slice(index + 1));
      break;
    }
    if (/^(?:--all|--mirror)(?:=|$)/.test(arg)) return true;
    const [option] = arg.split("=", 1);
    if (valueOptions.has(option)) {
      if (!arg.includes("=")) index++;
      if (option === "--repo") repoOption = true;
      continue;
    }
    if (!arg.startsWith("-")) operands.push(arg);
  }
  const refspecs = repoOption ? operands : operands.slice(1);
  if (!refspecs.length) return true;
  return refspecs.some(refspec => {
    const destination = refspec.replace(/^\+/, "").split(":").at(-1);
    return !destination || destination === "HEAD" || destination === "@"
      || destination === base || destination === `refs/heads/${base}`
      || /[*$`{}]/.test(destination);
  });
}

function commandDirectory(match, cwd) {
  let directory = cwd;
  const prefix = match[0].slice(0, -4);
  const options = [...prefix.matchAll(/(-C|-c|--git-dir|--work-tree)(?:=|\s+)(?:"([^"]*)"|'([^']*)'|(\S+))/g)];
  for (const option of options) {
    if (option[1] !== "-C") throw new Error("Unsupported Git repository override.");
    directory = resolve(directory, option[2] ?? option[3] ?? option[4]);
  }
  return directory;
}

/** Read-only online-write intent check. Team rules are trusted plugin files, not MCP arguments. */
export function createNoOnlineWritesGate({ rules = defaultRules, resolveBase = resolvePrBase } = {}) {
  let compiled;
  try { compiled = compile(rules); }
  catch { throw new Error("Invalid Airlock online-write rules."); }
  return Object.freeze({
    id: "no-online-writes",
    failureReason: "intent-check-failed",
    async evaluate(action) {
      const prompt = action.input.prompt;
      if (typeof prompt !== "string") throw new Error("Expected a text prompt.");
      const phase = action.input.phase ?? "execution";
      if (phase !== "prompt" && phase !== "execution") throw new Error("Invalid intent phase.");
      const lines = prompt.split(/\r?\n/);
      const findings = [];
      const bases = new Map();
      let unavailable = false;
      let deferred = false;
      for (const rule of compiled) {
        for (const [index, text] of lines.entries()) {
          const matches = text.matchAll(new RegExp(rule.regex.source, `${rule.regex.flags}g`));
          for (const match of matches) {
            let blocked = !rule.gitCommand;
            if (rule.gitCommand) {
              // Prompt text can quote or defer a push; the actual shell request is the enforcement boundary.
              if (phase === "prompt") {
                deferred = true;
                continue;
              }
              const args = rule.gitCommand === "push" ? gitArguments(text, match) : [];
              if (args.some(arg => /^(?:--dry-run|-n)$/.test(arg))) continue;
              try {
                const cwd = rule.gitCommand === "push"
                  ? commandDirectory(match, action.input.cwd ?? process.cwd())
                  : action.input.cwd ?? process.cwd();
                if (!bases.has(cwd)) bases.set(cwd, resolveBase(cwd));
                const base = await bases.get(cwd);
                if (typeof base !== "string" || !base) throw new Error("Missing PR base.");
                blocked = rule.gitCommand === "push"
                  ? protectedGitTarget(args, base)
                  : (match[1]?.replace(/\.$/, "") === base);
              } catch {
                unavailable = true;
                blocked = true;
              }
            }
            if (blocked) {
              findings.push({ ruleId: rule.id, line: index + 1 });
              break;
            }
          }
        }
      }
      const parsed = findingsSchema.parse(findings);
      return {
        decision: parsed.length ? "block" : "allow",
        reason: unavailable ? "git-pr-base-unavailable" : parsed.length ? "online-write-intent"
          : deferred ? "git-push-check-deferred" : "no-online-write-match",
        findings: parsed,
      };
    },
  });
}
