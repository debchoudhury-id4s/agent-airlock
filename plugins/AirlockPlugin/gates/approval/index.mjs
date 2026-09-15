/**
 * Marks an action as requiring explicit local approval.
 *
 * This gate does not grant approval or execute the action.
 * The shared broker owns approval collection, validation,
 * expiration, redemption, rechecking, and receipts.
 */
export const approvalGate = Object.freeze({
  id: "local-approval-required",

  async evaluate() {
    return {
      decision: "ask-first",
      reason: "local-review-required",
      findings: [],
    };
  },
});
