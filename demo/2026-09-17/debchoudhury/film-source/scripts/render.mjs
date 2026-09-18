import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.dirname(project);
const browserExecutable = process.env.FILM_BROWSER ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const mode = process.argv.includes('--stills') ? 'stills' : process.argv.includes('--sample') ? 'sample' : 'full';
const review = path.join(project, '.render-temp');
await fs.mkdir(review, {recursive: true});
const serveUrl = await bundle({
  entryPoint: path.join(project, 'src', 'index.tsx'),
  publicDir: path.join(project, 'public'),
  outDir: path.join(project, 'build'),
  enableCaching: true,
});
const browser = await openBrowser('chrome', {browserExecutable, logLevel: 'error'});
try {
  const composition = await selectComposition({
    serveUrl,
    id: 'AgentAirlock',
    browserExecutable,
    puppeteerInstance: browser,
  });
  if (composition.width !== 1920 || composition.height !== 1080 || composition.durationInFrames !== 3600) {
    throw new Error('The film must be exactly 120 seconds at 1920x1080.');
  }
  if (mode === 'stills') {
    const selected = process.argv.find((arg) => arg.startsWith('--frames='));
    const frames = selected
      ? selected.slice('--frames='.length).split(',').map(Number)
      : [90, 330, 630, 900, 1200, 1515, 1740, 2010, 2340, 2655, 2985, 3345, 3500];
    for (let i = 0; i < frames.length; i += 4) {
      await Promise.all(frames.slice(i, i + 4).map(async (frame) => {
        const destination = path.join(review, `frame-${String(frame).padStart(4, '0')}.png`);
        await renderStill({
          serveUrl, composition, browserExecutable, puppeteerInstance: browser,
          frame, imageFormat: 'png', output: destination, logLevel: 'error',
        });
        console.log(destination);
      }));
    }
  } else {
    let lastProgress = -1;
    const destination = mode === 'sample'
      ? path.join(review, 'motion-sample.mp4')
      : path.join(output, 'agent-airlock.mp4');
    await renderMedia({
      serveUrl, composition, browserExecutable, puppeteerInstance: browser,
      codec: 'h264', audioCodec: 'aac', pixelFormat: 'yuv420p',
      crf: 18, audioBitrate: '192k', sampleRate: 48000,
      imageFormat: 'jpeg', jpegQuality: 95,
      colorSpace: 'bt709', x264Preset: 'medium', concurrency: 4,
      outputLocation: destination,
      ...(mode === 'sample' ? {frameRange: [0, 149]} : {}),
      overwrite: true,
      logLevel: 'warn',
      metadata: {title: 'Before It Leaves | Agent Airlock', comment: 'Original animation. Local runtime evidence. Locally synthesized narration.'},
      onProgress: ({progress}) => {
        const step = Math.floor(progress * 100 / 5) * 5;
        if (step !== lastProgress) {
          lastProgress = step;
          console.log(`Render ${step}%`);
        }
      },
    });
    console.log(`Saved: ${destination}`);
  }
} finally {
  await browser.close({silent: true});
}
