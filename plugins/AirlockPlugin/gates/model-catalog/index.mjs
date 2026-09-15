import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import defaultCatalog from "./catalog.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const catalogSchema = z.object({
  models: z.array(z.object({
    id: identifier,
    endpoint: identifier,
    taskTypes: z.array(identifier).min(1),
    dataClasses: z.array(identifier).min(1),
  }).strict()).min(1).refine(models => new Set(models.map(model => model.id)).size === models.length),
  defaults: z.record(identifier, z.record(identifier, z.object({
    model: identifier,
    endpoint: identifier,
  }).strict())),
  blockedModels: z.array(identifier),
  blockedEndpoints: z.array(identifier),
}).strict().refine(catalog => {
  const models = new Map(catalog.models.map(model => [model.id, model]));
  const blocked = new Set(catalog.blockedModels);
  for (const byClass of Object.values(catalog.defaults)) {
    for (const choice of Object.values(byClass)) {
      const model = models.get(choice.model);
      if (!model || blocked.has(choice.model) || model.endpoint !== choice.endpoint) return false;
    }
  }
  return true;
});

function decision(reason, findings = []) {
  const parsed = findingsSchema.parse(findings);
  if (reason === "default-model-selected") return { decision: "allow", reason, findings: parsed };
  if (reason === "non-default-model") return { decision: "ask-first", reason, findings: parsed };
  return { decision: "block", reason, findings: parsed };
}

/** Read-only catalog check. Catalog files are trusted plugin data, not MCP arguments. */
export function createModelCatalogGate({ catalog = defaultCatalog } = {}) {
  let snapshot;
  try { snapshot = catalogSchema.parse(catalog); }
  catch { throw new Error("Invalid Airlock model catalog."); }
  const models = new Map(snapshot.models.map(model => [model.id, model]));
  const blockedModels = new Set(snapshot.blockedModels);
  const blockedEndpoints = new Set(snapshot.blockedEndpoints);
  return Object.freeze({
    id: "model-catalog",
    failureReason: "catalog-check-failed",
    async evaluate(action) {
      const { taskType, dataClass, model, endpoint } = action.input;
      if (!identifier.safeParse(taskType).success || !identifier.safeParse(dataClass).success) {
        throw new Error("Expected catalog identifiers.");
      }
      if (model !== undefined && !identifier.safeParse(model).success) throw new Error("Expected catalog identifiers.");
      if (endpoint !== undefined && !identifier.safeParse(endpoint).success) throw new Error("Expected catalog identifiers.");
      const fallback = snapshot.defaults[taskType]?.[dataClass];
      if (!fallback) {
        return decision(Object.hasOwn(snapshot.defaults, taskType) ? "outside-data-boundary" : "unknown-task-type",
          [{ ruleId: Object.hasOwn(snapshot.defaults, taskType) ? "outside-data-boundary" : "unknown-task-type", line: 1 }]);
      }
      const requestedModel = model ?? fallback.model;
      if (blockedModels.has(requestedModel)) {
        return decision("blocked-model", [{ ruleId: "blocked-model", line: 1 }]);
      }
      const entry = models.get(requestedModel);
      if (!entry) return decision("unknown-model", [{ ruleId: "unknown-model", line: 1 }]);
      if (!entry.taskTypes.includes(taskType) || !entry.dataClasses.includes(dataClass)) {
        return decision("outside-data-boundary", [{ ruleId: "outside-data-boundary", line: 1 }]);
      }
      const requestedEndpoint = endpoint ?? entry.endpoint;
      if (blockedEndpoints.has(requestedEndpoint) || requestedEndpoint !== entry.endpoint) {
        return decision("forbidden-endpoint", [{ ruleId: "forbidden-endpoint", line: 1 }]);
      }
      if (requestedModel === fallback.model && requestedEndpoint === fallback.endpoint) {
        return decision("default-model-selected");
      }
      return decision("non-default-model");
    },
  });
}
