import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { createBroker, dataRoot, write } from "../runtime/broker.mjs";
import { isSupportedText } from "../runtime/plain-text.mjs";
import { createRecordTextSanitizer } from "../runtime/sanitize-record-text.mjs";

export const draftSchema = z.object({ content: z.string().max(65_536) }).strict();

/** Validate draft text and run a fixed local publisher through the shared broker. */
export function createPublishDraft({ root = dataRoot, evaluate }) {
  const run = createBroker({ root, evaluate });
  const sanitizeText = createRecordTextSanitizer();
  const outbox = join(resolve(root), "outbox");
  return async function publishDraft(input) {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "blocked", reason: "invalid-input", execution: "not-started", message: "Only a content string is accepted. Paths, overrides, and approval flags are not supported." };
    }
    const { content } = parsed.data;
    if (!isSupportedText(content)) {
      return { status: "blocked", reason: "unsupported-content", execution: "not-started", message: "Use valid UTF-8 plain text, at most 64 KiB." };
    }
    const result = await run({
      tool: "publish_draft", target: "local-review-outbox", input: { content },
    }, async (action, id) => {
      await mkdir(outbox, { recursive: true, mode: 0o700 });
      const artifactPath = join(outbox, `${id}.md`);
      await write(artifactPath, action.input.content, "wx");
      return { artifactPath };
    });
    if (result.status === "completed") return {
      ...result, status: "published", message: "Copied the scanned text to the local review outbox. Nothing was sent online.",
    };
    if (result.reason === "execution-failed") return { ...result, reason: "publication-failed" };
    if (result.status === "blocked" && result.findings?.length
      && !result.checks.some(check => check.decision === "error")) {
      const sanitized = await sanitizeText(content);
      return {
        ...result,
        // Never echo a source that the publishing policy flagged but a sanitizer did not.
        remediation: sanitized.status === "unchanged"
          ? { status: "withheld", message: "No replacement was cleared. Prepare a new draft for review." }
          : sanitized,
      };
    }
    return result;
  };
}
