# Agent Airlock — My Additions

## Problems

1. **No way to stop at certain points in time. There are no checks and balances at each stage, the assumption is that when you ask the agent to do something it is inferring what you actually intend.** During an incident someone asks to halt a step in the agent. There is no switch. The options are revoking credentials one at a time or asking each team to stop its own run.
   *No existing item covers the incident case. Every current control is per-run and decided before the run starts.*
2. **A data boundary nobody reads.** The rule says never send sensitive information outside the company. Nothing inspects the content of an outbound action, so whether a draft carrying a site diagram counts is the agent's own judgement. Two runs, two answers.
   *Not #2: the problem is not where the rule lives. Move it to a rules file and it still cannot be applied, because no check reads the payload.*
3. **One domain proven, the rest assumed.** The prototype proves a local coding flow. Operations, company search, external messages, and finance are assumed to work the same way. Nobody has run a contract against a maintenance ticket or an outbound comms draft to find out whether the vocabulary even fits.
   *A coverage gap rather than a control gap. It is the reason the other items here surfaced late.*
4. **Delegation with no contract.** Agent A is scoped to read-only investigation and hands a subtask to Agent B. Agent B loads its own rules, which allow a write. The user approved one scope and got two.
   *Not #1 or #2: both agents have contracts and both load a rules file. Neither inherits the other's limits.*
5. **A log is not an audit.** A reviewer asks for evidence that a blocked action was blocked. What exists is a console transcript in a session that has since ended. Nothing is exported, timestamped as a record, or retained.
   *Adjacent to #4, and downstream of it. #4 is a log that does not say why. This is a log nobody can produce a week later, however good it was on screen.*

## Capabilities

6. **Stage gates inside the run, not just before it.** The contract declares checkpoints between phases: after investigation and before edits, after edits and before tests, after tests and before any outbound step. At each gate the agent stops and states what it concluded and what it plans next, in one line. Nothing about the plan is inferred past a gate. A run configured with no gates behaves exactly as it does today, so gates are opt-in per contract.
    *#1 is a single decision made before takeoff, and #3 decides one action at a time. Neither gives a person a place to stand mid-run. Closes the first half of problem 1.*
7. **A stop that applies to a run in flight.** One local flag turns every subsequent decision into block, and it takes effect on the current run rather than the next one. In-flight work is left where it stands, no partial write is completed, and the activity summary records that the stop was set, by whom, and at which step. Clearing it needs a person, not a retry.
    *Every existing control resolves before the run starts. This is the only one that acts during it. Closes the second half of problem 1.*
8. **Outbound content is checked, not trusted.** A classification check reads the content of an outbound action, so a draft carrying a site diagram pauses on what it contains rather than on the agent's opinion of it. The pause screen names the matched content, not just the action type. Same input, same decision, every run.
    *#3 decides by action type and #2 decides by rule location. Problem 2 turns on the payload, which neither one reads. Closes problem 2.*
9. **A second scenario outside coding.** Ship one operations contract alongside the coding one, using the same vocabulary. The agent reads a critical-environment maintenance ticket and local site notes with no prompt, pauses before sending the comms draft outward, and is blocked from any write to a production or critical-environment system. Adding "just send it, do not interrupt me" changes nothing. Where the coding vocabulary does not fit the ops case, that mismatch is the finding.
    *Not a new control. It is the existing nine run against a second domain, which is the only thing that shows the contract generalises. Closes problem 3.*
10. **Delegated work inherits the caller's contract.** When an agent hands a subtask to another agent, the second one starts from the first one's contract and may narrow it, never widen it. A subagent that loads rules granting more than its caller holds fails the pre-flight check and does not start. The activity summary shows the delegation and the scope it ran under.
    *#1 and #2 both assume one agent and one contract. Neither says what happens when a contract is passed along. Closes problem 4.*
11. **Evidence export for a reviewer.** One command produces a timestamped record of what was requested, what ran, what was approved and by whom, what was blocked, and the rule behind each decision, as a file that outlives the session. It includes the rule file version in force at the time, so a decision can be replayed against the rules as they actually were.
    *#5 is the screen at the end of a run. This is the artefact that survives it, which is what problem 5 is about. Closes problem 5.*
