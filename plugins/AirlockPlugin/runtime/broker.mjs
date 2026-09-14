import { createHash, randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { evaluationSchema, snapshotAction } from "./policies.mjs";

export const dataRoot = join(homedir(), ".agent-airlock", "outbound-demo");

/** Persist one local artifact or receipt before reporting completion. */
export async function write(path, content, flags) {
  const file = await open(path, flags, 0o600);
  try {
    await file.writeFile(content, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
}

/** Evaluate every required gate and save its decision before calling a host-owned executor. */
export function createBroker({ root = dataRoot, evaluate }) {
  if (typeof evaluate !== "function") throw new Error("Airlock requires a policy evaluator.");
  const receipts = join(resolve(root), "receipts");

  return async function run(action, execute) {
    const id = randomUUID();
    let snapshot;
    try { snapshot = snapshotAction(action); }
    catch {
      return { id, status: "blocked", reason: "invalid-action", execution: "not-started", message: "The tool must supply a validated action." };
    }
    const encoded = JSON.stringify(snapshot);
    let decision;
    try {
      decision = evaluationSchema.parse(await evaluate(snapshot));
    } catch {
      decision = { decision: "error", reason: "policy-evaluation-failed", findings: [], checks: [] };
    }
    const identity = {
      id, policy: decision.policy, policyVersion: decision.policyVersion, policySha256: decision.policySha256,
      sha256: createHash("sha256").update(encoded).digest("hex"), bytes: Buffer.byteLength(encoded),
    };
    const denied = decision.decision !== "allow";
    const result = {
      ...identity,
      ...decision,
      status: decision.decision === "error" ? "error" : denied ? "blocked" : "completed",
      reason: decision.decision === "ask-first" ? "approval-required" : decision.reason,
      message: decision.decision === "error"
        ? "A required check failed. No action was executed."
        : decision.decision === "ask-first"
          ? "Approval is required, but the shared approval flow is not implemented. No action was executed."
          : denied ? "A required rule blocked the action. Instructions and approvals cannot override a block."
            : "All required gates allowed the action.",
    };
    const receiptPath = join(receipts, `${id}.jsonl`);
    const receipt = (event, details = {}) => JSON.stringify({
      ...identity, timestamp: new Date().toISOString(), event, decision: decision.decision,
      reason: result.reason, findings: decision.findings, checks: decision.checks, ...details,
    }) + "\n";
    try {
      await mkdir(receipts, { recursive: true, mode: 0o700 });
      await write(receiptPath, receipt(denied ? result.status : "allowed"), "wx");
    } catch {
      return { ...identity, status: "error", reason: "receipt-failed", execution: "not-started", message: "Cannot save the decision receipt; no action was executed." };
    }
    if (denied) return { ...result, receiptPath, execution: "not-started" };

    let execution = "not-started";
    try {
      execution = "unknown";
      const output = await execute(snapshot, id);
      execution = "completed";
      await write(receiptPath, receipt("completed", { execution }), "a");
      return { ...output, ...result, receiptPath, execution };
    } catch {
      try { await write(receiptPath, receipt("error", { execution }), "a"); }
      catch {
        return { ...identity, status: "error", reason: "execution-and-receipt-failed", receiptPath, execution, message: "Execution or its receipt failed. Inspect the target before retrying." };
      }
      return { ...identity, status: "error", reason: "execution-failed", receiptPath, execution, message: "Execution or its receipt failed. Inspect the target before retrying." };
    }
  };
}
