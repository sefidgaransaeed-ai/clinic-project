import { getWeekday, makeTehranDateTime } from "./date";
import type { Appointment, AppointmentSnapshot, AppointmentStatus, Closure, WorkingDay } from "./types";

/**
 * محاسبهٔ ساعت و هم‌پوشانی بازه‌ها. فقط محاسبه است و به React یا انبار داده وابسته نیست،
 * تا نسخهٔ پایگاه داده بعداً همین قاعده‌ها را دوباره به کار ببرد.
 */

/** طول هر خانهٔ تقویم به دقیقه؛ هم‌ارز app_settings.slot_minutes در مدل داده. */
export const SLOT_MINUTES = 15;

/** مدت‌هایی که منشی هنگام ثبت دستی می‌تواند انتخاب کند (دقیقه). */
export const MANUAL_DURATION_OPTIONS = [15, 30, 45, 60] as const;

/** نوبت دستی زودتر از این ساعت شروع نمی‌شود: ۰۸:۰۰ وقت تهران (دقیقه از نیمه‌شب). */
export const MANUAL_FIRST_START_MINUTES = 8 * 60;

/** و پایانش دیرتر از این ساعت نیست: ۲۴:۰۰ وقت تهران (دقیقه از نیمه‌شب). */
export const MANUAL_LAST_END_MINUTES = 24 * 60;

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

/** این وضعیت‌ها ساعت را اشغال می‌کنند؛ مطابق قید هم‌پوشانی در مدل داده. */
export const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = ["confirmed", "arrived", "done"];

export function findClosure(closures: Closure[], dateKey: string): Closure | undefined {
  return closures.find((closure) => closure.date === dateKey);
}

/** ساعت کاریِ همان روز (به دقیقه از نیمه‌شب)، یا `null` اگر آن روز کاری نیست. */
export function getWorkingWindow(workingDays: WorkingDay[], dateKey: string) {
  const day = workingDays.find((item) => item.weekday === getWeekday(dateKey));
  if (!day) {
    return null;
  }
  return { start: timeToMinutes(day.start_time), end: timeToMinutes(day.end_time), closingTime: day.end_time };
}

/**
 * خانه‌های ۱۵ دقیقه‌ای ردیف‌های تقویم: از زودترین شروع تا دیرترین پایانِ ساعت‌های کاری.
 * ساعت کاری هر روز هفته می‌تواند فرق کند (مطب‌ها)، پس اتحاد آن‌هاست؛ هر روز فقط خانه‌های ساعت خودش را باز می‌کند.
 */
export function getAppointmentSlots(workingDays: WorkingDay[]): string[] {
  if (workingDays.length === 0) {
    return [];
  }
  const first = Math.min(...workingDays.map((day) => timeToMinutes(day.start_time)));
  const last = Math.max(...workingDays.map((day) => timeToMinutes(day.end_time)));
  const slots: string[] = [];
  for (let minutes = Math.floor(first / SLOT_MINUTES) * SLOT_MINUTES; minutes < last; minutes += SLOT_MINUTES) {
    slots.push(minutesToTime(minutes));
  }
  return slots;
}

/** نوبتِ فعالِ دیگری که با بازهٔ `[start, end)` هم‌پوشانی دارد (به‌جز خود نوبتِ در دست بررسی). */
export function findOverlap<T extends Pick<Appointment, "id" | "status" | "starts_at" | "ends_at">>(
  appointments: T[],
  range: TimeRange,
  ignoreAppointmentId: string,
): T | undefined {
  return appointments.find(
    (item) =>
      item.id !== ignoreAppointmentId &&
      SLOT_BLOCKING_STATUSES.includes(item.status) &&
      rangesOverlap(range, appointmentRange(item)),
  );
}

/**
 * ساعت‌های شروعِ آزاد در یک روز برای نوبتی به مدت `durationMinutes`: خانه‌هایی که کل نوبت داخل ساعت کاری
 * همان روز جا می‌شود و با هیچ نوبتِ فعالی هم‌پوشانی ندارد. روز تعطیل یا غیرکاری فهرست خالی دارد.
 * فقط ساعت برمی‌گرداند، نه اطلاعات نوبت‌ها؛ فرم عمومی بعداً همین را به جای `available_slots` می‌خواند.
 * `ignoreAppointmentId` نوبتی را که همراه نوبت تازه لغو می‌شود (تغییر نام) از شمارش بیرون می‌گذارد.
 */
export function getFreeStartTimes(
  snapshot: Pick<AppointmentSnapshot, "appointments" | "closures" | "workingDays">,
  dateKey: string,
  durationMinutes: number = SLOT_MINUTES,
  ignoreAppointmentId?: string,
) {
  const hours = getWorkingWindow(snapshot.workingDays, dateKey);
  if (!hours || findClosure(snapshot.closures, dateKey)) {
    return [];
  }

  const activeRanges = snapshot.appointments
    .filter((item) => item.id !== ignoreAppointmentId && SLOT_BLOCKING_STATUSES.includes(item.status))
    .map(appointmentRange);

  return getAppointmentSlots(snapshot.workingDays).filter((time) => {
    const start = timeToMinutes(time);
    return (
      start >= hours.start &&
      start + durationMinutes <= hours.end &&
      !activeRanges.some((range) => rangesOverlap(slotRange(dateKey, time, durationMinutes), range))
    );
  });
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
