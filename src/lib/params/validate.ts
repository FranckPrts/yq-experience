import type { Parameter, VisualDefinition } from "./types";

/**
 * Checks a declaration before it is stored.
 *
 * A malformed entry is close to invisible at render time — the control simply
 * does not appear, or a slider silently clamps everything to its default — so
 * the upload path is the right place to be loud about it. This is also what
 * Phase 2's builder validates against, and what an imported script-plus-JSON
 * package will have to satisfy.
 */

const TYPES = [
  "continuous",
  "discrete",
  "select",
  "multiselect",
  "toggle",
  "text",
];

export function validateParameters(parameters: unknown): string[] {
  const errors: string[] = [];

  if (!Array.isArray(parameters)) return ["`parameters` must be an array"];
  if (parameters.length === 0) errors.push("`parameters` is empty");

  const seen = new Set<string>();
  // Gates are checked in a second pass: `enabledBy` may point at a toggle
  // declared later, and an unresolvable gate has to be reported as such
  // rather than as a missing name.
  const toggles = new Map<string, { gated: boolean }>();
  parameters.forEach((raw) => {
    const p = raw as Partial<Parameter> & Record<string, unknown>;
    if (p?.type === "toggle" && typeof p.name === "string") {
      toggles.set(p.name, { gated: typeof p.enabledBy === "string" });
    }
  });

  parameters.forEach((raw, i) => {
    const p = raw as Partial<Parameter> & Record<string, unknown>;
    const where = `parameters[${i}]${p?.name ? ` (${p.name})` : ""}`;

    if (typeof p?.name !== "string" || !p.name.trim()) {
      errors.push(`${where}: missing \`name\``);
    } else if (seen.has(p.name)) {
      // Two entries writing the same key means one silently wins in `data`.
      errors.push(`${where}: duplicate name "${p.name}"`);
    } else {
      seen.add(p.name);
    }

    if (typeof p?.label !== "string" || !p.label.trim()) {
      errors.push(`${where}: missing \`label\``);
    }
    if (typeof p?.type !== "string" || !TYPES.includes(p.type)) {
      errors.push(`${where}: \`type\` must be one of ${TYPES.join(", ")}`);
      return; // the checks below all depend on a known type
    }

    if (p.advanced !== undefined && typeof p.advanced !== "boolean") {
      errors.push(`${where}: \`advanced\` must be a boolean`);
    }

    if (p.enabledBy !== undefined) {
      const gate = p.enabledBy;
      if (typeof gate !== "string" || !gate.trim()) {
        errors.push(`${where}: \`enabledBy\` must be a parameter name`);
      } else if (gate === p.name) {
        errors.push(`${where}: \`enabledBy\` cannot name itself`);
      } else if (!toggles.has(gate)) {
        // Either the name is wrong or it points at a slider, and both would
        // leave a control that never enables.
        errors.push(
          `${where}: \`enabledBy\` "${gate}" is not a declared toggle`,
        );
      } else if (toggles.get(gate)!.gated) {
        errors.push(
          `${where}: \`enabledBy\` "${gate}" is itself gated — chains are not allowed`,
        );
      }
    }

    if (p.type === "continuous" || p.type === "discrete") {
      const { min, max, step, default: def, display } = p as never as {
        min: unknown; max: unknown; step?: unknown;
        default: unknown; display?: unknown;
      };
      const truncated = (p as { truncatedScale?: unknown }).truncatedScale;

      const domainOk = typeof min === "number" && typeof max === "number";
      if (!domainOk) {
        errors.push(`${where}: \`min\` and \`max\` must be numbers`);
      } else if (min >= max) {
        errors.push(`${where}: \`min\` (${min}) must be below \`max\` (${max})`);
      }
      if (step !== undefined && (typeof step !== "number" || step <= 0)) {
        errors.push(`${where}: \`step\` must be a positive number`);
      }
      if (display !== undefined && display !== "hue") {
        errors.push(`${where}: \`display\` may only be "hue"`);
      }

      // Effective bounds — what a participant can reach, and therefore what
      // the default has to sit inside.
      let lo = domainOk ? (min as number) : Number.NEGATIVE_INFINITY;
      let hi = domainOk ? (max as number) : Number.POSITIVE_INFINITY;

      if (truncated !== undefined) {
        const t = truncated as { min?: unknown; max?: unknown };
        if (
          typeof t?.min !== "number" ||
          typeof t?.max !== "number"
        ) {
          errors.push(
            `${where}: \`truncatedScale\` needs numeric \`min\` and \`max\``,
          );
        } else if (t.min >= t.max) {
          errors.push(
            `${where}: \`truncatedScale.min\` (${t.min}) must be below \`max\` (${t.max})`,
          );
        } else if (domainOk && (t.min < (min as number) || t.max > (max as number))) {
          // A truncation that reaches outside the domain is a contradiction:
          // it would offer values the sketch never promised to accept.
          errors.push(
            `${where}: \`truncatedScale\` ${t.min}–${t.max} falls outside the domain ${min}–${max}`,
          );
        } else {
          lo = t.min;
          hi = t.max;
        }
      }

      if (typeof def !== "number") {
        errors.push(`${where}: \`default\` must be a number`);
      } else if (def < lo || def > hi) {
        errors.push(
          `${where}: \`default\` ${def} is outside the offered range ${lo}–${hi}`,
        );
      }
    }

    if (p.type === "select" || p.type === "multiselect") {
      const options = (p as { options?: unknown }).options;
      if (!Array.isArray(options) || options.length === 0) {
        errors.push(`${where}: \`options\` must be a non-empty array`);
        return;
      }
      const values = new Set<string>();
      options.forEach((o, j) => {
        const opt = o as { value?: unknown; label?: unknown };
        if (typeof opt?.value !== "string" || typeof opt?.label !== "string") {
          errors.push(`${where}.options[${j}]: needs string \`value\` and \`label\``);
          return;
        }
        if (values.has(opt.value)) {
          errors.push(`${where}.options[${j}]: duplicate value "${opt.value}"`);
        }
        values.add(opt.value);
      });

      const def = (p as { default?: unknown }).default;
      if (p.type === "select") {
        if (typeof def !== "string" || !values.has(def)) {
          errors.push(`${where}: \`default\` must be one of the option values`);
        }
      } else {
        if (!Array.isArray(def) || def.some((d) => !values.has(String(d)))) {
          errors.push(`${where}: \`default\` must be an array of option values`);
        } else {
          const { minSelected, maxSelected } = p as never as {
            minSelected?: number; maxSelected?: number;
          };
          if (minSelected != null && def.length < minSelected) {
            errors.push(
              `${where}: \`default\` has ${def.length} entries, below minSelected ${minSelected}`,
            );
          }
          if (maxSelected != null && def.length > maxSelected) {
            errors.push(
              `${where}: \`default\` has ${def.length} entries, above maxSelected ${maxSelected}`,
            );
          }
        }
      }
    }

    if (p.type === "toggle") {
      const def = (p as { default?: unknown }).default;
      if (typeof def !== "boolean") {
        errors.push(`${where}: \`default\` must be true or false`);
      }
    }

    if (p.type === "text") {
      const def = (p as { default?: unknown }).default;
      if (typeof def !== "string") {
        errors.push(`${where}: \`default\` must be a string`);
      }
    }
  });

  return errors;
}

export function assertValidDefinition(definition: VisualDefinition): void {
  const errors = validateParameters(definition.parameters);
  if (errors.length) {
    throw new Error(
      `Invalid parameter declaration:\n  - ${errors.join("\n  - ")}`,
    );
  }
}
