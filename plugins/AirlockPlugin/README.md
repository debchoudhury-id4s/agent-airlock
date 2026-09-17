# Airlock plugin: team contribution guide

The shared plugin lives in `plugins\AirlockPlugin` at the repository root.
Any teammate can contribute here. Personal `poc\` folders remain available for
experiments; independent future plugins belong beside this one in `plugins\`.

**Implemented today:** five demo skills, `publish_draft` with composed Sensitive
Information Protection (secrets, bounded PII, and explicit INTERNAL-ONLY labels),
`check_intent` with a no-online-writes gate, `select_model` with a model-catalog
gate, `review_dependency_change` with live OSV evidence and a short-lived local cache, and the
automatic advisory `trending-cost` and RFC-relevance prompt hooks.
The runtime supports multiple required gates per tool. Adding a scenario must
reuse its decision checks and receipts, not create a separate enforcement engine.
This implements a small slice of [PRD section 3](../../docs/preflight/prd.md#3-share-content-safely)
and [PRD section 1 item 3](../../docs/preflight/prd.md#1-start-a-safe-mission)
(`/yolo` cannot authorize an online write). There is no approval flow or real
GitHub publication yet.

## Prepare once

Requires Node.js 24, npm, and system `tar`.

```powershell
Set-Location C:\Git\agent-airlock\plugins\AirlockPlugin
npm ci
npm run setup
npm test
```

Setup downloads checksum-pinned Gitleaks 8.30.1 into this plugin's `.tools`.
Scanning is local; payloads are not sent to a scanner service. npm can use your
approved registry mirror without changing the public lockfile.

## Use from your own repository

Start a fresh session in the repository you want to showcase:

```powershell
Set-Location C:\Git\YourRepository
agency copilot --plugin "local:C:\Git\agent-airlock\plugins\AirlockPlugin"
```

Or load it directly with Copilot CLI:

```powershell
copilot --plugin-dir "C:\Git\agent-airlock\plugins\AirlockPlugin"
```

To keep it available across Agency sessions:

```powershell
agency plugin install "local:C:\Git\agent-airlock\plugins\AirlockPlugin" --engine copilot
```

### Automatic prompt and tool enforcement

Every submitted prompt runs both the existing trending-cost evaluation and the
online-write intent preflight. Their most restrictive result is stored as a
redacted per-session mission decision. The `preToolUse` hook denies tools for a
blocked, invalid, or missing mission, rechecks shell commands, and rejects known
direct online mutations. The `sessionEnd` hook removes transient mission state.

Prompt and tool arguments are never stored in mission state. `/yolo` and host
auto-approval do not override an Airlock denial. See [the hook lifecycle](hooks.md)
for the invocation and enforcement boundaries.

Then ask:

> Run the airlock-demo skill. Show the clean draft, secret and override blocks,
> PII and internal-only review pauses, and a token in supplied log text.

If you previously loaded `poc\neha-bhargava`, restart with the new path. Reinstall
any persistent local installation from the new path rather than keeping a stale copy.
The plugin ID, MCP server name, and demo skill name are unchanged.

Expected results: **published, blocked, blocked, blocked, blocked, blocked**.
PII and label checks return `approval-required`; approval is not implemented,
so they never execute. The secret is a deliberately
nonfunctional demo marker, not a real credential. No repository files need to be
read or edited. Grant the host permission to call the plugin's tool if prompted;
that host permission does not bypass the rule inside the tool.

Clean artifacts and redacted JSONL receipts persist under
`~\.agent-airlock\outbound-demo`. Receipts contain policy identity, gate decisions,
rule IDs, line numbers, and action fingerprints, never the draft or matched values.
The first event records permission; a separate `completed` event records execution.
The publishing tool presents successful execution as `published`.

For your own synthetic draft, ask the agent to pass its text to this plugin's
`publish_draft` tool. The only argument is `content`; there is no policy override,
approval tool, destination URL, or arbitrary output path.

The same argument accepts supplied log or display text. Credentials detected by
Gitleaks always block; bounded email, phone, Luhn-valid payment-card and US SSN
patterns plus the explicit label ask-first. No arbitrary console/log interception
is installed. See [exact categories and limits](gates/sensitive-information/README.md).
Gates remain read-only. Optional `remediation` removes an entire flagged field and
rescans a separate replacement candidate; labelled bodies are withheld, not
declassified. No replacement executes automatically. Broker receipts remain
metadata-only, and unrelated gates do not depend on the secret scanner.

To show that `/yolo` cannot authorize an online write, ask:

> Run the airlock-intent-demo skill. Show the local clearance, the online-write
> block, and the yolo override attempt.

Expected results: **cleared, blocked, blocked**. The only argument is `prompt`.
A cleared intent is not permission to push, publish, or send anything online.
The executor writes a local clearance record that does not include the prompt.

To show team-decided models for a task, ask:

> Run the airlock-model-demo skill. Show the default selection, the non-default
> approval pause, and the blocked model.

Expected results: **selected, blocked, blocked**. Non-default permitted models
return `approval-required` because shared approval is not implemented. Nothing
calls a remote model. Arguments are `taskType`, `dataClass`, and optional
`model` / `endpoint`.

To review a proposed MISE dependency version, ask:

> Run the airlock-dependency-demo skill.

Expected result: the `4.88.0-airlock-demo` proposal is **blocked** under
`AIRLOCK-DEMO-001`, and the skill reports only that the upgrade was not
performed. The version and rule are synthetic team-policy data, not a real
package advisory.

The tool records approved plans under `~\.agent-airlock\outbound-demo\dependency-reviews`
and caches package-version-specific OSV results for 24 hours under
`~\.agent-airlock\outbound-demo\dependency-advisories`. It does not edit MISE,
download packages, or run restore. Missing or stale evidence is checked live;
known advisories block, and unavailable evidence requires approval. A real
dependency-edit workflow must invoke it before changing the manifest.

To run the same package/version advisory check directly:

```powershell
Set-Location C:\Git\agent-airlock\plugins\AirlockPlugin
npm run check:nuget -- Microsoft.Identity.Client 4.87.0
```

The `trending-cost` gate needs no demo prompt: while the plugin is loaded, its
`userPromptSubmitted` hook prints local month-to-date estimated cost, today's
estimated cost, and today's token usage before every submitted prompt. To show
the structured result, ask:

> Run the trending-cost skill and show the structured local usage report.

The hook reads `~\.copilot\session-store.db` read-only and makes no network
request. Its reviewed policy is advisory by default. See
[`gates\trending-cost\README.md`](./gates/trending-cost/README.md) for the full
demo and the exact `mode: "enforce"` change that blocks prompts at a configured
month-to-date threshold.

The `rfc-relevance` gate also runs for every submitted prompt. It compares only
the prompt text with the dated, checked-in
[`gates\rfc-relevance\snapshot.json`](./gates/rfc-relevance/snapshot.json).
When a topic such as bearer tokens, JWT validation, PKCE, DPoP, or OAuth mTLS
matches, the hook suggests the mapped RFC Editor documents before design work
continues. This is advisory: a match returns `report`, remains visible, and does
not block the prompt. No match stays silent, and the hook makes no network
request. Update and review the snapshot to add topics or refresh references.

## Structure

```text
plugins\AirlockPlugin\
  plugin.json                          Copilot plugin manifest
  .mcp.json                            Plugin-relative MCP startup declaration
  agency.json                          Optional Agency metadata
  server.mjs                           Composition and MCP tool registration
  runtime\
    airlock.mjs                        Shared default-policy composition
    hook-enforcement.mjs               Proposed-tool allow, ask, or deny decision
    policies.mjs                       Validated gate contracts and decision composition
    broker.mjs                         Check -> receipt -> execute -> outcome
    plain-text.mjs                     Shared 64 KiB valid-text boundary
    prompt-preflight.mjs               Cost and intent decision composition
    sanitize-record-text.mjs           Explicit whole-field sanitizer with candidate rescan
    session-state.mjs                  Redacted per-session mission decision
  policies\
    default.json                       Versioned tool-to-gate bindings
    trending-cost.json                 Advisory/enforce prompt-cost policy
    rfc-relevance.json                 Advisory prompt-to-RFC policy
  hooks\
    hooks.json                         Prompt, tool, and session lifecycle registration
    input.mjs                          Bounded hook input and JSON output helpers
    user-prompt-submitted.mjs          Cost plus intent mission preflight
    pre-tool-use.mjs                   Tool-execution enforcement adapter
    session-end.mjs                    Mission-state cleanup
    trending-cost.mjs                  Reusable cost evaluation and CLI adapter
    rfc-relevance.mjs                  Relevant RFC suggestion adapter
  gates\
    index.mjs                          Explicit, trusted gate registrations
    secrets\
      index.mjs                        Read-only secrets decision
      scanner.mjs                      Pinned, isolated local scanner adapter
      gitleaks.toml                    Detector rules, including the synthetic marker
    sensitive-information\
      index.mjs                        Secrets + independent PII/label review gates
      personal-data.mjs                 Bounded pure personal-data patterns
      internal-label.mjs                Explicit whole-field classification marker
      findings.mjs                      Safe line-only findings and text bounds
      README.md                         Categories, remediation and scope limits
    no-online-writes\
      index.mjs                        Read-only online-write intent decision
      rules.json                       Team-specified online-write patterns
    model-catalog\
      index.mjs                        Read-only model/endpoint catalog decision
      catalog.json                     Team defaults, allowed stubs, and blocked choices
    dependency-risk\
      index.mjs                        Dated package/version decision
      advisory-client.mjs              Live OSV lookup and 24-hour local cache
      validation.mjs                   Shared package/version input grammar
      snapshot.json                    Trusted MISE demo baseline and synthetic rule
      README.md                         Fixture semantics and enforcement boundary
    trending-cost\
      index.mjs                        Advisory/enforce threshold decision
      usage.mjs                        Read-only local usage aggregation
      README.md                        End-to-end demo and enforcement switch
    rfc-relevance\
      index.mjs                        Validated topic matching and recommendations
      snapshot.json                    Dated topic, keyword, and RFC mapping
  tools\
    publish-draft.mjs                   Input validation and fixed local outbox executor
    check-intent.mjs                    Intent validation and local clearance executor
    select-model.mjs                    Catalog validation and local selection executor
    review-dependency-change.mjs        Proposed-version validation and local plan executor
    trending-cost.mjs                   Structured local usage report
  skills\
    airlock-demo\SKILL.md               Six-call presentation, not enforcement
    airlock-intent-demo\SKILL.md        /yolo cannot authorize online writes
    airlock-model-demo\SKILL.md         Team default vs blocked/non-default models
    airlock-dependency-demo\SKILL.md    Single blocked dependency demo
    trending-cost\SKILL.md              Structured cost-report presentation
  tests\
    policies.test.mjs                   Composition and configuration tests
    broker.test.mjs                     Zero-execution and receipt-order tests
    publish-draft.test.mjs              Secrets and actual MCP transport regression tests
    sensitive-information.test.mjs      Categories, safe remediation and rescan tests
    check-intent.test.mjs               Intent, yolo, and MCP transport tests
    select-model.test.mjs               Catalog, ask-first, and MCP transport tests
    dependency-risk.test.mjs            Snapshot, bypass, freshness, and MCP tests
    hooks.test.mjs                      Mission state and tool enforcement tests
    trending-cost.test.mjs              Reader, hook, threshold, and MCP tests
    rfc-relevance.test.mjs             Snapshot, matching, and prompt-hook tests
  setup.mjs                            Checksum-verified scanner installation
  scripts\
    check-nuget-advisory.mjs            Reusable live OSV check and cache refresh
```

A **rule** describes a specific constraint or detector. A **gate** evaluates an
action against those rules. A **policy** binds the required gates to a tool.
A **skill** demonstrates the behavior but cannot authorize it.

```text
MCP tool -> validated action -> policy's required gates -> decision receipt
                                                       -> executor, only if all allow
                                                       -> execution receipt
```

## Add a detector rule to the existing gate

For another credential pattern, edit `gates\secrets\gitleaks.toml`; do not add a
second scanner or change the skill to enforce it.

1. Add a Gitleaks `[[rules]]` entry with a unique, nonsensitive `id`, concise
   description, regex, and appropriate keywords. Follow `airlock-synthetic-secret`.
2. Keep `useDefault = true` and the existing detectors. Avoid broad allowlists.
3. Add synthetic matching and nonmatching cases to `tests\publish-draft.test.mjs`.
   Assert `secret-detected`, no new outbox file, and no matched value in receipts.
   A scanner error is not a successful detector test.
4. Bump `version` in `policies\default.json`, run `npm test`, review the change,
   and restart the plugin session. Never use real credentials as fixtures.

Use separate gates for different semantics. Sensitive Information Protection
already composes secrets blocking with personal-data and internal-label review;
do not replace the pinned scanner with a generic pattern scanner.

## Add another gate

Start with a test, then add `gates\<gate-name>\index.mjs` and any local rule data.
Use `gates\secrets\index.mjs` as the implemented reference. Gates receive a
validated, deeply frozen JSON action:

```javascript
{
  tool: "publish_draft",
  target: "local-review-outbox",
  input: { content: "plain text" }
}
```

Gate contract:

| Field | Contract |
|---|---|
| `id` | Stable unique identifier, at most 64 letters, digits, dots, underscores, or hyphens; start with a letter or digit |
| `evaluate(action)` | Read-only async function; return `{ decision, reason, findings }` |
| `decision` | `allow`, `report`, `block`, or `ask-first`; `allow` requires empty findings and advisory `report` requires findings |
| `reason` | Nonsensitive identifier using the same format as `id`, not free-form payload text |
| `findings` | Array of `{ ruleId, line }`; `line` is a positive integer; never include matched values |
| `failureReason` | Optional static, safe identifier; thrown errors otherwise become `gate-failed` |

For example, this **illustrative, not installed** stricter gate forbids drafts
carrying an internal-only label. Unlike the installed `internal-label-review`
gate's ask-first decision, this example demonstrates an unconditional block:

```javascript
export const internalOnlyGate = Object.freeze({
  id: "no-internal-labels",
  async evaluate(action) {
    const { content } = action.input;
    if (typeof content !== "string") throw new Error("Expected a text action.");
    const line = content.split(/\r?\n/).findIndex(text => /\binternal-only\b/i.test(text));
    return {
      decision: line >= 0 ? "block" : "allow",
      reason: line >= 0 ? "internal-label-detected" : "no-internal-label",
      findings: line >= 0 ? [{ ruleId: "internal-only-label", line: line + 1 }] : [],
    };
  },
});
```

To install the stricter example, register it alongside
`...createSensitiveInformationGates()` in `gates\index.mjs`. Extend the default
bindings without removing required gates (excerpt only; retain other tools):

```json
{
  "id": "outbound-demo",
  "version": "7",
  "tools": {
    "publish_draft": ["no-secrets-in-drafts", "personal-data-review", "internal-label-review", "no-internal-labels"]
  }
}
```

Registering a module alone does not enable it; a policy binding is also required.
Unknown gate IDs, duplicate registrations/bindings, and empty gate lists fail
startup. A tool absent from the policy cannot execute.

All configured gates are evaluated. Precedence is **block > error > ask-first >
report > allow**. `report` permits execution while preserving advisory findings;
an allow or report cannot cancel a block.
`ask-first` currently returns `blocked` / `approval-required` without execution.
It is an extension point, not a working approval mechanism; host auto-approve
does not satisfy it.

Test the new gate's clean, matching, malformed-input, and failure cases. Include
a mixed-policy test showing that another gate's allow does not override its block,
that ask-first cannot execute, and that outputs and receipts contain no raw data.
Use `tests\policies.test.mjs` and `tests\broker.test.mjs` for shared invariants.
Run `npm test` from this folder; Node discovers new `*.test.mjs` files.

## Add a tool or demo scenario

For a new action type, add `tools\<tool-name>.mjs` with a strict input schema.
Normalize and validate the target there; reject unknown fields and unsupported
payloads. Pass `{ tool, target, input }` and a host-owned executor to `createBroker`.
Only that executor may perform the simulated action, using the snapshot passed
to it. Never perform writes inside a gate or before calling the broker.

Register the tool in `server.mjs` and bind **all** applicable gates in the
appropriate file under `policies\`. The executor may return safe result metadata such as an
artifact path; never return raw sensitive content. Gate, policy, approval, output
path, and executor selection must not be caller-controlled tool arguments.

A new presentation goes in `skills\<scenario>\SKILL.md`. It should call the guarded
tools, use synthetic data, show actual decisions, and stop if a tool is unavailable.
It must not substitute shell writes or another publisher after a block.
Add an MCP integration test; a unit test of the gate alone does not prove that
the new tool actually invokes it.

## PRD contribution map

These are contribution areas, not claims that the listed features already work.
Create new modules only when implementing them; there are no allow-all placeholders.

| PRD area | Extend | Still to build |
|---|---|---|
| 1. Safe mission | `runtime\`, `policies\`, `check_intent`, `gates\no-online-writes\` | Mission confirmation, contract narrowing, complete rule snapshots, dry run, helpers; `/yolo` cannot authorize online-write intent |
| 2. Approve or stop | Shared `runtime\broker.mjs` before execution | Exact-action single-use approvals, expiry/recheck, protected targets, local stop |
| 3. Share safely | `gates\sensitive-information\`, `gates\secrets\`, `runtime\sanitize-record-text.mjs`, `tools\` | Forbidden destinations and other payload sources; secrets, bounded PII/labels and separate rescanned whole-field replacements exist |
| 4. Explain a run | Shared broker receipts | Run context, approval receipts, export, replay; per-action receipts exist |
| 5. Budget/tools (optional) | `select_model`, `gates\model-catalog\`, `trending_cost`, `gates\trending-cost\` | Script/version checks, planned budgets, and atomic reservations; model catalog plus automatic local usage reporting exist |
| 6. Security review (optional) | `review_dependency_change`, `gates\dependency-risk\`, and dated local fixtures | Transitive graph review, real advisory ingestion, standards checks, and shared review flow; direct-version demo exists |
| 7. Research reuse (optional) | New local research-store module and guarded `tools\` | Provenance, freshness, access checks and conflict retention |

Prefer separate module/test changes per contributor. Coordinate edits to
`gates\index.mjs`, `policies\default.json`, and `server.mjs`, which are shared
integration points. Keep all optional features inactive until their enforcement
and failure-path tests exist. Do not implement approvals, budgets, or evidence
storage separately inside each gate.

Policy bindings are copied and fingerprinted when the MCP server starts. Their
hash covers the policy JSON, **not** every module or detector file. Full immutable
rule bundles and PRD run snapshots are still future work. Review all code/rule
changes, increment the policy version, and restart rather than editing a running
demo's scanner configuration. Installed plugin files remain trusted.

## What is enforced

Gitleaks built-in detectors plus the explicit synthetic-marker and contextual
token detectors block credential matches before the local copy. Independent
bounded PII and explicit INTERNAL-ONLY label gates require review and do not
execute. Unknown arguments, oversized/non-text input, scanner/detector
failures, and decision-receipt failures cannot publish. Repository instructions,
personal instructions, and text inside the draft do not participate in this
decision.

`check_intent` applies team-specified online-write patterns to the user prompt.
A match is blocked even when the prompt also contains `/yolo`, auto-approve, or
"do everything automatically". `/yolo` alone does not grant rights and does not
block local-only work. The tool never performs a network write.

`select_model` uses the local stub catalog. Omitting `model` records the default
for that task and data class. A permitted non-default is `ask-first` (currently
blocked as `approval-required`). Unknown models, blocked models, forbidden
endpoints, and task/data pairs outside the catalog are blocked. No remote model
is called.

`review_dependency_change` checks a direct NuGet package/version proposal against
the trusted dated snapshot. Approved versions produce a local review plan;
synthetic blocked versions cannot execute unless the snapshot explicitly allows
the documented bypass. Unknown packages or versions and expired evidence are
`ask-first` (currently blocked as `approval-required`). The receipt records
`synthetic-bypass-used`, but never the caller's bypass reason or package value.

`trending-cost` and `check_intent` run from a composed `userPromptSubmitted`
hook before every submitted prompt. It prints local month-to-date cost, today's
cost, and today's tokens, then stores the most restrictive prompt decision for
`preToolUse`. The default cost policy is advisory; `mode: "enforce"` blocks when
month-to-date estimated cost is greater than or equal to the configured limit.
The source database is opened read-only and no billing or network API is called.

The plugin uses the legacy Copilot manifest with `.mcp.json` for compatibility
with the installed Agency/Copilot host. All runtime files live here; it does not
depend on source or packages at the repository root.

## Limits

- This is a local publication simulation. Online writes and human approval are
  outside this one-policy demo.
- The pre-tool hook rechecks supported shell tools and recognizes known online
  mutation tool names. This is pattern-based enforcement, not a complete
  capability sandbox, and it does not protect data sent to the agent's model.
- `check_intent` is a keyword/regex intent check, not a sandbox around `git` or `gh`.
- `select_model` does not change Copilot's model picker or call a model API.
- `review_dependency_change` does not intercept arbitrary prompts, edit manifests,
  resolve transitive dependencies, query advisories, or run restore. Workflows
  must call it before performing a dependency change.
- The dependency snapshot is a deterministic demo fixture, not proof that an
  approved version is secure or that a blocked version is vulnerable.
- `trending-cost` is a local Copilot CLI estimate, not an invoice or an
  account-wide total. Disabled or timed-out hooks are outside its enforcement
  guarantee.
- Pattern scanning is not comprehensive DLP. Clean means no configured detector
  matched, not proof that text has no sensitive information.
- Sensitive-information checks cover only text explicitly supplied to
  `publish_draft`, not arbitrary logs/console output. No names, addresses,
  comprehensive global IDs, attachments or encoded-content decoding. See the
  [bounded rules and false positives](gates/sensitive-information/README.md).
- The reusable record/display sanitizer handles an entire supplied field, not
  arbitrary nested objects. Never split a confidentiality label from its body.
  It returns candidates, not execution permission; all new drafts are checked again.
- The local operator and installed plugin files are trusted. This is not a
  sandbox against another process running as that user.
- Use synthetic content only. Clean artifacts contain the submitted text.
  If execution is unknown or completed but receipt recording failed, inspect the
  outbox before retrying.

No root-level build system or Forge setup is needed. Changes stay local until
explicitly committed and pushed.
