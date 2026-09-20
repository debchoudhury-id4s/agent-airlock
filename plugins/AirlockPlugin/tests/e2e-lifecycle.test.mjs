import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(pluginRoot, "../..");
const sandboxScript = join(repositoryRoot, "sandbox", "scripts", "configure.mjs");

async function scratch(t, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function isolatedEnvironment(home) {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    COPILOT_HOME: join(home, ".copilot"),
  };
}

function runNode(script, input, { cwd, env }) {
  const child = spawnSync(process.execPath, [script], {
    cwd,
    env,
    input: JSON.stringify(input),
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  return child.stdout.trim()
    ? child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line))
    : [];
}

function promptEvent(sessionId, cwd, prompt) {
  return { sessionId, timestamp: Date.now(), cwd, prompt };
}

function toolEvent(sessionId, cwd, toolName, toolArgs) {
  return { sessionId, timestamp: Date.now(), cwd, toolName, toolArgs };
}

async function createUsageStore(home) {
  const directory = join(home, ".copilot");
  await mkdir(directory, { recursive: true });
  const path = join(directory, "session-store.db");
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TABLE assistant_usage_events (
      created_at TEXT,
      total_nano_aiu INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      reasoning_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER
    )`);
    db.prepare("INSERT INTO assistant_usage_events VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), 1_000_000_000, 100, 20, 5, 10, 2);
  } finally {
    db.close();
  }
}

function sessionStatePath(home, sessionId) {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(home, ".agent-airlock", "outbound-demo", "sessions", `${key}.json`);
}

test("automatic hooks enforce one mission from prompt through session end", async t => {
  const home = await scratch(t, "airlock-e2e-home-");
  const workspace = await scratch(t, "airlock-e2e-workspace-");
  const env = isolatedEnvironment(home);
  const sessionId = "e2e-safe-mission";
  await createUsageStore(home);

  const promptOutput = runNode(
    join(pluginRoot, "hooks", "user-prompt-submitted.mjs"),
    promptEvent(sessionId, workspace, "Review README.md locally and suggest tests."),
    { cwd: workspace, env },
  );
  assert.match(promptOutput[0].message, /Trending cost/);
  assert.equal(promptOutput.at(-1).message, "Airlock cleared the mission");
  assert.equal(JSON.parse(await readFile(sessionStatePath(home, sessionId), "utf8")).decision, "allow");

  const localTool = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(sessionId, workspace, "view", { path: "README.md" }),
    { cwd: workspace, env },
  );
  assert.deepEqual(localTool, [{}]);

  const directOnlineWrite = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(sessionId, workspace, "teams-SendMessageToChat", { message: "synthetic test" }),
    { cwd: workspace, env },
  );
  assert.equal(directOnlineWrite[0].permissionDecision, "deny");
  assert.match(directOnlineWrite[0].permissionDecisionReason, /direct-online-write/);

  runNode(
    join(pluginRoot, "hooks", "session-end.mjs"),
    { sessionId },
    { cwd: workspace, env },
  );
  await assert.rejects(readFile(sessionStatePath(home, sessionId), "utf8"), { code: "ENOENT" });

  const afterEnd = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(sessionId, workspace, "view", { path: "README.md" }),
    { cwd: workspace, env },
  );
  assert.match(afterEnd[0].permissionDecisionReason, /mission-state-missing/);
});

test("prompt and shell rechecks block online writes even with yolo", async t => {
  const home = await scratch(t, "airlock-e2e-home-");
  const workspace = await scratch(t, "airlock-e2e-workspace-");
  const env = isolatedEnvironment(home);
  await createUsageStore(home);

  const blockedSession = "e2e-blocked-prompt";
  const blockedPrompt = runNode(
    join(pluginRoot, "hooks", "user-prompt-submitted.mjs"),
    promptEvent(blockedSession, workspace, "/yolo git push origin main"),
    { cwd: workspace, env },
  );
  assert.match(blockedPrompt.at(-1).message, /online-write-intent/);
  const blockedTool = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(blockedSession, workspace, "view", { path: "README.md" }),
    { cwd: workspace, env },
  );
  assert.equal(blockedTool[0].permissionDecision, "deny");
  assert.match(blockedTool[0].permissionDecisionReason, /online-write-intent/);

  const shellSession = "e2e-shell-recheck";
  runNode(
    join(pluginRoot, "hooks", "user-prompt-submitted.mjs"),
    promptEvent(shellSession, workspace, "Review the repository locally."),
    { cwd: workspace, env },
  );
  const blockedShell = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(shellSession, workspace, "functions.powershell", { command: "git push origin main" }),
    { cwd: workspace, env },
  );
  assert.equal(blockedShell[0].permissionDecision, "deny");
  assert.match(blockedShell[0].permissionDecisionReason, /online-write-intent/);
});

test("RFC advice is visible without becoming execution permission", async t => {
  const home = await scratch(t, "airlock-e2e-home-");
  const workspace = await scratch(t, "airlock-e2e-workspace-");
  const output = runNode(
    join(pluginRoot, "hooks", "rfc-relevance.mjs"),
    promptEvent("e2e-rfc", workspace, "Design bearer token authentication for this API."),
    { cwd: workspace, env: isolatedEnvironment(home) },
  );
  assert.equal(output.length, 2);
  assert.match(output[0].message, /RFC6750/);
  assert.match(output[0].message, /RFC9700/);
  assert.deepEqual(output[1], {});
});

test("restricted sandbox remains authoritative after Airlock allows a local request", async t => {
  const home = await scratch(t, "airlock-e2e-home-");
  const workspace = await scratch(t, "airlock-e2e-workspace-");
  const env = isolatedEnvironment(home);
  await createUsageStore(home);

  const configured = spawnSync(process.execPath, [
    sandboxScript, "--scope", "repo", "--override", "restricted", "--apply", "--yes",
  ], {
    cwd: workspace,
    env,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(configured.status, 0, configured.stderr);
  const settings = JSON.parse(await readFile(
    join(workspace, ".github", "copilot", "settings.json"),
    "utf8",
  ));
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(settings.sandbox.userPolicy.network.allowOutbound, false);

  const sessionId = "e2e-sandbox-layering";
  runNode(
    join(pluginRoot, "hooks", "user-prompt-submitted.mjs"),
    promptEvent(sessionId, workspace, "Inspect a public documentation page without changing it."),
    { cwd: workspace, env },
  );
  const airlockDecision = runNode(
    join(pluginRoot, "hooks", "pre-tool-use.mjs"),
    toolEvent(sessionId, workspace, "functions.powershell", {
      command: "Invoke-WebRequest https://example.test",
    }),
    { cwd: workspace, env },
  );
  assert.deepEqual(airlockDecision, [{}]);
});

test("dependency-risk MCP blocks the synthetic version and records only a receipt", async t => {
  const home = await scratch(t, "airlock-e2e-home-");
  const workspace = await scratch(t, "airlock-e2e-workspace-");
  const client = new Client({ name: "airlock-e2e", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(pluginRoot, "server.mjs")],
    cwd: workspace,
    env: isolatedEnvironment(home),
    stderr: "pipe",
  });
  let result;
  try {
    await client.connect(transport);
    result = await client.callTool({
      name: "review_dependency_change",
      arguments: {
        packageName: "Microsoft.Identity.Client",
        version: "4.88.0-airlock-demo",
      },
    });
  } finally {
    await client.close();
  }
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.status, "blocked");
  assert.equal(result.structuredContent.reason, "dependency-version-blocked");
  assert.equal(result.structuredContent.execution, "not-started");
  assert.equal(result.structuredContent.artifactPath, undefined);
  assert.ok(result.structuredContent.receiptPath.startsWith(home));

  const root = join(home, ".agent-airlock", "outbound-demo");
  assert.deepEqual(await readdir(root), ["receipts"]);
  const receipt = await readFile(result.structuredContent.receiptPath, "utf8");
  assert.match(receipt, /AIRLOCK-DEMO-001/);
  assert.doesNotMatch(receipt, /Microsoft\.Identity\.Client/);
});
