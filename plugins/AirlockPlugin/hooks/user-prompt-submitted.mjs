import { z } from "zod";
import { checkIntent } from "../runtime/airlock.mjs";
import { combinePromptPreflight } from "../runtime/prompt-preflight.mjs";
import { saveMissionState } from "../runtime/session-state.mjs";
import { runTrendingCostHook } from "./trending-cost.mjs";
import { emit, progress, readHookInput } from "./input.mjs";
import trendingCostPolicy from "../policies/trending-cost.json" with { type: "json" };

const eventSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  timestamp: z.number().finite(),
  cwd: z.string(),
  prompt: z.string().max(65_536),
}).passthrough();

function fallbackCostResult() {
  const block = trendingCostPolicy.settings?.mode === "enforce"
    && trendingCostPolicy.settings?.unavailableBehavior === "block";
  return {
    result: {
      decision: block ? "block" : "allow",
      reason: "trending-cost-hook-failed",
      policy: trendingCostPolicy.id,
      policyVersion: trendingCostPolicy.version,
    },
    output: block
      ? { decision: "block", reason: "Trending-cost gate could not evaluate usage in enforce mode." }
      : {},
  };
}

try {
  const event = eventSchema.parse(await readHookInput());
  // Replace the previous prompt's decision before either current check begins.
  await saveMissionState({
    sessionId: event.sessionId,
    decision: "error",
    reason: "preflight-in-progress",
    promptTimestamp: event.timestamp,
  });

  let costResult;
  try {
    costResult = await runTrendingCostHook({ emitDecision: false });
  } catch {
    progress("Trending cost (local CLI estimate) | unavailable: trending-cost-hook-failed");
    costResult = fallbackCostResult();
  }

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
  if (costResult.output?.decision === "block") emit(costResult.output);
} catch {
  progress("Airlock preflight failed; tool use will be denied");
  process.exitCode = 1;
}
