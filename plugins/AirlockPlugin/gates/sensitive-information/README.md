# Sensitive Information Protection

One capability protects plain text explicitly supplied to `publish_draft({ content })`,
including draft, log, header-like and display text. Three independent, read-only
gates are required by default policy **v6**:

| Gate | Detection | Decision on match |
|---|---|---|
| `no-secrets-in-drafts` | Pinned Gitleaks defaults, synthetic marker, contextual credential rules | `block` / `secret-detected` |
| `personal-data-review` | Bounded patterns below | `ask-first` / `personal-data-detected` |
| `internal-label-review` | Literal `INTERNAL-ONLY`, case-insensitive, with identifier boundaries | `ask-first` / `internal-label-detected` |

The same checks bind the future `publish_approved_draft` policy action, which
still has no MCP tool or executor. Other tool bindings are unchanged.
`block > error > ask-first > allow`. **Credentials never use approval to override
a detected match.** Approval is not implemented: PII/label reviews return
`blocked` / `approval-required`, and no executor or outbox write runs. A scanner
or detector failure also prevents execution, never clears the text.

## Exact first PII scope

| Rule ID | Supported shape | Important limits / false positives |
|---|---|---|
| `email-address` | ASCII local part and dotted domain with alphabetic 2–63-character final label | No quoted local parts, Unicode email, or local-only domains. Example addresses still flag; no mailbox verification. |
| `phone-number` | Separated NANP `202-555-0123`, `202.555.0123`, `202 555 0123`, `(202) 555-0123`, optionally `+1`/`001`; area/exchange start 2–9 | Bare ten-digit numbers intentionally excluded. No extension parsing or telephone-allocation verification. |
| `phone-number` | Explicit `+` or `00` prefix, country code starts 1–9, total 8–15 digits after prefix; optional spaces/dots/hyphens | Generic international candidate, not global precision. Parentheses supported only for NANP. ISO `YYYY-MM-DD` is excluded; arbitrary numeric identifiers can still resemble phones. |
| `payment-card` | 13–19 digits, optional single spaces/hyphens, valid Luhn checksum, not all one repeated digit | No issuer/account validation; unrelated Luhn-valid identifiers may flag. |
| `us-ssn` | `AAA-GG-SSSS`; area 001–899 except 666, group 01–99, serial 0001–9999 | Shape only, not issuance verification. Other government IDs and unseparated SSNs are excluded. |

Findings expose **only fixed rule IDs and positive LF-based line numbers**,
deduplicated per rule per line. Each gate has the existing 4096-finding limit.
Nothing returns matched values or spans. Detectors accept only valid UTF-8 plain
text up to 64 KiB, with the publishing tool's existing control-character limits.

## Safe remediation and record/display sanitization

The gate never mutates submitted text. A successful publication writes the exact
frozen text evaluated by every required gate, locally—not to GitHub.

For a flagged draft, `publish_draft` adds a safe `remediation` result:

- `removed`: the **entire supplied text field** is replaced by
  `[Sensitive information removed.]`. The distinct `candidate: { content }`
  is rescanned through all three sensitive-information gates before being returned.
  No original lines or multiline secret body are retained.
- `withheld`: no candidate. An `INTERNAL-ONLY` label classifies the entire
  field. Deleting its marker does not declassify the protected body.
- `error`: no candidate was cleared. The original action remains denied.
  If any original policy check errored, no remediation scan is attempted.

There is no automatic retry or execution of a candidate. Submitting any replacement
is a **new** `publish_draft` action with all policy checks, fingerprinting and
receipts again. Do not reuse the original clearance for edited text.

The host-side `createRecordTextSanitizer()` in
[`runtime/sanitize-record-text.mjs`](../../runtime/sanitize-record-text.mjs)
is reusable for **one explicitly supplied free-text field** in an Airlock-owned
record or display. It also rescans unchanged candidates, returns safe static
errors, and writes nothing. The publisher's remediation response is its current
integration point. Supply the whole classified record as one field when a label
applies to the record; this helper cannot infer classification across separate
calls. Never use field-by-field sanitization to split a label from its body.

Existing broker receipts use the stronger metadata-only projection: policy,
gate decisions, safe findings, action SHA-256 and byte count, never raw action,
exception text or executor output. They do not need Gitleaks rescans. Other gates
and trusted metadata surfaces do not acquire a scanner dependency.

## Synthetic examples

```text
Demo PR: correct the critical-ticket resolution target. -> published
Authorization: Bearer logfixture_A7b9C2d4E6f8G0h2     -> secret-detected
Contact: airlock.fixture@example.test                -> approval-required
INTERNAL-ONLY: synthetic protected notes             -> approval-required
```

The example credentials/person data are nonfunctional fixtures. Never use real
records for demonstrations. See [the demo skill](../../skills/airlock-demo/SKILL.md)
and [secrets coverage](../secrets/README.md).

## Boundary

This is not comprehensive DLP. No names, street addresses, comprehensive global
government IDs, image/attachment/OCR/encoded-payload decoding, repository-wide
scan or inferred confidentiality. Label spelling must match the explicit literal;
unlabelled proprietary text may pass. Gitleaks defaults retain their upstream
heuristics and allowlists. A clean result means only that configured detectors
did not match.

**No new hooks or interception.** Arbitrary console output, logs not supplied in
`content`, shell/native writes, other MCP tools, model traffic and external
processes are outside this capability. Previously printed/logged data cannot be
retracted. The installed plugin and local operator remain trusted.
