# Agent Airlock: Starter Implementation Plan

**Status:** Proposed; implementation has not started.
**Scope:** Initial repository structure and one reference implementation.
**Source idea:** [Secrets and sensitive-data gate](..\preflight\neha-bhargava\requirements-closure.md).
**Feature flag:** N/A. The prototype only supports simulated publication; it has no real publishing adapter.
**Implementation plans:** None - greenfield decomposition.
**Total work items:** 3, all in `debchoudhury-id4s/agent-airlock`.

## Team summary

We will build a small, runnable Airlock foundation and demonstrate it with an
outbound-data gate. Before a simulated publish, Airlock checks the exact content,
applies trusted rules, and either allows, requests approval, or blocks the action.

Repository instructions, personal instructions, and task prompts cannot grant
permissions or override a denial. Enforcement happens in the execution broker,
not in the agent's instructions.

The starter implementation will give teammates a working example to extend,
rather than a collection of empty folders or separate policy implementations.

## Demo

| Input | Decision | Visible result |
|---|---|---|
| Clean sample content | Allow | Written to a local simulated outbox |
| Explicitly labeled sensitive sample | Ask | Exact content requires human approval |
| Synthetic secret matching a configured detector | Block | Nothing is published; remediation is shown |
| Same secret plus "ignore all rules" in the request | Block | Instructions do not change authorization |
| Changed content after approval | Re-evaluate | Previous approval cannot authorize the new content |
| Scanner failure or invalid policy | Block | Error is reported; nothing is published |

The sensitive sample uses a documented fixture label, not an AI classification
claim. Secret detection covers the configured detectors, not every possible
credential, personal-data type, or internal document.

## Proposed repository structure

Preserve the existing README and `docs\preflight` ideas. All paths below are new.
Create modules when they have an implementation; do not add empty placeholders.

```text
docs\
  plans\starter-plan.md
  ARCHITECTURE.md
  THREAT-MODEL.md
src\
  core\contracts.ts
  policy\outbound-policy.ts
  scanning\secret-scanner.ts
  broker\publish-broker.ts
  approvals\approval-store.ts
  evidence\event-writer.ts
  adapters\local-outbox.ts
  cli\main.ts
examples\
  outbound-gate\
    policy.json
    mission.json
    fixtures\
tests\
  unit\
  enforcement\
  integration\
.github\
  workflows\ci.yml
  CODEOWNERS
package.json
package-lock.json
tsconfig.json
.gitignore
SECURITY.md
CONTRIBUTING.md
```

**Proposed stack:** One TypeScript/Node package, a CLI, and an established local
secret scanner such as Gitleaks behind a small adapter. Confirm team preference
and scanner installation on the demo machines before implementation. Pin the
selected scanner version and document its installation.

Do not build a web application, hosted service, or multiple packages initially.
PowerShell may provide convenience scripts, but authorization stays in the shared
broker.

## Implementation direction

```text
Trusted policy + approved mission
                |
CLI -> Broker -> Snapshot content -> Scan -> Evaluate policy
                                                |
                              Allow / Ask / Block
                                                |
                       Approval check + same-content execution
                                                |
                              Local outbox + redacted evidence
```

- **Contracts:** Define immutable action, mission, finding, decision, and event
  types. Include target, content digest, rule identifier, and policy digest.
- **Policy:** Apply organization limits and mission scope together. Missions can
  narrow permissions, never expand them. Unknown actions and malformed input fail
  closed.
- **Scanner:** Return structured findings. Scanner errors are different from a
  clean result. Never include matched secret values in normal output or evidence.
- **Broker:** Own scanning, authorization, and execution. Never return permission
  for the caller to execute an unchecked action elsewhere.
- **Approval:** Use a separate human-facing path. Bind approval to the action,
  destination, content digest, mission, and policy digest; expire and consume it
  once. Rejection, timeout, and unavailable approval leave the action unexecuted.
- **Execution:** Publish the exact bytes that were scanned. Do not re-read a
  mutable source file after approving it. Use generated artifact identifiers and
  a fixed outbox root, not caller-selected filesystem destinations.
- **Evidence:** Record decision and execution separately. Persist the decision
  before execution; if that fails, stop. Report execution or outcome-recording
  failures explicitly without claiming success or automatically retrying.

Start with one explicit outbound-policy implementation behind an interface.
An ACS integration is a separate follow-up after its SDK and semantics have been
verified. Do not label the initial evaluator ACS-backed.

## Enforcement boundary

The initial CLI demonstrates broker-controlled execution, not protection against
a malicious process running as the same operating-system user.

In a governed agent integration, the agent must not be able to modify the broker,
trusted policy, approval state, or evidence. It must not have another route to the
protected destination. A repository policy file is a sample or authoring input,
not automatically an authoritative policy.

The prototype uses synthetic data and a local outbox. It does not claim to
intercept native shell commands, other MCP servers, model-provider traffic, or
every outbound channel. A plugin alone will not establish that boundary.

## Dependency graph

```text
WI-1: Foundation + contract tests
  -> WI-2: Outbound gate + broker
    -> WI-3: Runnable demo + contributor handoff
```

## Summary table

| # | Title | Module | Priority | Depends on |
|---|---|---|---|---|
| WI-1 | Establish contracts and enforcement expectations | Foundation | P1 | None |
| WI-2 | Implement the governed outbound flow | Broker | P1 | WI-1 |
| WI-3 | Package the demo and team extension guide | CLI and docs | P1 | WI-2 |

The starter owner completes these three items as one reference implementation.
Teammates can review the contracts early without building against an unfinished
authorization API.

## Work item details

### WI-1: Establish contracts and enforcement expectations

**Objective:** Set up the package, document the boundary, and define the shared
types before implementing the gate.

**Technical requirements:** Strict TypeScript, explicit inputs and outputs, small
interfaces, and no Agency or Forge dependency in the core. Comments explain only
non-obvious decisions; public interfaces receive short documentation.

**Files to create (proposed):** `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore`, `src\core\contracts.ts`,
`tests\unit\contracts.test.ts`, `docs\ARCHITECTURE.md`,
`docs\THREAT-MODEL.md`.

**Acceptance criteria and test coverage:**
- Validate malformed actions, invalid policy, and unsupported action types.
- Define allow, ask, and block outcomes without an implicit allow default.
- Document the trusted components and the limits of the local prototype.
- Provide documented build and test commands.

**Dependencies:** None.

### WI-2: Implement the governed outbound flow

**Objective:** Make the broker the single owner of simulated publication.

**Technical requirements:** Implement the scanner adapter, deterministic policy,
single-use approvals, redacted evidence, and fixed-root outbox described above.
Use constructor-injected dependencies so tests can assert execution did not occur.

**Files to create (proposed):** The `scanning`, `policy`, `broker`, `approvals`,
`evidence`, and `adapters` source files in the structure above; corresponding
unit tests; `tests\enforcement\publish-broker.test.ts`.

**Acceptance criteria and test coverage:**
- Write enforcement tests before the corresponding broker behavior.
- Clean content is published; denied content never reaches the executor.
- Sensitive content waits for approval; deny cannot be approved away.
- Expired, reused, rejected, or mismatched approvals cannot publish.
- Changes to content, target, mission, or policy invalidate prior approval.
- Invalid policy, unknown actions, and scanner errors stop execution.
- Prompt text cannot influence policy authority.
- Logs contain no raw payloads or matched secret values.
- Evidence failures and execution failures have explicit outcomes.

**Dependencies:** WI-1.

### WI-3: Package the demo and team extension guide

**Objective:** Let a teammate run and understand the entire example from a fresh
checkout.

**Technical requirements:** Provide a terminal-based human approval experience,
synthetic fixtures, a local outbox, and readable decision output. Pin dependencies.
Keep generated evidence and outbox files out of Git.

**Files to create (proposed):** `src\cli\main.ts`,
`tests\integration\outbound-demo.test.ts`,
`examples\outbound-gate\policy.json`,
`examples\outbound-gate\mission.json`,
`examples\outbound-gate\fixtures\clean.txt`,
`examples\outbound-gate\fixtures\sensitive.txt`,
`examples\outbound-gate\fixtures\synthetic-secret.txt`,
`.github\workflows\ci.yml`, `.github\CODEOWNERS`, `SECURITY.md`,
`CONTRIBUTING.md`.
**Existing file to update:** `README.md`.

**Acceptance criteria and test coverage:**
- A fresh checkout can run all demo cases without cloud credentials.
- At least one integration case invokes the actual pinned scanner.
- CI runs build, unit, enforcement, and integration checks.
- Synthetic-secret fixtures are narrowly documented; no blanket scan exclusion.
- README distinguishes implemented behavior from roadmap items.
- CONTRIBUTING explains how to add a policy check or action adapter.
- New checks reuse the broker and cannot independently authorize execution.

**Dependencies:** WI-2.

## Team extension points

After the reference flow works, teammates can take independent extensions:

| Extension | Reuses | Additional requirement |
|---|---|---|
| ACS policy adapter | Policy interface and decision tests | Prove equivalent authorization outcomes |
| Agency plugin and MCP transport | Broker | Validate host isolation and bypass coverage |
| Forge workflow | CLI or MCP transport | Workflow auto-approval cannot waive Airlock authorization |
| Dependency advisory gate | Findings and policy interfaces | Define advisory source, freshness, and failure behavior |
| Operations example | Mission and action contracts | Name targets and environments explicitly |

Do not add general-purpose command execution as a shortcut for a new adapter.
Broader sensitive-data classification, real publication, authenticated remote
approvals, and organization-wide enforcement are out of scope for this starter.

## Repository governance

Require reviewed PRs and passing CI before merge. Configure required owner review
for policy, broker, approvals, and workflow changes; CODEOWNERS alone is not an
enforcement setting. Choose an approved license before public distribution.

## Dispatch order

1. Implement WI-1 and review the shared contracts.
2. Implement WI-2 against the enforcement tests.
3. Implement WI-3 and rehearse the demo from a fresh checkout.

## Next step

Review the scope and proposed stack with the team, then begin WI-1. This plan does
not create work items, change repository settings, or authorize publication.
