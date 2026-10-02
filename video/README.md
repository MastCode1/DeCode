# DeCode brand film

A 29-second, 1920×1080 at 60 fps motion piece for [decodeai.net](https://decodeai.net), with a synthesized soundtrack.
Final render: [`out/decode-brand-film.mp4`](out/decode-brand-film.mp4).

## The story

One idea travels from noise to a finished mark. Every headline continues the sentence before it, so
the six chapters read as a single line:

> Every idea starts as noise. Until you decode it. Talk it through. Shape it in code. Back it with research. Then make it real. **DeCode.**

| Time | Chapter | Headline | What happens | Into the next scene |
| --- | --- | --- | --- | --- |
| 0.0–4.3 | 01 Noise | Every idea starts as *noise.* | A caret dot blinks, then bursts into drifting glyphs and half-thoughts ("what if", "final_final"). "noise." keeps glitching. | The glyphs are pulled into one shape and land as the outline of the prompt bar. |
| 4.3–8.2 | 02 Decode | Until you *decode it.* | "decode" resolves letter by letter. The prompt is typed: *I want a logo that feels like code — but human.* | Send: the message lifts into a bubble while the prompt bar unfolds into the DeCode window. |
| 8.2–12.6 | 03 Chat | *Talk* it through. | DeCode thinks, then streams: *Start with dots — brackets for code, a cursor in between. Let the edges merge. That’s the human part.* A `mark.svg` card appears. | The pointer clicks **Open in Code**; the tab pill stretches from Chat to Code. |
| 12.6–16.6 | 04 Code | Shape it in *code.* | SVG streams line by line. Each `<circle>` pops into a live preview with construction guides. | The pointer clicks **Research**; the code slides away and the preview stays. |
| 16.6–20.6 | 05 Research | Back it with *research.* | A query, three cited sources, and a short answer. The preview dots pulse on the citations. | The pointer clicks **Create**; the preview takes over the window. |
| 20.6–24.4 | 06 Create | Then make it *real.* | The dots breathe out, then melt together into the DeCode mark (signed-distance smooth union). It blooms, and the project renames itself "DeCode". | The window dissolves and the mark glides into the lockup. |
| 24.4–29.0 | End | DeCode | Logo and wordmark, *Chat, code, research and create.*, then **Coming soon · decodeai.net**. The cursor in the mark blinks twice, echoing the opening caret. | — |

Each transition gets about a second and is driven by something on screen (particles converging, a
send, a click), so no cut lands cold.

## Brand

Taken from decodeai.net's own stylesheet and metadata:

- **Colour:** pure black (`#000`, theme `#0a0a0a`), ink `#f4f4f4`, a grey ramp (`#d0d0d0`, `#8e8e8e`, `#565656`, `#3f3f3f`, `#212121`), and the status colours (`#4ade80`, `#60a5fa`, `#f59e0b`) used only as small accents.
- **Motion:** the site's spring curve `cubic-bezier(.34, 1.56, .64, 1)` pops every dot into place.
- **Type:** the site uses OpenAI Sans and JetBrains Mono. OpenAI Sans is not freely licensed, so the film uses Geist and Geist Mono (OFL, in `fonts/`).
- **Voice:** short, calm, declarative. The tagline comes from the site title: *Chat, Code, Research and Create.*
- **Mark:** the `<|>` metaball logo is rebuilt from nine circles (the `LOGO` array in `index.html`) plus a small nub in each bracket. It is a reconstruction drawn in code, not the master file. To make it exact, drop in the real geometry or replace `drawMark()` with the master SVG path.

## Sound

`score.mjs` synthesizes everything (no samples), timed from the cue sheet that `index.html` exports.
The harmony moves from D minor while the idea is noise to D major when the mark is made. Each circle
in the code scene plays one note of a rising pentatonic line, and the mix is normalized to -16 LUFS.

## Preview and render

```sh
cd video
npx serve .                      # open http://localhost:3000. Space plays/pauses, arrow keys seek (Shift = one frame)

npm install                      # Playwright 1.56.1 + Chromium
node render.mjs                  # out/decode-brand-film.mp4 (video + score)
node render.mjs --stills 2,10.6  # PNG stills in build/stills/
node render.mjs --from 20 --to 25  # render a silent slice
node render.mjs --no-audio       # skip the soundtrack
```

`render(t)` in `index.html` is a pure function of time, so `render.mjs` can capture every frame
exactly and pipe PNGs to ffmpeg (H.264, CRF 16, BT.709). There are no CSS animations or timers to
drift.
