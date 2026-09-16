import { z } from "zod";
import { checkIntent } from "../runtime/airlock.mjs";
import { saveMissionState } from "../runtime/session-state.mjs";
import { progress, readHookInput } from "./input.mjs";

// Validate only the fields this hook consumes; passthrough keeps it compatible
// with additional fields introduced by newer Copilot hosts.
const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  timestamp: z.number().finite(),
  cwd: z.string(),
  prompt: z.string().max(65_536),
}).passthrough();

try {
  const event = eventSchema.parse(await readHookInput());
  // Replace any decision from the previous prompt before evaluating this one.
  // If evaluation crashes, preToolUse sees this error state and denies tools.
  await saveMissionState({
    sessionId: event.sessionId,
    decision: "error",
    reason: "preflight-in-progress",
    promptTimestamp: event.timestamp,
  });
  const result = await checkIntent({ prompt: event.prompt });
  const decision = result.status === "cleared"
    ? "allow"
    : result.decision === "ask-first" ? "ask-first"
      : result.status === "error" ? "error" : "block";
  await saveMissionState({
    sessionId: event.sessionId,
    decision,
    reason: result.reason,
    promptTimestamp: event.timestamp,
    policy: result.policy,
    policyVersion: result.policyVersion,
    policySha256: result.policySha256,
  });
  progress(decision === "allow"
    ? "Airlock cleared the mission"
    : `Airlock ${decision === "ask-first" ? "requires approval" : "blocked the mission"}: ${result.reason}`);
} catch {
  // userPromptSubmitted cannot cancel the model turn. The persisted error state
  // and preToolUse hook provide the fail-closed tool-execution boundary.
  progress("Airlock preflight failed; tool use will be denied");
  process.exitCode = 1;
}
