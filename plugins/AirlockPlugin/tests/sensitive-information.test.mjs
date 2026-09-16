import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectPersonalData } from "../gates/sensitive-information/personal-data.mjs";
import { detectInternalLabel } from "../gates/sensitive-information/internal-label.mjs";
import { createSensitiveInformationGates } from "../gates/sensitive-information/index.mjs";
import { createRecordTextSanitizer } from "../runtime/sanitize-record-text.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import { createPublishDraft } from "../tools/publish-draft.mjs";
import { scan } from "../gates/secrets/scanner.mjs";
import policy from "../policies/default.json" with { type: "json" };

// All fixtures are synthetic, including reserved example domains and test card numbers.
const email = "airlock.fixture@example.test";
const token = "logfixture_A7b9C2d4E6f8G0h2";
const secret = ["AIRLOCK", "SYNTHETIC", "SECRET", "abcdefghijklmnopqrstuvwx"].join("_");
const cases = [
  ["email-address", email],
  ["phone-number", "(202) 555-0123"],
  ["phone-number", "202-555-0123"],
  ["phone-number", "202.555.0123"],
  ["phone-number", "202 555 0123"],
  ["phone-number", "+1 (202) 555-0123"],
  ["phone-number", "+12025550123"],
  ["phone-number", "0012025550123"],
  ["phone-number", "+442079460123"],
  ["phone-number", "0044 20 7946 0123"],
  ["payment-card", "4111 1111 1111 1111"],
  ["payment-card", "378282246310005"],
  ["payment-card", "4222222222222"],
  ["payment-card", "4000000000000000006"],
  ["us-ssn", "123-45-6789"],
  ["us-ssn", "001-01-0001"],
  ["us-ssn", "899-99-9999"],
];

function evaluateWith(options = {}) {
  return createPolicyEvaluator({
    policy: { ...policy, tools: {
      publish_draft: policy.tools.publish_draft,
      publish_approved_draft: policy.tools.publish_approved_draft.filter(id => id !== "local-approval-required"),
    } },
    gates: createSensitiveInformationGates(options),
  });
}
const action = content => ({ tool: "publish_draft", target: "local-review-outbox", input: { content } });
async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "airlock-sensitive-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("bounded personal-data categories report only fixed rule IDs and positive lines", () => {
  for (const [ruleId, value] of cases) {
    assert.ok(detectPersonalData(`Synthetic fixture:\n${value}`).some(f => f.ruleId === ruleId && f.line === 2), ruleId);
    for (const finding of detectPersonalData(value)) {
      assert.deepEqual(Object.keys(finding).sort(), ["line", "ruleId"]);
      assert.ok(finding.line > 0);
    }
  }
  assert.deepEqual(detectPersonalData(`${email}\r\n${email}\n123-45-6789`), [
    { ruleId: "email-address", line: 1 }, { ruleId: "email-address", line: 2 },
    { ruleId: "us-ssn", line: 3 },
  ]);
});

test("personal-data nonmatches exclude dates, versions, malformed SSNs and invalid cards", () => {
  for (const value of [
    "hello world", "build 8.30.1", "2026-09-16", "+2026-09-16", "2026/09/16", "2025550123",
    "123-456-7890", "202-155-0123", "+1234567", "+1234567890123456",
    "local@localhost", "local@example", "local@-example.test",
    "000-12-3456", "666-12-3456", "900-12-3456", "123-00-3456", "123-45-0000",
    "4111 1111 1111 1112", "0000 0000 0000 0000", "41111111111111111111",
  ]) assert.deepEqual(detectPersonalData(value), [], value);
});

test("explicit INTERNAL-ONLY is case-insensitive, bounded and line-aware", () => {
  assert.deepEqual(detectInternalLabel("note\n[internal-only]: synthetic body"), [
    { ruleId: "internal-only-label", line: 2 },
  ]);
  for (const value of ["INTERNAL", "internal only", "NOTINTERNAL-ONLY", "INTERNAL-ONLYISH"]) {
    assert.deepEqual(detectInternalLabel(value), []);
  }
});

test("detectors enforce finding and text bounds without treating excess as clean", () => {
  assert.equal(detectPersonalData("a@b.co\n".repeat(4096)).length, 4096);
  // Overlapping international/NANP patterns count as one rule on each line.
  const overlapping = "+1-202-555-0123\n".repeat(4096);
  assert.equal(Buffer.byteLength(overlapping), 65_536);
  assert.equal(detectPersonalData(overlapping).length, 4096);
  assert.throws(() => detectPersonalData("a@b.co\n".repeat(4097)));
  assert.equal(detectInternalLabel("INTERNAL-ONLY\n".repeat(4096)).length, 4096);
  assert.throws(() => detectInternalLabel("INTERNAL-ONLY\n".repeat(4097)));
  assert.deepEqual(detectPersonalData("x".repeat(65_536)), []);
  assert.deepEqual(detectPersonalData(`+${"1".repeat(65_534)}x`), []);
  assert.throws(() => detectPersonalData("x".repeat(65_537)));
});

test("default bindings review PII and labels, with credentials taking block precedence", async () => {
  const evaluate = evaluateWith();
  assert.equal((await evaluate(action("Synthetic clean draft"))).decision, "allow");
  for (const content of [email, "INTERNAL-ONLY: synthetic body"]) {
    assert.equal((await evaluate(action(content))).decision, "ask-first");
    assert.equal((await evaluate({ ...action(content), tool: "publish_approved_draft" })).decision, "ask-first");
  }
  const result = await evaluate(action(`${secret}\n${email}\nINTERNAL-ONLY: synthetic body`));
  assert.equal(result.decision, "block");
  assert.equal(result.reason, "secret-detected");
  assert.deepEqual(result.checks.map(c => c.decision), ["block", "ask-first", "ask-first"]);
  for (const value of [secret, email, "synthetic body"]) assert.ok(!JSON.stringify(result).includes(value));
});

test("real Gitleaks blocks contextual tokens in supplied logs and header-like text", async () => {
  for (const content of [
    `Authorization: Bearer ${token}`,
    'Authorization: Basic c3ludGhldGljOnNhbXBsZQ==',
    `{"Authorization":"Bearer ${token}"}`,
    `access_token=${token}`, `{"refresh_token":"${token}"}`,
    "access_token=aaaaaaaaaaaaaaaaaaaa", "refresh_token=bbbbbbbbbbbbbbbbbbbb",
    `AUTHORIZATION: bearer ${token} # gitleaks:allow`,
  ]) {
    assert.ok((await scan(content)).length > 0);
    assert.equal((await evaluateWith()(action(content))).reason, "secret-detected");
  }
  for (const content of [
    "Authorization: Bearer <redacted>", "Authorization: Bearer", "access_token=",
    "refresh_token: null", "access_token: short", "token is mentioned in documentation",
  ]) assert.deepEqual(await scan(content), []);
});

test("detector exceptions, unsafe findings, excessive findings and unsupported content fail closed", async () => {
  for (const detector of [
    () => { throw new Error(email); },
    () => undefined,
    () => [{ ruleId: "email-address", line: 1, value: email }],
    () => [{ ruleId: "email-address", line: 0 }],
    () => Array.from({ length: 4097 }, () => ({ ruleId: "email-address", line: 1 })),
  ]) {
    for (const key of ["personalDataDetector", "labelDetector"]) {
      const result = await evaluateWith({ scanner: async () => [], [key]: detector })(action("hello"));
      assert.equal(result.decision, "error");
      assert.ok(!JSON.stringify(result).includes(email));
    }
  }
  for (const value of [undefined, 123, "\0binary", "\ud800", "é".repeat(40_000)]) {
    assert.throws(() => detectPersonalData(value));
    assert.throws(() => detectInternalLabel(value));
  }
});

test("PII and label reviews never write an outbox artifact or leak into results/receipts", async t => {
  const root = await scratch(t);
  const publish = createPublishDraft({ root, evaluate: evaluateWith() });
  for (const content of [email, "INTERNAL-ONLY: synthetic protected body", `Authorization: Bearer ${token}`]) {
    const result = await publish({ content });
    assert.equal(result.status, "blocked");
    assert.equal(result.execution, "not-started");
    assert.equal(result.artifactPath, undefined);
    const receipt = await readFile(result.receiptPath, "utf8");
    for (const value of [email, token, "synthetic protected body"]) {
      assert.ok(!JSON.stringify(result).includes(value));
      assert.ok(!receipt.includes(value));
    }
    if (content.startsWith("INTERNAL-ONLY")) {
      assert.equal(result.remediation.status, "withheld");
      assert.equal(result.remediation.candidate, undefined);
    } else {
      assert.equal(result.remediation.status, "removed");
      assert.equal((await evaluateWith()(action(result.remediation.candidate.content))).decision, "allow");
    }
  }
  assert.deepEqual(await readdir(root), ["receipts"]);
});

test("gate errors never become review success or sanitized publication, even alongside a block", async t => {
  const root = await scratch(t);
  const publish = createPublishDraft({ root, evaluate: evaluateWith({
    personalDataDetector() { throw new Error(email); },
  }) });
  for (const content of [email, secret]) {
    const result = await publish({ content });
    assert.equal(result.execution, "not-started");
    assert.ok(result.checks.some(check => check.decision === "error"));
    assert.equal(result.remediation, undefined);
    assert.equal(result.artifactPath, undefined);
    assert.ok(!JSON.stringify(result).includes(email));
    assert.ok(!JSON.stringify(result).includes(secret));
  }
  assert.deepEqual(await readdir(root), ["receipts"]);
});

test("a replacement is a distinct action and is checked again before exact-text execution", async t => {
  const root = await scratch(t);
  const seen = [];
  const publish = createPublishDraft({ root, evaluate: evaluateWith({ scanner: async content => {
    seen.push(content);
    return [];
  } }) });
  const denied = await publish({ content: email });
  assert.equal(denied.execution, "not-started");
  assert.deepEqual(await readdir(root), ["receipts"]);
  const candidate = denied.remediation.candidate;
  const accepted = await publish(candidate);
  assert.equal(accepted.status, "published");
  assert.notEqual(accepted.id, denied.id);
  assert.notEqual(accepted.sha256, denied.sha256);
  assert.deepEqual(seen, [email, candidate.content]);
  assert.equal(await readFile(accepted.artifactPath, "utf8"), candidate.content);
  assert.equal((await readdir(join(root, "outbox"))).length, 1);
});

test("record sanitizer removes entire multiline fields and rescans every reusable candidate", async () => {
  const seen = [];
  const sanitize = createRecordTextSanitizer({ scanner: async content => {
    seen.push(content);
    return content.includes("PRIVATE MATERIAL") ? [{ ruleId: "private-key", line: 1 }] : [];
  } });
  const original = "-----BEGIN PRIVATE MATERIAL-----\nsynthetic private body\n-----END PRIVATE MATERIAL-----";
  const result = await sanitize(original);
  assert.equal(result.status, "removed");
  assert.equal(seen.length, 2);
  assert.equal(seen[0], original);
  assert.equal(seen[1], result.candidate.content);
  assert.ok(!JSON.stringify(result).includes("synthetic private body"));
  seen.length = 0;
  const clean = await sanitize("clean display text");
  assert.equal(clean.status, "unchanged");
  assert.deepEqual(seen, ["clean display text", "clean display text"]);
  const withheld = await sanitize("INTERNAL-ONLY\nsynthetic classified body");
  assert.equal(withheld.status, "withheld");
  assert.equal(withheld.candidate, undefined);
});

test("sanitization errors and candidate rescan matches never produce reusable text", async () => {
  for (const scanner of [
    async () => { throw new Error(email); },
    async () => [{ ruleId: "private-key", line: 1 }],
    async () => undefined,
  ]) {
    const result = await createRecordTextSanitizer({ scanner })(email);
    assert.equal(result.status, "error");
    assert.equal(result.candidate, undefined);
    assert.ok(!JSON.stringify(result).includes(email));
  }
  let calls = 0;
  const result = await createRecordTextSanitizer({ scanner: async () => {
    if (++calls === 2) throw new Error(secret);
    return [];
  } })("clean text");
  assert.equal(result.status, "error");
  assert.equal(result.candidate, undefined);
  for (const content of [123, "\0binary", "\ud800", "é".repeat(40_000)]) {
    const invalid = await createRecordTextSanitizer({
      scanner: async () => assert.fail("unsupported text must not reach the scanner"),
    })(content);
    assert.equal(invalid.status, "error");
    assert.equal(invalid.candidate, undefined);
  }
  // Even when a secret block wins aggregation, any broken detector forbids a candidate.
  const mixed = await createRecordTextSanitizer({
    scanner: async () => [{ ruleId: "private-key", line: 1 }],
    labelDetector() { throw new Error(token); },
  })(email);
  assert.equal(mixed.status, "error");
  assert.equal(mixed.candidate, undefined);
});
