"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

export default function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="term-input border-b border-paper/20"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-dim">password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "signing in…" : "sign in"}
      </button>
    </form>
  );
}
