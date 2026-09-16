import { z } from "zod";
import { removeMissionState } from "../runtime/session-state.mjs";
import { readHookInput } from "./input.mjs";

// Receipts are permanent audit records; only the transient per-session mission
// decision is removed when Copilot closes the session.
const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
}).passthrough();

try {
  const event = eventSchema.parse(await readHookInput());
  await removeMissionState(event.sessionId);
} catch {
  process.exitCode = 1;
}
