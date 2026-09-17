import { parseArgs, scenarios } from "./helpers.mjs";

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    for (const [gate, cases] of Object.entries(scenarios)) console.log(`${gate}: ${cases.join(", ")}`);
  } else {
    // Keep listing independent of the SDK, SQLite, checkout, server, and network.
    const { runDemos } = await import("./runner.mjs");
    await runDemos(options);
  }
} catch (error) {
  const reason = /^[a-z][a-z0-9-]+$/.test(error.message) ? error.message : "verification-or-transport-failed";
  console.error(`Demo FAILED: ${reason}. Use --list; inspect the printed local evidence directory if present.`);
  process.exitCode = 1;
}
