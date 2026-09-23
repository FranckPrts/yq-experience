"use client";

import { useActionState, useState } from "react";
import { wipeData, wipeSchema, type DestructiveState } from "./actions";

export type LiveState = {
  reachable: boolean;
  error: string | null;
  installed: boolean;
  avatars: { exists: boolean; rows: number | null; rlsEnabled: boolean; policies: number };
  scores: { exists: boolean; rows: number | null; rlsEnabled: boolean; policies: number };
  stagedCount: number | null;
  /** Our record says provisioned, but the tables are not actually there. */
  drifted: boolean;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-paper/10 pb-2">
      <span className="text-dim">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * A destructive action, behind a confirmation you cannot click through without
 * reading: the project slug has to be typed. The count of what will be lost is
 * shown on the button itself, because "delete the data" and "delete 137
 * people's avatars" are different decisions.
 */
function Destructive({
  slug,
  action,
  title,
  blurb,
  confirmLabel,
  disabledReason,
}: {
  slug: string;
  action: (
    prev: DestructiveState,
    formData: FormData,
  ) => Promise<DestructiveState>;
  title: string;
  blurb: string;
  confirmLabel: string;
  disabledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState<DestructiveState, FormData>(
    action,
    {},
  );
  const [typed, setTyped] = useState("");
  const [armed, setArmed] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-paper/10 pb-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm">{title}</span>
        {!armed && (
          <button
            type="button"
            disabled={!!disabledReason}
            onClick={() => setArmed(true)}
            className="shrink-0 text-xs text-dim underline-offset-4 hover:text-red-400 hover:underline disabled:no-underline disabled:opacity-40"
          >
            {disabledReason ?? "…"}
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-dim">{blurb}</p>

      {armed && (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="slug" value={slug} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">
              Type <code className="text-paper/80">{slug}</code> to confirm
            </span>
            <input
              name="confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="term-input max-w-xs border-b border-red-500/40"
            />
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pending || typed !== slug}
              className="text-sm text-red-400 underline underline-offset-4 disabled:text-dim disabled:no-underline"
            >
              {pending ? "working…" : confirmLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setArmed(false);
                setTyped("");
              }}
              className="text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
            >
              cancel
            </button>
          </div>
        </form>
      )}

      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
      {state.done && <p className="text-xs text-dim">{state.done}</p>}
    </div>
  );
}

export default function DangerSection({
  slug,
  live,
  isOpen,
  canEdit,
}: {
  slug: string;
  live: LiveState;
  isOpen: boolean;
  canEdit: boolean;
}) {
  const blockedReason = isOpen
    ? "close the project first"
    : !live.installed
      ? "nothing to delete"
      : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs text-dim">what is in there now</h2>

        {!live.reachable ? (
          <p className="text-xs text-amber-400/80">
            {live.error ?? "Could not read the database."}
          </p>
        ) : !live.installed ? (
          <p className="text-xs text-dim">
            The tables are not there. Provision to create them.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-xs">
            <Row
              label="avatars"
              value={
                <>
                  {live.avatars.rows} row{live.avatars.rows === 1 ? "" : "s"}
                  <span className="text-dim">
                    {" "}
                    · RLS {live.avatars.rlsEnabled ? "on" : "OFF"} ·{" "}
                    {live.avatars.policies} policies
                  </span>
                </>
              }
            />
            <Row
              label="session_scores"
              value={
                <>
                  {live.scores.rows} row{live.scores.rows === 1 ? "" : "s"}
                  <span className="text-dim">
                    {" "}
                    · RLS {live.scores.rlsEnabled ? "on" : "OFF"} ·{" "}
                    {live.scores.policies} policies
                  </span>
                </>
              }
            />
            {live.stagedCount !== null && (
              <Row label="currently staged" value={`${live.stagedCount} of 2`} />
            )}
          </div>
        )}

        {/* Our `provisionedAt` records what we did, not what is true — a tenant
            can drop a table in the Supabase dashboard and we would never hear. */}
        {live.drifted && (
          <p className="text-xs text-amber-400/80">
            This project is marked as provisioned, but the tables are not in the
            database. Provision again before opening it.
          </p>
        )}
      </section>

      {canEdit && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs text-dim">destructive</h2>
          {isOpen && (
            <p className="text-[11px] text-amber-400/80">
              The project is open to participants. Close it to enable these.
            </p>
          )}

          <Destructive
            slug={slug}
            action={wipeData}
            title="Delete all participant data"
            blurb={
              live.installed && live.reachable
                ? `Removes ${live.avatars.rows ?? 0} avatar(s) and ${live.scores.rows ?? 0} score(s). The tables, policies and grants stay, so the experience can run again immediately. Cannot be undone.`
                : "Removes every avatar and score, leaving the tables in place. Cannot be undone."
            }
            confirmLabel="delete the data"
            disabledReason={blockedReason ?? "delete data"}
          />

          <Destructive
            slug={slug}
            action={wipeSchema}
            title="Delete data and tables"
            blurb="Drops both tables along with everything in them, and marks this project un-provisioned. Your Supabase project, its auth users and anything else you keep in it are untouched — only what we created is removed. Cannot be undone."
            confirmLabel="drop everything"
            disabledReason={blockedReason ?? "drop tables"}
          />
        </section>
      )}
    </div>
  );
}
