import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadVoice, root} from './local-voice.mjs';

const rate = 48000;
const duration = 120;
const length = duration * rate;
const publicDir = path.join(root, 'public');
const speechDir = path.join(root, '.cache', 'speech-lines');
await fs.mkdir(publicDir, {recursive: true});
await fs.mkdir(speechDir, {recursive: true});
const script = JSON.parse(await fs.readFile(path.join(root, 'narration.json'), 'utf8'));
const left = new Float32Array(length);
const right = new Float32Array(length);
const voiceTrack = new Float32Array(length);
const captions = [];
const timing = [];
const voice = await loadVoice();

function execute(program, args) {
  const result = spawnSync(program, args, {encoding: 'utf8', windowsHide: true});
  if (result.error || result.status !== 0) {
    throw new Error(`${program} failed: ${result.error?.message ?? result.stderr}`);
  }
  return result.stdout;
}

function wav(samples, channels = 1) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buffer;
}

for (let i = 0; i < script.length; i++) {
  const line = script[i];
  const digest = createHash('sha256').update(`${line.text}|af_heart|1.0|q8`).digest('hex').slice(0, 16);
  const raw = path.join(speechDir, `${digest}.wav`);
  const exists = await fs.access(raw).then(() => true, (error) => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  });
  if (!exists) {
    const audio = await voice.generate(line.text, {voice: 'af_heart', speed: 1.0});
    await audio.save(raw);
  }
  const measured = Number(execute('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', raw]).trim());
  const available = line.end - line.start - 0.1;
  const tempo = Math.max(1, measured / available);
  if (tempo > 1.28) {
    throw new Error(`Narration ${i + 1} needs rewriting: ${measured.toFixed(2)} seconds in ${available.toFixed(2)}. ${line.text}`);
  }
  const pcm = path.join(speechDir, `${digest}.pcm`);
  execute('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
    '-af', `atempo=${tempo.toFixed(5)},highpass=f=75,afade=t=in:d=0.015`,
    '-ar', String(rate), '-ac', '1', '-f', 'f32le', pcm,
  ]);
  const bytes = await fs.readFile(pcm);
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const start = Math.round(line.start * rate);
  for (let j = 0; j < samples.length && start + j < length; j++) voiceTrack[start + j] += samples[j];
  const end = line.start + samples.length / rate;
  captions.push({text: line.text, startMs: Math.round(line.start * 1000), endMs: Math.round(end * 1000), timestampMs: null, confidence: null});
  timing.push({line: i + 1, start: line.start, end, text: line.text, naturalDuration: measured, tempo});
  console.log(`Voice ${i + 1}/${script.length}: ${line.start.toFixed(1)}-${end.toFixed(1)}s (${tempo.toFixed(2)}x)`);
  await fs.unlink(pcm);
}

function sound(start, seconds, amplitude, synth, pan = 0) {
  const first = Math.floor(start * rate);
  const count = Math.min(Math.floor(seconds * rate), length - first);
  const lg = Math.sqrt((1 - pan) / 2);
  const rg = Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < count; i++) {
    const value = synth(i / rate, i / count) * amplitude;
    left[first + i] += value * lg;
    right[first + i] += value * rg;
  }
}

const sine = (frequency, t) => Math.sin(2 * Math.PI * frequency * t);
let seed = 98271;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}
function note(start, frequency, seconds, amplitude, pan = 0) {
  sound(start, seconds, amplitude, (t) => (
    (sine(frequency, t) + 0.24 * sine(frequency * 2.001, t) + 0.09 * sine(frequency * 4.003, t))
    * (1 - Math.exp(-t * 150)) * Math.exp(-t * 2.5)
  ), pan);
}

const minor = [146.832, 174.614, 220, 293.665];
const resolved = [146.832, 184.997, 220, 293.665];
for (let bar = 0; bar < 30; bar++) {
  const time = bar * 4;
  const chord = time < 44 ? minor : resolved;
  const intensity = time > 106 ? 0.044 : time >= 43 && time < 49 ? 0.013 : 0.025;
  for (let n = 0; n < 4; n++) {
    const freq = chord[n] * (bar % 4 === 2 ? 0.75 : 1);
    sound(time, 4.4, intensity / 4, (t, p) => (
      (sine(freq, t) + 0.3 * sine(freq * 0.9985, t) + 0.15 * sine(freq * 2, t))
      * Math.min(1, t * 2) * Math.sin(Math.PI * Math.min(1, p)) ** 0.6
    ), (n - 1.5) * 0.4);
    note(time + n * 0.78 + 0.2, chord[n] * 2, 1.9, time < 42 ? 0.012 : 0.018, n % 2 ? -0.4 : 0.4);
  }
  if (time < 43) sound(time, 2.8, 0.025, (t) => sine(55, t) * Math.exp(-t * 2.2));
}

let smooth = 0;
sound(0, duration, 0.009, (t) => {
  smooth = smooth * 0.88 + noise() * 0.12;
  return smooth * Math.min(1, t / 2) * Math.min(1, (duration - t) / 3);
}, -0.15);
for (let t = 0.5; t < 42; t += 1) {
  sound(t, 0.055, 0.028, (s) => (noise() * 0.75 + sine(1950, s) * 0.25) * Math.exp(-s * 125), -0.45);
}
for (const [start, end] of [[14.8, 19], [53.6, 55.7], [58.9, 61], [68, 70]]) {
  for (let t = start; t < end; t += 0.09 + (noise() + 1) * 0.045) {
    sound(t, 0.065, 0.015, (s) => (noise() * 0.7 + sine(340, s) * 0.3) * Math.exp(-s * 100), 0.2);
  }
}
for (const time of [28, 43, 49.1, 66, 80, 94.3, 107]) {
  sound(time, 0.8, 0.055, (t, p) => noise() * Math.sin(Math.PI * p) ** 2 * (0.4 + 0.6 * p), time % 2 ? -0.5 : 0.5);
}
for (const time of [34.6, 70.4]) {
  sound(time, 1.1, 0.13, (t) => sine(63 - 19 * t, t) * Math.exp(-t * 5));
  sound(time, 0.25, 0.07, (t) => noise() * Math.exp(-t * 28));
}
for (const time of [59.5, 62.2, 109.1]) {
  note(time, 659.255, 1.1, 0.052, -0.1);
  note(time + 0.1, 987.767, 1.2, 0.031, 0.2);
}
for (const time of [85.7, 87.2, 90.2]) {
  sound(time, 0.16, 0.042, (t) => sine(470, t) * Math.sin(Math.PI * t / 0.16));
}
sound(95, 1.8, 0.028, (t) => (sine(137, t) + noise() * 0.6) * (0.35 + 0.3 * sine(16, t)));
sound(41.2, 1.8, 0.049, (t, p) => sine(160 + p * 580, t) * p * p);

const stereo = new Float32Array(length * 2);
for (let i = 0; i < length; i++) {
  const fade = Math.min(1, (length - i) / (rate * 1.8));
  stereo[i * 2] = left[i] * fade;
  stereo[i * 2 + 1] = right[i] * fade;
}
await fs.writeFile(path.join(publicDir, 'narration.wav'), wav(voiceTrack));
await fs.writeFile(path.join(publicDir, 'score.wav'), wav(stereo, 2));
execute('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', path.join(publicDir, 'narration.wav'), '-i', path.join(publicDir, 'score.wav'),
  '-filter_complex',
  '[0:a]loudnorm=I=-17:TP=-2:LRA=9,aresample=48000,pan=stereo|c0=c0|c1=c0[v];[v][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.89:level=false,afade=t=out:st=118.2:d=1.8[a]',
  '-map', '[a]', '-c:a', 'pcm_s16le', '-ar', String(rate), '-t', String(duration),
  path.join(publicDir, 'soundtrack.wav'),
]);
await fs.writeFile(path.join(root, 'src', 'captions.json'), JSON.stringify(captions, null, 2));
await fs.writeFile(path.join(root, 'audio-timing.json'), JSON.stringify(timing, null, 2));
const srtTime = (ms) => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor(ms / 60000) % 60;
  const seconds = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
await fs.writeFile(path.join(path.dirname(root), 'agent-airlock.srt'), captions.map((caption, i) => (
  `${i + 1}\n${srtTime(caption.startMs)} --> ${srtTime(caption.endMs)}\n${caption.text}\n`
)).join('\n'));
console.log('Original score, offline neural narration, synchronized captions, and final soundtrack saved.');
