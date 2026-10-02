// Renders index.html frame by frame with headless Chromium and encodes it with ffmpeg.
//
//   node render.mjs                         -> out/decode-intro-dark.mp4 (60 fps, with soundtrack)
//   node render.mjs --theme light           -> out/decode-intro-light.mp4
//   node render.mjs --stills 3,12.5,40      -> out/stills/<theme>-<t>.png
//   node render.mjs --fps 30 --workers 2 --no-audio
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { synthesize } from './audio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(join(globalRoot, 'playwright'));
}
const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i < 0 ? def : args[i + 1]; };
const flag = name => args.includes('--' + name);
const theme = opt('theme', 'dark');
const fps = +opt('fps', 60);
const workers = +opt('workers', 4);
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(join(here, 'index.html')).href + `?render=1&theme=${theme}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
  await page.goto(url);
  await page.evaluate(() => window.__ready);
  return page;
}

function run(cmd, argv, input) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
    p.on('exit', c => c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`)));
    if (input) input(p.stdin);
  });
}

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });

if (opt('stills')) {
  const dir = join(outDir, 'stills');
  mkdirSync(dir, { recursive: true });
  const page = await openPage(browser);
  for (const t of opt('stills').split(',').map(Number)) {
    await page.evaluate(t => window.__render(t), t);
    await page.screenshot({ path: join(dir, `${theme}-${t.toFixed(2)}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const probe = await openPage(browser);
const duration = await probe.evaluate(() => window.__duration);
const cues = await probe.evaluate(() => window.__cues);
await probe.close();
const total = Math.round(duration * fps);
console.log(`${theme}: ${duration.toFixed(2)}s, ${total} frames @ ${fps}fps, ${workers} workers`);

const tmp = join(outDir, `.parts-${theme}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const per = Math.ceil(total / workers);
const started = Date.now();
let done = 0;

await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const from = w * per, to = Math.min(total, from + per);
  if (from >= to) return;
  const page = await openPage(browser);
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), join(tmp, `p${w}.mp4`)], async stdin => {
    for (let f = from; f < to; f++) {
      await page.evaluate(t => window.__render(t), f / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
      if (++done % 300 === 0) console.log(`  ${done}/${total} frames (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
    stdin.end();
  });
  await page.close();
}));
await browser.close();

const list = join(tmp, 'list.txt');
writeFileSync(list, Array.from({ length: workers }, (_, w) => `file 'p${w}.mp4'`).filter((_, w) => w * per < total).join('\n'));
const silent = join(tmp, 'video.mp4');
await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

const out = join(outDir, `decode-intro-${theme}.mp4`);
if (flag('no-audio')) {
  await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-c', 'copy', '-movflags', '+faststart', out]);
} else {
  const wav = join(tmp, 'audio.wav');
  writeFileSync(wav, synthesize(cues, duration));
  await run('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
