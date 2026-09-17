import { createHash } from "node:crypto";
import { z } from "zod";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const policySchema = z.object({
  id: identifier,
  version: identifier,
  settings: z.record(identifier, z.json()).optional(),
  tools: z.record(identifier, z.array(identifier).min(1).refine(ids => new Set(ids).size === ids.length)),
}).strict().refine(policy => Object.keys(policy.tools).length > 0);
const actionSchema = z.object({
  tool: identifier,
  target: z.string().min(1).max(1024),
  input: z.record(z.string(), z.json()),
}).strict();

/** Findings contain reviewed rule IDs and line numbers, never matched values. */
export const findingsSchema = z.array(z.object({
  ruleId: identifier,
  line: z.number().int().positive(),
}).strict()).max(4096);
const resultSchema = z.object({
  decision: z.enum(["allow", "report", "block", "ask-first"]),
  reason: identifier,
  findings: findingsSchema,
}).strict()
  .refine(result => result.decision !== "allow" || result.findings.length === 0)
  .refine(result => result.decision !== "report" || result.findings.length > 0);
const decisionType = z.enum(["allow", "report", "block", "ask-first", "error"]);

/** Broker boundary: incomplete or contradictory evaluations cannot authorize execution. */
export const evaluationSchema = z.object({
  policy: identifier,
  policyVersion: identifier,
  policySha256: z.string().regex(/^[a-f0-9]{64}$/),
  decision: decisionType,
  reason: identifier,
  findings: z.array(findingsSchema.element),
  checks: z.array(z.object({
    gate: identifier, decision: decisionType, reason: identifier, findings: findingsSchema,
  }).strict()),
}).strict().refine(result => {
  if (result.decision === "allow") {
    return result.findings.length === 0 && result.checks.length > 0
      && result.checks.every(check => check.decision === "allow" && check.findings.length === 0);
  }
  if (result.decision === "report") {
    return result.findings.length > 0 && result.checks.some(check => check.decision === "report")
      && result.checks.every(check => ["allow", "report"].includes(check.decision));
  }
  return true;
});

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Copy a validated JSON action so gates and executors cannot change each other's inputs. */
export function snapshotAction(action) {
  return freeze(actionSchema.parse(action));
}

/** Pin trusted policy bindings and gate functions; callers cannot select which checks run. */
export function createPolicyEvaluator({ policy, gates }) {
  const parsed = policySchema.safeParse(policy);
  if (!parsed.success) throw new Error("Invalid Airlock policy configuration.");
  const snapshot = freeze(parsed.data);
  const registry = new Map();
  for (const gate of gates) {
    if (!identifier.safeParse(gate.id).success || typeof gate.evaluate !== "function"
      || registry.has(gate.id) || (gate.failureReason !== undefined && !identifier.safeParse(gate.failureReason).success)) {
      throw new Error("Invalid or duplicate Airlock gate registration.");
    }
    registry.set(gate.id, { evaluate: gate.evaluate, failureReason: gate.failureReason ?? "gate-failed" });
  }
  for (const ids of Object.values(snapshot.tools)) {
    if (ids.some(id => !registry.has(id))) throw new Error("Airlock policy references an unregistered gate.");
  }
  const identity = {
    policy: snapshot.id,
    policyVersion: snapshot.version,
    policySha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
  };
  return async function evaluate(action) {
    let input;
    try { input = snapshotAction(action); }
    catch { return { ...identity, decision: "block", reason: "invalid-action", findings: [], checks: [] }; }
    const ids = Object.hasOwn(snapshot.tools, input.tool) ? snapshot.tools[input.tool] : undefined;
    if (!ids) return { ...identity, decision: "block", reason: "unknown-tool", findings: [], checks: [] };
    const checks = [];
    for (const id of ids) {
      const gate = registry.get(id);
      try {
        checks.push({ gate: id, ...resultSchema.parse(await gate.evaluate(input)) });
      } catch {
        checks.push({ gate: id, decision: "error", reason: gate.failureReason, findings: [] });
      }
    }
    const decisive = ["block", "error", "ask-first", "report"]
      .map(decision => checks.find(check => check.decision === decision))
      .find(Boolean);
    return {
      ...identity,
      decision: decisive?.decision ?? "allow",
      reason: decisive?.reason ?? (checks.length === 1 ? checks[0].reason : "all-gates-passed"),
      findings: checks.flatMap(check => check.findings),
      checks,
    };
  };
}
