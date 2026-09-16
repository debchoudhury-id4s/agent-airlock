# Agent Airlock implementation gap analysis

Scope reviewed: root `README.md`, `docs/prd.md`, non-excluded plugin docs/skills/gate docs, plugin manifests, policies, server/runtime/gates/tools/hooks/tests, and `sandbox/**`. Excluded from evidence and review: `demo/**`, `docs/preflight/**`, and `poc/**`.

Local observations: initial `git status --short` only showed untracked `poc/**`; `plugins\AirlockPlugin\node_modules` and `sandbox\node_modules` were absent; Node was `v24.20.0`; `node --check` passed for every tracked non-excluded `.mjs` file. Plugin and sandbox test suites were not executed because required installed dependencies were absent and this analysis was not allowed to install them.

## Current capability trace

| Capability / workflow | Documented current claim | Code path | Status |
|---|---|---|---|
| Plugin startup and MCP tools | Agency loads `plugin.json`, `.mcp.json` launches the Node MCP server, and tools should list `publish_draft`, `check_intent`, and `select_model`; another doc says current source stops before registration with `TypeError: approvalGate is not a function`. `README.md` lines 216-220, 296-350 | `plugin.json` points at skills and `.mcp.json`; `.mcp.json` starts `server.mjs`; `server.mjs` registers five tools. `plugins/AirlockPlugin/plugin.json` lines 1-8; `plugins/AirlockPlugin/.mcp.json` lines 1-9; `plugins/AirlockPlugin/server.mjs` lines 18-81 | Partially implemented but locally unverifiable; root README contains a stale/blocking startup warning. |
| Secrets draft publication | `publish_draft(content)` scans text and copies clean content to a fixed local outbox; secrets block and receipts avoid raw drafts. `README.md` lines 230-244, 358-371; `plugins/AirlockPlugin/skills/airlock-demo/SKILL.md` lines 8-31 | Strict schema, fixed action/target, broker, `no-secrets-in-drafts`, Gitleaks scanner, fixed outbox. `plugins/AirlockPlugin/tools/publish-draft.mjs` lines 6-35; `plugins/AirlockPlugin/gates/secrets/index.mjs` lines 5-17; `plugins/AirlockPlugin/gates/secrets/scanner.mjs` lines 52-79 | Implemented by code; unable to verify execution because dependencies and scanner are not installed. |
| Online-write intent check | `check_intent(prompt)` blocks configured online-write intent including `/yolo`, writes only local clearance on allow. `README.md` lines 232-234, 373-386; `plugins/AirlockPlugin/gates/no-online-writes/README.md` lines 1-8, 112-154 | Strict schema, fixed action/target, regex rules, local clearance executor. `plugins/AirlockPlugin/tools/check-intent.mjs` lines 6-35; `plugins/AirlockPlugin/gates/no-online-writes/index.mjs` lines 23-48; `plugins/AirlockPlugin/gates/no-online-writes/rules.json` lines 1-14 | Implemented by code; unable to verify MCP execution because dependencies are not installed. |
| Model catalog | `select_model` selects default, pauses permitted non-default as `approval-required`, blocks blocked/unknown/out-of-boundary choices, calls no model. `README.md` lines 233-235, 388-401; `plugins/AirlockPlugin/gates/model-catalog/README.md` lines 1-10, 115-157 | Strict identifiers, local catalog gate, fixed local selection artifact. `plugins/AirlockPlugin/tools/select-model.mjs` lines 7-43; `plugins/AirlockPlugin/gates/model-catalog/index.mjs` lines 39-80; `plugins/AirlockPlugin/gates/model-catalog/catalog.json` lines 1-23 | Implemented by code; unable to verify MCP execution because dependencies are not installed. |
| Dependency-risk review | Plugin docs claim `review_dependency_change` uses a dated local snapshot and writes an approved local plan only. `plugins/AirlockPlugin/README.md` lines 97-108, 348-354; `plugins/AirlockPlugin/gates/dependency-risk/README.md` lines 3-26 | Registered tool, strict proposal schema, dated snapshot gate, local plan executor. `plugins/AirlockPlugin/server.mjs` lines 57-69; `plugins/AirlockPlugin/tools/review-dependency-change.mjs` lines 6-58; `plugins/AirlockPlugin/gates/dependency-risk/index.mjs` lines 38-79 | Implemented for direct package/version proposals; broader PRD lockfile/transitive review remains optional/future. |
| Trending-cost hook/report | Docs claim hook runs on every prompt and the MCP tool writes a receipt-backed report; default advisory, enforce can block. `plugins/AirlockPlugin/gates/trending-cost/README.md` lines 3-15, 224-237, 239-289 | Hook uses policy evaluator directly; MCP tool uses broker; read-only SQLite aggregation. `plugins/AirlockPlugin/hooks/hooks.json` lines 1-13; `plugins/AirlockPlugin/hooks/trending-cost.mjs` lines 16-39; `plugins/AirlockPlugin/tools/trending-cost.mjs` lines 11-62; `plugins/AirlockPlugin/gates/trending-cost/usage.mjs` lines 123-170 | Partially implemented; automatic hook decisions have no durable Airlock receipt. |
| Sandbox configuration kit | Docs claim preview/apply composes sandbox settings, validates JSON inputs, preserves unrelated settings, and writes atomically. `sandbox/README.md` lines 13-16, 33-41, 43-83 | Merge, target resolution, confirmation, atomic temp-then-rename write. `sandbox/scripts/configure.mjs` lines 26-75, 90-117, 129-160 | Implemented for merge/apply mechanics; schema-level validation of sandbox settings is missing. |
| Tests | Docs claim targeted tests and MCP transport tests cover tool behavior. `plugins/AirlockPlugin/README.md` lines 172-180, 277-300; gate docs such as `plugins/AirlockPlugin/gates/no-online-writes/README.md` lines 61-79 | Unit and MCP tests exist for policies, broker, tools, gates, hooks, and sandbox. Examples: `plugins/AirlockPlugin/tests/broker.test.mjs` lines 25-97; `plugins/AirlockPlugin/tests/check-intent.test.mjs` lines 117-150; `plugins/AirlockPlugin/tests/publish-draft.test.mjs` lines 128-166 | Coverage exists in source; not executed in this environment because dependencies are absent. |

## Findings and locally executable opportunities

### P0-1 — Root demo instructions block the primary workflow with a stale startup-failure claim

**Gap/root cause.** The root README presents the local demo as currently stopped before tool registration by `TypeError: approvalGate is not a function` and tells readers to fix that registry issue before running prompts. `README.md` lines 194-198 and 296-299. The current registry imports `approvalGate` and includes the object directly, not as a function call. `plugins/AirlockPlugin/gates/index.mjs` lines 1-15. `server.mjs` registers five tools. `plugins/AirlockPlugin/server.mjs` lines 18-81.

**Verified fact vs inferred risk.** Verified: code no longer contains the documented `approvalGate()` startup call. Inferred risk: a hackathon operator following the root README will stop to fix a non-existent issue or claim the plugin cannot start even if dependencies are installed.

**Impact.** Breaks the primary documented demo path and undermines local evidence before any gate can be shown.

**Affected components.** Root README, startup/runbook instructions, minimum demo script.

**Smallest complete local fix.** Hackathon shortcut: update only root README startup/demo lines to reflect current registration state and replace the stale warning with a concrete local preflight command. Production-shaped: add `npm run verify:startup` that starts the MCP server via the same `.mcp.json` path and lists registered tools, then cite that command in README.

**Effort.** `<1 hour` for doc correction; `half day` with startup verification command.

**Dependencies.** None; should precede live demo work.

**Focused verification.** With dependencies already installed, run the new startup check and confirm the listed tools are `check_intent`, `publish_draft`, `review_dependency_change`, `select_model`, and `trending_cost`.

### P1-1 — Startup can appear healthy while the secrets gate is unusable

**Gap/root cause.** The server constructs and registers `publish_draft` without checking that the pinned scanner exists and reports the expected version. `plugins/AirlockPlugin/server.mjs` lines 13-30. The scanner verification only happens inside `scan()` during the first publish attempt, where a missing or wrong binary becomes `scanner-failed`. `plugins/AirlockPlugin/gates/secrets/scanner.mjs` lines 52-72. Docs tell users to allow/list tools and then run prompts, while setup downloads the scanner separately. `README.md` lines 318-350; `plugins/AirlockPlugin/setup.mjs` lines 17-48.

**Verified fact vs inferred risk.** Verified: `plugins\AirlockPlugin\node_modules` is absent locally, and the scanner is a runtime dependency installed by `npm run setup`. Inferred risk: after partial setup, Agency can list tools but the first secrets demo fails with a scanner error rather than a preflight failure.

**Impact.** Core `publish_draft` workflow is unreliable and may fail during presentation after the host has already exposed the tool.

**Affected components.** `server.mjs`, `setup.mjs`, secrets scanner, docs, tests.

**Smallest complete local fix.** Hackathon shortcut: add `npm run health` that verifies dependencies, Gitleaks version, policy/gate registration, and tool list without publishing. Production-shaped: register an `airlock_health` read-only MCP tool and fail startup or mark unhealthy if required local components are missing.

**Effort.** `half day`.

**Dependencies.** P0-1 doc correction should point to this check.

**Focused verification.** Delete or rename `.tools\gitleaks.exe`, run the health command, and confirm it fails before a user can claim the secrets demo is ready; restore it and confirm health passes.

### P1-2 — Completion-receipt failure is misclassified as executor failure after a side effect may already have occurred

**Gap/root cause.** The broker sets `execution = "completed"` immediately after the executor returns, then appends the completion receipt inside the same `try` block. If that append fails, the `catch` returns `reason: "execution-failed"` even though the local artifact may have been written successfully. `plugins/AirlockPlugin/runtime/broker.mjs` lines 69-81. The sequence diagram promises artifact save or explicit failure, append execution outcome, then return local artifact on success or error. `README.md` lines 281-288.

**Verified fact vs inferred risk.** Verified: the catch block cannot distinguish executor failure from completion-receipt write failure. Inferred risk: callers and reviewers may treat a successful local write as failed, and the evidence trail may lack the completed event for an action that actually ran.

**Impact.** Invalidates evidence for allowed actions and makes retry guidance unsafe because duplicate local artifacts or confusing state may exist.

**Affected components.** `runtime/broker.mjs`, broker tests, tool failure mapping.

**Smallest complete local fix.** Production-shaped: split executor and completion-receipt phases. Return `execution: "completed"`, `reason: "completion-receipt-failed"`, and safe artifact metadata when the executor succeeded but receipt append failed; reserve `execution-failed` for thrown executors. Hackathon shortcut: at minimum, change the reason/message when `execution === "completed"` in the catch.

**Effort.** `half day`.

**Dependencies.** None.

**Focused verification.** Add a broker test where the executor returns an artifact and appending to the receipt path fails; assert the result says execution completed but evidence is incomplete, and does not call the executor twice.

### P1-3 — Policy identity does not fingerprint effective rule and gate code

**Gap/root cause.** The policy evaluator computes `policySha256` from the parsed policy JSON only. `plugins/AirlockPlugin/runtime/policies.mjs` lines 73-77. Plugin docs explicitly state the hash covers policy JSON, not every module or detector file, and full immutable rule bundles are future work. `plugins/AirlockPlugin/README.md` lines 323-327. Yet receipts are described as containing policy identity, rule IDs, line numbers, and action fingerprints. `plugins/AirlockPlugin/README.md` lines 68-72.

**Verified fact vs inferred risk.** Verified: detector/config files such as `gates\secrets\gitleaks.toml`, `gates\no-online-writes\rules.json`, and `gates\model-catalog\catalog.json` are outside the policy hash named in receipts. Inferred risk: two runs can record the same policy identity while evaluating different local rule content.

**Impact.** Weakens auditability and replay trust for every gate; especially important when a presentation claims deterministic, evidence-backed decisions.

**Affected components.** `runtime/policies.mjs`, gate factories, policy JSON, receipt schema, tests.

**Smallest complete local fix.** Hackathon shortcut: add a `ruleBundleSha256` computed at startup from the known local JSON/TOML rule files and include it in receipts. Production-shaped: have each gate expose a stable `ruleIdentity` with version/hash/source labels and include all identities in policy evaluation and receipts.

**Effort.** `1 day`.

**Dependencies.** None.

**Focused verification.** Change a local rule fixture in a test without changing `policies/default.json`; assert the receipt rule-bundle hash changes while policy hash stays stable.

### P1-4 — Enforced trending-cost hook blocks prompts without durable Airlock evidence

**Gap/root cause.** The docs say the automatic hook can block prompts in enforce mode. `plugins/AirlockPlugin/gates/trending-cost/README.md` lines 239-264. They also state the automatic hook does not create a receipt; only the manual MCP report uses the broker. `plugins/AirlockPlugin/gates/trending-cost/README.md` lines 224-237. Code confirms the hook calls `createPolicyEvaluator` directly and emits JSON output, bypassing `createBroker`. `plugins/AirlockPlugin/hooks/trending-cost.mjs` lines 16-39.

**Verified fact vs inferred risk.** Verified: enforce-mode prompt blocks have no per-action receipt path. Inferred risk: the user can see a CLI block but cannot later inspect the same durable evidence format used by MCP tools.

**Impact.** Evidence model is inconsistent across a documented current gate and weakens the “why was this blocked?” workflow.

**Affected components.** `hooks/trending-cost.mjs`, `tools/trending-cost.mjs`, `runtime/broker.mjs`, trending-cost tests/docs.

**Smallest complete local fix.** Hackathon shortcut: hook writes a redacted JSONL hook receipt to `~\.agent-airlock\outbound-demo\receipts` with no prompt text, using the same action hash and policy identity fields. Production-shaped: route hook decisions through a broker mode that supports decision receipts without executor side effects.

**Effort.** `1 day`.

**Dependencies.** P1-3 if rule-bundle identity is added.

**Focused verification.** Set `mode: "enforce"` and `monthToDateLimitUsd: 0` in a test fixture; run the hook; assert it emits a block and writes a receipt with policy identity, action hash, aggregate-only input, and no prompt text.

### P2-1 — Current documentation claims disagree about which workflows are implemented

**Gap/root cause.** Root README says the repository currently implements local secret, online-write-intent, and model-catalog gates. `README.md` lines 98-103. Later its current tool map lists those three plus a policy-only approval entry, but omits `review_dependency_change` and `trending_cost`. `README.md` lines 228-235. Plugin docs and `server.mjs` claim/register five tools and a prompt hook. `plugins/AirlockPlugin/README.md` lines 7-12 and 15-16; `plugins/AirlockPlugin/server.mjs` lines 57-81; `plugins/AirlockPlugin/hooks/hooks.json` lines 1-13.

**Verified fact vs inferred risk.** Verified: documentation surfaces disagree. Inferred risk: reviewers may not exercise dependency-risk and trending-cost workflows, or may report them missing despite code and plugin docs.

**Impact.** Materially reduces reproducibility and coverage of the documented hackathon surface.

**Affected components.** Root README current scope/tool map, plugin README cross-links.

**Smallest complete local fix.** Hackathon shortcut: update the root README tool/gate map to include `review_dependency_change` and `trending_cost`, with clear “manual MCP receipt” versus “automatic hook no receipt today” labels. Production-shaped: generate the tool map from a checked-in manifest consumed by tests.

**Effort.** `<1 hour` shortcut; `half day` production-shaped.

**Dependencies.** P0-1.

**Focused verification.** A doc test or small script compares the README table entries to the registered tool names in `server.mjs` and fails if they diverge.

### P2-2 — Setup remains network-dependent and lacks an offline-ready path for the secrets workflow

**Gap/root cause.** Setup downloads Gitleaks from GitHub at install time. `plugins/AirlockPlugin/setup.mjs` lines 17-48. Root and plugin docs require `npm ci`, `npm run setup`, and tests before use. `README.md` lines 318-329; `plugins/AirlockPlugin/README.md` lines 18-31. Gate-specific docs also include online `git pull` setup steps. `plugins/AirlockPlugin/gates/model-catalog/README.md` lines 29-38; `plugins/AirlockPlugin/gates/no-online-writes/README.md` lines 26-35.

**Verified fact vs inferred risk.** Verified: no dependencies are installed locally, and the setup path needs network unless artifacts are already present. Inferred risk: a no-network or conference Wi-Fi environment cannot bring up the secrets demo from a fresh clone.

**Impact.** Materially disrupts local hackathon readiness for a core documented workflow.

**Affected components.** `setup.mjs`, package scripts, README/gate setup docs, tests.

**Smallest complete local fix.** Hackathon shortcut: add a checked-in synthetic scanner mode for the Airlock marker only, clearly labeled demo-only, so `publish_draft` can be verified offline without Gitleaks. Production-shaped: support a local `AIRLOCK_GITLEAKS_ARCHIVE` or `--archive` setup option that verifies the same pinned checksums without network.

**Effort.** `1 day`.

**Dependencies.** P1-1 health check should report which scanner mode is active.

**Focused verification.** On a machine with no `.tools` and no network, run the targeted publish-draft test using the demo-only scanner fixture; separately test that checksum-pinned archive setup installs real Gitleaks when a local archive is supplied.

### P2-3 — Sandbox “validates all JSON inputs” is only JSON-object/prototype validation, not sandbox-schema validation

**Gap/root cause.** Sandbox docs claim the tool validates all JSON inputs. `sandbox/README.md` lines 64-65. Code validates that JSON parses to an object and blocks prototype-polluting keys, but does not validate recognized sandbox keys or value types. `sandbox/scripts/configure.mjs` lines 40-59 and 62-75. Supplied configs are simple JSON objects. `sandbox/configurations/base.json` lines 1-9; `sandbox/configurations/overrides/developer.json` lines 1-15; `sandbox/configurations/overrides/restricted.json` lines 1-15.

**Verified fact vs inferred risk.** Verified: an override can contain unknown settings or wrong value types and still be merged/written if it is valid JSON. Inferred risk: operators may believe they applied containment that Copilot ignores or interprets differently.

**Impact.** Weakens the optional host-containment workflow and can produce misleading local evidence about sandbox restrictions.

**Affected components.** `sandbox/scripts/configure.mjs`, sandbox tests, sandbox README.

**Smallest complete local fix.** Production-shaped: add a local schema for the subset of sandbox settings this kit supports (`enabled`, `allowBypass`, `addCurrentWorkingDirectory`, MCP/LSP flags, auth booleans, network booleans, filesystem arrays of absolute paths) and reject unknown keys unless explicitly under a documented pass-through object. Hackathon shortcut: change docs to say “valid JSON object and unsafe key validation” and add a `--strict` validator for supplied templates.

**Effort.** `half day`.

**Dependencies.** None.

**Focused verification.** Add a test with `{ "sandbox": { "userPolicy": { "network": { "allowOutbound": "no" } } } }` and assert strict mode rejects it before writing.

### P2-4 — No single deterministic reset/scenario runner exists for local evidence

**Gap/root cause.** Docs instruct users to inspect accumulated artifact directories after each demo. `plugins/AirlockPlugin/gates/no-online-writes/README.md` lines 125-141; `plugins/AirlockPlugin/gates/model-catalog/README.md` lines 128-143; `plugins/AirlockPlugin/gates/trending-cost/README.md` lines 216-237. Broker writes UUID-named receipts/artifacts under a shared root. `plugins/AirlockPlugin/runtime/broker.mjs` lines 7-23 and 56-67. There is no reset command or scenario runner in package scripts beyond `setup` and `test`. `plugins/AirlockPlugin/package.json` lines 7-10.

**Verified fact vs inferred risk.** Verified: stale files are expected to persist and docs use directory listings as evidence. Inferred risk: repeated rehearsals can make it hard to tell which receipt/artifact belongs to the current run.

**Impact.** Reduces trustworthiness and repeatability of local demo evidence, though random IDs and `wx` reduce collision risk.

**Affected components.** Package scripts, broker data root, demo docs/tests.

**Smallest complete local fix.** Hackathon shortcut: add `npm run reset:demo` that deletes only `~\.agent-airlock\outbound-demo` after an explicit confirmation or `--yes`, and `npm run demo:local` that runs the fixed synthetic calls and prints new receipt paths. Production-shaped: add a run ID grouping directory and manifest so reset can target one run without deleting prior evidence.

**Effort.** `half day` shortcut; `1 day` production-shaped.

**Dependencies.** P1-1 health check.

**Focused verification.** Run reset, run the scenario, assert exactly the expected new outbox/clearance/model/dependency receipt counts and no extra stale files are present.

### P3-1 — Startup/configuration errors are fail-closed but not consistently actionable

**Gap/root cause.** `server.mjs` catches only `server.connect()` failures and emits a generic setup message. `plugins/AirlockPlugin/server.mjs` lines 83-88. Policy/gate construction happens before that `try`, so invalid policy/gate configuration throws outside the friendly error path. `plugins/AirlockPlugin/server.mjs` lines 13-17 and 31-57; `plugins/AirlockPlugin/runtime/policies.mjs` lines 58-72. `setup.mjs` also hides the specific caught error behind a generic message. `plugins/AirlockPlugin/setup.mjs` lines 54-57.

**Verified fact vs inferred risk.** Verified: configuration construction errors are not normalized by the server catch. Inferred risk: a local operator gets a raw stack or generic message instead of “policy references unregistered gate X” or “Gitleaks missing.”

**Impact.** Slows recovery but does not itself permit execution.

**Affected components.** `server.mjs`, `setup.mjs`, startup tests/docs.

**Smallest complete local fix.** Production-shaped: move all composition into a `main()` wrapped in a top-level catch that prints safe error codes plus remediation, and keep raw details only behind a local debug flag. Hackathon shortcut: include `error.message` when it matches reviewed safe startup/setup errors.

**Effort.** `<1 hour`.

**Dependencies.** Complements P1-1.

**Focused verification.** Temporarily load a fixture policy with an unregistered gate in a test and assert startup exits nonzero with a safe actionable error, no raw payload, and no registered tools.

## Question coverage

1. Capabilities are classified in the trace table above as implemented, partial, misleading, untested, or unverifiable.
2. Command/path/tool/prompt mismatches are captured by P0-1, P2-1, P2-2, and P2-4.
3. Plugin/gate/policy/tool registration is evidenced in the trace table; execution is unverifiable locally without installed dependencies.
4. Startup surfacing gaps are P1-1 and P3-1.
5. Tool input validation is strict in the reviewed tools: `publish_draft`, `check_intent`, `select_model`, `review_dependency_change`, and `trending_cost` schemas reject unknown fields before broker calls. `plugins/AirlockPlugin/tools/publish-draft.mjs` lines 6-21; `plugins/AirlockPlugin/tools/check-intent.mjs` lines 6-21; `plugins/AirlockPlugin/tools/select-model.mjs` lines 7-23; `plugins/AirlockPlugin/tools/review-dependency-change.mjs` lines 6-30; `plugins/AirlockPlugin/tools/trending-cost.mjs` lines 11-37.
6. Oversized/malformed tool payloads are blocked by schemas/content checks; gate-level malformed outputs fail closed through policy result validation. `plugins/AirlockPlugin/runtime/policies.mjs` lines 22-42 and 87-91.
7. Caller-controlled policy/gate/target/output selection was not found in tool schemas; fixed targets/executors are used by tool code. `plugins/AirlockPlugin/tools/publish-draft.mjs` lines 22-29; `plugins/AirlockPlugin/tools/check-intent.mjs` lines 22-29; `plugins/AirlockPlugin/tools/select-model.mjs` lines 24-35.
8. Broker snapshots/freezes actions and passes the same snapshot to evaluation/execution. `plugins/AirlockPlugin/runtime/broker.mjs` lines 25-35 and 69-75; `plugins/AirlockPlugin/runtime/policies.mjs` lines 52-55.
9. All policy-bound gates are evaluated and precedence is deterministic. `plugins/AirlockPlugin/runtime/policies.mjs` lines 84-100.
10. Decision semantics are mostly consistent; P1-2 covers completion-receipt/executor ambiguity.
11. Non-allow decisions return before execution. `plugins/AirlockPlugin/runtime/broker.mjs` lines 61-68.
12. Policy precedence prevents allow-shaped overrides. `plugins/AirlockPlugin/runtime/policies.mjs` lines 93-100.
13. Gate failures become `error` checks, not allows. `plugins/AirlockPlugin/runtime/policies.mjs` lines 87-91.
14. Initial receipt-writing failure prevents execution. `plugins/AirlockPlugin/runtime/broker.mjs` lines 61-67; P1-2 covers completion receipt failures after execution.
15. Executor failure is not reported as successful completion; P1-2 covers the reverse ambiguity. `plugins/AirlockPlugin/runtime/broker.mjs` lines 69-81.
16. Receipts distinguish allowed/blocked/completed/error events, but P1-2 and P1-4 identify gaps.
17. Results/receipts generally avoid raw prompt/draft content; tests assert redaction in several cases. `plugins/AirlockPlugin/tests/publish-draft.test.mjs` lines 53-70; `plugins/AirlockPlugin/tests/check-intent.test.mjs` lines 33-53.
18. Action fingerprints/policy identity exist; P1-3 covers insufficient rule/gate identity.
19. P1-3 addresses policy/rule changes after startup.
20. Local artifacts are written only inside fixed executor paths after allow. `plugins/AirlockPlugin/runtime/broker.mjs` lines 61-75; tool executors cited in question 7.
21. UUID filenames and `wx` reduce traversal/collision; P2-4 covers stale evidence confusion. `plugins/AirlockPlugin/runtime/broker.mjs` lines 1-7, 56-67.
22. MCP transport tests exist in source for registered tools. `plugins/AirlockPlugin/tests/publish-draft.test.mjs` lines 128-166; `plugins/AirlockPlugin/tests/check-intent.test.mjs` lines 117-150; `plugins/AirlockPlugin/tests/select-model.test.mjs` lines 114-149; `plugins/AirlockPlugin/tests/dependency-risk.test.mjs` lines 131-160; `plugins/AirlockPlugin/tests/trending-cost.test.mjs` lines 250-282.
23. Tests cover success/block/ask-first/malformed/gate failure/receipt failure/executor failure for core paths; P1-2 asks for a more precise completion-receipt failure test.
24. Zero execution after non-allow is covered by broker and tool tests. `plugins/AirlockPlugin/tests/broker.test.mjs` lines 45-70.
25. Tests verify returned results and persisted evidence for several tools. `plugins/AirlockPlugin/tests/publish-draft.test.mjs` lines 53-70; `plugins/AirlockPlugin/tests/select-model.test.mjs` lines 30-59.
26. Skills specify exact guarded tool calls; source enforcement is server-side. `plugins/AirlockPlugin/skills/airlock-demo/SKILL.md` lines 8-31; `plugins/AirlockPlugin/skills/airlock-intent-demo/SKILL.md` lines 8-29; `plugins/AirlockPlugin/skills/airlock-model-demo/SKILL.md` lines 8-31.
27. Skills explicitly forbid shell/alternate publisher substitution. Same skill citations as question 26 plus `plugins/AirlockPlugin/skills/trending-cost/SKILL.md` lines 12-29.
28. Documentation claims exceeding enforcement are primarily PRD core/future scope and root README disagreements; see trace table and P2-1.
29. Limits are clearly stated for plugin-only enforcement, shell/native tools, model picker, sandbox boundaries, and local estimates. `README.md` lines 167-179; `plugins/AirlockPlugin/README.md` lines 365-389; `sandbox/README.md` lines 132-148.
30. Hackathon-disrupting failures are P0-1, P1-1, P1-2, P1-4, P2-2, and P2-4.
31. Deterministic offline start/verify/exercise/reset is incomplete: syntax checks ran, but no dependency-free startup/test/reset path exists; see P1-1, P2-2, P2-4.
32. Fragile/network-dependent setup is P2-2; sandbox validation fragility is P2-3.
33. Missing local health/startup/reset/scenario checks are P1-1 and P2-4.
34. All recommendations are local-only and avoid external permissions, cloud services, production credentials, and live APIs.
35. Each finding labels hackathon shortcut versus production-shaped local improvement.
36. Minimum hackathon-ready cutoff is below.

## Minimum hackathon-ready cutoff

Dependency-aware smallest set, in order:

1. Fix the root README startup/tool-map contradictions so the demo operator follows the current five-tool implementation instead of a stale failure path. Depends on none. Covers P0-1 and P2-1.
2. Add/run an offline local health check that verifies Node version, installed npm dependencies, policy/gate registration, scanner readiness or explicit demo-scanner mode, hook registration, and registered MCP tools before the live demo. Depends on P0-1. Covers P1-1 and P3-1.
3. Make secrets scanning demoable offline: either pre-stage a checksum-verified local Gitleaks archive consumed by setup or enable a clearly labeled synthetic-marker-only scanner mode for the hackathon. Depends on health check reporting the active scanner mode. Covers P2-2.
4. Add a reset/scenario runner that clears only Airlock demo output, runs the documented fixed calls, and prints the newly created receipt/artifact paths. Depends on health check. Covers P2-4.
5. Fix broker completion-receipt ambiguity before relying on evidence from allowed actions. Depends on none. Covers P1-2.
6. For enforce-mode trending-cost, either keep the hackathon in default advisory mode and label the enforce path as not evidence-complete, or write hook decision receipts before claiming enforced prompt blocks are auditable. Depends on rule identity only if P1-3 is also implemented. Covers P1-4.

Recommended but not required for minimum demo: rule-bundle hashes (P1-3) and strict sandbox schema validation (P2-3).

## Verification performed and limitations

Performed:

- `git status --short` and `git diff --stat` at start: only pre-existing untracked `poc/**` was present.
- `git ls-files -- ':!demo/**' ':!docs/preflight/**' ':!poc/**'` to enumerate tracked non-excluded files.
- Read non-excluded docs/source/tests only, except the permitted prompt file.
- `node --check` passed for every tracked non-excluded `.mjs` file.

Not run:

- `npm test` in `plugins\AirlockPlugin`: `plugins\AirlockPlugin\node_modules` was absent; installing dependencies is disallowed.
- Targeted plugin tests and MCP startup: same missing dependencies; scanner setup would require download unless already staged.
- Sandbox tests: `sandbox\node_modules` was absent and this analysis avoided test-created temporary artifacts; no install was permitted.
- Agency/Copilot live plugin checks: would require host interaction and installed plugin dependencies.

