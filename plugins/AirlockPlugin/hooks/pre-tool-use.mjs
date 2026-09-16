import { z } from "zod";
import { checkIntent } from "../runtime/airlock.mjs";
import { decidePreToolUse } from "../runtime/hook-enforcement.mjs";
import { loadMissionState } from "../runtime/session-state.mjs";
import { readHookInput } from "./input.mjs";

// This adapter translates a Copilot preToolUse event into the host's
// allow/ask/deny response format. Policy logic lives in hook-enforcement.mjs.
const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  timestamp: z.number().finite(),
  cwd: z.string(),
  toolName: z.string().min(1),
  toolArgs: z.unknown(),
}).passthrough();

try {
  const event = eventSchema.parse(await readHookInput());
  const decision = await decidePreToolUse({
    event,
    mission: await loadMissionState(event.sessionId),
    check: checkIntent,
  });
  process.stdout.write(`${JSON.stringify(decision)}\n`);
} catch {
  // Malformed input, unreadable state, and policy failures must never turn into
  // an implicit tool approval.
  process.stdout.write(`${JSON.stringify({
    permissionDecision: "deny",
    permissionDecisionReason: "Blocked by Airlock policy: tool-policy-failed",
  })}\n`);
  process.exitCode = 2;
}
