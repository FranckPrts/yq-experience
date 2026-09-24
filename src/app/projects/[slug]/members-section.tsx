"use client";

import { useActionState, useState } from "react";
import {
  changeRoleAction,
  inviteMember,
  removeMemberAction,
  revokeMemberInvite,
  type InviteMemberState,
  type MemberState,
} from "./members-actions";

type Role = "OWNER" | "COLLABORATOR" | "VIEWER";

export type MemberView = {
  userId: string;
  label: string;
  role: Role;
  isYou: boolean;
};

export type PendingInvite = {
  id: string;
  email: string | null;
  role: Role;
  expires: string;
};

const ROLE_HELP: Record<Role, string> = {
  OWNER: "everything, including members, the database and opening",
  COLLABORATOR: "style, script and parameters",
  VIEWER: "can look, cannot change",
};

function MemberRow({
  slug,
  member,
  canEdit,
}: {
  slug: string;
  member: MemberView;
  canEdit: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState<MemberState, FormData>(
    changeRoleAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState<
    MemberState,
    FormData
  >(removeMemberAction, {});
  const [confirming, setConfirming] = useState(false);
  const error = roleState.error ?? removeState.error;

  return (
    <li className="flex flex-col gap-1 border-b border-paper/10 pb-2">
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span>
          {member.label}
          {member.isYou && <span className="text-dim"> · you</span>}
        </span>

        {canEdit ? (
          <span className="flex shrink-0 items-baseline gap-3">
            <form action={roleAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="userId" value={member.userId} />
              <select
                name="role"
                defaultValue={member.role}
                disabled={rolePending}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="term-input bg-void text-xs text-dim"
                aria-label={`Role for ${member.label}`}
              >
                <option value="OWNER">owner</option>
                <option value="COLLABORATOR">collaborator</option>
                <option value="VIEWER">viewer</option>
              </select>
            </form>

            {confirming ? (
              <form action={removeAction} className="flex items-baseline gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="userId" value={member.userId} />
                <button
                  type="submit"
                  disabled={removePending}
                  className="text-red-400 underline underline-offset-4"
                >
                  {member.isYou ? "leave" : "remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-dim hover:text-paper"
                >
                  cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-dim underline-offset-4 hover:text-red-400 hover:underline"
              >
                {member.isYou ? "leave" : "remove"}
              </button>
            )}
          </span>
        ) : (
          <span className="text-dim">{member.role.toLowerCase()}</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-amber-400/90">
          {error}
        </p>
      )}
    </li>
  );
}

export default function MembersSection({
  slug,
  members,
  pending,
  canEdit,
}: {
  slug: string;
  members: MemberView[];
  pending: PendingInvite[];
  canEdit: boolean;
}) {
  const [state, action, isPending] = useActionState<InviteMemberState, FormData>(
    inviteMember,
    {},
  );
  const [role, setRole] = useState<Role>("COLLABORATOR");

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <MemberRow key={m.userId} slug={slug} member={m} canEdit={canEdit} />
        ))}
      </ul>

      {canEdit && pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[11px] text-dim">pending invitations</h3>
          <ul className="flex flex-col gap-1 text-xs">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between gap-4 text-dim"
              >
                <span>
                  {p.email} · {p.role.toLowerCase()} · expires {p.expires}
                </span>
                <form action={revokeMemberInvite}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="underline-offset-4 hover:text-red-400 hover:underline"
                  >
                    revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && (
        <form action={action} className="flex flex-col gap-3 border-t border-paper/10 pt-4">
          <h3 className="text-[11px] text-dim">invite someone</h3>
          <input type="hidden" name="slug" value={slug} />
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className="text-[11px] text-dim">email</span>
              <input
                name="email"
                type="email"
                required
                className="term-input border-b border-paper/20 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-dim">as</span>
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="term-input border-b border-paper/20 bg-void text-sm"
              >
                <option value="OWNER">owner</option>
                <option value="COLLABORATOR">collaborator</option>
                <option value="VIEWER">viewer</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="text-sm text-paper underline underline-offset-4 disabled:text-dim"
            >
              {isPending ? "…" : "create link"}
            </button>
          </div>
          <p className="text-[11px] text-dim">{ROLE_HELP[role]}.</p>

          {state.error && (
            <p role="alert" className="text-xs text-red-400">
              {state.error}
            </p>
          )}
          {state.url && (
            <div className="flex flex-col gap-2 rounded border border-paper/20 p-3">
              <p className="text-[11px] text-dim">
                Send this to them. It works only for that address, once, and
                is shown only now — just its hash is stored. If they already
                have an account they will be asked to sign in; if not, they
                will create one.
              </p>
              <code className="break-all text-[11px] text-paper/90">
                {state.url}
              </code>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
