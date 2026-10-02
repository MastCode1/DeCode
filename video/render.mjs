// Frame-accurate renderer: loads index.html in headless Chromium, seeks each
// frame on the video clock and pipes PNG screenshots into ffmpeg.
//   node render.mjs [out.mp4] [--from S] [--to S] [--fps N] [--stills t1,t2,...]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : path.join(dir, 'out', 'frames.mp4');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(dir)) throw new Error('outside');
    const body = await readFile(p.endsWith('/') ? p + 'index.html' : p);
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('page:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); process.exit(1); }
const dur = await page.evaluate(() => window.__duration);
const fps = +opt('--fps', await page.evaluate(() => window.__fps));

const stills = opt('--stills');
if (stills) {
  const sdir = opt('--dir', path.join(dir, 'out', 'stills'));
  await mkdir(sdir, { recursive: true });
  for (const s of stills.split(',')) {
    await page.evaluate(t => window.__seek(t), +s);
    await page.screenshot({ path: path.join(sdir, `t${(+s).toFixed(2).padStart(6, '0')}.png`) });
  }
  await browser.close(); server.close();
  process.exit(0);
}

const from = +opt('--from', 0), to = Math.min(+opt('--to', dur), dur);
const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
await mkdir(path.dirname(out), { recursive: true });
// JPEG q98 frames: PNG encoding was 4x slower and the result is re-encoded to
// 4:2:0 H.264 anyway
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'animation', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = f0; f < f1; f++) {
  await page.evaluate(t => window.__seek(t), f / fps);
  const img = await page.screenshot({ type: 'jpeg', quality: 98 });
  if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
  if ((f - f0) % 150 === 0) console.log(`frame ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close(); server.close();
console.log('wrote', out, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
