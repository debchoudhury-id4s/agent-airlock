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

The core prototype proves the first four use cases. The last three are optional local extensions built on the same rule checks, approval flow, and activity record.

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

## The hackathon demo

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

## What success looks like

After the demo, a judge should be able to answer:

1. Did the mission clearly state the goal, data, tools, changes, approvals, and limits?
2. Which safe local steps ran without interruption?
3. Did an exact simulated online write require approval?
4. Which forbidden or sensitive action was stopped, and why?
5. Could prompt wording or auto-approve widen the mission?
6. Did the same rules produce the same decision in two local sessions?
7. Did the final record explain every important decision and result?

---

## Contribute gates and policies

The shared plugin lives in **[`plugins/AirlockPlugin`](./plugins/AirlockPlugin)**.
Personal `poc/` folders remain experiments; independent future plugins go beside
AirlockPlugin under `plugins/`.

Start with its **[structure and contribution guide](./plugins/AirlockPlugin/README.md#structure)**.
It explains how to [add detector rules](./plugins/AirlockPlugin/README.md#add-a-detector-rule-to-the-existing-gate),
[register gates and policy bindings](./plugins/AirlockPlugin/README.md#add-another-gate),
and [add guarded tools or demo skills](./plugins/AirlockPlugin/README.md#add-a-tool-or-demo-scenario).
The [PRD contribution map](./plugins/AirlockPlugin/README.md#prd-contribution-map)
identifies the remaining work by use case.

The implemented demo covers secret scanning before a **local outbox copy**, not
real PR creation or the full hackathon flow above. Shared runtime code evaluates
every required gate and records the decision before executing. Only all-allow
can run; blocks and pending approvals cannot be bypassed by prompt instructions.

```powershell
Set-Location .\plugins\AirlockPlugin
npm ci
npm run setup
npm test
```

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
