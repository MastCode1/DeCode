// Synthesises the soundtrack (soft pad + pluck arpeggio + UI sound design) straight from the
// timeline cues that index.html exposes, so every key click and pop lands on its frame.
const SR = 48000;

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export function synthesize(cues, duration) {
  const N = Math.ceil((duration + .5) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const rand = mulberry(7);
  const add = (i, v, pan = 0) => { if (i >= 0 && i < N) { L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); } };

  const chime = cues.find(c => c.type === 'chime');
  const tEnd = chime ? chime.t : duration - 4;

  // ---- pad: Cmaj9 -> Am9 -> Fmaj9 -> G6, two bars each at 100 bpm ----
  const BAR = 2.4, CH = 2 * BAR;
  const chords = [
    [48, 55, 59, 62, 64],
    [45, 52, 55, 59, 60],
    [41, 48, 52, 55, 57],
    [43, 50, 55, 59, 62],
  ];
  const fadeOut = t => 1 - Math.min(1, Math.max(0, (t - (duration - 2.2)) / 2.2));
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const ci = Math.floor(t / CH), local = t - ci * CH;
    const resolved = t >= tEnd;
    const chord = resolved ? chords[0] : chords[ci % 4];
    const prevChord = chords[(ci + 3) % 4];
    const x = Math.min(1, local / 1.2);
    const fadeIn = Math.min(1, t / 2.5);
    let l = 0, r = 0;
    const voice = (notes, g) => {
      notes.forEach((n, k) => {
        const f = midi(n + 12 * (n < 50 ? 1 : 0));
        const ph = 2 * Math.PI * f * t;
        const s = Math.sin(ph * 1.0015) + Math.sin(ph * .9985) + .18 * Math.sin(2 * ph);
        const pan = (k / (notes.length - 1) - .5) * .6;
        l += s * g * (1 - pan); r += s * g * (1 + pan);
      });
    };
    voice(chord, x * .0105);
    if (!resolved && ci > 0) voice(prevChord, (1 - x) * .0105);
    const sub = Math.sin(2 * Math.PI * midi(chord[0] - 12) * t) * .045 * (resolved ? 1 : Math.min(1, local / .4));
    const g = fadeIn * fadeOut(t) * (.85 + .15 * Math.sin(t * .7));
    L[i] += (l + sub) * g; R[i] += (r + sub) * g;
  }

  // ---- pluck arpeggio on eighth notes, from the first headline until the logo lands ----
  const EIGHTH = .3, pattern = [0, 2, 4, 3, 1, 4, 2, 3];
  for (let s = 0, t = 5.2; t < tEnd - .1; s++, t = 5.2 + s * EIGHTH) {
    const chord = chords[Math.floor(t / CH) % 4];
    const n = chord[pattern[s % 8]] + 24 - (chord[pattern[s % 8]] > 58 ? 12 : 0);
    const f = midi(n), amp = .03 * Math.min(1, (t - 5.2) / 3) * (s % 2 ? .7 : 1) * (s % 8 === 0 ? 1.25 : 1);
    const pan = Math.sin(s * 1.7) * .35;
    const i0 = Math.round(t * SR);
    for (let j = 0; j < SR * .6; j++) {
      const tt = j / SR, env = Math.min(1, tt / .004) * Math.exp(-tt * 7.5);
      add(i0 + j, amp * env * (Math.sin(2 * Math.PI * f * tt) + .25 * Math.sin(4 * Math.PI * f * tt) * Math.exp(-tt * 14)), pan);
    }
  }

  // ---- UI sound design ----
  const noiseBurst = (t0, dur, amp, lp, pan = 0, shape = x => Math.exp(-x * 6)) => {
    let y = 0; const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
    for (let j = 0; j < n; j++) {
      const x = j / n, c = typeof lp === 'function' ? lp(x) : lp;
      y += c * ((rand() * 2 - 1) - y);
      add(i0 + j, y * amp * shape(x), pan);
    }
  };
  const tone = (t0, dur, f0, f1, amp, decay, pan = 0) => {
    const i0 = Math.round(t0 * SR), n = Math.round(dur * SR); let ph = 0;
    for (let j = 0; j < n; j++) {
      const x = j / n, f = f0 + (f1 - f0) * x; ph += 2 * Math.PI * f / SR;
      add(i0 + j, Math.sin(ph) * amp * Math.min(1, j / (SR * .002)) * Math.exp(-x * decay), pan);
    }
  };
  for (const c of cues) {
    const v = c.v ?? 1;
    switch (c.type) {
      case 'key': {
        const pan = (rand() - .5) * .3;
        noiseBurst(c.t, .022, .07 * v, .55, pan, x => Math.exp(-x * 9));
        tone(c.t, .03, 2300 + rand() * 500, 1800, .012 * v, 7, pan);
        break;
      }
      case 'send': tone(c.t, .12, 520, 880, .07, 5); noiseBurst(c.t, .03, .05, .5); break;
      case 'click': noiseBurst(c.t, .015, .09, .6, 0, x => Math.exp(-x * 8)); tone(c.t, .05, 1500, 1100, .03, 6); break;
      case 'pop': tone(c.t, .09, 700, 1100, .045 * v, 5, (rand() - .5) * .5); break;
      case 'tick': tone(c.t, .07, 1760, 1760, .04 * v, 6); tone(c.t + .002, .09, 2637, 2637, .015 * v, 7); break;
      case 'swoosh': noiseBurst(c.t - .05, .55, .05 * v, x => .02 + .2 * Math.sin(x * Math.PI), 0, x => Math.sin(x * Math.PI) ** 2); break;
      case 'collapse': noiseBurst(c.t, .5, .05 * v, x => .25 - .2 * x, 0, x => Math.sin(x * Math.PI) ** 2); tone(c.t, .45, 900, 380, .025 * v, 3); break;
      case 'rise': noiseBurst(c.t, 1.4, .045, x => .01 + .25 * x * x, 0, x => Math.pow(x, 1.6) * (1 - Math.pow(x, 12))); break;
      case 'chime': {
        [[76, .055], [83, .04], [88, .03], [64, .05]].forEach(([n, a], k) => {
          const f = midi(n), i0 = Math.round((c.t + k * .012) * SR);
          for (let j = 0; j < SR * 3.5; j++) {
            const tt = j / SR, env = Math.min(1, tt / .003) * Math.exp(-tt * 1.3);
            add(i0 + j, a * env * (Math.sin(2 * Math.PI * f * tt) + .3 * Math.sin(2 * Math.PI * f * 2.76 * tt) * Math.exp(-tt * 3)), (k - 1.5) * .2);
          }
        });
        break;
      }
    }
  }

  // ---- master: gentle saturation, 16-bit stereo WAV ----
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(Math.round(Math.tanh(L[i] * 3.2) * .89 * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.tanh(R[i] * 3.2) * .89 * 32767), 46 + i * 4);
  }
  return buf;
}
