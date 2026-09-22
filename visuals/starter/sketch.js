/* =====================================================================
   STARTER — a minimal avatar visual

   A working sketch you can edit, and a worked example of the contract
   every avatar script follows. It deliberately uses no shaders and the
   default 2D renderer: WEBGL is available, but nothing here needs it.

   ── The contract ────────────────────────────────────────────────────

   1. Global mode. Assign `setup`, `draw` and (optionally)
      `windowResized` without `const`/`let`/`function` — the host wraps
      your code in a block, so a declaration would stay trapped inside
      it. `setup = () => {}` is right; `function setup() {}` is not.

   2. p5 1.11.3, loaded for you. Do not include your own <script> tag.

   3. Your knobs arrive in a global called `data`, keyed by the `name`
      of each entry in parameters.json. It is replaced wholesale
      whenever the participant moves a control, so read it inside
      `draw` — never copy it into a variable at setup time.

   4. Read defensively. `knobs()` below merges whatever arrived over a
      full set of defaults, so a missing or nonsense value renders
      something rather than throwing. A visual that only works for
      well-formed input shows a blank canvas the first time anything
      drifts.

   5. `sendEvent({ log: { message, type: "error" } })` reports back to
      the host if you need it. Uncaught errors are relayed for you.

   ── Host-only knobs ─────────────────────────────────────────────────

   `size`, `intensity` and `center_y` are supplied by the host rather
   than by the participant, and are not declared in parameters.json.
   Honour them if you can: `intensity` is how the avatar fades in.
===================================================================== */

// Every declared parameter appears here with the same default as
// parameters.json, plus the three host-only ones.
const DEFAULTS = {
  count: 12,
  radius: 60,
  spin: 1,
  hue: 30,
  shape: "circle",
  fx_trail: true,
  trail: 40,
  wobble: 20,
  // host-only
  size: 120,
  intensity: 1,
  center_y: 0.5,
};

const SHAPES = ["circle", "square", "diamond"];
const TAU = Math.PI * 2;

let amt = DEFAULTS.intensity;

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** on/off from a boolean, 0/1, or "off"/"false" — all of which can arrive. */
function flag(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return !(v === "" || v === "false" || v === "0" || v === "off");
  }
  return Boolean(value);
}

/** Normalize-on-read. Everything the sketch uses comes through here. */
function knobs() {
  const raw = typeof data === "object" && data !== null ? data : {};
  return {
    count: Math.round(num(raw.count, DEFAULTS.count)),
    radius: num(raw.radius, DEFAULTS.radius),
    spin: num(raw.spin, DEFAULTS.spin),
    hue: num(raw.hue, DEFAULTS.hue),
    shape: SHAPES.includes(raw.shape) ? raw.shape : DEFAULTS.shape,
    fx_trail: flag(raw.fx_trail, DEFAULTS.fx_trail),
    trail: num(raw.trail, DEFAULTS.trail),
    wobble: num(raw.wobble, DEFAULTS.wobble),
    size: num(raw.size, DEFAULTS.size),
    intensity: num(raw.intensity, DEFAULTS.intensity),
    center_y: num(raw.center_y, DEFAULTS.center_y),
  };
}

setup = () => {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 255);
  noStroke();
  rectMode(CENTER);
  amt = knobs().intensity;
};

windowResized = () => {
  resizeCanvas(windowWidth, windowHeight);
};

draw = () => {
  const u = knobs();
  const t = millis() / 1000;

  // The trail toggle governs whether the frame is cleared outright or
  // painted over — which is what `trail` controls, and why that slider
  // is declared with `enabledBy: "fx_trail"`.
  if (u.fx_trail) {
    // Higher `trail` = fainter veil = longer tails.
    fill(0, 0, 20, map(u.trail, 0, 100, 255, 8));
    rect(width / 2, height / 2, width, height);
  } else {
    background(20);
  }

  // Ease toward the host's requested presence, so the avatar fades in
  // rather than appearing all at once.
  amt += (u.intensity - amt) * 0.06;

  const cx = width / 2;
  const cy = height * u.center_y;
  // `size` is the host's overall scale; the declared `radius` is the
  // participant's, and the two multiply.
  const unit = (Math.min(width, height) / 900) * (u.size / 120);
  const ring = u.radius * unit * 2.2;
  const dot = 14 * unit * 2.2;

  for (let i = 0; i < u.count; i++) {
    const a = (i / u.count) * TAU + t * u.spin * 0.4;
    // A little noise so the ring breathes instead of sitting still.
    const jitter = (noise(i * 0.4, t * 0.3) - 0.5) * u.wobble * unit * 2.2;
    const x = cx + Math.cos(a) * (ring + jitter);
    const y = cy + Math.sin(a) * (ring + jitter);

    // A gentle drift around the ring, so the colour reads as a range rather
    // than a flat fill. Kept small on purpose: `hue` is declared with a
    // truncatedScale of 0–60, and a drift wide enough to leave that band
    // would make the control look like it was not doing what it says.
    const hue = (u.hue + (i / u.count) * 18) % 255;
    fill(hue, 180, 255, 255 * amt);

    if (u.shape === "square") {
      rect(x, y, dot, dot);
    } else if (u.shape === "diamond") {
      push();
      translate(x, y);
      rotate(Math.PI / 4);
      rect(0, 0, dot, dot);
      pop();
    } else {
      ellipse(x, y, dot, dot);
    }
  }
};
