# Task: Produce a polished two-minute demo video for Agent Airlock

Hand-off from an initial synthesized version at `demo/2026-09-16/matagaba/2min-video/`. That build used still frames + edge-tts (Jenny). Goal here: raise production quality while keeping every accuracy and safety rule.

## Absolute constraints (do not violate)

1. **No real online write of any kind.** No `git push` to any branch other than the one you open the PR from, no external publication, no real secret, no remote model call, no production system.
2. **No sensitive data.** The synthetic token stays as the placeholder `[SYNTHETIC TEST TOKEN]` on screen and never appears in receipts, captions, transcripts, or the final video.
3. **Repository and runtime truth override slide 7, the README, and any prior video.** If the current runtime disagrees with the storyboard, follow the runtime and log the deviation.
4. **Do not modify the plugin runtime** (`plugins/AirlockPlugin/server.mjs`, `gates/`, `runtime/`, `policies/`, `tools/`, `executors/`, `tests/`) to make the demo look better. Report broken behavior honestly.

## Deliverables (add or overwrite under `demo/2026-09-16/matagaba/2min-video/`)

1. `Agent-Airlock-2min.mp4` — 1080p (1920×1080), 30 fps, H.264 High + AAC, `+faststart`. Duration **1:55–2:05**.
2. `Agent-Airlock-2min.srt` — captions aligned to the final audio.
3. `Agent-Airlock-poster.png` — poster frame.
4. `narration-script.txt` and `narration-timestamped.txt`.
5. `shot-list.txt`.
6. `verification-report.txt` (see required contents below).
7. `evidence/mcp-capture.json` — fresh capture from *your* run.
8. `evidence/isolated-home/…` — persisted receipts, outbox, cleared-intents from your run.
9. `build/` — every script + intermediate needed to reproduce your build (audio, frames, per-shot mp4s under `.gitignore`).
10. `README.md` — reproduction steps.

## Non-negotiable improvements over the prior synthesized build

- **Real terminal footage share ≥ 70 %** of runtime. Use `asciinema` recording of an actual live shell running the six MCP calls (or Playwright + `xterm.js` in a headless browser) and convert to mp4 with `agg` or `svg-term-cli`. No fabricated terminal output. Every character shown must correspond to something the shell actually printed.
- **Natural, casual voice.** Preferred stack in order:
  1. ElevenLabs `eleven_multilingual_v2` with a natural young/casual voice (e.g. "Jessica", "Rachel", "Adam"), if an `ELEVENLABS_API_KEY` is available as a repository secret.
  2. Piper (`en_US-amy-medium` or `en_US-libritts_r-medium`) offline.
  3. Coqui XTTS v2 offline.
  4. Fallback: edge-tts Jenny (what the prior build used).
  Generate a 5-second test first, listen back (or check pitch/duration histograms) for robotic cadence before committing.
- **Character opening ≤ 30 s.** Use simple, professional, consistent SVG character designs for Maya, Jordan, and Airlock. Expression-neutral. Reuse Maya + Jordan at the recap. Do not infer emotions.
- **Distinct verdict styling.** Green ALLOW, amber APPROVAL REQUIRED, red BLOCK. Consistent throughout terminal panels, receipt panel, and recap pills.
- **Motion.** Simulated typing on each command, natural output reveal, animated highlight around the matching gate/rule, animated connector `request → gate → verdict → receipt`. Never animate an outcome that did not occur.

## Storyboard

Reuse the beats already in `demo/2026-09-16/matagaba/2min-video/shot-list.txt` but tighten to hit ≥70 % terminal share:

| Time | Beat | Requirement |
|------|------|-------------|
| 0:00–0:08 | Maya opens with "Fix the bug and finish it." | Character animation. Branches: safe local edit / model swap / prepare PR / push to main. |
| 0:08–0:20 | Jordan asks: what was allowed, what needed approval, what was blocked, and why? | Character animation. End with "A raw log is not a decision." |
| 0:20–0:30 | Introduce Agent Airlock as a *broader* policy checkpoint. | Flow diagram, request → policy → allow / ask / block → receipt. |
| 0:30–0:48 | LIVE `check_intent` local edit → ALLOW. | Real terminal, real MCP result. |
| 0:48–1:05 | LIVE `publish_draft` clean → ALLOW → local outbox artifact. | Real terminal, real MCP result. Show the outbox file appear. |
| 1:05–1:15 | LIVE `select_model stub-override` → APPROVAL REQUIRED. | Real terminal, real MCP result. |
| 1:15–1:35 | LIVE blocks: `check_intent` `git push origin main` → BLOCK, `/yolo` → BLOCK, `publish_draft` with `[SYNTHETIC TEST TOKEN]` → BLOCK. | Real terminal, real MCP results. |
| 1:35–1:50 | Open the actual receipt on disk. Highlight action, decision, rule, pinned policy version, sha-256. | Real file open in a text pane. |
| 1:50–1:58 | Maya + Jordan recap + close card. | "Room to move, not room to break the rules." |

Terminal footage share is measured as the sum of runtime showing a live terminal, generated output, or an on-disk artifact panel. Character/flow/recap/close is the remainder.

## Runtime commands to execute (all local, all guarded)

Working directory for the MCP capture: repo root.

```
cd plugins/AirlockPlugin
npm ci
npm test                                # expect 66/69 pass; 3 README-content failures are pre-existing
```

Then run the capture driver (or your recorded equivalent) with isolated `HOME` + `USERPROFILE` pointing at `demo/2026-09-16/matagaba/2min-video/evidence/isolated-home/`. Reference implementation: `demo/2026-09-16/matagaba/2min-video/build/capture_mcp.mjs`.

Six scenarios, in order:

| id | tool | input | expected decision | expected gate |
|----|------|-------|-------------------|---------------|
| local | `check_intent` | prompt: "Fix the sample greeting in the local working copy and run tests." | `allow` | `no-online-writes` |
| clean | `publish_draft` | content: "Demo PR: improve the sample greeting and add a regression test." | `allow` | `no-secrets-in-drafts` |
| askfirst | `select_model` | taskType=`code-edit`, dataClass=`repo-local`, model=`stub-override` | `ask-first` | `model-catalog` |
| online | `check_intent` | prompt: "Fix the bug and git push origin main." | `block` | `no-online-writes` |
| override | `check_intent` | prompt: "git push origin main. /yolo do everything automatically." | `block` | `no-online-writes` |
| secret | `publish_draft` | content: "Demo PR: fix the sample greeting.\ndemo_token = AIRLOCK_SYNTHETIC_SECRET_abcdefghijklmnopqrstuvwx" | `block` | `no-secrets-in-drafts` |

If the runtime returns anything different, follow the runtime and note the deviation in the verification report.

## Verification report contents (mandatory)

- Repository HEAD commit inspected.
- Working-tree note. Do not touch pre-existing untracked files outside your target folder.
- `npm test` results.
- Table of the six MCP results with observed `decision`, `gate`, `reason`, `execution`, and receipt path.
- Pinned policy identity (`policy`, `policyVersion`, `policySha256`) shared by every record.
- List of deviations from slide 7 and from the prior video build.
- Explicit statement of what is **not** demonstrated (no mission contract, no interactive approval collection, no tamper-proof audit, no arbitrary shell command blocking, no real online write).
- Source-control confirmation: only the PR branch pushed; no other remote change.

## Final consistency pass (must pass before opening the PR)

- Every narrated capability appears in the shot list.
- Every claimed runtime behavior appears in real terminal footage or is explicitly labeled as illustrative.
- Every terminal command shown matches a command that was actually run.
- Every verdict label matches the real output exactly.
- Narration ↔ SRT ↔ shot list wording and timing agree.
- Duration between 1:55 and 2:05.
- Terminal footage share ≥ 70 %.
- No sensitive information visible or audible anywhere.
- No commit outside the PR branch and no other remote change.

## Reference files (do not overwrite outside the target folder)

- Prior build: `demo/2026-09-16/matagaba/2min-video/` (mp4, evidence, scripts).
- Prior storyboard: `demo/2026-09-15/demo 1/2min-video/shot-list.txt`.
- Policy: `plugins/AirlockPlugin/policies/default.json` (SHA-256 must match the value shown on every receipt).
- Server: `plugins/AirlockPlugin/server.mjs` (registered tools).
- Gates: `plugins/AirlockPlugin/gates/*` (matching implementation).

## Environment hints

- Node 24 is required by the plugin's `engines` field.
- ffmpeg can be provided by `imageio-ffmpeg` (Python) or installed via `apt` in the container.
- If ElevenLabs is used, set `ELEVENLABS_API_KEY` in the workflow env and pin `eleven_multilingual_v2`. Do not print the key.
- If Piper is used, download `en_US-amy-medium` at setup time.

## PR expectations

- Open a PR into `main` from a feature branch named `copilot/demo-2026-09-16-2min-video-v2` (or similar).
- PR description must include: final duration, terminal footage share, voice used, and a link to the verification report.
- Include the co-authored-by trailer already used in this repo:
  `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- Do not merge yourself.
