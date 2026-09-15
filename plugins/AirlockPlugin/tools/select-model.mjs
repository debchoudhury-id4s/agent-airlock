import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { createBroker, dataRoot, write } from "../runtime/broker.mjs";
import catalog from "../gates/model-catalog/catalog.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
export const modelSelectionSchema = z.object({
  taskType: identifier,
  dataClass: identifier,
  model: identifier.optional(),
  endpoint: identifier.optional(),
}).strict();

/** Validate a model choice and record a local selection only when the catalog default is used. */
export function createSelectModel({ root = dataRoot, evaluate }) {
  const run = createBroker({ root, evaluate });
  const selections = join(resolve(root), "model-selections");
  return async function selectModel(input) {
    const parsed = modelSelectionSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "blocked", reason: "invalid-input", execution: "not-started", message: "Only taskType, dataClass, and optional model/endpoint identifiers are accepted. Overrides and approval flags are not supported." };
    }
    const result = await run({
      tool: "select_model", target: "local-model-selection", input: parsed.data,
    }, async (action, id) => {
      await mkdir(selections, { recursive: true, mode: 0o700 });
      const fallback = catalog.defaults[action.input.taskType][action.input.dataClass];
      const selected = {
        id, status: "selected", taskType: action.input.taskType, dataClass: action.input.dataClass,
        model: action.input.model ?? fallback.model, endpoint: action.input.endpoint ?? fallback.endpoint,
      };
      const artifactPath = join(selections, `${id}.json`);
      await write(artifactPath, `${JSON.stringify(selected)}\n`, "wx");
      return { artifactPath, model: selected.model, endpoint: selected.endpoint };
    });
    if (result.status === "completed") return {
      ...result, status: "selected", message: "Selected the catalog default model. No remote model was called.",
    };
    if (result.reason === "execution-failed") return { ...result, reason: "selection-failed" };
    return result;
  };
}
