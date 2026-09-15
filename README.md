# Agent Airlock

![Agent Airlock project cover](./agent-airlock-project-cover.png)

## Tagline

**Give AI agents room to move, not room to break the rules. Agent Airlock checks each mission before takeoff, pauses risky actions for approval, and blocks forbidden actions before they reach real systems.**

---

## Why this problem matters

AI agents have hands now.

They do not just answer questions. They can change code, send messages, update work items, search company data, run workflows, and touch production systems.

But many of the rules controlling those actions still live inside prompts:

> Never bypass required review.

> Ask before changing anything outside my computer.

> Never send sensitive information outside the company.

> Work on your own, but do not do anything risky.

These instructions are helpful, but they are not strong controls. They may be incomplete, hidden inside a long prompt, or understood differently by different agents.

This creates four common problems:

1. **Unclear permissions** - A request says what the user wants, but not everything the agent may do.
2. **Different behavior** - Each team writes its own rules, so similar agents act differently.
3. **Poor approval choices** - Users either approve every small step or give the agent too much freedom.
4. **Missing explanations** - Activity logs may show what happened without clearly showing why it was allowed or blocked.

```text
 TODAY

 Request + instructions + permissions + safety rules
                         |
                         v
                   ONE LARGE PROMPT
                         |
                         v
                      AI AGENT
                         |
                         v
                    REAL SYSTEMS
```

Free-form text is a great way to describe a goal. It is a poor place to hide important permissions.

---

## The idea

**Agent Airlock is a checkpoint between what someone asks an AI agent to do and what the organization allows it to do.**

The user describes the outcome. The organization keeps its rules separate. Agent Airlock combines them into a clear mission before work begins.

```text
                        ORGANIZATION RULES
                                |
                                v
 USER REQUEST  ----------> [ AGENT AIRLOCK ] ----------> AI AGENT
                                |
                 +--------------+--------------+
                 |              |              |
                 v              v              v
              ALLOW          ASK FIRST        BLOCK
                 \              |              /
                  +-------------+-------------+
                                |
                                v
                       CLEAR ACTIVITY RECORD
```

The agent stays free to solve the problem inside the approved space. It cannot create new permissions for itself along the way.

---

## Focused use cases

The PRD defines four core use cases and three optional extensions. The current
repository implements narrower local slices: secret scanning, online-write
intent checks, model-catalog checks, and per-action receipts. Mission contracts,
interactive approval, and complete run summaries remain product targets.

### Core

1. **Start a safe mission.** A developer asks an agent to fix a bug. Agent Airlock validates a contract and versioned rules before work starts, and keeps helper agents inside the same limits.
2. **Approve or stop actions.** Safe local work continues without interruption, while an exact simulated online write needs single-use approval and forbidden actions are blocked. Optional checkpoints and a local stop control can prevent later steps.
3. **Share content safely.** Before a simulated pull request or maintenance message leaves the computer, Agent Airlock checks its text for fake secrets, personal-data patterns, and internal-only labels. It blocks or pauses the action and explains how to make the content safe.
4. **Explain a finished run.** A reviewer gets a redacted local record of what was requested, allowed, approved, blocked, and completed. Approval receipts and rule versions make each important decision easy to understand later.

### Optional local extensions

5. **Choose tools within budget.** For repeatable work, Agent Airlock prefers a reviewed repository script and uses only permitted model choices. It enforces simple context, call, and token limits without dropping safety checks.
6. **Review a security change.** A sign-in or dependency change is checked against a small local standards checklist and dated advisory fixture. Failed or unclear checks stop simulated review until resolved or explicitly approved where the rules permit.
7. **Reuse research across sessions.** A later or overlapping local session reuses evidence-backed findings instead of repeating repository research. Stale or conflicting claims stay visible and must be verified.

The POC uses a sample repository, local rules and records, a terminal interface, stub models, and simulated online writes. It needs no cloud deployment, administrator role, cross-team permission, or real online write. See the [full product requirements](./docs/preflight/prd.md).

---

## Easy to share and adopt

Agent Airlock can be shared the same way teams already share code. The first version does not need a new central service.

This is a future adoption path, not part of the local hackathon build.

The contract, organization rules, examples, and Agent Airlock files can live in GitHub or Azure DevOps.

```text
 +--------------------------------------------------+
 |             GITHUB OR AZURE DEVOPS               |
 +--------------------------------------------------+
 | agent contract                                   |
 | organization rules                              |
 | Agent Airlock tool                               |
 | examples and tests                               |
 +-------------------------+------------------------+
                           |
                           v
                  PULL REQUEST REVIEW
                           |
                           v
                   AUTOMATIC CHECK
             GitHub Actions or Azure Pipelines
                           |
                           v
                  APPROVED RULES RELEASE
                           |
                           v
                     LOCAL AI AGENT
```

A team adds the tool and two small files to its project. Changes go through a pull request. The automatic check shown above can create an approved release through GitHub Releases, GitHub Packages, or Azure Artifacts. The agent loads that release when it starts.

The same check can run on a developer's computer or in the repository. Teams can see who changed each rule, review it before use, and return to an earlier version if needed.

---

## Target hackathon demo

This is the intended end-to-end experience. It is not a claim that every step is
implemented in the current repository; see [How it works](#how-it-works) for the
runtime that exists today.

A user asks:

> Investigate this bug, fix it, and complete the change without interrupting me.

Agent Airlock shows the mission before the agent starts:

```text
 MISSION: Fix the reported bug

 ALLOWED
   + Read the local repository
   + Edit the working copy
   + Run tests
   + Create a local branch

 ASK FIRST
   ? Simulate pushing a branch online

 BLOCKED
   x Push directly to the protected branch
   x Change production resources

 REASON
   Online writes need confirmation.
   Protected changes must go through review.
```

The agent reads the sample issue, changes local files, and runs tests without repeatedly interrupting the user.

Before the simulated online write, Agent Airlock finds a fake token in the pull-request draft and blocks the content. The agent removes the token, and the content check passes.

It then tries a simulated online write. Agent Airlock pauses and asks for approval. The user can approve or reject that exact step.

Next, the agent attempts the forbidden protected-branch update. Agent Airlock blocks it and points the agent toward the safer branch-and-review path.

The user can even add "do everything automatically" to the request. The result does not change because the rule is kept outside the prompt.

Finally, we change the local rule and run the same request again. The new decision takes effect without rewriting the prompt or changing the agent.

The closing screen shows:

```text
 Requested       Fix and complete the bug
 Ran locally     Read, edit, branch, and test
 Needed approval Simulated online write
 Blocked         Fake token and direct protected-branch write
 Reason          Organization rule
 Final result    Only approved actions ran
```

> **The agent tries to cross the line. The airlock holds.**

---

## Why people should care

| Audience | What improves |
|---|---|
| **People using agents** | They know what the agent may do and are interrupted only when needed |
| **Developers** | They stop hiding the same safety rules in every prompt |
| **Security and IT teams** | They can set clear limits and see them applied |
| **Reviewers and auditors** | They can see what was requested, approved, blocked, completed, and why |

The business value is simple: organizations can adopt useful agents faster, reduce repeated safety work, avoid risky actions, and make approvals less frustrating.

---

## How it works

The repository currently has two independent layers:

1. **Airlock plugin** - an Agency Copilot plugin under
   [`plugins/AirlockPlugin`](./plugins/AirlockPlugin) that exposes guarded MCP
   tools over standard input/output.
2. **Host sandbox kit** - optional settings under [`sandbox`](./sandbox) that
   restrict filesystem, network, credentials, and child-process access.

The plugin is the semantic checkpoint. The sandbox is host containment. Neither
one replaces the other, and the current implementation is smaller than the full
product vision described above.

### Runtime architecture

```mermaid
flowchart LR
    User["User in Agency Copilot"] --> Skill["Airlock demo skill"]
    Skill --> Server["MCP server<br/>server.mjs"]

    Server --> Draft["publish_draft"]
    Server --> Intent["check_intent"]
    Server --> Model["select_model"]

    Draft --> Validation["Strict Zod input validation"]
    Intent --> Validation
    Model --> Validation

    Validation --> Broker["Shared broker<br/>snapshot + fingerprint"]
    Policy["policies/default.json<br/>tool-to-gate bindings"] --> Evaluator["Policy evaluator"]
    Registry["gates/index.mjs<br/>trusted gate registry"] --> Evaluator
    Broker --> Evaluator

    Evaluator --> Decision{"Combined decision"}
    Decision -->|"all gates allow"| Receipt["Write decision receipt"]
    Receipt --> Executor["Fixed local executor"]
    Executor --> Artifact["Write local artifact"]
    Artifact --> Completion["Append completion receipt"]

    Decision -->|"ask-first"| Approval["Return approval-required<br/>no execution"]
    Decision -->|"block or error"| Denied["Return blocked or error<br/>no execution"]
```

Agency loads [`plugin.json`](./plugins/AirlockPlugin/plugin.json), then
[`.mcp.json`](./plugins/AirlockPlugin/.mcp.json) launches the Node.js MCP server.
The caller can choose a registered tool and provide that tool's documented
arguments. It cannot choose the policy, gate list, executor, artifact path, or
approval state.

Each tool validates its input before creating a normalized action:

```json
{
  "tool": "check_intent",
  "target": "local-mission-review",
  "input": {
    "prompt": "Fix the local test."
  }
}
```

The broker deep-freezes that action, hashes it, and sends the same snapshot to
the policy evaluator and, only after an allow decision, the fixed executor. The
evaluator runs every gate bound to the tool. Decision precedence is:

```text
block > error > ask-first > allow
```

An action executes only when every required gate returns `allow`. `ask-first`
does not currently open an approval prompt; the broker returns
`approval-required` and performs zero execution.

### Current tool and gate map

| MCP tool | Required gate | Current result and local artifact |
|---|---|---|
| `publish_draft(content)` | `no-secrets-in-drafts` | Clean text is copied to `~/.agent-airlock/outbound-demo/outbox/<id>.md`; detected secrets block execution |
| `check_intent(prompt)` | `no-online-writes` | Local-only intent writes `cleared-intents/<id>.json`; configured online-write patterns block even when the prompt contains `/yolo` |
| `select_model(taskType, dataClass, model?, endpoint?)` | `model-catalog` | The team default writes `model-selections/<id>.json`; unknown, blocked, or out-of-boundary choices block; permitted non-default choices return `approval-required` |
| `publish_approved_draft` | `no-secrets-in-drafts` and `local-approval-required` | Policy entry only; no MCP tool or executor is registered in `server.mjs` |

The rules are local, reviewed plugin files:

- Gitleaks configuration:
  [`gates/secrets/gitleaks.toml`](./plugins/AirlockPlugin/gates/secrets/gitleaks.toml)
- Online-write patterns:
  [`gates/no-online-writes/rules.json`](./plugins/AirlockPlugin/gates/no-online-writes/rules.json)
- Model defaults and boundaries:
  [`gates/model-catalog/catalog.json`](./plugins/AirlockPlugin/gates/model-catalog/catalog.json)

### Decision and evidence lifecycle

```mermaid
sequenceDiagram
    participant A as Agency Copilot
    participant T as Guarded MCP tool
    participant B as Broker
    participant P as Policy evaluator
    participant G as Required gates
    participant X as Fixed local executor
    participant F as Local filesystem

    A->>T: Tool arguments
    T->>T: Strict validation
    T->>B: Frozen action + executor
    B->>P: Evaluate action snapshot
    P->>G: Run every policy-bound gate
    G-->>P: allow / ask-first / block
    P-->>B: Combined redacted decision

    alt every gate allows
        B->>F: Write allowed receipt
        B->>X: Execute same action snapshot
        X->>F: Write local artifact
        X-->>B: Safe artifact metadata
        B->>F: Append completed receipt
        B-->>T: completed
        T-->>A: published / cleared / selected
    else ask-first
        B->>F: Write blocked receipt
        B-->>A: approval-required; execution not started
    else block or check error
        B->>F: Write blocked or error receipt
        B-->>A: denied; execution not started
    end
```

Receipts are JSON Lines files under
`~/.agent-airlock/outbound-demo/receipts`. They contain the policy identity,
action hash and size, gate decisions, rule IDs, line numbers, timestamps, and
execution state. They do not contain the raw prompt, draft, matched secret, or
model payload.

> [!WARNING]
> The current gate registry has an incomplete approval integration.
> [`gates/approval/index.mjs`](./plugins/AirlockPlugin/gates/approval/index.mjs)
> exports `approvalGate` as an object, while
> [`gates/index.mjs`](./plugins/AirlockPlugin/gates/index.mjs) invokes it as
> `approvalGate()`. Node.js therefore raises `TypeError: approvalGate is not a
> function` while loading the registry, before the MCP server starts. In
> addition, `publish_approved_draft` is bound in the policy but is not exposed
> by `server.mjs`. The current repository does not yet provide a working
> approval flow.

### Enforcement boundary

Airlock enforces only calls routed through its registered MCP tools. It does not
intercept native shell commands, another MCP server, Agency's own model traffic,
or arbitrary processes running as the same user. All implemented executors write
only local demo artifacts; they do not push Git branches, create pull requests,
publish packages, deploy infrastructure, or call a hosted model.

Use the scenario runbooks for prescriptive setup and verification:

- [`no-online-writes` demo](./plugins/AirlockPlugin/gates/no-online-writes/README.md)
- [`model-catalog` demo](./plugins/AirlockPlugin/gates/model-catalog/README.md)
- [`secrets` and plugin setup](./plugins/AirlockPlugin/README.md)

## Configure the Copilot CLI sandbox

The root-level **[`sandbox`](./sandbox)** directory contains recommended Copilot
CLI sandbox configurations and a preview-first setup tool. It composes a shared
base with optional overrides and safely merges the result into user, repository,
or local Copilot settings without replacing unrelated configuration.

The sandbox limits filesystem, network, credential, and local-process access.
It complements Airlock's semantic gates but does not replace them. The supplied
profiles keep sandbox bypass available for legitimate development needs.

---

## Follow-up / Out of scope for this hackathon

The first prototype proves one local coding example. The following ideas are valuable, but they are not promises for the initial demo:

- **More agent platforms** - Use the same contract with Microsoft Agent Framework, Copilot Studio, Microsoft Foundry, and other agent tools.
- **Live Microsoft connections** - Connect with Agent 365, Entra, Defender, Purview, and company approval systems. These may require licenses and administrator setup.
- **Real online actions** - Use controlled test repositories, cloud resources, messages, and production systems with proper credentials and safeguards.
- **Live business scenarios** - Connect operations, company search, external messages, financial work, and helper agents to real systems. The POC uses local fixtures and simulated helpers.
- **Central control and reporting** - Add a live dashboard, a remote company-wide stop, update tracking, and removal of old rules. The POC may include one local stop control.
- **Production optimization** - Measure real prompt caching, token costs, repeated work, and model choices. The POC may compare local or simulated counts.
- **Multi-step safety** - Check whether a series of individually allowed actions becomes risky when combined.
- **Production readiness** - Add trusted releases, fast rule removal, secure sign-in and records, recovery, privacy checks, and testing for large use.

---

## The end state

The long-term goal is for every important AI task to carry a short mission and an approved set of rules.

Routine work can continue. Sensitive steps can pause. Forbidden steps can stop before reaching a real system. Every important choice can leave a clear reason.

Teams can update a shared rule instead of searching through many prompts, and anyone reviewing an action can quickly understand why it happened.

Agents stay useful.

People stay informed.

Organizations stay in control.

> **The prompt describes the destination. Agent Airlock clears the safe path.**
