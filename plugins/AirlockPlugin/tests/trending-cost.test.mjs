import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createTrendingCostGate } from "../gates/trending-cost/index.mjs";
import {
  defaultSessionStorePath,
  readTrendingCost,
  trendingCostBounds,
} from "../gates/trending-cost/usage.mjs";
import { runTrendingCostHook } from "../hooks/trending-cost.mjs";
import { createPolicyEvaluator } from "../runtime/policies.mjs";
import { createTrendingCost } from "../tools/trending-cost.mjs";
import { pluginRoot } from "../gates/secrets/scanner.mjs";
import policy from "../policies/trending-cost.json" with { type: "json" };

async function scratch(t) {
  const root = await mkdtemp(join(tmpdir(), "airlock-trending-cost-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function createStore(home, rows) {
  const dbPath = defaultSessionStorePath(home);
  await mkdir(join(home, ".copilot"), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec(`
    CREATE TABLE assistant_usage_events (
      created_at TEXT,
      total_nano_aiu INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      reasoning_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER
    )
  `);
  const insert = database.prepare(`
    INSERT INTO assistant_usage_events (
      created_at, total_nano_aiu, input_tokens, output_tokens,
      reasoning_tokens, cache_read_tokens, cache_write_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of rows) {
    insert.run(
      row.createdAt,
      row.nanoAiu,
      row.inputTokens,
      row.outputTokens,
      row.reasoningTokens,
      row.cacheReadTokens,
      row.cacheWriteTokens,
    );
  }
  database.close();
  return dbPath;
}

function event(createdAt, nanoAiu, inputTokens, outputTokens, reasoningTokens = 0) {
  return {
    createdAt,
    nanoAiu,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens: Math.floor(inputTokens / 2),
    cacheWriteTokens: Math.floor(inputTokens / 10),
  };
}

function configured(overrides = {}) {
  return { ...policy, settings: { ...policy.settings, ...overrides } };
}

function evaluator(policyConfig) {
  return createPolicyEvaluator({
    policy: policyConfig,
    gates: [createTrendingCostGate({ settings: policyConfig.settings })],
  });
}

test("reads month-to-date and current-day aggregates using local calendar boundaries", async t => {
  const home = await scratch(t);
  const now = new Date(2026, 8, 15, 22, 0, 0, 0);
  const bounds = trendingCostBounds(now);
  const dbPath = await createStore(home, [
    event(new Date(bounds.monthStart.getTime() - 1_000).toISOString(), 99_000_000_000, 900, 90),
    event(new Date(2026, 8, 2, 12, 0, 0).toISOString(), 10_000_000_000, 100, 10, 1),
    event(new Date(2026, 8, 15, 1, 0, 0).toISOString(), 20_000_000_000, 200, 20, 2),
    event(new Date(now.getTime() - 60_000).toISOString(), 5_000_000_000, 50, 5, 1),
    event(now.toISOString(), 77_000_000_000, 700, 70),
  ]);

  const report = readTrendingCost({ dbPath, now, usdPerAiu: 0.01 });
  assert.equal(report.available, true);
  assert.equal(report.monthToDate.nanoAiu, 35_000_000_000);
  assert.equal(report.monthToDate.costUsd, 0.35);
  assert.equal(report.monthToDate.requests, 3);
  assert.equal(report.today.nanoAiu, 25_000_000_000);
  assert.equal(report.today.costUsd, 0.25);
  assert.equal(report.today.requests, 2);
  assert.equal(report.today.inputTokens, 250);
  assert.equal(report.today.outputTokens, 25);
  assert.equal(report.today.totalTokens, 275);
  assert.equal(report.today.reasoningTokens, 3);
  assert.equal(report.monthStartDate, "2026-09-01");
  assert.equal(report.todayDate, "2026-09-15");
});

test("missing or incompatible local stores are reported explicitly without creating a database", async t => {
  const home = await scratch(t);
  const missing = defaultSessionStorePath(home);
  const report = readTrendingCost({ dbPath: missing, now: new Date() });
  assert.deepEqual(report.reason, "session-store-missing");
  await assert.rejects(readFile(missing));

  await mkdir(join(home, ".copilot"), { recursive: true });
  const database = new DatabaseSync(missing);
  database.exec("CREATE TABLE assistant_usage_events (created_at TEXT)");
  database.close();
  assert.equal(readTrendingCost({ dbPath: missing }).reason, "unsupported-session-store-schema");
});

test("advisory mode reports an overage; enforce mode blocks at or above the threshold", async t => {
  const home = await scratch(t);
  const now = new Date(2026, 8, 15, 22, 0, 0);
  const dbPath = await createStore(home, [
    event(new Date(now.getTime() - 60_000).toISOString(), 80_000_000_000_000, 1_000, 100),
  ]);
  const report = readTrendingCost({ dbPath, now, usdPerAiu: 0.01 });

  const advisoryPolicy = configured();
  const advisory = await evaluator(advisoryPolicy)({
    tool: "trending_cost", target: "local-copilot-session-store", input: { report },
  });
  assert.equal(advisory.decision, "allow");
  assert.equal(advisory.reason, "month-to-date-cost-limit-advisory");

  const enforcePolicy = configured({ mode: "enforce" });
  const blocked = await evaluator(enforcePolicy)({
    tool: "trending_cost", target: "local-copilot-session-store", input: { report },
  });
  assert.equal(blocked.decision, "block");
  assert.equal(blocked.reason, "month-to-date-cost-limit");

  const higherLimit = configured({ mode: "enforce", monthToDateLimitUsd: 800.01 });
  assert.equal((await evaluator(higherLimit)({
    tool: "trending_cost", target: "local-copilot-session-store", input: { report },
  })).decision, "allow");
});

test("unavailable usage follows the reviewed allow-or-block setting", async () => {
  const report = {
    available: false,
    source: "copilot-cli-local-session-store",
    generatedAt: new Date().toISOString(),
    reason: "session-store-missing",
  };
  const advisory = configured({ mode: "advisory", unavailableBehavior: "block" });
  assert.equal((await evaluator(advisory)({
    tool: "trending_cost", target: "local-copilot-session-store", input: { report },
  })).decision, "allow");
  const enforce = configured({ mode: "enforce", unavailableBehavior: "block" });
  assert.equal((await evaluator(enforce)({
    tool: "trending_cost", target: "local-copilot-session-store", input: { report },
  })).reason, "trending-cost-unavailable");
});

test("the prompt hook always prints the report and blocks only in enforce mode", async t => {
  const home = await scratch(t);
  const now = new Date(2026, 8, 15, 22, 0, 0);
  const dbPath = await createStore(home, [
    event(new Date(now.getTime() - 60_000).toISOString(), 80_000_000_000_000, 1_000, 100, 25),
  ]);
  const report = readTrendingCost({ dbPath, now, usdPerAiu: 0.01 });

  for (const [policyConfig, expected] of [
    [configured(), {}],
    [configured({ mode: "enforce" }), { decision: "block" }],
  ]) {
    const chunks = [];
    const result = await runTrendingCostHook({
      policyConfig,
      readUsage: async () => report,
      write: text => chunks.push(text),
    });
    const lines = chunks.join("").trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(lines[0].type, "progress");
    assert.match(lines[0].message, /MTD 2026-09-01-now: \$800\.00/);
    assert.match(lines[0].message, /Today tokens: 1,100/);
    assert.equal(lines[1].decision, expected.decision);
    assert.equal(result.output.decision, expected.decision);
  }
});

test("the report tool uses the policy engine and writes only a local receipt", async t => {
  const root = await scratch(t);
  const now = new Date(2026, 8, 15, 22, 0, 0);
  const report = {
    available: false,
    source: "copilot-cli-local-session-store",
    generatedAt: now.toISOString(),
    reason: "session-store-missing",
  };
  const policyConfig = configured();
  const tool = createTrendingCost({
    root,
    evaluate: evaluator(policyConfig),
    readUsage: async () => report,
    settings: policyConfig.settings,
  });
  const result = await tool({});
  assert.equal(result.status, "reported");
  assert.equal(result.policySettings.mode, "advisory");
  assert.equal(result.policySettings.monthToDateLimitUsd, 800);
  assert.equal(result.report.reason, "session-store-missing");
  assert.ok(result.receiptPath.startsWith(root));
  assert.doesNotMatch(await readFile(result.receiptPath, "utf8"), /session-store-missing/);
  assert.equal((await tool({ threshold: 0 })).reason, "invalid-input");
});

test("plugin hook registration targets every submitted prompt and the executable emits valid output", async t => {
  const config = JSON.parse(await readFile(join(pluginRoot, "hooks", "hooks.json"), "utf8"));
  assert.deepEqual(Object.keys(config.hooks), ["userPromptSubmitted"]);
  assert.equal(config.hooks.userPromptSubmitted.length, 1);
  assert.equal(config.hooks.userPromptSubmitted[0].matcher, undefined);

  const home = await scratch(t);
  const now = new Date();
  await createStore(home, [
    event(new Date(now.getTime() - 1_000).toISOString(), 1_000_000_000, 10, 2, 1),
  ]);
  const child = spawnSync(process.execPath, [join(pluginRoot, "hooks", "trending-cost.mjs")], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
    input: JSON.stringify({ prompt: "How is the weather?" }),
  });
  assert.equal(child.status, 0, child.stderr);
  const lines = child.stdout.trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(lines[0].type, "progress");
  assert.match(lines[0].message, /Trending cost/);
  assert.deepEqual(lines[1], {});
});

test("MCP exposes trending_cost and reads only the invoking profile's local store", async t => {
  const client = new Client({ name: "airlock-trending-cost-test", version: "0.1.0" });
  t.after(() => client.close());
  const home = await scratch(t);
  const workspace = await scratch(t);
  const now = new Date();
  await createStore(home, [
    event(new Date(now.getTime() - 1_000).toISOString(), 2_000_000_000, 30, 3, 1),
  ]);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const config = JSON.parse(await readFile(join(pluginRoot, ".mcp.json"), "utf8"));
  const declaration = config.mcpServers["airlock-outbound"];
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: declaration.args.map(arg => arg.replaceAll("${PLUGIN_ROOT}", pluginRoot)),
    cwd: workspace,
    env,
    stderr: "pipe",
  });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), [
    "check_intent", "publish_draft", "review_dependency_change", "select_model", "trending_cost",
  ]);
  const result = await client.callTool({ name: "trending_cost", arguments: {} });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.status, "reported");
  assert.equal(result.structuredContent.policySettings.mode, "advisory");
  assert.equal(result.structuredContent.report.today.totalTokens, 33);
  assert.ok(result.structuredContent.receiptPath.startsWith(home));
  const invalid = await client.callTool({ name: "trending_cost", arguments: { limit: 0 } });
  assert.equal(invalid.isError, true);
});
