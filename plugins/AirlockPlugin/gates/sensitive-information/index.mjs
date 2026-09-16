import { findingsSchema } from "../../runtime/policies.mjs";
import { createSecretsGate } from "../secrets/index.mjs";
import { detectPersonalData } from "./personal-data.mjs";
import { detectInternalLabel } from "./internal-label.mjs";

function reviewGate(id, detector, matchReason, clearReason) {
  return Object.freeze({
    id,
    failureReason: "sensitive-detector-failed",
    async evaluate(action) {
      const findings = findingsSchema.parse(await detector(action.input.content));
      return {
        decision: findings.length ? "ask-first" : "allow",
        reason: findings.length ? matchReason : clearReason,
        findings,
      };
    },
  });
}

/** Require review for detected personal data; detector injection is host-owned. */
export function createPersonalDataGate({ detector = detectPersonalData } = {}) {
  return reviewGate("personal-data-review", detector, "personal-data-detected", "no-personal-data-match");
}

/** Require review for explicitly labelled text without declassifying its body. */
export function createInternalLabelGate({ detector = detectInternalLabel } = {}) {
  return reviewGate("internal-label-review", detector, "internal-label-detected", "no-internal-label-match");
}

/** One user-facing capability, composed from independent read-only gates. Host injection only. */
export function createSensitiveInformationGates({ scanner, personalDataDetector, labelDetector } = {}) {
  return Object.freeze([
    createSecretsGate({ scanner }),
    createPersonalDataGate({ detector: personalDataDetector }),
    createInternalLabelGate({ detector: labelDetector }),
  ]);
}
