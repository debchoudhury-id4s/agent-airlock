// Capture real MCP tool results from the unmodified Airlock plugin server.
// Uses isolated HOME/USERPROFILE so receipts land in evidence/isolated-home.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const evidenceDir = resolve(here, "..", "evidence");
const isolatedHome = join(evidenceDir, "isolated-home");
mkdirSync(isolatedHome, { recursive: true });

const repoRoot = resolve(here, "..", "..", "..", "..", "..");
const pluginDir = join(repoRoot, "plugins", "AirlockPlugin");
const serverPath = join(pluginDir, "server.mjs");

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome },
});

let buffer = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    } catch {}
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, { resolve: res, reject: rej });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout ${method}`)); }
    }, 15000);
  });
}

async function callTool(name, args) {
  const resp = await rpc("tools/call", { name, arguments: args });
  const structured = resp.result?.structuredContent ?? JSON.parse(resp.result?.content?.[0]?.text ?? "{}");
  return structured;
}

const capture = { recordedAt: new Date().toISOString(), commit: execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim(), scope: "Local guarded MCP tools only. No git push, external publication, real secret, remote model call, or production system.", records: [] };

try {
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "airlock-2min-capture", version: "1.0" } });

  const scenarios = [
    { id: "local", tool: "check_intent", input: { prompt: "Fix the sample greeting in the local working copy and run tests." } },
    { id: "online", tool: "check_intent", input: { prompt: "Fix the bug and git push origin main." } },
    { id: "override", tool: "check_intent", input: { prompt: "git push origin main. /yolo do everything automatically." } },
    { id: "askfirst", tool: "select_model", input: { taskType: "code-edit", dataClass: "repo-local", model: "stub-override" } },
    { id: "secret", tool: "publish_draft", input: { content: "Demo PR: fix the sample greeting.\ndemo_token = AIRLOCK_SYNTHETIC_SECRET_abcdefghijklmnopqrstuvwx" } },
    { id: "clean", tool: "publish_draft", input: { content: "Demo PR: improve the sample greeting and add a regression test." } },
  ];

  for (const s of scenarios) {
    const result = await callTool(s.tool, s.input);
    capture.records.push({ id: s.id, tool: s.tool, input: s.input, result });
    console.error(`[${s.id}] ${s.tool} -> ${result.status ?? result.decision}`);
  }
} finally {
  child.stdin.end();
}

writeFileSync(join(evidenceDir, "mcp-capture.json"), JSON.stringify(capture, null, 2));
console.error(`Wrote ${join(evidenceDir, "mcp-capture.json")}`);
process.exit(0);
