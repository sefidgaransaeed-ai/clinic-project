"use client";

import { useState } from "react";
import type { ReportDay } from "../data";
import { formatJalaliLongDate, formatWeekday, jalaliParts, tehranLocalToIso, toPersianDigits } from "../dates";
import { formatAmount } from "../money";
import { Toman } from "./toman";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

// همهٔ ستون‌ها روی هم حدود نیم ثانیه طول می‌کشند تا بالا بیایند، هر چند روز که باشد
const STAGGER_MS = 450;

/**
 * نمودار ستونی جمع هر روز، بدون بستهٔ نمودار: هر روز یک ستون گوشه‌تیز نارنجی، هم‌خانوادهٔ
 * مربع‌های نوار امضایی برند. روزها از راست به چپ جلو می‌روند، مثل خواندن فارسی.
 * امروز سرمه‌ای است، روزِ با جمع منفی (برگشت پول بیش از دریافت) قرمز و زیر خط صفر.
 * پشت هر ستون، ستون پهن و کم‌رنگ همان روز در بازهٔ قبل است (روز اول ماه قبل پشت روز اول این ماه).
 *
 * ستون‌ها برای صفحه‌خوان پنهان‌اند؛ همین ارقام در «رسید» پایین صفحه آمده‌اند.
 */
export function ReportChart({
  days,
  today,
  previous,
  previousName,
}: {
  days: ReportDay[];
  today: string;
  previous: ReportDay[];
  previousName: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const ghosts = previous.slice(0, days.length);
  const all = [...days, ...ghosts].map((day) => day.totalToman);
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  // جای خط صفر، به درصد از بالا
  const zero = (max / span) * 100;

  // برچسب زیر ستون‌ها: حدود هشت تا، به‌علاوهٔ آخر اگر به برچسب قبلی نچسبد
  const step = Math.max(1, Math.ceil(days.length / 8));
  const lastIndex = days.length - 1;
  const labelled = (index: number) =>
    index % step === 0 || (index === lastIndex && lastIndex % step > step / 2);
  const hovered = hover === null ? null : days[hover];
  const hoveredGhost = hover === null ? undefined : ghosts[hover];

  // ستون مثبت از خط صفر بالا می‌رود، ستون منفی پایین
  const place = (total: number) => {
    const height = `${(Math.abs(total) / span) * 100}%`;
    return total < 0
      ? { top: `${zero}%`, height, transformOrigin: "top" }
      : { bottom: `${100 - zero}%`, height, transformOrigin: "bottom" };
  };

  return (
    <figure>
      <figcaption className="sr-only">
        نمودار جمع هر روز. همین ارقام در «رسید» پایین صفحه آمده‌اند.
      </figcaption>
      <div className="relative" aria-hidden="true">
        {max > 0 && (
          <p className="mb-1 text-xs text-(--fin-muted)">
            <bdi dir="ltr">{formatAmount(max)}</bdi>
          </p>
        )}
        <div className="relative h-48" onPointerLeave={() => setHover(null)}>
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-(--fin-grey)" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-(--fin-grey)/70" />
          <div
            className="absolute inset-x-0 border-t-2 border-(--fin-navy)/25"
            style={{ top: `${zero}%` }}
          />

          <div className="absolute inset-0 flex gap-[2px]">
            {days.map((day, index) => {
              const negative = day.totalToman < 0;
              const future = day.dayKey > today;
              const ghost = ghosts[index];
              return (
                <div
                  key={day.dayKey}
                  className="relative min-w-0 flex-1"
                  onPointerEnter={() => setHover(index)}
                >
                  {hover === index && (
                    <span className="absolute inset-0 bg-(--fin-peach)/50" />
                  )}
                  {ghost && ghost.totalToman !== 0 && (
                    <span
                      className={`absolute inset-x-[4%] ${
                        ghost.totalToman < 0 ? "bg-(--fin-red)/15" : "bg-(--fin-navy)/[0.09]"
                      }`}
                      style={place(ghost.totalToman)}
                    />
                  )}
                  {day.totalToman !== 0 ? (
                    <span
                      className={`fin-rise absolute inset-x-[22%] ${
                        negative
                          ? "bg-(--fin-red)"
                          : day.dayKey === today
                            ? "bg-(--fin-navy)"
                            : "bg-(--fin-orange)"
                      }`}
                      style={{
                        ...place(day.totalToman),
                        animationDelay: `${Math.round((index / days.length) * STAGGER_MS)}ms`,
                      }}
                    />
                  ) : (
                    // روز بی‌پرداخت: یک مربع کوچک روی خط صفر؛ روزهای آینده کم‌رنگ‌تر
                    <span
                      className={`absolute inset-x-[30%] h-1 ${future ? "bg-(--fin-grey)/50" : "bg-(--fin-grey)"}`}
                      style={{ top: `calc(${zero}% - 2px)` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {hovered && hover !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 w-max -translate-y-full translate-x-1/2 rounded-xl bg-(--fin-navy) px-3 py-2 text-xs text-white shadow-lg"
              style={{
                insetInlineStart: `${Math.min(88, Math.max(12, ((hover + 0.5) / days.length) * 100))}%`,
              }}
            >
              <p className="font-bold">
                {formatWeekday(noonOf(hovered.dayKey))} {formatJalaliLongDate(noonOf(hovered.dayKey))}
              </p>
              {/* جداکنندهٔ «·» کنار رقم فارسی شبیه صفر خوانده می‌شود؛ پس سطرهای جدا */}
              <p className="mt-0.5">
                <Toman amount={hovered.totalToman} className="font-bold text-(--fin-orange)" />
              </p>
              <p className="text-white/75">{toPersianDigits(String(hovered.count))} پرداخت</p>
              {hoveredGhost && (
                <p className="mt-1.5 border-t border-white/15 pt-1.5 text-white/75">
                  {formatJalaliLongDate(noonOf(hoveredGhost.dayKey))}:{" "}
                  <Toman amount={hoveredGhost.totalToman} />
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-[2px] text-[11px] text-(--fin-muted)">
          {days.map((day, index) => (
            <span key={day.dayKey} className="min-w-0 flex-1 text-center">
              {labelled(index)
                ? toPersianDigits(String(jalaliParts(noonOf(day.dayKey)).jd))
                : ""}
            </span>
          ))}
        </div>
      </div>

      {/* راهنما با نوشته، تا فرق دو ستون فقط با رنگ گفته نشود */}
      {ghosts.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-(--fin-muted)">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-1.5 bg-(--fin-orange)" />
            این بازه
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 bg-(--fin-navy)/[0.09]" />
            ستون پهن کم‌رنگ: {previousName}
          </span>
        </p>
      )}
    </figure>
  );
}
