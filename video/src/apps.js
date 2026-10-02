// Single-file HTML programs shown in the coding scene. The code block in the
// video displays FOCUS_TIMER verbatim, and the "Run" preview executes that same
// source in an iframe, the way DeCode's HTML code blocks preview their output.
// The montage previews are real programs too and run the same way.

export const FOCUS_TIMER = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Focus Timer</title>
  <style>
    body {
      margin: 0; height: 100vh; display: grid; place-items: center;
      background: #0b1020; color: #fff; font-family: system-ui, sans-serif;
    }
    .card { text-align: center; padding: 40px 64px; border-radius: 28px; background: #141b33; }
    h1 { margin: 0; font-size: 20px; font-weight: 600; color: #8fb0ff; }
    #time { font-size: 104px; font-weight: 700; font-variant-numeric: tabular-nums; }
    button {
      margin: 0 6px; padding: 12px 24px; border: 0; border-radius: 999px;
      font-size: 17px; color: #fff; background: #26324f; cursor: pointer;
    }
    #start { background: #3b82f6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Focus Timer</h1>
    <div id="time">25:00</div>
    <button id="start">Start</button>
    <button id="pause">Pause</button>
    <button id="reset">Reset</button>
  </div>
  <script>
    const FOCUS = 25 * 60;
    let left = FOCUS;
    let timer = null;
    const time = document.getElementById('time');

    function render() {
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      time.textContent = m + ':' + s;
    }

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    document.getElementById('start').onclick = () => {
      if (timer || left === 0) return;
      timer = setInterval(() => {
        left--;
        render();
        if (left === 0) stop();
      }, 1000);
    };

    document.getElementById('pause').onclick = stop;

    document.getElementById('reset').onclick = () => {
      stop();
      left = FOCUS;
      render();
    };
  </script>
</body>
</html>`;

export const GAME_OF_LIFE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Game of Life</title>
  <style>
    body { margin: 0; height: 100vh; display: grid; place-items: center; background: #05070d; }
    canvas { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="c" width="960" height="540"></canvas>
  <script>
    const S = 12, W = 80, H = 45;
    const ctx = document.getElementById('c').getContext('2d');
    let grid = Array.from({ length: H }, () => Array.from({ length: W }, () => Math.random() < 0.28));

    function step() {
      grid = grid.map((row, y) => row.map((alive, x) => {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if ((dx || dy) && grid[(y + dy + H) % H][(x + dx + W) % W]) n++;
        return n === 3 || (alive && n === 2);
      }));
    }

    function draw() {
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, W * S, H * S);
      ctx.fillStyle = '#3b82f6';
      grid.forEach((row, y) => row.forEach((alive, x) => {
        if (alive) ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
      }));
    }

    draw();
    setInterval(() => { step(); draw(); }, 120);
  </script>
</body>
</html>`;

export const ANALOG_CLOCK = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Analog Clock</title>
  <style>
    body { margin: 0; height: 100vh; display: grid; place-items: center; background: #f4f1ea; }
  </style>
</head>
<body>
  <canvas id="c" width="460" height="460"></canvas>
  <script>
    const ctx = document.getElementById('c').getContext('2d');

    function hand(angle, length, width, color) {
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, -length);
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      ctx.setTransform(1, 0, 0, 1, 230, 230);
      ctx.clearRect(-230, -230, 460, 460);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 210, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 60; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 30);
        ctx.fillStyle = i % 5 ? '#c9c4b8' : '#1d1d1f';
        ctx.fillRect(-1.5, -196, 3, i % 5 ? 10 : 22);
        ctx.restore();
      }
      hand(h * Math.PI / 6, 110, 10, '#1d1d1f');
      hand(m * Math.PI / 30, 165, 7, '#1d1d1f');
      hand(s * Math.PI / 30, 180, 3, '#e5483b');
      ctx.fillStyle = '#e5483b';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      requestAnimationFrame(draw);
    }

    draw();
  </script>
</body>
</html>`;

// Video-time harness injected into preview iframes (never shown on screen):
// replaces timers, Date and Math.random with deterministic versions so the
// programs run in lockstep with the video's frames instead of wall-clock time.
const SHIM = `<script>(function(){
  var now = 0, nextId = 1, timers = new Map(), rafs = [];
  var RealDate = Date, base = new RealDate(2026, 9, 2, 10, 9, 24).getTime();
  window.setTimeout = function(fn, ms){ var a = [].slice.call(arguments, 2); timers.set(nextId, {fn: fn, a: a, t: now + Math.max(0, ms || 0), every: 0}); return nextId++; };
  window.setInterval = function(fn, ms){ var a = [].slice.call(arguments, 2); ms = Math.max(1, ms || 0); timers.set(nextId, {fn: fn, a: a, t: now + ms, every: ms}); return nextId++; };
  window.clearTimeout = window.clearInterval = function(id){ timers.delete(id); };
  window.requestAnimationFrame = function(fn){ rafs.push(fn); return rafs.length; };
  function VDate(){ var a = [].slice.call(arguments); return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(base + now); }
  VDate.prototype = RealDate.prototype; VDate.now = function(){ return base + now; }; VDate.UTC = RealDate.UTC; VDate.parse = RealDate.parse;
  window.Date = VDate;
  var seed = 20261002; Math.random = function(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  window.__advance = function(target){
    for (;;) {
      var best = null, bestId = 0;
      timers.forEach(function(tm, id){ if (tm.t <= target && (!best || tm.t < best.t)) { best = tm; bestId = id; } });
      if (!best) break;
      now = best.t;
      if (best.every) best.t += best.every; else timers.delete(bestId);
      best.fn.apply(null, best.a);
    }
    now = target;
    var f = rafs; rafs = []; f.forEach(function(fn){ fn(now); });
  };
})();<\/script>`;

export function previewDoc(src) {
  return src.replace('<head>', '<head>' + SHIM);
}
