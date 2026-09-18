import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {env} from '@huggingface/transformers';
import {KokoroTTS} from 'kokoro-js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache', 'speech-model');
const reads = [];
const originalFetch = globalThis.fetch;
let downloadsAllowed = false;

delete process.env.HF_TOKEN;
delete process.env.HUGGING_FACE_HUB_TOKEN;
process.env.HF_HUB_DISABLE_TELEMETRY = '1';
env.cacheDir = cache;
env.allowLocalModels = true;

globalThis.fetch = async (input, init) => {
  if (!downloadsAllowed) throw new Error('Speech synthesis must use local model files only.');
  const url = input instanceof Request ? input.url : String(input);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) {
    throw new Error(`Online writes are forbidden: ${method}`);
  }
  const host = new URL(url).hostname;
  if (!(host === 'huggingface.co' || host.endsWith('.huggingface.co') || host.endsWith('.hf.co'))) {
    throw new Error(`Unexpected speech asset host: ${host}`);
  }
  reads.push({method, url});
  return originalFetch(input, init);
};

export async function loadVoice({download = false} = {}) {
  await fs.mkdir(cache, {recursive: true});
  downloadsAllowed = download;
  env.allowRemoteModels = download;
  const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8',
    device: 'cpu',
    progress_callback: (event) => {
      if (event.status === 'done') console.log(`Speech asset ready: ${event.file}`);
    },
  });
  env.allowRemoteModels = false;
  downloadsAllowed = false;
  await fs.writeFile(path.join(cache, download ? 'download-log.json' : 'offline-load-log.json'), JSON.stringify(reads, null, 2));
  return model;
}

if (process.argv.includes('--prepare')) {
  const voice = await loadVoice({download: true});
  const audio = await voice.generate('One small action. One real consequence.', {
    voice: 'af_heart',
    speed: 0.98,
  });
  await audio.save(path.join(cache, 'voice-check.wav'));
  console.log(`Offline voice ready. Sample length: ${audio.audio.length / audio.sampling_rate}s`);
}
