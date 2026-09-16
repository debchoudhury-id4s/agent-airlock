import { z } from "zod";
import { findingsSchema } from "../../runtime/policies.mjs";
import defaultSnapshot from "./snapshot.json" with { type: "json" };

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const packageName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/);
const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const entrySchema = z.object({
  approvedVersions: z.array(version),
  blockedVersions: z.array(version),
  advisoryId: identifier,
  reason: identifier,
  allowSyntheticBypass: z.boolean(),
}).strict().refine(entry =>
  new Set([...entry.approvedVersions, ...entry.blockedVersions]).size
    === entry.approvedVersions.length + entry.blockedVersions.length);
const snapshotSchema = z.object({
  id: identifier,
  version: identifier,
  observedAt: z.string(),
  expiresAt: z.string(),
  packages: z.record(packageName, entrySchema),
}).strict().refine(snapshot => {
  const observedAt = Date.parse(snapshot.observedAt);
  const expiresAt = Date.parse(snapshot.expiresAt);
  const normalizedPackages = Object.keys(snapshot.packages).map(name => name.toLowerCase());
  return Number.isFinite(observedAt) && Number.isFinite(expiresAt)
    && observedAt < expiresAt && normalizedPackages.length > 0
    && new Set(normalizedPackages).size === normalizedPackages.length;
});
const checkedEvidenceSchema = z.object({
  status: z.literal("checked"),
  source: z.literal("osv"),
  advisoryIds: z.array(identifier).max(100),
  observedAt: z.string(),
  expiresAt: z.string(),
  cached: z.boolean(),
}).strict();
const unavailableEvidenceSchema = z.object({
  status: z.literal("unavailable"),
  reason: identifier,
}).strict();
const evidenceSchema = z.discriminatedUnion("status", [
  checkedEvidenceSchema,
  unavailableEvidenceSchema,
]);

function decision(kind, reason, ruleId) {
  const findings = ruleId ? findingsSchema.parse([{ ruleId, line: 1 }]) : [];
  return { decision: kind, reason, findings };
}

/** Compare a proposed direct package version with a trusted, dated local snapshot. */
export function createDependencyRiskGate({ snapshot = defaultSnapshot, now = () => new Date() } = {}) {
  let policy;
  try { policy = snapshotSchema.parse(snapshot); }
  catch { throw new Error("Invalid Airlock dependency snapshot."); }
  const expiresAt = Date.parse(policy.expiresAt);
  const packages = new Map(Object.entries(policy.packages)
    .map(([name, entry]) => [name.toLowerCase(), entry]));

  return Object.freeze({
    id: "dependency-risk",
    failureReason: "dependency-check-failed",
    async evaluate(action) {
      const { packageName: requestedPackage, version: requestedVersion, bypass, bypassReason } = action.input;
      if (!packageName.safeParse(requestedPackage).success || !version.safeParse(requestedVersion).success
        || (bypass !== undefined && typeof bypass !== "boolean")
        || (bypassReason !== undefined && !identifier.safeParse(bypassReason).success)) {
        throw new Error("Expected a validated dependency proposal.");
      }
      const checkedAt = now();
      if (!(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())) {
        throw new Error("Dependency snapshot clock failed.");
      }
      if (checkedAt.getTime() >= expiresAt) {
        return decision("ask-first", "dependency-snapshot-expired", "snapshot-expired");
      }
      const entry = packages.get(requestedPackage.toLowerCase());
      if (entry?.blockedVersions.includes(requestedVersion)) {
        if (bypass === true && bypassReason && entry.allowSyntheticBypass
          && entry.advisoryId.startsWith("AIRLOCK-DEMO-")) {
          return decision("allow", "synthetic-bypass-used");
        }
        return decision("block", "dependency-version-blocked", entry.advisoryId);
      }
      if (bypass === true) return decision("block", "dependency-bypass-not-applicable", "invalid-bypass");
      const parsedEvidence = evidenceSchema.safeParse(action.input.advisoryEvidence);
      if (!parsedEvidence.success) {
        return decision("ask-first", "dependency-advisory-unavailable", "advisory-check-unavailable");
      }
      const advisoryEvidence = parsedEvidence.data;
      if (advisoryEvidence.status === "unavailable") {
        return decision("ask-first", advisoryEvidence.reason, "advisory-check-unavailable");
      }
      const observedAt = Date.parse(advisoryEvidence.observedAt);
      const evidenceExpiresAt = Date.parse(advisoryEvidence.expiresAt);
      if (!Number.isFinite(observedAt) || !Number.isFinite(evidenceExpiresAt)
        || observedAt > checkedAt.getTime() || checkedAt.getTime() >= evidenceExpiresAt) {
        return decision("ask-first", "dependency-advisory-stale", "advisory-check-stale");
      }
      if (advisoryEvidence.advisoryIds.length > 0) {
        return {
          decision: "block",
          reason: "known-vulnerability",
          findings: findingsSchema.parse(advisoryEvidence.advisoryIds.map(ruleId => ({ ruleId, line: 1 }))),
        };
      }
      return decision(
        "allow",
        entry?.approvedVersions.includes(requestedVersion)
          ? "dependency-version-approved"
          : "no-known-vulnerability",
      );
    },
  });
}
