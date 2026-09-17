import { gates } from "../gates/index.mjs";
import policy from "../policies/default.json" with { type: "json" };
import { createCheckIntent } from "../tools/check-intent.mjs";
import { createPolicyEvaluator } from "./policies.mjs";

// Explicit MCP checks and automatic lifecycle hooks share one composition root
// so the prompt and tool boundaries cannot drift from the reviewed policy.
export const evaluateAirlockPolicy = createPolicyEvaluator({ policy, gates });
export const checkIntent = createCheckIntent({ evaluate: evaluateAirlockPolicy });
