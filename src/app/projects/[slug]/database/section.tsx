"use client";

import { useActionState } from "react";
import {
  chooseSupabaseProject,
  disconnectSupabase,
  type ConnectionState,
} from "./actions";

export type ConnectionView = {
  connected: boolean;
  projectRef: string | null;
  provisioned: boolean;
  hasSecretKey: boolean;
  /** Null when the token could not be used — expired, revoked, or misconfigured. */
  available: { ref: string; name: string; region?: string }[] | null;
  listError: string | null;
};

export default function ConnectionSection({
  slug,
  view,
  canEdit,
}: {
  slug: string;
  view: ConnectionView;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ConnectionState, FormData>(
    chooseSupabaseProject,
    {},
  );

  if (!view.connected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">No Supabase account is connected.</p>
        <p className="text-[11px] leading-relaxed text-dim">
          Participants and their {""}
          avatars live in your own Supabase project, never here. Connecting lets
          this app create the tables and read them back; the secret key is
          encrypted and never reaches a browser.
        </p>
        {canEdit && (
          <a
            href={`/api/connect/supabase/start?project=${slug}`}
            className="self-start text-sm text-paper underline underline-offset-4"
          >
            connect Supabase
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm">
          {view.projectRef ? (
            <>
              Targeting <code className="text-paper/90">{view.projectRef}</code>
              <span className="text-dim">
                {" "}
                · {view.provisioned ? "provisioned" : "not provisioned yet"}
                {view.hasSecretKey ? "" : " · no secret key"}
              </span>
            </>
          ) : (
            "Account connected. Choose which project this experiment targets."
          )}
        </p>
        {canEdit && (
          <form action={disconnectSupabase}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="shrink-0 text-xs text-dim underline-offset-4 hover:text-red-400 hover:underline"
            >
              disconnect
            </button>
          </form>
        )}
      </div>

      {view.listError && (
        <p className="text-xs text-red-400">{view.listError}</p>
      )}

      {canEdit && view.available && view.available.length > 0 && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">
              Supabase project {view.projectRef && "(choosing again repoints it)"}
            </span>
            <select
              name="ref"
              defaultValue={view.projectRef ?? ""}
              className="term-input border-b border-paper/20 bg-void"
            >
              <option value="">— choose —</option>
              {view.available.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.name} ({p.ref})
                  {p.region ? ` · ${p.region}` : ""}
                </option>
              ))}
            </select>
          </label>

          {state.error && (
            <p role="alert" className="text-xs text-red-400">
              {state.error}
            </p>
          )}
          {state.saved && <p className="text-xs text-dim">saved</p>}

          <button
            type="submit"
            disabled={pending}
            className="self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
          >
            {pending ? "resolving keys…" : "use this project"}
          </button>
        </form>
      )}

      {canEdit && view.available?.length === 0 && (
        <p className="text-xs text-dim">
          That Supabase account has no projects yet. Create one in Supabase,
          then reload this page.
        </p>
      )}
    </div>
  );
}
