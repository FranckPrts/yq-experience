"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "./actions";

export default function AcceptForm({
  token,
  lockedEmail,
}: {
  token: string;
  lockedEmail: string | null;
}) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(
    acceptInvitation,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={lockedEmail ?? ""}
          readOnly={!!lockedEmail}
          className={`term-input border-b border-paper/20 ${
            lockedEmail ? "text-dim" : ""
          }`}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">name (optional)</span>
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          className="term-input border-b border-paper/20"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={9}
          className="term-input border-b border-paper/20"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">confirm password</span>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={9}
          className="term-input border-b border-paper/20"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start text-sm text-paper underline underline-offset-4 disabled:text-dim"
      >
        {pending ? "creating…" : "create account"}
      </button>
    </form>
  );
}
