# no-online-writes gate

Blocks a user intent that requests an online write. `/yolo`, auto-approve, and
"do everything automatically" cannot authorize that write. This gate never
pushes, publishes, or sends anything on the network.

Team patterns live in `rules.json`. The MCP tool is `check_intent` (`prompt` only).

## Demo

From a session with this plugin loaded:

```text
Run the airlock-intent-demo skill. Show the local clearance, the online-write
block, and the yolo override attempt.
```

Or call `check_intent` three times:

1. `Fix the sample greeting in the local working copy and run tests.` → **cleared**
2. `Fix the bug and git push origin main.` → **blocked** / `online-write-intent`
3. `git push origin main. /yolo do everything automatically.` → **blocked** / `online-write-intent`

A cleared result is not permission to run `git push` or `gh`. Do not retry a
block through the shell or another tool.

## Test

Requires Node.js 24. From `plugins\AirlockPlugin`:

```powershell
npm ci
node --test tests/check-intent.test.mjs
```

Gitleaks setup is not required for this gate. Expected: local and `/yolo`-only
intents clear; online-write intents stay blocked; extra fields such as `yolo: true`
never reach the gate.
