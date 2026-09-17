# Airlock prompt lifecycle

## Automatic path

Every submitted prompt follows this path:

```text
prompt
  -> userPromptSubmitted
  -> trending-cost gate
  -> no-online-writes gate
  -> most restrictive redacted mission decision
  -> model
  -> preToolUse before each proposed tool
  -> allow, ask, or deny
  -> sessionEnd removes mission state
```

The prompt hook preserves trending-cost progress output. In advisory mode, cost
does not restrict an otherwise allowed mission. In enforce mode, an over-limit
or configured fail-closed unavailable result creates a blocked mission and emits
the host block decision.

`preToolUse` is the tool-execution boundary. A missing, invalid, pending, or
blocked mission cannot use tools. Allowed local tools fall through to Copilot's
normal permissions. Shell commands are checked again, and known mutating online
tools are denied before execution.

Mission state contains only the session identifier, decision, reason, timestamp,
and optional policy identity. It never contains the prompt or tool arguments.

## Boundaries

- `/yolo` and host auto-approval cannot override an Airlock denial.
- Hook timeouts are controlled by the host; policy-critical operations must not
  expose an unguarded executor as an alternative to an Airlock-brokered tool.
- Shell and online-tool classification uses reviewed patterns. It is not a
  complete capability sandbox.
- Prompt hooks cannot prevent text generation. Tool execution is enforced by
  `preToolUse`.
