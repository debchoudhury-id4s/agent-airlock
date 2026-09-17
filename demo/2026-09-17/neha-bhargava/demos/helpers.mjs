import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const presentationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repositoryRoot = resolve(presentationRoot, "../../..");
export const pluginRoot = join(repositoryRoot, "plugins", "AirlockPlugin");
export const sampleRoot = join(presentationRoot, ".sample");
export const sampleRepository = "dlingam_microsoft/airlock-e2e-sample";
export const scenarios = {
  "sensitive-information": ["clean", "secret", "override", "pii", "label", "header-log", "replacement", "input-limit", "schema-override"],
  "dependency-risk": ["offline-block"],
  "model-catalog": ["default", "override", "public"],
  intent: ["local-review", "online-write"],
  "trending-cost": ["below-limit", "above-limit", "unavailable"],
};

export function parseArgs(args) {
  if (args.length === 1 && args[0] === "--list") return { list: true };
  if (!args.length) return { gate: "all" };
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!["--gate", "--case"].includes(key) || !args[i + 1] || result[key.slice(2)]) {
      throw new Error("invalid-options");
    }
    result[key.slice(2)] = args[i + 1];
  }
  if (!result.gate || (result.gate !== "all" && !Object.hasOwn(scenarios, result.gate))
    || (result.case && (!Object.hasOwn(scenarios, result.gate)
      || !scenarios[result.gate].includes(result.case)))) throw new Error("invalid-options");
  return result;
}

export function isolatedEnvironment(home, host = process.env) {
  const env = {};
  const allowed = new Set(["path", "systemroot", "windir", "comspec", "pathext", "temp", "tmp", "tz", "lang", "lc_all"]);
  for (const [key, value] of Object.entries(host)) {
    if (allowed.has(key.toLowerCase()) && typeof value === "string") env[key] = value;
  }
  return {
    ...env, HOME: home, USERPROFILE: home,
    APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local"),
    XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache"),
  };
}

export function requireInside(root, path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("unsafe-evidence-path");
  const rel = relative(resolve(root), resolve(path));
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    throw new Error("unsafe-evidence-path");
  }
  return path;
}

export async function refuseLink(path) {
  if (existsSync(path) && (await lstat(path)).isSymbolicLink()) throw new Error("linked-directory-refused");
}

export function gitOutput(cwd, args) {
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" };
  for (const key of Object.keys(env)) if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_|CONFIG_VALUE_)/.test(key)) delete env[key];
  const r = spawnSync("git", ["--no-pager", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=",
    "-c", "submodule.recurse=false", ...args], { cwd, env, encoding: "utf8", timeout: 30_000, windowsHide: true });
  if (r.status !== 0) throw new Error("checkout-command-failed");
  return r.stdout.trim();
}

export async function assertCheckout(root = sampleRoot) {
  await refuseLink(root);
  if (!existsSync(join(root, ".git"))) throw new Error("checkout-missing-run-demo-prepare");
  await refuseLink(join(root, ".git"));
  if (!(await lstat(join(root, ".git"))).isDirectory()) throw new Error("checkout-must-be-isolated");
  const top = await realpath(gitOutput(root, ["rev-parse", "--show-toplevel"]));
  if (top.toLowerCase() !== (await realpath(root)).toLowerCase()) throw new Error("checkout-root-mismatch");
  const origin = gitOutput(root, ["remote", "get-url", "origin"]);
  if (![ `https://github.com/${sampleRepository}.git`, `https://github.com/${sampleRepository}`,
    `git@github.com:${sampleRepository}.git` ].includes(origin)) throw new Error("checkout-origin-mismatch");
  // Include ignored files: a previously installed dependency or generated artifact is not a pristine sample.
  const status = gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=all", "--ignored"]);
  if (status) throw new Error("checkout-dirty-refused");
  return { sha: gitOutput(root, ["rev-parse", "HEAD"]), status: "clean" };
}

export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

export function safeResult(result) {
  const safe = {};
  for (const key of ["id", "status", "reason", "execution", "decision", "policy", "policyVersion",
    "policySha256", "sha256", "bytes", "model", "endpoint"]) {
    if (result[key] !== undefined) safe[key] = result[key];
  }
  if (result.findings) safe.findings = result.findings.map(({ ruleId, line }) => ({ ruleId, line }));
  if (result.checks) safe.checks = result.checks.map(({ gate, decision, reason, findings }) => ({
    gate, decision, reason, findings: findings?.map(({ ruleId, line }) => ({ ruleId, line })),
  }));
  if (result.remediation) safe.remediation = {
    status: result.remediation.status, candidateAvailable: !!result.remediation.candidate,
  };
  if (result.report) {
    safe.syntheticUsage = {
      fixture: true, available: result.report.available, reason: result.report.reason,
      monthToDateUsd: result.report.monthToDate?.costUsd, todayUsd: result.report.today?.costUsd,
      todayTokens: result.report.today?.totalTokens,
    };
    safe.policySettings = result.policySettings;
  }
  return safe;
}
