import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { createBroker, dataRoot, write } from "../runtime/broker.mjs";
import defaultSnapshot from "../gates/dependency-risk/snapshot.json" with { type: "json" };
import { createOsvAdvisoryProvider } from "../gates/dependency-risk/advisory-client.mjs";
import {
  dependencyPackageNameSchema,
  dependencyVersionSchema,
} from "../gates/dependency-risk/validation.mjs";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
export const dependencyChangeSchema = z.object({
  packageName: dependencyPackageNameSchema,
  version: dependencyVersionSchema,
  bypass: z.boolean().optional(),
  bypassReason: identifier.optional(),
}).strict().refine(input =>
  (input.bypass === true && input.bypassReason !== undefined)
    || (input.bypass !== true && input.bypassReason === undefined),
{ message: "A bypass requires one safe reason code." });

/** Review and record a dependency plan; repository edits and restores remain outside this demo. */
export function createReviewDependencyChange({
  root = dataRoot,
  evaluate,
  resolveAdvisoryEvidence = createOsvAdvisoryProvider({ root }),
  snapshot = defaultSnapshot,
  now = () => new Date(),
}) {
  if (typeof resolveAdvisoryEvidence !== "function") {
    throw new Error("Airlock requires an advisory evidence provider.");
  }
  const blocked = new Map(Object.entries(snapshot.packages)
    .map(([name, entry]) => [name.toLowerCase(), new Set(entry.blockedVersions)]));
  const run = createBroker({ root, evaluate });
  const reviews = join(resolve(root), "dependency-reviews");
  return async function reviewDependencyChange(input) {
    const parsed = dependencyChangeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: "blocked", reason: "invalid-input", execution: "not-started",
        message: "Provide packageName and a semantic version. A bypass also requires bypassReason. Snapshot, policy, paths, and approval flags are not accepted.",
      };
    }
    let advisoryEvidence;
    try {
      const checkedAt = now();
      const snapshotExpired = !(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())
        || checkedAt.getTime() >= Date.parse(snapshot.expiresAt);
      const explicitlyBlocked = blocked.get(parsed.data.packageName.toLowerCase())?.has(parsed.data.version) === true;
      advisoryEvidence = !snapshotExpired && explicitlyBlocked
        ? undefined
        : await resolveAdvisoryEvidence(parsed.data);
    } catch {
      advisoryEvidence = { status: "unavailable", reason: "advisory-check-failed" };
    }
    const result = await run({
      tool: "review_dependency_change",
      target: "local-dependency-plan",
      input: {
        ...parsed.data,
        ...(advisoryEvidence === undefined ? {} : { advisoryEvidence }),
      },
    }, async (action, id) => {
      await mkdir(reviews, { recursive: true, mode: 0o700 });
      const artifact = {
        id, status: "approved", packageName: action.input.packageName, version: action.input.version,
        bypassUsed: action.input.bypass === true,
        ...(action.input.bypassReason ? { bypassReason: action.input.bypassReason } : {}),
      };
      const artifactPath = join(reviews, `${id}.json`);
      await write(artifactPath, `${JSON.stringify(artifact)}\n`, "wx");
      return {
        artifactPath, packageName: artifact.packageName, version: artifact.version,
        bypassUsed: artifact.bypassUsed,
      };
    });
    if (result.status === "completed") {
      return {
        ...result, status: "approved",
        message: result.reason === "synthetic-bypass-used"
          ? "The synthetic demo rule was explicitly bypassed and recorded. No repository file was changed and no restore ran."
          : "Current advisory evidence found no known vulnerability for this package version. No repository file was changed and no restore ran.",
      };
    }
    if (result.reason === "execution-failed") return { ...result, reason: "dependency-review-record-failed" };
    return result;
  };
}
