import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const sandboxRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const safeName = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const blockedKeys = new Set(["__proto__", "constructor", "prototype"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (blockedKeys.has(key)) throw new Error(`Unsafe configuration key: ${key}`);
    return [key, clone(child)];
  }));
}

function validateKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unsupported configuration key: ${path}.${key}`);
  }
}

function requireBoolean(value, path) {
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`${path} must be a Boolean.`);
  }
}

function validatePathList(value, path) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !isAbsolute(item))) {
    throw new Error(`${path} must be an array of absolute paths.`);
  }
}

/** Validate only the reviewed sandbox fragment; unrelated existing settings remain pass-through. */
export function validateAirlockConfiguration(configuration) {
  if (!isObject(configuration)) throw new Error("Airlock configuration must be a JSON object.");
  validateKeys(configuration, new Set(["sandbox"]), "configuration");
  if (!isObject(configuration.sandbox)) throw new Error("configuration.sandbox must be an object.");

  const sandbox = configuration.sandbox;
  validateKeys(sandbox, new Set([
    "enabled", "allowBypass", "addCurrentWorkingDirectory", "sandboxMcpServers",
    "sandboxLspServers", "allowDevToolAccess", "auth", "userPolicy",
  ]), "configuration.sandbox");
  for (const key of [
    "enabled", "allowBypass", "addCurrentWorkingDirectory", "sandboxMcpServers",
    "sandboxLspServers", "allowDevToolAccess",
  ]) {
    requireBoolean(sandbox[key], `configuration.sandbox.${key}`);
  }

  if (sandbox.auth !== undefined) {
    if (!isObject(sandbox.auth)) throw new Error("configuration.sandbox.auth must be an object.");
    validateKeys(sandbox.auth, new Set(["git", "gh"]), "configuration.sandbox.auth");
    requireBoolean(sandbox.auth.git, "configuration.sandbox.auth.git");
    requireBoolean(sandbox.auth.gh, "configuration.sandbox.auth.gh");
  }

  if (sandbox.userPolicy !== undefined) {
    if (!isObject(sandbox.userPolicy)) {
      throw new Error("configuration.sandbox.userPolicy must be an object.");
    }
    validateKeys(sandbox.userPolicy, new Set(["network", "filesystem"]), "configuration.sandbox.userPolicy");
    const { network, filesystem } = sandbox.userPolicy;
    if (network !== undefined) {
      if (!isObject(network)) {
        throw new Error("configuration.sandbox.userPolicy.network must be an object.");
      }
      validateKeys(network, new Set(["allowOutbound", "allowLocalNetwork"]),
        "configuration.sandbox.userPolicy.network");
      requireBoolean(network.allowOutbound, "configuration.sandbox.userPolicy.network.allowOutbound");
      requireBoolean(network.allowLocalNetwork, "configuration.sandbox.userPolicy.network.allowLocalNetwork");
    }
    if (filesystem !== undefined) {
      if (!isObject(filesystem)) {
        throw new Error("configuration.sandbox.userPolicy.filesystem must be an object.");
      }
      validateKeys(filesystem, new Set(["readonlyPaths", "deniedPaths"]),
        "configuration.sandbox.userPolicy.filesystem");
      validatePathList(filesystem.readonlyPaths,
        "configuration.sandbox.userPolicy.filesystem.readonlyPaths");
      validatePathList(filesystem.deniedPaths,
        "configuration.sandbox.userPolicy.filesystem.deniedPaths");
    }
  }
  return configuration;
}

/** Merge configuration objects recursively; later arrays and scalars replace earlier values. */
export function mergeConfigurations(...configurations) {
  const merge = (left, right) => {
    if (!isObject(left) || !isObject(right)) return clone(right);
    const result = clone(left);
    for (const [key, value] of Object.entries(right)) {
      if (blockedKeys.has(key)) throw new Error(`Unsafe configuration key: ${key}`);
      result[key] = key in result ? merge(result[key], value) : clone(value);
    }
    return result;
  };
  return configurations.reduce((result, configuration) => merge(result, configuration), {});
}

async function readJson(path, { optional = false } = {}) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (optional && error.code === "ENOENT") return {};
    throw error;
  }
  const value = JSON.parse(text);
  if (!isObject(value)) throw new Error(`${path} must contain a JSON object.`);
  return value;
}

export async function loadConfiguration(overrides, root = sandboxRoot) {
  const fragments = [
    validateAirlockConfiguration(await readJson(join(root, "configurations", "base.json"))),
  ];
  for (const name of overrides) {
    if (!safeName.test(name)) throw new Error(`Invalid override name: ${name}`);
    fragments.push(validateAirlockConfiguration(
      await readJson(join(root, "configurations", "overrides", `${name}.json`)),
    ));
  }
  return mergeConfigurations(...fragments);
}

export async function updateSettingsFile(target, configuration) {
  validateAirlockConfiguration(configuration);
  const existing = await readJson(target, { optional: true });
  const proposed = mergeConfigurations(existing, configuration);
  const encoded = `${JSON.stringify(proposed, null, 2)}\n`;
  await mkdir(dirname(target), { recursive: true });
  const temporary = join(dirname(target), `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, encoded, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return proposed;
}

function usage() {
  return `Usage:
  node sandbox/scripts/configure.mjs [options]

Options:
  --scope repo|local|user   Settings scope. Defaults to repo.
  --override NAME          Apply a named override. Repeatable; defaults to developer.
  --apply                  Write the proposed settings. Without this, only preview.
  --yes                    Skip confirmation. Valid only with --apply.
  --help                   Show this help.`;
}

export function parseArguments(args) {
  const options = { scope: "repo", overrides: [], apply: false, yes: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--scope") options.scope = args[++index];
    else if (argument === "--override") options.overrides.push(args[++index]);
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!["repo", "local", "user"].includes(options.scope)) {
    throw new Error(`Unsupported scope: ${options.scope}`);
  }
  if (options.overrides.some(value => !value)) throw new Error("--override requires a name.");
  if (options.yes && !options.apply) throw new Error("--yes requires --apply.");
  if (options.overrides.length === 0) options.overrides.push("developer");
  return options;
}

export function resolveTarget(scope, cwd = process.cwd(), environment = process.env) {
  if (scope === "repo") return join(cwd, ".github", "copilot", "settings.json");
  if (scope === "local") return join(cwd, ".github", "copilot", "settings.local.json");
  const copilotHome = environment.COPILOT_HOME
    ? resolve(environment.COPILOT_HOME)
    : join(environment.USERPROFILE || environment.HOME || homedir(), ".copilot");
  return join(copilotHome, "settings.json");
}

async function confirm(target) {
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await terminal.question(`Apply these settings to ${target}? Type "yes" to continue: `);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    terminal.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const configuration = await loadConfiguration(options.overrides);
  const target = resolveTarget(options.scope);
  const existing = await readJson(target, { optional: true });
  const proposed = mergeConfigurations(existing, configuration);
  console.log(`Target: ${target}`);
  console.log(`Overrides: ${options.overrides.join(", ")}`);
  console.log(JSON.stringify(proposed, null, 2));
  if (!options.apply) {
    console.log("Preview only. Re-run with --apply to write these settings.");
    return;
  }
  if (!options.yes && !(await confirm(target))) {
    console.log("No settings were changed.");
    return;
  }
  await updateSettingsFile(target, configuration);
  console.log("Settings updated. Restart Copilot CLI before relying on the new sandbox configuration.");
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => {
    console.error(`Sandbox configuration failed: ${error.message}`);
    process.exitCode = 1;
  });
}
