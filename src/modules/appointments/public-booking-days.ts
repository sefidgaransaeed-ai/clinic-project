import { addDays, getWeekday, gregorianToJalali, type JalaliDate, jalaliMonthLength, jalaliToGregorian } from "./date";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

/**
 * فهرست روزهای فرم عمومی `/nobat` از روی خروجی `get_public_info()`. فقط محاسبه است (بدون Supabase و بدون React)،
 * پس در آزمون هم کار می‌کند. ساعت‌های خالی از اینجا نمی‌آیند؛ آن‌ها را `available_slots()` می‌دهد.
 */

export interface PublicClinic {
  id: string;
  name: string;
  address: string;
}

/** `weekday` به شیوهٔ پایگاه داده است: شنبه ۰ تا جمعه ۶ (Q-1). ساعت‌ها «HH:MM» و به وقت تهران‌اند. */
export interface PublicWorkingHours {
  weekday: number;
  startTime: string;
  endTime: string;
  clinicId: string | null;
}

export interface PublicBookingInfo {
  clinics: PublicClinic[];
  workingHours: PublicWorkingHours[];
  /** تاریخ‌های میلادی `YYYY-MM-DD` از امروز به بعد؛ دلیل تعطیلی را تابع نمی‌دهد. */
  closures: string[];
}

/** با شمارهٔ روز هفتهٔ پایگاه داده (شنبه ۰) اندیس می‌خورد. */
export const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** روز هفتهٔ تاریخ به شیوهٔ پایگاه داده؛ `getWeekday` یکشنبه را ۰ می‌گیرد، پایگاه داده شنبه را. */
export function clinicWeekday(dateKey: string) {
  return (getWeekday(dateKey) + 1) % 7;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** تاریخ واقعی تقویم: `2026-02-31` نیست، چون به `2026-03-03` سر می‌خورد. */
export function isRealDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY.test(value) && addDays(value, 0) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ورودی ناقص یا ناجور را کنار می‌گذارد، تا یک ردیف خراب کل صفحه را نشکند. */
export function parsePublicInfo(raw: unknown): PublicBookingInfo | null {
  if (!isRecord(raw)) {
    return null;
  }

  const clinics = (Array.isArray(raw.clinics) ? raw.clinics : []).flatMap((item): PublicClinic[] =>
    isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && typeof item.address === "string"
      ? [{ id: item.id, name: item.name, address: item.address }]
      : [],
  );

  const workingHours = (Array.isArray(raw.working_hours) ? raw.working_hours : []).flatMap((item): PublicWorkingHours[] =>
    isRecord(item) &&
    typeof item.weekday === "number" &&
    Number.isInteger(item.weekday) &&
    item.weekday >= 0 &&
    item.weekday <= 6 &&
    typeof item.start_time === "string" &&
    typeof item.end_time === "string"
      ? [
          {
            weekday: item.weekday,
            startTime: item.start_time.slice(0, 5),
            endTime: item.end_time.slice(0, 5),
            clinicId: typeof item.clinic_id === "string" ? item.clinic_id : null,
          },
        ]
      : [],
  );

  const closures = (Array.isArray(raw.closures) ? raw.closures : []).filter(isRealDateKey);

  return { clinics, workingHours, closures };
}

export type DayUnavailable = "closed" | "notWorking";

/** `null` یعنی روز انتخاب‌شدنی است. تعطیلی بر روز غیرکاری مقدم است، چون پیام دقیق‌تری می‌دهد. */
export function getDayUnavailable(dateKey: string, info: PublicBookingInfo): DayUnavailable | null {
  if (info.closures.includes(dateKey)) {
    return "closed";
  }
  if (!info.workingHours.some((item) => item.weekday === clinicWeekday(dateKey))) {
    return "notWorking";
  }
  return null;
}

/** برچسب کنار روز در فهرست: «تعطیل» یا «غیرکاری»؛ `null` برای روز انتخاب‌شدنی. */
export function getDayUnavailableLabel(dateKey: string, info: PublicBookingInfo) {
  const reason = getDayUnavailable(dateKey, info);
  return reason === "closed" ? messages.dayClosed : reason === "notWorking" ? messages.dayNotWorking : null;
}

/** پیام خطای روز انتخاب‌شده برای زیر فهرست؛ `null` یعنی روز درست است. */
export function getDayError(dateKey: string, today: string, info: PublicBookingInfo) {
  if (dateKey === "") {
    return messages.dateEmpty;
  }
  if (!isRealDateKey(dateKey)) {
    return messages.dateInvalid;
  }
  if (dateKey < today) {
    return messages.datePast;
  }
  const reason = getDayUnavailable(dateKey, info);
  return reason === "closed" ? messages.dateClosed : reason === "notWorking" ? messages.dateNotWorking : null;
}

export interface ClinicWeekdays {
  clinic: PublicClinic;
  weekdayNames: string[];
}

/** هر مطب در کدام روزهای هفته باز است؛ نشانی‌ای که کنار انتخاب روز دیده می‌شود (روی گوشی `title` کار نمی‌کند). */
export function groupClinicWeekdays(info: PublicBookingInfo): ClinicWeekdays[] {
  return info.clinics.flatMap((clinic) => {
    const weekdays = [...new Set(info.workingHours.filter((item) => item.clinicId === clinic.id).map((item) => item.weekday))].sort(
      (a, b) => a - b,
    );
    return weekdays.length > 0 ? [{ clinic, weekdayNames: weekdays.map((weekday) => WEEKDAY_NAMES[weekday]) }] : [];
  });
}

/**
 * سال، ماه و روزِ شمسیِ انتخاب‌شده. سال یا ماهِ خالی یعنی «پیش‌فرض» (سال و ماهِ جاری)، تا هر سه فهرست همیشه
 * فهرست معتبر داشته باشند؛ روزِ خالی یعنی هنوز روزی انتخاب نشده.
 */
export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export const EMPTY_DATE_PARTS: DateParts = { year: "", month: "", day: "" };

/** سال‌های قابل‌انتخاب: سال جاری و دو سال بعد. سقف دیگری برای روزهای آینده نیست. */
export function getYearOptions(current: JalaliDate) {
  return [current.year, current.year + 1, current.year + 2];
}

/** ماه‌هایی که تمامشان در گذشته نیست: در سال جاری از ماه جاری به بعد، در سال‌های بعد همهٔ ماه‌ها. */
export function getMonthOptions(year: number, current: JalaliDate) {
  const first = year > current.year ? 1 : current.month;
  return Array.from({ length: 12 - first + 1 }, (_, index) => first + index);
}

/** روزهای یک ماهِ شمسی که امروز یا بعد از امروزند، با تاریخ میلادیِ هر کدام. */
export function getMonthDays(year: number, month: number, today: string) {
  const first = jalaliToGregorian(year, month, 1);
  if (!first) {
    return [];
  }
  return Array.from({ length: jalaliMonthLength(year, month) }, (_, index) => ({ day: index + 1, dateKey: addDays(first, index) })).filter(
    (item) => item.dateKey >= today,
  );
}

/** سال و ماهی که فهرست‌ها واقعاً نشان می‌دهند (پیش‌فرضِ خالی همان سال و ماه جاری است). */
export function resolveYearMonth(parts: DateParts, current: JalaliDate) {
  return { year: Number(parts.year) || current.year, month: Number(parts.month) || current.month };
}

/**
 * پس از هر تغییر، بخش‌هایی که دیگر معتبر نیستند خالی می‌شوند: ماهی که در سال تازه کاملاً گذشته است به ماه جاری برمی‌گردد
 * (و روز را هم پاک می‌کند، چون دیگر معلوم نیست مال کدام ماه بوده)، و روزی که در ماه تازه نیست یا گذشته است پاک می‌شود.
 */
export function normalizeDateParts(parts: DateParts, today: string): DateParts {
  const current = gregorianToJalali(today);
  const { year, month } = resolveYearMonth(parts, current);
  const monthResets = parts.month !== "" && !getMonthOptions(year, current).includes(month);
  const effectiveMonth = monthResets ? current.month : month;
  const dayIsValid = !monthResets && getMonthDays(year, effectiveMonth, today).some((item) => item.day === Number(parts.day));
  return { year: parts.year, month: monthResets ? "" : parts.month, day: dayIsValid ? parts.day : "" };
}
