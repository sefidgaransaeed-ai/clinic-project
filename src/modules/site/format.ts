import type { Clinic, WorkingHours } from "./types";

// ۰ = شنبه تا ۶ = جمعه — همان قرارداد سند مدل داده
const WEEKDAY_NAMES = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
];

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/** "11:00:00" → "۱۱:۰۰" */
export function formatTime(time: string): string {
  return toPersianDigits(time.slice(0, 5));
}

/** "02100000000" → "۰۲۱-۰۰۰۰۰۰۰۰" — داخل یک span با dir="ltr" نمایش داده شود */
export function formatPhone(phone: string): string {
  const grouped = phone.startsWith("09")
    ? `${phone.slice(0, 4)}-${phone.slice(4, 7)}-${phone.slice(7)}`
    : `${phone.slice(0, 3)}-${phone.slice(3)}`;
  return toPersianDigits(grouped);
}

export function phoneHref(phone: string): string {
  return `tel:${phone}`;
}

/** ["شنبه", "سه‌شنبه", "چهارشنبه"] → "شنبه، سه‌شنبه و چهارشنبه" */
function joinPersian(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join("، ")} و ${items.at(-1)}`;
}

function clinicName(clinics: Clinic[], clinicId: string): string {
  return clinics.find((clinic) => clinic.id === clinicId)?.name ?? "";
}

function timeRange(row: WorkingHours): string {
  return `${formatTime(row.startTime)} تا ${formatTime(row.endTime)}`;
}

/**
 * برای هر مطب، روزهایی که ساعت یکسان دارند در یک سطر:
 * «مطب ظفر» + «شنبه و چهارشنبه» + «۱۴:۰۰ تا ۱۸:۰۰»
 */
export function summarizeWorkingHours(
  rows: WorkingHours[],
  clinics: Clinic[],
): { clinic: string; days: string; hours: string }[] {
  const groups = new Map<string, { clinic: string; hours: string; days: string[] }>();
  for (const row of rows) {
    const hours = timeRange(row);
    const key = `${row.clinicId} ${hours}`;
    const group = groups.get(key) ?? {
      clinic: clinicName(clinics, row.clinicId),
      hours,
      days: [],
    };
    group.days.push(weekdayName(row.weekday));
    groups.set(key, group);
  }
  return [...groups.values()].map(({ clinic, hours, days }) => ({
    clinic,
    days: joinPersian(days),
    hours,
  }));
}

/** هر هفت روز هفته، از شنبه؛ روزی که ساعت کاری ندارد hours و clinic = null */
export function weeklySchedule(
  rows: WorkingHours[],
  clinics: Clinic[],
): { day: string; hours: string | null; clinic: string | null }[] {
  return WEEKDAY_NAMES.map((day, weekday) => {
    const dayRows = rows.filter((row) => row.weekday === weekday);
    if (!dayRows.length) return { day, hours: null, clinic: null };
    return {
      day,
      hours: dayRows.map(timeRange).join("، "),
      clinic: [...new Set(dayRows.map((row) => clinicName(clinics, row.clinicId)))].join("، "),
    };
  });
}
