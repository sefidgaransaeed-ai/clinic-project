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

/** «۲۲ اسفند ۱۳۶۶»: روز، ماه و سال شمسی بدون روز هفته؛ مثل تاریخ تولدی که در پرونده ثبت شده است. */
export function formatJalaliLongDate(dateKey: string) {
  const { day, month, year } = jalaliParts(dateKey);
  return `${day} ${month} ${year}`;
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

export const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

/** همان تقویم شمسیِ `Intl` که برای نمایش تاریخ‌ها به کار می‌رود، ولی با اجزای عددی و رقم لاتین تا بشود با آن حساب کرد. */
const jalaliNumbersFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** تاریخ میلادی `YYYY-MM-DD` را به سال، ماه و روز شمسیِ عددی تبدیل می‌کند. */
export function gregorianToJalali(dateKey: string): JalaliDate {
  const parts = jalaliNumbersFormatter.formatToParts(dateFromKey(dateKey));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** منفی: `left` زودتر از `right` است؛ صفر: برابرند؛ مثبت: دیرتر. */
function compareJalali(left: JalaliDate, right: JalaliDate) {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

/**
 * تاریخ شمسی را به میلادیِ `YYYY-MM-DD` تبدیل می‌کند؛ اگر چنین روزی در تقویم نباشد (مثل ۳۱ مهر یا ۳۰ اسفندِ سال غیرکبیسه) `null` می‌دهد.
 * از یک حدس نزدیک شروع می‌کند و روز به روز جلو یا عقب می‌رود تا به همان تاریخ برسد؛ جدول سال کبیسه لازم نیست.
 */
export function jalaliToGregorian(year: number, month: number, day: number): string | null {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const target = { year, month, day };
  // اول فروردین هر سال شمسی حدود ۲۱ مارسِ سال (شمسی + ۶۲۱) است؛ شش ماه اول ۳۱ روز و بقیه ۳۰ روزند.
  const daysBeforeMonth = month <= 6 ? (month - 1) * 31 : 186 + (month - 7) * 30;
  let dateKey = addDays(`${year + 621}-03-21`, daysBeforeMonth + day - 1);
  let previousOrder = 0;

  for (let step = 0; step < 8; step += 1) {
    const order = Math.sign(compareJalali(gregorianToJalali(dateKey), target));
    if (order === 0) {
      return dateKey;
    }
    if (previousOrder !== 0 && order !== previousOrder) {
      // از تاریخ مورد نظر رد شدیم و به آن نرسیدیم: این روز در آن ماه وجود ندارد.
      return null;
    }
    previousOrder = order;
    dateKey = addDays(dateKey, -order);
  }

  return null;
}

/** تعداد روزهای یک ماه شمسی؛ طول اسفند به کبیسه‌بودن سال بستگی دارد. */
export function jalaliMonthLength(year: number, month: number) {
  if (month <= 6) {
    return 31;
  }
  if (month <= 11) {
    return 30;
  }
  return jalaliToGregorian(year, 12, 30) === null ? 29 : 30;
}

/**
 * سنِ تمام‌شده به سال، بر پایهٔ تقویم شمسی (تولد در همان روز و ماهِ شمسی جشن گرفته می‌شود).
 * سن هرگز ذخیره نمی‌شود و همیشه از تاریخ تولد حساب می‌شود.
 */
export function calculateAge(birthDateKey: string, todayKey: string) {
  const birth = gregorianToJalali(birthDateKey);
  const today = gregorianToJalali(todayKey);
  const hadBirthdayThisYear = today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (hadBirthdayThisYear ? 0 : 1);
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
