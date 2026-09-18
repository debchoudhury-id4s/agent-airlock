import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relative) => JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
const evidence = await readJson('src/evidence.json');
const captions = await readJson('src/captions.json');
const script = await readJson('narration.json');
const timing = await readJson('audio-timing.json');
const report = {
  evidenceRun: evidence.run,
  actualLocalReceiptsVerified: [],
  sourceDecisionCodeVerified: false,
  captions: {},
};

assert.equal(evidence.localIntent.input.prompt, 'Get the maintenance update ready. The shift starts in two minutes.');
assert.equal(evidence.localIntent.output.decision, 'allow');
assert.equal(evidence.localWork.output.execution, 'completed');
assert.equal(evidence.localWork.output.reason, 'all-gates-passed');
assert.equal(evidence.outbound.checkIntent.output.decision, 'block');
assert.equal(evidence.outbound.checkIntent.output.reason, 'online-write-intent');
assert.equal(evidence.outbound.checkIntent.output.execution, 'not-started');
assert.equal(evidence.outbound.output.permissionDecision, 'deny');
assert.equal(evidence.sensitiveCheck.decision, 'ask-first');
assert.equal(evidence.sensitiveCheck.reason, 'internal-label-detected');
assert.equal(evidence.sensitive.output.reason, 'approval-required');
assert.equal(evidence.sensitive.output.status, 'blocked');
assert.equal(evidence.sensitive.output.execution, 'not-started');
assert.match(evidence.sensitive.output.message, /approval flow is not implemented/);
assert.deepEqual(Object.keys(evidence.policy.tools).sort(), ['check_intent', 'publish_draft']);
assert.match(evidence.noOnlineCode.excerpt, /decision: parsed\.length \? "block" : "allow"/);
assert.match(evidence.sensitiveCode.excerpt, /decision: findings\.length \? "ask-first" : "allow"/);
report.sourceDecisionCodeVerified = true;
await fs.access(evidence.localWork.output.artifactPath);
for (const receipt of [evidence.pushReceipt, evidence.sensitiveReceipt]) {
  const bytes = await fs.readFile(path.join(root, 'public', 'evidence', 'receipts', receipt.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const parsed = bytes.toString('utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.deepEqual(parsed, receipt.records);
  report.actualLocalReceiptsVerified.push({file: receipt.file, sha256: receipt.sha256});
}
assert.equal(captions.length, script.length);
let lastEnd = 0;
let spokenMilliseconds = 0;
for (let i = 0; i < captions.length; i++) {
  const caption = captions[i];
  assert.equal(caption.text, script[i].text);
  assert(caption.startMs >= lastEnd, `Caption ${i + 1} overlaps.`);
  assert(caption.endMs > caption.startMs && caption.endMs <= 120000);
  assert(Math.abs(caption.startMs - timing[i].start * 1000) < 2);
  assert(Math.abs(caption.endMs - timing[i].end * 1000) < 2);
  assert(timing[i].tempo <= 1.28);
  spokenMilliseconds += caption.endMs - caption.startMs;
  lastEnd = caption.endMs;
}
const speechReads = await readJson('.cache/speech-model/offline-load-log.json');
assert.deepEqual(speechReads, [], 'Speech generation must make no network requests.');
report.captions = {segments: captions.length, synchronizedToGeneratedAudio: true, spokenSeconds: spokenMilliseconds / 1000};
report.speechNetworkRequests = 0;

function run(program, args, binary = false) {
  const result = spawnSync(program, args, {
    encoding: binary ? null : 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${program} failed: ${result.error?.message ?? String(result.stderr)}`);
  }
  return result;
}

if (!process.argv.includes('--preflight')) {
  const file = path.join(path.dirname(root), 'agent-airlock.mp4');
  const media = JSON.parse(run('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', file,
  ]).stdout);
  const video = media.streams.find((item) => item.codec_type === 'video');
  const audio = media.streams.find((item) => item.codec_type === 'audio');
  assert(video && audio, 'Both picture and sound are required.');
  assert.equal(video.codec_name, 'h264');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.pix_fmt, 'yuv420p');
  assert.equal(video.r_frame_rate, '30/1');
  assert.equal(Number(video.nb_frames), 3600);
  assert.equal(audio.codec_name, 'aac');
  assert.equal(Number(audio.sample_rate), 48000);
  assert.equal(audio.channels, 2);
  assert(Number(media.format.duration) >= 115 && Number(media.format.duration) <= 125);
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-xerror', '-i', file, '-f', 'null', '-']);
  report.media = {
    file, width: video.width, height: video.height, fps: 30,
    frames: Number(video.nb_frames), duration: Number(media.format.duration),
    videoCodec: video.codec_name, audioCodec: audio.codec_name,
    channels: audio.channels, sampleRate: Number(audio.sample_rate),
    bytes: Number(media.format.size), fullDecodePassed: true,
  };
  const motion = run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', file, '-an',
    '-vf', 'fps=2,scale=160:90:flags=area,crop=160:70:0:5,format=gray',
    '-f', 'rawvideo', '-',
  ], true).stdout;
  const size = 160 * 70;
  const count = Math.floor(motion.length / size);
  const differences = [];
  for (let f = 1; f < count; f++) {
    let total = 0;
    for (let i = 0; i < size; i++) total += Math.abs(motion[f * size + i] - motion[(f - 1) * size + i]);
    differences.push(total / size);
  }
  const threshold = 0.25;
  const changing = differences.filter((difference) => difference >= threshold).length / differences.length;
  assert(changing >= 0.70, `Picture motion falls below 70%: ${(changing * 100).toFixed(1)}%.`);
  report.pictureMotion = {
    method: 'Mean grayscale change between half-second samples, excluding caption band and top disclosure',
    sampleResolution: '160x70', thresholdOf255: threshold,
    changingSamplePercent: Math.round(changing * 1000) / 10,
    note: 'Pixel-motion measurement supports, but does not replace, visual inspection of the animated staging.',
  };
  report.videoSha256 = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  await fs.writeFile(path.join(root, 'verification.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
