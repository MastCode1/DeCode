// Renders tools/landscape.html to assets/generated-lake.png
// usage: node render-landscape.mjs [width] [height] [out]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const W = +(process.argv[2] || 2304), H = +(process.argv[3] || 1536);
const out = process.argv[4] || path.join(dir, '..', 'assets', 'generated-lake.png');
const STRIP = 32;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader-webgl'] });
const page = await browser.newPage();
page.on('console', m => console.log('page:', m.text()));
await page.goto('file://' + path.join(dir, 'landscape.html'));
const t0 = Date.now();
const strips = await page.evaluate(([w, h, s]) => window.renderLandscape(w, h, s), [W, H, STRIP]);
console.log('render ms', Date.now() - t0);
await browser.close();
const raw = Buffer.concat(strips.map(b => Buffer.from(b, 'base64')));
const tmp = out + '.rgba';
writeFileSync(tmp, raw.subarray(0, W * H * 4));
const outW = Math.round(W / 1.5), outH = Math.round(H / 1.5);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', tmp,
  '-vf', `vflip,scale=${outW}:${outH}:flags=lanczos`, '-frames:v', '1', out]);
execFileSync('rm', [tmp]);
console.log('wrote', out);
