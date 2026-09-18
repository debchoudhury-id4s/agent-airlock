import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import dgram from "node:dgram";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import tls from "node:tls";
import { fileURLToPath, pathToFileURL } from "node:url";

const evidenceRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(evidenceRoot, "..", "..", "..", "..");
const pluginRoot = join(repoRoot, "plugins", "AirlockPlugin");
const scannerRelative = join("gates", "secrets", "scanner.mjs");
const pluginFile = name => join(pluginRoot, name);
const url = path => pathToFileURL(path).href;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const encoded = value => `${JSON.stringify(value, null, 2)}\n`;
const audit = { networkAttempts: [], rejectedProcesses: [], rejectedWrites: [], localScannerProcesses: [] };

function inside(root, path) {
  const tail = relative(root, resolve(path));
  return tail === "" || (!tail.startsWith(`..${sep}`) && tail !== ".." && !isAbsolute(tail));
}

function forbidNetwork(api) {
  return () => {
    audit.networkAttempts.push(api);
    throw new Error(`Offline replay forbids network API: ${api}`);
  };
}

function installGuards(runRoot, scannerExecutable, scannerConfig) {
  globalThis.fetch = forbidNetwork("fetch");
  if ("WebSocket" in globalThis) globalThis.WebSocket = forbidNetwork("WebSocket");
  if ("EventSource" in globalThis) globalThis.EventSource = forbidNetwork("EventSource");
  for (const [name, module, methods] of [
    ["http", http, ["request", "get"]],
    ["https", https, ["request", "get"]],
    ["net", net, ["connect", "createConnection"]],
    ["tls", tls, ["connect"]],
    ["dgram", dgram, ["createSocket"]],
    ["dns", dns, Object.keys(dns).filter(key => /^(lookup|resolve|reverse)/.test(key))],
    ["dns.promises", dnsPromises, Object.keys(dnsPromises).filter(key => /^(lookup|resolve|reverse)/.test(key))],
  ]) {
    for (const method of methods) {
      if (typeof module[method] === "function") module[method] = forbidNetwork(`${name}.${method}`);
    }
  }
  net.Socket.prototype.connect = forbidNetwork("net.Socket.connect");

  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (command, args, options) => {
    const scratchRoot = join(dirname(scannerExecutable), "");
    const cwd = options?.cwd;
    const expectedScan = [
      "stdin", "--config", scannerConfig, "--redact=100", "--no-banner", "--no-color",
      "--log-level=error", "--report-format=json", "--report-path=-", "--exit-code=23",
      "--ignore-gitleaks-allow", "--gitleaks-ignore-path", join(cwd ?? runRoot, ".gitleaksignore"),
    ];
    const mode = JSON.stringify(args) === JSON.stringify(["version"]) ? "version"
      : JSON.stringify(args) === JSON.stringify(expectedScan) ? "stdin" : null;
    if (command !== scannerExecutable || !mode || !cwd || !inside(scratchRoot, cwd)
      || !basename(cwd).startsWith("scan-") || options.shell !== false) {
      audit.rejectedProcesses.push("A process outside the local scanner allowlist was rejected.");
      throw new Error("Only the existing local Gitleaks version/stdin commands may execute.");
    }
    assert.ok(Object.keys(options.env).every(key => /^(HOME|USERPROFILE|TMP|TEMP|TMPDIR|SystemRoot|WINDIR)$/i.test(key)));
    const record = { command, args, cwd, shell: false, mode };
    audit.localScannerProcesses.push(record);
    const child = originalSpawn(command, args, options);
    if (mode === "version") {
      let version = "";
      child.stdout.on("data", chunk => { version += chunk.toString("utf8"); });
      child.once("close", () => { record.version = version.trim(); });
    }
    child.once("close", code => { record.exitCode = code; });
    return child;
  };
  for (const method of ["exec", "execSync", "execFile", "execFileSync", "spawnSync", "fork"]) {
    childProcess[method] = () => {
      audit.rejectedProcesses.push(method);
      throw new Error(`Offline replay forbids child_process.${method}.`);
    };
  }

  for (const [method, indices] of [
    ["mkdir", [0]], ["mkdtemp", [0]], ["writeFile", [0]], ["appendFile", [0]],
    ["open", [0]], ["rename", [0, 1]], ["copyFile", [1]], ["rm", [0]], ["unlink", [0]],
  ]) {
    const original = fs[method].bind(fs);
    fs[method] = (...args) => {
      for (const index of indices) {
        const path = args[index] instanceof URL ? fileURLToPath(args[index]) : args[index];
        if (typeof path !== "string" || !inside(runRoot, path) || resolve(path) === runRoot && method === "rm") {
          audit.rejectedWrites.push(method);
          throw new Error(`Offline replay forbids ${method} outside its new run directory.`);
        }
      }
      return original(...args);
    };
  }
  syncBuiltinESMExports();
}

const sourceSpecifications = [
  ["plugins\\AirlockPlugin\\gates\\no-online-writes\\index.mjs", "export function createNoOnlineWritesGate", "createNoOnlineWritesGate"],
  ["plugins\\AirlockPlugin\\gates\\no-online-writes\\index.mjs", "async evaluate(action)", "no-online-writes.evaluate"],
  ["plugins\\AirlockPlugin\\gates\\no-online-writes\\rules.json", "\"id\": \"git-push\"", "trusted git-push rule"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\index.mjs", "function reviewGate", "reviewGate"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\index.mjs", "export function createInternalLabelGate", "createInternalLabelGate"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\index.mjs", "export function createSensitiveInformationGates", "createSensitiveInformationGates"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\internal-label.mjs", "export function detectInternalLabel", "detectInternalLabel"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\personal-data.mjs", "export function detectPersonalData", "detectPersonalData"],
  ["plugins\\AirlockPlugin\\gates\\sensitive-information\\findings.mjs", "export function detectLines", "detectLines"],
  ["plugins\\AirlockPlugin\\gates\\secrets\\index.mjs", "export function createSecretsGate", "sensitive-information's existing secret subgate"],
  ["plugins\\AirlockPlugin\\gates\\secrets\\scanner.mjs", "export async function scan", "scan"],
  ["plugins\\AirlockPlugin\\gates\\secrets\\gitleaks.toml", "useDefault = true", "existing local scanner configuration"],
  ["plugins\\AirlockPlugin\\runtime\\policies.mjs", "export function createPolicyEvaluator", "createPolicyEvaluator"],
  ["plugins\\AirlockPlugin\\runtime\\policies.mjs", "const decisive =", "block > error > ask-first > allow"],
  ["plugins\\AirlockPlugin\\runtime\\broker.mjs", "export function createBroker", "createBroker"],
  ["plugins\\AirlockPlugin\\runtime\\broker.mjs", "if (denied) return", "non-allow returns before executor"],
  ["plugins\\AirlockPlugin\\runtime\\hook-enforcement.mjs", "export function describePotentialOnlineWrite", "describePotentialOnlineWrite"],
  ["plugins\\AirlockPlugin\\runtime\\hook-enforcement.mjs", "export async function decidePreToolUse", "decidePreToolUse"],
  ["plugins\\AirlockPlugin\\runtime\\session-state.mjs", "export async function saveMissionState", "saveMissionState"],
  ["plugins\\AirlockPlugin\\runtime\\plain-text.mjs", "export function isSupportedText", "isSupportedText"],
  ["plugins\\AirlockPlugin\\runtime\\sanitize-record-text.mjs", "export function createRecordTextSanitizer", "createRecordTextSanitizer (not invoked)"],
  ["plugins\\AirlockPlugin\\runtime\\airlock.mjs", "export const evaluateAirlockPolicy", "installed composition root (not invoked)"],
  ["plugins\\AirlockPlugin\\tools\\check-intent.mjs", "export function createCheckIntent", "createCheckIntent"],
  ["plugins\\AirlockPlugin\\tools\\publish-draft.mjs", "export function createPublishDraft", "createPublishDraft"],
  ["plugins\\AirlockPlugin\\policies\\default.json", "\"publish_draft\":", "installed sensitive-information bindings"],
  ["plugins\\AirlockPlugin\\policies\\default.json", "\"check_intent\":", "installed no-online-writes binding"],
  ["plugins\\AirlockPlugin\\hooks\\hooks.json", "\"preToolUse\":", "preToolUse registration"],
  ["plugins\\AirlockPlugin\\hooks\\pre-tool-use.mjs", "emit(await decidePreToolUse", "hook adapter (not launched)"],
  ["plugins\\AirlockPlugin\\hooks\\user-prompt-submitted.mjs", "const intentResult = await checkIntent", "prompt adapter (not launched)"],
  ["sandbox\\scripts\\configure.mjs", "export async function loadConfiguration", "loadConfiguration (read only)"],
  ["sandbox\\configurations\\base.json", "\"allowBypass\":", "base allows bypass"],
  ["sandbox\\configurations\\overrides\\developer.json", "\"allowOutbound\":", "developer permits outbound"],
  ["sandbox\\configurations\\overrides\\restricted.json", "\"allowOutbound\":", "restricted disables outbound in configuration"],
  ["docs\\prd.md", "**POC limits:**", "PRD local simulation scope"],
  ["docs\\prd.md", "Only supported tools routed through Airlock", "PRD coverage limit"],
  ["docs\\prd.md", "Require approval for every simulated online write", "PRD approval requirement, not implemented by these gates"],
];

async function sourceProvenance() {
  const files = new Map();
  for (const [path] of sourceSpecifications) {
    if (!files.has(path)) files.set(path, await fs.readFile(join(repoRoot, path)));
  }
  const binary = "plugins\\AirlockPlugin\\.tools\\gitleaks.exe";
  files.set(binary, await fs.readFile(join(repoRoot, binary)));
  const sources = [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const locations = sourceSpecifications.map(([path, anchor, symbol]) => {
    const lines = files.get(path).toString("utf8").split(/\r?\n/);
    const index = lines.findIndex(line => line.includes(anchor));
    assert.notEqual(index, -1, `Source anchor missing: ${path}: ${anchor}`);
    return { path, symbol, line: index + 1, excerpt: lines.slice(index, index + 5).join("\n") };
  });
  const decidingExcerpts = [
    ["plugins\\AirlockPlugin\\gates\\no-online-writes\\index.mjs", "createNoOnlineWritesGate.evaluate"],
    ["plugins\\AirlockPlugin\\gates\\sensitive-information\\index.mjs", "reviewGate.evaluate"],
  ].map(([path, symbol]) => {
    const lines = files.get(path).toString("utf8").split(/\r?\n/);
    const start = lines.findIndex(line => line.includes("async evaluate(action)"));
    assert.notEqual(start, -1, `Deciding function missing: ${path}`);
    const end = lines.findIndex((line, index) => index > start && line === "    },");
    assert.notEqual(end, -1, `Deciding function end missing: ${path}`);
    return { path, symbol, startLine: start + 1, endLine: end + 1, excerpt: lines.slice(start, end + 1).join("\n") };
  });
  return { sources, locations, decidingExcerpts };
}

async function main() {
  assert.equal(process.argv.length, 2, "This replay accepts no commands, endpoints, or executor arguments.");
  assert.equal(evidenceRoot, join(repoRoot, "demo", "2026-09-17", "debchoudhury", "film-evidence"));
  assert.equal((await fs.realpath(evidenceRoot)).toLowerCase(), evidenceRoot.toLowerCase(), "Evidence directory must not be a junction.");
  const startedAt = new Date().toISOString();
  const runRoot = join(evidenceRoot, "runs", `${startedAt.replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(runRoot, { recursive: true });
  const scannerCopyRoot = join(runRoot, "scanner-runtime-copy");
  const scannerCopy = join(scannerCopyRoot, scannerRelative);
  const scannerConfig = join(dirname(scannerCopy), "gitleaks.toml");
  const scannerExecutable = join(scannerCopyRoot, ".tools", "gitleaks.exe");
  installGuards(runRoot, scannerExecutable, scannerConfig);
  const saveJson = (name, value) => fs.writeFile(join(runRoot, name), encoded(value), { flag: "wx" });
  const fixtures = JSON.parse(await fs.readFile(join(evidenceRoot, "fixtures.json"), "utf8"));
  assert.equal(fixtures.synthetic, true);
  const provenance = await sourceProvenance();
  await fs.mkdir(dirname(scannerCopy), { recursive: true });
  await fs.mkdir(dirname(scannerExecutable), { recursive: true });
  const relocations = [];
  for (const [source, destination] of [
    [pluginFile(scannerRelative), scannerCopy],
    [pluginFile("gates\\secrets\\gitleaks.toml"), scannerConfig],
    [pluginFile(".tools\\gitleaks.exe"), scannerExecutable],
  ]) {
    await fs.copyFile(source, destination, 1);
    const original = await fs.readFile(source);
    const copied = await fs.readFile(destination);
    assert.deepEqual(copied, original);
    relocations.push({ source, destination, sha256: sha256(original), byteIdentical: true });
  }
  const sourceScannerUrl = url(pluginFile(scannerRelative));
  const copiedScannerUrl = url(scannerCopy);
  // The unchanged scanner fixes its scratch path relative to import.meta.url.
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context.parentURL === copiedScannerUrl && specifier === "zod"
        ? { ...context, parentURL: sourceScannerUrl } : context);
      assert.ok(result.url.startsWith("file:") || result.url.startsWith("node:"), "Only local modules are permitted.");
      return result.url === sourceScannerUrl ? { ...result, url: copiedScannerUrl } : result;
    },
  });

  const [
    { createNoOnlineWritesGate }, { createSensitiveInformationGates }, { createPolicyEvaluator },
    { createCheckIntent }, { createPublishDraft }, { createBroker }, { decidePreToolUse },
    { saveMissionState, loadMissionState }, { loadConfiguration },
  ] = await Promise.all([
    import(url(pluginFile("gates\\no-online-writes\\index.mjs"))),
    import(url(pluginFile("gates\\sensitive-information\\index.mjs"))),
    import(url(pluginFile("runtime\\policies.mjs"))),
    import(url(pluginFile("tools\\check-intent.mjs"))),
    import(url(pluginFile("tools\\publish-draft.mjs"))),
    import(url(pluginFile("runtime\\broker.mjs"))),
    import(url(pluginFile("runtime\\hook-enforcement.mjs"))),
    import(url(pluginFile("runtime\\session-state.mjs"))),
    import(url(join(repoRoot, "sandbox", "scripts", "configure.mjs"))),
  ]);
  const installedPolicy = JSON.parse(await fs.readFile(pluginFile("policies\\default.json"), "utf8"));
  const policy = {
    id: "offline-two-gate-replay", version: "1",
    tools: { check_intent: installedPolicy.tools.check_intent, publish_draft: installedPolicy.tools.publish_draft },
  };
  const evaluate = createPolicyEvaluator({
    policy, gates: [createNoOnlineWritesGate(), ...createSensitiveInformationGates()],
  });
  const root = join(runRoot, "runtime-records");
  const check = createCheckIntent({ root, evaluate });
  const publishLocal = createPublishDraft({ root, evaluate });
  const broker = createBroker({ root, evaluate });
  const safeIntent = await check(fixtures.safeIntent);
  assert.equal(safeIntent.status, "cleared");
  assert.equal(safeIntent.decision, "allow");
  assert.equal(safeIntent.reason, "no-online-write-match");
  const sessionId = `offline-film-replay-${randomUUID()}`;
  const missionInput = {
    sessionId, decision: safeIntent.decision, reason: safeIntent.reason,
    promptTimestamp: Date.parse(startedAt), policy: safeIntent.policy,
    policyVersion: safeIntent.policyVersion, policySha256: safeIntent.policySha256,
  };
  const missionPath = await saveMissionState(missionInput, root);
  const mission = await loadMissionState(sessionId, root);
  assert.deepEqual(mission, missionInput);
  const safeDraft = await publishLocal(fixtures.safeDraft);
  assert.equal(safeDraft.status, "published");
  assert.equal(safeDraft.decision, "allow");
  assert.equal(safeDraft.reason, "all-gates-passed");
  assert.equal(await fs.readFile(safeDraft.artifactPath, "utf8"), fixtures.safeDraft.content);

  const event = {
    sessionId, timestamp: Date.now(), cwd: runRoot,
    toolName: fixtures.proposedOutbound.toolName, toolArgs: fixtures.proposedOutbound.toolArgs,
  };
  let outboundCheck;
  const hookOutput = await decidePreToolUse({
    event, mission,
    check: async input => {
      const output = await check(input);
      outboundCheck = { input, output };
      return output;
    },
  });
  assert.deepEqual(hookOutput, {
    permissionDecision: "deny",
    permissionDecisionReason: "Blocked by Airlock policy: online-write-intent",
  });
  assert.equal(outboundCheck.output.decision, "block");
  assert.equal(outboundCheck.output.execution, "not-started");
  assert.deepEqual(outboundCheck.output.findings, [{ ruleId: "git-push", line: 1 }]);
  // Evaluation plus a runtime receipt only: no executor is supplied for the held payload.
  const held = await broker(fixtures.sensitiveAction);
  assert.equal(held.decision, "ask-first");
  assert.equal(held.status, "blocked");
  assert.equal(held.reason, "approval-required");
  assert.equal(held.execution, "not-started");
  assert.equal(held.artifactPath, undefined);
  assert.deepEqual(held.checks.map(check => [check.gate, check.decision, check.reason]), [
    ["no-secrets-in-drafts", "allow", "no-secret-match"],
    ["personal-data-review", "allow", "no-personal-data-match"],
    ["internal-label-review", "ask-first", "internal-label-detected"],
  ]);
  assert.deepEqual(held.findings, [{ ruleId: "internal-only-label", line: 1 }]);

  const cases = [
    { id: "local-intent", invocation: "createCheckIntent({root,evaluate})(input)", input: fixtures.safeIntent, output: safeIntent },
    { id: "local-work", invocation: "createPublishDraft({root,evaluate})(input)", input: fixtures.safeDraft, output: safeDraft },
    { id: "outbound-evaluation-only", invocation: "decidePreToolUse({event,mission,check})", input: event, output: hookOutput, checkIntent: outboundCheck },
    { id: "sensitive-evaluation-only", invocation: "createBroker({root,evaluate})(action) - executor omitted", input: fixtures.sensitiveAction, output: held },
  ];
  const receiptChecks = [];
  for (const [result, expectedEvents] of [
    [safeIntent, ["allowed", "completed"]], [safeDraft, ["allowed", "completed"]],
    [outboundCheck.output, ["blocked"]], [held, ["blocked"]],
  ]) {
    assert.ok(inside(root, result.receiptPath));
    const bytes = await fs.readFile(result.receiptPath);
    const rows = bytes.toString("utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(rows.map(row => row.event), expectedEvents);
    assert.ok(rows.every(row => row.id === result.id && row.policySha256 === result.policySha256));
    assert.ok(!bytes.includes(Buffer.from(fixtures.proposedOutbound.toolArgs.command)));
    assert.ok(!bytes.includes(Buffer.from("pretend conveyor")));
    receiptChecks.push({
      path: result.receiptPath, producer: "existing runtime\\broker.mjs",
      sha256: sha256(bytes), events: expectedEvents, records: rows,
    });
  }
  assert.equal((await fs.readdir(join(root, "outbox"))).length, 1);
  assert.equal((await fs.readdir(join(root, "cleared-intents"))).length, 1);
  assert.equal((await fs.readdir(join(root, "receipts"))).length, 4);
  assert.deepEqual(await fs.readdir(dirname(scannerExecutable)), ["gitleaks.exe"]);
  assert.deepEqual(audit.networkAttempts, []);
  assert.deepEqual(audit.rejectedProcesses, []);
  assert.deepEqual(audit.rejectedWrites, []);
  assert.equal(audit.localScannerProcesses.length, 4);
  assert.ok(audit.localScannerProcesses.every(process => process.exitCode === 0));
  const sandbox = {
    invocation: "loadConfiguration(['developer']) / loadConfiguration(['restricted'])",
    developer: await loadConfiguration(["developer"]),
    restricted: await loadConfiguration(["restricted"]),
    applied: false, liveSandboxVerified: false,
  };
  assert.equal(sandbox.developer.sandbox.userPolicy.network.allowOutbound, true);
  assert.equal(sandbox.restricted.sandbox.userPolicy.network.allowOutbound, false);
  assert.equal(sandbox.restricted.sandbox.allowBypass, true);
  assert.deepEqual((await sourceProvenance()).sources, provenance.sources, "Product source changed during replay.");

  const report = {
    kind: "offline-runtime-gate-replay", liveAgencyFootage: false,
    startedAt, completedAt: new Date().toISOString(), node: process.version, runRoot,
    reproductionCommand: `node "${join(evidenceRoot, "replay.mjs")}"`,
    capabilities: ["plugins\\AirlockPlugin\\gates\\no-online-writes", "plugins\\AirlockPlugin\\gates\\sensitive-information"],
    syntheticFixturesOnly: true,
    policy: {
      installedSource: "plugins\\AirlockPlugin\\policies\\default.json",
      installedId: installedPolicy.id, installedVersion: installedPolicy.version,
      replayPolicy: policy, sha256: safeIntent.policySha256,
      scope: "Exactly the two installed tool bindings, under an explicitly different replay policy identity. No added or replaced gate decisions.",
    },
    scanner: {
      mode: "Existing local Gitleaks, unchanged scanner source/config/binary relocated to contain all scratch writes.",
      expectedVersion: "8.30.1", relocations, verdictsStubbed: false,
    },
    cases,
    missionState: { path: missionPath, producer: "existing runtime\\session-state.mjs", input: missionInput, loaded: mission, liveSession: false },
    receipts: receiptChecks,
    sandbox,
    ownershipAndLimits: [
      "Host/plugin authors supply versioned local policy JSON, reviewed regex rules, and trusted gate registrations. No organizational identity or administrator activation is demonstrated.",
      "The evaluator freezes tool bindings and gate functions; callers cannot select gates through these strict tool inputs. Blocks take precedence over errors, ask-first, and allow.",
      "The broker writes a local decision receipt before its local executor. Non-allow returns without an executor call; receipt failure also stops execution.",
      "The supplied sensitive payload has no executor at all. The outbound command is only a string given to the hook/check_intent APIs. It is never given to a shell.",
      "No-online-writes matches listed regex patterns; it is not a comprehensive network-command classifier. This replay tests git-push, not universal outbound blocking.",
      "Sensitive-information composes real local secret, bounded personal-data, and literal INTERNAL-ONLY checks. No classifier model or network model call is used.",
      "The sensitive gate returns ask-first/internal-label-detected. The broker converts this to blocked/approval-required because shared approval flow is not implemented.",
      "A successful publish_draft only copies text into a local outbox. No real send, PR, upload, API mutation, or cloud action is implemented or invoked by this replay.",
      "The hook relies on matching persisted mission state and recognized tool/service names. An empty hook result defers to normal host permissions; it does not mean universal authorization.",
      "The installed prompt hook also uses trending-cost, but that unrelated path is not run here. Direct local API replay does not prove live hook installation or timing.",
      "PRD simulated per-action approvals and general mission contracts are broader than this implementation. No reviewer approval, expiry, consumption, or org-wide control is demonstrated.",
      "No /yolo resistance is demonstrated. Matching a forbidden text pattern despite added wording would not establish bypass-proof enforcement.",
      "Sandbox code is a settings configurator. Developer permits outbound; restricted disables it in configuration but inherits allowBypass=true. No settings were applied and no live OS sandbox was tested.",
      "Policy SHA-256 fingerprints the replay policy JSON, not a signed organization policy or the whole gate implementation. Separate source hashes identify the code/rules used.",
      "Runtime receipts retain action hashes, rule IDs, line numbers, decisions and reasons, not raw payloads. They are local demo evidence, not tamper-proof or compliance-certified records.",
      "Harness network/process/write guards are replay containment checks, not a claim that Airlock is an OS security boundary.",
    ],
    safeStoryOptions: [
      "An imaginary workshop maintenance rehearsal: permit the local checklist draft, then hold an INTERNAL-ONLY note for review.",
      "A synthetic developer handoff: clear local preparation, then show a proposed branch push denied without contacting a remote.",
    ],
    safety: {
      onlineMutations: 0, outboundCommandsExecuted: 0, outboundExecutorsRegistered: 0,
      settingsApplied: false, dependenciesInstalled: false, sourceHashesUnchanged: true,
      onlySubprocesses: "Existing local Gitleaks version and stdin scans",
      guardScope: "Replay process APIs; no OS packet capture or live sandbox assertion",
      ...audit,
    },
    artifactOwnership: {
      productWritten: [missionPath, safeIntent.artifactPath, safeDraft.artifactPath, ...receiptChecks.map(receipt => receipt.path)],
      harnessWritten: ["evidence.json", "transcript.txt", "inputs.json", "policy.json", "source-provenance.json"],
      note: "The .md file is an actual product-created local draft, not a documentation report. Harness JSON/text is never labelled a product receipt.",
    },
  };
  await saveJson("inputs.json", fixtures);
  await saveJson("policy.json", policy);
  await saveJson("source-provenance.json", { ...provenance, harnessSha256: sha256(await fs.readFile(fileURLToPath(import.meta.url))) });
  await saveJson("evidence.json", report);
  const transcript = [
    "OFFLINE GATE REPLAY - NOT LIVE AGENCY FOOTAGE",
    report.reproductionCommand,
    `Node: ${process.version}`,
    "Only local Gitleaks version/stdin subprocesses; no outbound executor exists.",
    "Product scanner/config/binary copied byte-for-byte to keep scratch files inside this run.",
    "",
    ...cases.flatMap(item => [
      `CASE ${item.id}`, `CALL ${item.invocation}`, `INPUT ${encoded(item.input).trim()}`,
      `OUTPUT ${encoded(item.output).trim()}`,
      ...(item.checkIntent ? [`NESTED CHECK_INTENT ${encoded(item.checkIntent).trim()}`] : []),
      "",
    ]),
    ...receiptChecks.flatMap(receipt => [`RUNTIME RECEIPT ${receipt.path}`, ...receipt.records.map(JSON.stringify), ""]),
    "LIMITS",
    ...report.ownershipAndLimits,
    "",
    "Zero outbound commands, zero online mutations. No real incident or secret data.",
  ].join("\n");
  await fs.writeFile(join(runRoot, "transcript.txt"), `${transcript}\n`, { flag: "wx" });
  console.log(encoded({
    outcome: "Two-gate offline replay completed",
    runRoot, evidence: join(runRoot, "evidence.json"), transcript: join(runRoot, "transcript.txt"),
    localIntent: { decision: safeIntent.decision, status: safeIntent.status, reason: safeIntent.reason },
    localWork: { decision: safeDraft.decision, status: safeDraft.status, reason: safeDraft.reason, artifactPath: safeDraft.artifactPath },
    outbound: { decision: outboundCheck.output.decision, reason: outboundCheck.output.reason, execution: outboundCheck.output.execution, hook: hookOutput },
    sensitive: { decision: held.decision, reason: held.reason, checks: held.checks, execution: held.execution },
    runtimeReceipts: receiptChecks.length, onlineMutations: 0, outboundCommandsExecuted: 0,
  }));
}

main().catch(error => {
  console.error(`Offline replay failed: ${error.stack}`);
  process.exitCode = 1;
});
