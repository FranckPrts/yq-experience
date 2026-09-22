# Starter avatar visual

A working sketch and its declaration. Edit `sketch.js`, adjust
`parameters.json` to match, and upload both back to your project.

```
sketch.js         the p5 sketch
parameters.json   the controls the participant gets
```

## The contract

**Global mode.** Assign `setup`, `draw` and `windowResized` without
`const`/`let`/`function`. The host wraps your code in a block, so a declaration
would stay trapped inside it — `setup = () => {}` works, `function setup() {}`
does not.

**p5 1.11.3 is loaded for you.** Do not add your own `<script>` tag. That
version matches YouQuantified's editor, so a sketch that runs there runs here.

**Your knobs arrive in a global called `data`,** keyed by each entry's `name` in
`parameters.json`. It is replaced wholesale whenever a control moves, so read it
inside `draw` rather than copying it at setup time.

**Read defensively.** The `knobs()` helper merges whatever arrived over a full
set of defaults. A visual that only renders for well-formed input will show a
blank canvas the first time anything drifts.

**Errors are relayed** to the host automatically. `sendEvent({ log: { message,
type: "error" } })` reports something deliberately.

## Parameter types

| `type` | Control | Value |
| --- | --- | --- |
| `continuous` | slider, float steps | number |
| `discrete` | slider, whole steps | number |
| `select` | pick one | string |
| `multiselect` | pick any | array of strings |
| `toggle` | on / off | boolean |
| `text` | a question, not a control | string |

A `text` entry is stored as an **answer** and never reaches the sketch.
Everything else is render input and arrives in `data`.

Order is the order the participant sees.

## Two tiers, and one gate

`advanced: true` sorts a control under an **additional parameters** heading —
presentation only; the value is stored, coerced and posted exactly like any
other.

`enabledBy: "<toggle name>"` makes a control belong to a toggle: it greys out
when the toggle is off, and keeps its value so turning the toggle back on
restores what was set. Gates are one level deep — a toggle gated by a toggle is
a state machine, not a control panel, and is rejected.

## Domain vs. offered range

`min`/`max` are your sketch's **full domain** — what it accepts, and therefore
what a value *means*. `truncatedScale` narrows what the participant can reach
without moving the domain.

That separation is what makes a truncated hue work. `hue` here declares 0–255,
the whole wheel, and truncates to 0–60, so only warm colours are on offer —
while hue 30 stays exactly the orange it would be untruncated. Narrowing
`min`/`max` directly would rescale every value along with the bounds, and the
slider would still span the whole wheel.

## Host-only knobs

`size`, `intensity` and `center_y` are supplied by the host, not the
participant, and are not declared. Honour them if you can — `intensity` is how
the avatar fades in.

## Shaders

Inline the GLSL as a string in `sketch.js` and use `createFilterShader`, as the
Nowadays star and fish school both do. `loadShader()` cannot work here: the
sketch runs in a sandboxed frame with an opaque origin, so there is no base URL
for a relative path to resolve against and nothing to fetch from.

## Checking your work

Upload and the platform validates the declaration, then cross-checks it against
the sketch and warns about names declared but never read, or read but never
declared.
