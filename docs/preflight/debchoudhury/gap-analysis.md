# Agent Airlock gap analysis

Scope: `plugins/AirlockPlugin`, `sandbox`. Excluded: `demo/`, `poc/`, other `docs/preflight/` files.
Broken by: `7131b91` (`approvalGate()`), `e997e18` (`publish_approved_draft` policy with no tool).

## Fix now (plugin will not start)

1. `plugins/AirlockPlugin/gates/index.mjs` — change `approvalGate()` to `approvalGate`. It is a frozen object, not a factory. Current call throws `TypeError` at import; `server.mjs` never registers MCP tools.
2. `plugins/AirlockPlugin/policies/default.json` — remove `publish_approved_draft` / `local-approval-required` until a tool, executor, and tests exist. `createPolicyEvaluator` requires every bound gate to be registered. Tests that load this policy without `approvalGate` throw `Airlock policy references an unregistered gate`.
3. `plugins/AirlockPlugin/server.mjs` — log the real exception in the startup `catch`. Operators currently only see a generic "run npm ci and npm run setup" message.
4. Add a test that imports `gates/index.mjs` and runs `createPolicyEvaluator({ policy, gates })` against `policies/default.json`. Unit tests that build private gate lists will not catch registry breakage. MCP tests that spawn `server.mjs` will.
5. Add CI: `plugins/AirlockPlugin` → `npm ci && npm run setup && npm test`; `sandbox` → `node --test .\sandbox\tests\configure.test.mjs`. No `.github/workflows` today.

## Fix docs that disagree with the code

6. Root `README.md` documents the `approvalGate` TypeError. `plugins/AirlockPlugin/README.md` still describes a working demo. After (1)–(2), delete the "current source stops" failure path from the root README, or keep it only until HEAD is green.
7. Plugin README PRD links point at `docs/preflight/prd.md`. The PRD is `docs/prd.md`.
8. Plugin README setup path is `C:\\Git\\agent-airlock\\...`. Root README uses `$HOME\\Documents\\agent-airlock`. Pick one.
9. Do not claim `check_intent` starts a safe mission. It is a line-by-line regex denylist. A `cleared` result only writes `cleared-intents/<id>.json`; it does not wrap `git`/`gh`.
10. Do not claim `local-approval-required` is an approval flow. `gates/approval/index.mjs` ignores the action and always returns `ask-first`. Broker maps that to `blocked` / `approval-required` with zero execution. No reviewer, expiry, fingerprint bind, or single-use redemption.

## Fix next (controls)

11. `gates/no-online-writes/index.mjs` — evaluate the full prompt, not each line. Line-split misses `git` then `push` on two lines. Current patterns also miss paraphrases (`push this branch to GitHub`) and ZWSP/`git\u200bpush`. Keep `/yolo` as non-authorizing (already tested).
12. Do not bind `local-approval-required` to a live tool until broker implements PRD 2.4–2.5 (action fingerprint, expiry, one use, recheck before execute). A constant `ask-first` gate would block every call, including clean drafts.
13. Include `gitleaks.toml`, `rules.json`, `catalog.json`, and gate modules in the policy fingerprint, or bump `policies/default.json` `version` on every detector/code change. `policySha256` hashes policy JSON only.
14. `tools/select-model.mjs` — do not index `catalog.defaults[taskType][dataClass]` without a guard. Gate-allow plus static catalog currently fail closed as `execution-failed`; a future allow path can throw.
15. `gates/model-catalog/catalog.json` — drop unused `summarize` / `synthetic` on `stub-default`, or add matching `defaults` entries.
16. Sandbox profiles (`developer`, `restricted`) both set `allowBypass: true`. Keep if intentional; do not describe them as a mandatory boundary. Airlock cannot enable host `/sandbox`.

## Do not implement yet

Keep the kernel (broker, frozen snapshots, redacted receipts, strict schemas, checksum-pinned Gitleaks). Do not add PII, internal-only, destinations, mission contracts, run export/replay, budgets, or research-store until `npm test` is green on the real `gates` export.

PRD backlog after green:
- §1 mission contract, confirmation, dry run, helper narrowing
- §2 interactive approval + local stop
- §3 PII / labels / destinations on more than `publish_draft`
- §4 run ID, Markdown/JSON export, replay
- §5–7 scripts, budgets, standards checklist, research reuse

## Keep

- Strict tool schemas; extra fields (`yolo`, `approved`, `outputPath`) never reach the broker
- Precedence `block > error > ask-first > allow`; allow cannot cancel a block
- Receipt-before-execute (`wx`); executor uses the frozen snapshot
- Findings = rule ID + line, never matched values
- Scanner isolation: pinned 8.30.1, empty `.gitleaksignore`, `--ignore-gitleaks-allow`
- Skills: stop if the tool is missing; do not substitute shell/`git`/`gh`
- Sandbox configure: preview default, atomic write, blocked `__proto__` keys
