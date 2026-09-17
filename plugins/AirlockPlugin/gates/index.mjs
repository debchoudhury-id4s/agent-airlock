import { createSensitiveInformationGates } from "./sensitive-information/index.mjs";
import { createNoOnlineWritesGate } from "./no-online-writes/index.mjs";
import { createModelCatalogGate } from "./model-catalog/index.mjs";
import { createTrendingCostGate } from "./trending-cost/index.mjs";
import { approvalGate } from "./approval/index.mjs";
import { createDependencyRiskGate } from "./dependency-risk/index.mjs";
import { createRfcRelevanceGate } from "./rfc-relevance/index.mjs";
/** Trusted registrations only; never discover executable gates from the consumer repository. */
export const gates = Object.freeze([
  ...createSensitiveInformationGates(),
  createNoOnlineWritesGate(),
  createModelCatalogGate(),
  createTrendingCostGate(),
  approvalGate,
  createDependencyRiskGate(),
  createRfcRelevanceGate(),
]);
