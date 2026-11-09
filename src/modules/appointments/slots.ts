import { makeTehranDateTime } from "./date";
import type { Appointment } from "./types";

/**
 * محاسبهٔ ساعت و هم‌پوشانی بازه‌ها. فقط محاسبه است و به React یا انبار داده وابسته نیست،
 * تا نسخهٔ پایگاه داده بعداً همین قاعده‌ها را دوباره به کار ببرد.
 */

/** طول هر خانهٔ تقویم به دقیقه؛ هم‌ارز app_settings.slot_minutes در مدل داده. */
export const SLOT_MINUTES = 15;

/** مدت‌هایی که منشی هنگام ثبت دستی می‌تواند انتخاب کند (دقیقه). */
export const MANUAL_DURATION_OPTIONS = [15, 30, 45, 60] as const;

/** بازهٔ زمانی نیم‌باز `[start, end)` به میلی‌ثانیه؛ پایان خودش جزو بازه نیست. */
export interface TimeRange {
  start: number;
  end: number;
}

/** «11:15» را به دقیقه از نیمه‌شب برمی‌گرداند. */
export function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/** دقیقه از نیمه‌شب را به «HH:MM» برمی‌گرداند. */
export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** بازهٔ `durationMinutes` دقیقه‌ای که در روز `dateKey` ساعت `time` شروع می‌شود. */
export function slotRange(dateKey: string, time: string, durationMinutes: number = SLOT_MINUTES): TimeRange {
  const start = Date.parse(makeTehranDateTime(dateKey, time));
  return { start, end: start + durationMinutes * 60_000 };
}

export function appointmentRange(appointment: Pick<Appointment, "starts_at" | "ends_at">): TimeRange {
  return { start: Date.parse(appointment.starts_at), end: Date.parse(appointment.ends_at) };
}

/** دو بازهٔ نیم‌باز هم‌پوشانی دارند؟ نوبتی که درست وقتی دیگری تمام می‌شود شروع شود هم‌پوشانی ندارد. */
export function rangesOverlap(left: TimeRange, right: TimeRange) {
  return left.start < right.end && right.start < left.end;
}

export interface SlotCoverage<T> {
  appointment: T;
  /** خانه‌ای که نوبت در آن شروع می‌شود؛ خانه‌های بعدی «ادامه» حساب می‌شوند. */
  isFirstCell: boolean;
}

/** نوبت‌هایی که خانهٔ ۱۵ دقیقه‌ای `time` از روز `dateKey` را می‌پوشانند، با نشانهٔ اولین خانه. */
export function getSlotCoverage<T extends Pick<Appointment, "starts_at" | "ends_at">>(
  appointments: T[],
  dateKey: string,
  time: string,
): SlotCoverage<T>[] {
  const cell = slotRange(dateKey, time);
  return appointments
    .map((appointment) => ({ appointment, range: appointmentRange(appointment) }))
    .filter(({ range }) => rangesOverlap(cell, range))
    .map(({ appointment, range }) => ({
      appointment,
      isFirstCell: range.start >= cell.start && range.start < cell.end,
    }));
}
