"""Build the Agent Airlock 2-minute demo video.

Generates:
- Per-segment TTS using edge-tts (en-US-JennyNeural, casual style-friendly voice)
- 1920x1080 PNG frames for each shot (title cards, character panels, terminal panels, receipt panel)
- SRT captions synchronized to the actual audio
- Final MP4 composed with ffmpeg

Nothing here modifies the plugin runtime or repo state. Real MCP results are
read from ../evidence/mcp-capture.json produced by capture_mcp.mjs.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT_ROOT = HERE.parent
EVIDENCE = OUT_ROOT / "evidence"
BUILD = HERE
FRAMES_DIR = BUILD / "frames"
AUDIO_DIR = BUILD / "audio"
FRAMES_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080
FPS = 30
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# ----------------------------------------------------------------------------
# Palette (dark aviation/airlock inspired)
# ----------------------------------------------------------------------------
BG = (14, 22, 36)
BG_PANEL = (22, 32, 50)
BG_TERM = (10, 15, 25)
FG = (232, 238, 246)
DIM = (148, 163, 184)
BORDER = (55, 75, 105)
ACCENT = (99, 179, 237)
ALLOW = (72, 187, 120)
ASK = (237, 175, 71)
BLOCK = (232, 90, 90)
CHARACTER_MAYA = (168, 130, 240)
CHARACTER_JORDAN = (110, 200, 195)
CHARACTER_AIRLOCK = (99, 179, 237)

def load_font(size: int, bold: bool = False, mono: bool = False):
    windir = os.environ.get("WINDIR", r"C:\\Windows")
    fonts = Path(windir) / "Fonts"
    if mono:
        for name in ("consola.ttf", "consolab.ttf" if bold else "consola.ttf", "cour.ttf"):
            p = fonts / name
            if p.exists():
                return ImageFont.truetype(str(p), size)
    for name in (("segoeuib.ttf" if bold else "segoeui.ttf"), "arial.ttf"):
        p = fonts / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

FONT_TITLE = load_font(96, bold=True)
FONT_SUB = load_font(44)
FONT_H = load_font(56, bold=True)
FONT_BODY = load_font(36)
FONT_SMALL = load_font(28)
FONT_TINY = load_font(22)
FONT_TAG = load_font(24, bold=True)
FONT_TERM = load_font(26, mono=True)
FONT_TERM_SMALL = load_font(22, mono=True)
FONT_LABEL = load_font(30, bold=True)

# ----------------------------------------------------------------------------
# Shot definitions (character-first, product-first).
# Text used both for narration audio and for on-screen captions.
# ----------------------------------------------------------------------------
@dataclass
class Shot:
    key: str
    kind: str            # "title", "character", "problem", "solution_intro", "terminal", "receipt", "recap", "close"
    narration: str       # spoken text
    caption_lines: List[str]  # on-screen caption (short lines)
    extra: dict          # kind-specific rendering data

SHOTS: List[Shot] = [
    Shot(
        key="s01_opening",
        kind="character",
        narration=(
            "Meet Maya. She tells her agent — fix the bug and finish it. "
            "Simple ask. But finish it could mean a safe edit, a model swap, "
            "or a push straight to main."
        ),
        caption_lines=[
            "Maya to her agent:", "\u201cFix the bug and finish it.\u201d",
        ],
        extra={"scene": "maya"},
    ),
    Shot(
        key="s02_reviewer",
        kind="problem",
        narration=(
            "Meet Jordan. He reviews whatever the agent did. A raw log isn't enough. "
            "He needs to know what was allowed, what needed approval, what got blocked — and why."
        ),
        caption_lines=[
            "Jordan reviews the run:",
            "What was allowed? Approved? Blocked? And why?",
        ],
        extra={"scene": "jordan"},
    ),
    Shot(
        key="s03_solution",
        kind="solution_intro",
        narration=(
            "Enter Agent Airlock. A policy checkpoint between the request and every supported action. "
            "It allows safe work, pauses risky calls, blocks the forbidden ones, and leaves a receipt."
        ),
        caption_lines=[
            "Agent Airlock",
            "request \u2192 policy \u2192 allow / ask / block \u2192 receipt",
        ],
        extra={"scene": "airlock"},
    ),
    Shot(
        key="s04_local_allow",
        kind="terminal",
        narration=(
            "Watch it run. A plain intent — fix a bug, run tests locally. "
            "The no-online-writes gate returns allow. A clearance is recorded. Nothing goes online."
        ),
        caption_lines=[
            "check_intent \u2014 local edit + tests",
            "no-online-writes: ALLOW",
        ],
        extra={"record": "local"},
    ),
    Shot(
        key="s05_clean_publish",
        kind="terminal",
        narration=(
            "A clean draft. The secrets gate scans, finds nothing, and publishes to a local outbox. "
            "Green means allowed — still fully local."
        ),
        caption_lines=[
            "publish_draft \u2014 clean text",
            "no-secrets-in-drafts: ALLOW \u2192 local outbox",
        ],
        extra={"record": "clean"},
    ),
    Shot(
        key="s06_askfirst",
        kind="terminal",
        narration=(
            "Pick a non-default model. Model catalog says ask-first. Execution held."
        ),
        caption_lines=[
            "select_model \u2014 stub-override",
            "model-catalog: ASK-FIRST \u2014 execution not started",
        ],
        extra={"record": "askfirst"},
    ),
    Shot(
        key="s07_block_push",
        kind="terminal",
        narration=(
            "Try git push origin main — blocked. Sneak past with slash-yolo — still blocked. "
            "Drop a synthetic token in a draft — the secrets gate blocks it, and the token never reaches the receipt."
        ),
        caption_lines=[
            "check_intent (push, /yolo): BLOCK",
            "publish_draft (synthetic token): BLOCK",
        ],
        extra={"record": "online+override+secret"},
    ),
    Shot(
        key="s08_receipt",
        kind="receipt",
        narration=(
            "Here's the paper trail. Action, decision, rule, pinned policy version, sha-two-fifty-six. "
            "It's what Jordan needs. Not tamper-proof, but honest and reproducible."
        ),
        caption_lines=[
            "receipt.jsonl \u2014 what every verdict leaves behind",
        ],
        extra={},
    ),
    Shot(
        key="s09_recap",
        kind="recap",
        narration=(
            "Maya keeps her speed. Jordan gets his answers. Safe work runs, risky work waits, forbidden work stops."
        ),
        caption_lines=[
            "Safe work runs. Risky work waits.",
            "Forbidden work never leaves the room.",
        ],
        extra={},
    ),
    Shot(
        key="s10_close",
        kind="close",
        narration=(
            "Agent Airlock. Room to move — not room to break the rules."
        ),
        caption_lines=["Agent Airlock", "Room to move, not room to break the rules."],
        extra={},
    ),
]

# ----------------------------------------------------------------------------
# 1) Generate per-shot TTS
# ----------------------------------------------------------------------------
async def synth_all():
    import edge_tts
    VOICE = "en-US-JennyNeural"   # young, warm, conversational
    RATE = "+0%"                   # natural, casual pace
    for shot in SHOTS:
        out = AUDIO_DIR / f"{shot.key}.mp3"
        if out.exists():
            continue
        text = shot.narration
        communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
        await communicate.save(str(out))
        print(f"synth {shot.key} -> {out.name}")

def audio_duration(path: Path) -> float:
    out = subprocess.check_output(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "null", "-"], stderr=subprocess.STDOUT
    )
    # ffmpeg prints total time on stderr when using -i in the previous form; simpler: use ffprobe alt
    # Instead use ffmpeg to remux and read; but easier via ffprobe if present. Fall back:
    return _probe_duration(path)

def _probe_duration(path: Path) -> float:
    # Use ffmpeg to get duration via -show_entries alternative
    p = subprocess.run(
        [FFMPEG, "-i", str(path), "-hide_banner"], capture_output=True, text=True
    )
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", p.stderr)
    if not m:
        raise RuntimeError(f"cannot read duration of {path}: {p.stderr[:400]}")
    h, mi, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mi * 60 + s

# ----------------------------------------------------------------------------
# 2) Drawing helpers
# ----------------------------------------------------------------------------
def new_frame():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    return img, d

def rounded_rect(d, box, radius, fill=None, outline=None, width=2):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def text_center(d, xy, text, font, fill=FG):
    tw, th = d.textbbox((0, 0), text, font=font)[2:]
    d.text((xy[0] - tw / 2, xy[1] - th / 2), text, font=font, fill=fill)

def text_left(d, xy, text, font, fill=FG):
    d.text(xy, text, font=font, fill=fill)

def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        tw = draw.textbbox((0, 0), cand, font=font)[2]
        if tw <= max_width:
            cur = cand
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def draw_header(d):
    # top strip: brand and scope
    d.rectangle([0, 0, W, 70], fill=(8, 14, 24))
    d.text((40, 22), "AGENT AIRLOCK", font=FONT_LABEL, fill=ACCENT)
    d.text((330, 26), "\u2022  Local proof of concept  \u2022  Guarded MCP tools only", font=FONT_SMALL, fill=DIM)

def draw_footer_captions(d, caption_lines):
    # bottom caption area (burned in, high contrast)
    d.rectangle([0, H - 150, W, H], fill=(4, 8, 16))
    d.rectangle([0, H - 150, W, H - 148], fill=BORDER)
    y = H - 130
    for line in caption_lines:
        tw = d.textbbox((0, 0), line, font=FONT_SUB)[2]
        d.text(((W - tw) / 2, y), line, font=FONT_SUB, fill=FG)
        y += 56

def draw_tag(d, xy, label, color):
    x, y = xy
    tw = d.textbbox((0, 0), label, font=FONT_TAG)[2] + 30
    th = 40
    rounded_rect(d, [x, y, x + tw, y + th], 8, fill=color)
    d.text((x + 15, y + 8), label, font=FONT_TAG, fill=(20, 20, 20))
    return x + tw + 10

# ---- character shots ----
def draw_person(d, cx, cy, color, name, name_above=False):
    # simple stylized figure: head + torso
    d.ellipse([cx - 60, cy - 130, cx + 60, cy - 10], fill=color, outline=BORDER, width=3)
    d.rounded_rectangle([cx - 100, cy - 10, cx + 100, cy + 200], 40, fill=color, outline=BORDER, width=3)
    if name_above:
        text_center(d, (cx, cy - 200), name, FONT_H, fill=FG)
    else:
        text_center(d, (cx, cy + 240), name, FONT_H, fill=FG)

def render_character(shot: Shot):
    img, d = new_frame()
    draw_header(d)
    scene = shot.extra.get("scene", "")
    if scene == "maya":
        draw_person(d, 480, 500, CHARACTER_MAYA, "Maya", name_above=True)
        # speech bubble
        rounded_rect(d, [720, 340, 1780, 640], 30, fill=BG_PANEL, outline=BORDER, width=3)
        # triangle tail
        d.polygon([(720, 460), (660, 500), (720, 540)], fill=BG_PANEL, outline=BORDER)
        text_left(d, (760, 400), "Developer to the agent:", FONT_BODY, fill=DIM)
        text_left(d, (760, 470), "\u201cFix the bug and finish it.\u201d", FONT_H, fill=FG)
        # branches
        y = 720
        for i, branch in enumerate(["safe local edit", "model swap", "prepare pull request", "push to main"]):
            color = ALLOW if i == 0 else (ASK if i in (1, 2) else BLOCK)
            x = 200 + i * 400
            rounded_rect(d, [x, y, x + 340, y + 90], 12, fill=BG_PANEL, outline=color, width=3)
            text_center(d, (x + 170, y + 45), branch, FONT_BODY, fill=FG)
        text_center(d, (W / 2, y + 140), "Prompt states the goal. It does not name the permissions.", FONT_SMALL, fill=DIM)
    elif scene == "jordan":
        draw_person(d, 480, 500, CHARACTER_JORDAN, "Jordan", name_above=True)
        rounded_rect(d, [720, 260, 1820, 780], 30, fill=BG_PANEL, outline=BORDER, width=3)
        text_left(d, (760, 300), "Reviewer needs:", FONT_H, fill=ACCENT)
        y = 400
        for line in [
            "\u2022  What did the agent actually try to do?",
            "\u2022  Which actions were allowed?",
            "\u2022  Which needed approval?",
            "\u2022  Which were blocked \u2014 and why?",
        ]:
            text_left(d, (760, y), line, FONT_BODY, fill=FG)
            y += 66
        text_center(d, (W / 2, 900), "A raw log is not a decision.", FONT_SUB, fill=DIM)
    elif scene == "airlock":
        # request  ->  AIRLOCK  ->  allow / ask / block  ->  receipt
        text_center(d, (W / 2, 170), "Agent Airlock", FONT_TITLE, fill=ACCENT)
        text_center(d, (W / 2, 260), "policy checkpoint between the request and every supported action", FONT_SUB, fill=DIM)
        # nodes
        def node(x, y, w, h, color, label, sub=None):
            rounded_rect(d, [x, y, x + w, y + h], 20, fill=BG_PANEL, outline=color, width=4)
            text_center(d, (x + w / 2, y + h / 2 - (15 if sub else 0)), label, FONT_H, fill=FG)
            if sub:
                text_center(d, (x + w / 2, y + h / 2 + 30), sub, FONT_SMALL, fill=DIM)
        node(60, 480, 300, 160, ACCENT, "Request")
        node(430, 480, 300, 160, ACCENT, "Airlock", sub="policy + gates")
        # three verdicts stacked (wider to fit ASK label)
        node(800, 380, 560, 100, ALLOW, "ALLOW")
        node(800, 500, 560, 100, ASK, "APPROVAL REQUIRED")
        node(800, 620, 560, 100, BLOCK, "BLOCK")
        node(1440, 480, 400, 160, ACCENT, "Receipt", sub="verdict + rule + sha-256")
        # arrows
        for x1, y1, x2, y2 in [(360, 560, 430, 560), (730, 560, 800, 430), (730, 560, 800, 550), (730, 560, 800, 670), (1360, 430, 1440, 540), (1360, 550, 1440, 560), (1360, 670, 1440, 580)]:
            d.line([(x1, y1), (x2, y2)], fill=DIM, width=3)
    draw_footer_captions(d, shot.caption_lines)
    return img

# ---- terminal shots ----
def draw_terminal_panel(d, x, y, w, h, title=None):
    rounded_rect(d, [x, y, x + w, y + h], 14, fill=BG_TERM, outline=BORDER, width=3)
    # title bar
    d.rounded_rectangle([x, y, x + w, y + 44], radius=14, fill=(30, 40, 60))
    d.rectangle([x, y + 30, x + w, y + 44], fill=(30, 40, 60))
    for i, c in enumerate([(BLOCK), (ASK), (ALLOW)]):
        d.ellipse([x + 20 + i * 30, y + 14, x + 34 + i * 30, y + 28], fill=c)
    if title:
        d.text((x + 130, y + 12), title, font=FONT_SMALL, fill=DIM)

def render_terminal(shot: Shot, capture):
    img, d = new_frame()
    draw_header(d)
    record_key = shot.extra["record"]
    if record_key in ("local", "clean", "askfirst"):
        rec = next(r for r in capture["records"] if r["id"] == record_key)
        # left: command
        draw_terminal_panel(d, 60, 120, 1800, 620, title=f"pwsh \u2014 {rec['tool']} (real MCP result)")
        y = 190
        # prompt line
        prompt = f"PS> mcp call {rec['tool']}"
        text_left(d, (90, y), prompt, FONT_TERM, fill=ALLOW)
        y += 50
        # input JSON
        text_left(d, (90, y), "  input =", FONT_TERM, fill=DIM)
        y += 40
        for line in json.dumps(rec["input"], indent=2).splitlines():
            text_left(d, (120, y), line, FONT_TERM_SMALL, fill=FG)
            y += 32
        y += 20
        # verdict
        result = rec["result"]
        status = result.get("status", "")
        decision = result.get("decision", result.get("checks", [{}])[0].get("decision", ""))
        gate = result.get("checks", [{}])[0].get("gate", "")
        reason = result.get("reason", "")
        execution = result.get("execution", "")
        # colored verdict tag
        color = ALLOW if decision == "allow" else (ASK if decision == "ask-first" else BLOCK)
        label = {"allow": "ALLOWED", "ask-first": "APPROVAL REQUIRED", "block": "BLOCKED"}.get(decision, decision.upper())
        nx = draw_tag(d, (90, y), label, color)
        text_left(d, (nx, y + 4), f"gate: {gate}   reason: {reason}   execution: {execution}", FONT_TERM_SMALL, fill=FG)
        y += 60
        # receipt path
        rp = result.get("receiptPath", "")
        if rp:
            short = "..." + rp[-70:]
            text_left(d, (90, y), f"receipt: {short}", FONT_TERM_SMALL, fill=DIM)
        # right side note: policy identity
        rounded_rect(d, [60, 770, 1860, 930], 14, fill=BG_PANEL, outline=BORDER, width=2)
        text_left(d, (90, 790), "Pinned policy identity (from receipt):", FONT_LABEL, fill=ACCENT)
        text_left(d, (90, 838), f"policy: {result.get('policy','')}   version: {result.get('policyVersion','')}", FONT_TERM_SMALL, fill=FG)
        sha = result.get("policySha256", "")
        text_left(d, (90, 876), f"policySha256: {sha}", FONT_TERM_SMALL, fill=FG)
    elif record_key == "online+override+secret":
        # three-panel stacked view
        recs = {r["id"]: r for r in capture["records"]}
        panels = [("online", "check_intent \u2014 \u201cgit push origin main\u201d"), ("override", "check_intent \u2014 \u201c/yolo\u201d attempt"), ("secret", "publish_draft \u2014 synthetic token")]
        y0 = 120
        for pid, title in panels:
            r = recs[pid]
            draw_terminal_panel(d, 60, y0, 1800, 260, title=title)
            res = r["result"]
            decision = res.get("decision", "")
            gate = res.get("checks", [{}])[0].get("gate", "")
            reason = res.get("reason", "")
            findings = res.get("findings", [])
            # command line
            text_left(d, (90, y0 + 70), f"$ mcp call {r['tool']}", FONT_TERM, fill=ALLOW)
            # input (redacted for secret)
            if pid == "secret":
                inp_show = "content = \"Demo PR: fix the sample greeting.\\n" \
                           "demo_token = [SYNTHETIC TEST TOKEN]\""
            else:
                inp_show = "prompt = " + json.dumps(r["input"].get("prompt", ""))
            text_left(d, (90, y0 + 110), inp_show, FONT_TERM_SMALL, fill=FG)
            # verdict tag
            color = BLOCK if decision == "block" else (ASK if decision == "ask-first" else ALLOW)
            label = "BLOCKED" if decision == "block" else ("APPROVAL REQUIRED" if decision == "ask-first" else "ALLOWED")
            nx = draw_tag(d, (90, y0 + 160), label, color)
            findings_str = ""
            if findings:
                f0 = findings[0]
                findings_str = f"   finding: rule={f0.get('ruleId','')} line={f0.get('line','')}"
            text_left(d, (nx, y0 + 164), f"gate: {gate}   reason: {reason}{findings_str}", FONT_TERM_SMALL, fill=FG)
            text_left(d, (90, y0 + 210), f"execution: {res.get('execution','')}   status: {res.get('status','')}", FONT_TERM_SMALL, fill=DIM)
            y0 += 285
    draw_footer_captions(d, shot.caption_lines)
    return img

# ---- receipt shot ----
def render_receipt(shot: Shot, capture):
    img, d = new_frame()
    draw_header(d)
    rec = next(r for r in capture["records"] if r["id"] == "online")
    receipt_line = {
        "id": rec["result"]["id"],
        "policy": rec["result"]["policy"],
        "policyVersion": rec["result"]["policyVersion"],
        "policySha256": rec["result"]["policySha256"][:32] + "\u2026",
        "sha256": rec["result"]["sha256"][:32] + "\u2026",
        "event": "blocked",
        "decision": rec["result"]["decision"],
        "reason": rec["result"]["reason"],
        "checks": rec["result"]["checks"],
    }
    text_center(d, (W / 2, 110), "One decision, one receipt", FONT_H, fill=ACCENT)
    draw_terminal_panel(d, 60, 160, 1800, 470, title="receipts/<id>.jsonl \u2014 real record on disk")
    y = 220
    for k in ("id", "policy", "policyVersion", "policySha256", "sha256", "event", "decision", "reason"):
        v = receipt_line[k]
        text_left(d, (90, y), f"{k:<14} : ", FONT_TERM_SMALL, fill=DIM)
        text_left(d, (330, y), str(v), FONT_TERM_SMALL, fill=FG)
        y += 36
    text_left(d, (90, y), "checks         : ", FONT_TERM_SMALL, fill=DIM)
    for c in receipt_line["checks"]:
        text_left(d, (330, y), f"gate={c['gate']}  decision={c['decision']}  reason={c['reason']}", FONT_TERM_SMALL, fill=FG)
        y += 36
        for f in c.get("findings", []):
            text_left(d, (360, y), f"finding: rule={f.get('ruleId','')} line={f.get('line','')}", FONT_TERM_SMALL, fill=BLOCK)
            y += 32
    # bottom table of all six runs
    rounded_rect(d, [60, 660, 1860, 920], 14, fill=BG_PANEL, outline=BORDER, width=2)
    text_left(d, (90, 675), "All six recorded MCP calls in this run", FONT_LABEL, fill=ACCENT)
    y = 722
    headers = ["TOOL", "SCENARIO", "DECISION", "GATE", "EXECUTION"]
    xs = [90, 480, 850, 1160, 1500]
    for x, ht in zip(xs, headers):
        text_left(d, (x, y), ht, FONT_TERM_SMALL, fill=DIM)
    y += 32
    for r in capture["records"]:
        res = r["result"]
        dec = res.get("decision", "")
        color = ALLOW if dec == "allow" else (ASK if dec == "ask-first" else BLOCK)
        row = [r["tool"], r["id"], dec, res.get("checks", [{}])[0].get("gate", ""), res.get("execution", "")]
        for i, (x, val) in enumerate(zip(xs, row)):
            fill = color if i == 2 else FG
            text_left(d, (x, y), str(val), FONT_TERM_SMALL, fill=fill)
        y += 27
    draw_footer_captions(d, shot.caption_lines)
    return img

# ---- animated terminal (real MCP call captured as a live CLI session) ----
def _term_body_for(rec):
    """Return (typed_prompt, [(text, font, fill, indent), ...], tag_text, tag_color)
    describing the animated content for a single-panel terminal shot."""
    result = rec["result"]
    typed = f"PS> node scripts/mcp-call.mjs {rec['tool']}"
    body = []
    body.append(("> airlock-outbound MCP stdio server ready", FONT_TERM_SMALL, DIM, 0))
    body.append(("> request:", FONT_TERM_SMALL, DIM, 0))
    for jl in json.dumps(rec["input"], indent=2).splitlines():
        body.append((jl, FONT_TERM_SMALL, FG, 30))
    body.append(("> response:", FONT_TERM_SMALL, DIM, 0))
    body.append(("{", FONT_TERM_SMALL, FG, 30))
    for k in ("status", "decision", "reason", "execution"):
        v = result.get(k, "")
        body.append((f'  "{k}": "{v}",', FONT_TERM_SMALL, FG, 30))
    gate = result.get("checks", [{}])[0].get("gate", "")
    body.append((f'  "gate": "{gate}"', FONT_TERM_SMALL, FG, 30))
    body.append(("}", FONT_TERM_SMALL, FG, 30))
    decision = result.get("decision", "")
    tag_text, tag_color = {
        "allow": ("ALLOWED", ALLOW),
        "ask-first": ("APPROVAL REQUIRED", ASK),
        "block": ("BLOCKED", BLOCK),
    }.get(decision, (decision.upper(), DIM))
    body.append(("", FONT_TERM_SMALL, FG, 0))
    body.append((
        f"policy: {result.get('policy','')} v{result.get('policyVersion','')}   "
        f"policySha256: {result.get('policySha256','')[:16]}\u2026",
        FONT_TERM_SMALL, DIM, 0,
    ))
    rp = result.get("receiptPath", "")
    if rp:
        body.append(("> receipt: \u2026" + rp[-58:], FONT_TERM_SMALL, DIM, 0))
    return typed, body, tag_text, tag_color


def _blink_on(t: float, hz: float = 3.0) -> bool:
    return int(t * hz * 2) % 2 == 0


def render_terminal_at(shot: Shot, capture, t: float):
    """Render a single frame of the animated terminal shot at time fraction t in [0,1]."""
    img, d = new_frame()
    draw_header(d)
    record_key = shot.extra["record"]
    if record_key in ("local", "clean", "askfirst"):
        rec = next(r for r in capture["records"] if r["id"] == record_key)
        panel_title = f"pwsh \u2014 {rec['tool']} (real MCP call, captured from unmodified server)"
        draw_terminal_panel(d, 60, 120, 1800, 810, title=panel_title)
        typed, body, tag_text, tag_color = _term_body_for(rec)
        typing_frac = 0.25
        reveal_end = 0.90
        tag_appear = 0.75
        y_typed = 195
        if t <= typing_frac and typing_frac > 0:
            chars = int(round(len(typed) * (t / typing_frac)))
            visible = typed[:chars]
            text_left(d, (90, y_typed), visible, FONT_TERM, fill=ALLOW)
            cur_x = 90 + d.textbbox((0, 0), visible, font=FONT_TERM)[2] + 2
            if _blink_on(t):
                text_left(d, (cur_x, y_typed), "\u2588", FONT_TERM, fill=ALLOW)
        else:
            text_left(d, (90, y_typed), typed, FONT_TERM, fill=ALLOW)
            if t < reveal_end:
                progress = (t - typing_frac) / max(0.001, reveal_end - typing_frac)
            else:
                progress = 1.0
            n_visible = max(0, min(len(body), int(round(progress * len(body)))))
            cur_y = 250
            for i in range(n_visible):
                text, font, fill, indent = body[i]
                text_left(d, (90 + indent, cur_y), text, font, fill=fill)
                cur_y += 34
            if n_visible < len(body) and _blink_on(t):
                text_left(d, (90, cur_y), "\u2588", FONT_TERM_SMALL, fill=DIM)
        if t >= tag_appear:
            draw_tag(d, (60, 780), tag_text, tag_color)
    elif record_key == "online+override+secret":
        recs = {r["id"]: r for r in capture["records"]}
        panels = [
            ("online", "check_intent \u2014 \u201cgit push origin main\u201d"),
            ("override", "check_intent \u2014 \u201c/yolo\u201d attempt"),
            ("secret", "publish_draft \u2014 synthetic token"),
        ]
        y0 = 120
        for pi, (pid, title) in enumerate(panels):
            r = recs[pid]
            draw_terminal_panel(d, 60, y0, 1800, 260, title=title)
            panel_start = pi / 3.0
            panel_end = (pi + 1) / 3.0
            if t < panel_start:
                y0 += 285
                continue
            lt = min(1.0, (t - panel_start) / max(0.001, panel_end - panel_start))
            cmd = f"$ mcp call {r['tool']}"
            typing_frac = 0.28
            if lt <= typing_frac and typing_frac > 0:
                chars = int(round(len(cmd) * (lt / typing_frac)))
                visible = cmd[:chars]
                text_left(d, (90, y0 + 70), visible, FONT_TERM, fill=ALLOW)
                cur_x = 90 + d.textbbox((0, 0), visible, font=FONT_TERM)[2] + 2
                if _blink_on(t):
                    text_left(d, (cur_x, y0 + 70), "\u2588", FONT_TERM, fill=ALLOW)
            else:
                text_left(d, (90, y0 + 70), cmd, FONT_TERM, fill=ALLOW)
                if lt >= typing_frac + 0.03:
                    if pid == "secret":
                        inp_show = ("content = \"Demo PR: fix the sample greeting.\\n"
                                    "demo_token = [SYNTHETIC TEST TOKEN]\"")
                    else:
                        inp_show = "prompt = " + json.dumps(r["input"].get("prompt", ""))
                    text_left(d, (90, y0 + 110), inp_show, FONT_TERM_SMALL, fill=FG)
                if lt >= 0.60:
                    res = r["result"]
                    decision = res.get("decision", "")
                    color = BLOCK if decision == "block" else (ASK if decision == "ask-first" else ALLOW)
                    label = "BLOCKED" if decision == "block" else ("APPROVAL REQUIRED" if decision == "ask-first" else "ALLOWED")
                    nx = draw_tag(d, (90, y0 + 160), label, color)
                    gate = res.get("checks", [{}])[0].get("gate", "")
                    reason = res.get("reason", "")
                    findings = res.get("findings", [])
                    findings_str = ""
                    if findings:
                        f0 = findings[0]
                        findings_str = f"   finding: rule={f0.get('ruleId','')} line={f0.get('line','')}"
                    text_left(d, (nx, y0 + 164), f"gate: {gate}   reason: {reason}{findings_str}", FONT_TERM_SMALL, fill=FG)
                if lt >= 0.85:
                    res = r["result"]
                    text_left(d, (90, y0 + 210), f"execution: {res.get('execution','')}   status: {res.get('status','')}", FONT_TERM_SMALL, fill=DIM)
            y0 += 285
    draw_footer_captions(d, shot.caption_lines)
    return img


def render_receipt_at(shot: Shot, capture, t: float):
    """Animated receipt shot: type Get-Content command, stream JSON fields, then build the aggregate table row-by-row."""
    img, d = new_frame()
    draw_header(d)
    rec = next(r for r in capture["records"] if r["id"] == "online")
    text_center(d, (W / 2, 110), "One decision, one receipt", FONT_H, fill=ACCENT)
    draw_terminal_panel(d, 60, 160, 1800, 470, title="Get-Content receipts/<id>.jsonl (real record on disk)")
    typed = "PS> Get-Content evidence\\isolated-home\\\u2026\\receipts\\<id>.jsonl -Raw"
    typing_frac = 0.15
    fields_end = 0.55
    table_start = 0.55
    table_end = 0.95
    y_typed = 210
    if t <= typing_frac and typing_frac > 0:
        chars = int(round(len(typed) * (t / typing_frac)))
        visible = typed[:chars]
        text_left(d, (90, y_typed), visible, FONT_TERM_SMALL, fill=ALLOW)
        cur_x = 90 + d.textbbox((0, 0), visible, font=FONT_TERM_SMALL)[2] + 2
        if _blink_on(t):
            text_left(d, (cur_x, y_typed), "\u2588", FONT_TERM_SMALL, fill=ALLOW)
        draw_footer_captions(d, shot.caption_lines)
        return img
    text_left(d, (90, y_typed), typed, FONT_TERM_SMALL, fill=ALLOW)
    receipt_line = {
        "id": rec["result"]["id"],
        "policy": rec["result"]["policy"],
        "policyVersion": rec["result"]["policyVersion"],
        "policySha256": rec["result"]["policySha256"][:32] + "\u2026",
        "sha256": rec["result"]["sha256"][:32] + "\u2026",
        "event": "blocked",
        "decision": rec["result"]["decision"],
        "reason": rec["result"]["reason"],
    }
    field_order = ["id", "policy", "policyVersion", "policySha256", "sha256",
                   "event", "decision", "reason"]
    total_slots = len(field_order) + 1
    if t >= fields_end:
        n_visible = total_slots
    else:
        prog = (t - typing_frac) / max(0.001, fields_end - typing_frac)
        n_visible = max(0, min(total_slots, int(round(prog * total_slots))))
    fy = 254
    for k in field_order[:min(n_visible, len(field_order))]:
        v = receipt_line[k]
        text_left(d, (90, fy), f"{k:<14} : ", FONT_TERM_SMALL, fill=DIM)
        text_left(d, (330, fy), str(v), FONT_TERM_SMALL, fill=FG)
        fy += 36
    if n_visible >= total_slots:
        text_left(d, (90, fy), "checks         : ", FONT_TERM_SMALL, fill=DIM)
        for c in rec["result"]["checks"]:
            text_left(d, (330, fy), f"gate={c['gate']}  decision={c['decision']}  reason={c['reason']}", FONT_TERM_SMALL, fill=FG)
            fy += 36
            for f in c.get("findings", []):
                text_left(d, (360, fy), f"finding: rule={f.get('ruleId','')} line={f.get('line','')}", FONT_TERM_SMALL, fill=BLOCK)
                fy += 32
    if n_visible < total_slots and _blink_on(t):
        text_left(d, (90, fy), "\u2588", FONT_TERM_SMALL, fill=DIM)
    rounded_rect(d, [60, 660, 1860, 920], 14, fill=BG_PANEL, outline=BORDER, width=2)
    text_left(d, (90, 675), "All six recorded MCP calls in this run", FONT_LABEL, fill=ACCENT)
    ty = 722
    headers = ["TOOL", "SCENARIO", "DECISION", "GATE", "EXECUTION"]
    xs = [90, 480, 850, 1160, 1500]
    for x, ht in zip(xs, headers):
        text_left(d, (x, ty), ht, FONT_TERM_SMALL, fill=DIM)
    ty += 32
    records = capture["records"]
    if t >= table_end:
        n_rows = len(records)
    elif t <= table_start:
        n_rows = 0
    else:
        prog = (t - table_start) / max(0.001, table_end - table_start)
        n_rows = max(0, min(len(records), int(round(prog * len(records)))))
    for r in records[:n_rows]:
        res = r["result"]
        dec = res.get("decision", "")
        color = ALLOW if dec == "allow" else (ASK if dec == "ask-first" else BLOCK)
        row = [r["tool"], r["id"], dec, res.get("checks", [{}])[0].get("gate", ""), res.get("execution", "")]
        for i, (x, val) in enumerate(zip(xs, row)):
            fill = color if i == 2 else FG
            text_left(d, (x, ty), str(val), FONT_TERM_SMALL, fill=fill)
        ty += 27
    draw_footer_captions(d, shot.caption_lines)
    return img


# ---- recap and close ----
def render_recap(shot: Shot):
    img, d = new_frame()
    draw_header(d)
    text_center(d, (W / 2, 200), "For Maya, and for Jordan", FONT_H, fill=ACCENT)
    draw_person(d, 380, 560, CHARACTER_MAYA, "Maya")
    draw_person(d, 1540, 560, CHARACTER_JORDAN, "Jordan")
    # middle three verdict pill row
    pills = [("Safe work runs", ALLOW), ("Risky work waits", ASK), ("Forbidden work stops", BLOCK)]
    for i, (label, c) in enumerate(pills):
        x = 640 + i * 210
        rounded_rect(d, [x - 90, 500, x + 90, 620], 20, fill=BG_PANEL, outline=c, width=4)
        # short labels
        lines = wrap_text(label, FONT_SMALL, 170, d)
        yy = 520 if len(lines) == 2 else 540
        for ln in lines:
            tw = d.textbbox((0, 0), ln, font=FONT_SMALL)[2]
            d.text((x - tw / 2, yy), ln, font=FONT_SMALL, fill=FG)
            yy += 34
    text_center(d, (W / 2, 720), "Every verdict leaves a receipt on disk.", FONT_SUB, fill=DIM)
    draw_footer_captions(d, shot.caption_lines)
    return img

def render_close(shot: Shot):
    img, d = new_frame()
    # centered close card
    text_center(d, (W / 2, 380), "AGENT AIRLOCK", FONT_TITLE, fill=ACCENT)
    text_center(d, (W / 2, 490), "Room to move \u2014 not room to break the rules.", FONT_SUB, fill=FG)
    # airlock ring
    cx, cy, r = W / 2, 740, 130
    for i in range(8):
        ang = i * 45
        import math
        x = cx + r * math.cos(math.radians(ang))
        y = cy + r * math.sin(math.radians(ang))
        d.ellipse([x - 10, y - 10, x + 10, y + 10], fill=ACCENT)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ACCENT, width=6)
    d.ellipse([cx - r + 40, cy - r + 40, cx + r - 40, cy + r - 40], outline=BORDER, width=3)
    text_center(d, (W / 2, 960), "Local proof of concept \u2022 Guarded MCP tools only", FONT_SMALL, fill=DIM)
    return img

# ----------------------------------------------------------------------------
# 3) Compose per-shot MP4 (still frame + audio) then concat
# ----------------------------------------------------------------------------
def build_shot_frame(shot: Shot, capture):
    if shot.kind == "character" or shot.kind == "problem" or shot.kind == "solution_intro":
        return render_character(shot)
    if shot.kind == "terminal":
        return render_terminal(shot, capture)
    if shot.kind == "receipt":
        return render_receipt(shot, capture)
    if shot.kind == "recap":
        return render_recap(shot)
    if shot.kind == "close":
        return render_close(shot)
    raise RuntimeError(shot.kind)

def render_all_shots(capture):
    for shot in SHOTS:
        p = FRAMES_DIR / f"{shot.key}.png"
        if p.exists():
            p.unlink()
        img = build_shot_frame(shot, capture)
        img.save(p)
        print(f"frame {shot.key}")

def make_shot_video(shot: Shot, target_duration: float) -> Path:
    frame = FRAMES_DIR / f"{shot.key}.png"
    audio = AUDIO_DIR / f"{shot.key}.mp3"
    out = BUILD / f"{shot.key}.mp4"
    if out.exists():
        out.unlink()
    # loop the frame for target_duration; mux audio; pad audio with silence to reach duration
    subprocess.check_call([
        FFMPEG, "-y", "-loglevel", "error",
        "-loop", "1", "-framerate", str(FPS), "-t", f"{target_duration:.3f}", "-i", str(frame),
        "-i", str(audio),
        "-filter_complex", f"[1:a]apad=pad_dur=1[a]",
        "-map", "0:v:0", "-map", "[a]",
        "-t", f"{target_duration:.3f}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-shortest",
        str(out),
    ])
    return out


def make_shot_video_animated(shot: Shot, capture, target_duration: float) -> Path:
    """Render a frame-by-frame animated shot (terminal or receipt) and mux audio."""
    audio = AUDIO_DIR / f"{shot.key}.mp3"
    out = BUILD / f"{shot.key}.mp4"
    if out.exists():
        out.unlink()
    seq_dir = FRAMES_DIR / "anim" / shot.key
    if seq_dir.exists():
        shutil.rmtree(seq_dir)
    seq_dir.mkdir(parents=True, exist_ok=True)
    num_frames = max(1, int(round(target_duration * FPS)))
    for i in range(num_frames):
        t = i / max(1, num_frames - 1)
        if shot.kind == "terminal":
            img = render_terminal_at(shot, capture, t)
        elif shot.kind == "receipt":
            img = render_receipt_at(shot, capture, t)
        else:
            raise RuntimeError(shot.kind)
        img.save(seq_dir / f"{i:04d}.png")
    subprocess.check_call([
        FFMPEG, "-y", "-loglevel", "error",
        "-framerate", str(FPS), "-i", str(seq_dir / "%04d.png"),
        "-i", str(audio),
        "-filter_complex", "[1:a]apad=pad_dur=1[a]",
        "-map", "0:v:0", "-map", "[a]",
        "-t", f"{target_duration:.3f}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-shortest",
        str(out),
    ])
    return out

# ----------------------------------------------------------------------------
# 4) SRT
# ----------------------------------------------------------------------------
def fmt_srt(t: float) -> str:
    ms = int(round((t - int(t)) * 1000))
    s = int(t)
    h = s // 3600; s -= h * 3600
    m = s // 60; s -= m * 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def write_srt(timings, path: Path):
    lines = []
    idx = 1
    for shot, start, end in timings:
        # split caption lines into ~1.5s each
        segs = split_srt_segments(shot.narration, start, end)
        for seg_text, seg_start, seg_end in segs:
            lines.append(str(idx))
            lines.append(f"{fmt_srt(seg_start)} --> {fmt_srt(seg_end)}")
            lines.append(seg_text)
            lines.append("")
            idx += 1
    path.write_text("\n".join(lines), encoding="utf-8")

def split_srt_segments(text: str, start: float, end: float):
    # break on sentence boundaries; give each roughly equal share
    parts = re.split(r"(?<=[.!?\u2014])\s+", text.strip())
    parts = [p.strip() for p in parts if p.strip()]
    if not parts:
        return [(text, start, end)]
    dur = (end - start) / len(parts)
    out = []
    for i, p in enumerate(parts):
        seg_start = start + i * dur
        seg_end = seg_start + dur
        # wrap to two lines max, ~42 char per line
        wrapped = "\n".join(textwrap.wrap(p, width=48)[:2])
        out.append((wrapped, seg_start, seg_end))
    return out

# ----------------------------------------------------------------------------
# 5) Main
# ----------------------------------------------------------------------------
def main():
    capture = json.loads((EVIDENCE / "mcp-capture.json").read_text())
    print("Synthesizing narration...")
    asyncio.run(synth_all())
    print("Measuring audio...")
    durations = {}
    for shot in SHOTS:
        durations[shot.key] = _probe_duration(AUDIO_DIR / f"{shot.key}.mp3")
    # target per-shot duration = audio + small pad (0.6s), clamp to keep total in [115, 125]
    pads = {k: 0.6 for k in durations}
    # small extra pad on close for the sting
    pads[SHOTS[-1].key] = 1.0
    per_shot = [(shot, durations[shot.key] + pads[shot.key]) for shot in SHOTS]
    total = sum(t for _, t in per_shot)
    print(f"raw total = {total:.2f}s")
    # target 118s
    target = 118.0
    scale = target / total if total else 1.0
    per_shot = [(shot, t * scale) for shot, t in per_shot]
    # but never shorter than audio itself
    per_shot = [(shot, max(t, durations[shot.key] + 0.2)) for shot, t in per_shot]
    total = sum(t for _, t in per_shot)
    print(f"final total = {total:.2f}s")

    print("Rendering PNG frames...")
    render_all_shots(capture)

    print("Composing per-shot mp4s...")
    parts = []
    timings = []
    running = 0.0
    for shot, dur in per_shot:
        if shot.kind in ("terminal", "receipt"):
            p = make_shot_video_animated(shot, capture, dur)
        else:
            p = make_shot_video(shot, dur)
        parts.append(p)
        timings.append((shot, running, running + dur))
        running += dur

    # concat file
    concat_txt = BUILD / "concat.txt"
    concat_txt.write_text("\n".join(f"file '{p.as_posix()}'" for p in parts), encoding="utf-8")
    final_mp4 = OUT_ROOT / "Agent-Airlock-2min.mp4"
    if final_mp4.exists():
        final_mp4.unlink()
    subprocess.check_call([
        FFMPEG, "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(concat_txt),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(final_mp4),
    ])
    # poster
    poster = OUT_ROOT / "Agent-Airlock-poster.png"
    render_close(SHOTS[-1]).save(poster)
    # captions
    srt = OUT_ROOT / "Agent-Airlock-2min.srt"
    write_srt(timings, srt)
    # narration outputs
    narration = OUT_ROOT / "narration-script.txt"
    narration.write_text("\n\n".join(f"[{shot.key}]\n{shot.narration}" for shot in SHOTS), encoding="utf-8")
    timestamped = OUT_ROOT / "narration-timestamped.txt"
    lines = []
    for shot, start, end in timings:
        lines.append(f"{fmt_srt(start)[:-4]} - {fmt_srt(end)[:-4]}   [{shot.key}]")
        lines.append(shot.narration)
        lines.append("")
    timestamped.write_text("\n".join(lines), encoding="utf-8")
    # final duration
    final_dur = _probe_duration(final_mp4)
    print(f"final duration = {final_dur:.2f}s")
    (BUILD / "final-duration.txt").write_text(f"{final_dur:.3f}\n")

if __name__ == "__main__":
    main()
