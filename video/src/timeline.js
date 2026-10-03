// The DeCode motion piece: scene timeline. Structure and motion follow the
// reference launch film; every word and every product moment is DeCode's.
import { W, H, el, vis, ep, ease, prog, lerp, clamp, inOut, Headline, Composer, StatusTicker, Stream, Cursor, ICON, highlightLines } from './kit.js';
import { FOCUS_TIMER, GAME_OF_LIFE, ANALOG_CLOCK, previewDoc } from './apps.js';
import { DotBackground } from './bg.js';

const scenes = [];
let bg;

function scene(start, end, build) {
  const root = el('div', 'scene', document.getElementById('layer'));
  const s = { start, end, root, update() {}, measure() {}, prepare: async () => {}, sync: null };
  Object.assign(s, build(root, s) || {});
  scenes.push(s);
  return s;
}

function headlineScene(cue, lines, opts = {}) {
  return scene(cue.start - 0.05, cue.out + 0.5, root => {
    const h = new Headline(root, lines, { start: cue.start, out: cue.out, ...opts });
    return { measure: () => h.measure(), update: t => h.update(t) };
  });
}

// ---------------------------------------------------------------------------
// camera over a chat column: content point (cx, cy) lands on stage center
class ChatView {
  constructor(parent, html, { width = 1100, top = 150, viewBottom = 905 } = {}) {
    this.root = el('div', 'chat', parent, html);
    this.root.style.width = width + 'px';
    this.width = width; this.top = top; this.viewBottom = viewBottom;
  }
  rel(e) {
    const o = this.root.getBoundingClientRect(), r = e.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
  }
  rest(s = 1) { return { cx: this.width / 2, cy: (H / 2 - this.top) / s, s }; }
  follow(t, stream, s = 1) {
    const bottom = stream ? stream.bottomAt(t) : 0;
    const cy = Math.max((H / 2 - this.top) / s, bottom - (this.viewBottom - H / 2) / s);
    return { cx: this.width / 2, cy, s };
  }
  // moving average of the follow camera -> smooth, frame-independent scrolling
  followSmooth(t, stream, sAt = () => 1, win = 0.5, n = 12) {
    let cx = 0, cy = 0, s = 0;
    for (let i = 0; i < n; i++) {
      const tt = t - win * (i / (n - 1));
      const c = this.follow(tt, stream, sAt(tt));
      cx += c.cx; cy += c.cy; s += c.s;
    }
    return { cx: cx / n, cy: cy / n, s: s / n };
  }
  apply(c) {
    this.root.style.transform = `translate(${(W / 2 - c.cx * c.s).toFixed(2)}px, ${(H / 2 - c.cy * c.s).toFixed(2)}px) scale(${c.s.toFixed(4)})`;
  }
  toStage(px, py, c) { return { x: W / 2 + (px - c.cx) * c.s, y: H / 2 + (py - c.cy) * c.s }; }
}
const camLerp = (a, b, k) => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), s: lerp(a.s, b.s, k) });

// runs a preview program on video time; reloads when seeking backwards
class Preview {
  constructor(iframe, src, events = []) {
    this.iframe = iframe; this.doc = previewDoc(src); this.events = events; this.cur = -1; this.applied = 0;
  }
  async load() {
    await new Promise(res => { this.iframe.onload = () => res(); this.iframe.srcdoc = this.doc; });
    this.cur = 0; this.applied = 0;
  }
  async sync(sec) {
    const ms = Math.max(0, Math.round(sec * 1000));
    if (this.cur < 0 || ms < this.cur) await this.load();
    const w = this.iframe.contentWindow;
    while (this.applied < this.events.length && this.events[this.applied].t * 1000 <= ms) {
      const ev = this.events[this.applied++];
      w.__advance(ev.t * 1000);
      ev.fn(this.iframe.contentDocument);
    }
    w.__advance(ms);
    this.cur = ms;
  }
}

const capsule = text => `<div class="capsule-row" data-skip><div class="capsule ${text.length < 60 ? 'capsule--one' : ''}">${text}</div></div>`;

function codeBlockHTML(lines, { preview = false } = {}) {
  return `<figure class="cb ${preview ? 'cb--preview' : ''}" data-block data-pad="31" data-radius="22">
    <figcaption class="cb__toolbar">
      <span class="cb__identity">${ICON.code}<span>html</span></span>
      <span class="cb__actions">
        <span class="cb__mode"><span class="cb__mode-hl"></span><span class="cb__btn cb__btn--code">${ICON.code}</span><span class="cb__btn cb__btn--run">${ICON.play}</span></span>
        <span class="cb__btn">${ICON.copy}</span>
      </span>
    </figcaption>
    ${lines ? `<pre class="cb__pre">${lines.map(l => `<span class="cl" data-unit data-dur="0.045">${l || ' '}</span>`).join('')}</pre>` : ''}
    <iframe class="cb__preview" title="HTML preview"></iframe>
  </figure>`;
}

// ---------------------------------------------------------------------------
function buildScenes(C) {
  // 1 ── feature picker collapses into DeCode ───────────────────────────────
  scene(0, C.picker.out + 0.5, root => {
    const P = C.picker;
    const items = [
      ['Chat', 'Everyday questions, clear answers'],
      ['Writing', 'Emails and docs in the tone you choose'],
      ['Learning', 'Topics turned into clear study steps'],
      ['Web research', 'Current information with sources'],
      ['Code generation', 'Generate, debug, and explain code'],
      ['Image generation', 'Turn a prompt into an image'],
      ['Real-time voice', 'Talk with DeCode using your voice'],
      ['Roblox Studio Assistant', 'Luau help for creators', true],
    ];
    const IH = 88, PAD = 12, CY = H / 2;
    const card = el('div', 'picker', root);
    card.style.left = (W / 2 - 310) + 'px';
    const hl = el('div', 'picker__hl', card);
    const rows = items.map(([name, desc, beta], i) => {
      const r = el('div', 'picker__item', card, `<div class="picker__name">${name}${beta ? '<span class="beta">BETA</span>' : ''}</div><div class="picker__desc">${desc}</div>`);
      r.style.top = (PAD + i * IH) + 'px';
      return r;
    });
    const final = el('div', 'picker__item', card, `<div class="picker__name"><img class="picker__logo" src="assets/decode-logo.png" alt="">DeCode</div><div class="picker__desc">Everything in one workspace</div>`);
    final.style.top = PAD + 'px';
    const check = el('div', 'picker__check', final, ICON.check);
    return {
      update(t) {
        const e = ep(t, P.expand, P.expand + 0.6, ease.inOutCubic);
        const c = ep(t, P.collapse, P.collapse + 0.5, ease.inOutCubic);
        const h = lerp(lerp(IH + PAD * 2, IH * items.length + PAD * 2, e), IH + PAD * 2, c);
        card.style.height = h + 'px';
        card.style.top = (CY - h / 2) + 'px';
        rows.forEach((r, i) => {
          const a = i === 0 ? 1 : ep(t, P.expand + 0.05 + 0.035 * i, P.expand + 0.4 + 0.035 * i, ease.outCubic);
          const g = ep(t, P.collapse + 0.02 * i, P.collapse + 0.28 + 0.02 * i, ease.inCubic);
          vis(r, { o: a * (1 - g), y: (1 - a) * 16 - g * 46 });
        });
        // hover highlight walks the whole list, row by row, ending on the
        // last item (Roblox Studio Assistant) before the menu collapses
        const HL0 = 1.8, STEP = 0.205, MOVE = 0.13;
        let row = 0;
        for (let i = 1; i < items.length; i++) row += ep(t, HL0 + i * STEP - MOVE, HL0 + i * STEP, ease.inOutCubic);
        const ho = ep(t, 1.72, 1.92) * (1 - ep(t, P.collapse - 0.08, P.collapse + 0.1));
        vis(hl, { o: ho, y: PAD + row * IH });
        const f = ep(t, P.collapse + 0.32, P.collapse + 0.72, ease.outCubic);
        vis(final, { o: f, y: (1 - f) * 22 });
        const k = ep(t, P.select, P.select + 0.45, ease.outBack);
        vis(check, { o: clamp(k * 2), s: Math.max(0.01, k) });
        const io = inOut(t, 0, P.out, { dIn: 0.45, dOut: 0.35, sOut: 0.97, yIn: 10 });
        vis(card, io);
      },
    };
  });
  bg.addRipple(C.picker.select, W / 2, H / 2);

  // 2 ── Introducing DeCode ──────────────────────────────────────────────────
  headlineScene(C.intro, [[['Introducing '], ['DeCode']]], { instant: 12, cps: 11 });

  // 3 ── what it is ──────────────────────────────────────────────────────────
  headlineScene(C.tagline, ['One AI workspace to think,', 'code, research, and create.'], { cps: 30 });

  // 5 ── deeper ─────────────────────────────────────────────────────────────
  headlineScene(C.deepTitle, ['Goes deeper when you need it to'], { cps: 26 });

  // 6 ── a question that needs real working-out (Pro model) ──────────────────
  scene(C.deep.appear - 0.05, C.deep.out + 0.5, root => {
    const D = C.deep;
    const P1 = "I'm investing $1,000 at 5% a year. Explain compound interest and show my balance for each of the next 10 years.";
    const comp = new Composer(root, { text: P1, model: 'Pro', appear: D.appear, typeStart: D.type, cps: 42, sendAt: D.send });
    const ticker = new StatusTicker(root, [
      { text: 'Starting thinking', tIn: D.status1, tOut: D.status2 - 0.3 },
      { text: 'Thinking', tIn: D.status2, tOut: D.statusOut },
    ]);
    const rows = [
      [1, '1,050.00', '50.00'], [2, '1,102.50', '52.50'], [3, '1,157.63', '55.13'], [4, '1,215.51', '57.88'],
      [5, '1,276.28', '60.78'], [6, '1,340.10', '63.81'], [7, '1,407.10', '67.00'], [8, '1,477.46', '70.36'],
      [9, '1,551.33', '73.87'], [10, '1,628.89', '77.57'],
    ];
    const view = new ChatView(root, `
      ${capsule(P1)}
      <div class="think" data-unit data-dur="0.35">${ICON.bulb}<span>Thought for 4 seconds</span><span class="chev">${ICON.chevron}</span></div>
      <div class="msg">
        <p>Compound interest means you earn interest on your interest. Each year, 5% is added to your new, larger balance, not just to the original $1,000.</p>
        <div class="formula" data-unit data-dur="0.3" data-pause="0.1">Balance = $1,000 × 1.05<sup>n</sup>&nbsp;&nbsp;(n = years)</div>
        <table data-block data-radius="18"><thead><tr data-unit data-dur="0.14"><th>Year</th><th>Balance</th><th>Interest earned</th></tr></thead><tbody>
          ${rows.map(([y, b, i]) => `<tr data-unit data-dur="0.1"><td>${y}</td><td>$${b}</td><td>$${i}</td></tr>`).join('')}
        </tbody></table>
        <p data-pause="0.15">After 10 years you'll have <strong>$1,628.89</strong>: $628.89 in interest, or $128.89 more than simple interest would earn.</p>
      </div>`);
    const stream = new Stream(view.root, D.stream, { wps: 30 });
    const cap = view.root.querySelector('.capsule-row');
    const table = view.root.querySelector('table');
    const last = view.root.querySelectorAll('tbody tr')[9];
    let tableCam;
    return {
      measure() {
        comp.measure(); stream.measure(view.root);
        const r = view.rel(table);
        tableCam = { cx: view.width / 2, cy: r.cy + 10, s: 1.3 };
      },
      update(t) {
        comp.update(t); ticker.update(t);
        stream.update(t);
        const io = inOut(t, D.chat, D.out, { dIn: 0.45, yIn: 30, sOut: 0.98 });
        vis(view.root, { o: io.o });
        if (io.o <= 0) return;
        vis(cap, { o: ep(t, D.chat, D.chat + 0.4), y: (1 - ep(t, D.chat, D.chat + 0.5, ease.outCubic)) * 30 });
        const follow = view.followSmooth(t, stream);
        const z = ep(t, D.zoom, D.zoom + 1.0, ease.inOutCubic);
        const cam = camLerp(follow, tableCam, z);
        view.apply(cam);
        view.root.style.filter = io.blur > 0.05 ? `blur(${io.blur.toFixed(2)}px)` : '';
        const hl = ep(t, D.zoom + 0.8, D.zoom + 1.2);
        last.style.setProperty('background', hl ? `rgba(59,130,246,${(0.2 * hl).toFixed(3)})` : '');
      },
    };
  });

  // 7 ── faster ─────────────────────────────────────────────────────────────
  headlineScene(C.fastTitle, ['Answers fast when you want it to'], { cps: 26 });

  // 8 ── quick everyday ask (Instant model) ──────────────────────────────────
  scene(C.fast.appear - 0.05, C.fast.out + 0.5, root => {
    const F = C.fast;
    const P2 = "Write a quick note telling my team that tomorrow's meeting moves to 10 AM.";
    const comp = new Composer(root, { text: P2, model: 'Instant', appear: F.appear, typeStart: F.type, cps: 40, sendAt: F.send });
    const view = new ChatView(root, `
      ${capsule(P2)}
      <div class="msg">
        <p>Hi team,</p>
        <p>Quick update: tomorrow's meeting is moving to <strong>10 AM</strong>. Everything else stays the same.</p>
        <p>Thanks, and see you then!</p>
      </div>`, { top: 250 });
    const stream = new Stream(view.root, F.stream, { wps: 34 });
    const cap = view.root.querySelector('.capsule-row');
    return {
      measure() { comp.measure(); stream.measure(view.root); },
      update(t) {
        comp.update(t);
        stream.update(t);
        const io = inOut(t, F.chat, F.out, { dIn: 0.4, sOut: 0.98 });
        vis(view.root, { o: io.o });
        if (io.o <= 0) return;
        const k = ep(t, F.chat, F.chat + 0.55, ease.outCubic);
        vis(cap, { o: ep(t, F.chat, F.chat + 0.3), y: (1 - k) * 60 });
        view.apply(view.rest(1));
        view.root.style.filter = io.blur > 0.05 ? `blur(${io.blur.toFixed(2)}px)` : '';
      },
    };
  });

  // 8b ── web research: prompt -> search -> answer with sources ──────────────
  // Mirrors DeCode's own web activity UI: "Searching the web" -> "Reading
  // sources" -> "Searched the web", inline source chips, and the
  // "Sources · Web • N" action.
  headlineScene(C.webTitle, [[['Researches the web, '], ['with sources', 'blue']]], { cps: 26 });

  scene(C.web.appear - 0.05, C.web.out + 0.5, root => {
    const Q = C.web;
    const P5 = 'When is the next total solar eclipse I can see from Europe?';
    const comp = new Composer(root, { text: P5, appear: Q.appear, typeStart: Q.type, cps: 40, sendAt: Q.send });
    const chip = d => `<span class="src-chip" data-unit data-dur="0.14"><span class="src-chip__icon"><span class="web-glyph"></span></span>${d}</span>`;
    const view = new ChatView(root, `
      ${capsule(P5)}
      <div class="activity" data-skip>
        <div class="activity__row"><span class="web-glyph web-glyph--status"></span><span class="activity__label shimmer">Searching the web</span></div>
        <div class="activity__row"><span class="web-glyph web-glyph--status"></span><span class="activity__label shimmer">Reading sources</span></div>
        <div class="activity__row"><span class="web-glyph web-glyph--status"></span><span class="activity__label">Searched the web</span></div>
      </div>
      <div class="msg web-answer">
        <p>The next one is on <strong>August 2, 2027</strong>. Totality crosses southern Spain and Gibraltar ${chip('timeanddate.com')}, then North Africa and the Middle East.</p>
        <p>Near Luxor, Egypt, it lasts up to <strong>6 minutes 23 seconds</strong>, one of the longest total eclipses this century ${chip('nasa.gov')}.</p>
        <div class="msg-actions" data-unit data-dur="0.3" data-pause="0.2"><span class="sources-btn"><span class="web-glyph web-glyph--btn"></span>Sources <b>Web • 2</b></span></div>
      </div>`, { top: 230 });
    const stream = new Stream(view.root, Q.stream, { wps: 24 });
    const cap = view.root.querySelector('.capsule-row');
    const rows = [...view.root.querySelectorAll('.activity__row')];
    const answer = view.root.querySelector('.web-answer');
    let focus;
    return {
      measure() {
        comp.measure(); stream.measure(view.root);
        const r = view.rel(answer);
        focus = { cx: view.width / 2, cy: r.cy - 40, s: 1.14 };
      },
      update(t) {
        comp.update(t);
        stream.update(t);
        const io = inOut(t, Q.chat, Q.out, { dIn: 0.45, sOut: 0.98 });
        vis(view.root, { o: io.o });
        if (io.o <= 0) return;
        vis(cap, { o: ep(t, Q.chat, Q.chat + 0.4), y: (1 - ep(t, Q.chat, Q.chat + 0.5, ease.outCubic)) * 30 });
        // status row: each label replaces the previous one in place
        const marks = [Q.search, Q.read, Q.done, Infinity];
        rows.forEach((row, i) => {
          const a = ep(t, marks[i], marks[i] + 0.3, ease.outCubic);
          const b = ep(t, marks[i + 1] - 0.12, marks[i + 1] + 0.12);
          vis(row, { o: a * (1 - b), y: (1 - a) * 10 - b * 10 });
          const label = row.querySelector('.shimmer');
          if (label) label.style.backgroundPosition = `${(120 - (((t - Q.search) * 0.8) % 1) * 240).toFixed(1)}% 0`;
        });
        const z = ep(t, Q.zoom, Q.out + 0.3, ease.inOutSine);
        view.apply(camLerp(view.rest(1), focus, z));
        view.root.style.filter = io.blur > 0.05 ? `blur(${io.blur.toFixed(2)}px)` : '';
      },
    };
  });

  // 9 ── Real-time: text only, as requested ─────────────────────────────────
  scene(C.realtime.start - 0.05, C.realtime.out + 0.5, root => {
    const R = C.realtime;
    const pill = el('div', 'pill pill--new', root, '<b>New</b><span>Real-time voice</span>');
    const h = new Headline(root, [[['Real-time', 'blue'], [' is available in DeCode.']]], { start: R.start + 0.3, out: R.out, cps: 28, size: 96 });
    return {
      measure: () => { h.measure(); pill.style.marginLeft = -(pill.offsetWidth / 2) + 'px'; pill.style.top = '396px'; },
      update(t) { h.update(t); vis(pill, inOut(t, R.start, R.out, { dIn: 0.45, yIn: 18 })); },
    };
  });
  bg.addRipple(C.realtime.start + 0.1, W / 2, 470);

  // 10 ── coding ─────────────────────────────────────────────────────────────
  headlineScene(C.codeTitle, ['DeCode is great at coding'], { cps: 24 });

  // 11 ── ask for a program, read the code, Run it in the preview ─────────────
  scene(C.code.appear - 0.05, C.code.out + 0.5, root => {
    const K = C.code;
    const P3 = 'Build a focus timer in a single HTML file with Start, Pause, and Reset buttons.';
    const comp = new Composer(root, { text: P3, model: 'High', appear: K.appear, typeStart: K.type, cps: 40, sendAt: K.send });
    const lines = highlightLines(FOCUS_TIMER, window.Prism.languages.markup, 'markup');
    const view = new ChatView(root, `
      ${capsule(P3)}
      <div class="msg">
        <p>Here's a focus timer in a single HTML file. Press <strong>Run</strong> to preview it.</p>
        ${codeBlockHTML(lines)}
      </div>`);
    const stream = new Stream(view.root, K.stream, { wps: 32 });
    const cap = view.root.querySelector('.capsule-row');
    const cb = view.root.querySelector('.cb');
    const pre = cb.querySelector('.cb__pre');
    const frame = cb.querySelector('iframe');
    const modeHl = cb.querySelector('.cb__mode-hl');
    const runBtn = cb.querySelector('.cb__btn--run');
    const preview = new Preview(frame, FOCUS_TIMER, [
      { t: K.start - K.run, fn: d => d.getElementById('start').click() },
    ]);
    let runPos, startPos, prevCam, cursor;
    const setMode = p => {
      pre.style.display = p ? 'none' : '';
      frame.style.display = p ? 'block' : '';
      cb.classList.toggle('cb--preview', p);
    };
    const sAt = tt => lerp(1, 1.26, ep(tt, K.zoomIn, K.zoomIn + 0.9, ease.inOutCubic));
    return {
      measure() {
        comp.measure(); stream.measure(view.root);
        runPos = view.rel(runBtn);
        setMode(true);
        const fr = view.rel(frame);
        const tb = view.rel(cb.querySelector('.cb__toolbar'));
        prevCam = { cx: view.width / 2, cy: (tb.y + fr.y + fr.h) / 2 + 4, s: 1.08 };
        this._fr = fr;
        setMode(false);
      },
      async prepare() {
        await preview.load();
        setMode(true);
        const b = frame.contentDocument.getElementById('start').getBoundingClientRect();
        setMode(false);
        const fr = this._fr;
        startPos = { x: fr.x + b.left + b.width / 2, y: fr.y + b.top + b.height / 2 };
        const r = view.toStage(runPos.cx, runPos.cy, prevCam);
        const s = view.toStage(startPos.x, startPos.y, prevCam);
        cursor = new Cursor(root, [
          { t: K.cursorIn, x: 1640, y: 1010 },
          { t: K.run - 0.12, x: r.x, y: r.y },
          { t: K.start - 0.95, x: r.x, y: r.y },
          { t: K.start - 0.12, x: s.x, y: s.y },
          { t: K.start + 1.1, x: s.x + 140, y: s.y + 120 },
          { t: K.montage - 0.2, x: s.x + 170, y: s.y + 150 },
        ], [K.run, K.start]);
        bg.addRipple(K.run, r.x, r.y);
      },
      update(t) {
        comp.update(t);
        stream.update(t);
        const io = inOut(t, K.chat, K.montage, { dIn: 0.45, dOut: 0.45, sOut: 0.96 });
        vis(view.root, { o: io.o });
        cursor.update(t, { show: io.o > 0 });
        if (io.o <= 0) return;
        vis(cap, { o: ep(t, K.chat, K.chat + 0.4), y: (1 - ep(t, K.chat, K.chat + 0.5, ease.outCubic)) * 30 });
        const running = t >= K.run;
        setMode(running);
        frame.style.opacity = running ? ep(t, K.run, K.run + 0.3, ease.outCubic).toFixed(3) : '0';
        const m = ep(t, K.run - 0.02, K.run + 0.22, ease.inOutCubic);
        modeHl.style.transform = `translateX(${(m * 57).toFixed(2)}px)`;
        const follow = view.followSmooth(t, stream, sAt);
        const pan = ep(t, K.panUp, K.panUp + 1.0, ease.inOutCubic);
        view.apply(camLerp(follow, prevCam, pan));
        view.root.style.filter = io.blur > 0.05 ? `blur(${io.blur.toFixed(2)}px)` : '';
      },
      async sync(t) { if (t >= K.run - 0.05 && t < K.montage + 0.5) await preview.sync(t - K.run); },
    };
  });

  // 11b ── more single-file programs, previewed the same way ────────────────
  const montage = (start, end, src, caption) => scene(start - 0.05, end + 0.5, root => {
    const card = el('div', 'mcard', root, codeBlockHTML(null, { preview: true }) + `<div class="mcard__cap">${caption}</div>`);
    card.querySelector('.cb__mode-hl').style.transform = 'translateX(57px)';
    const frame = card.querySelector('iframe');
    const preview = new Preview(frame, src);
    return {
      measure() { card.style.marginTop = -(card.offsetHeight / 2) + 'px'; },
      prepare: () => preview.load(),
      update(t) {
        const a = ep(t, start, start + 0.5, ease.outCubic);
        const b = ep(t, end, end + 0.4, ease.inCubic);
        vis(card, { o: a * (1 - b), s: lerp(0.9, 1, a) * lerp(1, 1.04, b), y: (1 - a) * 40, blur: (1 - a) * 8 + b * 10 });
      },
      async sync(t) { await preview.sync(t - start + 3); },
    };
  });
  montage(C.code.montage, C.code.clock, GAME_OF_LIFE, 'Game of Life · one HTML file');
  montage(C.code.clock, C.code.out, ANALOG_CLOCK, 'Analog clock · one HTML file');

  // 12 ── Image Generation ──────────────────────────────────────────────────
  headlineScene(C.imgTitle, [[['Image '], ['Generation', 'blue']]], { cps: 18 });

  scene(C.img.appear - 0.05, C.img.out + 0.5, root => {
    const G = C.img;
    const P4 = 'Create a photorealistic image of a mountain lake at sunrise.';
    const comp = new Composer(root, { text: P4, appear: G.appear, typeStart: G.type, cps: 38, sendAt: G.send });
    const view = new ChatView(root, `
      ${capsule(P4)}
      <div class="msg">
        <div class="gen-wrap" data-skip style="position:relative">
          <div class="status-inline" style="position:absolute;left:0;top:0"><span class="shimmer">Starting thinking</span></div>
          <div class="status-inline" style="position:absolute;left:0;top:0"><span class="shimmer">Thinking</span></div>
          <div class="gen-image"><img src="assets/generated-lake.png" alt=""></div>
        </div>
        <p>Here's your mountain lake at sunrise. Do you like it?</p>
      </div>`, { top: 112 });
    const stream = new Stream(view.root, G.text, { wps: 14 });
    const cap = view.root.querySelector('.capsule-row');
    const [st1, st2] = view.root.querySelectorAll('.status-inline');
    const mid = (G.think + G.reveal) / 2;
    const img = view.root.querySelector('.gen-image');
    let imgCam;
    return {
      measure() {
        comp.measure(); stream.measure(view.root);
        const r = view.rel(img);
        imgCam = { cx: r.cx, cy: r.cy, s: 1.5 };
        const st = view.toStage(r.cx, r.cy, view.rest(1));
        bg.addRipple(G.reveal + 0.05, st.x, st.y);
      },
      async prepare() { await img.querySelector('img').decode(); },
      update(t) {
        comp.update(t);
        stream.update(t);
        const io = inOut(t, G.chat, G.out, { dIn: 0.45, sOut: 0.98 });
        vis(view.root, { o: io.o });
        if (io.o <= 0) return;
        vis(cap, { o: ep(t, G.chat, G.chat + 0.4), y: (1 - ep(t, G.chat, G.chat + 0.5, ease.outCubic)) * 30 });
        // DeCode's own image flow: "Starting thinking" -> "Thinking" -> image
        const s1 = ep(t, G.think, G.think + 0.3) * (1 - ep(t, mid - 0.15, mid + 0.1));
        const s2 = ep(t, mid, mid + 0.3) * (1 - ep(t, G.reveal - 0.1, G.reveal + 0.15));
        vis(st1, { o: s1, y: -8 * ep(t, mid - 0.15, mid + 0.1) });
        vis(st2, { o: s2, y: 8 * (1 - ep(t, mid, mid + 0.3, ease.outCubic)) });
        const sweep = `${(120 - (((t - G.think) * 0.8) % 1) * 240).toFixed(1)}% 0`;
        st1.firstChild.style.backgroundPosition = sweep; st2.firstChild.style.backgroundPosition = sweep;
        const r = ep(t, G.reveal, G.reveal + 1.1, ease.outCubic);
        vis(img, { o: clamp(r * 1.6), s: lerp(1.035, 1, r), blur: (1 - r) * 26 });
        img.querySelector('img').style.filter = r < 1 ? `brightness(${lerp(1.5, 1, r).toFixed(3)}) saturate(${lerp(0.4, 1, r).toFixed(3)})` : '';
        const z = ep(t, G.zoom, G.out + 0.3, ease.inOutSine);
        view.apply(camLerp(view.rest(1), imgCam, z * 0.92));
        view.root.style.filter = io.blur > 0.05 ? `blur(${io.blur.toFixed(2)}px)` : '';
      },
    };
  });

  // 13 ── ending ─────────────────────────────────────────────────────────────
  headlineScene(C.end1, [[['Everything you need, '], ['decoded.', 'blue']]], { cps: 26 });
  headlineScene(C.end2, [[['Coming soon to '], ['decodeai.net', 'blue']]], { cps: 26, size: 104, weight: 600 });

  scene(C.end3.start - 0.05, C.end3.fade + 1.5, root => {
    const E = C.end3;
    const h = new Headline(root, ['DeCode'], { start: E.start, cps: 12, size: 168, weight: 600, erase: E.erase, eraseStep: 0.065 });
    const logo = el('img', 'logo', root);
    logo.src = 'assets/decode-logo.png';
    return {
      measure: () => h.measure(),
      async prepare() { await logo.decode(); },
      update(t) {
        h.update(t);
        const k = ep(t, E.logo, E.logo + 0.75, ease.outBack);
        const a = ep(t, E.logo, E.logo + 0.3);
        vis(logo, { o: a, s: lerp(0.45, 1, k), blur: (1 - a) * 8 });
      },
    };
  });
  bg.addRipple(C.end3.logo + 0.05, W / 2, H / 2);
}

// ---------------------------------------------------------------------------
let C;
async function seek(t) {
  bg.render(t);
  for (const s of scenes) {
    const on = t >= s.start && t <= s.end;
    if (!on) { if (s.root.style.display !== 'none') s.root.style.display = 'none'; continue; }
    if (s.root.style.display === 'none') s.root.style.display = '';
    s.update(t);
    if (s.sync) await s.sync(t);
  }
  const f = Math.max(1 - ep(t, 0, 0.6, ease.outCubic), ep(t, C.end3.fade, C.duration - 0.1, ease.inOutCubic));
  document.getElementById('fade').style.opacity = f.toFixed(3);
}

export async function boot() {
  C = await (await fetch('src/cues.json')).json();
  bg = new DotBackground(document.getElementById('dots'), { pixelSize: 4 });
  await Promise.all(['400', '500', '600', '700'].map(w => document.fonts.load(`${w} 40px Geist`)));
  await document.fonts.load('400 20px "Geist Mono"');
  await document.fonts.ready;
  buildScenes(C);
  for (const s of scenes) s.measure();
  for (const s of scenes) await s.prepare();
  window.__seek = seek;
  window.__duration = C.duration;
  window.__fps = C.fps;
  window.__ready = true;

  // interactive preview: open index.html?play (optionally &t=SECONDS)
  const q = new URLSearchParams(location.search);
  const fit = () => {
    const k = Math.min(innerWidth / W, innerHeight / H);
    document.getElementById('stage').style.transform = `scale(${k})`;
  };
  if (q.has('play') || q.has('t')) {
    fit(); addEventListener('resize', fit);
    let t0 = parseFloat(q.get('t') || '0');
    if (q.has('play')) {
      const wall = performance.now();
      let busy = false;
      const loop = async () => {
        if (!busy) { busy = true; await seek(t0 + (performance.now() - wall) / 1000); busy = false; }
        requestAnimationFrame(loop);
      };
      loop();
    } else await seek(t0);
  }
}
