// Building blocks for the DeCode motion piece. Every component is driven by an
// absolute time `t` (seconds) so any frame can be rendered in isolation.

export const W = 1920, H = 1080;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

export const ease = {
  linear: k => k,
  inCubic: k => k * k * k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outQuint: k => 1 - Math.pow(1 - k, 5),
  inOutQuint: k => (k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2),
  outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: k => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};

// eased progress helper
export const ep = (t, a, b, fn = ease.inOutCubic) => fn(prog(t, a, b));

export function el(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

// set visual state. Skips work when an element is fully hidden.
export function vis(e, { o = 1, x = 0, y = 0, s = 1, blur = 0, sx, sy } = {}) {
  if (o <= 0.001) {
    if (e.style.display !== 'none') e.style.display = 'none';
    return;
  }
  if (e.style.display === 'none') e.style.display = '';
  e.style.opacity = o >= 0.999 ? '' : o.toFixed(3);
  const scale = sx != null || sy != null ? `scale(${sx ?? s}, ${sy ?? s})` : s !== 1 ? `scale(${s.toFixed(4)})` : '';
  e.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) ${scale}`;
  e.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
}

// fade-in / hold / fade-out envelope with blur + drift, used for scene exits
export function inOut(t, tIn, tOut, { dIn = 0.35, dOut = 0.4, blurIn = 10, blurOut = 12, yIn = 14, yOut = -14, sOut = 1 } = {}) {
  const a = ep(t, tIn, tIn + dIn, ease.outCubic);
  const b = ep(t, tOut, tOut + dOut, ease.inCubic);
  return {
    o: a * (1 - b),
    blur: (1 - a) * blurIn + b * blurOut,
    y: (1 - a) * yIn + b * yOut,
    s: lerp(1, sOut, b),
  };
}

export const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="9" width="2.2" height="6" rx="1.1"/><rect x="7.6" y="5.5" width="2.2" height="13" rx="1.1"/><rect x="11.7" y="3" width="2.2" height="18" rx="1.1"/><rect x="15.8" y="6.5" width="2.2" height="11" rx="1.1"/><rect x="19.9" y="9.5" width="2.2" height="5" rx="1.1"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/></svg>',
  cursor: '<svg viewBox="0 0 28 28"><path d="M6 3.5v19.2l5-4.6 3.2 7.2 3.6-1.6-3.2-7h6.8L6 3.5Z" fill="#fff" stroke="#0b0b0b" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

// ---------------------------------------------------------------------------
// Headline: type-on text that stays optically centered while it grows, like
// the reference ("Introducing G" -> "Introducing GPT-5").
export class Headline {
  // lines: array of lines, each an array of [text, className?] segments or a string
  constructor(parent, lines, { size = 100, weight = 500, start = 0, cps = 22, instant = 0, lineGap = 1.12, cy = H / 2, out = Infinity, outDur = 0.4, charDur = 0.14, cls = '', erase = Infinity, eraseStep = 0.06 } = {}) {
    this.root = el('div', 'headline ' + cls, parent);
    this.root.style.fontSize = size + 'px';
    this.root.style.fontWeight = weight;
    this.size = size; this.cy = cy; this.out = out; this.outDur = outDur; this.charDur = charDur;
    this.lines = [];
    let k = 0;
    const norm = lines.map(l => (typeof l === 'string' ? [[l]] : l));
    norm.forEach((segs, li) => {
      const line = el('div', 'headline__line', this.root);
      const chars = [];
      segs.forEach(([text, c]) => {
        for (const ch of text) {
          const span = el('span', 'hc' + (c ? ' ' + c : ''), line);
          span.textContent = ch === ' ' ? ' ' : ch;
          const tt = k < instant ? start : start + (k - instant) / cps + (instant ? 0.32 : 0);
          chars.push({ span, t: tt, w: 0 });
          k++;
        }
      });
      this.lines.push({ el: line, chars, y: 0 });
    });
    this.lineH = size * lineGap;
    this.endT = start + Math.max(0, k - instant) / cps + (instant ? 0.32 : 0);
    this.start = start;
    // optional erase from the last character backwards (wordmark -> logo)
    let j = 0;
    const all = this.lines.flatMap(l => l.chars);
    all.slice().reverse().forEach(c => { c.e = erase + (j++) * eraseStep; });
  }

  measure() {
    const n = this.lines.length;
    this.lines.forEach((line, i) => {
      line.chars.forEach(c => { c.w = c.span.getBoundingClientRect().width; });
      line.y = this.cy + (i - (n - 1) / 2) * this.lineH - this.size * 0.62;
      line.el.style.top = line.y + 'px';
    });
  }

  update(t) {
    const ex = ep(t, this.out, this.out + this.outDur, ease.inCubic);
    if (t < this.start - 0.01 || ex >= 1) { vis(this.root, { o: 0 }); return; }
    vis(this.root, { o: 1 - ex, blur: ex * 14, y: -ex * 18 });
    for (const line of this.lines) {
      let wv = 0;
      for (const c of line.chars) {
        const er = ease.inOutCubic(prog(t, c.e, c.e + 0.1));
        const a = ease.outCubic(prog(t, c.t, c.t + this.charDur)) * (1 - er);
        // width grows a touch faster than the glyph fades in so text re-centers smoothly
        wv += c.w * ease.outQuint(prog(t, c.t - 0.02, c.t + this.charDur * 0.7)) * (1 - er);
        if (a <= 0) { c.span.style.opacity = '0'; continue; }
        c.span.style.opacity = a >= 1 ? '' : a.toFixed(3);
        c.span.style.filter = a < 1 ? `blur(${((1 - a) * 6).toFixed(2)}px)` : '';
      }
      line.el.style.left = (W / 2 - wv / 2).toFixed(2) + 'px';
    }
  }
}

// ---------------------------------------------------------------------------
// Composer: the DeCode prompt box (pill -> grows into a multi-line card).
export class Composer {
  constructor(parent, { text, model = '', appear, typeStart, cps = 40, sendAt, cy = H / 2, width = 1180 }) {
    this.o = { text, model, appear, typeStart, cps, sendAt, cy, width };
    const r = this.root = el('div', 'composer', parent);
    r.style.width = width + 'px';
    this.textBox = el('div', 'composer__text', r);
    this.placeholder = el('div', 'composer__placeholder', r, 'How can I help you?');
    this.chars = [];
    for (const ch of text) {
      const s = el('span', null, this.textBox);
      s.textContent = ch;
      this.chars.push(s);
    }
    this.caret = el('span', 'composer__caret', this.textBox);
    this.plus = el('div', 'composer__icon composer__plus', r, ICON.plus);
    this.right = el('div', 'composer__right', r);
    this.modelEl = el('div', 'composer__model', this.right, model ? `${model}<span class="composer__chev">${ICON.chevron}</span>` : '');
    if (!model) this.modelEl.style.display = 'none';
    this.mic = el('div', 'composer__icon composer__mic', this.right, ICON.mic);
    this.btn = el('div', 'composer__btn', this.right);
    this.btnWave = el('div', 'composer__btn-icon', this.btn, ICON.wave);
    this.btnUp = el('div', 'composer__btn-icon', this.btn, ICON.up);
    this.pillH = 104;
    this.lineH = 48;
  }

  charTime(i) { return this.o.typeStart + i / this.o.cps; }

  measure() {
    // which wrapped line each char lands on in the expanded layout, and when
    // the single-line pill runs out of room
    const r = this.root;
    r.classList.add('composer--expanded');
    this.textBox.style.width = (this.o.width - 88) + 'px';
    this.chars.forEach(s => (s.style.display = ''));
    const tops = this.chars.map(s => s.offsetTop);
    const uniq = [...new Set(tops)].sort((a, b) => a - b);
    this.charLine = tops.map(v => uniq.indexOf(v));
    this.nLines = uniq.length;
    r.classList.remove('composer--expanded');
    this.textBox.style.width = '';
    const pillTextW = this.o.width - 96 - (this.o.model ? 330 : 210);
    let acc = 0; this.overflowAt = Infinity;
    for (let i = 0; i < this.chars.length; i++) {
      acc += this.chars[i].getBoundingClientRect().width;
      if (acc > pillTextW) { this.overflowAt = i; break; }
    }
    this.tExpand = this.overflowAt === Infinity ? Infinity : this.charTime(this.overflowAt);
  }

  // card height for a given number of visible text lines (expanded layout)
  expandedH(lines) { return 34 + lines * this.lineH + 86; }

  update(t) {
    const { appear, sendAt, cy, width } = this.o;
    const a = ep(t, appear, appear + 0.45, ease.outCubic);
    const gone = ep(t, sendAt + 0.12, sendAt + 0.5, ease.inCubic);
    if (a <= 0 || gone >= 1) { vis(this.root, { o: 0 }); return; }
    const n = this.chars.length;
    let shown = 0;
    for (let i = 0; i < n; i++) {
      const on = t >= this.charTime(i);
      if (on) shown = i + 1;
      this.chars[i].style.display = on ? '' : 'none';
    }
    const typing = shown > 0 && shown < n && t < this.charTime(n - 1) + 0.05;
    this.placeholder.style.display = shown ? 'none' : '';
    // caret: solid while typing, blinking otherwise; hidden after send
    const blink = typing ? 1 : (Math.floor((t - appear) * 1.9) % 2 === 0 ? 1 : 0);
    this.caret.style.opacity = t > sendAt ? 0 : blink;

    // pill -> expanded
    const ex = ep(t, this.tExpand, this.tExpand + 0.32, ease.outCubic);
    const expanded = t >= this.tExpand;
    this.root.classList.toggle('composer--expanded', expanded);
    this.textBox.style.width = expanded ? (width - 88) + 'px' : '';
    // smooth height as lines appear
    let hTarget = this.pillH;
    if (expanded) {
      let lines = 1;
      for (let i = 0; i < shown; i++) lines = Math.max(lines, this.charLine[i] + 1);
      // blend toward the newest line over 0.14s
      let hPrev = this.expandedH(Math.max(1, lines - 1));
      let hNow = this.expandedH(lines);
      const firstOfLine = this.charLine.indexOf(lines - 1);
      const k = lines > 1 ? ep(t, this.charTime(firstOfLine), this.charTime(firstOfLine) + 0.14, ease.outCubic) : 1;
      const hExp = lerp(hPrev, hNow, k);
      hTarget = lerp(this.pillH, hExp, ex);
    }
    this.root.style.height = hTarget.toFixed(1) + 'px';
    this.root.style.borderRadius = lerp(52, 34, ex).toFixed(1) + 'px';
    this.root.style.top = (cy - hTarget / 2).toFixed(1) + 'px';
    this.root.style.left = (W / 2 - width / 2) + 'px';

    // send button state
    const hasText = shown > 0 ? 1 : 0;
    const swap = hasText ? ep(t, this.o.typeStart, this.o.typeStart + 0.18, ease.outCubic) : 0;
    vis(this.btnWave, { o: 1 - swap, s: 1 - 0.3 * swap });
    vis(this.btnUp, { o: swap, s: 0.7 + 0.3 * swap });
    const press = t >= sendAt ? Math.sin(Math.PI * prog(t, sendAt, sendAt + 0.22)) : 0;
    this.btn.style.transform = `scale(${(1 - 0.14 * press).toFixed(3)})`;

    vis(this.root, { o: a * (1 - gone), y: (1 - a) * 18 + gone * 26, s: lerp(0.97, 1, a) * lerp(1, 0.985, gone), blur: (1 - a) * 6 + gone * 6 });
  }
}

// ---------------------------------------------------------------------------
// Status labels that slide through a masked window with a shimmer, like the
// reference's "Thinking" -> next step sequence. Labels are DeCode's own
// status strings.
export class StatusTicker {
  constructor(parent, items, { cy = H / 2, size = 68 } = {}) {
    // items: [{ text, tIn, tOut }]
    this.root = el('div', 'ticker', parent);
    this.root.style.top = (cy - size * 0.75) + 'px';
    this.items = items.map(it => {
      const e = el('div', 'ticker__label shimmer', this.root);
      e.style.fontSize = size + 'px';
      e.textContent = it.text;
      return { ...it, el: e };
    });
    this.start = Math.min(...items.map(i => i.tIn));
    this.end = Math.max(...items.map(i => i.tOut)) + 0.6;
  }

  update(t) {
    if (t < this.start - 0.05 || t > this.end) { vis(this.root, { o: 0 }); return; }
    vis(this.root, {});
    for (const it of this.items) {
      const a = ep(t, it.tIn, it.tIn + 0.6, ease.outQuint);
      const b = ep(t, it.tOut, it.tOut + 0.5, ease.inOutCubic);
      if (a <= 0 || b >= 1) { vis(it.el, { o: 0 }); continue; }
      const x = (1 - a) * 760 - b * 760;
      vis(it.el, { o: Math.min(a * 1.6, 1) * (1 - b * 0.9), x });
      // shimmer sweep
      const ph = ((t - it.tIn) * 0.75) % 1;
      it.el.style.backgroundPosition = `${(120 - ph * 240).toFixed(1)}% 0`;
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming reveal: words / rows / code lines fade in sequentially.
export class Stream {
  constructor(root, start, { wps = 26 } = {}) {
    this.root = root; this.start = start; this.wps = wps;
    // wrap words in text nodes (except inside [data-unit] atoms)
    const walk = node => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          if (!ch.textContent.trim()) continue;
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement('span'); s.className = 'su'; s.textContent = part; frag.appendChild(s); }
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && !ch.hasAttribute('data-unit') && !ch.hasAttribute('data-skip')) walk(ch);
        else if (ch.nodeType === 1 && ch.hasAttribute('data-unit')) ch.classList.add('su');
      }
    };
    walk(root);
    this.units = [...root.querySelectorAll('.su')].filter(u => !u.closest('[data-skip]'));
    let tt = start;
    this.units.forEach(u => {
      const d = u.dataset.dur ? parseFloat(u.dataset.dur) : 1 / this.wps;
      const pe = u.closest('[data-pause]');
      if (pe && !pe._paused) { tt += parseFloat(pe.dataset.pause); pe._paused = true; }
      u._t = tt; tt += d;
    });
    this.end = tt;
    // block containers that should only appear once their first unit does
    this.blocks = [...root.querySelectorAll('[data-block]')].map(b => {
      const units = [...b.querySelectorAll('.su')];
      return { el: b, units, t: units.length ? units[0]._t : start, pad: parseFloat(b.dataset.pad || '0'), radius: b.dataset.radius || '0' };
    });
  }

  measure(originEl) {
    const o = originEl.getBoundingClientRect();
    const sc = 1;
    this.units.forEach(u => {
      const r = u.getBoundingClientRect();
      u._bottom = (r.bottom - o.top) / sc;
    });
    this.blocks.forEach(b => {
      const r = b.el.getBoundingClientRect();
      b.top = (r.top - o.top) / sc; b.bottom = (r.bottom - o.top) / sc;
    });
  }

  // bottom (content coords) of the latest revealed unit
  bottomAt(t) {
    let b = 0;
    for (const u of this.units) { if (u._t <= t) b = Math.max(b, u._bottom); else break; }
    return b;
  }

  update(t) {
    for (const u of this.units) {
      const a = ease.outCubic(prog(t, u._t, u._t + 0.16));
      u.style.opacity = a >= 1 ? '' : a.toFixed(3);
    }
    for (const b of this.blocks) {
      const a = ease.outCubic(prog(t, b.t - 0.08, b.t + 0.2));
      b.el.style.opacity = a >= 1 ? '' : a.toFixed(3);
      // grow the block with its content, the way a streamed reply extends
      if (b.units.length && b.bottom != null) {
        let shown = b.units[0]._bottom - 1, prev = b.top;
        for (const u of b.units) {
          if (u._t > t) break;
          const k = ease.outCubic(prog(t, u._t, u._t + 0.12));
          shown = lerp(prev, u._bottom, k); prev = u._bottom;
        }
        const cut = Math.max(0, b.bottom - (shown + b.pad));
        b.el.style.clipPath = cut > 0.5 ? `inset(0px 0px ${cut.toFixed(1)}px 0px round ${b.radius}px)` : '';
      }
    }
  }
}

// ---------------------------------------------------------------------------
export class Cursor {
  // path: [{ t, x, y }] keyframes (stage coords); clicks: [t]
  constructor(parent, path, clicks = []) {
    this.root = el('div', 'cursor', parent, ICON.cursor);
    this.ring = el('div', 'cursor__ring', parent);
    this.path = path; this.clicks = clicks;
    this.t0 = path[0].t; this.t1 = path[path.length - 1].t;
  }

  pos(t) {
    const p = this.path;
    if (t <= p[0].t) return p[0];
    for (let i = 0; i < p.length - 1; i++) {
      if (t <= p[i + 1].t) {
        const k = ease.inOutCubic(prog(t, p[i].t, p[i + 1].t));
        return { x: lerp(p[i].x, p[i + 1].x, k), y: lerp(p[i].y, p[i + 1].y, k) };
      }
    }
    return p[p.length - 1];
  }

  update(t, { show = true } = {}) {
    if (!show || t < this.t0 || t > this.t1) { vis(this.root, { o: 0 }); vis(this.ring, { o: 0 }); return; }
    const a = ep(t, this.t0, this.t0 + 0.25) * (1 - ep(t, this.t1 - 0.25, this.t1));
    const { x, y } = this.pos(t);
    let press = 0, ringK = -1;
    for (const c of this.clicks) {
      if (t >= c && t < c + 0.25) press = Math.sin(Math.PI * prog(t, c, c + 0.25));
      if (t >= c && t < c + 0.55) ringK = prog(t, c, c + 0.55);
    }
    vis(this.root, { o: a, x: x - 6, y: y - 3, s: 1 - 0.14 * press });
    if (ringK >= 0) vis(this.ring, { o: (1 - ringK) * 0.7 * a, x: x - 30, y: y - 30, s: 0.4 + ringK * 0.9 });
    else vis(this.ring, { o: 0 });
  }
}

// split Prism-highlighted HTML into per-line HTML with balanced spans
export function highlightLines(code, grammar, lang) {
  const html = window.Prism.highlight(code, grammar, lang);
  const tpl = document.createElement('div');
  tpl.innerHTML = html;
  const lines = [[]];
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wrap = (txt, classes) => classes.reduceRight((acc, c) => `<span class="${c}">${acc}</span>`, txt);
  const walk = (node, classes) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === 3) {
        ch.textContent.split('\n').forEach((part, i) => {
          if (i > 0) lines.push([]);
          if (part) lines[lines.length - 1].push(wrap(esc(part), classes));
        });
      } else walk(ch, [...classes, ch.className]);
    }
  };
  walk(tpl, []);
  return lines.map(l => l.join(''));
}
