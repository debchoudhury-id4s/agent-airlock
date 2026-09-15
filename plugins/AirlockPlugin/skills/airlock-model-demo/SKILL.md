---
name: airlock-model-demo
description: Demonstrate Airlock selecting the team default model and blocking unknown, blocked, or unapproved non-default models. Use when asked to run the Airlock model catalog demo.
---

# Airlock model catalog demo

Use the `select_model` tool from the `airlock-outbound` MCP server.
If it is unavailable, stop and ask the user to load the plugin. Do not call a
hosted model, change the user's model setting, or send data to an endpoint.

Explain that this is a local catalog check. A selected result records the team
default only. No remote model is called.

Make these three tool calls in order:

1. Default: `{ "taskType": "code-edit", "dataClass": "repo-local" }`
2. Permitted non-default: `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-override" }`
3. Blocked choice: `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-public" }`

Do not add `approved`, `yolo`, or an endpoint unless it is in the catalog demo
above. `/yolo` is not a permission.

Expect selected, blocked, blocked. The non-default case is `approval-required`
because shared approval is not implemented. The blocked model is `blocked-model`.
The server enforces the catalog, not this skill. Never retry a blocked choice
through another tool or a real model API.

Show a short table with each returned status, rule/reason, and receipt path.
Show the selected artifact path and model id. Do not claim this controls Copilot's
own model picker, native APIs, or the workstation.
