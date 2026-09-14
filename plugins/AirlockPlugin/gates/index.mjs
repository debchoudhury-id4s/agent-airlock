import { createSecretsGate } from "./secrets/index.mjs";

/** Trusted registrations only; never discover executable gates from the consumer repository. */
export const gates = Object.freeze([createSecretsGate()]);
