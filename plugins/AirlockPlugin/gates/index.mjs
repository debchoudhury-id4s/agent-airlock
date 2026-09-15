import { createSecretsGate } from "./secrets/index.mjs";
import { createNoOnlineWritesGate } from "./no-online-writes/index.mjs";
import { createModelCatalogGate } from "./model-catalog/index.mjs";
import { approvalGate } from "./approval/index.mjs";
/** Trusted registrations only; never discover executable gates from the consumer repository. */
export const gates = Object.freeze([createSecretsGate(), createNoOnlineWritesGate(), createModelCatalogGate(), approvalGate()]);
