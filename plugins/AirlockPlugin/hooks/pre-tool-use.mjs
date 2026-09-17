import { z } from "zod";
import { checkIntent } from "../runtime/airlock.mjs";
import { decidePreToolUse } from "../runtime/hook-enforcement.mjs";
import { loadMissionState } from "../runtime/session-state.mjs";
import { emit, readHookInput } from "./input.mjs";

const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  timestamp: z.number().finite(),
  cwd: z.string(),
  toolName: z.string().min(1),
  toolArgs: z.unknown(),
}).passthrough();

try {
  const event = eventSchema.parse(await readHookInput());
  emit(await decidePreToolUse({
    event,
    mission: await loadMissionState(event.sessionId),
    check: checkIntent,
  }));
} catch {
  emit({
    permissionDecision: "deny",
    permissionDecisionReason: "Blocked by Airlock policy: tool-policy-failed",
  });
  process.exitCode = 2;
}
