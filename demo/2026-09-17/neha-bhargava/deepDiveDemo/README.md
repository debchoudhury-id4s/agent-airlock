# Agent Airlock team showcase

An editable presentation focused on what the engineering team should understand:

- the problem created when agent reasoning can become a real side effect;
- why prompts and repository instructions are guidance rather than enforcement;
- the Airlock tool, policy, gate, broker and executor structure;
- each implemented gate and its runnable demonstration;
- the current routing boundary and the path to shared enforcement.

## Presentation

- `Agent-Airlock-Team-Showcase.pptx` — editable slides and speaker notes.
- `Agent-Airlock-Team-Showcase.pdf` — rendered slide-only preview.
- `recording-cues.csv` — optional narration and demonstration cues.
- `preview\` — local slide images and contact sheets; ignored by Git.

The presentation is grounded in Airlock source commit `d4ca434`. It clearly
distinguishes implemented behavior from proposed mandatory mediation and
approval workflows.

## Gate demonstrations

From this directory, with Node 24 and authenticated GitHub CLI access to the
private `dlingam_microsoft/airlock-e2e-sample` repository:

```powershell
npm ci
npm run demo:prepare
npm run demo -- --list
npm run demo -- --gate all
```

Each gate slide contains its focused command:

```powershell
npm run demo -- --gate sensitive-information
npm run demo -- --gate dependency-risk
npm run demo -- --gate model-catalog
npm run demo -- --gate intent
npm run demo -- --gate trending-cost
```

See `demos\README.md` for detailed cases, evidence paths, safety controls and
limitations. The scripts invoke the real Airlock MCP server using isolated
profiles and synthetic inputs. They do not create real pull requests, push,
restore packages, invoke model inference or prove mandatory host routing.

## Optional screen recordings

The generator embeds a gate recording when the corresponding file exists:

```text
recordings\sensitive-information.mp4
recordings\dependency-risk.mp4
recordings\model-catalog.mp4
recordings\intent.mp4
recordings\trending-cost.mp4
```

Without a recording, the slide renders a polished terminal frame containing
the command and expected outcome categories. See `recordings\README.md` for
recording guidance.

## Rebuild

Edit `deck-content.mjs` for the narrative, gate details, speaker notes and demo
cues. Edit `build-deck.mjs` for native PowerPoint layouts.

```powershell
npm run build
npm run demo:test
.\render-deck.ps1
```

`deck-validation.json` records generated slide and note counts.
`preview\text-overflow.json` records PowerPoint-native text-bound checks.
Only reviewed, permitted material and synthetic fixtures should appear in a
recording. Keep private source, credentials and real session history off screen.
