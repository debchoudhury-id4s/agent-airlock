---
name: airlock-dependency-demo
description: Review proposed NuGet dependency versions before repository edits, and demonstrate Airlock blocking a synthetic MISE dependency version.
---

# Airlock dependency-risk review

Use `review_dependency_change` from the `airlock-outbound` MCP server before
editing a NuGet package version. If it is unavailable, stop and ask the user to
load the plugin. Never edit a manifest, restore packages, or substitute another
tool after a blocked or approval-required result.

For an ordinary dependency request:

1. Extract the exact NuGet package ID and proposed semantic version from the
   user's request. If either is missing, ask for it.
2. Make exactly one `review_dependency_change` call with `packageName` and
   `version`. Do not pass evidence, paths, policy, approval, or bypass fields.
3. If the result is blocked or requires approval, report its reason and advisory
   IDs, then stop without changing the repository.
4. If approved, continue the requested repository edit.

For the explicit Airlock demo, make exactly this one call:

`{ "packageName": "Microsoft.Identity.Client", "version": "4.88.0-airlock-demo" }`

Expect a blocked result with rule `AIRLOCK-DEMO-001`. Make no other tool calls.
Do not show a table, receipt, artifact path, baseline, unknown version, or bypass.
Reply exactly: The upgrade was not performed because Airlock blocked
`Microsoft.Identity.Client` version `4.88.0-airlock-demo` under policy rule
`AIRLOCK-DEMO-001`.
