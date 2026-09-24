"use client";

import { useActionState } from "react";
import {
  grantAdminAction,
  revokeAdminAction,
  type AdminState,
} from "./actions";

type Admin = { id: string; label: string; isYou: boolean };

function Feedback({ state }: { state: AdminState }) {
  if (state.error)
    return (
      <p role="alert" className="text-xs text-red-400">
        {state.error}
      </p>
    );
  if (state.message) return <p className="text-xs text-dim">{state.message}</p>;
  return null;
}

export default function AdminsSection({ admins }: { admins: Admin[] }) {
  const [grantState, grant, granting] = useActionState<AdminState, FormData>(
    grantAdminAction,
    {},
  );
  const [revokeState, revoke, revoking] = useActionState<AdminState, FormData>(
    revokeAdminAction,
    {},
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs text-dim">administrators</h2>

      <ul className="flex flex-col gap-2 text-xs">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex items-baseline justify-between gap-4 border-b border-paper/10 pb-2"
          >
            <span>
              {a.label}
              {a.isYou && <span className="text-dim"> · you</span>}
            </span>
            {!a.isYou && (
              <form action={revoke}>
                <input type="hidden" name="userId" value={a.id} />
                <button
                  type="submit"
                  disabled={revoking}
                  className="text-dim underline-offset-4 hover:text-red-400 hover:underline"
                >
                  remove admin
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <Feedback state={revokeState} />

      <form action={grant} className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-[11px] text-dim">
            make an existing account an administrator
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="their account email"
            className="term-input border-b border-paper/20 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={granting}
          className="text-sm text-paper underline underline-offset-4 disabled:text-dim"
        >
          {granting ? "…" : "grant"}
        </button>
      </form>
      <Feedback state={grantState} />
      <p className="text-[11px] leading-relaxed text-dim">
        Admin is never sent as a link. Someone new is invited below as a normal
        user; once they have signed up, promote them here.
      </p>
    </section>
  );
}
