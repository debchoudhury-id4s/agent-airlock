import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/);
const nonnegative = z.number().finite().nonnegative();
const tokenCount = z.number().int().nonnegative();
const usageWindowSchema = z.object({
  nanoAiu: z.number().int().nonnegative(),
  aiu: nonnegative,
  costUsd: nonnegative,
  requests: tokenCount,
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  totalTokens: tokenCount,
  reasoningTokens: tokenCount,
  cacheReadTokens: tokenCount,
  cacheWriteTokens: tokenCount,
}).strict();

export const trendingCostReportSchema = z.discriminatedUnion("available", [
  z.object({
    available: z.literal(true),
    source: z.literal("copilot-cli-local-session-store"),
    estimated: z.literal(true),
    currency: z.literal("USD"),
    usdPerAiu: z.number().finite().positive(),
    generatedAt: z.string().datetime({ offset: true }),
    timeZone: z.string().min(1),
    monthStartDate: z.string().date(),
    todayDate: z.string().date(),
    monthStart: z.string().datetime({ offset: true }),
    todayStart: z.string().datetime({ offset: true }),
    through: z.string().datetime({ offset: true }),
    monthToDate: usageWindowSchema,
    today: usageWindowSchema,
  }).strict(),
  z.object({
    available: z.literal(false),
    source: z.literal("copilot-cli-local-session-store"),
    generatedAt: z.string().datetime({ offset: true }),
    reason: identifier,
  }).strict(),
]);

export function defaultSessionStorePath(home = homedir()) {
  return join(home, ".copilot", "session-store.db");
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function trendingCostBounds(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("Expected a valid current time.");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    now,
    monthStart,
    todayStart,
    monthStartDate: localDate(monthStart),
    todayDate: localDate(todayStart),
  };
}

function numeric(value) {
  const number = typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid usage aggregate.");
  return number;
}

function round(value, places = 6) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function usageWindow(row, usdPerAiu) {
  const nanoAiu = Math.trunc(numeric(row.nanoAiu));
  const inputTokens = Math.trunc(numeric(row.inputTokens));
  const outputTokens = Math.trunc(numeric(row.outputTokens));
  return {
    nanoAiu,
    aiu: round(nanoAiu / 1e9),
    costUsd: round((nanoAiu / 1e9) * usdPerAiu),
    requests: Math.trunc(numeric(row.requests)),
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    reasoningTokens: Math.trunc(numeric(row.reasoningTokens)),
    cacheReadTokens: Math.trunc(numeric(row.cacheReadTokens)),
    cacheWriteTokens: Math.trunc(numeric(row.cacheWriteTokens)),
  };
}

function unavailable(reason, generatedAt) {
  return {
    available: false,
    source: "copilot-cli-local-session-store",
    generatedAt,
    reason,
  };
}

const aggregateSql = `
  SELECT COALESCE(SUM(total_nano_aiu), 0) AS nanoAiu,
         COUNT(*) AS requests,
         COALESCE(SUM(input_tokens), 0) AS inputTokens,
         COALESCE(SUM(output_tokens), 0) AS outputTokens,
         COALESCE(SUM(reasoning_tokens), 0) AS reasoningTokens,
         COALESCE(SUM(cache_read_tokens), 0) AS cacheReadTokens,
         COALESCE(SUM(cache_write_tokens), 0) AS cacheWriteTokens
    FROM assistant_usage_events
   WHERE created_at >= ?
     AND created_at < ?
`;

/** Read aggregate Copilot CLI usage from the local session store without modifying it. */
export function readTrendingCost({
  dbPath = defaultSessionStorePath(),
  now = new Date(),
  usdPerAiu = 0.01,
} = {}) {
  const bounds = trendingCostBounds(now);
  if (!Number.isFinite(usdPerAiu) || usdPerAiu <= 0) throw new Error("Expected a positive AIU rate.");
  const generatedAt = bounds.now.toISOString();
  if (!existsSync(dbPath)) return unavailable("session-store-missing", generatedAt);

  let database;
  try {
    database = new DatabaseSync(dbPath, { readOnly: true });
    const columns = new Set(database.prepare("PRAGMA table_info(assistant_usage_events)").all().map(row => row.name));
    const required = [
      "created_at", "total_nano_aiu", "input_tokens", "output_tokens",
      "reasoning_tokens", "cache_read_tokens", "cache_write_tokens",
    ];
    if (required.some(column => !columns.has(column))) {
      return unavailable("unsupported-session-store-schema", generatedAt);
    }
    const aggregate = database.prepare(aggregateSql);
    const through = bounds.now.toISOString();
    const monthToDate = usageWindow(aggregate.get(bounds.monthStart.toISOString(), through), usdPerAiu);
    const today = usageWindow(aggregate.get(bounds.todayStart.toISOString(), through), usdPerAiu);
    return trendingCostReportSchema.parse({
      available: true,
      source: "copilot-cli-local-session-store",
      estimated: true,
      currency: "USD",
      usdPerAiu,
      generatedAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
      monthStartDate: bounds.monthStartDate,
      todayDate: bounds.todayDate,
      monthStart: bounds.monthStart.toISOString(),
      todayStart: bounds.todayStart.toISOString(),
      through,
      monthToDate,
      today,
    });
  } catch {
    return unavailable("session-store-read-failed", generatedAt);
  } finally {
    database?.close();
  }
}

function integer(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function usdCents(value) {
  return Math.round(value * 100);
}

function money(value) {
  return `$${(usdCents(value) / 100).toFixed(2)}`;
}

export function formatTrendingCost(report) {
  const parsed = trendingCostReportSchema.parse(report);
  if (!parsed.available) {
    return `Trending cost (local CLI estimate) | unavailable: ${parsed.reason}`;
  }
  return [
    "Trending cost (local CLI estimate)",
    `MTD ${parsed.monthStartDate}-now: ${money(parsed.monthToDate.costUsd)}`,
    `Today: ${money(parsed.today.costUsd)}`,
    `Today tokens: ${integer(parsed.today.totalTokens)} (${integer(parsed.today.inputTokens)} input / ${integer(parsed.today.outputTokens)} output; ${integer(parsed.today.reasoningTokens)} reasoning)`,
  ].join(" | ");
}

export function formatTrendingCostBlock(report, limitUsd) {
  const parsed = trendingCostReportSchema.parse(report);
  if (!parsed.available) {
    return "Trending-cost gate blocked this prompt because local usage could not be verified.";
  }
  return `Trending-cost gate blocked this prompt: month-to-date estimated local CLI cost ${money(parsed.monthToDate.costUsd)} is at or above the configured ${money(limitUsd)} limit.`;
}
