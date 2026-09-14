import { findingsSchema } from "../../runtime/policies.mjs";
import { scan } from "./scanner.mjs";

/** Read-only secret check. Scanner injection is for host tests, not MCP arguments. */
export function createSecretsGate({ scanner = scan } = {}) {
  return Object.freeze({
    id: "no-secrets-in-drafts",
    failureReason: "scanner-failed",
    async evaluate(action) {
      const findings = findingsSchema.parse(await scanner(action.input.content));
      return {
        decision: findings.length ? "block" : "allow",
        reason: findings.length ? "secret-detected" : "no-secret-match",
        findings,
      };
    },
  });
}
