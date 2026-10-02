#!/usr/bin/env node
// Procedural soundtrack for the DeCode launch film: no samples, no libraries.
// Ambient pad + bass + plucked arpeggio, with UI sound design (keys, clicks,
// sends, chimes, whooshes) placed on the cues exported by `render.mjs --cues`.
//
//   node video/render.mjs --cues video/out/cues.json
//   node video/soundtrack.mjs video/out/cues.json video/out/soundtrack.wav
import fs from 'node:fs';

const [, , cuesFile = 'video/out/cues.json', outFile = 'video/out/soundtrack.wav'] = process.argv;
const C = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
const SR = 48000;
const DUR = C.duration;
const N = Math.ceil(DUR * SR);
const TAU = Math.PI * 2;

// --- buses ---
const dryL = new Float32Array(N), dryR = new Float32Array(N);
const padL = new Float32Array(N), padR = new Float32Array(N);   // filtered later
const revIn = new Float32Array(N);                                // mono reverb send
const dlyL = new Float32Array(N), dlyR = new Float32Array(N);     // delay send

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(2026);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const S = t => Math.round(t * SR);
function add(bufL, bufR, i, v, pan = 0) { if (i < 0 || i >= N) return; bufL[i] += v * Math.cos((pan + 1) * Math.PI / 4); bufR[i] += v * Math.sin((pan + 1) * Math.PI / 4); }

// band-limited saw wavetable
const WT = 4096, SAW = new Float32Array(WT);
for (let h = 1; h <= 18; h++) for (let i = 0; i < WT; i++) SAW[i] += Math.sin(TAU * h * i / WT) / h * (h > 10 ? .5 : 1);
{ let m = 0; for (const v of SAW) m = Math.max(m, Math.abs(v)); for (let i = 0; i < WT; i++) SAW[i] /= m; }
const saw = ph => SAW[(ph * WT | 0) & (WT - 1)];

// ---------------- music ----------------
const BAR2 = 4.8; // two bars at 100 bpm; one chord each
const CHORDS = [
  { bass: 38, pad: [57, 61, 64, 66] }, // Dmaj9
  { bass: 35, pad: [57, 61, 62, 66] }, // Bm9
  { bass: 43, pad: [57, 59, 62, 66] }, // Gmaj9 (6/9)
  { bass: 45, pad: [57, 59, 62, 64] }, // Asus
];
const END_AT = C.cues.burst ?? DUR - 3;          // final chord starts with the logo burst
const regions = [];
for (let i = 0; i * BAR2 < END_AT - .5; i++) regions.push({ a: i * BAR2, b: Math.min((i + 1) * BAR2, END_AT), ch: CHORDS[i % 4] });
regions.push({ a: END_AT, b: DUR, ch: { bass: 38, pad: [57, 62, 64, 66, 69, 73] }, final: true });

// macro dynamics
const padLevel = t => smooth(0, 2.5, t) * (.55 + .45 * smooth(4, 6, t)) * (1 + .25 * smooth(END_AT - .5, END_AT + .5, t));
const cutoff = t => 520 + 900 * smooth(0, 5, t) + 700 * smooth(10, 14, t) + 600 * smooth(66, 72, t) - 300 * smooth(END_AT + 1.5, DUR, t);

for (const r of regions) {
  const ATT = r.final ? .35 : 1.4, REL = r.final ? .8 : 2.2;
  const a = S(Math.max(0, r.a - .15)), b = Math.min(N, S(r.b + REL));
  r.ch.pad.forEach((m, k) => {
    const f = mtof(m);
    for (const [det, pan] of [[-.07, -.7], [.07, .7], [0, 0]]) {
      let ph = R();
      const fr = f * Math.pow(2, det / 12);
      const lvl = (det === 0 ? .55 : 1) * .06;
      for (let i = a; i < b; i++) {
        const t = i / SR;
        const env = smooth(r.a - .15, r.a - .15 + ATT, t) * (1 - smooth(r.b, r.b + REL, t));
        if (env <= 0) continue;
        ph += fr * (1 + .0018 * Math.sin(TAU * (.21 + k * .05) * t + k)) / SR; ph -= Math.floor(ph);
        add(padL, padR, i, saw(ph) * env * lvl * padLevel(t), pan);
      }
    }
  });
  // bass (enters with "Introducing DeCode")
  if (r.a >= BAR2 - .01 || r.final) {
    const f = mtof(r.ch.bass - (r.final ? 12 : 0));
    let ph = 0;
    for (let i = S(r.a); i < Math.min(N, S(r.b + .6)); i++) {
      const t = i / SR, lt = t - r.a;
      const env = clamp(lt / .06) * (.4 + .6 * Math.exp(-lt / 1.1)) * (1 - smooth(r.b, r.b + .6, t)) * (r.final ? 1 - smooth(DUR - 2.5, DUR, t) : 1);
      ph += f / SR;
      const v = Math.tanh(1.6 * (Math.sin(TAU * ph) + .25 * Math.sin(TAU * ph * 2))) * .085 * env;
      add(dryL, dryR, i, v, 0);
    }
  }
}

// plucked arpeggio (from the first chapter to the logo)
function pluck(t0, m, amp, pan, opts = {}) {
  const f = mtof(m), dec = opts.dec ?? .32, len = dec * 6;
  const a = S(t0), b = Math.min(N, S(t0 + len));
  for (let i = Math.max(0, a); i < b; i++) {
    const lt = (i - a) / SR;
    const env = clamp(lt / .004) * Math.exp(-lt / dec);
    const mod = Math.sin(TAU * f * 2 * lt) * 1.4 * Math.exp(-lt / .08);
    const v = Math.sin(TAU * f * lt + mod) * env * amp;
    add(dryL, dryR, i, v, pan);
    dlyL[i] += v * .5 * (1 - pan) / 2; dlyR[i] += v * .5 * (1 + pan) / 2;
    revIn[i] += v * .35;
  }
}
{
  const start = C.tl.hThink[0], stop = END_AT - .3, step = .3;
  const PAT = [0, 2, 1, 3, 2, 4, 1, 3];
  for (let k = 0, t = start; t < stop; k++, t += step) {
    const r = regions.find(g => t >= g.a && t < g.b) || regions[0];
    const tones = [...r.ch.pad, ...r.ch.pad.map(m => m + 12)];
    const m = tones[PAT[k % 8] + (k % 16 >= 8 ? 2 : 0)] + 12;
    const inVoice = t > C.tl.voice[0] && t < C.tl.voice[1] ? .55 : 1;
    const swell = 1 + .35 * smooth(C.tl.brand[0], C.tl.brand[0] + 1, t);
    pluck(t, m, (k % 8 === 0 ? .05 : .034) * inVoice * swell * smooth(start, start + 2, t), k % 2 ? .45 : -.45);
  }
}

// ---------------- sound design ----------------
function noiseBurst(t0, len, amp, pan, hp = .9, lp = .3) {
  let prev = 0, y = 0;
  for (let i = Math.max(0, S(t0)), e = S(t0 + len); i < e && i < N; i++) {
    const lt = i / SR - t0;
    const n = R() * 2 - 1, h = n - prev * hp; prev = n;
    y += lp * (h - y);
    add(dryL, dryR, i, y * amp * clamp(lt / .0015) * Math.exp(-lt / (len / 4)), pan);
  }
}
function tone(t0, f, len, amp, pan = 0, rev = .3, f2 = f) {
  let ph = 0;
  for (let i = Math.max(0, S(t0)), e = S(t0 + len); i < e && i < N; i++) {
    const lt = i / SR - t0, k = lt / len;
    ph += (f + (f2 - f) * k) / SR;
    const v = Math.sin(TAU * ph) * amp * clamp(lt / .004) * Math.exp(-lt / (len / 5));
    add(dryL, dryR, i, v, pan); revIn[i] += v * rev;
  }
}
function bell(t0, m, amp, pan = 0) {
  const f = mtof(m);
  [[1, 1, 1.4], [2, .35, .9], [2.76, .22, .55], [5.4, .08, .3]].forEach(([r, a, d]) => {
    for (let i = Math.max(0, S(t0)), e = S(t0 + d * 5); i < e && i < N; i++) {
      const lt = i / SR - t0;
      const v = Math.sin(TAU * f * r * lt) * a * amp * clamp(lt / .003) * Math.exp(-lt / d);
      add(dryL, dryR, i, v, pan); revIn[i] += v * .6; dlyL[i] += v * .15; dlyR[i] += v * .15;
    }
  });
}
function whoosh(t0, len, amp, f0, f1, pan = 0) {
  // band-passed noise sweep (state-variable filter)
  let low = 0, band = 0;
  for (let i = Math.max(0, S(t0)), e = S(t0 + len); i < e && i < N; i++) {
    const k = clamp((i / SR - t0) / len);
    const fc = f0 * Math.pow(f1 / f0, k);
    const f = 2 * Math.sin(Math.PI * fc / SR);
    const n = R() * 2 - 1;
    const high = n - low - .55 * band; band += f * high; low += f * band;
    const env = Math.sin(Math.PI * Math.pow(k, .7)) ** 2;
    const v = band * env * amp;
    add(dryL, dryR, i, v, pan * (k * 2 - 1)); revIn[i] += v * .4;
  }
}
function boom(t0, amp) {
  let ph = 0;
  for (let i = S(t0), e = S(t0 + 2.2); i < e && i < N; i++) {
    const lt = i / SR - t0;
    ph += (46 + 30 * Math.exp(-lt / .08)) / SR;
    add(dryL, dryR, i, Math.sin(TAU * ph) * amp * clamp(lt / .01) * Math.exp(-lt / .55), 0);
  }
}

// keystrokes and code
for (const t of C.keys) { const a = .5 + R() * .5; noiseBurst(t, .025, .03 * a, (R() - .5) * .4, .9, .28); tone(t, 1800 + R() * 600, .016, .008 * a, 0, .05); }
for (const t of C.code) noiseBurst(t + R() * .006, .02, .012 * (.4 + R() * .6), (R() - .5) * .8, .95, .2);

// sends: soft rising pop
for (const k of ['send1', 'send2', 'send3', 'send4']) if (C.cues[k] != null) { tone(C.cues[k], 520, .12, .1, 0, .35, 900); noiseBurst(C.cues[k], .04, .03, 0); }
// mouse clicks
for (const k of ['click1', 'click2', 'click3']) if (C.cues[k] != null) { tone(C.cues[k], 1900, .02, .05, .2, .1); tone(C.cues[k] + .016, 1300, .02, .035, .2, .1); }
// scene transitions
for (const [name, [a]] of Object.entries(C.tl)) if (a > .5) whoosh(a - .25, .75, name.startsWith('h') ? .045 : .06, 260 + R() * 80, 2400 + R() * 900, R() > .5 ? .6 : -.6);
// UI moments
if (C.cues.morph != null) whoosh(C.cues.morph - .05, .8, .07, 180, 1800, 0);
if (C.cues.preview != null) whoosh(C.cues.preview - .1, .9, .06, 300, 3200, .7);
['milestone', 'success', 'notif'].forEach(k => { if (C.cues[k] != null) { bell(C.cues[k], 86, .055, .25); bell(C.cues[k] + .09, 93, .04, -.25); } });
for (let i = 0; i < 6; i++) if (C.cues['chip' + i] != null) bell(C.cues['chip' + i], [74, 76, 78, 81, 83, 86][i], .022, (i / 5 - .5) * 1.2);
if (C.cues.rewrite != null) [81, 85, 88, 93].forEach((m, i) => bell(C.cues.rewrite + i * .07, m, .025, (i - 1.5) * .3));
if (C.cues.select != null) whoosh(C.cues.select, .55, .03, 900, 3600, -.4);
// "Introducing DeCode"
boom(C.tl.intro[0] + .1, .32); bell(C.tl.intro[0] + .12, 74, .035);
// logo: riser into the burst, then the landing
if (C.cues.burst != null) {
  whoosh(C.cues.burst - 1.1, 1.25, .08, 200, 5000, 0);
  for (let i = 0; i < 18; i++) bell(C.cues.burst + .05 + i * .055 + R() * .03, [86, 88, 90, 93, 95, 98][i % 6], .012, (R() - .5) * 1.4);
}
if (C.cues.logo != null) { boom(C.cues.logo, .38); [62, 69, 74, 78, 81].forEach((m, i) => bell(C.cues.logo + i * .03, m + 12, .03, (i - 2) * .25)); }

// ---------------- mix ----------------
// pad bus -> state-variable low-pass with the macro cutoff
for (const [buf, damp] of [[padL, 1.3], [padR, 1.3]]) {
  let low = 0, band = 0, f = 0;
  for (let i = 0; i < N; i++) {
    if ((i & 31) === 0) f = 2 * Math.sin(Math.PI * cutoff(i / SR) / SR);
    const high = buf[i] - low - damp * band; band += f * high; low += f * band;
    buf[i] = low;
  }
}
for (let i = 0; i < N; i++) { dryL[i] += padL[i]; dryR[i] += padR[i]; revIn[i] += (padL[i] + padR[i]) * .3; }

// ping-pong delay, 3/16 at 100 bpm
{
  const D = S(.45), bl = new Float32Array(D), br = new Float32Array(D);
  let j = 0, lpL = 0, lpR = 0;
  for (let i = 0; i < N; i++) {
    const oL = bl[j], oR = br[j];
    lpL += .35 * (oL - lpL); lpR += .35 * (oR - lpR);
    bl[j] = dlyL[i] + lpR * .42; br[j] = dlyR[i] + lpL * .42;
    dryL[i] += oL * .55; dryR[i] += oR * .55;
    revIn[i] += (oL + oR) * .1;
    j = (j + 1) % D;
  }
}
// Freeverb-style reverb
{
  const sc = SR / 44100;
  const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], APS = [556, 441, 341, 225];
  for (const [out, spread] of [[dryL, 0], [dryR, 23]]) {
    const combs = COMBS.map(n => ({ b: new Float32Array(Math.round((n + spread) * sc)), i: 0, s: 0 }));
    const aps = APS.map(n => ({ b: new Float32Array(Math.round((n + spread) * sc)), i: 0 }));
    const fb = .86, damp = .3, wet = .3;
    for (let i = 0; i < N; i++) {
      const x = revIn[i] * .03;
      let acc = 0;
      for (const c of combs) { const o = c.b[c.i]; c.s = o * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * fb; if (++c.i >= c.b.length) c.i = 0; acc += o; }
      for (const a of aps) { const o = a.b[a.i]; const y = -acc + o; a.b[a.i] = acc + o * .5; if (++a.i >= a.b.length) a.i = 0; acc = y; }
      out[i] += acc * wet;
    }
  }
}
// master: DC block, soft clip, fades, normalise to -1 dBFS
let peak = 0;
{
  let xl = 0, yl = 0, xr = 0, yr = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let l = dryL[i], r = dryR[i];
    yl = l - xl + .9995 * yl; xl = l; yr = r - xr + .9995 * yr; xr = r;
    const g = smooth(0, .25, t) * (1 - smooth(DUR - .6, DUR - .02, t));
    l = Math.tanh(yl * 1.15) * g; r = Math.tanh(yr * 1.15) * g;
    dryL[i] = l; dryR[i] = r;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
}
const gain = .89 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8); pcm.write('fmt ', 12);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const d = () => (R() - R()) / 32768; // TPDF dither
  pcm.writeInt16LE(Math.round(clamp(dryL[i] * gain + d(), -1, 1) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(clamp(dryR[i] * gain + d(), -1, 1) * 32767), 46 + i * 4);
}
fs.writeFileSync(outFile, pcm);
console.log(`soundtrack: ${DUR.toFixed(2)}s, peak gain ${gain.toFixed(2)} -> ${outFile}`);
