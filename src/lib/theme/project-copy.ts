/**
 * The words a participant reads — the "HTML" half of the style bucket, as plain
 * text.
 *
 * Plain text on purpose. This copy is rendered on *our* page, outside the
 * sandbox that contains tenant p5, so tenant-written HTML would carry the same
 * risk as tenant code with none of the containment. React escapes text, which
 * makes every string here inert however it is written. Line breaks are kept.
 *
 * Diagnostic messages — the rate limit, an unreachable database — are
 * deliberately not in here. They tell someone what to do when something is
 * broken, and a tenant rewording them would make that harder, not easier.
 *
 * Every default is the wording the page already used, so an untouched project
 * reads exactly as before.
 */

export const COPY_FIELDS = {
  introTitle: {
    group: "welcome",
    label: "heading",
    default: "Make your {noun}",
    multiline: false,
  },
  introBody: {
    group: "welcome",
    label: "text",
    default:
      "Answer a question, then shape it with the controls. When you save it, your {noun} joins the others.",
    multiline: true,
  },
  introButton: {
    group: "welcome",
    label: "button",
    default: "begin",
    multiline: false,
  },
  loading: {
    group: "making it",
    label: "while loading",
    default: "finding your {noun}…",
    multiline: false,
  },
  nextButton: {
    group: "making it",
    label: "after the questions",
    default: "next",
    multiline: false,
  },
  saveButton: {
    group: "making it",
    label: "save, first time",
    default: "save my {noun}",
    multiline: false,
  },
  saveChangesButton: {
    group: "making it",
    label: "save, afterwards",
    default: "save changes",
    multiline: false,
  },
  backButton: {
    group: "making it",
    label: "back",
    default: "back",
    multiline: false,
  },
  savedTitle: {
    group: "once saved",
    label: "heading",
    default: "Your {noun} is saved, {name}.",
    multiline: false,
  },
  savedBody: {
    group: "once saved",
    label: "text",
    default:
      "It has joined the others. You can keep changing it — it stays yours on this device.",
    multiline: true,
  },
  keepTuningButton: {
    group: "once saved",
    label: "button",
    default: "keep tuning",
    multiline: false,
  },
  closedMessage: {
    group: "when it isn't open",
    label: "closed",
    default:
      "This experience isn’t open yet. Check back when the people running it say so.",
    multiline: true,
  },
  notReadyMessage: {
    group: "when it isn't open",
    label: "open but incomplete",
    default:
      "This experience isn’t quite ready. The people running it have been left a note.",
    multiline: true,
  },
} as const;

export type CopyKey = keyof typeof COPY_FIELDS;
export type ProjectCopy = Record<CopyKey, string> & { introEnabled: boolean };

const MAX_LENGTH = 400;

export const DEFAULT_COPY: ProjectCopy = {
  ...(Object.fromEntries(
    Object.entries(COPY_FIELDS).map(([key, f]) => [key, f.default]),
  ) as Record<CopyKey, string>),
  introEnabled: true,
};

function clean(value: unknown, multiline: boolean): string | null {
  if (typeof value !== "string") return null;
  // Control characters out, except newlines where a field allows them.
  let text = value.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "");
  text = text.trim().slice(0, MAX_LENGTH);
  return text;
}

/**
 * Normalize-on-read. A blank field falls back to its default rather than
 * rendering nothing — an empty button is a broken page, not a choice.
 */
export function coerceCopy(value: unknown): ProjectCopy {
  const raw =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out = { ...DEFAULT_COPY };
  for (const [key, field] of Object.entries(COPY_FIELDS) as [
    CopyKey,
    (typeof COPY_FIELDS)[CopyKey],
  ][]) {
    const text = clean(raw[key], field.multiline);
    if (text) out[key] = text;
  }
  out.introEnabled = raw.introEnabled !== false;
  return out;
}

export type CopyVars = {
  noun: string;
  nounPlural: string;
  /** The participant's name for their avatar — may be empty. */
  name?: string;
  project?: string;
};

/**
 * Fills `{noun}`, `{nounPlural}`, `{name}` and `{project}`. Unknown braces are
 * left as written, so a typo shows up on screen rather than vanishing.
 *
 * `{name}` is often empty — a participant may not have named anything yet — so
 * when it is, it takes a directly preceding ", " or " " with it:
 * "Your star is saved, {name}." reads "Your star is saved." rather than
 * "Your star is saved, .".
 */
export function fillCopy(template: string, vars: CopyVars): string {
  let text = template;
  if (!vars.name) text = text.replace(/,?\s?\{name\}/g, "");
  return text
    .replace(/\{noun\}/g, vars.noun)
    .replace(/\{nounPlural\}/g, vars.nounPlural)
    .replace(/\{name\}/g, vars.name ?? "")
    .replace(/\{project\}/g, vars.project ?? "");
}
