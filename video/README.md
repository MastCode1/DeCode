# DeCode — motion intro

An ~80 second motion-graphics launch film for DeCode, made in the same style as the
"Introducing GPT-5" reference video. It has calm UI cards, headlines that type in with a
soft edge, prompts typed live, and "Thinking" status lines that wipe from one to the next.

Everything is hand-written HTML, CSS and JavaScript. It uses no plugins, animation libraries
or templates. The DeCode mark is redrawn from the decodeai.net app icon as nine blended
circles, so it can come apart and come back together on screen.

## The story

One idea follows the whole film: someone wants to make their first Roblox game.

| # | Headline | What you see |
|---|----------|--------------|
| 1 | — | Six separate tools (Chat, Code, Research, Real-Time, Connectors, Roblox Studio) collapse into one: **DeCode** ✓ |
| 2 | Introducing DeCode | |
| 3 | Chat, code, research, and create / in one AI workspace | |
| 4 | Every big idea starts with a question | "I want to make my first Roblox game. Where do I start?" |
| 5 | *Thinking → Breaking down your idea → Planning the first steps* | A three-step plan streams in |
| 6 | Then DeCode helps you write the code | A Luau checkpoint script, then **Explain** |
| 7 | Finds answers across the web | Web Search reads 3 sources and answers with citations |
| 8 | Talks it through with you in real time | DeCode Real-Time: the logo pulses as it speaks and names the game *Sky Sprint* |
| 9 | Connects with the tools you already use | Gmail, Google Calendar, Drive, Microsoft, GitHub, Discord, YouTube, Canva → the user allows access → playtest invite sent |
| 10 | And helps you build it in Roblox Studio | Roblox Studio Assistant adds a moving platform and the obby comes to life |
| 11 | From one question to something real | The circles gather into the DeCode mark, then **DeCode**, **Coming soon** and decodeai.net |

The claims follow what DeCode does today. Code help means it writes, explains and debugs code,
but it is not an agent that builds and deploys whole projects. Connected services act only after
the user allows them. The film ends on **Coming soon** because DeCode is still in development.

## Files

- `index.html` is the whole film: timeline, scenes, logo renderer and preview player.
- `render.mjs` records the film frame by frame in headless Chromium and encodes it with ffmpeg.
- `audio.mjs` builds the soundtrack (a soft pad, plucked notes and UI sounds) from the same
  timeline, so every keystroke and pop lands on its exact frame.
- `out/decode-intro-dark.mp4` uses the DeCode brand look (#0a0a0a, as on decodeai.net).
- `out/decode-intro-light.mp4` uses a white look that matches the reference video.

## Preview

Serve the folder and open `index.html` in a browser (for example `npx serve video`):

- `?theme=light` switches to the white look.
- `?t=42` opens paused at 42 s.
- Space plays or pauses. ← and → step one second. The slider scrubs.

## Render

Needs Node 18+, ffmpeg with libx264, and Playwright with Chromium (`npm install` in this folder).
A global Playwright install also works.

```sh
node render.mjs                      # out/decode-intro-dark.mp4, 1920x1080, 60 fps, with sound
node render.mjs --theme light        # out/decode-intro-light.mp4
node render.mjs --fps 30 --no-audio  # lighter render
node render.mjs --stills 6.5,40,78   # PNG frames in out/stills/
```

To change a headline, prompt or timing, edit `index.html`. The `seq(...)` table near the top sets
each scene's length and overlap, and the whole film re-times around it.
