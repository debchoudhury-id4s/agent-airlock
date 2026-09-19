# Agent Airlock — Two-minute demo (2026-09-16)

## Files

| File | Purpose |
|------|---------|
| `Agent-Airlock-2min.mp4` | Final 1080p/30 fps H.264 video, 1:57.81, burned captions, AAC audio |
| `Agent-Airlock-2min.srt` | Same captions as a separate SRT file |
| `Agent-Airlock-poster.png` | Poster frame (matches the close card) |
| `narration-script.txt` | Spoken narration by shot |
| `narration-timestamped.txt` | Same narration with per-shot timestamps |
| `shot-list.txt` | Full shot list (visible content, product action, animation, narration) |
| `verification-report.txt` | Repository baseline, tests run, gates observed, deviations from slide 7, source-control confirmation |
| `evidence/mcp-capture.json` | Real MCP tool results captured from the unmodified plugin server |
| `evidence/isolated-home/…` | Persisted receipts, outbox, cleared intents from the capture |
| `build/` | Reproduction scripts + intermediate assets (TTS mp3, PNG frames, per-shot mp4s) |

## Voice

en-US-JennyNeural via `edge-tts` at +0 % rate. Young, casual, conversational Microsoft neural voice — chosen to avoid a robotic TTS feel.

## To reproduce

```powershell
cd plugins\AirlockPlugin
npm test                                           # verifies runtime (66/69 pass; 3 README-content assertions are the only failures)

cd ..\..\demo\2026-09-16\matagaba\2min-video\build
node capture_mcp.mjs                               # writes ..\evidence\mcp-capture.json + isolated receipts
python make_video.py                               # regenerates audio, frames, and Agent-Airlock-2min.mp4
```

Requires: Node 24 (bundled with the plugin), Python 3.12 with `edge-tts`, `imageio-ffmpeg`, and `pillow` installed via `pip`.

## Scope reminder

Local proof of concept. Guarded MCP tools only. Not tamper-proof. Not a compliance audit. No git push, no real online write, no modification of remote state was performed to produce this deliverable.
