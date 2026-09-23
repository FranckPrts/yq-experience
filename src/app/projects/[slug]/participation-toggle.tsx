"use client";

import { useActionState } from "react";
import {
  setOpenForParticipation,
  type ParticipationState,
} from "./actions";

export default function ParticipationToggle({
  slug,
  open,
  canEdit,
  missing,
  publicUrl,
}: {
  slug: string;
  open: boolean;
  canEdit: boolean;
  missing: string[];
  publicUrl: string;
}) {
  const [state, action, pending] = useActionState<ParticipationState, FormData>(
    setOpenForParticipation,
    {},
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm">
          {open
            ? "Open — participants can reach it."
            : "Closed — nothing is reachable by participants."}
        </span>
        {canEdit && (
          <form action={action}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="open" value={open ? "false" : "true"} />
            <button
              type="submit"
              disabled={pending || (!open && missing.length > 0)}
              className="text-sm text-paper underline underline-offset-4 disabled:text-dim disabled:no-underline"
            >
              {pending ? "…" : open ? "close" : "open"}
            </button>
          </form>
        )}
      </div>

      {open ? (
        <p className="text-[11px] text-dim">
          Participants go to{" "}
          <a
            href={publicUrl}
            className="text-paper/80 underline underline-offset-4"
          >
            {publicUrl}
          </a>
        </p>
      ) : missing.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-amber-400/80">
          Cannot open yet — still needs {missing.join(", and ")}.
        </p>
      ) : (
        <p className="text-[11px] text-dim">
          Ready to open. Participants will go to{" "}
          <code className="text-paper/60">{publicUrl}</code>.
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-[11px] text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}
