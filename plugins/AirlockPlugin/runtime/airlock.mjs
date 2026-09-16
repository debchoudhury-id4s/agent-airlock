import { gates } from "../gates/index.mjs";
import policy from "../policies/default.json" with { type: "json" };
import { createCheckIntent } from "../tools/check-intent.mjs";
import { createPolicyEvaluator } from "./policies.mjs";

// Single composition root shared by MCP tools and lifecycle hooks. Keeping one
// evaluator prevents automatic preflight from drifting from explicit Airlock
// tool behavior.
export const evaluateAirlockPolicy = createPolicyEvaluator({ policy, gates });
export const checkIntent = createCheckIntent({ evaluate: evaluateAirlockPolicy });
