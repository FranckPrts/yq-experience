import { FONTS, themeCssVars, type ProjectTheme } from "@/lib/theme/project-theme";

/**
 * What a participant meets when the project is not taking them: shut, or open
 * but incomplete. Shared with the participant-frontend preview, so what a
 * tenant previews is this component rather than a copy of it.
 */
export default function Shut({
  theme,
  title,
  message,
}: {
  theme: ProjectTheme;
  title: string;
  message: string;
}) {
  return (
    <main
      style={{
        ...themeCssVars(theme),
        backgroundColor: theme.void,
        color: theme.paper,
        fontFamily: FONTS[theme.font].stack,
      }}
      className="flex min-h-screen items-center justify-center p-8"
    >
      <div className="max-w-sm">
        <h1 className="text-sm">{title}</h1>
        <p className="mt-2 whitespace-pre-line text-xs" style={{ color: theme.dim }}>
          {message}
        </p>
      </div>
    </main>
  );
}
