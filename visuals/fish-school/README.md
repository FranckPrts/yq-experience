# fish-school

A p5 school of fish, driven by `parameters.json`. Runs under p5 1.11.3 in the
sandboxed avatar frame, WEBGL, three `createFilterShader` passes, no external
assets and no `extensions`.

This file holds the reasoning that used to live in comments inside a
`parameters.js` module. The declaration is now plain JSON, because a declaration
is **data that gets loaded, never code that gets executed** — the upload path
must never `import()` a delivered file, and keeping every visual on JSON means
the local CLI and the eventual Phase 2 upload behave identically.

## How the declaration drives things

One list drives three things: the controls the participant gets, the questions
they are asked, and the coercion applied on the way back out of the database
(`src/lib/params/coerce.ts`). `type` also decides where a value lives — `text`
entries are answers (`avatars.answers`), everything else is render input
(`avatars.params`) and reaches the sketch's `data` global.

Order is the order the participant sees.

## Domain vs. offered range

`min`/`max` are the sketch's **full domain** — what `sketch.js` is prepared to
accept, and therefore what a value *means*. `truncatedScale` narrows what is
actually on offer without moving the domain, so a value keeps its meaning.

That separation is the point. `hue` and `hue2` declare a domain of 0–255, the
full p5 HSB wheel, and truncate to **75–205**, which offers green → blue →
purple only: a school with a red fish in it stops being underwater. Because the
domain is untouched, hue 90 is still exactly the green it would be on an
untruncated parameter, and the slider shows a short ramp of real colours rather
than the whole wheel squeezed into a narrow track.

Had the narrowing been done by setting `min: 75, max: 205` directly, every value
would have been rescaled along with the bounds and the ramp would still have
spanned the entire wheel — the opposite of truncating it.

The same key works on any numeric parameter, not just hue.

## Per-parameter notes

| Parameter | Note |
| --- | --- |
| `count` | 68 is the sketch's own ceiling (`COUNT_MAX`) — past it the swarm costs more than it reads. The floor of 4 keeps a school a plural thing. |
| `shape` | Declaration order is what `coerce` stores, so listing `fish` first means the common case serializes as `["fish"]` rather than depending on click order. `minSelected: 1` stops an empty school. |
| `noise` | The sketch clamps 1–100 because it must render whatever the host posts; the declaration is where the narrower, art-directed range would live if one were wanted. |
| `hue`, `hue2` | See above. |

## Deliberately not declared

| Key | Why |
| --- | --- |
| `fx_glow`, `fx_wave`, `fx_grain` | Shader toggles. There is no boolean parameter type, and these are staging decisions rather than choices about one's own avatar. They stay at the sketch's defaults (all on) and are exposed in `index.html` for tuning only. |
| `size`, `intensity`, `center_y` | Host-only composition, same as the star. `AvatarCanvas` sends only declared parameters, so these fall to the sketch's defaults — which `knobs()` is written to expect. |

## Checking it

```sh
npx tsx scripts/check-visual.mts visuals/fish-school
```

Loads the declaration, validates it, and reports which declared parameters the
sketch reads and which keys the sketch reads that are left to its own defaults.
