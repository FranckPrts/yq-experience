"use client";

import { useActionState, useState } from "react";
import {
  provisionDatabase,
  setAnonRateLimit,
  type ProvisionState,
} from "./actions";

export type ProvisionView = {
  ready: boolean;
  provisioned: boolean;
  schemaVersion: number | null;
  currentVersion: number;
  anonEnabled: boolean;
  sceneSnippet: string | null;
};

function Copyable({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-dim">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              },
              () => setCopied(false),
            );
          }}
          className="shrink-0 text-xs text-dim underline-offset-4 hover:text-paper hover:underline"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto rounded bg-paper/5 p-3 text-[10px] leading-relaxed text-paper/70">
        {text}
      </pre>
    </div>
  );
}

export default function ProvisionSection({
  slug,
  view,
  canEdit,
}: {
  slug: string;
  view: ProvisionView;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ProvisionState, FormData>(
    provisionDatabase,
    {},
  );
  const [limitState, limitAction, limitPending] = useActionState<
    ProvisionState,
    FormData
  >(setAnonRateLimit, {});

  if (!view.ready) {
    return (
      <p className="text-xs text-dim">
        Connect a Supabase account and choose a project before provisioning.
      </p>
    );
  }

  const stale =
    view.provisioned &&
    view.schemaVersion !== null &&
    view.schemaVersion < view.currentVersion;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="text-sm">
          {view.provisioned ? (
            <>
              Provisioned
              <span className="text-dim">
                {" "}
                · schema v{view.schemaVersion ?? "?"}
                {stale && ` (v${view.currentVersion} available)`}
                {view.anonEnabled
                  ? " · anonymous sign-ins on"
                  : " · anonymous sign-ins off"}
              </span>
            </>
          ) : (
            <span className="text-dim">
              Not provisioned — the tables do not exist yet.
            </span>
          )}
        </p>

        {canEdit && (
          <form action={action}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              disabled={pending}
              className="text-sm text-paper underline underline-offset-4 disabled:text-dim"
            >
              {pending
                ? "running…"
                : view.provisioned
                  ? "re-run schema"
                  : "provision"}
            </button>
          </form>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-dim">
        Creates <code className="text-paper/60">avatars</code> and{" "}
        <code className="text-paper/60">session_scores</code> with row-level
        security, and turns on anonymous sign-ins. Every statement is safe to run
        twice, so re-running after a change or a partial failure is fine.
      </p>

      {state.error && (
        <p role="alert" className="text-xs text-amber-400">
          {state.error}
        </p>
      )}

      {state.done && (
        <div className="flex flex-col gap-2 rounded border border-paper/20 p-3">
          <p className="text-xs text-paper/80">
            Schema v{state.done.schemaVersion} applied.
          </p>
          <p className="text-[11px] leading-relaxed text-dim">
            Anonymous sign-ins:{" "}
            {state.done.anonEnabled ? "enabled" : "could not be enabled"}.
            {state.done.rateLimit !== null && (
              <>
                {" "}
                Rate limit: <strong>{state.done.rateLimit}</strong> per hour per
                IP address. A room of participants on one network shares that
                number — raise it before an event rather than during one.
              </>
            )}
          </p>
        </div>
      )}

      {/* The one external unknown in this design is whether DDL is permitted at
          all, so the fallback is a first-class path rather than an apology. */}
      {state.fallbackSql && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/40 p-3">
          <p className="text-[11px] leading-relaxed text-amber-200/80">
            Run this in your Supabase project&rsquo;s SQL editor. It does exactly
            what the button would have done — then come back and the status here
            will catch up on the next successful run.
          </p>
          <Copyable label="schema.sql" text={state.fallbackSql} />
        </div>
      )}

      {view.provisioned && canEdit && (
        <form action={limitAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">
              anonymous sign-ins per hour, per IP
            </span>
            <input
              name="limit"
              type="number"
              min={1}
              defaultValue={30}
              className="term-input w-32 border-b border-paper/20"
            />
          </label>
          <button
            type="submit"
            disabled={limitPending}
            className="text-xs text-dim underline underline-offset-4 hover:text-paper disabled:no-underline"
          >
            {limitPending ? "saving…" : "raise limit"}
          </button>
          {limitState.error && (
            <span className="text-xs text-red-400">{limitState.error}</span>
          )}
          {limitState.done?.rateLimit != null && (
            <span className="text-xs text-dim">
              now {limitState.done.rateLimit}/hour
            </span>
          )}
        </form>
      )}

      {view.provisioned && view.sceneSnippet && (
        <div className="flex flex-col gap-2 border-t border-paper/10 pt-5">
          <h3 className="text-xs text-dim">scene hookup</h3>
          <p className="text-[11px] leading-relaxed text-dim">
            Your synchrony scene talks to this database directly — nothing is
            handed to YouQuantified as an application. Paste this into the scene
            script and it can read the staged pair, write scores, and clear the
            staging flag. The key below is the publishable one, public by design.
          </p>
          <Copyable label="scene config" text={view.sceneSnippet} />
        </div>
      )}
    </div>
  );
}
