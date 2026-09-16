import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublishDraft, draftSchema } from "./tools/publish-draft.mjs";
import { createCheckIntent, intentSchema } from "./tools/check-intent.mjs";
import { createSelectModel, modelSelectionSchema } from "./tools/select-model.mjs";
import { createReviewDependencyChange, dependencyChangeSchema } from "./tools/review-dependency-change.mjs";
import { createTrendingCost, trendingCostSchema } from "./tools/trending-cost.mjs";
import { createPolicyEvaluator } from "./runtime/policies.mjs";
import { gates } from "./gates/index.mjs";
import policy from "./policies/default.json" with { type: "json" };
import trendingCostPolicy from "./policies/trending-cost.json" with { type: "json" };

const publish = createPublishDraft({ evaluate: createPolicyEvaluator({ policy, gates }) });
const trendingCost = createTrendingCost({
  evaluate: createPolicyEvaluator({ policy: trendingCostPolicy, gates }),
  settings: trendingCostPolicy.settings,
});
const server = new McpServer({ name: "airlock-outbound", version: "0.2.0" });
server.registerTool("publish_draft", {
  description: "Scan a plain-text draft and copy it to a local review outbox only if no secret detector matches. No online publication. A block cannot be overridden. Returns redacted decision and receipt paths, never raw content.",
  inputSchema: draftSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async input => {
  const result = await publish(input);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result.status !== "published",
  };
});
const checkIntent = createCheckIntent({ evaluate: createPolicyEvaluator({ policy, gates }) });
server.registerTool("check_intent", {
  description: "Review a user intent prompt and record a local clearance only if it does not request an online write. /yolo and allow-all cannot authorize an online write. No network send. Returns redacted decision and receipt paths, never the prompt.",
  inputSchema: intentSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async input => {
  const result = await checkIntent(input);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result.status !== "cleared",
  };
});
const selectModel = createSelectModel({ evaluate: createPolicyEvaluator({ policy, gates }) });
server.registerTool("select_model", {
  description: "Select a local catalog model for a task and data class. The team default is recorded locally. Non-default permitted models need approval, which is not implemented. Unknown, blocked, and out-of-boundary choices are blocked. No remote model call.",
  inputSchema: modelSelectionSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async input => {
  const result = await selectModel(input);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result.status !== "selected",
  };
});
const reviewDependencyChange = createReviewDependencyChange({ evaluate: createPolicyEvaluator({ policy, gates }) });
server.registerTool("review_dependency_change", {
  description: "Review a proposed direct NuGet version against a dated local snapshot before any edit or restore. Records an approved local plan only. Supports an explicit bypass solely for the synthetic AIRLOCK-DEMO rule; the receipt records its use.",
  inputSchema: dependencyChangeSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async input => {
  const result = await reviewDependencyChange(input);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result.status !== "approved",
  };
});
server.registerTool("trending_cost", {
  description: "Report estimated month-to-date and current-day Copilot CLI cost plus current-day token usage from the local read-only session store. The reviewed policy is advisory by default and can be changed to block at a configured month-to-date threshold. No network request.",
  inputSchema: trendingCostSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async input => {
  const result = await trendingCost(input);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    isError: result.status !== "reported",
  };
});

try {
  await server.connect(new StdioServerTransport());
} catch {
  console.error("Airlock MCP startup failed. Run npm ci and npm run setup in the plugin folder.");
  process.exitCode = 1;
}
