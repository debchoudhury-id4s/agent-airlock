import pptxgen from "pptxgenjs";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { slides, baseline } from "./deck-content.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Agent Airlock contributors";
pptx.subject = "Agent Airlock team showcase: problem, architecture, gates and enforcement boundary";
pptx.title = "Agent Airlock";
pptx.company = "Agent Airlock";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Segoe UI",
  bodyFontFace: "Segoe UI",
  lang: "en-US",
};

const C = {
  bg: "0B1220", panel: "142238", panel2: "0F1B2D", edge: "2B405B",
  white: "F3F7FC", muted: "A8B8CF", cyan: "53DDF2", green: "49DCA2",
  amber: "FFCE67", red: "FF7C8E", purple: "B5A0FF",
};
const W = 13.333333, H = 7.5;
const S = pptx.ShapeType;
const geometry = [];
const time = seconds => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
let currentSlide;
let currentIndex;
let counter;

function shape(type, x, y, w, h, options = {}) {
  currentSlide.addShape(type, {
    x, y, w, h, line: { color: C.edge, transparency: 100 },
    fill: { color: C.panel }, ...options,
  });
}
function text(value, x, y, w, h, size = 20, options = {}) {
  const name = `s${currentIndex + 1}-text-${++counter}`;
  geometry.push({ slide: currentIndex + 1, name, x, y, w, h, size, text: value });
  currentSlide.addText(value, {
    x, y, w, h, fontFace: "Segoe UI", fontSize: size, color: C.white,
    margin: 0, valign: "top", wrap: true, objectName: name,
    ...options,
  });
}
function panel(x, y, w, h, accent = C.edge) {
  shape(S.roundRect, x, y, w, h, {
    radius: 0.16, rectRadius: 0.16,
    line: { color: accent, width: 0.8 }, fill: { color: C.panel },
  });
}
function arrow(x, y, w, h = 0, color = C.cyan) {
  shape(S.line, x, y, w, h, {
    line: { color, width: 1.8, beginArrowType: "none", endArrowType: "triangle" },
  });
}
function band(value, accent = C.cyan, y = 6.22) {
  panel(0.6, y, 12.13, 0.64);
  shape(S.rect, 0.6, y, 0.045, 0.64, { fill: { color: accent } });
  text(value, 0.83, y + 0.16, 11.65, 0.32, 16, { color: accent });
}
function code(value, x, y, w, h, label = "CODE / CONTRACT", size = 16.5) {
  panel(x, y, w, h);
  text(label, x + 0.24, y + 0.18, w - 0.48, 0.24, 11, { color: C.cyan, bold: true, charSpacing: 1.2 });
  text(value, x + 0.24, y + 0.69, w - 0.48, h - 0.9, size, { fontFace: "Consolas" });
}
function callout(title, body, x, y, w, h, color = C.cyan) {
  panel(x, y, w, h);
  shape(S.rect, x, y + 0.16, 0.045, h - 0.32, { fill: { color } });
  text(title, x + 0.24, y + 0.2, w - 0.48, 0.5, 19, { bold: true, color });
  text(body, x + 0.24, y + 0.88, w - 0.48, h - 1.05, 18);
}
function frame(item) {
  text("AGENT AIRLOCK", 0.6, 0.24, 3.1, 0.24, 13, { bold: true, color: C.cyan, charSpacing: 0.8 });
  text(item.chapter.toUpperCase(), 4.0, 0.26, 5.1, 0.22, 11, { color: C.muted, align: "center", charSpacing: 1 });
  text(item.sectionLabel ?? (item.type === "gate" ? "GATE + SCRIPT" : "TEAM SHOWCASE"), 9.2, 0.26, 3.53, 0.22, 10.5, { color: item.type === "gate" ? C.amber : C.muted, align: "right" });
  text(item.title, 0.6, 0.7, 12.13, 1.0, item.title.length > 58 ? 28 : 30, { bold: true });
  text(item.subtitle, 0.6, 1.75, 12.13, 0.37, 15.5, { color: C.muted });
  shape(S.line, 0.6, 7.05, 12.13, 0, { line: { color: C.edge, width: 0.6 } });
  text("PROTOTYPE  |  POLICY-GOVERNED AGENT ACTIONS", 0.6, 7.17, 6.4, 0.18, 9.5, { color: C.muted });
  text(`${String(currentIndex + 1).padStart(2, "0")} / ${slides.length}`, 11.88, 7.14, 0.85, 0.23, 11, { color: C.cyan, align: "right" });
}
function cards(item) {
  const gap = 0.22;
  const count = item.cards.length;
  const width = (12.13 - gap * (count - 1)) / count;
  for (const [index, card] of item.cards.entries()) {
    const x = 0.6 + index * (width + gap);
    panel(x, 2.25, width, 3.65, C[card.color ?? "edge"]);
    text(card.label, x + 0.25, 2.48, width - 0.5, 0.28, 11, { color: C[card.color ?? "cyan"], bold: true, charSpacing: 1.0 });
    text(card.title, x + 0.2, 3.02, width - 0.4, 0.9, count > 3 ? 20 : 22, { bold: true });
    text(card.body, x + 0.25, 4.09, width - 0.4, 1.55, count > 3 ? 16 : 19);
  }
  if (item.band) band(item.band, C[item.bandColor ?? "cyan"]);
}
function table(item) {
  const widths = item.widths ?? [3.0, 5.55, 3.58];
  const x0 = 0.6, y0 = 2.2;
  const rowHeight = item.rows.length > 5 ? 0.55 : item.rows.length > 4 ? 0.65 : 0.8;
  let x = x0;
  item.headers.forEach((value, index) => {
    shape(S.rect, x, y0, widths[index], 0.46, { fill: { color: "203650" } });
    text(value.toUpperCase(), x + 0.18, y0 + 0.12, widths[index] - 0.36, 0.22, 11, { color: C.cyan, bold: true });
    x += widths[index];
  });
  item.rows.forEach((row, r) => {
    x = x0;
    const y = y0 + 0.49 + r * rowHeight;
    row.forEach((value, col) => {
      shape(S.rect, x, y, widths[col] - 0.035, rowHeight - 0.045, { fill: { color: r % 2 ? C.panel2 : C.panel } });
      text(value, x + 0.16, y + 0.1, widths[col] - 0.2, rowHeight - 0.14, item.rows.length > 4 ? 14 : item.rows.length > 3 ? 15 : 18, { color: col === 0 ? C.white : C.muted, bold: col === 0 });
      x += widths[col];
    });
  });
  if (item.band) band(item.band, C[item.bandColor ?? "cyan"]);
}
function flow(item) {
  const n = item.steps.length;
  const gap = 0.33;
  const width = (12.13 - (n - 1) * gap) / n;
  item.steps.forEach((step, i) => {
    const x = 0.6 + i * (width + gap);
    if (i < n - 1) arrow(x + width + 0.03, 3.14, gap - 0.06);
    panel(x, 2.6, width, 1.25, C[step.color ?? "edge"]);
    text(String(i + 1).padStart(2, "0"), x + 0.18, 2.78, width - 0.36, 0.25, 11, { color: C[step.color ?? "cyan"] });
    text(step.title, x + 0.18, 3.1, width - 0.36, 0.55, n > 4 ? 18 : 22, { bold: true });
    text(step.body, x + 0.05, 4.1, width - 0.1, 1.32, n > 4 ? 16 : 18, { color: C.muted });
  });
  if (item.band) band(item.band, C[item.bandColor ?? "cyan"]);
}
function source(item) {
  code(item.code, 0.6, 2.15, 7.22, 3.83, item.codeLabel ?? "SOURCE EXCERPT", item.codeSize ?? 16);
  const h = item.points.length === 2 ? 1.8 : 1.19;
  item.points.forEach((point, i) => {
    const y = 2.15 + i * (h + 0.13);
    panel(8.05, y, 4.68, h);
    text(point.title, 8.28, y + 0.15, 4.21, 0.33, 18, { bold: true, color: C[point.color ?? "cyan"] });
    text(point.body, 8.28, y + 0.59, 4.31, h - 0.73, item.points.length === 2 ? 18 : 16);
  });
  if (item.band) band(item.band, C[item.bandColor ?? "cyan"]);
}
function gate(item) {
  panel(0.6, 2.12, 4.25, 3.98, C[item.accent ?? "cyan"]);
  text(item.gateLabel.toUpperCase(), 0.86, 2.34, 3.75, 0.34, 10, { color: C[item.accent ?? "cyan"], bold: true, charSpacing: 0.8 });
  text(item.purpose, 0.86, 2.78, 3.7, 0.95, 18, { bold: true });
  text("CHECKS", 0.86, 3.82, 1.1, 0.22, 10, { color: C.muted, bold: true });
  text(item.checks, 0.86, 4.08, 3.68, 1.15, 14.5);
  text("POLICY RESULT", 0.86, 5.3, 1.65, 0.22, 10, { color: C.muted, bold: true });
  text(item.result, 0.86, 5.55, 3.68, 0.46, 14, { color: C[item.resultColor ?? "amber"], bold: true });

  const mediaPath = item.recordingFile ? join(root, item.recordingFile) : null;
  panel(5.08, 2.12, 7.65, 3.98, C.edge);
  if (mediaPath && existsSync(mediaPath)) {
    currentSlide.addMedia({ path: mediaPath, type: "video", x: 5.11, y: 2.15, w: 7.59, h: 3.92 });
  } else {
    shape(S.rect, 5.11, 2.15, 7.59, 3.92, { fill: { color: "07101D" }, line: { color: C.edge, width: 0.8 } });
    text("▶  SCREEN RECORDING", 5.42, 2.42, 3.1, 0.28, 12, { color: C.green, bold: true, charSpacing: 0.9 });
    text(item.command, 5.42, 2.98, 6.95, 1.18, item.commandSize ?? 15, { fontFace: "Consolas", color: C.white });
    item.outcomes.forEach((entry, index) => {
      const x = 5.42 + index * 2.28;
      panel(x, 4.53, 2.08, 0.78, C[entry.color ?? "cyan"]);
      text(entry.label.toUpperCase(), x + 0.14, 4.68, 1.8, 0.18, 9.5, { color: C.muted, bold: true });
      text(entry.value, x + 0.14, 4.96, 1.8, 0.22, entry.value.length > 18 ? 11.5 : 14, { color: C[entry.color ?? "cyan"], bold: true });
    });
    text(`Recording slot: ${item.recordingFile}`, 5.42, 5.57, 6.95, 0.2, 10.5, { color: C.muted });
  }
  band(item.takeaway, C[item.accent ?? "cyan"]);
}
function sequence(item) {
  const names = ["Tool adapter", "Broker", "Evaluator + gates", "Executor"];
  const xs = [1.2, 4.25, 7.4, 10.65];
  names.forEach((name, i) => {
    panel(xs[i] - 0.55, 2.2, 2.35, 0.52);
    text(name, xs[i] - 0.4, 2.36, 2.05, 0.22, 12, { bold: true, align: "center" });
    shape(S.line, xs[i] + 0.6, 2.87, 0, 2.9, { line: { color: C.edge, width: 1, dashType: "dash" } });
  });
  const rows = [
    { from: 0, to: 1, y: 3.1, label: "1  validated action + callback", color: C.cyan },
    { from: 1, to: 2, y: 3.65, label: "2  evaluate frozen snapshot", color: C.cyan },
    { from: 2, to: 1, y: 4.2, label: "3  combined decision + checks", color: C.purple },
    { from: 1, to: 3, y: 5.35, label: "5  execute(snapshot, id) ONLY IF ALLOW", color: C.green },
  ];
  for (const row of rows) {
    const left = Math.min(xs[row.from], xs[row.to]) + 0.6;
    const right = Math.max(xs[row.from], xs[row.to]) + 0.6;
    shape(S.line, left, row.y, right - left, 0, {
      line: { color: row.color, width: 1.6, beginArrowType: row.from > row.to ? "triangle" : "none", endArrowType: row.from < row.to ? "triangle" : "none" },
    });
    text(row.label, left + 0.1, row.y - 0.27, right - left - 0.2, 0.22, 11.5, { color: row.color });
  }
  panel(3.88, 4.53, 5.03, 0.48, C.amber);
  text("4  SAVE RECEIPT  |  non-allow returns here", 4.07, 4.68, 4.66, 0.2, 12, { color: C.amber, bold: true });
  band(item.band);
}
function boundary(item) {
  const rows = [
    { y: 2.4, title: "AIRLOCK ROUTE", color: C.cyan, boxes: ["Airlock MCP tool", "Broker + required gates", "Local executor / artifact"] },
    { y: 4.2, title: "OTHER ROUTES", color: C.red, boxes: ["Other MCP / shell", "Host permissions", "External operation"] },
  ];
  rows.forEach(row => {
    text(row.title, 0.6, row.y, 3.2, 0.25, 11, { color: row.color, bold: true });
    row.boxes.forEach((label, i) => {
      const x = 0.6 + i * 4.15;
      panel(x, row.y + 0.45, 3.83, 0.88, row.color);
      text(label, x + 0.18, row.y + 0.73, 3.47, 0.38, 19, { bold: true });
      if (i < 2) arrow(x + 3.88, row.y + 0.91, 0.22, 0, row.color);
    });
  });
  band(item.band, C.amber);
}
function airlock(item) {
  panel(0.7, 2.15, 3.15, 3.45, C.cyan);
  text("AGENT CHAMBER", 0.95, 2.43, 2.65, 0.3, 13, { color: C.cyan, bold: true, charSpacing: 1 });
  text("code edits\ntests\nlocal analysis\nPR draft", 0.98, 3.05, 2.45, 1.85, 25, { bold: true });
  arrow(3.95, 3.88, 1.05, 0, C.cyan);
  shape(S.chevron, 5.05, 2.35, 3.05, 3.05, { fill: { color: C.panel }, line: { color: C.amber, width: 2 } });
  text("AIRLOCK", 5.4, 3.04, 2.35, 0.38, 23, { color: C.amber, bold: true, align: "center" });
  text("policy\nchecks\nreceipts", 5.58, 3.55, 2.0, 1.25, 23, { align: "center" });
  arrow(8.2, 3.88, 1.05, 0, C.green);
  panel(9.35, 2.15, 3.15, 3.45, C.green);
  text("OUTSIDE WORLD", 9.62, 2.43, 2.6, 0.3, 13, { color: C.green, bold: true, charSpacing: 1 });
  text("GitHub\npackages\nmodels\nmessages", 9.67, 3.05, 2.4, 1.85, 25, { bold: true });
  shape(S.arc, 4.87, 2.1, 3.42, 3.56, { fill: { color: C.bg, transparency: 100 }, line: { color: C.cyan, width: 4 } });
  shape(S.arc, 4.72, 1.95, 3.72, 3.86, { fill: { color: C.bg, transparency: 100 }, line: { color: C.red, width: 2 } });
  text("Nothing leaves until it clears policy.", 0.82, 5.82, 11.4, 0.48, 23, { color: C.white, bold: true, align: "center" });
  if (item.band) band(item.band, C[item.bandColor ?? "cyan"]);
}
function cover(item) {
  text(item.hero ?? "Room to move.\nRules that hold.", 0.6, 2.05, 7.65, 1.95, 48, { bold: true });
  text(item.heroSubtitle ?? "Agent Airlock checks each mission before takeoff, pauses risky actions for approval,\nand blocks forbidden actions before they reach real systems.", 0.65, 4.12, 7.35, 1.5, 20, { color: C.muted });
  (item.coverSteps ?? ["PROPOSE", "CLEAR AIRLOCK", "SHIP OR STOP"]).forEach((label, i) => {
    panel(9.0, 2.26 + i * 1.08, 3.73, 0.78, i === 2 ? C.green : C.cyan);
    text(label, 9.24, 2.51 + i * 1.08, 3.25, 0.3, 19, { color: i === 2 ? C.green : C.cyan, bold: true });
    if (i < 2) arrow(10.84, 3.1 + i * 1.08, 0, 0.17);
  });
  band(item.band ?? "THE PROMPT DESCRIBES THE DESTINATION. AGENT AIRLOCK CLEARS THE SAFE PATH.", C.cyan);
}
function closing(item) {
  text(item.hero ?? "Policy chooses the checks.\nGates evaluate.\nThe broker controls execution.", 0.65, 2.35, 11.9, 2.45, 35, { bold: true });
  text(item.body ?? "The next challenge is mandatory mediation,\nnot stronger wording in the prompt.", 0.68, 4.98, 11.55, 1.02, 20, { color: C.cyan });
  band(item.band, C.amber);
}

const render = { cards, table, flow, source, gate, sequence, boundary, cover, closing, airlock };
if (slides.length > 24 || slides.length < 10) {
  throw new Error("The showcase must contain 10-24 slides.");
}
let elapsed = 0;
const plan = [];
for (const [index, item] of slides.entries()) {
  if (!render[item.type] || !item.notes || item.sources.length === 0) throw new Error(`Incomplete slide ${index + 1}`);
  currentIndex = index;
  counter = 0;
  currentSlide = pptx.addSlide();
  currentSlide.background = { color: C.bg };
  frame(item);
  render[item.type](item);
  const sourceLines = item.sources.map(path => `plugins\\AirlockPlugin\\${path}`);
  const cue = item.cue ?? "Stay on this slide. Reveal or point to the visual in reading order; no external action is required.";
  currentSlide.addNotes([
    `SLIDE ${index + 1}: ${item.title}`,
    `ON-SCREEN CUE: ${cue}`,
    "",
    "SPEAKER SCRIPT",
    item.notes,
    "",
    "IMPLEMENTATION EVIDENCE",
    `Source baseline: ${baseline}. These citations describe code, not fresh execution evidence.`,
    ...sourceLines,
    "",
    "DEMO SAFETY",
    "Use only synthetic fixtures in a prepared isolated local instance. Do not expose personal session logs, tokens or actual PII. A blocked/review/error case must not be retried through another tool. Expected results on slides are not captured evidence. Preserve and inspect the real receipt when recording.",
  ].join("\n"));
  plan.push({ slide: index + 1, title: item.title, start: time(elapsed), end: time(elapsed + item.seconds), seconds: item.seconds, mode: item.type === "gate" ? "gate-demo" : "narration", cue });
  elapsed += item.seconds;
}
for (const entry of geometry) {
  if (entry.x < 0 || entry.y < 0 || entry.x + entry.w > W + 0.01 || entry.y + entry.h > H + 0.01) {
    throw new Error(`Off-slide text: ${entry.name}`);
  }
}
const csv = [
  ["Slide", "Title", "Start", "End", "Seconds", "Mode", "Recording cue"],
  ...plan.map(row => [row.slide, row.title, row.start, row.end, row.seconds, row.mode, row.cue]),
].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
await pptx.writeFile({ fileName: join(root, "Agent-Airlock-Team-Showcase.pptx"), compression: true });
await writeFile(join(root, "recording-cues.csv"), `${csv}\r\n`);
await writeFile(join(root, "deck-validation.json"), JSON.stringify({
  baseline, slideCount: slides.length, plannedSeconds: elapsed, plannedMinutes: elapsed / 60,
  slidesWithNotes: slides.filter(slide => slide.notes).length,
  gateSlides: plan.filter(slide => slide.mode === "gate-demo").map(slide => slide.slide),
  expectedResultsAreNotCapturedEvidence: true,
  geometryCheck: "all text boxes within slide bounds",
}, null, 2));
console.log(`Created ${slides.length} editable Agent Airlock showcase slides with notes.`);
