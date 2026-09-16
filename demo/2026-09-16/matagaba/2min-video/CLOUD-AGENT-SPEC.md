# Task: produce a two-minute demo video for Agent Airlock

## The only hard requirements

1. **Duration: 2 minutes** (accept 1:55 – 2:05).
2. **Explains what Agent Airlock is** — a policy checkpoint that sits between an agent's request and its supported actions, and can allow, require approval, or block, leaving a receipt.
3. **Delivered as an MP4** at `demo/2026-09-16/matagaba/2min-video/Agent-Airlock-2min.mp4`, 1080p, H.264 + AAC, playable in a browser.
4. **All work stays inside `demo/2026-09-16/matagaba/2min-video/`.** A GitHub Actions `scope-check` will fail the PR if anything else is touched. Do not modify `plugins/AirlockPlugin/**`, `docs/**`, `sandbox/**`, or any other prior demo.
5. **No real online writes, no secrets, no PII.** If a synthetic secret is shown, keep it as `[SYNTHETIC TEST TOKEN]`.

Everything else is your call — story, visuals, voice, tone. Make it good.

## Reference material you may use

- Prior synthesized build in the same folder: MP4, SRT, narration script, shot list, verification report, and reproduction scripts (`build/capture_mcp.mjs`, `build/make_video.py`). Reuse, replace, or ignore as you see fit.
- Real MCP tool results at `demo/2026-09-16/matagaba/2min-video/evidence/mcp-capture.json` (already captured against the unmodified plugin). You may re-capture by running `node build/capture_mcp.mjs` from the target folder.
- Repo README at `README.md` and the plugin server at `plugins/AirlockPlugin/server.mjs` for context on what the product actually does.

## Environment (already preinstalled by `.github/workflows/copilot-setup-steps.yml`)

- Node 24 with `plugins/AirlockPlugin` deps installed.
- Python 3.12 with `edge-tts`, `imageio-ffmpeg`, `pillow`, `numpy`.
- `ffmpeg`, `asciinema`, `agg`, `piper` + the `en_US-amy-medium` voice.

If you want a nicer voice than Piper, an `ELEVENLABS_API_KEY` may be available in the `copilot` GitHub Actions environment — use it only if set, and never print it.

## Deliverables

- `Agent-Airlock-2min.mp4` — the video.
- Anything else you produce (transcript, captions, poster, scripts) goes in the same folder. No file outside `demo/2026-09-16/matagaba/2min-video/`.

## PR

Open a PR against `main` from a `copilot/…` branch. Include:

- Final duration.
- The voice / tools you used.
- The commit trailer `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

Don't merge yourself.
