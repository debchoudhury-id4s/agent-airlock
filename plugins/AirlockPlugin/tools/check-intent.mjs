import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { createBroker, dataRoot, write } from "../runtime/broker.mjs";

export const intentSchema = z.object({ prompt: z.string().max(65_536) }).strict();

/** Validate an intent prompt and record a local clearance only when no online write is requested. */
export function createCheckIntent({ root = dataRoot, evaluate }) {
  const run = createBroker({ root, evaluate });
  const cleared = join(resolve(root), "cleared-intents");
  return async function checkIntent(input) {
    const parsed = intentSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "blocked", reason: "invalid-input", execution: "not-started", message: "Only a prompt string is accepted. Paths, overrides, and approval flags are not supported." };
    }
    const { prompt } = parsed.data;
    if (Buffer.byteLength(prompt) > 65_536 || Buffer.from(prompt).toString("utf8") !== prompt
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(prompt)) {
      return { status: "blocked", reason: "unsupported-content", execution: "not-started", message: "Use valid UTF-8 plain text, at most 64 KiB." };
    }
    const result = await run({
      tool: "check_intent", target: "local-mission-review", input: { prompt },
    }, async (_action, id) => {
      await mkdir(cleared, { recursive: true, mode: 0o700 });
      const artifactPath = join(cleared, `${id}.json`);
      await write(artifactPath, `${JSON.stringify({ id, status: "cleared" })}\n`, "wx");
      return { artifactPath };
    });
    if (result.status === "completed") return {
      ...result, status: "cleared", message: "Intent does not request an online write. Local work may continue. Nothing was sent online.",
    };
    if (result.reason === "execution-failed") return { ...result, reason: "intent-record-failed" };
    return result;
  };
}
