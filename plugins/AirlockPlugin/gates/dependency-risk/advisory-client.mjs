import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  dependencyPackageNameSchema,
  dependencyVersionSchema,
} from "./validation.mjs";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const cacheEntrySchema = z.object({
  schemaVersion: z.literal(1),
  ecosystem: z.literal("NuGet"),
  packageName: dependencyPackageNameSchema,
  version: dependencyVersionSchema,
  advisoryIds: z.array(identifier).max(100),
  source: z.literal("osv"),
  observedAt: z.string(),
  expiresAt: z.string(),
}).strict().refine(entry => {
  const observedAt = Date.parse(entry.observedAt);
  const expiresAt = Date.parse(entry.expiresAt);
  return Number.isFinite(observedAt) && Number.isFinite(expiresAt) && observedAt < expiresAt;
});
const osvResponseSchema = z.object({
  vulns: z.array(z.object({ id: identifier }).passthrough()).max(100).optional(),
}).passthrough();

function unavailable(reason) {
  return { status: "unavailable", reason };
}

function evidence(entry, cached) {
  return {
    status: "checked",
    source: entry.source,
    advisoryIds: entry.advisoryIds,
    observedAt: entry.observedAt,
    expiresAt: entry.expiresAt,
    cached,
  };
}

/** Resolve live OSV evidence and persist a short-lived, package-version-specific cache entry. */
export function createOsvAdvisoryProvider({
  root,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  ttlMs = 24 * 60 * 60 * 1000,
  timeoutMs = 10_000,
} = {}) {
  if (typeof root !== "string" || root.length === 0 || typeof fetchImpl !== "function"
    || typeof now !== "function" || !Number.isSafeInteger(ttlMs) || ttlMs <= 0
    || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Invalid OSV advisory provider configuration.");
  }
  const cacheRoot = join(resolve(root), "dependency-advisories");

  return async function resolveAdvisoryEvidence(input) {
    if (!dependencyPackageNameSchema.safeParse(input?.packageName).success
      || !dependencyVersionSchema.safeParse(input?.version).success) {
      return unavailable("invalid-dependency-proposal");
    }
    const checkedAt = now();
    if (!(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())) {
      return unavailable("advisory-clock-failed");
    }
    const key = createHash("sha256")
      .update(`${input.packageName.toLowerCase()}\0${input.version}`)
      .digest("hex");
    const cachePath = join(cacheRoot, `${key}.json`);
    try {
      const cached = cacheEntrySchema.parse(JSON.parse(await readFile(cachePath, "utf8")));
      if (cached.packageName.toLowerCase() === input.packageName.toLowerCase()
        && cached.version === input.version && checkedAt.getTime() < Date.parse(cached.expiresAt)) {
        return evidence(cached, true);
      }
    } catch {
      // Missing, stale, or malformed cache entries are never trusted; refresh them live.
    }

    let response;
    try {
      response = await fetchImpl("https://api.osv.dev/v1/query", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          package: { ecosystem: "NuGet", name: input.packageName },
          version: input.version,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return unavailable("advisory-source-unavailable");
    }
    if (!response?.ok) return unavailable("advisory-source-unavailable");

    let parsed;
    try {
      parsed = osvResponseSchema.parse(await response.json());
    } catch {
      return unavailable("advisory-response-invalid");
    }
    const advisoryIds = [...new Set((parsed.vulns ?? []).map(item => item.id))].sort();
    const observedAt = checkedAt.toISOString();
    const entry = {
      schemaVersion: 1,
      ecosystem: "NuGet",
      packageName: input.packageName,
      version: input.version,
      advisoryIds,
      source: "osv",
      observedAt,
      expiresAt: new Date(checkedAt.getTime() + ttlMs).toISOString(),
    };
    const tempPath = join(cacheRoot, `.${key}.${randomUUID()}.tmp`);
    try {
      await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
      await writeFile(tempPath, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(tempPath, cachePath);
    } catch {
      await rm(tempPath, { force: true }).catch(() => {});
      return unavailable("advisory-cache-write-failed");
    }
    return evidence(entry, false);
  };
}
