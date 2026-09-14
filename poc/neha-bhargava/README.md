# Airlock plugin moved

The shared plugin now lives in [`plugins/AirlockPlugin`](../../plugins/AirlockPlugin).
This folder is reserved for personal experiments; it no longer contains a runnable plugin.

Restart existing sessions using the new location:

```powershell
copilot --plugin-dir "C:\Git\agent-airlock\plugins\AirlockPlugin"
```

See the [plugin guide](../../plugins/AirlockPlugin/README.md) for setup and gate
contributions. The plugin ID remains `airlock-outbound`.
If you installed the old path persistently through Agency, reinstall from the
new path using the guide.
