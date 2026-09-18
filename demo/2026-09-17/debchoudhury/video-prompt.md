# Agent Airlock 2-minute film. Requirements for the executing LLM.

This file is a requirements brief. It is not a shot list. It does not tell you the plot, the characters, the camera moves, or the dialogue. You choose those. The film must still meet every requirement below.

Do not treat this as a slide script. The output must be a short animated movie that a stranger would keep watching.

## Job

1. Ground every product claim in the three sources in [Truth](#truth).
2. Produce one self-contained film of 1:55 to 2:05.
3. Make the audience feel why an organization cannot leave agent power to a prompt, a model, or a hurried engineer.
4. Make Agent Airlock the thing that returns control to the organization.

## Truth

Read only these sources before you invent story, narration, or on-screen product behavior:

1. `C:\Users\debchoudhury\Documents\agent-airlock\docs\prd.md`
2. Code under `C:\Users\debchoudhury\Documents\agent-airlock\plugins`
3. Code under `C:\Users\debchoudhury\Documents\agent-airlock\sandbox`

If those sources disagree, the running code wins. If a capability is not in those sources, do not show it and do not say it. Label any illustrated failure that is not a live run.

## Value the film must prove

The film is not a feature tour. It is an argument.

1. Organizations are adopting agents that can write, publish, and change real systems. A prompt is not a policy. [OWASP guidance on LLM agency and unbounded consumption](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) is the public shape of this risk.
2. Sovereignty means the organization owns the rules of use. The model does not. The individual chat does not. Local "yolo" does not.
3. Governance must be enforced in the path of action, not asked as a courtesy after the fact. Compare this to how orgs already enforce identity and access, for example [Azure policy](https://learn.microsoft.com/en-us/azure/governance/policy/overview) and [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets): rules sit outside the worker.
4. Safe AI usage is the outcome: people can still move fast on allowed local work, while forbidden outbound and sensitive actions cannot slip through.
5. Airlock's value is that same idea applied to agents: a checkpoint between intent and supported action, with a recorded verdict the org can stand behind.

The audience should leave with one sentence in their head: the org sets what agents may do, and Airlock makes that binding.

## Form

1. Runtime 1:55 to 2:05. 1920x1080. H.264 plus AAC. Captions on screen.
2. The piece must play as an animated movie. Continuous motion. Character, tension, and consequence. Not a PowerPoint. Not a deck export. Not title cards with fade. Not a talking-head explainer with bullet overlays as the main visual.
3. At least 70 percent of runtime must be moving picture: staged action, animated environments, or live product footage in motion. Static slides may appear only as a brief beat inside a larger scene.
4. Narration must sound like a short film, not a product demo. Human. Urgent. Plain words.
5. The first 30 seconds must create a human stake. Someone needs an outcome. Time is short. An agent is the fastest path. The prompt is reasonable and underspecified.
6. The middle must show the cost of missing org control, then the same kind of request under Airlock. The contrast is the story. You pick the incident, as long as it is honest about what this repo can and cannot do.
7. The last third may go closer to mechanism. Keep it cinematic. Do not switch into a lecture.

## Product proof the film must include

These are required subjects. They are not a sequence you must film in this order.

1. An [Agency](https://github.com/github/copilot-cli) Copilot-style terminal in motion: a command being entered, a response appearing, a gate decision landing on screen.
2. At least one allowed path for safe local work.
3. At least one blocked or approval-required path.
4. A real decision record, receipt, or activity record from this repo's runtime, if you can produce one locally. If you cannot, say so on screen. Do not fake a receipt.
5. A short, accurate look at exactly two gates, and which code in each gate does the deciding:
   1. `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\no-online-writes`
   2. `C:\Users\debchoudhury\Documents\agent-airlock\plugins\AirlockPlugin\gates\sensitive-information`
6. Those two gates must be framed as org-enforced controls, not as a developer's personal linter.

## Quality bar

1. A person who does not know this hack should understand the danger and the value without reading a repo.
2. A person who does know this hack should not catch an inflated claim.
3. Every on-screen verdict, reason, and field must match the sources or a local run you actually performed.
4. Prefer showing over telling. If the gate blocks, the audience should see the block.

## Constraints

1. Do not push, open pull requests, or write to remotes.
2. Keep generated film files local. Do not commit unless the user later asks.
3. Do not send repo secrets, real tokens, or internal incident data to third-party media APIs.
4. Do not add gates, tools, or behaviors that are not in the three sources.
5. Do not make the film about a generic AI safety sermon. Make it about this product's job: org policy on agent action.

## Done when

1. The file is a watchable 2-minute animated movie.
2. The sovereignty argument is unmistakable.
3. The two named gates are visible and true to the code.
4. Nothing important looks like a slideshow.