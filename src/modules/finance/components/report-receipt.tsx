import { useId } from "react";
import type { ReportDay } from "../data";
import {
  formatJalaliDateTime,
  formatJalaliMonth,
  formatJalaliMonthName,
  formatWeekday,
  jalaliParts,
  tehranLocalToIso,
  toPersianDigits,
} from "../dates";
import { Toman } from "./toman";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

// تا دو ماه، هر سطر رسید یک روز است؛ بازهٔ بلندتر ماه‌به‌ماه می‌آید
const MAX_DAY_LINES = 62;

type Line = { key: string; label: string; isToday: boolean; totalToman: number; count: number };

function linesOf(days: ReportDay[], today: string): Line[] {
  const active = days.filter((day) => day.count > 0 || day.totalToman !== 0);
  if (days.length <= MAX_DAY_LINES) {
    return active.map((day) => {
      const at = noonOf(day.dayKey);
      return {
        key: day.dayKey,
        label: `${formatWeekday(at)} ${toPersianDigits(String(jalaliParts(at).jd))} ${formatJalaliMonthName(at)}`,
        isToday: day.dayKey === today,
        totalToman: day.totalToman,
        count: day.count,
      };
    });
  }
  const months = new Map<string, Line>();
  for (const day of active) {
    const label = formatJalaliMonth(noonOf(day.dayKey));
    const line = months.get(label) ?? { key: label, label, isToday: false, totalToman: 0, count: 0 };
    line.totalToman += day.totalToman;
    line.count += day.count;
    months.set(label, line);
  }
  return [...months.values()];
}

/**
 * «رسید» بازه: همان ارقام روزبه‌روز، به شکل نوار کاغذی دستگاه رسید با لبه‌های دندانه‌دار، هم‌خانوادهٔ
 * برگ رسید فرم ثبت پرداخت. سطرها به ترتیب تاریخ‌اند و جمع کل پایین نوار.
 * وقتی بازه تمام شده باشد، مهر «تمام شد» رویش می‌خورد.
 */
export function ReportReceipt({
  days,
  today,
  title,
  rangeLabel,
  netToman,
  count,
  issuedAt,
}: {
  days: ReportDay[];
  today: string;
  title: string;
  rangeLabel: string;
  netToman: number;
  count: number;
  issuedAt: Date;
}) {
  const id = useId();
  const lines = linesOf(days, today);
  const finished = (days.at(-1)?.dayKey ?? today) < today;

  return (
    <section aria-labelledby={`${id}-title`} className="relative break-inside-avoid">
      {finished && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-10 z-10 grid size-24 -rotate-12 place-items-center rounded-full border-[3px] border-(--fin-navy)/70 text-(--fin-navy)/80"
        >
          <span className="grid size-[4.75rem] place-items-center rounded-full border border-dashed border-(--fin-navy)/60 text-center leading-tight">
            <span className="text-lg font-black">تمام شد</span>
          </span>
        </span>
      )}

      <div className="fin-receipt bg-(--fin-peach)/45 px-5 pt-8 pb-9 text-sm md:px-6">
        {/* ردیف کوچک مربع‌های نوار امضایی برند، جای سربرگ */}
        <p aria-hidden="true" className="flex items-end justify-center gap-1">
          {[6, 9, 12, 9, 6].map((size, index) => (
            <span
              key={index}
              className="bg-(--fin-orange)"
              style={{ width: size, height: size }}
            />
          ))}
        </p>
        <h2 id={`${id}-title`} className="mt-3 text-center text-lg font-black text-(--fin-navy)">
          {title}
        </h2>
        <p className="text-center text-xs text-(--fin-muted)">{rangeLabel}</p>
        {finished && <p className="sr-only">این بازه تمام شده است.</p>}

        <hr className="my-4 border-t-2 border-dashed border-(--fin-navy)/20" />

        <ol className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline gap-2">
              <span className="shrink-0">
                {line.isToday && (
                  <span className="me-1.5 rounded-sm bg-(--fin-navy) px-1.5 py-0.5 text-[11px] font-bold text-white">
                    امروز
                  </span>
                )}
                {line.label}
              </span>
              <span className="shrink-0 text-xs text-(--fin-muted)">
                {toPersianDigits(String(line.count))} پرداخت
              </span>
              {/* نقطه‌چین تا مبلغ، مثل رسید */}
              <span
                aria-hidden="true"
                className="min-w-3 flex-1 border-b-2 border-dotted border-(--fin-navy)/20"
              />
              <Toman
                amount={line.totalToman}
                className={`shrink-0 font-bold ${line.totalToman < 0 ? "text-(--fin-red)" : "text-(--fin-ink)"}`}
              />
            </li>
          ))}
        </ol>

        <hr className="my-4 border-t-2 border-dashed border-(--fin-navy)/20" />

        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-black text-(--fin-navy)">جمع خالص</dt>
            <dd>
              <Toman amount={netToman} className="text-lg font-black text-(--fin-navy)" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-(--fin-muted)">
            <dt>تعداد پرداخت</dt>
            <dd>{toPersianDigits(String(count))}</dd>
          </div>
        </dl>

        <hr className="my-4 border-t-2 border-dashed border-(--fin-navy)/20" />

        <p className="text-center text-xs text-(--fin-muted)">
          ساخته‌شده در {formatJalaliDateTime(issuedAt)}
        </p>
      </div>
    </section>
  );
}
