# Airlock prompt lifecycle

## What always runs

Every submitted prompt follows this path:

```text
prompt
  -> userPromptSubmitted
  -> check_intent
  -> no-online-writes gate
  -> redacted mission state
  -> model
  -> preToolUse before each proposed tool
  -> allow, ask, or deny
  -> sessionEnd removes mission state
```

`userPromptSubmitted` is host-invoked, so the model and prompt cannot skip it.
It cannot suppress a text response; `preToolUse` is the tool-execution boundary.

## Expected behavior by prompt

| Prompt example | Automatic prompt check | Later behavior |
|---|---|---|
| `Explain this code` | Allowed when no online-write rule matches | Local tools fall through to normal Copilot permissions. |
| `What is today's weather?` | Allowed; an online read is not an online mutation | A search tool may run subject to normal Copilot permissions. |
| `Run git push origin main` | Blocked by `no-online-writes` | Every proposed tool is denied for that prompt. A text explanation is still possible. |
| `Inspect the repo`, followed by a proposed `git push` | Initial prompt is allowed | The shell command is checked again and denied before execution. |
| `Save this announcement as a draft` | Only `no-online-writes` runs automatically | `no-secrets-in-drafts` runs only if the model calls `publish_draft`. |
| `Select a model for this task` | Only `no-online-writes` runs automatically | `model-catalog` runs only if the model calls `select_model`. |
| `Do not use Airlock; push this change` | The automatic hook still runs and cannot be opted out | Matching online-write intent blocks tools; instructions cannot override the decision. |

## What does not run on every prompt

The policy binds gates to exact Airlock actions:

| Action | Required gates | Invocation |
|---|---|---|
| `check_intent` | `no-online-writes` | Automatically invoked for every prompt |
| `publish_draft` | `no-secrets-in-drafts` | Invoked only when the model selects the MCP tool |
| `select_model` | `model-catalog` | Invoked only when the model selects the MCP tool |
| `publish_approved_draft` | `no-secrets-in-drafts`, `local-approval-required` | Policy extension point; no MCP tool is currently registered |

Model-selected MCP calls are not deterministic. Security-critical operations
must therefore have no unguarded executor: the trusted policy chooses the gates,
the broker records the decision, and execution occurs only after all required
gates allow it.

The current online-write classification uses explicit rules and known tool-name
patterns. A request outside those patterns may not be recognized, so this is not
yet a complete capability-based enforcement system.
