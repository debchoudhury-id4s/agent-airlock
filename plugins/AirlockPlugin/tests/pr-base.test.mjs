import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePrBase } from "../gates/no-online-writes/pr-base.mjs";

const source = "refs/heads/debchoudhury/security-3609547-mise-sni";
const azurePr = { sourceRefName: source, targetRefName: "refs/heads/master", status: "active" };

function fixture({
  remote = "https://identitydivision.visualstudio.com/DevEx/_git/MISE",
  prs = [azurePr],
  ok = true,
  credentials = "username=test-user\npassword=synthetic-test-password\n",
} = {}) {
  const commands = [];
  const requests = [];
  const inputs = [];
  const run = (command, args, options) => {
    commands.push({ command, args, options });
    assert.equal(command, "git", "Azure DevOps must not invoke gh or az");
    let stdout = "";
    if (args[0] === "remote") stdout = remote;
    if (args[0] === "symbolic-ref") stdout = source;
    if (args[0] === "credential") stdout = credentials;
    const pending = Promise.resolve({ stdout });
    pending.child = { stdin: { end: input => inputs.push(input) } };
    return pending;
  };
  const request = async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok, json: async () => ({ value: prs }) };
  };
  return { run, request, commands, requests, inputs };
}

test("Azure DevOps PR bases resolve with existing Git credentials and read-only REST", async () => {
  for (const [remote, expected] of [
    ["https://identitydivision.visualstudio.com/DevEx/_git/MISE",
      "https://identitydivision.visualstudio.com/DevEx/_apis/git/repositories/MISE/pullrequests"],
    ["https://org@dev.azure.com/org/My%20Project/_git/My%20Repo",
      "https://dev.azure.com/org/My%20Project/_apis/git/repositories/My%20Repo/pullrequests"],
    ["git@ssh.dev.azure.com:v3/org/project/repo",
      "https://dev.azure.com/org/project/_apis/git/repositories/repo/pullrequests"],
    ["ssh://git@ssh.dev.azure.com/v3/org/project/repo",
      "https://dev.azure.com/org/project/_apis/git/repositories/repo/pullrequests"],
    ["https://org.visualstudio.com/DefaultCollection/project/_git/repo",
      "https://org.visualstudio.com/DefaultCollection/project/_apis/git/repositories/repo/pullrequests"],
  ]) {
    const f = fixture({ remote });
    assert.equal(await resolvePrBase(process.cwd(), f.run, f.request), "master");
    const [{ url, options }] = f.requests;
    assert.equal(`${url.origin}${url.pathname}`, expected);
    assert.equal(url.searchParams.get("searchCriteria.sourceRefName"), source);
    assert.equal(url.searchParams.get("searchCriteria.status"), "active");
    assert.equal(url.searchParams.get("$top"), "2");
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from("test-user:synthetic-test-password").toString("base64")}`);
    assert.equal(options.redirect, "error");
    assert.equal(options.signal.aborted, false);
    assert.equal(f.commands.at(-1).options.env.GIT_TERMINAL_PROMPT, "0");
    assert.equal(f.commands.at(-1).options.env.GCM_INTERACTIVE, "Never");
    assert.equal(f.inputs.length, 1);
    assert.match(f.inputs[0], /^url=https:\/\//);
    assert.doesNotMatch(f.inputs[0], /org@/);
    assert.doesNotMatch(JSON.stringify(f.commands.map(({ command, args }) => ({ command, args }))), /synthetic-test-password/);
  }
});

test("Azure DevOps supports arbitrary PR targets and refreshes on every lookup", async () => {
  const prs = [{ ...azurePr, targetRefName: "refs/heads/release/next" }];
  const f = fixture({ prs });
  assert.equal(await resolvePrBase(process.cwd(), f.run, f.request), "release/next");
  prs[0].targetRefName = "refs/heads/develop";
  assert.equal(await resolvePrBase(process.cwd(), f.run, f.request), "develop");
  assert.equal(f.requests.length, 2);
});

test("Azure DevOps missing, ambiguous, inactive, or mismatched PRs fail closed", async () => {
  for (const prs of [
    [], [azurePr, { ...azurePr, targetRefName: "refs/heads/main" }],
    [{ ...azurePr, status: "completed" }],
    [{ ...azurePr, sourceRefName: "refs/heads/unrelated" }],
    [{ ...azurePr, targetRefName: "refs/tags/not-a-branch" }],
  ]) {
    const f = fixture({ prs });
    await assert.rejects(resolvePrBase(process.cwd(), f.run, f.request));
  }
});

test("Azure DevOps auth, network, invalid metadata, and helper failures fail closed", async () => {
  for (const options of [{ ok: false }, { credentials: "" }]) {
    const f = fixture(options);
    await assert.rejects(resolvePrBase(process.cwd(), f.run, f.request));
  }
  const f = fixture();
  await assert.rejects(resolvePrBase(process.cwd(), f.run, async () => { throw new Error("timeout"); }));
  await assert.rejects(resolvePrBase(process.cwd(), f.run, async () => ({
    ok: true, json: async () => { throw new Error("invalid JSON"); },
  })));
  await assert.rejects(resolvePrBase(process.cwd(), () => { throw new Error("helper unavailable"); }, f.request));
});
