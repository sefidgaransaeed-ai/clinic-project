"use client";

import { useActionState } from "react";

import { formatJalaliShortDate } from "../appointments/date";
import { cancelClosureAction, createClosureAction, reactivateClosureAction } from "./actions";
import { CLOSURE_REASON_MAX_LENGTH } from "./validation";
import type { ClosureEntry, WorkingHoursActionState } from "./types";

/**
 * فرم‌های تعطیلی (سمت مرورگر). کنترل دسترسی اینجا نیست: هر action خودش `requireRole(["doctor"])` دارد
 * و لایهٔ داده و RLS پشتش هستند. هیچ دکمهٔ حذفی وجود ندارد؛ فقط لغو (`is_active = false`) و فعال‌سازی دوباره.
 * وضعیت همیشه با متن نوشته می‌شود («فعال» / «لغوشده»)، نه فقط با رنگ.
 */

const initialState: WorkingHoursActionState = { error: null, ok: false };

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const primaryButtonClass =
  "rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black";

const secondaryButtonClass =
  "rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

function FormMessages({ state, successText }: { state: WorkingHoursActionState; successText: string }) {
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {successText}
        </p>
      ) : null}
    </>
  );
}

/** ثبت تعطیلیِ تازه. تاریخ همان `YYYY-MM-DD` میلادیِ ورودی تاریخ مرورگر است؛ نمایش شمسی در فهرست می‌آید. */
export function CreateClosureForm() {
  const [state, formAction, isPending] = useActionState(createClosureAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor="closure-date" className="block text-xs font-medium">
            تاریخ تعطیلی
          </label>
          <input id="closure-date" name="closureDate" type="date" required dir="ltr" className={inputClass} />
        </div>
        <div className="min-w-0 space-y-1">
          <label htmlFor="closure-reason" className="block text-xs font-medium">
            دلیل تعطیلی
          </label>
          <input
            id="closure-reason"
            name="reason"
            type="text"
            required
            maxLength={CLOSURE_REASON_MAX_LENGTH}
            className={inputClass}
          />
        </div>
      </div>

      <FormMessages state={state} successText="تعطیلی ثبت شد." />

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "در حال ثبت…" : "ثبت تعطیلی"}
      </button>
    </form>
  );
}

function CancelClosureButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(cancelClosureAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className={secondaryButtonClass}>
        {isPending ? "در حال انجام…" : "لغو تعطیلی"}
      </button>
      <FormMessages state={state} successText="تعطیلی لغو شد." />
    </form>
  );
}

function ReactivateClosureButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(reactivateClosureAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className={secondaryButtonClass}>
        {isPending ? "در حال انجام…" : "فعال‌سازی دوباره"}
      </button>
      <FormMessages state={state} successText="تعطیلی دوباره فعال شد." />
    </form>
  );
}

/** یک تعطیلی: تاریخ شمسی، دلیل، برچسب وضعیت و دکمهٔ لغو (برای فعال) یا فعال‌سازی دوباره (برای لغوشده). */
export function ClosureRow({ closure }: { closure: ClosureEntry }) {
  return (
    <li className="space-y-2 rounded-lg border border-black/10 px-3 py-3 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium">{formatJalaliShortDate(closure.closureDate)}</span>
        {closure.isActive ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">فعال</span>
        ) : (
          <span className="text-xs opacity-60">لغوشده</span>
        )}
        <div className="ms-auto">
          {closure.isActive ? <CancelClosureButton id={closure.id} /> : <ReactivateClosureButton id={closure.id} />}
        </div>
      </div>
      {closure.reason ? <p className="text-xs opacity-70">دلیل: {closure.reason}</p> : null}
      {closure.isActive ? null : (
        <p className="text-xs opacity-60">این تعطیلی لغو شده است و روز برای نوبت‌گیری باز است.</p>
      )}
    </li>
  );
}
