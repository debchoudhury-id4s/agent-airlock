# Agent Airlock 6-minute film. Requirements for the executing LLM.

This file is a requirements brief. It is not a shot list. It does not name the company, the plot, the characters, the camera moves, or the dialogue. You choose those. The film must still meet every requirement below.

Do not treat this as a slide script. The output must be a short animated drama that a stranger would keep watching.

The finished film must feel like a real workplace story. Never mention a hack, a demo, a proof of concept, a science fair, a sample repo, or that no production outage occurred. Those facts are implicit. Do not put disclaimers, "simulated incident" cards, or "no systems were harmed" lines on screen or in narration.

## Job

1. Ground every product claim in the three sources in [Truth](#truth).
2. Produce one self-contained film of 5:50 to 6:10.
3. Make the audience feel why an organization cannot leave agent power to a prompt, a model, or a hurried engineer.
4. Make the cost of that gap visceral: outages, customer harm, and the human fallout across a team.
5. Make team governance the spine of the story. The org owns the rules of use. The individual chat does not.
6. Make Agent Airlock the thing that returns control to the organization.

## Truth

Read only these sources before you invent story, narration, or on-screen product behavior:

1. `C:\Users\debchoudhury\Documents\agent-airlock\docs\prd.md`
2. Code under `C:\Users\debchoudhury\Documents\agent-airlock\plugins`
3. Code under `C:\Users\debchoudhury\Documents\agent-airlock\sandbox`

If those sources disagree, the running code wins. If a capability is not in those sources, do not show it and do not say it.

Dramatized outages belong to the story world of missing org control. They are not product footage. Do not claim they were produced by a live run of this repo. Do not caption them as fake. Product UI, verdicts, reasons, and receipts must still match the sources or a local run you actually performed.

## Value the film must prove

The film is not a feature tour. It is an argument told as an incident.

1. Organizations are adopting agents that can write, publish, and change real systems. A prompt is not a policy. [OWASP guidance on LLM agency and unbounded consumption](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) is the public shape of this risk.
2. Sovereignty means the organization owns the rules of use. The model does not. The individual chat does not. Local "yolo" does not. A teammate's urgency does not.
3. Governance must be enforced in the path of action, not asked as a courtesy after the fact. Compare this to how orgs already enforce identity and access, for example [Azure policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview) and [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets): rules sit outside the worker.
4. The same rules bind every engineer and every session. Policy lives in a versioned team file, outside prompts and outside the agent's writable paths. Request wording, `/yolo`, auto-approve, and retries cannot widen rights.
5. Safe AI usage is the outcome: people can still move fast on allowed local work, while forbidden outbound and sensitive actions cannot slip through.
6. Airlock's value is that same idea applied to agents: a checkpoint between intent and supported action, with a recorded verdict the org can stand behind when the war room asks who allowed it.

The audience should leave with one sentence in their head: the team sets what agents may do, and Airlock makes that binding.

## Story the film must earn

You invent the company, the product, and the people. The drama must still obey this shape.

### Ensemble

Use at least six named characters with distinct jobs and conflicting incentives. They must talk like colleagues under pressure, not like narrators. Required roles:

1. An engineer who writes a reasonable, underspecified prompt because time is short.
2. A teammate in a second session who tries to help, including by asking the agent to just do it, ship it, or run with `/yolo`.
3. The on-call or SRE who inherits the blast radius.
4. A named reviewer or tech lead who is supposed to own outbound change.
5. A platform, security, or governance owner who maintains the team's rules, not a personal linter.
6. Someone who feels the customer or business cost: a manager, support lead, or partner team.

No cartoon villains. The engineer is not reckless. The prompt is plausible. The failure is a missing org control, not a morality play about one person.

### Dramatic question

By the first minute the audience must want the answer to: will this team ship the fix, or will the agent take a shortcut that the org never agreed to?

Hold that question. Do not name Airlock in the first 75 seconds.

### Without org control

Spend real runtime on the cascade, not a montage. Dramatize at least three distinct agent-driven failures and the repercussions of each. Choose incidents that map honestly to actions this product actually gates, including patterns in `plugins\AirlockPlugin\gates\no-online-writes\rules.json` and the sensitive-information / secrets / model / dependency gates. Examples of the *kind* of harm to dramatize, not a required plot:

- An underspecified "fix it and finish it" that becomes a push to `main`, a production apply, or another outbound write.
- A draft, log, or message that carries a credential, customer personal data, or internal-only material.
- A public or unapproved model path, or a dependency change the team would not have allowed.

Show the human and operational cost in realistic workplace texture: pagers, war-room calls, overlapping chats, a dependent team blocked, customers waiting, a lead asking who approved it, a person staring at a prompt they thought was harmless. Make the outage feel expensive. Let silence and faces carry weight. Do not resolve it with a joke.

The moral of this act is not "agents are bad." It is: the org never got a vote.

### With org control

Then run the same *kinds* of requests through Airlock. The contrast is the story.

Show the team, not a hero clicking Block:

- A mission or contract that states the goal without granting permission.
- Team rules that already exist before the chat starts.
- Local work that still moves fast.
- Outbound and sensitive paths that stop in the path of action.
- A named reviewer who must decide, with an approval that cannot be reused, skipped, or widened by wording.
- Two people, two sessions, the same rules, the same verdict.
- A later question from the war room or a reviewer a week later: why was this blocked, and what was allowed? Answer with a record, not a shrug.

Keep it cinematic. Do not switch into a lecture.

## Form

1. Runtime 5:50 to 6:10. 1920x1080. H.264 plus AAC. Captions on screen.
2. The piece must play as an animated movie. Continuous motion. Character, tension, and consequence. Not a PowerPoint. Not a deck export. Not title cards with fade. Not a talking-head explainer with bullet overlays as the main visual.
3. At least 70 percent of runtime must be moving picture: staged action, animated environments, or live product footage in motion. Static slides may appear only as a brief beat inside a larger scene.
4. Narration, if any, must sound like a short film, not a product demo. Human. Urgent. Plain words. Prefer dialogue, reaction, and pictures over voiceover.
5. First 75 seconds: human stake, several people in the same night or morning, time is short, an agent is the fastest path, the prompt is reasonable and underspecified.
6. Roughly the next two minutes: the cost of missing org control. Multiple scenarios. Escalating repercussions across the ensemble. Stay in the incident. Do not cut away to features.
7. Roughly the next two minutes: the same kinds of request under Airlock. Team policy in the path of action. Allowed local speed beside blocked outbound harm.
8. Last 60 to 90 seconds: closer to mechanism and governance. Receipts. Who owns the rules. The binding sentence. End on people who can work again, not on a logo card.

## Product proof the film must include

These are required subjects. They are not a sequence you must film in this order.

1. An [Agency](https://github.com/github/copilot-cli) Copilot-style terminal in motion: a command being entered, a response appearing, a gate decision landing on screen.
2. At least one allowed path for safe local work.
3. At least one blocked outbound or online-write path, including a `/yolo` or "just do it" attempt that still cannot widen rights.
4. At least one blocked or approval-required sensitive path: a secret, and at least one of personal data or an `INTERNAL-ONLY` label.
5. A real decision record, receipt, or activity record from this repo's runtime, if you can produce one locally. If you cannot, say so on screen without breaking the story world (treat it as a missing record, not as a demo failure). Do not fake a receipt.
6. Two people or two sessions bound by the same team rules. Decisions and reasons must match for the same kind of request.
7. A named reviewer in the approval path. Waiting, closing the prompt, or reusing an old approval must not count.
8. Accurate looks at the deciding code for these gates, framed as org-enforced controls, not as a developer's personal linter:
   1. `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\no-online-writes`
   2. `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\sensitive-information`
   3. At least two more from this list, true to their code:
      - `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\model-catalog`
      - `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\dependency-risk`
      - `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\approval`
      - `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\secrets`
      - `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\trending-cost`
9. Team rules visible as a shared artifact: versioned, outside the prompt, outside the agent's writable paths. A contract may only narrow them.

## Quality bar

1. A person who does not know this product should understand the danger, the outage, and the value without reading a repo.
2. A person who does know this product should not catch an inflated claim.
3. Every on-screen Airlock verdict, reason, and field must match the sources or a local run you actually performed.
4. Prefer showing over telling. If the gate blocks, the audience should see the block. If the outage hurts, the audience should feel who pays.
5. The governance point must be unmistakable: the team owns the rules; Airlock enforces them in the path of action; the chat cannot vote them away.
6. Never mention a hack, demo, proof of concept, science fair, or that no unintended outage was caused.

## Constraints

1. Do not push, open pull requests, or write to remotes.
2. Keep generated film files local. Do not commit unless the user later asks.
3. Do not send repo secrets, real tokens, or internal incident data to third-party media APIs. Use only synthetic credentials and fake personal data if a draft must contain a match.
4. Do not add gates, tools, or behaviors that are not in the three sources.
5. Do not make the film about a generic AI safety sermon. Make it about this product's job: org policy on agent action, owned by the team.
6. Do not break the story world with production disclaimers.

## Done when

1. The file is a watchable 6-minute animated movie.
2. The sovereignty argument is unmistakable, and it is a team argument, not a single-user argument.
3. The outages and repercussions are dramatic enough that a stranger cares.
4. The named gates are visible and true to the code.
5. Nothing important looks like a slideshow.
6. Nothing in the film mentions a hack, a demo, or that no outage occurred.
