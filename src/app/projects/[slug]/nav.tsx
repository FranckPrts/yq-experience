import Link from "next/link";

/**
 * The three things a project is made of, plus the project itself.
 *
 * They were one page until it had grown to hold a palette, a file upload and an
 * OAuth flow at once — three unrelated jobs sharing a scroll position. Keeping
 * the same nav on each means the split reads as a structure rather than as
 * pages that happen to exist.
 */

export const SECTIONS = [
  {
    key: "participant-frontend",
    label: "style & language",
    href: (slug: string) => `/projects/${slug}/participant-frontend`,
  },
  {
    key: "visual",
    label: "script & parameters",
    href: (slug: string) => `/projects/${slug}/visual`,
  },
  {
    key: "database",
    label: "database",
    href: (slug: string) => `/projects/${slug}/database`,
  },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"] | "overview";

export default function ProjectNav({
  slug,
  projectName,
  here,
  subtitle,
}: {
  slug: string;
  projectName: string;
  here: SectionKey;
  subtitle?: string;
}) {
  const label =
    here === "overview"
      ? undefined
      : SECTIONS.find((s) => s.key === here)?.label;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-sm">
            {here === "overview" ? (
              projectName
            ) : (
              <>
                <Link
                  href={`/projects/${slug}`}
                  className="text-dim underline-offset-4 hover:text-paper hover:underline"
                >
                  {projectName}
                </Link>
                <span className="text-dim"> · </span>
                {label}
              </>
            )}
          </h1>
          {subtitle && <p className="text-xs text-dim">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-4 text-xs">
          <Link
            href={`/dev/sketch?project=${slug}`}
            className="text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            preview
          </Link>
          <Link
            href="/projects"
            className="text-dim underline-offset-4 hover:text-paper hover:underline"
          >
            all projects
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-x-5 gap-y-1 border-b border-paper/10 pb-3 text-xs">
        <Link
          href={`/projects/${slug}`}
          className={
            here === "overview"
              ? "text-paper underline underline-offset-4"
              : "text-dim underline-offset-4 hover:text-paper hover:underline"
          }
        >
          overview
        </Link>
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={section.href(slug)}
            className={
              here === section.key
                ? "text-paper underline underline-offset-4"
                : "text-dim underline-offset-4 hover:text-paper hover:underline"
            }
          >
            {section.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
