---
name: trending-cost
description: Show the automatic trending-cost gate's local month-to-date cost, current-day cost, and current-day token usage. Use when asked to demo or explain trending cost.
---

# Trending cost

The plugin's `userPromptSubmitted` hook already runs before every user prompt.
This skill demonstrates the structured report; it is not what activates the
automatic hook.

Use the `trending_cost` tool from the `airlock-outbound` MCP server with an
empty argument object. If it is unavailable, stop and ask the user to reload
the plugin. Do not substitute a web API, GitHub API, billing portal, or another
usage source.

Explain that the values are local Copilot CLI estimates from the invoking
profile's read-only `~/.copilot/session-store.db`:

- Month-to-date is local midnight on the first day of the month through now.
- Today is local midnight through now.
- Estimated dollars are AIU multiplied by the reviewed local rate.
- Today's total tokens are input plus output; reasoning and cache tokens are
  shown separately.

Show month-to-date cost, today's cost, today's input/output/total/reasoning
tokens, policy mode, threshold, decision, and receipt path. Do not claim the
report is an invoice or includes other machines, IDE usage, or hosted agents.
Do not perform an online write.
