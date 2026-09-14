import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const version = "8.30.1";
export const pluginRoot = fileURLToPath(new URL("../../", import.meta.url));
export const toolsRoot = join(pluginRoot, ".tools");
export const executable = join(toolsRoot, process.platform === "win32" ? "gitleaks.exe" : "gitleaks");
const config = fileURLToPath(new URL("gitleaks.toml", import.meta.url));
const leakExitCode = 23;

function run(command, args, input, cwd) {
  return new Promise((resolve, reject) => {
    const env = { HOME: cwd, USERPROFILE: cwd, TMP: cwd, TEMP: cwd, TMPDIR: cwd };
    for (const [key, value] of Object.entries(process.env)) {
      if (/^(SystemRoot|WINDIR)$/i.test(key)) env[key] = value;
    }
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let bytes = 0;
    let stderrBytes = 0;
    let failed = false;
    const fail = () => { failed = true; child.kill("SIGKILL"); };
    const timer = setTimeout(fail, 15_000);
    child.once("error", fail);
    child.stdin.once("error", fail);
    child.stdout.once("error", fail);
    child.stderr.once("error", fail);
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) fail();
      else if (!failed) chunks.push(chunk);
    });
    child.stderr.on("data", chunk => { stderrBytes += chunk.length; if (stderrBytes > 65_536) fail(); });
    child.once("close", code => {
      clearTimeout(timer);
      if (failed || code === null) reject(new Error("Scanner process failed."));
      else resolve({ code, output: Buffer.concat(chunks).toString("utf8") });
    });
    child.stdin.end(input, "utf8");
  });
}

const reportSchema = z.array(z.object({
  RuleID: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
  StartLine: z.number().int().positive(),
})).max(4096);

/** Scan the exact text with trusted config; never return raw scanner output. */
export async function scan(content, command = executable) {
  let scratch;
  try {
    if (typeof content !== "string" || Buffer.byteLength(content) > 65_536) throw new Error();
    await mkdir(toolsRoot, { recursive: true, mode: 0o700 });
    scratch = await mkdtemp(join(toolsRoot, "scan-"));
    const reportedVersion = await run(command, ["version"], "", scratch);
    if (reportedVersion.code !== 0 || reportedVersion.output.trim() !== version) throw new Error();
    const ignore = join(scratch, ".gitleaksignore");
    await writeFile(ignore, "", { mode: 0o600 });
    const result = await run(command, [
      "stdin", "--config", config, "--redact=100", "--no-banner", "--no-color",
      "--log-level=error", "--report-format=json", "--report-path=-",
      `--exit-code=${leakExitCode}`, "--ignore-gitleaks-allow", "--gitleaks-ignore-path", ignore,
    ], content, scratch);
    if (result.code !== 0 && result.code !== leakExitCode) throw new Error();
    const findings = reportSchema.parse(JSON.parse(result.output));
    if ((result.code === leakExitCode) !== (findings.length > 0)) throw new Error();
    return findings.map(finding => ({ ruleId: finding.RuleID, line: finding.StartLine }));
  } catch {
    throw new Error("Secret scan failed. Run npm run setup in the plugin folder; no draft was cleared.");
  } finally {
    if (scratch) {
      try { await rm(scratch, { recursive: true, force: true }); }
      catch { throw new Error("Scanner cleanup failed; no draft was cleared."); }
    }
  }
}
