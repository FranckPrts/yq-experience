import type { Parameter, ParameterType } from "./types";

/**
 * A usable parameter of each type — what the builder inserts when you add a row
 * or switch a type.
 *
 * Every one is **valid on arrival**: a freshly added parameter must not put the
 * whole declaration into an error state, or adding a row would feel like
 * breaking something. Defaults sit inside their ranges, selects have options,
 * and names are unique-ised by the caller.
 */
export function blankParameter(type: ParameterType, name: string): Parameter {
  const base = { name, label: name, description: "" };

  switch (type) {
    case "continuous":
      return { ...base, type, min: 0, max: 1, step: 0.1, default: 0.5 };
    case "discrete":
      return { ...base, type, min: 0, max: 100, step: 1, default: 50 };
    case "select":
      return {
        ...base,
        type,
        options: [
          { value: "one", label: "one" },
          { value: "two", label: "two" },
        ],
        default: "one",
      };
    case "multiselect":
      return {
        ...base,
        type,
        options: [
          { value: "one", label: "one" },
          { value: "two", label: "two" },
        ],
        default: ["one"],
        minSelected: 1,
      };
    case "toggle":
      return { ...base, type, default: true };
    case "text":
      return { ...base, type, default: "", maxLength: 40 };
  }
}

/** `hue`, `hue_2`, `hue_3`… — never a duplicate, which validation rejects. */
export function uniqueName(desired: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = desired.trim() || "parameter";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
