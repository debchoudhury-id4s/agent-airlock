import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublishDraft, draftSchema } from "./tools/publish-draft.mjs";
import { intentSchema } from "./tools/check-intent.mjs";
import { createSelectModel, modelSelectionSchema } from "./tools/select-model.mjs";
import { checkIntent, evaluateAirlockPolicy } from "./runtime/airlock.mjs";

const publish = createPublishDraft({ evaluate: evaluateAirlockPolicy });
const server = new McpServer({ name: "airlock-outbound", version: "0.1.0" });
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
const selectModel = createSelectModel({ evaluate: evaluateAirlockPolicy });
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

try {
  await server.connect(new StdioServerTransport());
} catch {
  console.error("Airlock MCP startup failed. Run npm ci and npm run setup in the plugin folder.");
  process.exitCode = 1;
}
