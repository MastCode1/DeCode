#!/usr/bin/env node
// Procedural soundtrack for the DeCode film, driven by the cue sheet that index.html exports.
// No samples: every sound is synthesised here, so it is deterministic and licence-free.
//
//   node score.mjs build/cues.json build/score.wav
//
// Harmonic arc: D minor while the idea is noise, resolving to D major when the mark is made.
import { readFile, writeFile } from 'node:fs/promises';

const [cuesPath = 'build/cues.json', outPath = 'build/score.wav'] = process.argv.slice(2);
const cues = JSON.parse(await readFile(cuesPath, 'utf8'));
const SR = 48000, DUR = cues.duration, N = Math.ceil(DUR * SR);
const dryL = new Float32Array(N), dryR = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);

let seed = 20261002;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mtof = m => 440 * 2 ** ((m - 69) / 12);
const db = d => 10 ** (d / 20);
const lerp = (a, b, u) => a + (b - a) * u;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = 2 * Math.PI;

/* ---------- mixing ---------- */
// Adds a mono buffer at time t, peak-normalised to `level` (dB), equal-power panned, with a reverb send.
function mix(buf, t, level, pan = 0, send = 0.25, panTo = pan) {
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (!peak) return;
  const g = db(level) / peak, i0 = Math.round(t * SR);
  for (let k = 0; k < buf.length; k++) {
    const i = i0 + k;
    if (i < 0 || i >= N) continue;
    const p = lerp(pan, panTo, k / buf.length), a = (p + 1) * Math.PI / 4;
    const v = buf[k] * g, l = v * Math.cos(a), r = v * Math.sin(a);
    dryL[i] += l; dryR[i] += r;
    sendL[i] += l * send; sendR[i] += r * send;
  }
}
const smoothEnv = (s, attack, dur, release) => {
  const a = attack > 0 ? 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, s / attack)) : 1;
  const r = release > 0 ? 0.5 - 0.5 * Math.cos(Math.PI * clamp((dur - s) / release, 0, 1)) : 1;
  return a * r;
};

/* ---------- voices (each returns a mono Float32Array) ---------- */
// sine with an exponential pitch glide and an exponential decay
function blip(f0, f1, dur, { attack = 0.002, decay = 5, glide = dur, harm = 0 } = {}) {
  const n = Math.round(dur * SR), b = new Float32Array(n);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR, f = f0 * (f1 / f0) ** Math.min(1, s / glide);
    ph += TAU * f / SR;
    b[k] = (Math.sin(ph) + harm * Math.sin(2 * ph)) * Math.min(1, s / attack) * Math.exp(-decay * s / dur);
  }
  return b;
}
// FM mallet / bell: bright attack that mellows quickly
function mallet(f, dur, { ratio = 3.5, index = 2.4, idxDecay = 16, decay = 4 } = {}) {
  const n = Math.round(dur * SR), b = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const s = k / SR;
    const mod = Math.sin(TAU * f * ratio * s) * index * Math.exp(-idxDecay * s);
    b[k] = Math.sin(TAU * f * s + mod) * Math.min(1, s / 0.002) * Math.exp(-decay * s / dur);
  }
  return b;
}
// white noise through a swept state-variable filter
function noise(dur, { f0 = 1000, f1 = f0, q = 1.2, mode = 'bp', attack = 0.005, release = dur * 0.7, hold = 1 } = {}) {
  const n = Math.round(dur * SR), b = new Float32Array(n), damp = 1 / q;
  let low = 0, band = 0, held = 0;
  for (let k = 0; k < n; k++) {
    const s = k / SR, fc = Math.min(f0 * (f1 / f0) ** (k / n), 7000), F = 2 * Math.sin(Math.PI * fc / SR);
    if (k % hold === 0) held = rnd() * 2 - 1; // hold > 1 gives a bit-crushed grain
    low += F * band;
    const high = held - low - damp * band;
    band += F * high;
    b[k] = (mode === 'bp' ? band : mode === 'hp' ? high : low) * smoothEnv(s, attack, dur, release);
  }
  return b;
}
// soft, detuned additive pad
function pad(notes, dur, { attack = 1.2, release = 1.4, bright = 0.45 } = {}) {
  const n = Math.round(dur * SR), L = new Float32Array(n), R = new Float32Array(n);
  for (const m of notes) {
    const f = mtof(m), weight = m < 48 ? 0.55 : 1;
    for (const [cents, pan] of [[-5, -0.7], [5, 0.7], [0, 0]]) {
      const fd = f * 2 ** (cents / 1200), a = (pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
      let ph = rnd() * TAU;
      const lfo = 0.15 + rnd() * 0.2, lph = rnd() * TAU;
      for (let k = 0; k < n; k++) {
        ph += TAU * fd / SR;
        let v = 0;
        for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / h ** (2.2 - bright);
        v *= weight * (0.85 + 0.15 * Math.sin(TAU * lfo * k / SR + lph)) * smoothEnv(k / SR, attack, dur, release);
        L[k] += v * gl; R[k] += v * gr;
      }
    }
  }
  return [L, R];
}
function mixStereo([L, R], t, level, send = 0.5) {
  let peak = 0;
  for (let k = 0; k < L.length; k++) peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
  const g = db(level) / peak, i0 = Math.round(t * SR);
  for (let k = 0; k < L.length; k++) {
    const i = i0 + k;
    if (i < 0 || i >= N) continue;
    dryL[i] += L[k] * g; dryR[i] += R[k] * g;
    sendL[i] += L[k] * g * send; sendR[i] += R[k] * g * send;
  }
}
const click = (t, level, pan = 0) => {
  mix(noise(0.006, { mode: 'hp', f0: 3500, attack: 0.0005, release: 0.005 }), t, level, pan, 0.1);
  mix(blip(2600 + rnd() * 600, 2000, 0.018), t, level - 6, pan, 0.1);
};
const swish = (t, dur, level, f0, f1, pan0, pan1, send = 0.35) =>
  mix(noise(dur, { f0, f1, q: 1.4, attack: dur * 0.45, release: dur * 0.55 }), t, level, pan0, send, pan1);
const grain = (t, level) => mix(noise(0.03 + rnd() * 0.05, { f0: 1200 + rnd() * 2400, q: 2, hold: 4 + ((rnd() * 10) | 0), attack: 0.001, release: 0.02 }), t, level, rnd() * 1.4 - 0.7, 0.2);

/* ---------- harmony bed ---------- */
const CHORDS = [
  [0.0, 4.75, [38, 50, 57, 64, 65], -25],         // Dm(add9): the noise
  [4.05, 8.75, [46, 53, 57, 62, 65], -25],        // Bbmaj7: decoding
  [8.0, 13.0, [41, 48, 57, 60, 64], -25],         // Fmaj7: chat
  [12.45, 17.0, [36, 48, 55, 62, 64], -25],       // Cadd9: code
  [16.45, 21.0, [43, 50, 57, 58, 62], -25],       // Gm9: research
  [20.45, 22.75, [45, 52, 57, 62, 64], -24],      // Asus4: build-up
  [22.3, DUR, [38, 45, 54, 57, 62, 64, 66], -22], // D(add9): made real
];
for (const [t0, t1, notes, level] of CHORDS) mixStereo(pad(notes, t1 - t0, { attack: t0 === 0 ? 2.2 : 1.0, release: 1.2 }), t0, level, 0.55);

/* ---------- 01 noise ---------- */
for (const t of cues.seed) click(t, -27, 0.25);
mix(noise(0.95, { f0: 380, f1: 3200, q: 1.1, attack: 0.012, release: 0.85 }), cues.burst, -15, -0.25, 0.5, 0.35);
mix(blip(84, 38, 0.6, { decay: 6 }), cues.burst, -19, 0, 0.15);
for (let i = 0; i < 26; i++) mix(blip(3000 + rnd() * 4200, 2600 + rnd() * 3000, 0.07 + rnd() * 0.16, { decay: 4 }), cues.burst + 0.05 + rnd() * 1.4, -33 - rnd() * 5, rnd() * 1.6 - 0.8, 0.6);
mix(noise(cues.converge + 1.1 - cues.burst, { f0: 1300, q: 0.9, attack: 1.2, release: 0.8 }), cues.burst, -37, 0.15, 0.25);
for (const t of cues.glitch) grain(t, -27);
for (let i = 0; i < 9; i++) grain(1.15 + rnd() * 1.0, -31);
mix(noise(1.15, { f0: 3800, f1: 520, q: 1.3, attack: 1.05, release: 0.06 }), cues.converge, -16, 0.45, 0.3, 0.2);
mix(blip(170, 92, 0.22, { decay: 5 }), cues.lock, -17, 0.2, 0.2);
click(cues.lock, -25, 0.2);

/* ---------- 02 decode: the prompt ---------- */
for (const t of cues.type) {
  mix(noise(0.005, { mode: 'hp', f0: 4200, attack: 0.0004, release: 0.004 }), t, -31 - rnd() * 3, 0.25 + rnd() * 0.15, 0.08);
  mix(blip(190 + rnd() * 70, 150, 0.03, { decay: 6 }), t, -33, 0.3, 0.05);
}
mix(blip(560, 1120, 0.13, { glide: 0.05, decay: 5 }), cues.send, -19, 0.35, 0.3);
click(cues.send, -24, 0.35);
swish(cues.open, 1.05, -21, 480, 2600, 0.3, 0, 0.45);

/* ---------- 03 chat ---------- */
cues.think.forEach((t, i) => mix(blip([880, 1108, 1318][i], [880, 1108, 1318][i], 0.08, { decay: 5 }), t, -31, -0.1, 0.4));
mix(blip(330, 290, 0.14, { decay: 5 }), cues.att, -25, 0, 0.3);
mix(noise(0.06, { f0: 1600, q: 1.5 }), cues.att, -30, 0, 0.2);
for (const t of cues.clicks) { click(t, -22, 0.35); click(t + 0.065, -27, 0.35); }
for (const t of cues.tabs) { swish(t - 0.02, 0.36, -22, 900, 2600, -0.35, 0.45); mix(blip(660, 640, 0.09), t + 0.05, -31, 0.2, 0.4); }

/* ---------- 04 code: every circle is a note ---------- */
cues.lines.forEach((t, i) => mix(blip(1150 + i * 35, 1100 + i * 35, 0.022), t, -35, -0.05, 0.1));
const DOT_NOTES = [69, 71, 74, 76, 78, 81, 83, 86, 88];
const DOT_PAN = [-0.15, -0.3, -0.15, 0.2, 0.2, 0.2, 0.55, 0.7, 0.55];
cues.dots.forEach((t, i) => mix(mallet(mtof(DOT_NOTES[i]), 1.1), t, -19, DOT_PAN[i], 0.45));

/* ---------- 05 research ---------- */
for (const t of cues.query) mix(noise(0.004, { mode: 'hp', f0: 4500, attack: 0.0004, release: 0.003 }), t, -34 - rnd() * 3, -0.2, 0.05);
mix(mallet(mtof(81), 0.9, { ratio: 2, index: 1.6 }), cues.status, -25, -0.1, 0.5);
mix(mallet(mtof(86), 1.2, { ratio: 2, index: 1.6 }), cues.status + 0.11, -24, -0.1, 0.5);
for (const t of cues.cards) { swish(t, 0.16, -29, 1500, 800, -0.3, -0.2, 0.2); mix(blip(440, 420, 0.07), t + 0.03, -33, -0.2, 0.3); }
cues.cites.forEach((t, i) => mix(mallet(mtof([88, 90, 93][i]), 0.7, { ratio: 2, index: 1.2 }), t, -29, 0.1, 0.5));

/* ---------- pulse under the product scenes ---------- */
for (let t = 8.45; t < 20.35; t += 0.5) {
  const accent = cues.tabs.some(x => Math.abs(x + 0.15 - t) < 0.26) ? 3 : 0;
  mix(blip(108, 52, 0.3, { glide: 0.1, decay: 6 }), t, -32 + accent, 0, 0.05);
  if (t > 12.6) mix(noise(0.03, { mode: 'hp', f0: 7000, attack: 0.001, release: 0.025 }), t + 0.25, -37, 0.25, 0.1);
}

/* ---------- 06 create: breathe in, melt, bloom ---------- */
swish(cues.move, 0.95, -23, 420, 1800, 0.35, 0, 0.4);
mix(noise(cues.bloom - cues.breath + 0.05, { f0: 500, f1: 5200, q: 1.1, attack: cues.bloom - cues.breath - 0.05, release: 0.08 }), cues.breath, -17, 0, 0.5);
mix(blip(mtof(57), mtof(69), cues.bloom - cues.breath, { attack: 1.4, decay: 0.3 }), cues.breath, -28, 0, 0.6);
[0.1, 0.22, 0.35, 0.48, 0.6, 0.72].forEach((dt, i) =>
  mix(blip(430 - i * 25 + rnd() * 40, 150 + rnd() * 30, 0.17, { decay: 5, harm: 0.3, glide: 0.12 }), cues.merge[0] + dt, -22, [-0.5, 0.5, -0.2, 0.2, -0.4, 0.4][i], 0.4));
mix(blip(78, 40, 1.6, { decay: 5.5 }), cues.bloom, -15, 0, 0.1);
for (const m of [62, 66, 69, 74, 78, 81]) mix(mallet(mtof(m), 3.2, { ratio: 2, index: 1.4, idxDecay: 8, decay: 3.2 }), cues.bloom + rnd() * 0.012, -23, rnd() * 1.2 - 0.6, 0.7);
mix(noise(1.4, { f0: 5600, f1: 3800, q: 0.9, attack: 0.004, release: 1.35 }), cues.bloom, -29, 0, 0.6);
for (let i = 0; i < 7; i++) grain(cues.bloom + 0.05 + i * 0.075, -33);

/* ---------- end lockup ---------- */
swish(cues.toLockup, 1.15, -25, 300, 1300, 0.4, -0.25, 0.45);
mix(noise(0.85, { f0: 2400, f1: 900, q: 1.2, attack: 0.3, release: 0.5 }), cues.wordmark, -30, -0.1, 0.5);
for (const t of cues.tagline) mix(blip(1900, 1800, 0.025), t, -37, 0, 0.3);
mix(mallet(mtof(86), 3.0, { ratio: 1.4, index: 2.2, idxDecay: 6, decay: 3.5 }), cues.cta, -20, 0.05, 0.7);
mix(mallet(mtof(81), 3.0, { ratio: 1.4, index: 1.8, idxDecay: 6, decay: 3.5 }), cues.cta + 0.09, -26, -0.1, 0.7);
for (const t of cues.blink) click(t, -29, -0.15);

/* ---------- reverb (Freeverb-style) ---------- */
function reverb(input, spread) {
  const k = SR / 44100, out = new Float32Array(N);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(d => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0, store: 0 }));
  const aps = [556, 441, 341, 225].map(d => ({ buf: new Float32Array(Math.round((d + spread) * k)), i: 0 }));
  const feedback = 0.84, damp = 0.32;
  // band-limit what feeds the tank (no low-end mud, no fizz): 2x one-pole HP at 180 Hz, one-pole LP at 6.5 kHz
  const ah = 1 / (1 + TAU * 180 / SR), al = 1 - Math.exp(-TAU * 6500 / SR);
  let h1 = 0, p1 = 0, h2 = 0, p2 = 0, lp = 0;
  for (let n = 0; n < N; n++) {
    h1 = ah * (h1 + input[n] - p1); p1 = input[n];
    h2 = ah * (h2 + h1 - p2); p2 = h1;
    lp += al * (h2 - lp);
    const x = lp * 0.015;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.store = o * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * feedback;
      if (++c.i >= c.buf.length) c.i = 0;
      y += o;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = y + b * 0.5;
      y = b - y;
      if (++a.i >= a.buf.length) a.i = 0;
    }
    out[n] = y;
  }
  return out;
}
const wetL = reverb(sendL, 0), wetR = reverb(sendR, 23);

/* ---------- master ---------- */
const L = new Float32Array(N), R = new Float32Array(N);
const hp = () => { let y = 0, px = 0; const a = 1 / (1 + TAU * 45 / SR); return x => (y = a * (y + x - px), px = x, y); };
const [hl1, hl2, hr1, hr2] = [hp(), hp(), hp(), hp()];
for (let n = 0; n < N; n++) {
  const t = n / SR, fade = Math.min(1, t / 0.05) * (t > DUR - 1.6 ? 0.5 - 0.5 * Math.cos(Math.PI * (DUR - t) / 1.6) : 1);
  const l = hl2(hl1(dryL[n] + wetL[n] * 3.2)), r = hr2(hr1(dryR[n] + wetR[n] * 3.2)); // rumble cut
  L[n] = Math.tanh(l * 1.1) * fade;
  R[n] = Math.tanh(r * 1.1) * fade;
}
let peak = 0;
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const gain = db(-1.5) / peak;

const data = Buffer.alloc(44 + N * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + N * 4, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  const dither = () => (rnd() - rnd()) / 32768;
  data.writeInt16LE(Math.round(clamp(L[n] * gain + dither(), -1, 1) * 32767), 44 + n * 4);
  data.writeInt16LE(Math.round(clamp(R[n] * gain + dither(), -1, 1) * 32767), 46 + n * 4);
}
await writeFile(outPath, data);
console.log(`${outPath}  ${DUR}s  peak-normalised (${(20 * Math.log10(gain)).toFixed(1)} dB)`);
