# dependency-risk gate

Reviews a proposed direct NuGet version before any repository edit or package
restore. Checked-in team rules come from trusted plugin data in `snapshot.json`;
callers cannot provide or replace them. Every proposal not explicitly blocked
by those rules requires current OSV evidence.

OSV results are cached by normalized package name and exact version for 24 hours
under `~\.agent-airlock\outbound-demo\dependency-advisories`. A missing, stale,
or malformed cache entry is refreshed from `https://api.osv.dev/v1/query`.
Successful results, including "no known advisory", are saved atomically. Source
failure, invalid data, stale evidence, or an unwritable cache returns
`ask-first`; it never silently treats the version as safe.

OSV reports known advisories; an empty result does not prove that a version
exists on a configured feed or that it has no undiscovered vulnerability.
Repository restore remains responsible for package resolution and provenance.

The MISE demo covers `Microsoft.Identity.Client`, whose version is centralized
in MISE's `Directory.Build.props`:

| Version | Result |
|---|---|
| `4.87.0` | Live/cached OSV check, then `allow` only when no advisory is returned |
| `4.88.0-airlock-demo` | `block` — synthetic team-policy fixture |
| Any other valid package/version | Live/cached OSV check; block on advisories, otherwise allow |
| Synthetic blocked version plus the documented bypass | `allow` with `synthetic-bypass-used` recorded |

`AIRLOCK-DEMO-001` is not a vulnerability advisory and the blocked version does
not need to exist on NuGet. It proves policy behavior without restoring or
executing vulnerable code. The bypass applies only to an `AIRLOCK-DEMO-*` entry
whose snapshot explicitly enables it. It cannot bypass stale evidence, unknown
packages, real advisories, or other gates.

The MCP tool is `review_dependency_change`. It writes an approved local plan
under `~\.agent-airlock\outbound-demo\dependency-reviews`; it does not edit a
project, download packages, or run restore. Repository instructions or a
higher-level workflow must route dependency changes through this tool before
editing files.

The reusable command-line entry point performs the same check as the MCP tool:

```powershell
node <plugin-root>\scripts\check-nuget-advisory.mjs <package-name> <exact-version>
```

The command invokes the same live-check and cache module used by the MCP
tool. Exit code `0` means no known advisory, `2` means one or more advisories,
and `1` means the check could not establish a result.
