import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { executable, scan, toolsRoot, version } from "./gates/secrets/scanner.mjs";

const hashes = {
  "win32-x64": "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e",
  "win32-arm64": "b95f5e4f5c425cedca7ee203d9afd29597e692c4924a12ed42f970537c72cc0f",
  "linux-x64": "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
  "linux-arm64": "e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080",
  "darwin-x64": "dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709",
  "darwin-arm64": "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
};

async function setup() {
  const checksum = hashes[`${process.platform}-${process.arch}`];
  if (!checksum) throw new Error("Unsupported platform; use Windows, Linux, or macOS on x64/arm64.");
  await mkdir(toolsRoot, { recursive: true, mode: 0o700 });
  const staging = await mkdtemp(join(toolsRoot, "install-"));
  try {
    const os = process.platform === "win32" ? "windows" : process.platform;
    const extension = process.platform === "win32" ? "zip" : "tar.gz";
    const name = `gitleaks_${version}_${os}_${process.arch}.${extension}`;
    const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${name}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok || !response.body) throw new Error("Scanner download failed.");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 64 * 1024 * 1024) throw new Error("Scanner download too large.");
      chunks.push(chunk);
    }
    const archive = Buffer.concat(chunks);
    if (createHash("sha256").update(archive).digest("hex") !== checksum) throw new Error("Scanner checksum mismatch.");
    const path = join(staging, name);
    await writeFile(path, archive, { mode: 0o600 });
    await promisify(execFile)("tar", ["-xf", path, "-C", staging], { timeout: 30_000, maxBuffer: 65_536 });
    const binary = join(staging, process.platform === "win32" ? "gitleaks.exe" : "gitleaks");
    await chmod(binary, 0o700);
    await scan("", binary);
    await copyFile(join(staging, "LICENSE"), join(toolsRoot, "GITLEAKS-LICENSE"));
    await copyFile(binary, executable);
    await chmod(executable, 0o700);
    console.log(`Ready: checksum-verified Gitleaks ${version}. No global tools were installed.`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

try { await setup(); }
catch {
  console.error("Setup failed. Check GitHub access, platform support, system tar, and scanner integrity. Do not disable verification.");
  process.exitCode = 1;
}
