# gap-analysis-prompt

Perform a deep implementation gap analysis and architecture conformance review of this repository.

Your goal is to compare what the repository claims, designs, and promises against what the source code actually implements, then create a practical `gaps-and-opportunities.md` document at the repository root.

## Review scope

Treat the source code and executable behavior as the ground truth. Review at minimum:

- Root `README.md`
- `docs/preflight/prd.md`
- Other architecture, design, demo, setup, and runbook documentation
- Plugin manifests and configuration
- Policies, gates, tools, skills, runtime/broker code, executors, and receipts
- Tests and fixtures
- Setup scripts and dependency manifests
- Sandbox or host-containment configuration, if present

Trace important claims from documentation through configuration, implementation, tests, and observable output. Do not merely summarize files. Probe whether each documented workflow can actually run end to end.

## Questions to answer

1. Which critical README and PRD capabilities are fully implemented, partially implemented, absent, broken, misleading, or untested?
2. Do documented commands, prompts, diagrams, tool names, paths, expected results, and setup instructions match the current code?
3. Can every registered plugin, MCP server, gate, policy binding, tool, executor, and demo skill load and operate as described?
4. Are enforcement decisions fail-closed, consistently composed, and applied before side effects?
5. Can users or agents bypass controls through caller-controlled inputs, alternate tools, shell commands, stale configuration, incomplete routing, or mismatched policy bindings?
6. Are approval, blocking, receipt, redaction, error, and completion semantics internally consistent?
7. Do tests prove the real integration path, including startup, MCP transport, policy evaluation, zero execution after denial, artifact creation, and receipt contents?
8. Which documented product claims exceed the actual enforcement boundary?
9. What makes the demo fragile, confusing, difficult to reproduce, or likely to fail during a hackathon presentation?
10. What useful capabilities can be added locally without external permissioning, organizational allowlisting, cloud provisioning, administrator access, or new hosted services?

## Constraints

- Focus only on actionable findings.
- Do not recommend work that depends on external permissioning, allowlisting, enterprise onboarding, tenant configuration, administrator approval, production credentials, or access to unavailable services.
- Prefer hackathon-appropriate local substitutes where they preserve the intended behavior, for example:
  - deterministic or hardcoded local responses instead of standing up a backend;
  - SQLite or local JSONL instead of Azure Storage, Cosmos DB, or another cloud database;
  - single-machine or repository-level analysis instead of account-, tenant-, or organization-level analysis;
  - local fixtures instead of live external APIs;
  - simulated writes instead of real publication;
  - local approval tokens or files instead of an enterprise approval service;
  - checked-in policy snapshots instead of a remote policy distribution system.
- Distinguish clearly between a safe hackathon shortcut and a production-ready design.
- Do not propose cosmetic documentation changes unless they correct a behavioral mismatch or materially improve demo reproducibility.
- Do not modify existing implementation files. The only requested change is creating `gaps-and-opportunities.md`.
- Do not perform online writes, create issues, push commits, call hosted services, or alter remote resources.

## Verification approach

Use repository search and direct source inspection to build a claim-to-code map. Run the smallest relevant local tests and startup checks needed to verify important claims. Exercise failure paths as well as successful paths. Do not treat the presence of a file, test name, comment, or README statement as proof of behavior.

For every finding, cite:

- the documented claim or intended behavior;
- the relevant source/configuration/test files and line numbers;
- the observed implementation or missing behavior;
- why the gap matters;
- a concrete local fix;
- how to verify that fix.

Avoid speculation. Label anything that could not be verified.

## Required document structure

Create `gaps-and-opportunities.md` with these sections:

# Gaps and Opportunities

## Executive summary
A concise assessment of how closely the implementation matches the README and PRD, the most serious demo risks, and the highest-value local improvements.

## Review method and evidence
List the documents, implementation surfaces, commands, and tests inspected or executed. Record any verification limitations.

## Claim-to-implementation matrix
Use a table with:

| Capability or claim | Source of claim | Implementation evidence | Status | Gap or drawback |

Use only these statuses: `Implemented`, `Partial`, `Missing`, `Broken`, `Misleading`, `Untested`.

## Prioritized gaps
Use a table with:

| Priority | Gap | Evidence | User/demo impact | Actionable local fix | Verification |

Rank findings as:

- `P0` — prevents startup, corrupts evidence, permits a prohibited action, or breaks the primary demo;
- `P1` — materially weakens enforcement or makes a core scenario unreliable;
- `P2` — meaningful limitation with a feasible local improvement;
- `P3` — useful refinement, not required for the demo.

## Hackathon quick wins
For each quick win include:

- exact scope;
- files likely to change;
- estimated effort: `<1 hour`, `half day`, `1 day`, or `2–3 days`;
- local substitute being used;
- expected demo improvement;
- focused verification steps.

Prefer small, additive, independently demonstrable changes.

## Short-term local architecture opportunities
Describe improvements that can be completed without external dependencies. Explicitly consider local SQLite state, deterministic fixtures, single-use local approvals, policy snapshots, replayable receipts, local stop controls, demo reset scripts, startup self-checks, and end-to-end scenario runners—but recommend only those justified by repository evidence.

## Deferred production concerns
Briefly record important production limitations that should not be solved during the hackathon. Do not turn these into current recommendations.

## Recommended execution order
Provide a dependency-aware sequence that starts with broken startup paths and core enforcement, then demo reliability, then optional improvements. End with a minimal “demo-ready” cutoff.

## Quality bar

- Be direct about drawbacks; do not soften broken or misleading behavior.
- Consolidate duplicate symptoms under their root cause.
- Prefer precise fixes over broad redesigns.
- Separate verified facts from inferred risks.
- Include no generic advice such as “improve security,” “add more tests,” or “use the cloud.”
- Every recommendation must be executable locally by a contributor with repository access and standard developer tooling.
- The final document should help the team decide what to fix next, not merely describe the repository.