# Agent Airlock end-to-end execution

This package validates the latest `main` behavior together with the advisory RFC
gate from `origin/rfc-relevance-gate`. It is designed to be run from a clean
clone and covers:

- prompt preflight, mission state, tool enforcement, and session cleanup;
- `/yolo` and shell-command online-write blocks;
- RFC relevance advice for `Design bearer token authentication for this API.`;
- restricted sandbox configuration retaining authority after Airlock allows;
- dependency-risk blocking with receipt-only evidence;
- the complete plugin and sandbox regression suites.

Run from this directory:

```powershell
.\run-e2e.ps1
```

The runner clones the current committed `HEAD` into a disposable directory,
installs from the lockfile, prepares the pinned scanner, and executes all tests.
It writes a timestamped transcript and `summary.json` under `artifacts\`.

The sandbox scenario verifies the integration contract: Airlock emits no host
override when its semantic check allows the request, while the applied
restricted sandbox configuration keeps outbound network disabled. It does not
claim to emulate the Copilot host sandbox inside Node.

For a screen recording, start capture before running the command and end on the
passing TAP summary. Keep notifications and unrelated windows hidden. The
transcript and JSON summary are the authoritative machine-readable evidence.
