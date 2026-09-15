# model-catalog gate

Enforces the team stub catalog for a task and data class. The default model is
recorded locally. A permitted non-default is ask-first (today: blocked as
`approval-required`). Unknown models, blocked models, forbidden endpoints, and
out-of-boundary task/data pairs are blocked. No remote model is called.

Catalog entries live in `catalog.json`. The MCP tool is `select_model`
(`taskType`, `dataClass`, optional `model` / `endpoint`).
The demo skill is `airlock-model-demo`.

Follow every step below from a machine that has not run this demo before.

## 0. Prerequisites

Install these before anything else:

| Requirement | How to check | If missing |
|---|---|---|
| Windows PowerShell | Open a new PowerShell window | Use PowerShell, not Command Prompt |
| Git | `git --version` | Install Git for Windows |
| Node.js 24 | `node --version` must print `v24.x.x` | Install Node.js 24 LTS; do not use 22 or 25 |
| npm | `npm --version` | Comes with Node.js 24 |
| Agency Copilot | `agency --version` | Agency Copilot is required for the live demo |

Gitleaks / `npm run setup` is **not** required for this gate. Do not call a
hosted model API.

## 1. Get the plugin on disk

If you already cloned `agent-airlock`, skip clone and go to that folder.

```powershell
git clone https://github.com/debchoudhury-id4s/agent-airlock.git $HOME\Documents\agent-airlock
Set-Location $HOME\Documents\agent-airlock
git checkout main
git pull origin main
```

Confirm these files exist:

```powershell
Get-Item .\plugins\AirlockPlugin\gates\model-catalog\index.mjs
Get-Item .\plugins\AirlockPlugin\gates\model-catalog\catalog.json
Get-Item .\plugins\AirlockPlugin\tools\select-model.mjs
Get-Item .\plugins\AirlockPlugin\skills\airlock-model-demo\SKILL.md
```

Set a path you will reuse:

```powershell
$plugin = (Resolve-Path .\plugins\AirlockPlugin).Path
```

## 2. Install plugin packages

```powershell
Set-Location $plugin
npm ci
```

Stop if `npm ci` fails. Do not run `npm install` to "fix" the lockfile.

## 3. Prove the gate with tests (no Copilot yet)

From `plugins\AirlockPlugin`:

```powershell
node --test tests/select-model.test.mjs
```

Required result: every test **pass**, **fail 0**. If any test fails, do not start
the live demo.

What the tests already cover:

- Omit `model` → `selected` / `stub-default`
- `stub-override` → `blocked` / `approval-required` (ask-first; nothing runs)
- `stub-public` → `blocked` / `blocked-model`
- Unknown model, forbidden endpoint, and out-of-boundary data class cannot run
- No remote model call

## 4. Start Agency Copilot with this plugin

Leave the plugin folder. Start a **new** Agency Copilot session so an old plugin
path is not used.

```powershell
Set-Location $HOME\Documents\agent-airlock
agency copilot --plugin "local:$plugin"
```

To keep the plugin available across later Agency sessions:

```powershell
agency plugin install "local:$plugin" --engine copilot
```

If Agency asks to allow the `airlock-outbound` MCP server or the `select_model`
tool, allow it. That host permission does **not** bypass the catalog.

If `select_model` is missing from the tool list, stop. Restart with
`agency copilot --plugin "local:$plugin"`. Do not change Copilot's model picker
or call a hosted API.

## 5. Live demo

Paste this prompt exactly:

```text
Run the airlock-model-demo skill. Show the default selection, the non-default
approval pause, and the blocked model.
```

The skill must call `select_model` three times, in this order.

If you are not using the skill, call the tool yourself with these exact arguments:

| # | Arguments | Required result |
|---|---|---|
| 1 | `{ "taskType": "code-edit", "dataClass": "repo-local" }` | `status: selected`, `model: stub-default` |
| 2 | `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-override" }` | `status: blocked`, `reason: approval-required` |
| 3 | `{ "taskType": "code-edit", "dataClass": "repo-local", "model": "stub-public" }` | `status: blocked`, `reason: blocked-model` |

Do not add `approved`, `yolo`, or an extra endpoint. Do not retry a blocked
choice through another tool or a real model API.

## 6. Confirm the artifacts

After a successful demo:

```powershell
Get-ChildItem $HOME\.agent-airlock\outbound-demo\model-selections
Get-ChildItem $HOME\.agent-airlock\outbound-demo\receipts
```

- Call 1 creates one file under `model-selections` with `model: "stub-default"`.
- Calls 2 and 3 create receipts only. They must **not** create a selection file.
- Receipts list catalog reasons (`non-default-model` / `blocked-model`), never a
  raw prompt or API payload.

Show a three-row table: status, reason, receipt path. Show the selected artifact
path and `stub-default` from call 1.

## 7. Stop conditions

Stop and do not claim success if any of these happen:

- `select_model` is unavailable
- Call 1 is not `selected` / `stub-default`
- Call 2 is not `blocked` / `approval-required`
- Call 3 is not `blocked` / `blocked-model`
- The agent changes Copilot's model setting or calls a hosted model
- Any request leaves this computer

This gate records a local catalog decision. It does not control Copilot's model
picker, native APIs, or the workstation.
