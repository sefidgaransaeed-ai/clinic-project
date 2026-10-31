"use client";

import { useActionState } from "react";

import { changePassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { error: null };

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-left text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="max-w-sm space-y-5">
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium">
          رمز تازه
        </label>
        <input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={10}
          required
          className={inputClass}
        />
        <p className="text-xs opacity-60">دست‌کم ۱۰ نویسه.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="block text-sm font-medium">
          تکرار رمز تازه
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={10}
          required
          className={inputClass}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "در حال ذخیره…" : "ذخیره رمز تازه"}
      </button>
    </form>
  );
}
