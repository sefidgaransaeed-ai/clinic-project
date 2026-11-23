import { appointmentLocalTime, formatAppointmentTime, makeTehranDateTime } from "./date";
import {
  appointmentRange,
  findClosure,
  findOverlap,
  getAppointmentSlots,
  getWorkingWindow,
  MANUAL_FIRST_START_MINUTES,
  MANUAL_LAST_END_MINUTES,
  minutesToTime,
  SLOT_MINUTES,
  slotRange,
  timeToMinutes,
} from "./slots";
import type { Appointment, AppointmentSnapshot } from "./types";

/**
 * فهرست ساعت و هشدارِ پنجرهٔ ثبت دستی. فقط محاسبه است و به React یا پایگاه داده وابسته نیست.
 * پزشک و منشی می‌توانند بیرون از ساعت کاری، در روز غیرکاری و در روز تعطیل هم نوبت بدهند؛
 * مرز سخت فقط ۰۸:۰۰ تا ۲۴:۰۰ و شبکهٔ ۱۵ دقیقه‌ای است (`checkManualSlot` و `getManualTimeRange`).
 */

type ManualSnapshot = Pick<AppointmentSnapshot, "appointments" | "closures" | "workingDays">;

export interface ManualStartOption {
  /** ساعت شروع `HH:MM` وقت تهران. */
  time: string;
  /** کل نوبت (با مدت انتخاب‌شده) داخل ساعت کاریِ همان روز جا می‌شود؛ در روز تعطیل یا غیرکاری هیچ ساعتی داخل نیست. */
  inWorkingHours: boolean;
  /** با نوبتِ فعالِ دیگری هم‌پوشانی دارد و قابل انتخاب نیست. */
  taken: boolean;
}

/**
 * همهٔ ساعت‌های شروع از ۰۸:۰۰ تا ۲۳:۴۵ با گام ۱۵ دقیقه، با نشانهٔ «داخل ساعت کاری» و «پر» برای مدت انتخاب‌شده.
 * `ignoreAppointmentId` نوبتی را که همراه نوبت تازه لغو می‌شود (تغییر نام) از شمارش بیرون می‌گذارد.
 */
export function getManualStartOptions(
  snapshot: ManualSnapshot,
  dateKey: string,
  durationMinutes: number,
  ignoreAppointmentId?: string,
): ManualStartOption[] {
  const hours = findClosure(snapshot.closures, dateKey) ? null : getWorkingWindow(snapshot.workingDays, dateKey);
  const options: ManualStartOption[] = [];
  for (let start = MANUAL_FIRST_START_MINUTES; start < MANUAL_LAST_END_MINUTES; start += SLOT_MINUTES) {
    const time = minutesToTime(start);
    options.push({
      time,
      inWorkingHours: hours !== null && start >= hours.start && start + durationMinutes <= hours.end,
      taken: findOverlap(snapshot.appointments, slotRange(dateKey, time, durationMinutes), ignoreAppointmentId ?? "") !== undefined,
    });
  }
  return options;
}

/** ساعتی که پنجره باز می‌شود: `preferred` اگر قابل انتخاب است، وگرنه اولین ساعت آزادِ داخل ساعت کاری، وگرنه اولین ساعت آزاد. */
export function pickInitialStartTime(options: ManualStartOption[], preferred: string): string {
  const free = options.filter((option) => !option.taken);
  return (
    free.find((option) => option.time === preferred) ??
    free.find((option) => option.inWorkingHours) ??
    free[0]
  )?.time ?? preferred;
}

export type ManualSlotWarningReason = "closure" | "non_working_day" | "out_of_hours";

export interface ManualSlotWarning {
  reason: ManualSlotWarningReason;
  /** عنوان کوتاه هشدار؛ نام قاعده‌ای که نقض می‌شود. */
  title: string;
  /** چه شد؛ پرسش «با این حال ثبت شود؟» را پنجره می‌افزاید. */
  message: string;
}

/**
 * قاعده‌ای که این نوبت نقض می‌کند و باید پیش از ثبت با تأیید دوم پذیرفته شود، یا `null` اگر نوبت عادی است.
 * وقتی چند قاعده با هم نقض شود، دقیق‌ترین می‌آید: تعطیلی، بعد روز غیرکاری، بعد بیرون از ساعت.
 */
export function getManualSlotWarning(
  snapshot: ManualSnapshot,
  input: { dateKey: string; time: string; durationMinutes: number },
): ManualSlotWarning | null {
  const { dateKey, time, durationMinutes } = input;

  if (findClosure(snapshot.closures, dateKey)) {
    return { reason: "closure", title: "روز تعطیل", message: "این روز تعطیل است." };
  }

  const hours = getWorkingWindow(snapshot.workingDays, dateKey);
  if (!hours) {
    return { reason: "non_working_day", title: "روز غیرکاری", message: "این روز جزو روزهای کاری مطب نیست." };
  }

  const start = timeToMinutes(time);
  if (start < hours.start || start + durationMinutes > hours.end) {
    const opening = formatAppointmentTime(makeTehranDateTime(dateKey, minutesToTime(hours.start)));
    const closing = formatAppointmentTime(makeTehranDateTime(dateKey, hours.closingTime));
    return {
      reason: "out_of_hours",
      title: "خارج از ساعت کاری",
      message: `این نوبت خارج از ساعت کاری مطب است؛ ساعت کاری آن روز از ${opening} تا ${closing} است.`,
    };
  }

  return null;
}

/**
 * ردیف‌های تقویم هفتگی: ساعت‌های کاری همهٔ روزها، به‌علاوهٔ خانه‌هایی که نوبتِ بیرون از ساعت کاری در آن‌ها افتاده؛
 * وگرنه نوبتی که بیرون از ساعت کاری ثبت شده در تقویم دیده نمی‌شد. فقط خانه‌های لازم می‌آید، نه فاصلهٔ میان‌شان.
 */
export function getCalendarSlotTimes(
  workingDays: AppointmentSnapshot["workingDays"],
  appointments: Pick<Appointment, "starts_at" | "ends_at">[],
): string[] {
  const cells = new Set(getAppointmentSlots(workingDays).map(timeToMinutes));
  for (const appointment of appointments) {
    const range = appointmentRange(appointment);
    const start = timeToMinutes(appointmentLocalTime(appointment.starts_at));
    const end = Math.min(start + (range.end - range.start) / 60_000, MANUAL_LAST_END_MINUTES);
    for (let cell = Math.floor(start / SLOT_MINUTES) * SLOT_MINUTES; cell < end; cell += SLOT_MINUTES) {
      cells.add(cell);
    }
  }
  return [...cells].sort((left, right) => left - right).map(minutesToTime);
}
