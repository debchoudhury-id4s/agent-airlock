import { z } from "zod";
import { createBroker, dataRoot } from "../runtime/broker.mjs";
import {
  formatTrendingCost,
  formatTrendingCostBlock,
  readTrendingCost,
  trendingCostReportSchema,
} from "../gates/trending-cost/usage.mjs";
import policy from "../policies/trending-cost.json" with { type: "json" };

export const trendingCostSchema = z.object({}).strict();

/** Read local aggregate usage, evaluate the reviewed policy, and return the same snapshot. */
export function createTrendingCost({
  root = dataRoot,
  evaluate,
  readUsage = readTrendingCost,
  settings = policy.settings,
} = {}) {
  const run = createBroker({ root, evaluate });
  const policySettings = {
    mode: settings.mode,
    monthToDateLimitUsd: settings.monthToDateLimitUsd,
    unavailableBehavior: settings.unavailableBehavior,
    usdPerAiu: settings.usdPerAiu,
  };
  return async function trendingCost(input) {
    const parsed = trendingCostSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "blocked", reason: "invalid-input", execution: "not-started", message: "This report accepts no arguments or overrides." };
    }
    let report;
    try {
      report = trendingCostReportSchema.parse(await readUsage({ usdPerAiu: settings.usdPerAiu }));
    } catch {
      return { status: "error", reason: "usage-read-failed", execution: "not-started", message: "Local Copilot usage could not be read." };
    }
    const result = await run({
      tool: "trending_cost",
      target: "local-copilot-session-store",
      input: { report },
    }, async () => ({ report }));
    if (result.status === "completed") {
      return {
        ...result,
        status: "reported",
        policySettings,
        report,
        message: formatTrendingCost(report),
      };
    }
    if (result.reason === "month-to-date-cost-limit" || result.reason === "trending-cost-unavailable") {
      return {
        ...result,
        policySettings,
        report,
        message: formatTrendingCostBlock(report, settings.monthToDateLimitUsd),
      };
    }
    return { ...result, policySettings, report };
  };
}
