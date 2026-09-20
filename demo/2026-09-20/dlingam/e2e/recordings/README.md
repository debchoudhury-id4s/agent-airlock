# End-to-end execution evidence

Recorded from a disposable fresh clone of commit
`8f69400adc5fc6b0db4f1b816d3c3afa67dda1c5` on September 20, 2026.

- `agent-airlock-terminal-demo.mp4` - real terminal capture of the latest plugin
  handling `Design bearer token authentication for this API.`
- `agent-airlock-terminal-demo.txt` - sanitized terminal output from that run.
- `test-execution.txt` - complete command and TAP transcript.
- `summary.json` - machine-readable execution metadata.

Results: 79 plugin tests passed, 7 sandbox tests passed, and npm reported
zero known vulnerabilities. The terminal demo shows the automatic cost check,
mission clearance, RFC6750/RFC9700 recommendation, and final response. No
repository files were changed.
