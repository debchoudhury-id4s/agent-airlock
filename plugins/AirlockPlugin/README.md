# Airlock plugin: team contribution guide

The shared plugin lives in `plugins\AirlockPlugin` at the repository root.
Any teammate can contribute here. Personal `poc\` folders remain available for
experiments; independent future plugins belong beside this one in `plugins\`.

**Implemented today:** three demo skills, `publish_draft` with a secrets gate,
`check_intent` with a no-online-writes gate, and `select_model` with a model-catalog
gate.
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

### Automatic mission preflight

The plugin evaluates every submitted prompt before the agent starts its turn.
See [Airlock prompt lifecycle](hooks.md) for the concise invocation matrix.
The prompt hook records a redacted mission decision for the Copilot session and
displays one of these transient status messages:

```text
Airlock cleared the mission
Airlock blocked the mission: online-write-intent
```

The `preToolUse` hook enforces that decision. A blocked mission cannot use
tools. A cleared mission may use local tools subject to the host's normal
permissions, but shell commands are checked again and known direct online-write
tools are denied. For example, a locally scoped prompt can read and edit files,
while a later `git push origin main` attempt is denied.

Prompt hooks cannot cancel a model turn, so a blocked prompt may still receive a
text-only response. Tool execution is the enforcement boundary. High-risk
operations should continue to use Airlock's brokered MCP tools so their decision
receipt exists before execution.

Mission state contains no prompt text and is removed when the session ends. A
missing, invalid, or blocked mission state denies tool use. Hook timeouts are a
host-level fail-open behavior, so policy-critical actions must not expose an
unguarded executor as an alternative to the Airlock MCP tool.

#### Hook request lifecycle

| Order | File | Responsibility |
|---|---|---|
| 1 | `hooks\hooks.json` | Registers the three Copilot lifecycle events and launches their Node adapters. `${PLUGIN_ROOT}` is expanded by the host to the installed plugin directory. |
| 2 | `hooks\input.mjs` | Safely reads the JSON event from stdin with a size limit and emits host-compatible progress JSON. |
| 3 | `hooks\user-prompt-submitted.mjs` | Validates the prompt event, immediately replaces stale state with a deny-safe `preflight-in-progress` state, evaluates `check_intent`, persists the redacted result, and shows the status message. |
| 4 | `runtime\airlock.mjs` | Builds the shared policy evaluator and `checkIntent` function used by both hooks and MCP tools. |
| 5 | `runtime\session-state.mjs` | Stores one schema-validated decision per session using a hashed filename and atomic replacement; it never stores prompt text. |
| 6 | `hooks\pre-tool-use.mjs` | Loads the current mission decision for every proposed tool call and converts enforcement results into Copilot's allow/ask/deny protocol. |
| 7 | `runtime\hook-enforcement.mjs` | Denies tools for missing or non-allowed missions, rechecks shell commands, blocks recognizable direct online mutations, and otherwise leaves the host's normal permissions intact. |
| 8 | `hooks\session-end.mjs` | Deletes transient mission state when the session ends without deleting permanent Airlock receipts. |
| Test | `tests\hooks.test.mjs` | Verifies atomic replacement and cleanup, fail-closed missing/blocked state, local-tool fallthrough, shell rechecks, and direct online-write denial. |

Then ask:

> Run the airlock-demo skill. Show the clean draft, the secret block, and the
> attempt to override the rule.

If you previously loaded `poc\neha-bhargava`, restart with the new path. Reinstall
any persistent local installation from the new path rather than keeping a stale copy.
The plugin ID, MCP server name, and demo skill name are unchanged.

Expected results: **published, blocked, blocked**. The secret is a deliberately
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

## Structure

```text
plugins\AirlockPlugin\
  plugin.json                          Copilot plugin manifest
  .mcp.json                            Plugin-relative MCP startup declaration
  agency.json                          Optional Agency metadata
  server.mjs                           Composition and MCP tool registration
  hooks\
    hooks.json                         Prompt, tool, and session lifecycle registration
    user-prompt-submitted.mjs          Automatic mission preflight
    pre-tool-use.mjs                   Fail-closed tool enforcement adapter
    session-end.mjs                    Mission-state cleanup
  runtime\
    airlock.mjs                        Shared policy composition for hooks and MCP tools
    hook-enforcement.mjs               Prompt-state and proposed-tool decisions
    policies.mjs                       Validated gate contracts and decision composition
    broker.mjs                         Check -> receipt -> execute -> outcome
    session-state.mjs                  Redacted per-session mission decisions
  policies\
    default.json                       Versioned tool-to-gate bindings
  gates\
    index.mjs                          Explicit, trusted gate registrations
    secrets\
      index.mjs                        Read-only secrets decision
      scanner.mjs                      Pinned, isolated local scanner adapter
      gitleaks.toml                    Detector rules, including the synthetic marker
    no-online-writes\
      index.mjs                        Read-only online-write intent decision
      rules.json                       Team-specified online-write patterns
    model-catalog\
      index.mjs                        Read-only model/endpoint catalog decision
      catalog.json                     Team defaults, allowed stubs, and blocked choices
  tools\
    publish-draft.mjs                   Input validation and fixed local outbox executor
    check-intent.mjs                    Intent validation and local clearance executor
    select-model.mjs                    Catalog validation and local selection executor
  skills\
    airlock-demo\SKILL.md               Three-call presentation, not enforcement
    airlock-intent-demo\SKILL.md        /yolo cannot authorize online writes
    airlock-model-demo\SKILL.md         Team default vs blocked/non-default models
  tests\
    policies.test.mjs                   Composition and configuration tests
    broker.test.mjs                     Zero-execution and receipt-order tests
    publish-draft.test.mjs              Secrets and actual MCP transport regression tests
    check-intent.test.mjs               Intent, yolo, and MCP transport tests
    hooks.test.mjs                      Mission-state and tool-enforcement tests
    select-model.test.mjs               Catalog, ask-first, and MCP transport tests
  setup.mjs                            Checksum-verified scanner installation
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

Use a separate gate for different semantics, such as destination restrictions,
personal-data handling, budget checks, or dependency review.

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
| `decision` | `allow`, `block`, or `ask-first`; `allow` requires empty findings |
| `reason` | Nonsensitive identifier using the same format as `id`, not free-form payload text |
| `findings` | Array of `{ ruleId, line }`; `line` is a positive integer; never include matched values |
| `failureReason` | Optional static, safe identifier; thrown errors otherwise become `gate-failed` |

For example, this **illustrative, not installed** gate forbids drafts carrying
an internal-only label:

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

Register the exported gate in `gates\index.mjs` alongside `createSecretsGate()`.
Then bind **both** IDs in `policies\default.json`, preserving existing required gates:

```json
{
  "id": "outbound-demo",
  "version": "2",
  "tools": {
    "publish_draft": ["no-secrets-in-drafts", "no-internal-labels"]
  }
}
```

Registering a module alone does not enable it; a policy binding is also required.
Unknown gate IDs, duplicate registrations/bindings, and empty gate lists fail
startup. A tool absent from the policy cannot execute.

All configured gates are evaluated. Precedence is **block > error > ask-first >
allow**; execution requires every gate to allow. An allow cannot cancel a block.
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

Register the tool in `server.mjs` and bind **all** applicable gates in
`policies\default.json`. The executor may return safe result metadata such as an
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
| 3. Share safely | `gates\secrets\`, additional gates and `tools\` | Personal-data/label rules, forbidden destinations, other payload sources; secrets draft demo exists |
| 4. Explain a run | Shared broker receipts | Run context, approval receipts, export, replay; per-action receipts exist |
| 5. Budget/tools (optional) | `select_model`, `gates\model-catalog\` | Script/version checks, budgets and atomic reservations; stub catalog default/ask-first/block exists |
| 6. Security review (optional) | Additional `gates\` and dated local fixtures | Standards/dependency checks and shared review flow |
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

Gitleaks built-in detectors plus the explicit synthetic-marker detector run
before the local copy. Unknown arguments, oversized/non-text input, scanner
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

The plugin uses the legacy Copilot manifest with `.mcp.json` for compatibility
with the installed Agency/Copilot host. All runtime files live here; it does not
depend on source or packages at the repository root.

## Limits

- This is a local publication simulation. Online writes and human approval are
  outside this one-policy demo.
- The plugin protects only its own tools. It cannot stop native shell writes,
  another MCP publisher, or data sent to the agent's model.
- `check_intent` is a keyword/regex intent check, not a sandbox around `git` or `gh`.
- `select_model` does not change Copilot's model picker or call a model API.
- Pattern scanning is not comprehensive DLP. Clean means no configured detector
  matched, not proof that text has no sensitive information.
- The local operator and installed plugin files are trusted. This is not a
  sandbox against another process running as that user.
- Use synthetic content only. Clean artifacts contain the submitted text.
  If execution is unknown or completed but receipt recording failed, inspect the
  outbox before retrying.

No root-level build system or Forge setup is needed. Changes stay local until
explicitly committed and pushed.
