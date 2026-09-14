import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPublishDraft, draftSchema } from "./tools/publish-draft.mjs";
import { createPolicyEvaluator } from "./runtime/policies.mjs";
import { gates } from "./gates/index.mjs";
import policy from "./policies/default.json" with { type: "json" };

const publish = createPublishDraft({ evaluate: createPolicyEvaluator({ policy, gates }) });
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

try {
  await server.connect(new StdioServerTransport());
} catch {
  console.error("Airlock MCP startup failed. Run npm ci and npm run setup in the plugin folder.");
  process.exitCode = 1;
}
