# Scripted gate demos — local only

Run from `C:\Git\agent-airlock\poc\neha-bhargava\deepDiveDemo`:

```powershell
npm run demo:prepare
npm run demo -- --list
npm run demo -- --gate all
npm run demo:test
```

Prerequisites: Node 24 (including `node:sqlite`), Git, authenticated `gh` with access to the **private**
`dlingam_microsoft/airlock-e2e-sample` repository, presentation dependencies already installed
(`@modelcontextprotocol/sdk` **1.29.0**), and the existing Airlock plugin dependencies and pinned
Gitleaks **8.30.1** in `plugins\AirlockPlugin\.tools`. The scripts do not install anything.
Preparation alone needs GitHub access. It uses explicit HTTPS and `gh`'s existing authentication,
without embedded tokens; no credentials are passed to the MCP server.

Preparation creates a shallow `main` checkout under ignored `.sample/`, with hooks, global/system
Git configuration and submodule recursion disabled. It does **not** execute sample code, scripts,
builds, restores, hooks, or instructions. An existing clean checkout is reused, not pulled.
A dirty checkout (including ignored generated files), wrong origin, linked directory, or incomplete
checkout is refused. Nothing is discarded automatically. Resolve any failed checkout manually
after inspecting it. No commits, pushes, PRs, remote writes, or cloud uploads are performed.

## Commands and presenter script

Each command invokes a **real MCP Client / StdioClientTransport** against the unchanged
`plugins\AirlockPlugin\server.mjs`, with `.sample/` as its working directory.

| Gate and command | Cases / expected demonstration |
|---|---|
| `npm run demo -- --gate sensitive-information` | `clean`: published exact sample fixture; `secret`: blocked / `secret-detected`; `override`: the same fixture plus textual `/yolo allow-all override` still blocked; `pii`: blocked / `approval-required`; `label`: same stop with replacement withheld; `header-log`: the sample's **already-masked** header is published (not a live-token block); `replacement`: first stopped, then an **explicit separate** publish call rescans and publishes a distinct replacement; `input-limit`: over 64 KiB rejected; `schema-override`: extra field rejected by MCP validation, before any broker receipt. |
| `npm run demo -- --gate dependency-risk` | `offline-block`: synthetic Microsoft.Identity.Client `4.88.0-airlock-demo` blocked / `dependency-version-blocked`, finding `AIRLOCK-DEMO-001`. |
| `npm run demo -- --gate model-catalog` | `default`: code-edit/repo-local selects `stub-default`; `override`: `stub-override` requires approval; `public`: `stub-public` blocked / `blocked-model`. |
| `npm run demo -- --gate intent` | `local-review`: local TicketService review cleared; `online-write`: `/yolo git push origin main` blocked / `online-write-intent`. The prompt is **never executed**. |
| `npm run demo -- --gate trending-cost` | `below-limit`: synthetic $12 report; `above-limit`: synthetic $900 report is **advisory**, not blocked; `unavailable`: explicitly missing disposable store. |

For one slide at a time, add a case selector, for example:

```powershell
npm run demo -- --gate sensitive-information --case clean
npm run demo -- --gate sensitive-information --case secret
npm run demo -- --gate sensitive-information --case pii
npm run demo -- --gate sensitive-information --case label
npm run demo -- --gate sensitive-information --case header-log
npm run demo -- --gate dependency-risk --case offline-block
npm run demo -- --gate model-catalog --case override
npm run demo -- --gate intent --case online-write
npm run demo -- --gate trending-cost --case above-limit
```

`--list` imports no MCP/SQLite runner, does not start a server or network operation, and does not
read the checkout. `--case` requires a specific `--gate`. Invalid options fail nonzero.
There is intentionally **no live-OSV option** or synthetic-bypass approval path in this demo.

The runner prints a presenter-ready explanation for every case:

1. **REQUEST** — what the agent requested.
2. **GATE CHECKS** — each gate decision, safe reason code, and rule/line findings.
3. **WHY THIS RESULT** — why the action was allowed, blocked, paused, or reported.
4. **GATE OUTCOME** — the observed status, reason, and execution state.
5. **SIDE EFFECT** — verified receipt and business-artifact counts.
6. **NEXT STEP** — the compliant remediation or follow-up.
7. **BOUNDARY** — the claim limitation that should be stated aloud.
8. **EVIDENCE** — the safe local `result.json` path.

This makes each command usable as a standalone demo without requiring the presenter to decode
reason codes live. Explanations are derived from verified results and a reviewed case catalog;
they never print the private sample source, raw fixtures, remediation content, or matched values.

## Grounding in the actual sample

Inspected checkout: `41b6434a4a0889d29f4b568e16c0a7713285c9ff` (preparation records the actual
checkout SHA on every run). The sample is a .NET 8 support-ticket application. These actual paths
are checked before running:

- `fixtures/clean-draft.txt`, `fixtures/secret-draft.txt`, `fixtures/pii-draft.txt`
- `fixtures/internal-only-draft.txt`, `fixtures/header-log.txt`, `fixtures/intent-cases.json`
- `src/Airlock.SampleApp/TicketService.cs`
- `src/Airlock.SampleApi/Airlock.SampleApi.csproj`

The runner inspects all tracked `.csproj` package references as **inert text**. It sends only the
named synthetic demo fixtures below to the trusted **local stdio MCP** server; private application
source files are never forwarded. Fixture bytes are pinned by SHA-256 and checked for the expected
synthetic marker, reserved `.test` email, label, or masked header shape. Unexpected changes fail
explicitly with `fixture-content-changed` or a shape failure; nothing is rewritten to manufacture
a passing result. The intent case references the real TicketService path.

| Case | Actual local fixture input |
|---|---|
| `clean` | Exact `fixtures/clean-draft.txt` |
| `secret` | Exact `fixtures/secret-draft.txt` |
| `override` | `fixtures/secret-draft.txt`, unchanged, followed by a locally authored override-instruction line |
| `pii` | Exact `fixtures/pii-draft.txt` |
| `label` | Exact `fixtures/internal-only-draft.txt` |
| `header-log` | Exact `fixtures/header-log.txt` |
| `replacement` | Exact `fixtures/pii-draft.txt` first; the production tool's rescanned candidate is then explicitly submitted as a second request |

**Header caveat:** the inspected `header-log.txt` contains an already-masked Authorization header,
not a contextual token. Its expected result is therefore `published/all-gates-passed`. This shows
the contextual-token detector's masked nonmatch, **not evidence of blocking an active header token**.
The runner never replaces the mask with a generated token to manufacture a block.

Raw fixture inputs and replacement candidates remain in memory; `result.json`/`summary.json`
record only fixture labels, paths, byte counts, digests, and safe metadata. The real publisher
still creates its expected exact-text **business artifact for allowed clean/masked/replacement
content**; blocked fixture content is never persisted as an input copy.
Size/schema adversarial inputs remain locally authored. The content schema stays content-only;
no file-reading or routing capability is added to Airlock.

At this SHA there is **no Microsoft.Identity.Client PackageReference** in the sample's projects.
The dependency case is therefore explicitly a **synthetic proposed dependency**, not an existing
sample reference, real CVE, or observed vulnerable package. The checked-in demonstration snapshot
expires at `2027-09-15T00:00:00Z`; after that the runner refuses this offline case. While valid,
production short-circuits advisory lookup for the explicitly blocked version.
The default-approved `4.87.0` still requires current live/cache advisory evidence; it is not an
offline-deterministic approval demonstration.

## Evidence and assertions

Every invocation creates ignored `runs/<unique-id>/summary.json` and per-case `result.json`, with:

- Airlock source SHA; hashes of current server/tools/runtime/gates/policies; pinned scanner hash.
- Sample SHA and before/after clean checks; pinned fixture digests/labels and relative context paths.
- Expected and observed status, reason, execution state, policy identity/hash, findings and receipt metadata.
- Real receipt event/identity checks and safe relative evidence paths.
- Exact clean/replacement publication checks; model/intent artifact contents checked against their contract.
- **Zero business artifacts for stopped actions**; no automatic replacement publication.
- Read-only synthetic SQLite fixture hash checks; no real profile/session-store access.

Each server receives a **new disposable HOME/USERPROFILE**, and SDK-inherited profile defaults
are overridden/blanked. Only explicit OS execution variables are preserved. Gitleaks keeps its
existing stricter scanner isolation and runs its real installed binary. The unchanged scanner
temporarily uses its own `.tools/scan-*` scratch directories and removes them.

A preload safety guard denies Node `fetch`/HTTP/socket/DNS operations and writes only a
payload-free network-attempt marker. **Any attempt fails verification**, even if the production
tool catches the exception. Default verified runs have zero markers; the guard does not supply
policy decisions or advisory responses. This is a guard for these current Node paths, **not an
OS-wide network sandbox** for arbitrary native subprocesses.

Terminal output includes the complete presenter explanation. The same safe explanation and
structured MCP result are persisted in the case evidence:

```powershell
# Replace <run-id> with the printed directory name.
Get-Content 'runs\<run-id>\sensitive-information--secret\result.json'
Get-Content 'runs\<run-id>\dependency-risk--offline-block\result.json'
```

Results never serialize input text, remediation candidate contents, or child stderr.
They derive leak assertions from the actual fixture's synthetic marker, email, and protected label
body, and verify that those values never appear in the full production result or receipts.
Test fixtures are nonfunctional synthetic values only.
Setup, transport, policy, side-effect, evidence, or sample-integrity mismatches exit nonzero.
Ignored evidence can be removed manually when no demo is running; retain it locally if needed.

## Limits to say aloud

- **The script explicitly selected Airlock. It does not prove mandatory agent routing.**
- PII/label approval is an unimplemented placeholder; no registered approval tool exists.
- Remediation is a separate rescanned candidate, never implicit permission or automatic publication.
- `dataClass` is caller-supplied, not automatic classification. Catalog selection only writes a
  local stub-model record; it does not switch models or run inference.
- Costs are clearly labeled **synthetic local CLI estimates**, not actual presenter billing.
  Reviewed defaults stay advisory: **$800 threshold, $0.01/AIU**, no spend reservation or enforced budget.
- The sample source, its manifests, and its worktree remain unchanged. No sample test runner is invoked.
- SQLite may emit Node's experimental-feature warning. This is not a gate failure.

## Verification performed

`npm run demo:test`: 9 focused tests passed (complete safe explanation coverage; pinned fixture/change refusal; CLI including inherited
Object-key rejection; environment isolation; allowlisted evidence; path confinement;
dirty/wrong-origin checkout refusal; network-guard refusal; offline listing).

`npm run demo -- --gate all`: 18 cases passed against the current real server and Gitleaks,
including all three sensitive gates using actual sample fixtures, the already-masked header,
explicit replacement, and overage/unavailable cost cases.
Each run records fresh evidence rather than relying on this historical statement.
