# Agent Airlock

**Give AI agents room to move, not room to break the rules.**
Hackathon demo — 2-minute video. Slides: `agent-airlock.pptx`

## What it is

Agent Airlock checks what an AI agent may do **before work starts** and **before each tool call**.
The user states the goal. A separate rule file — not the prompt — decides what is allowed,
what needs approval, and what is blocked. Every decision is recorded with the rule behind it,
so a reviewer can see why an action ran or was stopped.

## Why prompts aren't controls

| Problem | What goes wrong |
|---|---|
| Unclear permissions | "Fix it and finish" never names tools, branches, or online writes — one run edits local files, the next pushes to main. |
| Different behavior | Each team writes its own prompt, so similar agents pause or push on the very same request. |
| Approval fatigue | Users click through every step, then say "do everything automatically" — approvals get skipped wholesale. |
| Logs without a decision | The record shows `git push: ok` but not whether it was allowed, approved, or should have been blocked. |

## How a mission clears the airlock

1. **Preflight contract** — before any tool runs, Airlock shows the goal, allowed data and paths,
   tools, changes, approvals, and limits. The local user confirms it.
2. **Check every tool call** — each action is matched against the rule file and marked
   *allowed*, *ask first*, or *blocked*, with the rule that decided it.
3. **Receipts and record** — approvals are saved with the action, approver, time, reason,
   and expiry, so a reviewer can replay the run later.

## The gates

Each gate is its own module in the rule file, under `plugins/AirlockPlugin/gates/`:

| Gate | What it enforces |
|---|---|
| `approval` | Risky actions pause until a named approver signs off; the receipt records who, when, and why. |
| `model-catalog` | Only approved models and versions can be called. |
| `no-online-writes` | Pushes, posts, and other external writes are blocked before they reach a real system. |
| `secrets` | Credential files and secret paths stay out of reach. |

Every gate returns the same verdict set: **allowed**, **ask first**, or **blocked** — with the rule that decided it.

## What the POC demonstrates

- **Contract linter** — catches missing tools, conflicting rules, and approvals with no named approver before takeoff
- **Dry run** — previews every planned action as allowed / ask first / blocked, and explains the rule behind it
- **Live guardrails** — risky calls pause for approval; forbidden calls are blocked before they reach real systems
- **Receipts and activity record** — show *why* an action ran, not just what ran
- **Scope** — one developer machine, sample repo, local files, terminal UI; online writes and model calls are simulated

## Demo video (2 minutes)

| Time | Beat |
|---|---|
| 0:00 | What it is: Airlock checks what an agent may do before work starts and before each tool call |
| 0:20 | The failure case: "fix the bug and finish it" ends in a push to main |
| 0:40 | Preflight contract appears; the linter flags a conflicting rule; the user confirms |
| 1:00 | Dry run previews each action as allowed, ask first, or blocked |
| 1:20 | Agent edits files (allowed), pauses on the push (ask first), is blocked on the protected branch |
| 1:40 | Approval receipt and activity record show who approved what, and which rule decided |
