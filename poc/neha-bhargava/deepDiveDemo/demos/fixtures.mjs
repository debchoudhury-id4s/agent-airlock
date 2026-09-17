import { readFile, realpath, lstat } from "node:fs/promises";
import { join } from "node:path";
import { requireInside, sha256 } from "./helpers.mjs";

// Reviewed synthetic fixture bytes at sample SHA 41b6434a4a0889d29f4b568e16c0a7713285c9ff.
// Pin the complete bytes: an unexpected edit must fail, not be repaired into a passing fixture.
export const fixtureManifest = Object.freeze({
  clean: { path: "fixtures/clean-draft.txt", sha256: "6fe49b0639ae08dbf231c86525cbdc630fd4855b91a250395c12be06a413e3aa" },
  secret: { path: "fixtures/secret-draft.txt", sha256: "e648986722fe9a7b0c15b3f9ff4d06d6509abda6e6aca59d124f6877117bce2f" },
  pii: { path: "fixtures/pii-draft.txt", sha256: "d37aac9fa68a8e2d72ce497749f5c207bcd5df774d7ac476cbd6ec2b48bcadb1" },
  label: { path: "fixtures/internal-only-draft.txt", sha256: "4a43a52bb56595958b3bf0125b9357d868c4f0b14d30170753b2b7740cc5200c" },
  "header-log": { path: "fixtures/header-log.txt", sha256: "e2f9fe5ff62748725c9250c93b5b66509c3fd991ae965b2a49596f1c2afb4998" },
});

export function validateFixture(name, bytes) {
  if (!Object.hasOwn(fixtureManifest, name)) throw new Error("unknown-fixture");
  const manifest = fixtureManifest[name];
  if (!Buffer.isBuffer(bytes) || sha256(bytes) !== manifest.sha256) throw new Error("fixture-content-changed");
  const content = bytes.toString("utf8");
  if (!Buffer.from(content).equals(bytes) || bytes.length > 65_536) throw new Error("unsupported-fixture-content");
  const markers = [...content.matchAll(/\bAIRLOCK_SYNTHETIC_SECRET_[a-zA-Z]{24}\b/g)].map(match => match[0]);
  const emails = [...content.matchAll(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.test\b/g)].map(match => match[0]);
  const labels = [...content.matchAll(/\bINTERNAL-ONLY\b[^\r\n]*/g)].map(match => match[0]);
  if (markers.length !== (name === "secret" ? 1 : 0)
    || emails.length !== (name === "pii" ? 1 : 0)
    || labels.length !== (name === "label" ? 1 : 0)) throw new Error("fixture-shape-changed");
  if (name === "header-log" && !/^Authorization: \*{6}\r?\n$/.test(content)) {
    throw new Error("header-fixture-is-not-reviewed-masked-header");
  }
  const labelBodies = labels.map(line => line.replace(/^INTERNAL-ONLY[\s:—-]*/, "").trim());
  if (name === "label" && labelBodies.some(body => !body)) throw new Error("fixture-label-body-missing");
  return {
    content, // In memory only. Never include this object wholesale in evidence.
    sensitiveValues: [...markers, ...emails, ...labels, ...labelBodies],
    metadata: { label: name, ...manifest, bytes: bytes.length,
      ...(name === "header-log" ? { shape: "already-masked-authorization-header" } : {}) },
  };
}

export async function loadFixtures(sampleRoot) {
  const fixtures = {};
  for (const [name, manifest] of Object.entries(fixtureManifest)) {
    const path = join(sampleRoot, manifest.path);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("fixture-not-regular-file");
    requireInside(await realpath(sampleRoot), await realpath(path));
    fixtures[name] = validateFixture(name, await readFile(path));
  }
  return fixtures;
}
