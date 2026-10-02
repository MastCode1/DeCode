#!/usr/bin/env node
// Frame-accurate render of index.html: headless Chromium seeks the timeline frame by frame,
// ffmpeg encodes the PNG stream (H.264, CRF 18), then the generated score is muxed in.
//
//   node render.mjs                       full film -> out/decode-brand-film.mp4
//   node render.mjs --stills 2,10.5,22.6  PNG stills -> build/stills/
//   node render.mjs --from 20 --to 24     render a slice (silent)
//   node render.mjs --no-audio            skip the soundtrack
//   node render.mjs --cues                write build/cues.json only (then: node score.mjs)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  const server = createServer(async (req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function run(cmd, args, capture = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', capture ? 'pipe' : 'inherit'] });
    let err = '';
    if (capture) p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(err) : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

const server = await serve();
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--hide-scrollbars', '--disable-lcd-text'] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page]', e.message));
  page.on('console', m => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render`);
  await page.evaluate(() => window.__ready);
  const info = await page.evaluate(() => window.__info);
  const cdp = await page.context().newCDPSession(page);
  const frameAt = async t => {
    await page.evaluate(time => new Promise(r => { window.__seek(time); requestAnimationFrame(() => r()); }), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  };

  const stills = opt('stills');
  if (opt('cues')) {
    await mkdir(path.join(root, 'build'), { recursive: true });
    await writeFile(path.join(root, 'build', 'cues.json'), JSON.stringify(await page.evaluate(() => window.__cues()), null, 2));
    console.log(path.join(root, 'build', 'cues.json'));
  } else if (stills) {
    const dir = path.join(root, 'build', 'stills');
    await mkdir(dir, { recursive: true });
    for (const t of String(stills).split(',').map(Number)) {
      const file = path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      await writeFile(file, await frameAt(t));
      console.log(file);
    }
  } else {
    const fps = Number(opt('fps') ?? info.fps);
    const from = Number(opt('from') ?? 0), to = Number(opt('to') ?? info.duration);
    const slice = from !== 0 || to !== info.duration;
    const withAudio = !opt('no-audio') && !slice;
    const out = path.resolve(root, String(opt('out') ?? (slice ? `build/slice-${from}-${to}.mp4` : 'out/decode-brand-film.mp4')));
    const silent = path.join(root, 'build', 'video.mp4');
    await mkdir(path.dirname(out), { recursive: true });
    await mkdir(path.join(root, 'build'), { recursive: true });

    const ff = spawn('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-x264-params', 'aq-mode=3',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', withAudio ? silent : out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = once(ff, 'close');

    const total = Math.round((to - from) * fps), started = Date.now();
    for (let f = 0; f < total; f++) {
      const buf = await frameAt(from + f / fps);
      if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
      if (f % 60 === 59 || f === total - 1) {
        const el = (Date.now() - started) / 1000, eta = el / (f + 1) * (total - f - 1);
        process.stdout.write(`\rframe ${f + 1}/${total}  ${el.toFixed(0)}s elapsed  ~${eta.toFixed(0)}s left   `);
      }
    }
    ff.stdin.end();
    const [code] = await done;
    process.stdout.write('\n');
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);

    if (withAudio) {
      const cuesFile = path.join(root, 'build', 'cues.json'), wav = path.join(root, 'build', 'score.wav');
      await writeFile(cuesFile, JSON.stringify(await page.evaluate(() => window.__cues()), null, 2));
      await run(process.execPath, [path.join(root, 'score.mjs'), cuesFile, wav]);
      // two-pass loudness normalisation to -16 LUFS / -1.5 dBTP (web video level)
      const target = 'I=-16:TP=-1.5:LRA=11';
      const log = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], true);
      const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
      const norm = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', wav,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', norm, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
    }
    console.log(out);
  }
} finally {
  await browser.close();
  server.close();
}
