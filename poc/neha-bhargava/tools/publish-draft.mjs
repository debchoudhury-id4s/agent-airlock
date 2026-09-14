import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { createBroker, dataRoot, write } from "../runtime/broker.mjs";

export const draftSchema = z.object({ content: z.string().max(65_536) }).strict();

/** Validate draft text and run a fixed local publisher through the shared broker. */
export function createPublishDraft({ root = dataRoot, evaluate }) {
  const run = createBroker({ root, evaluate });
  const outbox = join(resolve(root), "outbox");
  return async function publishDraft(input) {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "blocked", reason: "invalid-input", execution: "not-started", message: "Only a content string is accepted. Paths, overrides, and approval flags are not supported." };
    }
    const { content } = parsed.data;
    if (Buffer.byteLength(content) > 65_536 || Buffer.from(content).toString("utf8") !== content
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)) {
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
    return result;
  };
}
