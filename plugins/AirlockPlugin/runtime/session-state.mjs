import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { dataRoot, write } from "./broker.mjs";

// Prompt text and tool arguments are deliberately excluded from persistent state.
const stateSchema = z.object({
  sessionId: z.string().min(1).max(1024),
  decision: z.enum(["allow", "ask-first", "block", "error"]),
  reason: z.string().min(1).max(128),
  promptTimestamp: z.number().finite(),
  policy: z.string().min(1).max(128).optional(),
  policyVersion: z.string().min(1).max(128).optional(),
  policySha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();

function statePath(sessionId, root = dataRoot) {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(root, "sessions", `${key}.json`);
}

export async function saveMissionState(state, root = dataRoot) {
  const snapshot = stateSchema.parse(state);
  const path = statePath(snapshot.sessionId, root);
  await mkdir(join(root, "sessions"), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await write(temporary, `${JSON.stringify(snapshot)}\n`, "wx");
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return path;
}

export async function loadMissionState(sessionId, root = dataRoot) {
  try {
    return stateSchema.parse(JSON.parse(await readFile(statePath(sessionId, root), "utf8")));
  } catch {
    return null;
  }
}

export async function removeMissionState(sessionId, root = dataRoot) {
  await rm(statePath(sessionId, root), { force: true });
}
