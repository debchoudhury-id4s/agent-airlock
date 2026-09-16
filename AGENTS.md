# AGENTS.md

Instructions for any autonomous coding agent (GitHub Copilot cloud agent, third-party agents) working in this repository.

## Scope of work

**Only modify files inside `demo/2026-09-16/matagaba/2min-video/`** unless the issue explicitly asks you to touch something else. Every other path is off-limits — including but not limited to:

- `plugins/AirlockPlugin/**` (the plugin runtime, gates, executors, tools, policies, tests)
- `docs/**`, `README.md`, `poc/**`, `sandbox/**`, `demo/2026-09-15/**`
- `.github/**` (workflows, CODEOWNERS, this file)

A `scope-check` GitHub Actions workflow enforces this on every PR from a `copilot/*` branch. The check will fail and block merge if any file outside the allowed folder is modified.

If a task genuinely requires a change outside `demo/2026-09-16/matagaba/2min-video/`, stop and post a comment on the issue explaining what you need and why. Do not push the change.

## Never do these

- Do not `git push` to `main` or any branch you did not create.
- Do not force-push or rewrite history on shared branches.
- Do not create tags, releases, or deployments.
- Do not modify the plugin runtime to make a demo look better. Report broken behavior honestly instead.
- Do not print, log, or commit any real secret, credential, API key, or personal data. Synthetic tokens must stay as `[SYNTHETIC TEST TOKEN]` in every visible artifact (video, captions, transcripts, receipts).
- Do not perform any real online write on behalf of Agent Airlock (no real `git push origin main`, no external publication, no remote model call, no production system touched by the demo).

## Runtime truth

The current plugin runtime is the source of truth. Slide 7 from `Agent Airlock.pptx`, the `README.md`, and any prior demo video are storyboard references only. If they conflict with the runtime, follow the runtime and log the deviation in the verification report.

## Verification

Every task must be verified against the current repository and the active runtime before shipping. Include the commands you ran, their exit statuses, and the observed results in a `verification-report.txt` under your target folder.

## Commit trailer

Commits made by an agent must include:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Task-specific specs

For the current active task, see `demo/2026-09-16/matagaba/2min-video/CLOUD-AGENT-SPEC.md`.
