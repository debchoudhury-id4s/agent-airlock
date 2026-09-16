import { pathToFileURL } from "node:url";
import { createTrendingCostGate } from "../gates/trending-cost/index.mjs";
import {
  formatTrendingCost,
  formatTrendingCostBlock,
  readTrendingCost,
  trendingCostReportSchema,
} from "../gates/trending-cost/usage.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import policy from "../policies/trending-cost.json" with { type: "json" };

function emit(write, value) {
  write(`${JSON.stringify(value)}\n`);
}

export async function runTrendingCostHook({
  policyConfig = policy,
  readUsage = readTrendingCost,
  write = text => process.stdout.write(text),
  now,
} = {}) {
  const gate = createTrendingCostGate({ settings: policyConfig.settings });
  const evaluate = createPolicyEvaluator({ policy: policyConfig, gates: [gate] });
  const report = trendingCostReportSchema.parse(await readUsage({
    now,
    usdPerAiu: policyConfig.settings.usdPerAiu,
  }));
  const result = await evaluate({
    tool: "trending_cost",
    target: "local-copilot-session-store",
    input: { report },
  });
  emit(write, { type: "progress", message: formatTrendingCost(report) });
  const output = result.decision === "block"
    ? { decision: "block", reason: formatTrendingCostBlock(report, policyConfig.settings.monthToDateLimitUsd) }
    : {};
  emit(write, output);
  return { report, result, output };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    await runTrendingCostHook();
  } catch {
    emit(text => process.stdout.write(text), {
      type: "progress",
      message: "Trending cost (local CLI estimate) | unavailable: trending-cost-hook-failed",
    });
    const failClosed = policy.settings?.mode === "enforce"
      && policy.settings?.unavailableBehavior === "block";
    emit(text => process.stdout.write(text), failClosed
      ? { decision: "block", reason: "Trending-cost gate could not evaluate usage in enforce mode." }
      : {});
  }
}
