import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  loadConfiguration,
  mergeConfigurations,
  parseArguments,
  resolveTarget,
  updateSettingsFile,
  validateAirlockConfiguration,
} from "../scripts/configure.mjs";

test("later overrides replace scalar values and retain nested defaults", () => {
  const result = mergeConfigurations(
    { sandbox: { enabled: true, allowBypass: true, userPolicy: { network: { allowOutbound: true } } } },
    { sandbox: { userPolicy: { network: { allowOutbound: false, allowLocalNetwork: false } } } },
  );
  assert.deepEqual(result, {
    sandbox: {
      enabled: true,
      allowBypass: true,
      userPolicy: { network: { allowOutbound: false, allowLocalNetwork: false } },
    },
  });
});

test("developer and restricted configurations retain bypass", async () => {
  const developer = await loadConfiguration(["developer"]);
  const restricted = await loadConfiguration(["restricted"]);
  assert.equal(developer.sandbox.allowBypass, true);
  assert.equal(developer.sandbox.userPolicy.network.allowOutbound, true);
  assert.equal(restricted.sandbox.allowBypass, true);
  assert.equal(restricted.sandbox.userPolicy.network.allowOutbound, false);
});

test("updating settings preserves unrelated existing values", async () => {
  const root = await mkdtemp(join(tmpdir(), "airlock-sandbox-"));
  const target = join(root, ".github", "copilot", "settings.json");
  try {
    await mkdir(join(root, ".github", "copilot"), { recursive: true });
    await writeFile(target, JSON.stringify({
      model: "example-model",
      enabledPlugins: { "airlock@example": true },
      sandbox: { enabled: false },
    }));
    await updateSettingsFile(target, { sandbox: { enabled: true, allowBypass: true } });
    const result = JSON.parse(await readFile(target, "utf8"));
    assert.equal(result.model, "example-model");
    assert.deepEqual(result.enabledPlugins, { "airlock@example": true });
    assert.deepEqual(result.sandbox, { enabled: true, allowBypass: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("argument parsing defaults to a developer repository preview", () => {
  assert.deepEqual(parseArguments([]), {
    scope: "repo",
    overrides: ["developer"],
    apply: false,
    yes: false,
    help: false,
  });
});

test("scope resolves to recognized Copilot settings files", () => {
  assert.equal(
    resolveTarget("repo", "C:\\repo"),
    join("C:\\repo", ".github", "copilot", "settings.json"),
  );
  assert.equal(
    resolveTarget("local", "C:\\repo"),
    join("C:\\repo", ".github", "copilot", "settings.local.json"),
  );
  assert.equal(
    resolveTarget("user", "C:\\repo", { COPILOT_HOME: "C:\\copilot-home" }),
    join("C:\\copilot-home", "settings.json"),
  );
});

test("Airlock fragments reject unsupported keys and invalid value types", () => {
  assert.throws(
    () => validateAirlockConfiguration({
      sandbox: { userPolicy: { network: { allowOutbound: "no" } } },
    }),
    /allowOutbound must be a Boolean/,
  );
  assert.throws(
    () => validateAirlockConfiguration({
      sandbox: { imaginaryRestriction: true },
    }),
    /Unsupported configuration key/,
  );
});

test("filesystem policy accepts only absolute path arrays", () => {
  assert.doesNotThrow(() => validateAirlockConfiguration({
    sandbox: {
      userPolicy: {
        filesystem: {
          readonlyPaths: ["C:\\work\\shared"],
          deniedPaths: ["C:\\Users\\example\\.ssh"],
        },
      },
    },
  }));
  assert.throws(
    () => validateAirlockConfiguration({
      sandbox: { userPolicy: { filesystem: { deniedPaths: [".ssh"] } } },
    }),
    /array of absolute paths/,
  );
});
