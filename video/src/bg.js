// Blue dot-matrix background. This is the same "PixelBlast" dither shader the
// decodeai.net hero uses (square variant, color #3B82F6, patternScale 1.75,
// density 1, jitter .1, edgeFade .18, ripples on), driven by video time
// instead of the wall clock so every frame is reproducible.

// The noise "feed" in the site shader only depends on the 8x8-pixel cell a
// fragment falls in, so it is evaluated per cell on the CPU (same math) and
// uploaded as a small texture; the GPU does the per-pixel Bayer dither.
const FRAG = `#version 300 es
precision highp float;
uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uPixelSize;
uniform float uPixelJitter;
uniform float uEdgeFade;
uniform sampler2D uFeed;
uniform vec2 uCellOffset;
out vec4 fragColor;

float Bayer2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

void main(){
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float cellPixelSize = 8.0 * uPixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  float feed = texelFetch(uFeed, ivec2(cellId + uCellOffset), 0).r;
  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);
  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float M = bw * (1.0 + (h - 0.5) * uPixelJitter);
  vec2 norm = gl_FragCoord.xy / uResolution;
  float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
  M = clamp(M * smoothstep(0.0, uEdgeFade, edge), 0.0, 1.0);
  fragColor = vec4(uColor * M, M);
}`;


const fract = x => x - Math.floor(x);
const hash11 = n => fract(Math.sin(n) * 43758.5453);
function vnoise(px, py, pz) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  const fx = px - ix, fy = py - iy, fz = pz - iz;
  const h = (a, b, c) => hash11((ix + a) * 1 + (iy + b) * 57 + (iz + c) * 113);
  const q = f => f * f * f * (f * (f * 6 - 15) + 10);
  const wx = q(fx), wy = q(fy), wz = q(fz);
  const mix = (a, b, k) => a + (b - a) * k;
  const x00 = mix(h(0, 0, 0), h(1, 0, 0), wx), x10 = mix(h(0, 1, 0), h(1, 1, 0), wx);
  const x01 = mix(h(0, 0, 1), h(1, 0, 1), wx), x11 = mix(h(0, 1, 1), h(1, 1, 1), wx);
  return mix(mix(x00, x10, wy), mix(x01, x11, wy), wz) * 2 - 1;
}
function fbm2(ux, uy, t, scale) {
  let px = ux * scale, py = uy * scale, pz = t;
  let amp = 1, freq = 1, sum = 1;
  for (let i = 0; i < 5; i++) { sum += amp * vnoise(px * freq, py * freq, pz * freq); freq *= 1.25; }
  return sum * 0.5 + 0.5;
}

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const SPEED = 0.65;          // PixelBlast "speed" prop on decodeai.net
const TIME_OFFSET = 37.3;    // fixed seed instead of the site's random offset

export class DotBackground {
  // Every dot is a pixelSize x pixelSize block, so the canvas is rendered at
  // 1/pixelSize resolution (one fragment per dot) and upscaled with
  // nearest-neighbour sampling: identical pixels, 1/16 of the fill cost.
  constructor(canvas, { pixelSize = 4, stageWidth = 1920, stageHeight = 1080 } = {}) {
    canvas.width = Math.round(stageWidth / pixelSize);
    canvas.height = Math.round(stageHeight / pixelSize);
    this.k = canvas.width / stageWidth;
    pixelSize = 1;
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    gl.uniform3f(u('uColor'), 0x3b / 255, 0x82 / 255, 0xf6 / 255);
    gl.uniform1f(u('uPixelSize'), pixelSize);
    gl.uniform1f(u('uPixelJitter'), 0.1);
    gl.uniform1f(u('uEdgeFade'), 0.18);
    gl.uniform2f(u('uResolution'), canvas.width, canvas.height);
    this.pixelSize = pixelSize;
    this.cell = 8 * pixelSize;
    this.x0 = Math.floor(-canvas.width / 2 / this.cell);
    this.y0 = Math.floor(-canvas.height / 2 / this.cell);
    this.cw = Math.floor((canvas.width / 2 - 1) / this.cell) - this.x0 + 1;
    this.ch = Math.floor((canvas.height / 2 - 1) / this.cell) - this.y0 + 1;
    gl.uniform2f(u('uCellOffset'), -this.x0, -this.y0);
    this.feed = new Float32Array(this.cw * this.ch);
    this.tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(u('uFeed'), 0);
    // PixelBlast props used on decodeai.net
    this.p = { scale: 1.75, density: 1.05, rippleSpeed: 0.4, rippleThickness: 0.12, rippleIntensity: 1.5 };
    this.ripples = [];
  }

  // ripple at stage position (x, y from top-left) at video time t
  addRipple(t, x, y) { this.ripples.push({ t, x: x * this.k, y: y * this.k }); }

  render(t) {
    const gl = this.gl, W = this.canvas.width, H = this.canvas.height, p = this.p;
    const uTime = TIME_OFFSET + t * SPEED;
    const aspect = W / H;
    const active = this.ripples.filter(r => r.t <= t).slice(-10).map(r => ({
      // same mapping as the shader's click uv (gl y-up)
      cx: ((r.x - W * 0.5 - this.cell * 0.5) / W) * aspect,
      cy: (((H - r.y) - H * 0.5 - this.cell * 0.5) / H),
      tt: Math.max(uTime - (TIME_OFFSET + r.t * SPEED), 0),
    }));
    for (let j = 0; j < this.ch; j++) {
      for (let i = 0; i < this.cw; i++) {
        const ux = ((this.x0 + i) * this.cell / W) * aspect;
        const uy = (this.y0 + j) * this.cell / H;
        let feed = fbm2(ux, uy, uTime * 0.05, p.scale) * 0.5 - 0.65 + (p.density - 0.5) * 0.3;
        for (const r of active) {
          const d = Math.hypot(ux - r.cx, uy - r.cy);
          const ring = Math.exp(-Math.pow((d - p.rippleSpeed * r.tt) / p.rippleThickness, 2));
          const atten = Math.exp(-r.tt) * Math.exp(-10 * d);
          feed = Math.max(feed, ring * atten * p.rippleIntensity);
        }
        this.feed[j * this.cw + i] = feed;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.cw, this.ch, 0, gl.RED, gl.FLOAT, this.feed);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
