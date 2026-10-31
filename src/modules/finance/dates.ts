/**
 * تاریخ شمسی و «روز» به وقت تهران، بدون بستهٔ بیرونی.
 *
 * قرارداد این فایل: هر «روز» یک کلید متنی میلادی به شکل "2026-10-28" است که به وقت
 * Asia/Tehran حساب شده. کلیدها را می‌شود با مقایسهٔ متنی مرتب و مقایسه کرد.
 */

const TEHRAN = "Asia/Tehran";

// ایران از ۱۴۰۱ ساعت تابستانی ندارد و اختلافش با UTC همیشه ۳:۳۰ است.
// فقط برای تبدیل «تاریخ و ساعتی که منشی وارد کرده» به UTC به کار می‌رود؛ نمایش با Intl است.
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEHRAN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TEHRAN,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const jalaliPartsFormat = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: TEHRAN,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const jalaliDisplayFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthNameFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN,
  month: "long",
});

const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TEHRAN, weekday: "short" });

const weekdayNameFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN,
  weekday: "long",
});

const longDateFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN,
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** کلید روز تهران برای یک لحظه: "2026-10-28" */
export function tehranDayKey(at: string | Date): string {
  return dayKeyFormat.format(new Date(at));
}

/** ساعت و دقیقهٔ تهران: "14:05" */
export function tehranTime(at: string | Date): string {
  return timeFormat.format(new Date(at));
}

/** «۱۴۰۵/۰۸/۰۶» */
export function formatJalaliDate(at: string | Date): string {
  return jalaliDisplayFormat.format(new Date(at));
}

/** «۱۴۰۵/۰۸/۰۶، ۱۴:۰۵» */
export function formatJalaliDateTime(at: string | Date): string {
  return `${formatJalaliDate(at)}، ${toPersianDigits(tehranTime(at))}`;
}

/** «آبان ۱۴۰۵» */
export function formatJalaliMonth(at: string | Date): string {
  // Intl سال را اول می‌گذارد («۱۴۰۵ آبان»)؛ در فارسی ماه اول می‌آید
  return `${formatJalaliMonthName(at)} ${toPersianDigits(String(jalaliParts(at).jy))}`;
}

/** «آبان» */
export function formatJalaliMonthName(at: string | Date): string {
  return monthNameFormat.format(new Date(at));
}

/** «چهارشنبه» */
export function formatWeekday(at: string | Date): string {
  return weekdayNameFormat.format(new Date(at));
}

/** «۶ آبان ۱۴۰۵» */
export function formatJalaliLongDate(at: string | Date): string {
  return longDateFormat.format(new Date(at));
}

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

/** رقم‌های فارسی و عربی را لاتین می‌کند تا ورودی کاربر خوانده شود */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

/** تاریخ شمسی امروزِ یک لحظه، به وقت تهران */
export function jalaliParts(at: string | Date): { jy: number; jm: number; jd: number } {
  const parts = jalaliPartsFormat.formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

/** چند روز از شنبهٔ همین هفته گذشته — هفتهٔ ایرانی از شنبه شروع می‌شود */
export function daysSinceSaturday(at: string | Date): number {
  const order = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return order.indexOf(weekdayFormat.format(new Date(at)));
}

/** کلید روز را چند روز جلو یا عقب می‌برد */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** «تاریخ و ساعتی که در تهران وارد شده» را به لحظهٔ UTC تبدیل می‌کند */
export function tehranLocalToIso(dayKey: string, time: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const utc = Date.UTC(y, m - 1, d, hh, mm) - TEHRAN_OFFSET_MINUTES * 60_000;
  return new Date(utc).toISOString();
}

// ---------------------------------------------------------------------------
// تبدیل شمسی به میلادی — الگوریتم شناخته‌شدهٔ jalaali (بدون بستهٔ بیرونی)

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
  2394, 2456, 3178,
];

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}

/** تاریخ شمسی → کلید روز میلادی */
export function jalaliToDayKey(jy: number, jm: number, jd: number): string {
  const { gy, march } = jalCal(jy);
  const jdn = g2d(gy, 3, march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  const g = d2g(jdn);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

/**
 * «۱۴۰۵/۸/۶» یا «1405-08-06» → کلید روز؛ اگر تاریخ معتبر نباشد null.
 * سال‌های ۱۳۰۰ تا ۱۴۹۹ پذیرفته می‌شوند.
 */
export function parseJalaliDate(input: string): string | null {
  const match = toLatinDigits(input.trim()).match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!match) return null;
  const [jy, jm, jd] = match.slice(1).map(Number);
  if (jy < 1300 || jy > 1499 || jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > jalaliMonthLength(jy, jm)) return null;
  return jalaliToDayKey(jy, jm, jd);
}

/** کلید روز → «۱۴۰۵/۰۸/۰۶»؛ ظهر همان روز را می‌سازد تا مرز روز جابه‌جا نشود */
export function dayKeyToJalali(dayKey: string): string {
  return formatJalaliDate(tehranLocalToIso(dayKey, "12:00"));
}
