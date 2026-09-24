"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-8 space-y-5">
      {state?.error ? (
        <p role="alert" className="rounded-md border border-error/30 bg-error-soft px-4 py-3 t-small font-medium text-error">
          {state.error}
        </p>
      ) : null}
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">Email</span>
        <input name="email" type="email" autoComplete="username" required className="admin-input mt-2" />
      </label>
      <label className="block">
        <span className="block text-[15px] font-semibold text-navy">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="admin-input mt-2" />
      </label>
      <button type="submit" disabled={pending} className="admin-btn w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
