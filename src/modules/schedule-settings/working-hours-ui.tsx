"use client";

import { useActionState } from "react";

import { toPersianDigits } from "@/lib/format";

import {
  createWorkingHoursAction,
  deactivateWorkingHoursAction,
  updateWorkingHoursAction,
} from "./actions";
import { ScheduleConfirmationNotice } from "./schedule-confirmation-ui";
import type { ClinicOption, WorkingHoursActionState, WorkingHoursEntry } from "./types";
import { TIME_OPTIONS } from "./weekdays";

/**
 * فرم‌های ساعت کاری (سمت مرورگر). هر فرم `useActionState` و پیام خطا و موفقیت خودش را دارد.
 * کنترل دسترسی اینجا نیست: هر action خودش `requireRole(["doctor"])` دارد و لایهٔ داده و RLS پشتش هستند.
 */

const initialState: WorkingHoursActionState = { error: null, ok: false };

const selectClass =
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

function TimeSelect({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      <select id={id} name={name} required defaultValue={defaultValue} className={selectClass}>
        <option value="" disabled>
          انتخاب کنید
        </option>
        {TIME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * افزودن بازهٔ تازه به یک روز. `clinics` فقط برای روزی که بازهٔ فعال ندارد داده می‌شود و فیلد مطب فقط آن‌وقت
 * در فرم می‌آید؛ برای روزهای دیگر مطب از بازه‌های فعال همان روز مشتق می‌شود و چیزی فرستاده نمی‌شود.
 */
export function CreateWorkingHoursForm({
  weekday,
  weekdayName,
  clinics,
}: {
  weekday: number;
  weekdayName: string;
  clinics?: readonly ClinicOption[];
}) {
  const [state, formAction, isPending] = useActionState(createWorkingHoursAction, initialState);
  const idPrefix = `create-${weekday}`;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="weekday" value={weekday} />

      {clinics ? (
        clinics.length > 0 ? (
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-clinic`} className="block text-xs font-medium">
              مطب {weekdayName}
            </label>
            <select id={`${idPrefix}-clinic`} name="clinicId" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                انتخاب کنید
              </option>
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-xs opacity-70">مطب فعالی ثبت نشده است؛ تا آن موقع بازهٔ تازه‌ای نمی‌شود ساخت.</p>
        )
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <TimeSelect id={`${idPrefix}-start`} name="startTime" label="شروع" defaultValue="" />
        <TimeSelect id={`${idPrefix}-end`} name="endTime" label="پایان" defaultValue="" />
      </div>

      <FormMessages state={state} successText="بازهٔ تازه ثبت شد." />

      <button type="submit" disabled={isPending || (clinics !== undefined && clinics.length === 0)} className={primaryButtonClass}>
        {isPending ? "در حال ثبت…" : "افزودن بازه"}
      </button>
    </form>
  );
}

/** ویرایش ساعت‌ها و فعال‌بودنِ یک بازه. مطب نشان داده می‌شود ولی هرگز فرستاده نمی‌شود. */
function EditWorkingHoursForm({ row }: { row: WorkingHoursEntry }) {
  const [state, formAction, isPending] = useActionState(updateWorkingHoursAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="weekday" value={row.weekday} />

      <div className="grid grid-cols-2 gap-3">
        <TimeSelect id={`edit-${row.id}-start`} name="startTime" label="شروع" defaultValue={row.startTime} />
        <TimeSelect id={`edit-${row.id}-end`} name="endTime" label="پایان" defaultValue={row.endTime} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        {/* ترتیب مهم است: اگر تیک خورده باشد «true» اول می‌آید و `formData.get` همان را می‌خواند. */}
        <input type="checkbox" name="isActive" value="true" defaultChecked={row.isActive} />
        <span>فعال</span>
      </label>
      <input type="hidden" name="isActive" value="false" />

      <FormMessages state={state} successText="تغییرات ذخیره شد." />
      {state.confirmation ? <ScheduleConfirmationNotice confirmation={state.confirmation} isPending={isPending} /> : null}

      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
      </button>
    </form>
  );
}

function DeactivateButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(deactivateWorkingHoursAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={isPending} className={secondaryButtonClass}>
        {isPending ? "در حال انجام…" : "غیرفعال کن"}
      </button>
      <FormMessages state={state} successText="بازه غیرفعال شد." />
      {state.confirmation ? <ScheduleConfirmationNotice confirmation={state.confirmation} isPending={isPending} /> : null}
    </form>
  );
}

/** یک بازه: ساعت‌ها و برچسب وضعیت، دکمهٔ غیرفعال‌کردن (فقط برای بازهٔ فعال) و فرم ویرایش. */
export function WorkingHoursRow({ row }: { row: WorkingHoursEntry }) {
  return (
    <li className="space-y-3 rounded-lg border border-black/10 px-3 py-3 dark:border-white/15">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-medium">
          {toPersianDigits(row.startTime)} تا {toPersianDigits(row.endTime)}
        </span>
        {row.isActive ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">فعال</span>
        ) : (
          <span className="text-xs opacity-60">غیرفعال</span>
        )}
        {row.isActive ? (
          <div className="ms-auto">
            <DeactivateButton id={row.id} />
          </div>
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs opacity-80">ویرایش</summary>
        <div className="pt-3">
          <EditWorkingHoursForm
            key={`${row.id}-${row.startTime}-${row.endTime}-${row.isActive}`}
            row={row}
          />
        </div>
      </details>
    </li>
  );
}
