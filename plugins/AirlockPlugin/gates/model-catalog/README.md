# model-catalog gate

Enforces the team stub catalog for a task and data class. The default model is
recorded locally. A permitted non-default is ask-first (today: blocked as
`approval-required`). Unknown models, blocked models, forbidden endpoints, and
out-of-boundary task/data pairs are blocked. No remote model is called.

Catalog entries live in `catalog.json`. The MCP tool is `select_model`
(`taskType`, `dataClass`, optional `model` / `endpoint`).

## Demo

From a session with this plugin loaded:

```text
Run the airlock-model-demo skill. Show the default selection, the non-default
approval pause, and the blocked model.
```

Or call `select_model` three times:

1. `{ "taskType": "code-edit", "dataClass": "repo-local" }` → **selected** / `stub-default`
2. `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-override" }` → **blocked** / `approval-required`
3. `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-public" }` → **blocked** / `blocked-model`

Do not add `approved` or `yolo`. Do not change Copilot's model picker or call a
hosted API.

## Test

Requires Node.js 24. From `plugins\AirlockPlugin`:

```powershell
npm ci
node --test tests/select-model.test.mjs
```

Gitleaks setup is not required for this gate. Expected: default selection writes
a local record; non-default does not execute; blocked and unknown models cannot
run.
