# no-online-writes gate

Blocks a user intent that requests a protected Git push or another listed
online write. `/yolo`, auto-approve, and
"do everything automatically" cannot authorize that write. This gate never
pushes or publishes. Git checks can read PR metadata over the network.

Team patterns live in `rules.json`. The MCP tool is `check_intent` (`prompt` only).
The demo skill is `airlock-intent-demo`.

### Git branch scope

- The protected branch is the **active open PR's base branch** for the current
  local source branch, not a hard-coded `master`, `main`, or default branch.
  GitHub repositories use read-only `gh pr view --json baseRefName,state`.
  Azure DevOps repositories use the read-only pull-request REST API, with the
  source branch and repository taken from local Git metadata.
- Azure DevOps supports HTTPS remotes on `dev.azure.com` and
  `<organization>.visualstudio.com`, plus `ssh.dev.azure.com` remotes.
  Authentication uses the existing Git credential helper non-interactively.
  No Azure CLI extension or new token configuration is required. Credentials
  remain in memory and are sent only to that Azure DevOps endpoint; they are
  never included in receipts, diagnostics, or command-line arguments.
- Explicit pushes to that base branch (including `refs/heads/<base>`) block.
  For a PR targeting `release/next`, `HEAD:release/next` blocks, while
  `release/next:feature` clears. The branch-name restriction applies across remotes.
- Explicit pushes to other branches clear this gate. This does not bypass host
  permissions or other Airlock gates.
- Missing/closed/ambiguous PRs, authentication errors, missing provider tools, and lookup
  failures block pushes with `git-pr-base-unavailable`. There is no guessed
  default-branch fallback. The PR base is refreshed on each check, so retargeting
  a PR does not leave a stale protected branch.
- Pushes without an explicit refspec, wildcard refspecs, unresolved destinations,
  `--all`, and `--mirror` remain blocked because they can update the PR base.
  The gate does not inspect repository configuration or resolve branch variables.
  `--dry-run` clears because it does not update remote refs.
- Local rebases clear, including rebasing onto the PR base. They do not update a
  remote branch; any subsequent push is checked separately.
- Natural-language `push to <base>` and `push to origin/<base>` block.
  Other publication patterns, such as creating pull requests, are unchanged.
- Hooks use the event's working directory; MCP checks use the server's working
  directory. Explicit `git -C` directories are resolved separately. Other Git
  repository/configuration overrides fail closed rather than checking the wrong
  repository.

### Prompt discussion versus execution

Git push checks are deferred during automatic prompt preflight, with the explicit
reason `git-push-check-deferred`. A prompt can quote a future/manual push or name
a repository different from the host working directory. Such discussion must not
prevent local inspection, rebasing, builds, or tests. The hook reports that local
work is cleared but pushes still require execution-time destination checks.

Every proposed shell push is checked separately by `preToolUse`, in execution
mode. A deferred prompt is **not** authorization to push: protected destinations
still block, and unresolved PR metadata still fails closed at that boundary.
Explicit MCP `check_intent` calls also use execution mode. The phase is trusted
hook context, not an MCP argument or user override.

Other publication rules (for example `npm publish`) still apply at prompt
preflight and execution. A blocked prompt blocks the whole mission, not just the
matching operation. Submit a new prompt after updating the plugin; an existing
blocked mission does not become allowed retroactively.

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
- Pushes to the resolved PR base → `blocked` / `online-write-intent`
- Pushes to other branches and local rebases → `cleared`
- Unavailable PR destinations → `blocked` / `git-pr-base-unavailable`
- `npm publish` → `blocked` / `online-write-intent`
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
| 2 | `Fix the bug and npm publish.` | `status: blocked`, `reason: online-write-intent` |
| 3 | `npm publish. /yolo do everything automatically.` | `status: blocked`, `reason: online-write-intent` |

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
- Receipts list `ruleId` and line number, never the prompt or `/yolo`.

Show a three-row table: status, reason, receipt path. Show the cleared artifact
path from prompt 1.

## 7. Stop conditions

Stop and do not claim success if any of these happen:

- `check_intent` is unavailable
- Prompt 1 is not `cleared`
- Prompt 2 or 3 is not `blocked` / `online-write-intent`
- The agent runs `git push`, `gh`, or another publisher after a block
- Any publication is performed (PR metadata lookups for Git checks are read-only)

This gate uses keyword/regex checks and bounded Git argument inspection on each
line. It is not a complete shell parser or a sandbox around `git` or `gh`.
