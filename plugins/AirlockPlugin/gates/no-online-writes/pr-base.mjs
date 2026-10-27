import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execute = promisify(execFile);
const branch = z.string().min(1).max(1024).regex(/^[^\s~^:?*[\]\\]+$/);
const prSchema = z.object({
  baseRefName: branch,
  state: z.literal("OPEN"),
});
const azurePrsSchema = z.object({
  value: z.array(z.object({
    sourceRefName: z.string(),
    targetRefName: z.string().startsWith("refs/heads/"),
    status: z.literal("active"),
  })).length(1),
});

function azureRepository(remote) {
  const ssh = /^(?:git@ssh\.dev\.azure\.com:|ssh:\/\/git@ssh\.dev\.azure\.com\/)v3\/([^/]+)\/([^/]+)\/([^/]+)$/i.exec(remote);
  if (ssh) {
    remote = `https://dev.azure.com/${ssh[1]}/${ssh[2]}/_git/${ssh[3]}`;
  }
  if (!/^https:\/\//i.test(remote)) return null;
  const url = new URL(remote);
  if (url.hostname !== "dev.azure.com" && !/^[a-z0-9-]+\.visualstudio\.com$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const gitIndex = parts.indexOf("_git");
  if (gitIndex < 1 || gitIndex !== parts.length - 2
    || (url.hostname === "dev.azure.com" && gitIndex !== 2)) {
    throw new Error("Unsupported Azure DevOps repository URL.");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const repository = encodeURIComponent(decodeURIComponent(parts.at(-1)));
  const endpoint = new URL(`${url.origin}/${parts.slice(0, gitIndex).join("/")}/_apis/git/repositories/${repository}/pullrequests`);
  return { credentialUrl: url.href, endpoint };
}

function credentialAuthorization(output) {
  const fields = new Map(output.trim().split(/\r?\n/).map(line => {
    const split = line.indexOf("=");
    return [line.slice(0, split), line.slice(split + 1)];
  }));
  const username = fields.get("username");
  const password = fields.get("password");
  if (!username || !password) throw new Error("Azure DevOps Git credentials unavailable.");
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function azureBase(repository, git, request) {
  const source = (await git(["symbolic-ref", "--quiet", "HEAD"])).trim();
  if (!source.startsWith("refs/heads/")) throw new Error("Expected a local source branch.");
  const credentials = await git(["credential", "fill"], `url=${repository.credentialUrl}\n\n`);
  const endpoint = repository.endpoint;
  endpoint.search = new URLSearchParams({
    "searchCriteria.sourceRefName": source,
    "searchCriteria.status": "active",
    "$top": "2",
    "api-version": "7.1",
  }).toString();
  const response = await request(endpoint, {
    headers: { Authorization: credentialAuthorization(credentials), Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error("Azure DevOps PR lookup failed.");
  const { value: [pr] } = azurePrsSchema.parse(await response.json());
  if (pr.sourceRefName !== source) throw new Error("Azure DevOps PR source mismatch.");
  return branch.parse(pr.targetRefName.slice("refs/heads/".length));
}

export async function resolvePrBase(cwd, run = execute, request = fetch) {
  const deadline = Date.now() + 8000;
  const timeout = limit => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("PR lookup timed out.");
    return Math.min(limit, remaining);
  };
  const options = {
    cwd, encoding: "utf8", timeout: 1500, maxBuffer: 16_384, windowsHide: true,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
  };
  const git = async (args, input) => {
    // execFile has no stdin option; credentials must never be passed on the command line.
    let child;
    const pending = run("git", args, { ...options, timeout: timeout(input === undefined ? 1500 : 5000) });
    if (input !== undefined) {
      child = pending.child;
      if (!child?.stdin) throw new Error("Git credential input unavailable.");
      child.stdin.end(input);
    }
    return (await pending).stdout;
  };
  await git(["rev-parse", "--show-toplevel"]);
  const repository = azureRepository((await git(["remote", "get-url", "origin"])).trim());
  if (repository) return azureBase(repository, git, (url, init) => request(url, {
    ...init, signal: AbortSignal.timeout(timeout(3000)),
  }));
  const { stdout } = await run("gh", ["pr", "view", "--json", "baseRefName,state"], {
    ...options, timeout: timeout(4000),
  });
  return prSchema.parse(JSON.parse(stdout)).baseRefName;
}
