# trending-cost gate

`trending-cost` is an automatic, local Copilot CLI usage gate. While the plugin
is loaded, its `userPromptSubmitted` hook runs before every submitted prompt,
including unrelated prompts such as `How is the weather?`, and prints one
persistent line in the CLI timeline.

The default policy mode is **advisory**. It always reports the values and lets
the prompt continue, even when the configured threshold is reached. The same
gate can be changed to **enforce** mode so a prompt is blocked when
month-to-date estimated cost is greater than or equal to the threshold.

The gate and hook do not call a billing API and do not perform an online write.
They open the invoking profile's `~\.copilot\session-store.db` read-only.

## Reported values

| Value | Window and calculation |
|---|---|
| Month-to-date cost | Local time from 00:00 on the first day of the current month through hook execution time |
| Current-day cost | Local time from 00:00 today through hook execution time |
| Current-day tokens | Input plus output tokens in the current-day window |
| Reasoning/cache tokens | Reported separately in the structured tool result |
| Estimated USD | `AIU * usdPerAiu`; default reviewed rate is `$0.01` per AIU |

This is a local Copilot CLI estimate, not an invoice. It does not merge other
machines and does not claim to include IDE, hosted-agent, or other account-wide
usage.

## Files

```text
plugins\AirlockPlugin\
  hooks\
    hooks.json                         userPromptSubmitted registration
    trending-cost.mjs                 automatic CLI hook entry point
  gates\trending-cost\
    index.mjs                          advisory/enforce gate decision
    usage.mjs                          read-only SQLite aggregation and formatting
    README.md                          this end-to-end guide
  policies\
    trending-cost.json                mode, threshold, rate, and gate binding
  tools\
    trending-cost.mjs                 structured MCP report and local receipt
  skills\trending-cost\
    SKILL.md                           optional structured demo
  tests\
    trending-cost.test.mjs            reader, gate, hook, tool, and MCP coverage
```

The hook is what makes the gate automatic. The skill is only an optional
demonstration and is not required for per-prompt output.

## Make another gate apply to every prompt

Putting a gate under `gates\`, registering it in `gates\index.mjs`, or binding
it to an MCP tool does **not** make it run automatically. MCP-bound gates run
only when that MCP tool is selected. To apply any other gate to every submitted
prompt, including an unrelated prompt such as `How is the weather?`, make all
of these changes:

1. Register the gate in `gates\index.mjs` so only trusted plugin code can load
   it.
2. Bind the gate to a dedicated prompt action in a reviewed policy, for example
   `prompt_submit` in `policies\prompt-gates.json`.
3. Add or extend a command under `userPromptSubmitted` in
   `hooks\hooks.json`. Do not add a matcher; an unfiltered
   `userPromptSubmitted` entry is what causes the command to run for every
   prompt.
4. In that hook command, read the hook JSON from standard input, validate its
   `prompt`, construct the plugin-owned action, and call
   `createPolicyEvaluator`. A typical action is:

   ```javascript
   {
     tool: "prompt_submit",
     target: "submitted-prompt",
     input: { prompt }
   }
   ```

5. Adapt the action input to the gate's actual contract. For example,
   `no-online-writes` already expects `input.prompt`; a content scanner may
   deliberately map the same prompt to `input.content`. A gate such as
   `model-catalog` needs `taskType` and `dataClass`, so it cannot be attached
   meaningfully until the prompt hook supplies reviewed values for those
   fields. Do not pass caller-controlled policy, threshold, approval, target,
   or gate IDs through the hook input.
6. Translate the composed result into hook output. For an advisory gate, emit
   a `progress` message followed by `{}`. To stop the prompt, emit one final
   object shaped like:

   ```json
   {
     "decision": "block",
     "reason": "A reviewed prompt gate blocked this request."
   }
   ```

7. Add tests proving both a gate-specific match and an unrelated prompt invoke
   the hook, proving allow cannot override a block, and proving no prompt text
   or matched value is written to receipts or output.
8. Restart the plugin session after changing hook registration or policy.

An illustrative policy binding is:

```json
{
  "id": "prompt-gates",
  "version": "1",
  "tools": {
    "prompt_submit": ["no-online-writes", "another-prompt-gate"]
  }
}
```

The hook adapter and its policy must use the same action name and input shape.
Adding `"another-prompt-gate"` to `policies\default.json` under an unrelated
tool such as `publish_draft` is insufficient: it would run only when that tool
is called, not for every prompt.

## End-to-end demo

### 1. Prerequisites

Use Windows PowerShell with Node.js 24 and npm:

```powershell
node --version
npm --version
agency --version
```

`node --version` must print `v24.x.x`. The implementation uses Node's built-in
read-only SQLite support. Gitleaks and `npm run setup` are not required for the
targeted trending-cost test or hook.

### 2. Install the plugin packages

From the repository root:

```powershell
$plugin = (Resolve-Path .\plugins\AirlockPlugin).Path
Set-Location $plugin
npm ci
```

Stop if `npm ci` fails. Do not replace the lockfile with an unreviewed install.

### 3. Run the targeted tests

```powershell
node --test tests\trending-cost.test.mjs
```

Required result: every test passes. The tests use temporary local SQLite files
and cover:

- Local month and day boundaries
- Month-to-date and current-day cost
- Current-day input/output/total/reasoning tokens
- Missing and incompatible session stores
- Advisory over-threshold behavior
- Enforced `>=` threshold blocking
- Hook registration without a prompt matcher
- Hook CLI progress output
- The `trending_cost` MCP tool and local-only receipt

### 4. Load the plugin in a fresh session

From any repository where you want to demonstrate it:

```powershell
agency copilot --plugin "local:$plugin"
```

Or load it directly in Copilot CLI:

```powershell
copilot --plugin-dir "$plugin"
```

Start a new session after changing the plugin or its policy. Confirm the plugin
hook is present with `/env`. If hooks are disabled in the CLI or repository
settings, re-enable them before the demo.

### 5. Prove that it runs for unrelated prompts

Submit each line as a separate prompt:

```text
How is the weather?
```

```text
What is 2 + 2?
```

Before each prompt is processed, the CLI must show a line shaped like:

```text
Trending cost (local CLI estimate) | MTD 2026-09-01-now: $123.45 | Today: $6.78 | Today tokens: 12,345 (12,000 input / 345 output; 123 reasoning)
```

The values will differ. In the default `advisory` mode, the normal prompt then
continues. No skill name or MCP tool call is needed to trigger this line.

If the line does not appear, stop and check:

1. The session was started with this plugin path.
2. `hooks\hooks.json` is listed by `/env`.
3. Node.js 24 is on `PATH`.
4. Hooks are not disabled.
5. `node hooks\trending-cost.mjs` prints one progress JSON line and `{}`.

### 6. Show the structured report

For the optional MCP/skill demo, ask:

```text
Run the trending-cost skill and show the structured local usage report.
```

The skill calls `trending_cost` with no arguments. Expected default result:

- `status: reported`
- `decision: allow`
- `report.monthToDate.costUsd`
- `report.today.costUsd`
- `report.today.inputTokens`
- `report.today.outputTokens`
- `report.today.totalTokens`
- `report.today.reasoningTokens`
- A receipt under `~\.agent-airlock\outbound-demo\receipts`

The automatic hook itself does not create a receipt on every prompt. Only the
manual MCP report uses the shared broker and writes a local decision receipt.

## Make the gate mandatory

Edit `policies\trending-cost.json` and change only the reviewed settings:

```json
{
  "settings": {
    "mode": "enforce",
    "monthToDateLimitUsd": 800,
    "unavailableBehavior": "allow",
    "usdPerAiu": 0.01
  }
}
```

Keep the other policy fields and the `trending_cost` binding unchanged. Restart
the plugin session. When month-to-date estimated cost is **greater than or equal
to `$800.00`**, the hook still prints the usage line and then blocks the prompt
with a message like:

```text
Trending-cost gate blocked this prompt: month-to-date estimated local CLI cost $812.34 is at or above the configured $800.00 limit.
```

The prompt does not reach the model. The CLI command exits unsuccessfully in
non-interactive prompt mode.

If current month-to-date cost is below `$800.00`, temporarily use
`"monthToDateLimitUsd": 0` to demonstrate the block, then restore the reviewed
threshold. To fail closed when the local store is missing or unreadable, also
set `"unavailableBehavior": "block"`.

To return to the optional behavior, restore:

```json
"mode": "advisory"
```

Then restart the plugin session and submit another prompt. The report must print
and the prompt must continue.

## Safety and limits

- The SQLite database is opened with `readOnly: true`.
- No prompt text is stored in the usage report or its receipt.
- Hook output contains aggregates only.
- A hook timeout follows the host's hook behavior; it is not a guaranteed
  enforcement boundary against a disabled or unavailable hook.
- Installed plugin files and the local operator remain trusted.
- This gate does not control native shell commands, another plugin, another
  machine, or non-Copilot-CLI usage.
