import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import policy from "../../policies/trending-cost.json" with { type: "json" };
import { trendingCostReportSchema } from "./usage.mjs";

export const trendingCostSettingsSchema = z.object({
  mode: z.enum(["advisory", "enforce"]),
  monthToDateLimitUsd: z.number().finite().nonnegative(),
  unavailableBehavior: z.enum(["allow", "block"]),
  usdPerAiu: z.number().finite().positive(),
}).strict();

function decision(decisionType, reason, findings = []) {
  return { decision: decisionType, reason, findings: findingsSchema.parse(findings) };
}

/** Evaluate an internal aggregate usage snapshot against the reviewed trending-cost policy. */
export function createTrendingCostGate({ settings = policy.settings } = {}) {
  let snapshot;
  try { snapshot = trendingCostSettingsSchema.parse(settings); }
  catch { throw new Error("Invalid Airlock trending-cost settings."); }
  return Object.freeze({
    id: "trending-cost",
    failureReason: "trending-cost-check-failed",
    async evaluate(action) {
      if (action.tool !== "trending_cost") throw new Error("Expected the trending-cost action.");
      const report = trendingCostReportSchema.parse(action.input.report);
      if (!report.available) {
        if (snapshot.mode === "enforce" && snapshot.unavailableBehavior === "block") {
          return decision("block", "trending-cost-unavailable", [{ ruleId: "usage-data-required", line: 1 }]);
        }
        return decision("allow", "trending-cost-unavailable");
      }
      if (Math.abs(report.usdPerAiu - snapshot.usdPerAiu) > Number.EPSILON) {
        throw new Error("Usage rate does not match the reviewed policy.");
      }
      const calculated = (report.monthToDate.nanoAiu / 1e9) * snapshot.usdPerAiu;
      if (Math.abs(calculated - report.monthToDate.costUsd) > 0.000001) {
        throw new Error("Usage cost does not match the aggregate.");
      }
      if (calculated >= snapshot.monthToDateLimitUsd) {
        if (snapshot.mode === "enforce") {
          return decision("block", "month-to-date-cost-limit", [{ ruleId: "month-to-date-cost-limit", line: 1 }]);
        }
        return decision("allow", "month-to-date-cost-limit-advisory");
      }
      return decision("allow", "trending-cost-reported");
    },
  });
}
