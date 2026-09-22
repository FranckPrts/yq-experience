/**
 * A project's look: a palette and a typeface.
 *
 * Deliberately small — "a more elaborate dark-mode switch", not a design
 * system. Three colours, because that is what the markup actually consumes
 * (`bg-void`, `text-paper`, `text-dim` are already everywhere), and a typeface
 * from a list we host rather than an arbitrary upload, which keeps licensing
 * and loading our problem instead of the tenant's.
 *
 * The shape lives here rather than in the database because it is read whole and
 * never queried by field. `Project.theme` is a json column holding exactly this.
 */

export type ProjectTheme = {
  /** Background. */
  void: string;
  /** Body text. */
  paper: string;
  /** Secondary text and labels. */
  dim: string;
  /** Key into `FONTS`. */
  font: FontKey;
};

export const FONTS = {
  mono: {
    label: "Terminal mono",
    stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  sans: {
    label: "Neutral sans",
    stack: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  },
  serif: {
    label: "Quiet serif",
    stack: "ui-serif, Georgia, Cambria, Times New Roman, serif",
  },
} as const;

export type FontKey = keyof typeof FONTS;

/** The Nowadays palette — what the CCN experience shipped with. */
export const DEFAULT_THEME: ProjectTheme = {
  void: "#14100e",
  paper: "#ece5d8",
  dim: "#7f776b",
  font: "mono",
};

const HEX = /^#[0-9a-f]{6}$/i;

function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

/**
 * Normalize-on-read, as everywhere else: a theme edited straight in the
 * database, or written by an older version of this form, still yields a
 * complete and renderable set rather than a page with no background colour.
 */
export function coerceTheme(value: unknown): ProjectTheme {
  if (!value || typeof value !== "object") return { ...DEFAULT_THEME };
  const raw = value as Record<string, unknown>;
  return {
    void: hex(raw.void, DEFAULT_THEME.void),
    paper: hex(raw.paper, DEFAULT_THEME.paper),
    dim: hex(raw.dim, DEFAULT_THEME.dim),
    font:
      typeof raw.font === "string" && raw.font in FONTS
        ? (raw.font as FontKey)
        : DEFAULT_THEME.font,
  };
}

/**
 * CSS custom properties for a project, named to match `globals.css`'s `@theme`
 * block — so every `bg-void` / `text-dim` utility already in the markup
 * resolves to tenant values with no change to the markup itself.
 *
 * Inlined by the server into the page it renders, which is what keeps the
 * palette from flickering in after hydration.
 */
export function themeCssVars(theme: ProjectTheme): Record<string, string> {
  return {
    "--color-void": theme.void,
    "--color-paper": theme.paper,
    "--color-dim": theme.dim,
    "--font-project": FONTS[theme.font].stack,
  };
}

export type ProjectLexicon = { noun: string; nounPlural: string };

export const DEFAULT_LEXICON: ProjectLexicon = {
  noun: "avatar",
  nounPlural: "avatars",
};

export function coerceLexicon(value: unknown): ProjectLexicon {
  if (!value || typeof value !== "object") return { ...DEFAULT_LEXICON };
  const raw = value as Record<string, unknown>;
  const noun = typeof raw.noun === "string" ? raw.noun.trim() : "";
  const plural = typeof raw.nounPlural === "string" ? raw.nounPlural.trim() : "";
  return {
    noun: noun || DEFAULT_LEXICON.noun,
    // A missing plural is more likely an oversight than a choice, so derive one
    // rather than falling all the way back to "avatars".
    nounPlural: plural || (noun ? `${noun}s` : DEFAULT_LEXICON.nounPlural),
  };
}
