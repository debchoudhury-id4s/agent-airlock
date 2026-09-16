# dependency-risk gate

Reviews a proposed direct NuGet version against a dated, local snapshot before
any repository edit or package restore. The snapshot is trusted plugin data in
`snapshot.json`; callers cannot provide or replace it.

The MISE demo covers `Microsoft.Identity.Client`, whose version is centralized
in MISE's `Directory.Build.props`:

| Version | Result |
|---|---|
| `4.87.0` | `allow` — present in the approved baseline |
| `4.88.0-airlock-demo` | `block` — synthetic team-policy fixture |
| Any other version | `ask-first` — not established by this snapshot |
| Synthetic blocked version plus the documented bypass | `allow` with `synthetic-bypass-used` recorded |

`AIRLOCK-DEMO-001` is not a vulnerability advisory and the blocked version does
not need to exist on NuGet. It proves policy behavior without restoring or
executing vulnerable code. The bypass applies only to an `AIRLOCK-DEMO-*` entry
whose snapshot explicitly enables it. It cannot bypass stale evidence, unknown
packages, real advisories, or other gates.

The MCP tool is `review_dependency_change`. It writes an approved local plan
under `~\.agent-airlock\outbound-demo\dependency-reviews`; it does not edit a
project, contact NuGet, or run restore. Repository instructions or a higher-level
workflow must route dependency changes through this tool before editing files.
