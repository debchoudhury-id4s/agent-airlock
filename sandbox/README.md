# Copilot CLI sandbox configuration kit

This directory contains recommended sandbox settings for Agent Airlock and a
small setup tool that can apply them without replacing unrelated Copilot
settings.

The Copilot CLI sandbox limits what commands and local processes can access. It
can restrict files, networking, credentials, and local MCP or language-server
processes. Airlock provides a different layer: it evaluates the meaning,
content, destination, and approval requirements of actions routed through its
tools.

The files in this directory are templates. Copilot CLI does **not** load a
root-level `sandbox` directory automatically. The setup tool writes the composed
configuration to a settings file that Copilot recognizes.

## Configuration layout

```text
sandbox\
  README.md
  configurations\
    base.json
    overrides\
      developer.json
      restricted.json
  scripts\
    configure.mjs
  tests\
    configure.test.mjs
```

`base.json` contains settings shared by every supplied configuration. Files
under `configurations\overrides` change selected values for a scenario.
Overrides are applied in command-line order. Objects are merged recursively;
arrays and scalar values from a later override replace earlier values.

Both supplied configurations retain `"allowBypass": true`. A developer can
therefore bypass sandbox containment when it prevents legitimate work. Sandbox
bypass is not Airlock approval, and an action only receives Airlock checks when
it is routed through an Airlock tool.

## Preview and apply a configuration

Node.js 24 is already required by the Airlock plugin. From the root of the
repository that should receive the settings, preview the developer
configuration:

```powershell
node C:\path\to\agent-airlock\sandbox\scripts\configure.mjs `
  --scope repo `
  --override developer
```

Preview is the default. To write the settings after reviewing the output:

```powershell
node C:\path\to\agent-airlock\sandbox\scripts\configure.mjs `
  --scope repo `
  --override developer `
  --apply
```

The tool asks for confirmation, preserves unrelated existing settings, validates
all JSON inputs, and replaces the destination atomically. Use `--yes` with
`--apply` only in reviewed automation where an interactive prompt is not
possible.

Available scopes are:

| Scope | Destination |
|---|---|
| `repo` | `<current repository>\.github\copilot\settings.json` |
| `local` | `<current repository>\.github\copilot\settings.local.json` |
| `user` | `%COPILOT_HOME%\settings.json`, or `%USERPROFILE%\.copilot\settings.json` |

Repository and local scopes are resolved from the current working directory.
Run the command from the target repository root. Restart Copilot CLI after
applying settings so a new session loads them.

Use `--override restricted` instead of `developer` to disable outbound network
access, development-tool access, and Git/GitHub credential injection. Additional
reviewed override files can be added under `configurations\overrides`.

Filesystem policies can also be placed in an override. They require absolute
paths, so keep machine-specific values in a local override that is not shared
unchanged across users:

```json
{
  "sandbox": {
    "userPolicy": {
      "filesystem": {
        "readonlyPaths": [
          "C:\\work\\shared-documentation"
        ],
        "deniedPaths": [
          "C:\\Users\\USERNAME\\.ssh",
          "C:\\Users\\USERNAME\\.azure"
        ]
      }
    }
  }
}
```

Replace every placeholder before applying the override. A shared configuration
should not assume that all developers use the same home or workspace path.

To run the setup-tool tests:

```powershell
node --test .\sandbox\tests\configure.test.mjs
```

## Where sandbox settings belong

The setup tool only modifies user-controlled Copilot settings. Enterprise
administrators distribute mandatory settings separately through:

```text
.github-private\copilot\managed-settings.json
```

Enterprise-managed restrictions may prevent user or repository settings from
relaxing a policy. This tool does not modify managed settings.

Airlock cannot enable or disable the host sandbox through `plugin.json` or issue
`/sandbox enable` for a user. Keeping sandbox configuration outside the plugin
prevents a plugin from silently changing the boundary in which it runs.

## What is not a sandbox policy

Sandbox policy supports filesystem, network, authentication, MCP/LSP
containment, development-tool access, and bypass controls.

You cannot add rules like these to sandbox policy:

- Block pull-request descriptions containing secrets.
- Ask before publishing customer information.
- Publish only to an approved repository.
- Verify that an action matches an agreed mission.
- Bind approval to one exact action.
- Record an Airlock decision receipt.

These semantic rules remain Airlock gates and policies under
`plugins\AirlockPlugin`. Generic command rules, such as asking before
`git push`, belong in Copilot permission policy rather than sandbox policy.
