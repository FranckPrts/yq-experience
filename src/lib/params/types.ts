/**
 * The parameter declaration that accompanies a delivered p5 script.
 *
 * One list drives three things: the controls a participant is given, the
 * questions they are asked, and the coercion applied to whatever comes back
 * out of the database. `type` also decides where a value is stored — `text`
 * entries are answers (`avatars.answers`), everything else is render input
 * (`avatars.params`) and is what the sketch reads out of its `data` global.
 *
 * Shaped to match the script-plus-JSON package we expect to receive one day,
 * so adopting that later is an importer rather than a migration.
 */

export type ParameterType =
  | "continuous"
  | "discrete"
  | "select"
  | "multiselect"
  | "toggle"
  | "text";

type Base = {
  /** The key the sketch reads out of `data`. */
  name: string;
  /** What the participant sees next to the control. */
  label: string;
  /** Longer name or help text; not shown in the terminal rows. */
  description?: string;
  /**
   * Sorts the control below the everyday ones, under an "additional
   * parameters" heading. Presentation only: an advanced parameter is stored,
   * coerced and posted to the sketch exactly like any other, and the value is
   * no less the participant's for sitting further down.
   *
   * Grouping is deliberately a flag rather than a free-form section name —
   * there are two tiers because a participant meets two kinds of choice, the
   * ones that make the avatar theirs and the ones that tune how it is staged.
   */
  advanced?: boolean;
  /**
   * The `name` of a `toggle` this control depends on. While that toggle is
   * off, the control is shown disabled rather than hidden, so what the switch
   * governs stays legible — and the value is left untouched, so flipping the
   * switch back restores what was set rather than a default.
   *
   * One level only: the named toggle may not itself be gated. A chain of
   * switches is a state machine the participant has to hold in their head,
   * and `validate` rejects it.
   */
  enabledBy?: string;
};

type NumericBase = Base & {
  /**
   * The parameter's **full domain** — everything the sketch is prepared to
   * accept, and therefore what a value means. A p5 HSB hue is 0–255, and 0–255
   * is what maps onto the whole colour wheel.
   *
   * This documents the script's contract. What a participant may actually
   * reach is `truncatedScale`'s business, not this.
   */
  min: number;
  max: number;
  step?: number;
  default: number;
  /** Renders the slider track as the hue ramp the value maps to. */
  display?: "hue";
  /**
   * Narrows what the participant can reach, without changing what the values
   * mean. `min: 0, max: 255` with `truncatedScale: { min: 75, max: 205 }`
   * offers green through purple only — and 90 is still exactly the green it
   * would have been untruncated, because the domain never moved.
   *
   * Holding the two apart is the whole trick. Narrowing `min`/`max` directly
   * would rescale the meaning of every value along with the bounds, so a hue
   * ramp would go on showing the entire wheel however tightly it was
   * bounded — the opposite of truncating it.
   *
   * Applies to any numeric parameter, not just hue: it is equally the way to
   * offer a subset of a count or a speed the sketch supports more widely.
   * Omit it for a parameter offered across its full domain.
   */
  truncatedScale?: { min: number; max: number };
};

/** Float-stepped slider. */
export type ContinuousParameter = NumericBase & { type: "continuous" };

/** Integer-stepped slider. Same control, snapped to whole steps. */
export type DiscreteParameter = NumericBase & { type: "discrete" };

export type SelectParameter = Base & {
  type: "select";
  options: { value: string; label: string }[];
  default: string;
};

/**
 * Pick any number of the options. The value is an array, which the sketch
 * receives as an array — JSON survives the postMessage hop unchanged.
 * Stored order follows the declaration, not the order they were clicked, so
 * the same selection always serializes identically.
 */
export type MultiSelectParameter = Base & {
  type: "multiselect";
  options: { value: string; label: string }[];
  default: string[];
  minSelected?: number;
  maxSelected?: number;
};

/**
 * On or off. The sketches already speak this dialect — `knobs()` runs every
 * `fx_*` key through a `flag()` helper that accepts booleans, 0/1 and
 * "off"/"false" — so declaring one costs the script nothing. `coerce` narrows
 * to a real boolean on the way in, and JSON carries it through the postMessage
 * hop unchanged.
 */
export type ToggleParameter = Base & {
  type: "toggle";
  default: boolean;
};

export type TextParameter = Base & {
  type: "text";
  placeholder?: string;
  maxLength?: number;
  default: string;
};

export type Parameter =
  | ContinuousParameter
  | DiscreteParameter
  | SelectParameter
  | MultiSelectParameter
  | ToggleParameter
  | TextParameter;

export type NumericParameter = ContinuousParameter | DiscreteParameter;

export type ParameterValue = number | string | string[] | boolean;

/**
 * What a participant can actually reach: the truncation if there is one, the
 * full domain otherwise. Controls and coercion both work in this range.
 */
export function effectiveRange(param: NumericParameter): {
  min: number;
  max: number;
} {
  const t = param.truncatedScale;
  if (!t) return { min: param.min, max: param.max };
  // Never let a truncation widen the domain — it can only narrow it.
  return {
    min: Math.max(param.min, t.min),
    max: Math.min(param.max, t.max),
  };
}

/**
 * Degrees on the colour wheel for a hue value, measured against the **full
 * domain**. Reading it from the domain rather than the offered range is what
 * makes truncation mean fewer colours instead of the same colours compressed.
 */
export function hueDegrees(param: NumericParameter, value: number): number {
  const span = param.max - param.min || 1;
  return ((((value - param.min) / span) * 360) % 360 + 360) % 360;
}

/** What a script is delivered with. */
export type VisualDefinition = {
  parameters: Parameter[];
  lexicon?: { noun: string; nounPlural: string };
};

export function isNumeric(param: Parameter): param is NumericParameter {
  return param.type === "continuous" || param.type === "discrete";
}

/**
 * Whether `param`'s control should accept input, given the values around it.
 * Ungated parameters are always enabled; a gated one follows its toggle, and a
 * gate naming something that isn't there is treated as open rather than
 * silently locking a control the participant can do nothing about.
 */
export function isEnabled(
  param: Parameter,
  values: Record<string, ParameterValue>,
): boolean {
  if (!param.enabledBy) return true;
  const gate = values[param.enabledBy];
  return gate === undefined ? true : gate !== false;
}

/** Render input — what the sketch receives. Excludes `text` answers. */
export function isRenderParam(param: Parameter): boolean {
  return param.type !== "text";
}
