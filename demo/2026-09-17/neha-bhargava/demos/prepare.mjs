import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  assertCheckout, presentationRoot, sampleRoot, sampleRepository, refuseLink,
} from "./helpers.mjs";

try {
  if (process.argv.length !== 2) throw new Error("prepare-accepts-no-options");
  if (!existsSync(sampleRoot)) {
    // Never run sample hooks, filters, submodules, code, installs, or instructions.
    const hooks = join(presentationRoot, "demos", ".tmp", "empty-hooks");
    await mkdir(hooks, { recursive: true });
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_TERMINAL_PROMPT: "0" };
    for (const key of Object.keys(env)) {
      if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_|CONFIG_VALUE_)/.test(key)) delete env[key];
    }
    const r = spawnSync("gh", ["repo", "clone", `https://github.com/${sampleRepository}.git`, sampleRoot, "--",
      "--depth", "1", "--single-branch", "--branch", "main",
      "-c", `core.hooksPath=${hooks}`, "-c", "core.fsmonitor=false",
      "-c", "credential.helper=!gh auth git-credential",
      "-c", "submodule.recurse=false"], {
      cwd: presentationRoot, env, encoding: "utf8", timeout: 120_000, windowsHide: true,
    });
    if (r.status !== 0) throw new Error("sample-clone-failed-check-gh-auth-no-automatic-cleanup");
  }
  await refuseLink(sampleRoot);
  const state = await assertCheckout();
  console.log(`Sample ready: .sample/ | main checkout SHA ${state.sha} | clean; no code executed.`);
  console.log("An existing clean checkout is reused without pulling; nothing is discarded.");
} catch (error) {
  // Do not echo git/gh stderr, remote URLs containing credentials, or arbitrary file names.
  const safe = /^[a-z][a-z0-9-]+$/.test(error.message) ? error.message : "preparation-failed";
  console.error(`Demo preparation failed: ${safe}`);
  process.exitCode = 1;
}
