/* =====================================================================
   FISH SCHOOL — avatar visual

   The Nowadays star's swarm, re-tuned as a school: the particles are
   fish bodies that point where they swim, the glow behind them reads as
   water rather than corona, and the wave shader is on by default so the
   whole frame drifts like something seen through a current.

   Same lineage as visuals/nowadays-star (ported from
   src/components/StarCanvas.tsx, p5 2.3.2 instance mode, TypeScript) and
   the same runtime contract: p5 1.11.3 global mode, so it runs in the
   sandboxed avatar iframe exactly as a tenant-delivered script would.
   Only DEFAULTS differ from the star — every knob below is shared, which
   is what makes `shape` worth having instead of two forked sketches.

   Knobs, read from the `data` global the host posts in:

     core        0–100    school spread; also shrinks the slow orbit
     freq        1–3      wobble rate of the fast orbit
     noise       1–100    positional jitter
     hue         75–205   inner colour (p5 HSB hue, 0–255 scale: green → blue → purple)
     hue2        75–205   outer colour
     orbit_mode  clouds | beads
     shape       one or more of circle | ellipse | fish | flower — an array, or a
                 comma string ("circle,fish"), or a single name. With several,
                 particle i is drawn as the (i mod n)th, so the swarm alternates.
     count       4–68     number of fish
     wave        0–100    current: amplitude of the vertical sine shift
     fx_glow     on/off   glow shader (off: flat ground colour under the particles)
     fx_wave     on/off   wave shader
     fx_grain    on/off   grain + chromatic-aberration shader

   Host-only, optional — not participant-facing:

     size        school radius before scaling    (default 120)
     intensity   0–1, how present the school is  (default 1)
     center_y    vertical centre as a fraction   (default 0.5)

   Missing or junk keys fall back to DEFAULTS, so a partial payload
   still renders rather than throwing.
===================================================================== */

// ============================== DEFAULTS =============================
const DEFAULTS = {
  size: 120,
  freq: 2,
  noise: 20,
  core: 50,
  hue: 90,
  hue2: 180,
  orbit_mode: "clouds",
  shape: ["fish"],
  count: 68,
  /* Unlike the star, this one is wavy out of the box — a still school reads
     as a diagram. 35 is enough to see the water without smearing the bodies. */
  wave: 35,
  fx_glow: true,
  fx_wave: true,
  fx_grain: true,
  intensity: 1,
  center_y: 0.5,
};

/* Everything the sketch reads that participants don't touch. Tweak the
   look here rather than in the knobs. Star radius comes from `size`. */
const S = {
  star: {
    x: 0.5,
    /* Display-only multiplier on `size`. Size isn't tunable, so the
       star's on-screen presence lives here instead of in the stored
       value — which keeps already-saved avatars rendering at the same
       scale as new ones. Scales the glow radius, the orbit amplitudes
       and the corona ring together, so the composition holds. */
    scale: 2.8,
    /* Caps the viewport dimension the star is sized against, in px.
       The participant UI is a phone-width column, so past this the star
       would outgrow the layout it's composed with. Below the cap
       nothing changes. */
    maxUnit: 560,
  },
  glow: {
    tone: 1.5,
    thresh: 2,
    fuse: 3,
    blend: 3,
    halo: 0.95,
    grad: 0.3,
    soft: 3,
    sat: 0.8,
    bri: 0.3,
    radBase: 0.5,
    radCore: 0.6,
    base: "#14100e",
  },
  particles: {
    size: 12,
    detail: 10,
    sat: 180,
    coronaR: 140,
    coronaW: 0.45,
    hueSpread: 1.7,
    noiseGain: 2.2,
    noiseSpeed: 0.3,
    noiseOctaves: 4,
    follow: 0.35,
    /* Non-circle shapes keep a constant total area: each one is drawn at
       sqrt(shapeInk / count) times the circle's area-equivalent size, so a few
       shapes are big enough to read and a crowd stays balanced. Clamped to
       [1, shapeMax]. ~2.5x at 14 particles, ~1.1x at 68. */
    shapeInk: 88,
    shapeMax: 3.2,
  },
  post: { ca: 0.01, grain: 0.5, grainDisplace: 5, grainAnimate: true },
  /* Vertical sine shift over the whole composite. Lengths are in design px
     at REF, scaled by `scl` like everything else. `wave` = 100 gives maxAmp. */
  wave: { maxAmp: 60, length: 420, speed: 1.4 },
};
const SHAPE_NAMES = ["circle", "ellipse", "fish", "flower"];
const COUNT_MIN = 4;
const COUNT_MAX = 68;

/** Design resolution — sizes are relative to min(w, h) / REF. */
const REF = 900;
const TAU = Math.PI * 2;

// ============================== SHADERS ==============================
const sceneShaderCode = `
precision highp float;
varying vec2 vTexCoord;
uniform vec2 canvasSize;

uniform vec2  uPos;
uniform vec3  uCol, uColB, uBase;
uniform float uRad;
uniform float uTone, uThresh, uFuse, uBlend, uHalo, uGrad, uSoft;
uniform float uAmt;

void main() {
  vec2 st = vTexCoord;

  // distances in units of min(width, height) — matches the CPU-side scl
  vec2 unit = canvasSize / min(canvasSize.x, canvasSize.y);
  vec2 d = (st - uPos) * unit;

  float f = (uRad * uRad) / (dot(d, d) + 0.0001);

  float iso  = smoothstep(uThresh - uFuse, uThresh + uFuse, f);
  float halo = (1.0 - exp(-f * uBlend)) * uHalo;
  float b    = pow(max(iso, halo), uSoft) * uAmt;

  vec3 c = mix(uColB, uCol, clamp(sqrt(f) * uGrad, 0.0, 1.0));

  vec3  toneCol = vec3(step(1.0, uTone));   // <1 -> black, >=1 -> white
  float toneAmt = abs(uTone - 1.0);

  gl_FragColor = vec4(mix(uBase, mix(c, toneCol, iso * toneAmt), b), 1.0);
}
`;

const postShaderCode = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 texelSize;
uniform float uCA, uGrainAmt, uGrainDisp, uSeed;

float rand(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float softLight(float base, float blend) {
  return (blend < 0.5)
    ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
    : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

void main() {
  vec2 st   = vTexCoord;
  vec2 seed = st + vec2(uSeed, uSeed * 1.7);

  float angle = rand(seed) * 6.28318;
  float dist  = rand(seed + 0.5) * uGrainDisp;
  vec2  p     = st + vec2(cos(angle), sin(angle)) * dist * texelSize;

  vec2 dir = p - 0.5;
  vec2 off = dir * dot(dir, dir) * uCA * 4.0;
  vec3 col = vec3(
    texture2D(tex0, p - off).r,
    texture2D(tex0, p).g,
    texture2D(tex0, p + off).b
  );

  vec3 g = vec3(rand(seed), rand(seed + 0.3), rand(seed + 0.7));
  vec3 lit = vec3(softLight(col.r, g.r), softLight(col.g, g.g), softLight(col.b, g.b));
  gl_FragColor = vec4(mix(col, lit, uGrainAmt), 1.0);
}
`;

/* Aquatic wobble: every column of the finished frame is shifted up/down by
   a sine of its x position, travelling over time. Runs on the whole
   composite (glow + particles), before grain so the grain stays crisp. */
const waveShaderCode = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 canvasSize;
uniform float uAmpPx, uWavePx, uSpeed, uTime;

void main() {
  vec2 st = vTexCoord;
  float phase = (st.x * canvasSize.x) / uWavePx * 6.28318 + uTime * uSpeed;
  float dy = sin(phase) * uAmpPx / canvasSize.y;
  gl_FragColor = vec4(texture2D(tex0, vec2(st.x, st.y + dy)).rgb, 1.0);
}
`;

// ============================ SHAPE MESHES ===========================
/* Each non-circle shape is built once, as a tiny flat mesh, and drawn with a
   single model() call per particle. Shapes are described as triangles in an
   arbitrary unit space, then centred on their centroid and scaled to the
   area of a unit circle, so every shape carries the same visual weight as
   the circle and rotates about its middle. */
function fanTris(cx, cy, ring) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    out.push([[cx, cy], ring[i], ring[(i + 1) % ring.length]]);
  }
  return out;
}

function ringPoints(n, fn) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(fn((i / n) * TAU));
  return pts;
}

const SHAPE_TRIS = {
  // 1:2 ellipse
  ellipse: () => fanTris(0, 0, ringPoints(16, (a) => [Math.cos(a), Math.sin(a) * 0.5])),

  // an oval body, plus a triangle tail whose tip just enters the oval; faces +x
  fish: () =>
    fanTris(0, 0, ringPoints(18, (a) => [Math.cos(a), Math.sin(a) * 0.6])).concat([
      [[-0.86, 0], [-1.6, 0.55], [-1.6, -0.55]],
    ]),

  // five petals: radius swells and dips five times around the circle.
  // 50 samples puts a vertex exactly in each of the 5 notches.
  flower: () =>
    fanTris(
      0,
      0,
      ringPoints(50, (a) => {
        const r = 0.38 + 0.62 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.75);
        return [Math.cos(a) * r, Math.sin(a) * r];
      }),
    ),
};

function meshFromTris(name, tris) {
  let area = 0;
  let mx = 0;
  let my = 0;
  for (const [[ax, ay], [bx, by], [cx, cy]] of tris) {
    const a = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    area += a;
    mx += (a * (ax + bx + cx)) / 3;
    my += (a * (ay + by + cy)) / 3;
  }
  mx /= area;
  my /= area;
  const k = Math.sqrt(Math.PI / area); // unit circle has area PI

  const g = new p5.Geometry();
  g.gid = "nowadays-shape-" + name;
  for (const tri of tris) {
    const base = g.vertices.length;
    for (const [x, y] of tri) g.vertices.push(createVector((x - mx) * k, (y - my) * k, 0));
    g.faces.push([base, base + 1, base + 2]);
  }
  g.computeNormals();
  return g;
}

let shapeMeshes = {};
function buildShapes() {
  shapeMeshes = {};
  for (const name of Object.keys(SHAPE_TRIS)) {
    shapeMeshes[name] = meshFromTris(name, SHAPE_TRIS[name]());
  }
}

// ============================ SKETCH STATE ===========================
let scl = 1;
let vw = 0;
let vh = 0;
let particles = [];
let starX = 0;
let starY = 0;
let sceneShader;
let postShader;
let waveShader;
/** Time of the previous frame, for a frame-rate independent `follow`. */
let prevT = null;
/** Serialized knobs last pushed as uniforms — re-push only when it moves. */
let appliedKey = "";
/** Current eased value of `intensity`. */
let amt = DEFAULTS.intensity;

// ============================== HELPERS ==============================
function hexToRGB(hex) {
  const s = String(hex).replace("#", "");
  const full =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize-on-read: whatever the host posted, merged over DEFAULTS and
 * coerced to the right types. The host clamps against the declared
 * ranges too, but a visual that only renders for well-formed input is a
 * visual that shows a blank canvas the first time something drifts.
 */
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** on/off from whatever the host sent: booleans, 0/1, "false"/"off". */
function flag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return !(v === "" || v === "false" || v === "0" || v === "off");
  }
  return Boolean(value);
}

/** Valid shape names from an array, a "a,b" string or a single name, in the
    order given and without repeats; `fallback` if nothing valid is left. */
function shapeList(value, fallback) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const list = raw
    .map((v) => String(v).trim().toLowerCase())
    .filter((v, i, all) => SHAPE_NAMES.includes(v) && all.indexOf(v) === i);
  return list.length ? list : fallback;
}

function knobs() {
  const raw = typeof data === "object" && data !== null ? data : {};
  return {
    size: num(raw.size, DEFAULTS.size),
    freq: num(raw.freq, DEFAULTS.freq),
    noise: num(raw.noise, DEFAULTS.noise),
    core: num(raw.core, DEFAULTS.core),
    hue: num(raw.hue, DEFAULTS.hue),
    hue2: num(raw.hue2, DEFAULTS.hue2),
    orbit_mode: raw.orbit_mode === "beads" ? "beads" : "clouds",
    shapes: shapeList(raw.shape, shapeList(DEFAULTS.shape, ["circle"])),
    count: Math.round(clamp(num(raw.count, DEFAULTS.count), COUNT_MIN, COUNT_MAX)),
    wave: clamp(num(raw.wave, DEFAULTS.wave), 0, 100),
    fx_glow: flag(raw.fx_glow, DEFAULTS.fx_glow),
    fx_wave: flag(raw.fx_wave, DEFAULTS.fx_wave),
    fx_grain: flag(raw.fx_grain, DEFAULTS.fx_grain),
    intensity: num(raw.intensity, DEFAULTS.intensity),
    center_y: num(raw.center_y, DEFAULTS.center_y),
  };
}

function measure() {
  vw = Math.max(1, windowWidth);
  vh = Math.max(1, windowHeight);
}

function rescale() {
  scl = Math.min(vw, vh, S.star.maxUnit) / REF;
  // uRad is derived from `unit`, so a resize has to re-push uniforms.
  appliedKey = "";
}

function makeParticle() {
  return {
    // Fixed slot on the ring — what `beads` phases both orbits by.
    // Assigned in syncParticles, since it depends on the current count.
    theta: 0,
    a0: random(TAU),
    a1: random(TAU),
    heading: random(TAU),
    nx: random(1000),
    ny: random(1000),
    x: starX,
    y: starY,
    r: 0,
    glow: 0,
  };
}

/** Grow or shrink the swarm to `n`, and re-space the ring slots evenly. */
function syncParticles(n) {
  if (particles.length === n) return;
  while (particles.length < n) particles.push(makeParticle());
  particles.length = n;
  for (let i = 0; i < n; i++) particles[i].theta = (i / n) * TAU;
}

/** HSB hue (0–255) → normalized RGB, at the glow's sat/bri. */
function hueToRGB(hue) {
  const c = color(hue, S.glow.sat * 255, S.glow.bri * 255);
  return [red(c) / 255, green(c) / 255, blue(c) / 255];
}

/** Only runs when the knobs actually changed — not every frame. */
function pushUniforms(u, key) {
  sceneShader.setUniform("uPos", [S.star.x, u.center_y]);
  sceneShader.setUniform("uCol", hueToRGB(u.hue));
  sceneShader.setUniform("uColB", hueToRGB(u.hue2));
  // The shader measures distance in fractions of min(w, h), so convert
  // the capped px radius back into that space.
  sceneShader.setUniform(
    "uRad",
    ((u.size * S.star.scale * scl) / Math.max(1, Math.min(vw, vh))) *
      (S.glow.radBase + (u.core / 100) * S.glow.radCore),
  );
  sceneShader.setUniform("uBase", hexToRGB(S.glow.base));
  sceneShader.setUniform("uTone", S.glow.tone);
  sceneShader.setUniform("uThresh", S.glow.thresh);
  sceneShader.setUniform("uFuse", S.glow.fuse);
  sceneShader.setUniform("uBlend", S.glow.blend);
  sceneShader.setUniform("uHalo", S.glow.halo);
  sceneShader.setUniform("uGrad", S.glow.grad);
  sceneShader.setUniform("uSoft", S.glow.soft);
  sceneShader.setUniform("uAmt", amt);

  waveShader.setUniform("uAmpPx", (u.wave / 100) * S.wave.maxAmp * scl);
  waveShader.setUniform("uWavePx", S.wave.length * scl);
  waveShader.setUniform("uSpeed", S.wave.speed);

  postShader.setUniform("uCA", S.post.ca);
  postShader.setUniform("uGrainAmt", S.post.grain);
  postShader.setUniform("uGrainDisp", S.post.grainDisplace);

  appliedKey = key;
}

function updateParticles(u, t, dt) {
  const P = S.particles;
  const starSize = u.size * S.star.scale * scl;
  // slow orbit shrinks as core rises; fast wobble runs at u.freq
  const ampSlow = starSize * 0.5 * (1 - u.core / 100);
  const ampFast = starSize;
  const jitter = P.noiseGain * u.noise * S.star.scale * scl;
  const nt = t * P.noiseSpeed;
  // `follow` is the fraction of the gap closed per 1/60 s frame. Scaling it
  // by the real frame time keeps the swarm's radius and lag the same on a
  // 30, 60 or 120 Hz screen (at exactly 60 fps this is P.follow unchanged).
  const follow = 1 - Math.pow(1 - P.follow, dt * 60);
  const coronaR = Math.max(P.coronaR * S.star.scale * scl, 0.0001);
  const twoWsq = 2 * P.coronaW * P.coronaW;
  // `beads` phases both orbits by the particle's ring slot instead of
  // its random seeds, so the swarm resolves into an evenly spaced
  // strand travelling around the star.
  const beads = u.orbit_mode === "beads";
  const shapes = u.shapes;

  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    // Alternate through the selected shapes by slot. Slots never move when the
    // count changes, so existing particles keep their shape as others come and go.
    particle.shape = shapes[i % shapes.length];
    // only the shapes with a front need to know which way they are moving
    const steer = particle.shape === "ellipse" || particle.shape === "fish";
    const s0 = t + (beads ? particle.theta : particle.a0);
    const s1 = beads ? u.freq * (t + particle.theta) : u.freq * t + particle.a1;
    const tx =
      starX +
      ampSlow * Math.cos(s0) +
      ampFast * Math.cos(s1) +
      (noise(particle.nx + nt) - 0.5) * jitter;
    const ty =
      starY +
      ampSlow * Math.sin(s0) +
      ampFast * Math.sin(s1) +
      (noise(particle.ny + nt) - 0.5) * jitter;

    const ox = particle.x;
    const oy = particle.y;
    particle.x += (tx - particle.x) * follow;
    particle.y += (ty - particle.y) * follow;
    if (steer) {
      const dx = particle.x - ox;
      const dy = particle.y - oy;
      if (dx * dx + dy * dy > 0.01) {
        const d = Math.atan2(dy, dx) - particle.heading;
        particle.heading += Math.atan2(Math.sin(d), Math.cos(d)) * 0.3; // shortest way round
      }
    }
    particle.r = Math.hypot(particle.x - starX, particle.y - starY) / coronaR;
    particle.glow = Math.exp(-((particle.r - 1) * (particle.r - 1)) / twoWsq);
  }
}

function renderParticles(u, t) {
  const P = S.particles;
  const dot = P.size * S.star.scale * scl;
  const invSpread = 1 / P.hueSpread;
  // With any non-circle shape in play, every shape (circles included) gets the
  // same size boost so a mixed swarm keeps an even visual weight. A swarm of
  // only circles is left at its plain size.
  const anyMesh = u.shapes.some((name) => shapeMeshes[name]);
  const boost = anyMesh
    ? Math.min(P.shapeMax, Math.max(1, Math.sqrt(P.shapeInk / particles.length)))
    : 1;
  const circleDot = dot * boost;
  const meshScale = (dot / 2) * boost;

  for (const particle of particles) {
    if (particle.glow * amt < 0.004) continue; // below 1/255, nothing to draw
    const g = 255 * particle.glow * amt;
    fill(lerp(u.hue, u.hue2, Math.min(1, particle.r * invSpread)), P.sat, g, g);
    const mesh = shapeMeshes[particle.shape]; // undefined for the circle
    if (!mesh) {
      ellipse(particle.x, particle.y, circleDot, circleDot, P.detail);
      continue;
    }
    push();
    translate(particle.x, particle.y);
    // flowers turn slowly on the spot; ellipses and fish point where they swim
    rotate(particle.shape === "flower" ? particle.a0 + t * 0.8 : particle.heading);
    scale(meshScale);
    model(mesh);
    pop();
  }
}

// =============================== SKETCH ==============================
setup = () => {
  measure();
  createCanvas(vw, vh, WEBGL);
  pixelDensity(1);
  colorMode(HSB, 255);
  noStroke();
  noiseDetail(S.particles.noiseOctaves, 0.5);
  rescale();

  amt = knobs().intensity;

  sceneShader = createFilterShader(sceneShaderCode);
  postShader = createFilterShader(postShaderCode);
  waveShader = createFilterShader(waveShaderCode);

  buildShapes();
  syncParticles(knobs().count);
};

windowResized = () => {
  measure();
  resizeCanvas(vw, vh);
  rescale();
};

draw = () => {
  const u = knobs();
  const t = millis() / 1000;

  // With the glow shader on, its pass overwrites this (it only clears the
  // depth buffer). With it off, this is the ground the particles sit on.
  background(u.fx_glow ? 0 : S.glow.base);

  const key =
    u.size +
    "|" + u.freq +
    "|" + u.noise +
    "|" + u.core +
    "|" + u.hue +
    "|" + u.hue2 +
    "|" + u.orbit_mode +
    "|" + u.center_y +
    "|" + u.wave;
  if (key !== appliedKey) pushUniforms(u, key);

  // Ease toward the requested intensity; only touch the uniform while
  // it's actually moving, so a settled star stays a knobs-only push.
  if (amt !== u.intensity) {
    amt =
      Math.abs(u.intensity - amt) < 0.002
        ? u.intensity
        : amt + (u.intensity - amt) * 0.06;
    sceneShader.setUniform("uAmt", amt);
  }
  if (u.fx_glow) filter(sceneShader);

  translate(-width / 2, -height / 2, 0);
  starX = S.star.x * width;
  starY = u.center_y * height;
  syncParticles(u.count);
  const dt = clamp(prevT === null ? 1 / 60 : t - prevT, 1 / 240, 0.1);
  prevT = t;
  updateParticles(u, t, dt);
  renderParticles(u, t);

  if (u.fx_wave && u.wave > 0) {
    waveShader.setUniform("uTime", t);
    filter(waveShader);
  }

  if (u.fx_grain) {
    if (S.post.grainAnimate) {
      postShader.setUniform("uSeed", (frameCount * 0.618034) % 1);
    }
    filter(postShader);
  }
};

