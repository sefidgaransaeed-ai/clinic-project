"use client";

import { useId, useState } from "react";
import { MAX_REPORT_DAYS, presetRange, rangeLength, type RangePreset } from "../data";
import {
  addDays,
  formatJalaliMonthName,
  jalaliMonthLength,
  jalaliParts,
  jalaliToDayKey,
  parseJalaliDate,
  tehranDayKey,
  tehranLocalToIso,
} from "../dates";
import { field, fieldError, label, pillButton } from "./styles";

export type DayRange = { from: string; to: string };

export type Comparison = {
  range: DayRange;
  /** نام کوتاه برای راهنمای نمودار: «مهر»، «هفتهٔ قبل» */
  name: string;
  /** برای جملهٔ «۱۲٪ بیشتر از …»: «همین روزهای مهر» */
  phrase: string;
};

export type RangeChoice = Exclude<RangePreset, "all"> | "custom";

/** بازه‌ای که گزارش الان نشان می‌دهد از کجا آمده؛ «pickedMonth» یعنی ماهی که از ستون سال انتخاب شد */
export type AppliedChoice = RangeChoice | "pickedMonth";

const CHOICES: { value: RangeChoice; label: string }[] = [
  { value: "today", label: "امروز" },
  { value: "week", label: "این هفته" },
  { value: "month", label: "این ماه" },
  { value: "lastMonth", label: "ماه قبل" },
  { value: "custom", label: "بازهٔ دلخواه" },
];

/** بازهٔ یک گزینهٔ آماده؛ برای «بازهٔ دلخواه» تا کاربر تاریخ ننوشته، همان امروز */
export function rangeFor(choice: RangeChoice, now: Date): DayRange {
  if (choice === "custom") {
    const today = tehranDayKey(now);
    return { from: today, to: today };
  }
  return presetRange(choice, now) ?? { from: tehranDayKey(now), to: tehranDayKey(now) };
}

/**
 * بازه‌ای که گزارش با آن سنجیده می‌شود. روزهایش با روزهای بازهٔ اصلی هم‌ردیف‌اند: روز اول با
 * روز اول، روز دوم با روز دوم. ماه با ماه پیش از خودش، هفته با همان روزهای هفتهٔ قبل، و امروز
 * و بازهٔ دلخواه با همان تعداد روزِ درست پیش از خودشان.
 */
export function comparisonFor(choice: AppliedChoice, range: DayRange): Comparison {
  if (choice === "month" || choice === "lastMonth" || choice === "pickedMonth") {
    const { jy, jm } = jalaliParts(tehranLocalToIso(range.from, "12:00"));
    const [y, m] = jm === 1 ? [jy - 1, 12] : [jy, jm - 1];
    const from = jalaliToDayKey(y, m, 1);
    const name = formatJalaliMonthName(tehranLocalToIso(from, "12:00"));
    return {
      range: { from, to: jalaliToDayKey(y, m, jalaliMonthLength(y, m)) },
      name,
      // «این ماه» هنوز تمام نشده، پس با همان چند روز اول ماه قبل سنجیده می‌شود
      phrase: choice === "month" ? `همین روزهای ${name}` : name,
    };
  }
  if (choice === "week") {
    return {
      range: { from: addDays(range.from, -7), to: addDays(range.to, -7) },
      name: "هفتهٔ قبل",
      phrase: "همین روزهای هفتهٔ قبل",
    };
  }
  const length = rangeLength(range);
  const before = { from: addDays(range.from, -length), to: addDays(range.from, -1) };
  return choice === "today"
    ? { range: before, name: "دیروز", phrase: "دیروز" }
    : { range: before, name: "بازهٔ قبل", phrase: "بازهٔ پیش از آن" };
}

/**
 * انتخاب بازهٔ گزارش: گزینه‌های آماده (هفته از شنبه، ماه شمسی) یا بازهٔ دلخواه شمسی.
 * گزینهٔ انتخاب‌شده دست صفحه است، چون ستون سال هم بازه را عوض می‌کند.
 * بازهٔ دلخواه فقط وقتی گزارش را عوض می‌کند که هر دو تاریخ درست باشند.
 */
export function RangePicker({
  choice,
  onChoose,
  onCustomRange,
}: {
  choice: AppliedChoice;
  onChoose: (choice: RangeChoice) => void;
  onCustomRange: (range: DayRange) => void;
}) {
  const id = useId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  const choose = (value: RangeChoice) => {
    setError("");
    onChoose(value);
  };

  const applyCustom = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    const fromKey = parseJalaliDate(nextFrom);
    const toKey = parseJalaliDate(nextTo);
    if (!fromKey || !toKey) {
      setError(nextFrom && nextTo ? "تاریخ‌ها را به شکل ۱۴۰۵/۰۸/۰۶ بنویسید." : "");
      return;
    }
    if (fromKey > toKey) {
      setError("«از» باید پیش از «تا» باشد.");
      return;
    }
    if (rangeLength({ from: fromKey, to: toKey }) > MAX_REPORT_DAYS) {
      setError("بازه حداکثر یک سال باشد.");
      return;
    }
    setError("");
    onCustomRange({ from: fromKey, to: toKey });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="بازهٔ گزارش" className="flex flex-wrap gap-1.5">
        {CHOICES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={choice === item.value}
            onClick={() => choose(item.value)}
            className={pillButton}
          >
            {item.label}
          </button>
        ))}
      </div>

      {choice === "custom" && (
        <div className="max-w-md">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-from`} className={label}>
                از
              </label>
              <input
                id={`${id}-from`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="۱۴۰۵/۰۸/۰۱"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
                className={`${field} text-right`}
                value={from}
                onChange={(event) => applyCustom(event.target.value, to)}
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className={label}>
                تا
              </label>
              <input
                id={`${id}-to`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="۱۴۰۵/۰۸/۳۰"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
                className={`${field} text-right`}
                value={to}
                onChange={(event) => applyCustom(from, event.target.value)}
              />
            </div>
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className={fieldError}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
