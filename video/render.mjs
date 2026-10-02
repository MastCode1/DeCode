#!/usr/bin/env node
// Renders decode-launch.html frame by frame (headless Chromium) and encodes it with ffmpeg.
//
//   node video/render.mjs                         full film -> video/out/decode-launch.mp4
//   node video/render.mjs --fps 30 --workers 3    faster draft
//   node video/render.mjs --from 12 --to 28       render a time range only
//   node video/render.mjs --stills 3,15.5,40      save single frames as PNG (video/out/stills)
//   node video/render.mjs --audio path.wav        mux a soundtrack into the final file
//   node video/render.mjs --cues out/cues.json    export sound cues for soundtrack.mjs
//
// The page exposes window.seek(t); every frame is a pure function of t, so frames
// can be rendered out of order and in parallel.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const c of candidates) { try { return require(c); } catch { /* try next */ } }
  throw new Error('Playwright not found. Install it with: npm i -D playwright');
}
const { chromium } = loadPlaywright();

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const FPS = +(args.fps ?? 60);
const WORKERS = +(args.workers ?? 3);
const OUT_DIR = path.join(DIR, 'out');
const OUT = args.out ? path.resolve(args.out) : path.join(OUT_DIR, 'decode-launch.mp4');
fs.mkdirSync(OUT_DIR, { recursive: true });

// --- tiny static server so fonts and images load same-origin ---
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(DIR) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/decode-launch.html?render`;

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(URL_);
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}
async function grab({ page, cdp }, t) {
  await page.evaluate(t => window.seek(t), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

const probe = await openPage();
const DURATION = await probe.page.evaluate(() => window.DURATION);

if (args.cues) {
  // Scan the film at 120 Hz and record every keystroke / code burst plus the scenes' named cues.
  const keys = [], code = [];
  let prev = { typed: 0, code: 0 };
  for (let i = 0, n = Math.ceil(DURATION * 120); i <= n; i++) {
    const t = i / 120;
    const st = await probe.page.evaluate(t => { window.seek(t); return window.sfxState(); }, t);
    const dk = st.typed - prev.typed;
    for (let k = 0; k < dk && dk < 12; k++) keys.push(+(t - (k / Math.max(1, dk)) / 120).toFixed(4));
    if (st.code > prev.code) code.push(+t.toFixed(4));
    prev = st;
  }
  const out = { duration: DURATION, tl: await probe.page.evaluate(() => window.TL), cues: await probe.page.evaluate(() => window.CUES), keys, code };
  const file = typeof args.cues === 'string' ? path.resolve(args.cues) : path.join(OUT_DIR, 'cues.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`${keys.length} keystrokes, ${code.length} code ticks, ${Object.keys(out.cues).length} cues -> ${file}`);
  await browser.close(); server.close();
  process.exit(0);
}

if (args.stills) {
  const dir = path.join(OUT_DIR, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of String(args.stills).split(',').map(Number)) {
    const f = path.join(dir, `t${s.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, await grab(probe, s));
    console.log(f);
  }
  await browser.close(); server.close();
  process.exit(0);
}

const from = +(args.from ?? 0), to = Math.min(+(args.to ?? DURATION), DURATION);
const first = Math.round(from * FPS), last = Math.ceil(to * FPS); // [first, last)
const total = last - first;
console.log(`Rendering ${total} frames @ ${FPS}fps (${(total / FPS).toFixed(2)}s) with ${WORKERS} workers`);

function encoder(file) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', file],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
  return { ff, done };
}
const write = (ff, buf) => new Promise(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r));

let rendered = 0;
const started = Date.now();
const chunk = Math.ceil(total / WORKERS);
const segs = [];
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const a = first + w * chunk, b = Math.min(last, a + chunk);
  if (a >= b) return;
  const pg = w === 0 ? probe : await openPage();
  const file = path.join(OUT_DIR, `seg_${String(w).padStart(2, '0')}.mp4`);
  segs[w] = file;
  const { ff, done } = encoder(file);
  for (let f = a; f < b; f++) {
    await write(ff, await grab(pg, f / FPS));
    if (++rendered % 120 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`  ${rendered}/${total} frames  ${(rendered / el).toFixed(1)} fps  eta ${((total - rendered) / (rendered / el)).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await done;
}));
await browser.close(); server.close();

const list = path.join(OUT_DIR, 'segments.txt');
fs.writeFileSync(list, segs.filter(Boolean).map(f => `file '${f}'`).join('\n'));
const mux = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
if (args.audio) mux.push('-i', path.resolve(args.audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
mux.push('-c:v', 'copy', '-movflags', '+faststart', OUT);
await new Promise((res, rej) => spawn('ffmpeg', mux, { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('concat failed'))));
for (const f of segs.filter(Boolean)) fs.unlinkSync(f);
fs.unlinkSync(list);
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)}s -> ${OUT}`);
