---
name: airlock-dependency-demo
description: Demonstrate Airlock blocking a proposed MISE dependency version using a dated local snapshot.
---

# Airlock dependency-risk demo

Use `review_dependency_change` from the `airlock-outbound` MCP server. If it is
unavailable, stop and ask the user to load the plugin. Do not edit MISE, run
restore, contact NuGet, or substitute another tool after a block.

Make exactly one call:

`{ "packageName": "Microsoft.Identity.Client", "version": "4.88.0-airlock-demo" }`

Expect a blocked result with rule `AIRLOCK-DEMO-001`. Make no other tool calls.
Do not show a table, receipt, artifact path, baseline, unknown version, or bypass.
Reply with exactly:

The upgrade was not performed because Airlock blocked `Microsoft.Identity.Client`
version `4.88.0-airlock-demo` under policy rule `AIRLOCK-DEMO-001`.
