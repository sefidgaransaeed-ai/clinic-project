export const TEHRAN_TIME_ZONE = "Asia/Tehran";

const dateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Returns an ISO date key in the clinic's display timezone. */
export function getTehranDateKey(date: Date) {
  const parts = dateKeyFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function addDays(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

export function getWeekday(dateKey: string) {
  return dateFromKey(dateKey).getUTCDay();
}

/** The clinic week starts on Saturday. */
export function getWeekStart(dateKey: string) {
  return addDays(dateKey, -((getWeekday(dateKey) + 1) % 7));
}

export function getWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * The demo uses a fixed Tehran offset. It is only display/mock data and is
 * replaced by UTC values from Supabase in the database-integration task.
 */
export function makeTehranDateTime(dateKey: string, time: string) {
  return `${dateKey}T${time}:00+03:30`;
}

const jalaliPartsFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const gregorianDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TEHRAN_TIME_ZONE,
  month: "short",
  day: "numeric",
});

/**
 * تنها نقطهٔ تبدیل به تقویم شمسی در این ماژول. اجزا جدا گرفته و دستی کنار هم
 * گذاشته می‌شوند تا ترتیب و علامت‌ها به الگوی ICU مرورگر بستگی نداشته باشد.
 */
function jalaliParts(dateKey: string) {
  const parts = jalaliPartsFormatter.formatToParts(dateFromKey(dateKey));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    weekday: part("weekday"),
    day: part("day"),
    month: part("month"),
    year: part("year"),
  };
}

/** «پنجشنبه ۳۰ مهر ۱۴۰۵»: قالب کوتاه و یکسان برای همهٔ جاهایی که تاریخ کامل لازم است. */
export function formatJalaliShortDate(dateKey: string) {
  const { weekday, day, month, year } = jalaliParts(dateKey);
  return `${weekday} ${day} ${month} ${year}`;
}

/** «شنبه ۲ آبان»: روز هفته، روز ماه و ماه شمسی؛ بدون سال. */
export function formatJalaliDayLabel(dateKey: string) {
  const { weekday, day, month } = jalaliParts(dateKey);
  return `${weekday} ${day} ${month}`;
}

/** «Oct 24»: تاریخ میلادی با رقم انگلیسی، برای خط دوم سرستون‌های تقویم. */
export function formatGregorianDayLabel(dateKey: string) {
  return gregorianDayFormatter.format(dateFromKey(dateKey));
}

/** «۲ آبان تا ۸ آبان ۱۴۰۵»؛ اگر هفته از مرز سال بگذرد، سال هر دو سر نوشته می‌شود. */
export function formatJalaliWeek(weekStart: string) {
  const start = jalaliParts(weekStart);
  const end = jalaliParts(addDays(weekStart, 6));
  const startLabel =
    start.year === end.year
      ? `${start.day} ${start.month}`
      : `${start.day} ${start.month} ${start.year}`;
  return `${startLabel} تا ${end.day} ${end.month} ${end.year}`;
}

export function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: TEHRAN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function appointmentDateKey(value: string) {
  return getTehranDateKey(new Date(value));
}

export function appointmentLocalTime(value: string) {
  return value.slice(11, 16);
}

export function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
