/* =====================================================================
   NOWADAYS STAR — avatar visual

   Ported from src/components/StarCanvas.tsx (p5 2.3.2, instance mode,
   TypeScript) to p5 1.11.3 global mode, so it runs in the sandboxed
   avatar iframe exactly as a tenant-delivered script would.

   Knobs, read from the `data` global the host posts in:

     core        0–100    corona size; also shrinks the slow orbit
     freq        1–6      wobble rate of the fast orbit
     noise       1–100    positional jitter
     hue         0–255    inner colour (HSB hue, p5's 0–255 scale)
     hue2        0–255    outer colour
     orbit_mode  clouds | beads

   Host-only, optional — not participant-facing:

     size        star radius before scaling      (default 120)
     intensity   0–1, how present the star is    (default 1)
     center_y    vertical centre as a fraction   (default 0.5)

   Missing or junk keys fall back to DEFAULTS, so a partial payload
   still renders rather than throwing.
===================================================================== */

// ============================== DEFAULTS =============================
const DEFAULTS = {
  size: 120,
  freq: 5,
  noise: 20,
  core: 50,
  hue: 69,
  hue2: 0,
  orbit_mode: "clouds",
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
    num: 100,
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
  },
  post: { ca: 0.01, grain: 0.5, grainDisplace: 5, grainAnimate: true },
};

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

// ============================ SKETCH STATE ===========================
let scl = 1;
let vw = 0;
let vh = 0;
let particles = [];
let starX = 0;
let starY = 0;
let sceneShader;
let postShader;
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

function makeParticle(i) {
  return {
    // Fixed slot on the ring — what `beads` phases both orbits by.
    theta: (i / S.particles.num) * TAU,
    a0: random(TAU),
    a1: random(TAU),
    nx: random(1000),
    ny: random(1000),
    x: starX,
    y: starY,
    r: 0,
    glow: 0,
  };
}

function spawnParticles() {
  particles = [];
  for (let i = 0; i < S.particles.num; i++) particles.push(makeParticle(i));
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

  postShader.setUniform("uCA", S.post.ca);
  postShader.setUniform("uGrainAmt", S.post.grain);
  postShader.setUniform("uGrainDisp", S.post.grainDisplace);

  appliedKey = key;
}

function updateParticles(u, t) {
  const P = S.particles;
  const starSize = u.size * S.star.scale * scl;
  // slow orbit shrinks as core rises; fast wobble runs at u.freq
  const ampSlow = starSize * 0.5 * (1 - u.core / 100);
  const ampFast = starSize;
  const jitter = P.noiseGain * u.noise * S.star.scale * scl;
  const nt = t * P.noiseSpeed;
  const coronaR = Math.max(P.coronaR * S.star.scale * scl, 0.0001);
  const twoWsq = 2 * P.coronaW * P.coronaW;
  // `beads` phases both orbits by the particle's ring slot instead of
  // its random seeds, so the swarm resolves into an evenly spaced
  // strand travelling around the star.
  const beads = u.orbit_mode === "beads";

  for (const particle of particles) {
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

    particle.x += (tx - particle.x) * P.follow;
    particle.y += (ty - particle.y) * P.follow;
    particle.r = Math.hypot(particle.x - starX, particle.y - starY) / coronaR;
    particle.glow = Math.exp(-((particle.r - 1) * (particle.r - 1)) / twoWsq);
  }
}

function renderParticles(u) {
  const P = S.particles;
  const dot = P.size * S.star.scale * scl;
  const invSpread = 1 / P.hueSpread;

  for (const particle of particles) {
    if (particle.glow * amt < 0.004) continue; // below 1/255, nothing to draw
    const g = 255 * particle.glow * amt;
    fill(lerp(u.hue, u.hue2, Math.min(1, particle.r * invSpread)), P.sat, g, g);
    ellipse(particle.x, particle.y, dot, dot, P.detail);
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

  spawnParticles();
};

windowResized = () => {
  measure();
  resizeCanvas(vw, vh);
  rescale();
};

draw = () => {
  const u = knobs();
  const t = millis() / 1000;

  // colour is irrelevant (pass 1 overwrites it) — this clears the depth buffer
  background(0);

  const key =
    u.size +
    "|" + u.freq +
    "|" + u.noise +
    "|" + u.core +
    "|" + u.hue +
    "|" + u.hue2 +
    "|" + u.orbit_mode +
    "|" + u.center_y;
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
  filter(sceneShader);

  translate(-width / 2, -height / 2, 0);
  starX = S.star.x * width;
  starY = u.center_y * height;
  updateParticles(u, t);
  renderParticles(u);

  if (S.post.grainAnimate) {
    postShader.setUniform("uSeed", (frameCount * 0.618034) % 1);
  }
  filter(postShader);
};
