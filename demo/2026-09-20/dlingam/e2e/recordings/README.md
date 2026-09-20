# End-to-end execution evidence

Recorded from a disposable fresh clone of commit
`8f69400adc5fc6b0db4f1b816d3c3afa67dda1c5` on September 20, 2026.

- `agent-airlock-all-scenarios.mp4` - real terminal capture executing every
  scripted gate and lifecycle scenario through the latest plugin.
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
