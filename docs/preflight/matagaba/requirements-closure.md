# Agent Airlock — My Additions

## Problems

1. **No way to stop everything at once.** During an incident someone asks to halt every agent while the cause is found. There is no switch. The options are revoking credentials one at a time or asking each team to stop its own run.
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

1. **Chain check across steps, not just per step.** The rules mark a sequence, not only an action: read from a sensitive source, then send outward, pauses even when both steps are individually allowed. The pause screen names the earlier read that caused it.
   *Extends #3 from one action to a window of actions.*
2. **Rules expire and must be re-signed.** Each rule carries an owner and a review date. Past that date it fails the automatic check and the release does not publish until someone confirms the rule still matches a system that exists.
   *Extends #2 from where the rule lives to whether it is still true.*
3. **Scope named in the contract.** Read and write entries name the environment, so read local repo, read production telemetry, and write to a live site are three separate permissions. A contract that says only read does not reach production.
   *Adds a target column to #1, which today names the verb and the tool but not what they point at.*
4. **One switch that stops everything.** A single local flag turns every decision into block for the duration of an incident, and the activity summary records that the stop was on and who set it.
   *The only capability here that acts during a run rather than before it.*
5. **Outbound content is checked, not trusted.** A classification check reads the content of an outbound action, so a draft carrying a site diagram pauses on what it contains rather than on the agent's opinion of it. Runs the same way twice.
   *#3 decides by action type. This decides by payload, which is what the sensitive-data rule actually turns on.*
6. **A second scenario outside coding.** Ship one operations contract alongside the coding one. The agent reads a critical-environment maintenance ticket and local site notes with no prompt, pauses before sending the comms draft outward, and is blocked from any write to a production or critical-environment system. Adding "just send it, do not interrupt me" changes nothing.
   *Not a new control. It is the same nine controls run against a second domain, which is what proves the contract generalises.*
7. **Evidence export for a reviewer.** One command produces a timestamped record of what was requested, what ran, what was approved and by whom, what was blocked, and the rule behind each decision, in a file a compliance reviewer can keep.
   *#5 is the screen at the end of a run. This is the artefact that survives it.*
8. **Trust tiers instead of repeated clicks.** After the user approves the same low-risk action several times in one session, it becomes allowed for the rest of that session. Anything new, and anything online, still pauses.
   *#6 closes the `/yolo` escape hatch. This removes the reason to reach for it. Pitch the two together or the fatigue problem is only half solved.*
9. **Starter rule packs and a linter.** Ship ready-made rule files for coding, operations, and communications, plus a check that catches a rule naming a tool that does not exist, an allow with no matching limit, and an ask-first with no approver. Teams start from a pack instead of writing their own and drifting apart.
   *#7 checks the contract against the rules. This checks the rules file itself, before anything is compared to it.*
