# Always-on mode review

Analyzed on 2026-09-16:

- `origin/main`: `45e9a6530efd4f07a37b76a7d81e97c48c1df758`
- `origin/feature/automatic-airlock-hooks`: `acaf2cec03d058426a037d34baa5c2bd66b44c5a`
- Merge base: `884d5c2a380b7a31ce9be56ee4c622ffa3c346e3`
- Trending-cost implementation commit on `main`: `1143cb8abdb0080eaa6ccf056b6301794918bc8a`

## Bottom line

`origin/feature/automatic-airlock-hooks` is not "all Airlock gates on every
prompt." It is an always-on enforcement scaffold specifically around the
existing `check_intent` / `no-online-writes` policy:

1. Check every submitted prompt for known online-write intent.
2. Persist a redacted allow/block decision for the session.
3. Intercept every proposed tool call.
4. Deny all tools after a blocked, failed, or missing prompt decision.
5. Re-check recognized shell commands and deny some recognized online mutation
   tools.
6. Remove transient session state at session end.

Current `origin/main` does not have that generic `preToolUse` enforcement
boundary. Its only automatic prompt hook is trending-cost, which reads local
usage, reports it by default, and can optionally block the prompt at a monthly
cost threshold.

The feature contains a useful architecture, but it should not be merged as a
stale branch tip. Port and harden the design on top of `main`; do not resolve the
large tip-to-tip diff by accepting the feature side.

## Branch topology and real change size

The branches diverged at `884d5c2`. Since then:

- `main` has 10 unique commits.
- `feature/automatic-airlock-hooks` has one unique commit.
- The feature's actual three-dot change is 18 files, 457 insertions, and 11
  deletions.

The much larger direct tip comparison is misleading: the feature predates
dependency-risk, trending-cost, sensitive-information protection, live NuGet
checks, and later documentation/demo work. Those appear as deletions only
because they do not exist in the older branch.

## What the feature branch does

### 1. Registers three lifecycle hooks

`origin/feature/automatic-airlock-hooks:plugins/AirlockPlugin/hooks/hooks.json`
registers:

- Unfiltered `userPromptSubmitted` -> `user-prompt-submitted.mjs`
- Wildcard `preToolUse` -> `pre-tool-use.mjs`
- `sessionEnd` -> `session-end.mjs`

The feature also adds `"hooks": "./hooks/hooks.json"` to `plugin.json`.

### 2. Runs the existing intent tool for every prompt

The prompt hook validates `sessionId`, `timestamp`, `cwd`, and `prompt`, writes
an interim `error` state, invokes `checkIntent({ prompt })`, then replaces the
state with the result
(`hooks/user-prompt-submitted.mjs`, lines 8-38).

`checkIntent` is not a lightweight gate call. It runs through the broker,
creates a durable decision receipt, and, on allow, creates a local
`cleared-intents/<id>.json` artifact
(`tools/check-intent.mjs`, lines 8-34; `runtime/broker.mjs`, lines 20-81).
Prompt text is evaluated but is not written into either artifact.

The automatic binding is still only:

```text
check_intent -> no-online-writes
```

The branch does not make secret scanning, model selection, approvals, or other
gates automatic. Its own documentation states those still run only through
their corresponding MCP actions
(`hooks.md`, lines 30-43; `policies/default.json`, lines 4-8).

### 3. Persists a redacted mission decision

`runtime/session-state.mjs` hashes the session ID for the file name and stores:

- Session ID
- `allow`, `ask-first`, `block`, or `error`
- Reason
- Prompt timestamp
- Policy ID, version, and hash

It deliberately excludes prompt text and tool arguments
(`runtime/session-state.mjs`, lines 7-22). Writes use a temporary file followed
by rename, and `sessionEnd` removes only this transient state; receipts and
clearance artifacts remain.

### 4. Intercepts proposed tool calls

`runtime/hook-enforcement.mjs`, lines 41-60, applies this sequence:

1. Missing state -> deny.
2. State not `allow` -> deny.
3. Ordinary local tool -> return `{}` and defer to normal host permissions.
4. Recognized shell tool -> extract its command and run `check_intent` again.
5. Recognized online service plus mutation-shaped tool name -> deny.
6. Selected Airlock MCP tool suffixes -> bypass the heuristic because those
   tools are expected to use the broker internally.

This means a prompt such as `git push origin main` causes every later tool to be
denied, while an initially harmless prompt can still have a later
`powershell`/`bash` command re-checked before execution.

### 5. Does not block the model turn

The prompt hook emits only a progress message. It does not emit
`{"decision":"block", ...}`. The branch documentation explicitly says the
model may still produce a text response and identifies `preToolUse` as the real
execution boundary (`hooks.md`, lines 19-20 and 28-29).

Thus "blocked the mission" means "deny subsequent tools," not "prevent the
prompt from reaching the model."

## How it differs from current `main`

| Area | Automatic-hooks branch | Current `main` |
|---|---|---|
| Automatic trigger | Prompt, every tool, session end | Prompt only |
| Automatic policy | `check_intent` / `no-online-writes` | `trending_cost` / `trending-cost` |
| Prompt result | Progress message; model turn continues | Advisory continues; enforce mode emits a prompt block |
| Tool boundary | Wildcard `preToolUse` | None |
| Cross-hook state | Per-session JSON state | None |
| Automatic receipts | Yes, through `checkIntent` broker | No receipt for the automatic cost hook |
| Mainline feature level | Plugin 0.1-era code | Plugin 0.2 plus dependency-risk, trending-cost, sensitive-information, and later fixes |
| Policy set | Default policy version 3 | Default policy version 6 plus separate trending-cost policy |

The feature also centralizes the default evaluator and `checkIntent` in
`runtime/airlock.mjs`, so MCP and lifecycle hooks share one composition root.
Current `main` constructs evaluators in `server.mjs` and constructs a separate
trending-cost evaluator in its prompt hook.

### Integration conflicts

A merge forecast reports overlapping changes in nine files, including:

- `plugins/AirlockPlugin/hooks/hooks.json` (added independently on both sides)
- `plugin.json`
- `gates/index.mjs`
- `policies/default.json`
- `server.mjs`
- Three existing MCP tests
- `plugins/AirlockPlugin/README.md`

The hook registrations must be composed, not selected from one side. The
feature's hook commands also use a single `${PLUGIN_ROOT}` `command`, while
current `main` uses explicit PowerShell/Bash commands with
`COPILOT_PLUGIN_ROOT`. Conversely, the feature's `.mcp.json` still uses the old
`${COPILOT_PLUGIN_ROOT}` placeholder while `main` contains the later
`${PLUGIN_ROOT}` fix. This wiring needs host-level verification after porting.

## How it differs from the trending-cost gate

| Dimension | Automatic Airlock hooks | Trending-cost gate |
|---|---|---|
| Purpose | Prevent Copilot-proposed online writes that match intent/tool heuristics | Surface and optionally cap estimated local Copilot CLI usage |
| Input | Raw prompt; later tool name and arguments | Aggregate rows from local `assistant_usage_events` |
| Data source | Prompt/tool event plus checked-in regex rules | Read-only `~/.copilot/session-store.db` |
| Default behavior | Tool enforcement is active | Advisory only |
| Block point | `preToolUse`; prompt still reaches model | `userPromptSubmitted`; enforce mode can stop prompt before model |
| State | Persists session decision | Stateless per invocation |
| Tool interception | Yes, every proposed tool | No |
| Automatic receipt | Yes, because it calls brokered `checkIntent` | No; only manual `trending_cost` MCP calls use the broker |
| Failure posture | Intended fail-closed for tools | Advisory allows failures by default; enforce can block unavailable usage |
| Scope | Online-write intent only, despite generic branch name | Cost threshold only |

Trending-cost constructs a report, evaluates its dedicated policy, emits a
progress line, and emits a final block object only when the result is `block`
(`hooks/trending-cost.mjs`, lines 16-38). Its policy defaults to:

```json
{
  "mode": "advisory",
  "monthToDateLimitUsd": 800,
  "unavailableBehavior": "allow",
  "usdPerAiu": 0.01
}
```

The gate validates that the report's rate and calculated cost agree with the
reviewed settings, then allows, advises, or blocks at `>=` the threshold
(`gates/trending-cost/index.mjs`, lines 17-48).

The trending-cost documentation explicitly notes that its automatic hook does
not create a receipt; only the optional MCP report does
(`gates/trending-cost/README.md`, lines 224-237). In that respect, the automatic
hooks branch has stronger durable decision evidence, although its receipt is
not linked back to the session-state record.

## Focused review findings

### High: a failed new preflight can reuse an old allow state

The prompt hook first tries to replace prior state with
`preflight-in-progress`. If that write itself fails, the catch path merely emits
"tool use will be denied" and exits (`hooks/user-prompt-submitted.mjs`, lines
17-24 and 42-46).

However, the previous state can remain. `decidePreToolUse` checks only matching
`sessionId` and `decision === "allow"`; it never compares the stored
`promptTimestamp` to the current turn (`runtime/hook-enforcement.mjs`, lines
41-46). The timestamp is stored but unused.

This was reproduced by locking an existing allowed state file and submitting a
new `git push` prompt:

1. The new prompt hook exited with failure.
2. The old `allow` state and old timestamp remained.
3. A subsequent write-shaped ADO tool event received `{}`, meaning Airlock did
   not block it.

The design therefore is not fully fail-closed across prompt transitions.
State must be correlated to an exact host turn/prompt identifier and rejected
on mismatch. If the host cannot supply such an identifier, a previous allow
must never be treated as authorization after a prompt-hook failure.

### High: online-write classification is a bypassable denylist

The classifier recognizes only:

- Shell tool names containing `bash` or `powershell`
- Service names containing `calendar`, `github`, `icm`, `kusto`, `mail`,
  `teams`, or `workiq`
- A fixed set of mutation verbs

(`runtime/hook-enforcement.mjs`, lines 3-6).

Consequences:

- `ado` and `azure` are not service tokens.
- `write` is not a mutation token.
- Other shell identities such as `cmd`, `terminal`, or a newly named executor
  are not necessarily recognized.
- Any tool name ending in a guarded Airlock tool name is trusted by suffix,
  without verifying the MCP server identity (`hook-enforcement.mjs`, lines
  21-28).

Direct probes under an allowed mission returned `{}` for both:

```text
ado-repo_pull_request_write
mail-publish_draft
```

`{}` is not an explicit approval, but it removes Airlock from the decision and
leaves execution to normal host permissions. In permissive/automatic host
modes, this is not a reliable security boundary.

The durable fix is capability-based or exact trusted tool identity
classification, with unknown write-capable tools denied by default. Expanding
the regex lists alone will remain incomplete.

### Medium: prompt-block semantics are weaker than trending-cost enforce mode

For online-write prompts, the feature reports "blocked the mission" but still
lets the prompt reach the model. Trending-cost enforce mode emits a real prompt
block. If "always-on mode" is intended to stop prohibited prompts, the intent
hook should emit an explicit block as well as retaining a `preToolUse` boundary
for writes introduced later by the model.

### Medium: hook integration is under-tested

The feature's five hook tests import and test state/classifier helpers. They do
not parse `hooks.json`, spawn the three hook entry points, validate actual JSON
event/output contracts, or load the plugin through the host
(`tests/hooks.test.mjs`, lines 1-73).

By comparison, trending-cost tests at least inspect the registered unfiltered
prompt hook and spawn its executable
(`tests/trending-cost.test.mjs`, lines 227-248).

Porting should add executable-level tests for:

- Prompt allow and block
- Prompt-hook failure with pre-existing state
- `preToolUse` for known, unknown, and spoofed tool names
- Session cleanup
- Combined intent plus trending-cost behavior
- The exact Windows and non-Windows hook commands

### Medium: audit records are durable but weakly correlated

Every automatic prompt check creates a broker receipt, and allowed prompts also
create a clearance artifact. The session state does not retain the broker
decision ID or receipt path, while the receipt does not retain the session ID.
This preserves privacy but makes it difficult to prove which receipt authorized
a particular session turn.

The automatic trigger also changes enforcement behavior without changing the
underlying default policy identity: automatic and manually requested
`check_intent` actions look the same in policy receipts.

### Operational: always-on intent checks add synchronous disk work

An allowed prompt causes broker receipt writes, a clearance artifact, and
session-state replacement. Receipts and clearance artifacts are not removed at
session end. This is substantially more per-prompt I/O and unbounded local
artifact growth than the stateless trending-cost hook. Retention and latency
should be explicit design choices.

## Recommendation

Do not merge `origin/feature/automatic-airlock-hooks` as-is. Re-implement its
useful pieces on current `main`:

1. Keep all current mainline gates, tools, policies, and root-expansion fixes.
2. Use one reviewed prompt-hook orchestrator for intent and trending-cost, with
   deterministic block precedence and one validated host output contract.
3. Emit a real prompt block for prohibited intent, while retaining
   `preToolUse` to catch writes introduced after an initially harmless prompt.
4. Replace regex/suffix trust with exact tool identities or reviewed capability
   metadata; fail closed for unknown write-capable tools.
5. Bind mission state to the exact turn and make stale state unusable after any
   prompt-hook failure.
6. Link state to a privacy-preserving receipt ID and define retention.
7. Add executable and host-wiring tests before describing the mode as an
   enforcement boundary.

The branch is best treated as a prototype of an always-on execution boundary.
Trending-cost is a narrower, stateless prompt gate. They are complementary, not
alternative implementations, but the prototype needs the two high-priority
fail-closed fixes before it is safe to combine with `main`.
