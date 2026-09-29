import { z } from "zod";
import { formatTodayUsage, readTrendingCost } from "../gates/trending-cost/usage.mjs";
import { checkIntent } from "../runtime/airlock.mjs";
import { combinePromptPreflight } from "../runtime/prompt-preflight.mjs";
import { saveMissionState } from "../runtime/session-state.mjs";
import { progress, readHookInput } from "./input.mjs";
import trendingCostPolicy from "../policies/trending-cost.json" with { type: "json" };

const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  timestamp: z.number().finite(),
  cwd: z.string(),
  prompt: z.string().max(65_536),
}).passthrough();

try {
  const event = eventSchema.parse(await readHookInput());
  // Replace the previous prompt's decision before either current check begins.
  await saveMissionState({
    sessionId: event.sessionId,
    decision: "error",
    reason: "preflight-in-progress",
    promptTimestamp: event.timestamp,
  });

  try {
    progress(formatTodayUsage(readTrendingCost({
      usdPerAiu: trendingCostPolicy.settings.usdPerAiu,
    })));
  } catch {
    progress("Today's usage (local CLI estimate) | unavailable: trending-cost-hook-failed");
  }

  const costResult = {
    result: {
      decision: "allow",
      reason: "automatic-today-usage-advisory",
    },
    output: {},
  };

  const intentResult = await checkIntent({ prompt: event.prompt });
  const decision = combinePromptPreflight(costResult, intentResult);
  await saveMissionState({
    sessionId: event.sessionId,
    decision: decision.decision,
    reason: decision.reason,
    promptTimestamp: event.timestamp,
    ...(decision.policy && { policy: decision.policy }),
    ...(decision.policyVersion && { policyVersion: decision.policyVersion }),
    ...(decision.policySha256 && { policySha256: decision.policySha256 }),
  });

  progress(decision.decision === "allow"
    ? "Airlock cleared the mission"
    : `Airlock ${decision.decision === "ask-first" ? "requires approval" : "blocked the mission"}: ${decision.reason}`);
} catch {
  progress("Airlock preflight failed; tool use will be denied");
  process.exitCode = 1;
}
