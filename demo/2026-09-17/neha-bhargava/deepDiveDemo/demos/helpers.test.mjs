import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertCheckout, isolatedEnvironment, safeResult, parseArgs, requireInside,
} from "./helpers.mjs";

test("CLI lists locally and rejects unknown or conflicting selectors", () => {
  assert.deepEqual(parseArgs(["--list"]), { list: true });
  assert.deepEqual(parseArgs(["--gate", "all"]), { gate: "all" });
  assert.throws(() => parseArgs(["--gate", "unknown"]));
  assert.throws(() => parseArgs(["--gate", "constructor"]));
  assert.throws(() => parseArgs(["--gate", "__proto__"]));
  assert.throws(() => parseArgs(["--list", "--gate", "all"]));
  assert.throws(() => parseArgs(["--gate", "intent", "--case", "clean"]));
  assert.throws(() => parseArgs(["--live-osv"]));
});

test("server environment forwards operating-system needs, never caller secrets", () => {
  const env = isolatedEnvironment("C:\\isolated", {
    PATH: "node;gitleaks", SystemRoot: "C:\\Windows", TEMP: "temp",
    HOME: "real", USERPROFILE: "real", GH_TOKEN: "private", NODE_OPTIONS: "--import evil",
    SECRET: "private", APPDATA: "real",
  });
  assert.equal(env.PATH, "node;gitleaks");
  assert.equal(env.SystemRoot, "C:\\Windows");
  assert.equal(env.HOME, "C:\\isolated");
  assert.equal(env.USERPROFILE, "C:\\isolated");
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.SECRET, undefined);
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.notEqual(env.APPDATA, "real");
});

test("safe evidence allowlists metadata rather than serializing text or candidates", () => {
  const result = safeResult({
    status: "blocked", reason: "secret-detected", execution: "not-started",
    message: "private", unexpected: "private",
    findings: [{ ruleId: "synthetic-secret", line: 1, value: "private" }],
    remediation: { status: "removed", candidate: { content: "private" } },
  });
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.deepEqual(result.findings, [{ ruleId: "synthetic-secret", line: 1 }]);
  assert.deepEqual(result.remediation, { status: "removed", candidateAvailable: true });
});

test("evidence paths cannot escape the disposable profile", () => {
  assert.equal(requireInside("C:\\run", "C:\\run\\receipt.json"), "C:\\run\\receipt.json");
  assert.throws(() => requireInside("C:\\run", "C:\\runner\\receipt.json"));
  assert.throws(() => requireInside("C:\\run", "C:\\run\\..\\secret"));
});

test("checkout protection refuses dirty, wrong-origin and non-repository directories", async () => {
  const base = new URL("./.tmp/", import.meta.url);
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(fileURLToPath(base), "checkout-"));
  try {
    const git = args => {
      const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.equal(r.status, 0);
    };
    await assert.rejects(assertCheckout(root), /checkout/);
    git(["init", "--quiet"]);
    git(["remote", "add", "origin", "https://github.com/dlingam_microsoft/airlock-e2e-sample.git"]);
    await writeFile(join(root, "dirty.txt"), "synthetic");
    await assert.rejects(assertCheckout(root), /dirty/);
    await rm(join(root, "dirty.txt"));
    git(["remote", "set-url", "origin", "https://github.com/other/wrong"]);
    await assert.rejects(assertCheckout(root), /origin/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("offline safety guard refuses fetch without retaining its URL or payload", async () => {
  const base = new URL("./.tmp/", import.meta.url);
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(fileURLToPath(base), "offline-"));
  const log = join(root, "network.log");
  try {
    await writeFile(log, "");
    const r = spawnSync(process.execPath, [
      "--import", new URL("./offline-guard.mjs", import.meta.url).href,
      "--input-type=module", "-e",
      "try { await fetch('https://example.test/private-fixture', {body:'private-fixture',method:'POST'}); process.exitCode=2; } catch(e) { if(e.message!=='airlock-demo-network-disabled') process.exitCode=3; }",
    ], { env: { ...isolatedEnvironment(root), AIRLOCK_DEMO_NETWORK_LOG: log }, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
    assert.equal(await readFile(log, "utf8"), "blocked-network-attempt\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("--list needs neither checkout nor MCP and never exposes fixture values", () => {
  const r = spawnSync(process.execPath, ["demos/run.mjs", "--list"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8",
  });
  assert.equal(r.status, 0);
  for (const name of ["sensitive-information", "dependency-risk", "model-catalog", "intent", "trending-cost"]) {
    assert.ok(r.stdout.includes(name));
  }
  assert.ok(!r.stdout.includes("AIRLOCK_SYNTHETIC_SECRET_"));
  assert.equal(r.stderr, "");
});
