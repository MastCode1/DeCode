# DeCode — launch motion piece

A ~103 s, 1920×1080 / 30 fps motion-graphics film for DeCode. The structure,
pacing, and motion follow the reference launch video. The content is DeCode's:
it is set in a dark theme on decodeai.net's blue dot-matrix background.

Output: `dist/decode-motion-graphics.mp4`

## Story

| Time | Scene | What happens |
| --- | --- | --- |
| 0:00 | Feature picker | A menu of DeCode features (Chat, Writing, Learning, Web research, Code generation, Image generation, Real-time voice, Roblox Studio Assistant) expands, then collapses into one item: **DeCode, Everything in one workspace** ✓ |
| 0:06 | Introducing DeCode | Type-on headline |
| 0:09 | One AI workspace to think, code, research, and create. | |
| 0:14 | **Coming soon** | Large text, plus "The DeCode app is in development · decodeai.net" |
| 0:19 | Goes deeper when you need it to | *Pro* model: compound-interest question, "Starting thinking" → "Thinking" statuses, then the streamed answer with a table (figures verified) |
| 0:37 | Answers fast when you want it to | *Instant* model: a quick team note |
| 0:47 | Real-time is available in DeCode. | Text only, as requested |
| 0:52 | DeCode is great at coding | Asks for a focus timer in a single HTML file. The code streams in a DeCode code block, **Run** opens the HTML preview, and Start counts down. Two more single-file previews follow (Game of Life, analog clock). |
| 1:14 | Image Generation | Prompt → "Thinking" → the image appears in chat with "Here's your mountain lake at sunrise. Do you like it?" |
| 1:30 | Everything you need, decoded. → Coming soon to decodeai.net → DeCode wordmark → logo | |

## Accuracy notes

- **Feature list:** taken from decodeai.net (Text generation, Code generation,
  Roblox Studio Assistant (Beta), Writing, Learning, Web research, Real-time
  voice), plus Chat and Image generation.
- **Model names and descriptions:** *Instant*, *High*, and *Pro* match the
  pricing page.
- **Status labels:** "Starting thinking", "Thinking", and "Thought for N
  seconds" are the strings the DeCode app itself uses.
- **Coding:** DeCode writes code and previews it. It does not build multi-file
  projects, so the video shows exactly that: an HTML code block with
  Code/Run/Copy controls (modelled on the app's `.cb` component) and the Run
  preview. `src/apps.js` holds the timer program, and the video shows it
  verbatim. The preview runs that same file in an iframe. The montage
  programs are real, working files too.
- **Images:** the lake picture (`assets/generated-lake.png`) is an original
  procedural render (`tools/landscape.html`). It contains no stock photo.
- **Music:** an original score, synthesised in `music/compose.py`. It uses no
  samples and no third-party audio.
- **Background:** the same PixelBlast dither shader and settings as the site
  hero (`#3B82F6`, pattern scale 1.75, jitter .1, edge fade .18, ripples).

## Build

```bash
./build.sh            # frames -> out/frames.mp4, music -> out/music.wav, mux -> dist/
```

Preview in a browser by serving this folder and opening
`index.html?play`. Use `index.html?t=63.7` to jump to a moment.

Timing for every scene lives in `src/cues.json`. Both the animation and the
music read it, so a change there keeps picture and sound in sync. Key hits sit
on the 94 BPM grid that starts at `gridStart`.
