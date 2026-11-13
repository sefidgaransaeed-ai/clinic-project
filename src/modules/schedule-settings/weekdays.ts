import { toPersianDigits } from "@/lib/format";

import { minutesToTime, SLOT_MINUTES } from "../appointments/slots";
import type { WorkingHoursEntry } from "./types";

/**
 * روزهای هفته، گزینه‌های ساعت و گروه‌بندی ردیف‌ها برای رابط ساعت کاری. فقط محاسبه است:
 * نه Supabase، نه `server-only`، نه React؛ پس هم در آزمون و هم سمت مرورگر کار می‌کند.
 */

/** نام فارسی روزها به ترتیب شمارهٔ پایگاه داده: ۰ = شنبه … ۶ = جمعه (Q-1). */
export const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"] as const;

/** شمارهٔ روزها از شنبه تا جمعه؛ ترتیب نمایش صفحه همین است. */
export const WEEKDAY_NUMBERS: readonly number[] = WEEKDAY_NAMES.map((_, index) => index);

/** نام فارسی یک روز؛ برای شمارهٔ نامعتبر `undefined` برمی‌گرداند. */
export function weekdayName(weekday: number): string | undefined {
  return Number.isInteger(weekday) ? WEEKDAY_NAMES[weekday] : undefined;
}

export interface TimeOption {
  /** مقدار فرم، به صورت «HH:MM» با رقم انگلیسی؛ همان چیزی که `validation.ts` می‌پذیرد. */
  value: string;
  /** متن نمایشی با رقم فارسی. */
  label: string;
}

/**
 * همهٔ ساعت‌هایی که اعتبارسنجی می‌پذیرد: از ۰۰:۰۰ تا ۲۳:۴۵ با گام `SLOT_MINUTES`.
 * (الگوی ساعت در `validation.ts` از ۰۰:۰۰ تا ۲۳:۵۹ را می‌خواند و فقط مضرب‌های گام می‌ماند؛ ۲۴:۰۰ پذیرفته نمی‌شود.)
 */
export const TIME_OPTIONS: readonly TimeOption[] = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, index) => {
  const value = minutesToTime(index * SLOT_MINUTES);
  return { value, label: toPersianDigits(value) };
});

export interface WeekdayGroup {
  weekday: number;
  name: string;
  /** همهٔ بازه‌های این روز (فعال و غیرفعال)، به ترتیب ساعت شروع. */
  rows: WorkingHoursEntry[];
  /** فقط بازه‌های فعال. */
  activeRows: WorkingHoursEntry[];
  /**
   * مطبِ مشتق‌شده از بازه‌های فعال: اگر همه یک مطب داشتند همان؛ اگر هیچ بازهٔ فعالی نیست `null`
   * (پزشک باید مطب را انتخاب کند)؛ اگر چند مطب بودند `null` با `isClinicInconsistent`.
   */
  clinic: { id: string; name: string | null } | null;
  /** بازه‌های فعالِ این روز برای چند مطب ثبت شده‌اند (داده‌ای که بیرون از قاعده ساخته شده). */
  isClinicInconsistent: boolean;
  /** روز بازهٔ فعال ندارد، پس فرمِ ایجاد باید فهرست مطب‌ها را نشان دهد. */
  needsClinicChoice: boolean;
}

/** مقایسهٔ «HH:MM» با «HH:MM»؛ قالب ثابت است، پس مقایسهٔ رشته‌ای کافی است. */
function byStartTime(left: WorkingHoursEntry, right: WorkingHoursEntry): number {
  return left.startTime < right.startTime ? -1 : left.startTime > right.startTime ? 1 : 0;
}

/**
 * ردیف‌ها را به هفت گروه از شنبه تا جمعه تقسیم می‌کند؛ روز بی‌ردیف هم یک گروهِ خالی دارد.
 * ردیفی که شمارهٔ روزش بیرون از ۰ تا ۶ است نادیده گرفته می‌شود.
 */
export function groupByWeekday(entries: readonly WorkingHoursEntry[]): WeekdayGroup[] {
  return WEEKDAY_NUMBERS.map((weekday) => {
    const rows = entries.filter((entry) => entry.weekday === weekday).sort(byStartTime);
    const activeRows = rows.filter((row) => row.isActive);

    const clinicsById = new Map<string, string | null>();
    for (const row of activeRows) {
      if (row.clinicId !== null) clinicsById.set(row.clinicId, row.clinicName);
    }

    const isClinicInconsistent = clinicsById.size > 1;
    const [first] = [...clinicsById];
    const clinic = clinicsById.size === 1 && first ? { id: first[0], name: first[1] } : null;

    return {
      weekday,
      name: WEEKDAY_NAMES[weekday],
      rows,
      activeRows,
      clinic,
      isClinicInconsistent,
      needsClinicChoice: clinicsById.size === 0,
    };
  });
}
