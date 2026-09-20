# End-to-end execution evidence

Recorded on September 20, 2026.

- `agent-airlock-all-scenarios.mp4` - full-desktop terminal capture with
  human-speed command entry, executing every scripted gate and lifecycle
  scenario through the plugin.
- `agent-airlock-agency-copilot-mcp.mp4` - real Agency Copilot sessions started
  from natural-language prompts. The agent invokes the Airlock MCP to clear a
  local-only intent, block a `/yolo` Git push, and block the synthetic
  dependency-risk scenario.
- `agent-airlock-all-scenarios.txt` - complete sanitized terminal output from
  the recorded run.
- `test-execution.txt` - complete command and TAP transcript.
- `summary.json` - machine-readable execution metadata.

Results: 79 plugin tests passed, 7 sandbox tests passed, and npm reported
zero known vulnerabilities. The recording executes 18 gate cases covering
sensitive information, dependency risk, model catalog, online-write intent, and
trending cost. It then executes 5 lifecycle scenarios covering automatic hooks,
`/yolo` resistance, RFC relevance, sandbox layering, and dependency MCP
enforcement. All 23 scenarios passed and no sample repository files changed.
