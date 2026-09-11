# 2026-09-10

## Problems
1. **Bad rules may go unnoticed.** A rule may name a tool that does not exist, conflict with another rule, or require approval without naming an approver. The agent may start with rules that cannot work as intended.
2. **Users cannot preview the decisions.** A user may not know which actions will run, pause for approval, or be blocked until the agent starts working. This makes mistakes harder to find before they matter.
3. **Approvals do not leave clear proof.** After a user approves an action, it may be difficult to show who approved it, what they approved, and when the approval happened. A reviewer may not have enough information to understand the decision later.

## Capabilities
1. **Contract linter.** Check each contract and rule file before the agent starts. Report missing tools, conflicting rules, missing approvers, and other simple mistakes in clear language.
2. **Dry-run mode.** Show how Agent Airlock would handle each planned action without running it. Mark every action as allowed, ask first, or blocked, and explain the rule behind the decision.
3. **Approval receipts.** Save a record whenever a user approves an action. The record includes the exact action, the approver, the time, the reason for approval, and when the approval expires.
