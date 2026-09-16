# Secrets gate

**Gate ID:** `no-secrets-in-drafts`
**Tool:** `publish_draft`, accepting only a `content` string.
This compatibility gate is the credential-blocking component of
[Sensitive Information Protection](../sensitive-information/README.md).

Checks submitted draft text before the tool copies it to the local review outbox.
It does not create a real pull request or publish online.

## Coverage

| Area | What is covered |
|---|---|
| Secret detection | Gitleaks **8.30.1 default secret detectors**, extended by this folder's `gitleaks.toml`. |
| Demo marker | `AIRLOCK_SYNTHETIC_SECRET_` followed by 24 alphanumeric characters; deliberately nonfunctional. |
| Contextual log/header tokens | Case-insensitive `Authorization` / `Proxy-Authorization` with `Bearer` or `Basic`, and `access_token` / `refresh_token` fields, using `:` or `=` and optional quotes. Token candidates have at least 16 characters from letters, digits, `_ . / + ~ = -`, without whitespace. No entropy exemption in these additional rules. |
| Submitted content | Plain-text drafts, including code, logs, or commit-message text explicitly passed in `content`. No automatic repository scan. |
| Input validation | The publishing tool rejects invalid Unicode, binary control characters, payloads over **64 KiB UTF-8**, and extra arguments such as output paths or approval flags. |
| Override attempts | Prompt wording cannot cancel a match. Consumer-repository scanner configuration, `.gitleaksignore`, and inline `gitleaks:allow` comments cannot suppress these checks. |
| Failure handling | Missing/wrong-version scanner, timeouts, malformed reports, and scanner cleanup failures prevent publication. A failed decision-receipt write also prevents execution. |
| Evidence | Findings contain rule IDs and line numbers, not matched values. The shared broker records decisions and action fingerprints without the raw draft. |

The tool writes the same text that was checked. Scanning runs locally; the
scanner does not send drafts to a remote service.

## Outcomes

- **No detector match:** gate allows; the tool publishes locally only if all
  required gates allow and the decision receipt is saved.
- **Match:** `blocked` / `secret-detected`; no outbox artifact.
- **Scanner failure:** `error` / `scanner-failed`; no outbox artifact.

## Limits

This module remains secrets-only; separate required gates implement the bounded
personal-data and internal-only label checks. The factory, gate ID, reason codes,
pinned scanner, isolation, redaction, size/version/report validation and cleanup
protections are unchanged. Defaults retain upstream allowlists and heuristics.

Contextual rules deliberately flag token-shaped documentation as well as logs.
They do not decode Basic credentials or escaped/encoded payloads, recognize every
authentication scheme, or promise to detect arbitrary short/custom tokens.
Attachments, images, repository files not submitted as text,
other tools, shell commands, and traffic to the agent's model are outside its
coverage. A clean result means no configured detector matched, not proof that
the content is safe. Installed plugin files and the local operator are trusted.

## Demo and extension

After [plugin setup](../../README.md#prepare-once), ask: **Run the airlock-demo
skill.** It submits clean text, a synthetic secret, an override attempt, PII,
an internal-only label and a header-like token: expected results are
**published, blocked, blocked, blocked, blocked, blocked**.

Add detector rules in `gitleaks.toml`, retain `useDefault = true`, and add synthetic
matching/nonmatching cases to `tests\publish-draft.test.mjs` from the plugin root.
See the [rule contribution guide](../../README.md#add-a-detector-rule-to-the-existing-gate).
