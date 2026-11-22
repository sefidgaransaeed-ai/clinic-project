import { toPersianDigits } from "@/lib/format";

import { formatJalaliShortDate } from "../appointments/date";
import type { ScheduleConfirmation } from "./types";

/**
 * هشدار و تأیید دومِ نوبت‌های تأییدشدهٔ آینده که تغییر بیرون برنامه می‌برد (تصمیم 0013، بند ۶).
 * باید **داخل همان `<form>`** رندر شود: فیلد مخفی `confirmedIds` و دکمهٔ `confirm=true` با بقیهٔ فیلدهای فرم
 * فرستاده می‌شوند. تأیید واقعی سمت سرور سنجیده می‌شود؛ این فقط رابط است. فقط تاریخ، ساعت و نام نشان داده می‌شود.
 * تاریخ‌ها شمسی با روز هفته‌اند (`formatJalaliShortDate` از `appointments/date.ts`).
 */

const confirmButtonClass =
  "rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-amber-500 dark:text-black";

export function ScheduleConfirmationNotice({
  confirmation,
  isPending,
}: {
  confirmation: ScheduleConfirmation;
  isPending: boolean;
}) {
  const count = toPersianDigits(confirmation.affected.length);

  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-amber-600/40 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
    >
      {confirmation.changedSinceShown ? (
        <p className="font-medium">
          فهرست نوبت‌ها از آخرین نمایش تغییر کرد و چیزی ذخیره نشد. فهرست تازه را ببینید.
        </p>
      ) : null}

      <p className="font-medium">
        {confirmation.closureDate
          ? `با تعطیلی روز ${formatJalaliShortDate(confirmation.closureDate)}، ${count} نوبت تأییدشده در همین روز بسته می‌شود.`
          : `این تغییر ${count} نوبت تأییدشدهٔ آینده را از برنامهٔ کاری بیرون می‌برد.`}
      </p>

      <ul className="space-y-1 text-xs">
        {confirmation.affected.map((appointment) => (
          <li key={appointment.id}>
            {formatJalaliShortDate(appointment.dateKey)} — ساعت {toPersianDigits(appointment.startTime)} — {appointment.patientName}
          </li>
        ))}
      </ul>

      <p className="text-xs">
        این نوبت‌ها خودکار لغو یا جابه‌جا نمی‌شوند و همان‌طور می‌مانند؛ هماهنگی با مراجعان با خود شماست.
      </p>

      {/* بعد از ارسال اول React فرم را به حالت اول برمی‌گرداند؛ مقدارهای واقعی از سرور برمی‌گردند و اینجا
          با ارسال دوم می‌روند تا تأیید، انتخاب پزشک را ذخیره کند نه مقدار بازگشته را. */}
      {confirmation.values ? (
        <input type="hidden" name="confirmedValues" value={JSON.stringify(confirmation.values)} />
      ) : null}
      <input type="hidden" name="confirmedIds" value={confirmation.confirmedIds} />
      <button type="submit" name="confirm" value="true" disabled={isPending} className={confirmButtonClass}>
        {isPending ? "در حال ثبت…" : "تأیید می‌کنم و ثبت شود"}
      </button>
    </div>
  );
}
