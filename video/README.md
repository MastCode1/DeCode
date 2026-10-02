# DeCode launch film

An 80-second motion-graphics film for [decodeai.net](https://decodeai.net). It follows the
structure and motion style of the "Introducing GPT-5" film, rebuilt in DeCode's own brand: the dark
site theme, the `#93B2FF` accent, the dithered blue dot field, Geist type and the `<|>` blob mark.

Everything is hand-built in plain HTML, CSS, canvas and JavaScript. There are no plugins, no animation
libraries and no stock assets. The music and sound design are synthesised in code.

**Output:** `out/decode-launch.mp4` (1920×1080, 60 fps, H.264 + AAC, 79.9 s)

## The story

One maker takes their app, *Orbit*, from first thought to launch day. Each chapter hands its result
to the next, and the closing brand line names the four steps the viewer just watched.

| Time | Headline | What happens on screen |
|------|----------|------------------------|
| 0:00 | | A picker lists six separate tools ("one app for questions, another for building…"), then collapses into a single row: **DeCode, one workspace for all of it** ✓ |
| 0:05 | Introducing DeCode | |
| 0:08 | One place to take an idea / from first thought to launch day | |
| 0:12 | It starts with a question | The question is typed, then *Thinking → Mapping out four weeks → Planning the launch*, then a 4-week Gantt plan ending on a "Launch day" milestone |
| 0:26 | Then the plan becomes code | The composer morphs into an editor that writes `landing.tsx`. The live page slides in, and a visitor joins the waitlist |
| 0:39 | The web fills in the facts | Source chips fly in, and pricing stats count up (9/12 free plans, $4.99 monthly, $29.99 yearly) |
| 0:50 | Your words tell the story | The launch post is written, a sentence is selected, **Ask DeCode → "Make it warmer."**, and the sentence is rewritten |
| 1:01 | Then just say the word | Real-time voice: a living dot sphere. "Let's launch Orbit." → "Done. Orbit is live." |
| 1:10 | Think, code, research, and create / with DeCode. | |
| 1:13 | Try it at decodeai.net | |
| 1:16 | | The wordmark backspaces to "D", which bursts into the brand's dots, and the dots assemble into the DeCode mark |

## Files

| File | Purpose |
|------|---------|
| `decode-launch.html` | The composition. Every frame is a pure function of time: `window.seek(t)` |
| `render.mjs` | Renders frames in parallel with headless Chromium and encodes them with ffmpeg |
| `soundtrack.mjs` | Synthesises the score and sound effects from the film's own cues |
| `assets/decode-logo.png` | DeCode mark (from decodeai.net) |
| `assets/logo-points.js` | Dot targets for the logo assembly, sampled from the mark |
| `fonts/` | Geist Sans / Geist Mono (SIL OFL) |

## Preview

Serve the folder and open the page. It plays in real time, with a scrubber, and Space pauses:

```bash
npx serve video        # or: python3 -m http.server -d video
# open http://localhost:3000/decode-launch.html    (append ?t=26 to start at 0:26)
```

## Render

Requires Node 18+, ffmpeg and Playwright's Chromium.

```bash
node video/render.mjs --cues video/out/cues.json                       # 1. export sound cues
node video/soundtrack.mjs video/out/cues.json video/out/soundtrack.wav # 2. build the soundtrack
node video/render.mjs --audio video/out/soundtrack.wav                 # 3. render 60 fps + mux audio
```

Useful flags: `--fps 30` for drafts, `--workers N`, `--from 12 --to 28` for a range, and
`--stills 3,15.5,40` to save single PNG frames to `out/stills/`.

## Editing

- **Timing:** scene durations live in the `TL` block of `decode-launch.html`. Scenes overlap by 0.2 s
  so every cut is a crossfade. The total must stay at or under 80 s.
- **Copy:** headlines are the `headline(...)` calls. Prompts are the `Q_*` constants.
- **Brand:** colours are CSS variables on `:root` (`--accent`, `--bg`, …).
