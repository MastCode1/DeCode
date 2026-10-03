"""Original score for the DeCode motion piece.

Synthesised from scratch with numpy (no samples, no third-party audio):
soft pad, plucked arpeggios, sub bass, light drums, risers and impacts.
94 BPM in A minor / C major. Section changes and hits are driven by the
same cues.json the animation uses, so the music lands on the picture.

    python3 music/compose.py out/music.wav
"""
import json
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, '..', 'src', 'cues.json')))
DUR = C['duration']
N = int((DUR + 0.5) * SR)
BEAT = 60.0 / C['bpm']
BAR = 4 * BEAT
G0 = C['gridStart']
rng = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def stereo():
    return np.zeros((N, 2))


def add(buf, start, sig, pan=0.0, gain=1.0):
    """Mix mono or stereo `sig` into `buf` at time `start` (equal-power pan)."""
    i = int(round(start * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        a = np.pi / 4 * (pan + 1)
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * np.sqrt(2)
    j = min(N, i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
    buf[i:j] += sig[: j - i] * gain


def automation(points):
    """Piecewise-linear gain curve from [(t, g), ...]."""
    t = np.arange(N) / SR
    ts, gs = zip(*points)
    return np.interp(t, ts, gs)[:, None]


def in_ranges(t, ranges):
    return any(a <= t < b for a, b in ranges)


# ---------------------------------------------------------------- harmony
#            bass   pad voicing               arp tones
CHORDS = {
    'Am9':   (45, [60, 64, 67, 71], [69, 72, 76, 79, 83]),
    'Fmaj9': (41, [57, 60, 64, 67], [65, 69, 72, 76, 79]),
    'Cadd9': (48, [55, 60, 62, 64], [67, 72, 74, 76, 79]),
    'G6/B':  (47, [55, 59, 62, 64], [67, 71, 74, 76, 79]),
    'Cmaj9': (36, [59, 62, 64, 67, 71], [72, 76, 79, 83, 86]),
}
PROG = ['Am9', 'Fmaj9', 'Cadd9', 'G6/B']
LOGO = C['end3']['logo']


def chord_at(t):
    if t >= LOGO:
        return 'Cmaj9'
    if t < G0:
        return 'Am9'
    return PROG[int((t - G0) // BAR) % 4]


# ---------------------------------------------------------------- voices
def env_adsr(n, a, d, s, r, total):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    e = np.where(t >= a + d, s, e)
    rel = np.clip((t - (total - r)) / max(r, 1e-4), 0, 1)
    return e * (1 - rel)


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    ph = (freq * t + phase) % 1.0
    # polyBLEP-free but gently low-passed later; fine for a soft pad
    return 2 * ph - 1


def pad_note(m, dur):
    n = int(dur * SR)
    f = mtof(m)
    v = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-8, 0, 7)) / 3
    v += 0.25 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    return v * env_adsr(n, 0.9, 0.5, 0.8, 1.4, dur)


def pluck(m, vel, dur=1.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    mod = 1.1 * np.exp(-t * 14) * np.sin(2 * np.pi * 2 * f * t)
    y = np.sin(2 * np.pi * f * t + mod) + 0.22 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 18)
    e = np.exp(-t * 5.5) * (1 - np.exp(-t * 900))
    return y * e * vel


def bell(m, vel=1.0, dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    y = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t * 2.2) * np.sin(2 * np.pi * 3.5 * f * t))
    y += 0.35 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t * 3)
    return y * np.exp(-t * 1.3) * (1 - np.exp(-t * 600)) * vel


def bass_note(m, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    y = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(2 * np.pi * 2 * f * t) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    y = np.tanh(1.6 * y) / np.tanh(1.6)
    return y * env_adsr(n, 0.006, 0.25, 0.75, 0.07, dur) * vel


def kick(vel=1.0):
    n = int(0.55 * SR)
    t = np.arange(n) / SR
    f = 54 + 115 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 6.5)
    y[: int(0.004 * SR)] += rng.standard_normal(int(0.004 * SR)) * 0.25
    return np.tanh(1.4 * y) * vel


def clap(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    b, a = signal.butter(2, [900 / (SR / 2), 4200 / (SR / 2)], 'band')
    noise = signal.lfilter(b, a, noise)
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        tt = t - off
        e += np.where(tt >= 0, np.exp(-np.clip(tt, 0, None) * (110 if k < 2 else 16)), 0)
    return noise * e * 0.6 * vel


def hat(vel=1.0, open_=False):
    n = int((0.35 if open_ else 0.09) * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    b, a = signal.butter(2, 7500 / (SR / 2), 'high')
    noise = signal.lfilter(b, a, noise)
    return noise * np.exp(-t * (14 if open_ else 70)) * 0.35 * vel


def riser(dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # sweep a band-pass upward in blocks
    blk = 1024
    zi = None
    for i in range(0, n, blk):
        fc = 300 + 7000 * (k[i] ** 2)
        b, a = signal.butter(2, [fc * 0.7 / (SR / 2), min(fc * 1.4, SR / 2 - 100) / (SR / 2)], 'band')
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        seg, zi = signal.lfilter(b, a, noise[i:i + blk], zi=zi)
        out[i:i + blk] = seg
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * k)) / SR) * 0.15
    return (out * 0.8 + tone) * (k ** 2.2) * vel


def impact(vel=1.0, dur=3.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 32 + 40 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    noise = rng.standard_normal(n)
    b, a = signal.butter(2, 900 / (SR / 2), 'low')
    noise = signal.lfilter(b, a, noise) * np.exp(-t * 4) * 0.5
    return np.tanh(1.3 * (boom + noise)) * vel


def click(vel=1.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 160) + 0.4 * rng.standard_normal(n) * np.exp(-t * 400)
    return y * 0.35 * vel


def reverb_ir(seconds=2.8, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t * 2.4)[:, None]
    b, a = signal.butter(1, 5000 / (SR / 2), 'low')
    ir = signal.lfilter(b, a, ir, axis=0)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0))


def convolve_stereo(x, ir):
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)


def delay(x, time, fb=0.35, mix=0.3):
    d = int(time * SR)
    out = x.copy()
    tap = x.copy()
    for k in range(1, 6):
        shifted = np.zeros_like(x)
        shifted[d * k:] = tap[: N - d * k] if d * k < N else 0
        # ping-pong
        if k % 2:
            shifted = shifted[:, ::-1]
        out += shifted * (fb ** k) * mix / fb
    return out


# ---------------------------------------------------------------- arrangement
cue = C
deep, fast, code, img = cue['deep'], cue['fast'], cue['code'], cue['img']
DRUMS = [(cue['intro']['start'], deep['send'] + 0.2), (deep['chat'], cue['realtime']['start']),
         (cue['codeTitle']['start'], img['send'] + 0.2), (img['reveal'], LOGO - 0.05)]
CLAP = [(cue['fastTitle']['start'], cue['realtime']['start']),
        (code['chat'], cue['imgTitle']['start']), (cue['end1']['start'], LOGO - 0.05)]
HAT16 = [(fast['appear'], cue['realtime']['start']), (code['montage'], code['out'] + 0.4),
         (cue['end2']['start'], LOGO - 0.05)]

pad = stereo()
arp = stereo()
bass = stereo()
drums = stereo()
fx = stereo()

# pad: one chord per bar (plus the intro chord before the grid starts)
bar_starts = [0.0] + [G0 + k * BAR for k in range(int((LOGO - G0) // BAR) + 1)]
bar_starts = [b for b in bar_starts if b < LOGO]
for i, b0 in enumerate(bar_starts):
    b1 = bar_starts[i + 1] if i + 1 < len(bar_starts) else LOGO
    _, voicing, _ = CHORDS[chord_at(b0 + 0.01)]
    for j, m in enumerate(voicing):
        add(pad, b0, pad_note(m, b1 - b0 + 1.2), pan=(-0.5 + j / max(1, len(voicing) - 1)) * 0.7, gain=0.22)
# final chord rings out under the logo
_, voicing, _ = CHORDS['Cmaj9']
for j, m in enumerate(voicing + [48]):
    add(pad, LOGO, pad_note(m, DUR - LOGO + 0.4), pan=(-0.6 + j * 0.25), gain=0.19)

# arps: 8th-note pattern over chord tones
PATTERN = [0, 2, 4, 3, 1, 3, 2, 4]
k = 0
t = G0
while t < LOGO - 0.01:
    _, _, tones = CHORDS[chord_at(t + 0.01)]
    step = k % 8
    m = tones[PATTERN[step]]
    vel = 0.55 if step % 2 else 0.8
    if t < cue['intro']['start']:
        vel *= 0.55
    add(arp, t, pluck(m, vel), pan=0.35 if step % 2 else -0.25, gain=0.34)
    # sparkle octave during high-energy passages
    if in_ranges(t, HAT16) and step in (2, 6):
        add(arp, t + BEAT / 4, pluck(m + 12, 0.35), pan=0.6, gain=0.24)
    k += 1
    t = G0 + k * BEAT / 2

# drums + bass on the beat grid
beat = 0
while True:
    tb = G0 + beat * BEAT
    if tb >= LOGO - 0.01:
        break
    pos = beat % 4
    if in_ranges(tb, DRUMS):
        if pos in (0, 2):
            add(drums, tb, kick(1.0 if pos == 0 else 0.85), gain=0.6)
        if pos == 3 and (beat // 4) % 2 == 1:
            add(drums, tb + BEAT / 2, kick(0.5), gain=0.6)
        for h8 in range(2):
            add(drums, tb + h8 * BEAT / 2, hat(0.9 if h8 else 0.55), pan=0.25, gain=0.8)
        if in_ranges(tb, HAT16):
            for h16 in (1, 3):
                add(drums, tb + h16 * BEAT / 4, hat(0.4), pan=-0.2, gain=0.8)
        if in_ranges(tb, CLAP) and pos in (1, 3):
            add(drums, tb, clap(), pan=0.05, gain=0.75)
        root, _, _ = CHORDS[chord_at(tb + 0.01)]
        if pos == 0:
            add(bass, tb, bass_note(root, BEAT * 1.5), gain=0.26)
        elif pos == 2:
            add(bass, tb + BEAT / 2, bass_note(root, BEAT * 0.45, 0.8), gain=0.26)
        elif pos == 3:
            add(bass, tb + BEAT / 2, bass_note(root + 12 if root < 45 else root, BEAT * 0.4, 0.6), gain=0.26)
    beat += 1

# risers into the big moments, impacts on them
for hit, rdur, big in [(cue['intro']['start'], 1.6, 0.7),
                       (cue['codeTitle']['start'], 1.5, 0.6), (img['reveal'], 2.2, 0.75), (LOGO, 2.4, 1.0)]:
    add(fx, hit - rdur, riser(rdur, 0.5 * big), gain=0.55)
    add(fx, hit, impact(big), gain=0.5)

# bells on reveals / selections
for tt, m, v in [(cue['picker']['select'], 84, 0.5), (cue['realtime']['start'], 79, 0.55),
                 (cue['realtime']['start'] + BEAT * 1.5, 83, 0.35), (img['reveal'], 84, 0.45), (LOGO, 72, 0.55), (LOGO, 79, 0.4)]:
    add(fx, tt, bell(m, v), pan=0.15, gain=0.3)

# soft UI clicks: send buttons, Run, Start
for tt in [deep['send'], fast['send'], cue['web']['send'], code['send'], img['send'], code['run'], code['start']]:
    add(fx, tt, click(), pan=0.1, gain=0.5)

# ---------------------------------------------------------------- dynamics
dip = lambda a, b, low, ramp=0.4: [(a, 1.0), (a + ramp, low), (b - ramp, low), (b, 1.0)]
pad_g = automation([(0, 0.0), (2.5, 0.75), (cue['intro']['start'], 0.9), (cue['intro']['start'] + 0.5, 0.7)]
                   + dip(cue['realtime']['start'], cue['codeTitle']['start'], 1.1)[1:3]
                   + [(cue['codeTitle']['start'], 0.7), (LOGO, 0.75), (LOGO + 0.3, 1.0), (DUR - 2.2, 0.75), (DUR, 0.0)])
arp_g = automation([(0, 0.7), (deep['send'], 1.0), (deep['send'] + 0.4, 0.55), (deep['chat'] - 0.3, 0.55), (deep['chat'], 1.0),
                    (cue['realtime']['start'], 0.6), (cue['codeTitle']['start'], 1.0), (img['send'], 1.0),
                    (img['send'] + 0.4, 0.6), (img['reveal'], 1.0), (LOGO, 1.0), (DUR, 0.0)])

# sidechain-style pump from the kick pattern
duck = np.ones(N)
beat = 0
while G0 + beat * BEAT < LOGO:
    tb = G0 + beat * BEAT
    if in_ranges(tb, DRUMS) and beat % 4 in (0, 2):
        i = int(tb * SR)
        n = min(N - i, int(0.5 * SR))
        duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.45 * np.exp(-np.arange(n) / SR * 9))
    beat += 1
duck = duck[:, None]

b, a = signal.butter(2, 2400 / (SR / 2), 'low')
pad = signal.lfilter(b, a, pad, axis=0)
arp = delay(arp, BEAT * 0.75, fb=0.33, mix=0.28)

ir = reverb_ir()
wet = convolve_stereo(pad * 0.5 + arp * 0.6 + fx * 0.4, ir)
mix = pad * pad_g * duck + arp * arp_g + bass * duck + drums + fx + wet * 0.38
mix *= automation([(0, 1.0), (DUR - 2.0, 1.0), (DUR, 0.0)])

# clean up the sub region, then gentle bus compression + soft clip
hb, ha = signal.butter(2, 38 / (SR / 2), 'high')
mix = signal.lfilter(hb, ha, mix, axis=0)
lb, la = signal.butter(1, 140 / (SR / 2), 'low')
mix = mix - 0.25 * signal.lfilter(lb, la, mix, axis=0)

mix = np.tanh(mix * 1.25) / 1.25
rms = np.sqrt(np.mean(mix ** 2))
mix *= 10 ** (-16.4 / 20) / rms
peak = np.abs(mix).max()
if peak > 0.94:
    mix = np.tanh(mix / 0.94 * 1.2) / np.tanh(1.2) * 0.94
mix = mix[: int(DUR * SR)]

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'out', 'music.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', out, f'{len(mix) / SR:.2f}s', 'rms dBFS', round(20 * np.log10(np.sqrt(np.mean(mix ** 2))), 1))
