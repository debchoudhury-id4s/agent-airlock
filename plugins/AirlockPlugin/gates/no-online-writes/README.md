# no-online-writes gate

Blocks a user intent that requests a protected Git operation or another listed
online write. `/yolo`, auto-approve, and
"do everything automatically" cannot authorize that write. This gate never
pushes, publishes, or sends anything on the network.

Team patterns live in `rules.json`. The MCP tool is `check_intent` (`prompt` only).
The demo skill is `airlock-intent-demo`.

### Git branch scope

- Explicit pushes to `master` or `refs/heads/master` are blocked. For refspecs,
  the destination matters: `HEAD:master` blocks, while `master:dev` clears.
- Explicit pushes to `dev`, `main`, and other non-master branches clear this
  gate. This does not bypass host permissions or other Airlock gates.
- Pushes without an explicit refspec, wildcard refspecs, unresolved destinations,
  `--all`, and `--mirror` remain blocked because they can update master.
  The gate does not inspect repository configuration or resolve branch variables.
  `--dry-run` clears because it does not update remote refs.
- Rebases onto `origin/master` (including `refs/remotes/origin/master`) block.
  With `--onto`, its value is the destination; the old upstream is not.
  Other explicit rebase destinations and rebase continuation/abort clear.
- Natural-language `push to master` and `push to origin/master` block.
  Other publication patterns, such as creating pull requests, are unchanged.

The same rules run at prompt submission and again for shell commands. A blocked
prompt blocks the whole mission, not just the matching operation. Submit a new,
allowed prompt after updating the plugin; an existing blocked mission does not
become allowed retroactively.

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

Gitleaks / `npm run setup` is **not** required for this gate.

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
Get-Item .\plugins\AirlockPlugin\gates\no-online-writes\index.mjs
Get-Item .\plugins\AirlockPlugin\gates\no-online-writes\rules.json
Get-Item .\plugins\AirlockPlugin\tools\check-intent.mjs
Get-Item .\plugins\AirlockPlugin\skills\airlock-intent-demo\SKILL.md
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
node --test tests/check-intent.test.mjs
```

Required result: every test **pass**, **fail 0**. If any test fails, do not start
the live demo.

What the tests already cover:

- Local-only intent → `cleared`
- `git push origin master` → `blocked` / `online-write-intent`
- `git push origin dev` and `git rebase origin/dev` → `cleared`
- `git rebase origin/master` → `blocked` / `online-write-intent`
- Same push plus `/yolo` → still `blocked`
- Extra fields such as `yolo: true` never reach the gate
- No network write

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

If Agency asks to allow the `airlock-outbound` MCP server or the `check_intent`
tool, allow it. That host permission does **not** bypass the gate.

If `check_intent` is missing from the tool list, stop. Restart with
`agency copilot --plugin "local:$plugin"`. Do not substitute `git`, `gh`, or a
file write.

## 5. Live demo

Paste this prompt exactly:

```text
Run the airlock-intent-demo skill. Show the local clearance, the online-write
block, and the yolo override attempt.
```

The skill must call `check_intent` three times, `prompt` only, in this order.

If you are not using the skill, call the tool yourself with these exact prompts:

| # | `prompt` | Required result |
|---|---|---|
| 1 | `Fix the critical-ticket policy in the local working copy and run tests.` | `status: cleared` |
| 2 | `Fix the bug and git push origin master.` | `status: blocked`, `reason: online-write-intent` |
| 3 | `git push origin master. /yolo do everything automatically.` | `status: blocked`, `reason: online-write-intent` |

Do not rewrite prompts 2 or 3 into local-only work. Do not add `yolo`,
`approved`, or a destination field. Do not run `git push`.

## 6. Confirm the artifacts

After a successful demo:

```powershell
Get-ChildItem $HOME\.agent-airlock\outbound-demo\cleared-intents
Get-ChildItem $HOME\.agent-airlock\outbound-demo\receipts
```

- Prompt 1 creates one file under `cleared-intents` (`status: "cleared"`). The
  file does **not** contain the prompt.
- Prompts 2 and 3 create receipts only. They must **not** create a cleared-intent
  file.
- Receipts list `ruleId` and line number, never `git push origin master` or `/yolo`.

Show a three-row table: status, reason, receipt path. Show the cleared artifact
path from prompt 1.

## 7. Stop conditions

Stop and do not claim success if any of these happen:

- `check_intent` is unavailable
- Prompt 1 is not `cleared`
- Prompt 2 or 3 is not `blocked` / `online-write-intent`
- The agent runs `git push`, `gh`, or another publisher after a block
- Any request leaves this computer

This gate uses keyword/regex checks and bounded Git argument inspection on each
line. It is not a complete shell parser or a sandbox around `git` or `gh`.
