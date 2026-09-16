import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createOsvAdvisoryProvider } from "../gates/dependency-risk/advisory-client.mjs";
import { createDependencyRiskGate } from "../gates/dependency-risk/index.mjs";
import { pluginRoot } from "../gates/secrets/scanner.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import { checkNugetAdvisory } from "../scripts/check-nuget-advisory.mjs";
import { createReviewDependencyChange } from "../tools/review-dependency-change.mjs";
import policy from "../policies/default.json" with { type: "json" };

const approved = { packageName: "Microsoft.Identity.Client", version: "4.87.0" };
const blocked = { packageName: "Microsoft.Identity.Client", version: "4.88.0-airlock-demo" };
const dependencyPolicy = {
  ...policy,
  tools: { review_dependency_change: policy.tools.review_dependency_change },
};

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "airlock-dependency-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function cleanEvidence() {
  const observedAt = new Date();
  return {
    status: "checked", source: "osv", advisoryIds: [],
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(observedAt.getTime() + 60_000).toISOString(),
    cached: false,
  };
}

function createReview({
  root,
  gate = createDependencyRiskGate(),
  resolveAdvisoryEvidence = async () => cleanEvidence(),
} = {}) {
  const evaluate = createPolicyEvaluator({ policy: dependencyPolicy, gates: [gate] });
  return createReviewDependencyChange({ root, evaluate, resolveAdvisoryEvidence });
}

test("live-clean, blocked, and synthetic bypass proposals stay distinct", async t => {
  const root = await scratch(t);
  let checks = 0;
  const review = createReview({
    root,
    resolveAdvisoryEvidence: async () => {
      checks += 1;
      return cleanEvidence();
    },
  });
  const accepted = await review(approved);
  assert.equal(accepted.status, "approved");
  assert.equal(accepted.execution, "completed");
  assert.equal(JSON.parse(await readFile(accepted.artifactPath, "utf8")).bypassUsed, false);
  assert.equal((await review({ ...approved, packageName: "microsoft.identity.client" })).status, "approved");

  const denied = await review(blocked);
  assert.equal(denied.status, "blocked");
  assert.equal(denied.reason, "dependency-version-blocked");
  assert.equal(denied.execution, "not-started");
  assert.deepEqual(denied.findings, [{ ruleId: "AIRLOCK-DEMO-001", line: 1 }]);

  const unknown = await review({ ...approved, version: "4.88.0" });
  assert.equal(unknown.status, "approved");
  assert.equal(unknown.reason, "no-known-vulnerability");

  const bypassed = await review({
    ...blocked, bypass: true, bypassReason: "demo-owner-approved",
  });
  assert.equal(bypassed.status, "approved");
  assert.equal(bypassed.reason, "synthetic-bypass-used");
  assert.equal(bypassed.bypassUsed, true);
  const artifact = JSON.parse(await readFile(bypassed.artifactPath, "utf8"));
  assert.equal(artifact.bypassReason, "demo-owner-approved");
  const receipt = await readFile(bypassed.receiptPath, "utf8");
  assert.match(receipt, /synthetic-bypass-used/);
  assert.doesNotMatch(receipt, /demo-owner-approved|Microsoft\.Identity\.Client|4\.88\.0/);
  assert.equal((await readdir(join(root, "dependency-reviews"))).length, 4);
  assert.equal(checks, 3);
});

test("bypass is limited to an explicitly enabled synthetic blocked rule", async t => {
  const root = await scratch(t);
  const review = createReview({ root });
  const unnecessary = await review({
    ...approved, bypass: true, bypassReason: "demo-owner-approved",
  });
  assert.equal(unnecessary.status, "blocked");
  assert.equal(unnecessary.reason, "dependency-bypass-not-applicable");

  const realSnapshot = {
    id: "test", version: "1", observedAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z",
    packages: {
      "Contoso.Package": {
        approvedVersions: [], blockedVersions: ["1.2.3"], advisoryId: "CVE-2026-1234",
        reason: "known-vulnerability", allowSyntheticBypass: true,
      },
    },
  };
  const realReview = createReview({
    root,
    gate: createDependencyRiskGate({ snapshot: realSnapshot, now: () => new Date("2026-06-01T00:00:00Z") }),
  });
  const real = await realReview({
    packageName: "Contoso.Package", version: "1.2.3", bypass: true, bypassReason: "demo-owner-approved",
  });
  assert.equal(real.status, "blocked");
  assert.equal(real.reason, "dependency-version-blocked");
});

test("known vulnerabilities block and unavailable evidence asks first", async t => {
  const root = await scratch(t);
  const vulnerable = await createReview({
    root,
    resolveAdvisoryEvidence: async () => ({
      ...cleanEvidence(),
      advisoryIds: ["GHSA-1234-5678-9012", "CVE-2026-1234"],
    }),
  })({ packageName: "Any.Package", version: "1.2.3" });
  assert.equal(vulnerable.status, "blocked");
  assert.equal(vulnerable.reason, "known-vulnerability");
  assert.deepEqual(vulnerable.findings, [
    { ruleId: "GHSA-1234-5678-9012", line: 1 },
    { ruleId: "CVE-2026-1234", line: 1 },
  ]);

  const unavailable = await createReview({
    root,
    resolveAdvisoryEvidence: async () => ({
      status: "unavailable", reason: "advisory-source-unavailable",
    }),
  })({ packageName: "Any.Package", version: "1.2.3" });
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.reason, "approval-required");
  assert.equal(unavailable.checks[0].reason, "advisory-source-unavailable");

  const failed = await createReview({
    root,
    resolveAdvisoryEvidence: async () => { throw new Error("provider details must not escape"); },
  })({ packageName: "Any.Package", version: "1.2.3" });
  assert.equal(failed.status, "blocked");
  assert.equal(failed.reason, "approval-required");
  assert.equal(failed.checks[0].reason, "advisory-check-failed");
  assert.doesNotMatch(JSON.stringify(failed), /provider details/);
});

test("stale team policy and malformed evidence fail closed", async t => {
  const root = await scratch(t);
  const staleGate = createDependencyRiskGate({ now: () => new Date("2027-09-15T00:00:00Z") });
  const stale = await createReview({ root, gate: staleGate })(approved);
  assert.equal(stale.status, "blocked");
  assert.equal(stale.reason, "approval-required");
  assert.equal(stale.checks[0].reason, "dependency-snapshot-expired");

  const malformed = await createReview({
    root,
    resolveAdvisoryEvidence: async () => ({ status: "checked", advisoryIds: [] }),
  })({
    packageName: "Unknown.Package", version: "1.2.3",
  });
  assert.equal(malformed.reason, "approval-required");
  assert.equal(malformed.checks[0].reason, "dependency-advisory-unavailable");

  assert.throws(() => createDependencyRiskGate({
    snapshot: {
      id: "bad", version: "1", observedAt: "later", expiresAt: "never", packages: {},
    },
  }));
});

test("invalid proposals cannot reach policy evaluation", async t => {
  const root = await scratch(t);
  const review = createReview({ root });
  for (const input of [
    {}, { ...approved, approved: true }, { ...approved, version: "latest" },
    { ...blocked, bypass: true }, { ...blocked, bypassReason: "demo-owner-approved" },
    { ...blocked, bypass: true, bypassReason: "free form reason" },
  ]) {
    const result = await review(input);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "invalid-input");
  }
  assert.deepEqual(await readdir(root), []);
});

test("OSV provider queries once, caches clean evidence, and exposes the same script behavior", async t => {
  const root = await scratch(t);
  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    return new Response(JSON.stringify({ vulns: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const now = () => new Date("2026-09-16T17:00:00Z");
  const provider = createOsvAdvisoryProvider({ root, fetchImpl, now });
  const first = await provider(approved);
  const second = await provider({ ...approved, packageName: "microsoft.identity.client" });
  assert.equal(first.status, "checked");
  assert.equal(first.cached, false);
  assert.equal(second.status, "checked");
  assert.equal(second.cached, true);
  assert.equal(requested.length, 1);
  assert.equal(requested[0].url, "https://api.osv.dev/v1/query");
  assert.deepEqual(JSON.parse(requested[0].options.body), {
    package: { ecosystem: "NuGet", name: "Microsoft.Identity.Client" },
    version: "4.87.0",
  });
  assert.equal((await readdir(join(root, "dependency-advisories"))).length, 1);

  const scripted = await checkNugetAdvisory({ ...approved, root, fetchImpl, now });
  assert.equal(scripted.cached, true);
  assert.equal(requested.length, 1);
});

test("OSV provider reports advisories and fails closed on source or cache errors", async t => {
  const root = await scratch(t);
  const vulnerable = await createOsvAdvisoryProvider({
    root,
    fetchImpl: async () => new Response(JSON.stringify({
      vulns: [{ id: "GHSA-1234-5678-9012" }, { id: "GHSA-1234-5678-9012" }],
    }), { status: 200 }),
  })(approved);
  assert.deepEqual(vulnerable.advisoryIds, ["GHSA-1234-5678-9012"]);

  const unavailable = await createOsvAdvisoryProvider({
    root: await scratch(t),
    fetchImpl: async () => { throw new Error("network details must not escape"); },
  })(approved);
  assert.deepEqual(unavailable, {
    status: "unavailable", reason: "advisory-source-unavailable",
  });
});

test("expired advisory evidence is refreshed instead of trusted", async t => {
  const root = await scratch(t);
  let checkedAt = new Date("2026-09-16T17:00:00Z");
  let requests = 0;
  const provider = createOsvAdvisoryProvider({
    root,
    now: () => checkedAt,
    ttlMs: 1_000,
    fetchImpl: async () => {
      requests += 1;
      return new Response(JSON.stringify({
        vulns: requests === 1 ? [] : [{ id: "CVE-2026-5678" }],
      }), { status: 200 });
    },
  });
  assert.deepEqual((await provider(approved)).advisoryIds, []);
  checkedAt = new Date("2026-09-16T17:00:02Z");
  const refreshed = await provider(approved);
  assert.deepEqual(refreshed.advisoryIds, ["CVE-2026-5678"]);
  assert.equal(refreshed.cached, false);
  assert.equal(requests, 2);
});

test("MCP exposes dependency review and blocks the offline fixture without repository edits", async t => {
  const client = new Client({ name: "airlock-dependency-test", version: "0.1.0" });
  t.after(() => client.close());
  const home = await scratch(t);
  const workspace = await scratch(t);
  await writeFile(join(workspace, "Directory.Build.props"), "<Project />");
  const env = { HOME: home, USERPROFILE: home };
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(SystemRoot|WINDIR)$/i.test(key) && value !== undefined) env[key] = value;
  }
  const config = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  const declaration = config.mcpServers["airlock-outbound"];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: declaration.args.map(arg => arg.replaceAll("${PLUGIN_ROOT}", pluginRoot)),
    cwd: workspace, env, stderr: "pipe",
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    "check_intent", "publish_draft", "review_dependency_change", "select_model", "trending_cost",
  ]);
  const denied = await client.callTool({ name: "review_dependency_change", arguments: blocked });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent.execution, "not-started");
  assert.equal(await readFile(join(workspace, "Directory.Build.props"), "utf8"), "<Project />");
});
