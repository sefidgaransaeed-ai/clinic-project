"use client";

import { useState } from "react";
import type { ReportDay } from "../data";
import {
  daysSinceSaturday,
  formatJalaliLongDate,
  formatWeekday,
  jalaliParts,
  tehranLocalToIso,
  toPersianDigits,
} from "../dates";
import { Toman } from "./toman";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

// ضلع مربع نارنجی، به نسبت خانه. مساحتش با جمع روز بزرگ می‌شود، نه ضلعش، تا روز پرکار
// بیش از اندازه درشت دیده نشود. بزرگ‌ترین مربع به عدد روز در گوشهٔ دیگر نمی‌رسد.
const SIZE = { min: 0.26, max: 0.6 };

/**
 * تقویم بازه روی نوار سرمه‌ای: هفته از شنبه، و در خانهٔ هر روز یک مربع گوشه‌تیز نارنجی به
 * اندازهٔ جمع آن روز، مثل مربع‌های نوار امضایی برند که اندازه‌شان فرق دارد. با یک نگاه پیداست
 * کدام روزهای هفته پرکارند.
 *
 * خانه‌ها برای صفحه‌خوان پنهان‌اند؛ همین ارقام در «رسید» پایین صفحه آمده‌اند. زیر تقویم
 * پربارترین روز نوشته می‌شود و با رفتن روی هر روز، جمع همان روز.
 */
export function ReportCalendar({ days, today }: { days: ReportDay[]; today: string }) {
  const [picked, setPicked] = useState<string | null>(null);

  const max = Math.max(0, ...days.map((day) => day.totalToman));
  const best = days.reduce<ReportDay | null>(
    (top, day) => (day.totalToman > 0 && (!top || day.totalToman > top.totalToman) ? day : top),
    null,
  );
  const shown = days.find((day) => day.dayKey === picked) ?? best;
  // خانه‌های خالی پیش از روز اول، تا روز اول زیر نام روز هفته‌اش بنشیند
  const lead = daysSinceSaturday(noonOf(days[0].dayKey));

  return (
    <div>
      <div
        aria-hidden="true"
        className="grid grid-cols-7 gap-1.5"
        onPointerLeave={() => setPicked(null)}
      >
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="pb-0.5 text-center text-[11px] text-white/50">
            {weekday}
          </span>
        ))}
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} />
        ))}
        {days.map((day, index) => {
          const future = day.dayKey > today;
          const isToday = day.dayKey === today;
          const side =
            day.totalToman > 0
              ? SIZE.min + (SIZE.max - SIZE.min) * Math.sqrt(day.totalToman / max)
              : 0;
          return (
            <span
              key={day.dayKey}
              onPointerEnter={() => setPicked(day.dayKey)}
              onClick={() => setPicked(day.dayKey)}
              className={`relative aspect-square rounded-[3px] ${
                future ? "border border-dashed border-white/20" : "bg-white/[0.07]"
              } ${
                picked === day.dayKey
                  ? "outline-2 outline-offset-1 outline-white"
                  : isToday
                    ? "outline-2 outline-offset-1 outline-(--fin-orange) outline-dashed"
                    : ""
              }`}
            >
              <span
                className={`absolute start-1.5 top-1 text-[10px] leading-none ${
                  isToday
                    ? "font-bold text-(--fin-orange)"
                    : future
                      ? "text-white/30"
                      : "text-white/55"
                }`}
              >
                {toPersianDigits(String(jalaliParts(noonOf(day.dayKey)).jd))}
              </span>
              {side > 0 && (
                <span
                  className="fin-grow absolute end-1 bottom-1 bg-(--fin-orange)"
                  style={{
                    width: `${side * 100}%`,
                    height: `${side * 100}%`,
                    transformOrigin: "left bottom",
                    animationDelay: `${index * 18}ms`,
                  }}
                />
              )}
              {day.totalToman < 0 && (
                // روزی که برگشت پولش از دریافتش بیشتر بوده
                <span className="absolute end-1 bottom-1 size-[30%] border-2 border-(--fin-red-light)" />
              )}
            </span>
          );
        })}
      </div>

      {/* پربارترین روز، یا روزی که کاربر رویش رفته */}
      <div className="mt-4 min-h-[4.75rem] border-s-2 border-(--fin-orange) ps-3 text-sm">
        {shown ? (
          <>
            <p className="text-xs text-white/55">{picked ? " " : "پربارترین روز"}</p>
            <p className="font-bold">
              {shown.dayKey === today ? "امروز، " : ""}
              {formatWeekday(noonOf(shown.dayKey))} {formatJalaliLongDate(noonOf(shown.dayKey))}
            </p>
            {shown.dayKey > today ? (
              <p className="text-white/60">هنوز نرسیده</p>
            ) : shown.count === 0 && shown.totalToman === 0 ? (
              <p className="text-white/60">پرداختی نداشت</p>
            ) : (
              <>
                <p>
                  <Toman
                    amount={shown.totalToman}
                    className={`font-bold ${shown.totalToman < 0 ? "text-(--fin-red-light)" : "text-(--fin-orange)"}`}
                  />
                </p>
                <p className="text-xs text-white/60">
                  {toPersianDigits(String(shown.count))} پرداخت
                </p>
              </>
            )}
          </>
        ) : (
          <p className="pt-1 text-white/60">روی هر روز بزنید تا جمعش را ببینید.</p>
        )}
      </div>
    </div>
  );
}
