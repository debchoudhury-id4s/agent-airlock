Perform an evidence-based implementation gap analysis, architecture conformance review, and requirements-to-implementation traceability audit of this repository.

Compare the capabilities claimed by non-excluded documentation with the source code, configuration, tests, and locally observable behavior. Create a `gaps-and-opportunities.md` document at the repository root containing the findings and recommendations. Do not implement any fixes.

## Strict exclusions

Exclude these repository-root directories and everything beneath them from the entire review:

- `demo/`
- `docs/preflight/`
- `poc/`

Do not read, search, enumerate, summarize, execute, cite, or use files from these directories as evidence. Do not follow links or references into them. Do not infer requirements from their names or contents. Configure every file-discovery and content-search operation to exclude them before running it. Do not traverse symlinks or alternate paths into excluded content.

If a non-excluded file references an excluded path, you may note that the reference exists only when materially relevant. Cite only the referring location in the non-excluded file; do not inspect or evaluate the excluded target. Do not report capabilities contained solely in excluded directories as missing or broken.

These exclusions override every other instruction. This is not a review of requirements that exist only in the excluded directories.

## Evidence model

Use two distinct sources of truth:

- Non-excluded documentation defines the current product, behavior, setup, and architecture claims to assess.
- Source code, configuration, tests, and locally observed execution establish what is currently implemented.

Distinguish current-behavior claims from explicitly labeled future goals, examples, aspirations, and out-of-scope items. Do not classify a future goal as a current gap unless another non-excluded source presents it as currently available.

A file, symbol, test name, comment, or documentation statement proves intent, not working behavior. Verify important claims through the actual integration path whenever local execution is possible.

## Analysis requirements

Review all relevant non-excluded surfaces, including:

- root `README.md`;
- architecture, design, setup, and runbook documentation outside excluded directories;
- plugin and MCP manifests;
- package and dependency manifests;
- server startup and tool registration;
- policies and policy loading;
- gate registration, evaluation, and decision composition;
- tool input validation and normalization;
- broker and executor behavior;
- skills and their documented prompts;
- receipt, artifact, redaction, and error handling;
- tests and fixtures outside excluded directories;
- setup and local utility scripts;
- sandbox or host-containment configuration, if present.

Trace each material current claim through the complete path where applicable:

```text
Documented claim
  -> manifest and configuration
  -> startup and tool registration
  -> input validation and normalization
  -> policy binding
  -> gate evaluation
  -> composed decision
  -> side effect or prevented side effect
  -> receipt and artifact
  -> test coverage
```

Do not merely inventory or summarize files. Identify root causes rather than listing duplicate symptoms.

## Questions the analysis must answer

1. Which current capabilities claimed by non-excluded documentation are fully implemented, partially implemented, missing, broken, misleading, untested, or unable to be verified?
2. Do documented commands, paths, tool names, prompts, arguments, expected results, diagrams, prerequisites, and setup instructions match the implementation?
3. Can every registered plugin, MCP server, gate, policy binding, guarded tool, skill, and executor load and operate as described?
4. Are startup and registration failures surfaced clearly, or can the system appear available while required components are unusable?
5. Are all tool inputs strictly validated and normalized before policy evaluation?
6. Can unknown fields, malformed values, oversized payloads, unsupported targets, or type mismatches reach a gate or executor?
7. Can caller-controlled inputs select, replace, weaken, or bypass policies, gates, approval state, executors, destinations, output paths, or artifact identities?
8. Does every guarded action use the exact same immutable or equivalent action snapshot for evaluation and execution?
9. Are all policy-bound gates evaluated, and is decision precedence deterministic and fail-closed?
10. Are `allow`, `ask-first`, `block`, `error`, completion, and receipt semantics internally consistent across tools and gates?
11. Do blocked, failed, malformed, and ask-first decisions guarantee zero protected execution?
12. Can a successful gate, retry, fallback, error handler, or alternate internal path override or conceal another gate's block?
13. Are gate failures treated as failures rather than successful or allow-shaped fallbacks?
14. Can a receipt-writing failure permit execution without trustworthy evidence?
15. Can an executor failure be mistaken for successful completion?
16. Do receipts accurately distinguish permission, attempted execution, completed execution, denied execution, and uncertain execution?
17. Do receipts and returned results avoid exposing raw prompts, drafts, matched secrets, sensitive values, unnecessary payloads, or internal exception details?
18. Are action fingerprints, policy identities, rule identities, timestamps, and artifact references sufficient to understand what was evaluated without recording sensitive content?
19. Can policies, rules, or gate implementations change after startup without the recorded policy identity reflecting the effective behavior?
20. Are local artifacts written only after an allow decision and only to fixed, expected locations?
21. Can path traversal, caller-selected paths, symlinks, collisions, stale files, or predictable identifiers alter artifact behavior?
22. Do tests exercise actual server startup and MCP transport, or only isolated functions?
23. Do tests cover successful, blocked, ask-first, malformed-input, unknown-field, gate-failure, receipt-failure, executor-failure, and completion-receipt paths?
24. Do tests prove zero execution after every non-allow result?
25. Do tests verify both returned results and persisted evidence?
26. Do documented prompts and skills invoke the real guarded tools with the exact expected arguments?
27. Can a skill silently substitute a shell command, another MCP tool, a hosted API, or another publisher after a guarded action is blocked?
28. Which current documentation claims exceed the actual enforcement boundary?
29. Are limitations stated clearly enough that users will not mistake a tool-specific gate for workstation-wide, shell-wide, model-wide, or network-wide protection?
30. Which failures would prevent or materially disrupt a local hackathon presentation?
31. Is there a deterministic, offline way to start, verify, exercise, inspect, and reset each current workflow?
32. Which setup steps are fragile, stale, environment-specific, network-dependent, or inconsistent with the repository's declared prerequisites?
33. Which current workflows lack a simple local health check, startup self-check, reset path, or end-to-end verification command?
34. Which actionable improvements can be completed entirely on one machine without external permissions, allowlisting, tenant configuration, administrator access, production credentials, cloud provisioning, or hosted services?
35. Which improvements are appropriate hackathon shortcuts, and which are production-shaped local improvements that remain useful after the hackathon?
36. What is the smallest dependency-aware set of fixes required for every current documented workflow to start, run, fail safely, and produce trustworthy local evidence?

Analyze shell-command or alternate-tool bypasses only when they contradict a current non-excluded claim or materially undermine a documented workflow. Do not report the absence of workstation-wide enforcement as a defect when non-excluded documentation clearly states that limitation.

## Recommendation requirements

Include only findings that have a concrete, locally executable response.

Do not recommend work that depends on:

- external permissioning or allowlisting;
- enterprise, account, tenant, or organization onboarding;
- administrator approval;
- production credentials;
- cloud provisioning;
- hosted databases or storage;
- live external APIs;
- organization- or account-wide access;
- unavailable proprietary services.

Prefer narrowly scoped local substitutes when supported by evidence, such as:

- deterministic or hardcoded local responses instead of a backend;
- SQLite or JSONL instead of Azure Storage, Cosmos DB, or another hosted database;
- repository- or single-machine analysis instead of account-, tenant-, or organization-level analysis;
- checked-in fixtures instead of live APIs;
- simulated writes instead of real publication;
- exact-action, single-use local approval tokens or files instead of an enterprise approval service;
- checked-in policy snapshots instead of remote policy distribution;
- local startup checks, reset scripts, and scenario runners instead of an operations service.

For every recommended change:

- identify the verified gap or root cause it addresses;
- cite relevant non-excluded files and exact line ranges;
- explain the user, enforcement, evidence, or hackathon impact;
- identify the likely files or components affected;
- propose the smallest complete local change;
- distinguish a deliberate hackathon shortcut from a production-shaped local improvement;
- estimate the effort using `<1 hour`, `half day`, `1 day`, or `2–3 days`;
- state dependencies on other fixes;
- define focused verification that proves the gap is resolved.

Rank findings by impact:

- `P0`: prevents startup, corrupts or invalidates evidence, permits a prohibited action, or breaks a primary documented workflow;
- `P1`: materially weakens enforcement or makes a core workflow unreliable;
- `P2`: a meaningful limitation with a feasible local improvement;
- `P3`: a useful refinement not required for the minimum hackathon workflow.

Do not recommend cosmetic documentation changes unless they correct a behavioral mismatch or materially improve reproducibility. Do not give generic advice such as “improve security,” “add more tests,” “improve error handling,” or “use the cloud.” State the exact behavior to change and how to verify it.

## Verification constraints

- Perform no online writes.
- Do not push, commit, create issues or pull requests, publish artifacts, or modify remote resources.
- Do not fetch Git remotes or call hosted APIs or services.
- Do not install dependencies, download tools, or run setup commands that may access a network.
- Run tests only when required dependencies are already available locally and the command can run offline.
- If a dependency is unavailable, mark the relevant behavior as unable to be verified; do not install it.
- Record the initial Git status and preserve all pre-existing changes.
- Do not modify tracked implementation, configuration, tests, documentation, manifests, or lock files.
- The only persistent repository change may be `gaps-and-opportunities.md`.
- Temporary artifacts may be created only when required for safe local verification.
- Remove only temporary artifacts created by this analysis. Do not perform broad or destructive cleanup.
- Do not claim a check passed unless its relevant command completed successfully.
- At the end, confirm that the repository diff contains no changes created by this analysis other than `gaps-and-opportunities.md`.

## Evidence requirements

For every finding:

- cite a current claim from a non-excluded document when applicable;
- otherwise cite the relevant code, configuration contract, or testable invariant;
- use root-relative paths and exact line ranges;
- separate verified facts from inferred risks;
- state which local commands or observations support the conclusion;
- state any verification limitations;
- never cite or use evidence from `demo/`, `docs/preflight/`, or `poc/`.

The resulting `gaps-and-opportunities.md` should organize the analysis in whatever structure best communicates the evidence, priorities, dependencies, quick fixes, local opportunities, and minimum hackathon-ready cutoff. Do not follow a predetermined report template if another structure communicates the findings more clearly.

After creating the document, report only:

- the path created;
- the number of P0, P1, P2, and P3 findings;
- the minimum hackathon-ready cutoff;
- which checks, if any, could not be run.