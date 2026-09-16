---
name: airlock-dependency-demo
description: Demonstrate Airlock allowing, blocking, pausing, and explicitly bypassing proposed MISE dependency versions using a dated local snapshot.
---

# Airlock dependency-risk demo

Use `review_dependency_change` from the `airlock-outbound` MCP server. If it is
unavailable, stop and ask the user to load the plugin. Do not edit MISE, run
restore, contact NuGet, or substitute another tool after a block.

Explain that `AIRLOCK-DEMO-001` is a synthetic team-policy fixture, not a real
vulnerability advisory. Make these calls in order:

1. Approved baseline:
   `{ "packageName": "Microsoft.Identity.Client", "version": "4.87.0" }`
2. Synthetic blocked proposal:
   `{ "packageName": "Microsoft.Identity.Client", "version": "4.88.0-airlock-demo" }`
3. Unknown proposal:
   `{ "packageName": "Microsoft.Identity.Client", "version": "4.88.0" }`
4. Explicit synthetic bypass:
   `{ "packageName": "Microsoft.Identity.Client", "version": "4.88.0-airlock-demo", "bypass": true, "bypassReason": "demo-owner-approved" }`

Expect **approved, blocked, blocked, approved**. The unknown version is
`approval-required` because it is absent from the snapshot and shared approval
is not implemented. The fourth receipt must contain the gate reason
`synthetic-bypass-used`.

Show a short table with status, reason, execution, and receipt path. Show approved
artifact paths. State that the tool records plans only and that real enforcement
requires dependency-edit workflows to call it before modifying files.
