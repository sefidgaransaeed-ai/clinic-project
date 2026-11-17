import type { AffectedAppointmentView, ConfirmationRequired } from "./types";
import { dbWeekdayOfDate } from "./validation";

/**
 * محاسبهٔ نوبت‌های تأییدشدهٔ آیندهٔ «متأثر» از یک تغییر برنامه (تصمیم 0013، بند ۶، گزینهٔ B).
 * فقط محاسبه است: نه Supabase، نه `server-only`، نه React؛ پس در آزمون و هر جای دیگر کار می‌کند.
 *
 * قاعده: نوبت متأثر است اگر **پیش از تغییر داخل برنامه بود** و **پس از تغییر داخل برنامه نیست**.
 * نوبتی که از قبل بیرون برنامه بوده (استثنای نوبت پنلی خارج از ساعت) هرگز متأثر حساب نمی‌شود.
 * «داخل برنامه» یعنی کل بازهٔ نوبت داخل بازه‌های فعالِ همان روز هفته (و همان مطب) باشد؛ دو بازهٔ چسبیده
 * (۱۰–۱۱ و ۱۱–۱۲) یک بازه حساب می‌شوند. اگر `clinicId` نوبت یا بازه `null` باشد، فقط روز و ساعت سنجیده می‌شود.
 *
 * هیچ نوبتی لغو یا جابه‌جا نمی‌شود؛ این فایل فقط فهرست می‌سازد. فراخوان فقط نوبت‌های `confirmed`
 * و آینده را می‌دهد (خواندنش کار `data.ts` است).
 */

/** ایران ساعت تابستانی ندارد؛ اختلاف تهران با UTC همیشه +۰۳:۳۰ است. ثابتِ محلی، نه وابسته به ماژول دیگر. */
const TEHRAN_OFFSET_MINUTES = 210;

const MINUTE_MS = 60_000;

/** نوبتِ تأییدشدهٔ آینده، همان‌قدر که برای محاسبه لازم است. زمان‌ها ISO/UTC‌اند (`timestamptz`). */
export interface FutureAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  clinicId: string | null;
  patientName: string;
}

/** یک بازهٔ ساعت کاری؛ `WorkingHoursEntry` همین شکل را دارد. ساعت‌ها «HH:MM». */
export interface ScheduleInterval {
  weekday: number;
  startTime: string;
  endTime: string;
  clinicId: string | null;
  isActive: boolean;
}

export const AFFECTED_MESSAGES = {
  required:
    "این تغییر نوبت‌های تأییدشدهٔ آینده را بیرون از برنامه می‌برد. فهرست را ببینید و اگر مطمئنید، تأیید کنید. نوبت‌ها خودکار لغو یا جابه‌جا نمی‌شوند.",
  changed:
    "فهرست نوبت‌های متأثر از آخرین نمایش تغییر کرده و چیزی ذخیره نشد. فهرست تازه را ببینید و اگر مطمئنید، دوباره تأیید کنید.",
} as const;

// ------------------------------------------------------------------ زمان تهران

interface TehranSlot {
  dateKey: string;
  /** شمارهٔ روز هفته طبق پایگاه داده (شنبه = ۰). */
  weekday: number;
  startMinute: number;
  endMinute: number;
}

/** لحظهٔ UTC را به روز، روز هفته و دقیقه‌های نوبت به وقت تهران می‌برد؛ ورودی نامعتبر `null`. */
function toTehranSlot(startsAt: string, endsAt: string): TehranSlot | null {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  const local = new Date(startMs + TEHRAN_OFFSET_MINUTES * MINUTE_MS);
  const dateKey = local.toISOString().slice(0, 10);
  const startMinute = local.getUTCHours() * 60 + local.getUTCMinutes();

  return {
    dateKey,
    weekday: dbWeekdayOfDate(dateKey),
    startMinute,
    endMinute: startMinute + Math.round((endMs - startMs) / MINUTE_MS),
  };
}

function minutesOf(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function toHourMinute(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  return `${String(hour).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ------------------------------------------------------------------- پوشش برنامه

/** `null` در هر طرف یعنی «مطب نامشخص»: فقط روز و ساعت سنجیده می‌شود. */
function clinicsCompatible(appointmentClinic: string | null, intervalClinic: string | null): boolean {
  return appointmentClinic === null || intervalClinic === null || appointmentClinic === intervalClinic;
}

/** کل بازهٔ نوبت داخل بازه‌های فعالِ همان روز هفته (و مطب سازگار) است؟ بازه‌های چسبیده یکی می‌شوند. */
function isInsideSchedule(slot: TehranSlot, clinicId: string | null, schedule: readonly ScheduleInterval[]): boolean {
  const ranges = schedule
    .filter(
      (interval) =>
        interval.isActive && interval.weekday === slot.weekday && clinicsCompatible(clinicId, interval.clinicId),
    )
    .map((interval) => [minutesOf(interval.startTime), minutesOf(interval.endTime)] as [number, number])
    .sort((left, right) => left[0] - right[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged.some(([start, end]) => slot.startMinute >= start && slot.endMinute <= end);
}

function toView(appointment: FutureAppointment, slot: TehranSlot): AffectedAppointmentView {
  return {
    id: appointment.id,
    dateKey: slot.dateKey,
    startTime: toHourMinute(slot.startMinute),
    patientName: appointment.patientName,
  };
}

function byTime(left: AffectedAppointmentView, right: AffectedAppointmentView): number {
  return left.dateKey.localeCompare(right.dateKey) || left.startTime.localeCompare(right.startTime);
}

// -------------------------------------------------------------------- محاسبه‌ها

/**
 * ثبت یا فعال‌سازی دوبارهٔ تعطیلی در `closureDate` (`YYYY-MM-DD`، تهران): نوبت‌های آن روز که اکنون داخل برنامه‌اند
 * متأثرند، چون پس از تعطیلی روز بسته است. نوبتِ بیرون برنامه متأثر نیست.
 */
export function findAffectedByClosure(
  appointments: readonly FutureAppointment[],
  closureDate: string,
  schedule: readonly ScheduleInterval[],
): AffectedAppointmentView[] {
  const affected: AffectedAppointmentView[] = [];
  for (const appointment of appointments) {
    const slot = toTehranSlot(appointment.startsAt, appointment.endsAt);
    if (!slot || slot.dateKey !== closureDate) continue;
    if (isInsideSchedule(slot, appointment.clinicId, schedule)) affected.push(toView(appointment, slot));
  }
  return affected.sort(byTime);
}

/**
 * تغییر ساعت کاری (کوتاه‌کردن، غیرفعال‌کردن، تغییر روز یا مطب): نوبتی که با `before` داخل برنامه بود و با `after`
 * نیست متأثر است. هر دو برنامه کامل‌اند (همهٔ ردیف‌ها)، نه فقط ردیف تغییرکرده.
 */
export function findAffectedByScheduleChange(
  appointments: readonly FutureAppointment[],
  before: readonly ScheduleInterval[],
  after: readonly ScheduleInterval[],
): AffectedAppointmentView[] {
  const affected: AffectedAppointmentView[] = [];
  for (const appointment of appointments) {
    const slot = toTehranSlot(appointment.startsAt, appointment.endsAt);
    if (!slot) continue;
    if (isInsideSchedule(slot, appointment.clinicId, before) && !isInsideSchedule(slot, appointment.clinicId, after)) {
      affected.push(toView(appointment, slot));
    }
  }
  return affected.sort(byTime);
}

// -------------------------------------------------------------------- تأیید دوم

/** نشانهٔ فهرست: شناسه‌های مرتب‌شده با ویرگول. همین در فرم می‌رود و در ارسال دوم برمی‌گردد. */
export function confirmationToken(affected: readonly AffectedAppointmentView[]): string {
  return [...new Set(affected.map((appointment) => appointment.id))].sort().join(",");
}

/**
 * آیا ذخیره مجاز است؟ `null` یعنی بله؛ وگرنه «تأیید لازم است».
 *   - فهرست خالی: هشداری نیست، ذخیره.
 *   - ارسال اول (`confirmedIds === null`): فهرست نشان داده می‌شود و چیزی ذخیره نمی‌شود.
 *   - ارسال دوم: فقط اگر فهرستِ تازه‌خوانده دقیقاً همان فهرستِ تأییدشده باشد؛ وگرنه دوباره هشدار با فهرست تازه.
 */
export function requireConfirmation(
  affected: readonly AffectedAppointmentView[],
  confirmedIds: readonly string[] | null,
  context: { closureDate?: string } = {},
): ConfirmationRequired | null {
  if (affected.length === 0) return null;

  const token = confirmationToken(affected);
  const confirmedToken = confirmedIds === null ? null : [...new Set(confirmedIds)].sort().join(",");
  if (confirmedToken !== null && confirmedToken === token) return null;

  const changedSinceShown = confirmedToken !== null;
  return {
    ok: false,
    message: changedSinceShown ? AFFECTED_MESSAGES.changed : AFFECTED_MESSAGES.required,
    confirmation: {
      affected: [...affected],
      confirmedIds: token,
      changedSinceShown,
      ...(context.closureDate ? { closureDate: context.closureDate } : {}),
    },
  };
}
