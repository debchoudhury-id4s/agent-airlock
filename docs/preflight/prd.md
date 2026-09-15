# Agent Airlock PRD

Agent Airlock checks what an AI agent may do before work starts and before each tool call. The user states the goal. A separate rule file decides what is allowed, needs approval, or is blocked.

**Build scope:** Core sections define the minimum hack demo. Requirements marked **Optional** inside them remain optional. Entire sections marked **Optional** are local extensions.

**Shared controls:** Use the same rule checks, approval flow, and activity record across all sections. A new scenario adds checks or sample data, not a separate control system. Each required check still has to pass.

**POC limits:** Run on one developer's computer. Use a sample repository, local files, a terminal interface, and recorded agent steps or a stub model. Simulate all online writes and model requests. No Azure deployment, administrator role, cross-team permission, or company service is required.

Only supported tools routed through Airlock are covered. The POC is not a security sandbox for arbitrary commands or other processes. Live integrations, shared cloud stores, enterprise sign-in, and production-scale controls are out of scope.

## 1. Start a Safe Mission


> Suggested by : debchoudhury, matagaba, roennam

**Core.** A developer asks an agent to fix a bug. A teammate or helper may join, but everyone must stay within the same approved limits.

1. Show a mission contract before any tool runs. List the goal, allowed data and paths, tools, changes, approvals, limits, and required records. The local user confirms it. The request states a goal; it does not grant permission. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L13>)
2. Keep allow, ask-first, and block rules in a versioned local file. Keep it separate from prompts and outside the agent's writable paths. Only the local user may activate rule changes. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L14>)
3. [DONE] A block takes priority over approval or allow. A contract may only narrow the rules. Request wording, `/yolo`, auto-approve, and retries cannot widen rights or skip required approval. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L18>)
4. Use the same rule format across sessions. Pin each run to an exact version. Rule edits take effect on a new run, not silently during an active run. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L14>)
5. Check contracts and rules for missing fields, unknown tools, invalid targets, conflicts, and missing approvers. Reject read-only missions with write tools and goals that require forbidden writes. Explain each issue and do not start until it is resolved. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L19>), [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L9>)
6. Offer a dry run using the same decision rules. Show allow, ask-first, or block and the reason for every planned action. Do not execute the actions. [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L10>)
7. Before every supported call, check its tool, inputs, target, and contract. Include actions absent from the original plan. Unknown tools and unclear targets must not run. If a wider contract is needed, stop and repeat the review. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L15>)
8. Allow contracted reads, edits, tests, and local branch creation in the sample repository without repeated prompts. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L15>)
9. Run the same action in two local sessions with the same rules and inputs. Decisions and reasons must match. Change a rule and start a new run to show its effect without changing the prompt. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L14>)
10. **Optional:** Pass the parent's contract, rule version, data boundaries, and run ID to a helper. Reject a child that requests more tools, data, models, or write access than its parent. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L33>)
11. **Optional:** Route child actions through the same checks and any enabled stop control. Parent approvals cannot be reused by children. Share any parent budget. Demonstrate this with one local helper or simulated child. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L27>), [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L33>)

## 2. Approve or Stop Actions


> Suggested by : debchoudhury, matagaba, roennam

**Core.** A developer approves one simulated branch push. They do not want that approval reused and may need to pause or stop later work.

1. Require approval for every simulated online write, including a working-branch push. Block protected `main` updates and production or critical-environment writes. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L15>), [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L31>)
2. Show the exact operation, target, safe input summary, matching rule, and expected effect. Explain what approval or rejection will do. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L16>)
3. Ask the named local reviewer to approve or reject the action and give a reason. Waiting or closing the prompt does not count as approval. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L16>), [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L11>)
4. Bind approval to one run, one action, its exact inputs, its target, and the rule version. Set an expiry time and allow only one use. [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L11>)
5. Changed inputs or targets need a new approval. Rejected, expired, and used approvals must cause zero executions. Recheck all applicable controls immediately before running the action. [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L11>)
6. **Optional:** Add checkpoints after investigation, after edits, and after tests before outbound work. Show findings and the next step in one line. Wait for the user to continue or revise the plan. With checkpoints off, keep the normal flow. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L25>)
7. **Optional:** Provide one local stop control for the active run and its helpers. Check it before every next action, including actions waiting on approval. An active stop blocks execution even if approval was already given. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L27>)
8. **Optional:** Request cancellation of started work only when the tool supports it. Report whether it completed, was cancelled, or has an unknown result. Do not promise rollback or safe interruption of arbitrary writes. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L27>)
9. **Optional:** Only the local user can clear a stop. Clearing it must not automatically rerun work. Review the plan and required approvals before resuming. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L27>)

## 3. Share Content Safely


> Suggested by : matagaba, neha-bhargava

**Core.** An agent prepares a pull-request draft containing a fake token. The same protection should work for an operator's maintenance update containing internal-only site notes.

1. [DONE] Inspect the payload and included files before a simulated outbound action. Cover source edits, test data, logs, commit messages, pull-request text, and message drafts. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L29>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
2. [DONE] Support plain text in the POC. Block unsupported attachments rather than silently treating them as safe. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L29>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
3. Use fixed local rules for fake credentials, sample personal-data patterns, and `internal-only` labels. The same content and rules must produce the same decision. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
4. Block credential matches and forbidden destinations. Use the shared approval flow for other flagged content only when the rules permit sharing. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L29>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
5. [DONE] Show the matched rule and a safe file or field reference. Never display the sensitive value. Suggest removal, redaction, or a permitted destination. Check the revised payload again before requesting approval. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L29>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
6. State the scanner's limits. Pattern checks do not prove that arbitrary text, images, or diagrams contain no sensitive information. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L29>)
7. **Optional:** Demonstrate the same flow with a synthetic maintenance ticket and local site notes. Allow reading and drafting, then pause before a simulated message send. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L31>)
8. **Optional:** Reuse the same contract fields for maintenance work. Record any mismatch instead of adding a scenario-specific permission exception. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L31>)

## 4. Explain a Finished Run


> Suggested by : debchoudhury, matagaba, neha-bhargava, roennam

**Core.** A reviewer returns a week later and asks why a push was blocked and which action was approved.

1. [DONE] Keep a local record of the request, contract, rule snapshot, actions, decisions, reasons, and outcomes. Give each run and action an ID and timestamp. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L17>), [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L35>)
2. Save a receipt for every approval or rejection. Include the reviewer label, time, reason, action fingerprint, expiry, and result. Link it to the exact action. [roennam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/roennam/requirement-closure.md#L11>)
3. [DONE] Distinguish permission to run from successful execution. Show rejected, blocked, failed, and unfinished actions clearly. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L17>)
4. When enabled, include delegation links, child scopes and results, checkpoint decisions, and stop or resume events. Record who set or cleared a stop, when, and at which step. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L25>), [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L27>), [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L33>)
5. Show a short final summary. Include what was requested, what ran locally, what needed approval, what was blocked, and the final result. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L17>)
6. [DONE] Use the shared sensitive-content rules to redact each record before saving it. Keep safe target labels, input fingerprints, and matched rules instead of raw secrets. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L20>)
7. Export the record as JSON and a readable Markdown summary with one command. The files must remain available after the session ends. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L35>)
8. Replay decisions for the synthetic demo inputs against the saved rules without rerunning actions. If missing or redacted input prevents replay, report that limit instead of claiming a match. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L35>)
9. Treat exports as local demo evidence. Reviewer labels are not verified identities. Do not claim tamper-proof records or compliance certification. [matagaba](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/matagaba/requirements-closure.md#L35>)

## 5. Choose Tools Within Budget


> Suggested by : debchoudhury, dlingam, neha-bhargava

**Optional.** A teammate reruns a standard report. The agent should reuse a script, use an approved model only when needed, and stay within the agreed budget.

1. Extend the shared rules with repeatable task types, approved script versions, model choices, and efficiency limits. Review the context, reused findings, scripts, planned batches, and budget before starting. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L20>), [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L26>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L16>)
2. For fixed-step tasks, use an approved repository script when one fits. Model use on this path must be blocked or explicitly marked ask-first by the rules. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L20>), [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L24>)
3. If no script exists, propose a reusable PowerShell script. Give it explicit inputs, outputs, input checks, and clear error reporting. Save approved scripts in the sample repository for future runs. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L16>)
4. Require local review before running a new or changed script. Trust the reviewed file version, not just its path. The agent cannot approve its own script. Repeated runs with the same sample inputs must produce the expected result. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L16>)
5. [DONE] Keep a local model catalog with model IDs, endpoints, task types, allowed data classes, defaults, and blocked choices. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L21>)
6. [DONE] Select the default permitted model for the task and data. Require approval for a non-default choice only when the catalog permits it. Block unknown models, forbidden endpoints, and choices outside the data boundary. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L21>)
7. [DONE] Use two stub models to demonstrate an allowed default, an approved override, and a blocked choice. [debchoudhury](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/debchoudhury/requirement-closure.md#L21>)
8. Set caps for context, model calls, and tokens. Reserve an output allowance. Flag likely overruns in the plan and pause before a step is expected to exceed the remaining budget. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L26>)
9. Remove duplicate context before counting the budget. When research reuse is enabled, use its selected findings rather than retrieving a second copy. Keep reusable prompt prefixes stable. Use compact formats only when the receiving tool supports them. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L24>)
10. Batch independent calls only when the tool supports it. Keep dependent calls in order. Count and check every action in a batch. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L24>)
11. Never remove safety rules, required evidence, approvals, or task constraints to fit a budget. Explain what cannot fit and wait for a revised plan. Only the local user may raise a limit. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L28>)
12. Add efficiency metrics to the shared run record. Include findings reused or saved, research avoided, overlapping sessions connected, scripts used, calls batched, and input/output tokens. Link choices to their rules. Report cache hits only when the provider reports them. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L30>)
13. Compare the same sample task with reuse enabled and disabled. Required results and safety decisions must match. Label simulated counts, estimates, and unavailable metrics. Do not claim real cost savings from a replay. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L30>)

## 6. Review a Security Change


> Suggested by : neha-bhargava

**Optional.** An engineer updates sign-in behavior and its library. Passing tests should not hide a broken protocol rule or a risky dependency.

1. Before design starts, select a short local checklist for the sample change. Name the relevant standard or protocol document (RFC), its version, and the referenced sections. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L18>)
2. Check the design, implementation, and pull-request draft against the same checklist. Keep the guidance attached to the change. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L18>)
3. Support one sample lockfile format. Identify added or changed dependencies and their resolved versions, including changed indirect dependencies. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L22>)
4. Compare dependencies with a dated local snapshot of advisories and support status. Check package sources and available integrity information. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L22>)
5. Mark every standards and dependency check as pass, fail, or needs review. Record supporting evidence. Missing versions, stale evidence, unknown support status, and unclear sources must not become automatic passes. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L18>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L22>)
6. Keep the change unready for simulated review while a required check fails or needs review. Block unacceptable risk. Only rule-permitted exceptions may use the shared approval flow. Record the reason, mitigation or deviation, and affected change or exact package version. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L18>), [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L22>)
7. Demonstrate an allowed change, a blocked change, and a dependency update needing review. Use local fixtures rather than private package feeds or security services. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L22>)
8. Send unresolved judgments to the local reviewer. Do not claim full standards coverage, security certification, or a current scan of every dependency. [neha-bhargava](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/neha-bhargava/requirements-closure.md#L18>)

## 7. Reuse Research Across Sessions


> Suggested by : dlingam

**Optional.** A developer resumes yesterday's investigation while another session investigates the same bug. They want to reuse evidence and divide the remaining work.

1. Build a stable task key from the repository, goal, issue, and affected files. Use it to find matching prior or active work before new research. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L16>)
2. Use one local JSON store behind a small search, read, and write interface. Keep related findings linked. Future stores can use that interface; a new graph database is not required. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L18>)
3. Each finding must include evidence or artifact links, its source session, verification time, revision, confidence, access label, and expiry or invalidation conditions. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L20>)
4. Before reuse, check source revisions and validity. Verify stale, weak, inaccessible, or conflicting claims using permitted evidence. Research only missing or unresolved facts. Do not guess from an earlier answer. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L16>), [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L28>)
5. Load only relevant findings inside the mission's data boundary. Show what was reused and why. Share only published findings allowed by both contracts. Stored findings cannot grant permissions or change rules. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L16>)
6. For overlapping work, show the common scope, each session's owner, published findings, and remaining steps. Let the user choose to reuse findings, divide the work, or combine results. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L22>)
7. Keep conflicting claims and their sources side by side until evidence or a person resolves them. Never silently overwrite another session's findings. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L22>)
8. At the end, save reusable findings and decisions with their supporting evidence and artifact links. Do not save full transcripts by default. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L20>)
9. Apply the contract's retention and sharing limits. Exclude expired entries from reuse and let the local user delete them. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L20>)
10. Demonstrate with two local saved sessions and manual refresh. Global session discovery, live subscriptions, and cross-user access management are not required. [dlingam](<https://github.com/debchoudhury-id4s/agent-airlock/blob/main/docs/preflight/dlingam/requirements-closure.md#L22>)
