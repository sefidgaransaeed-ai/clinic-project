import { formatPhone, summarizeWorkingHours } from "./format";
import type { Clinic, PublicFaq, PublicInfo } from "./types";

/**
 * پرکردن قالب پاسخ‌های پرتکرار با دادهٔ زندهٔ پایگاه داده.
 *
 * چرا: پاسخ‌های ذخیره‌شده در `faq_items` متن ثابت‌اند. اگر ساعت کاری یا شماره در
 * متن هاردکد شود، با اولین تغییر از واقعیت جدا می‌شود (همان اتفاقی که با شمارهٔ
 * قدیمی `۰۹۱۲۰۱۴۰۶۳۵` افتاد). پس متن‌ها به‌جای مقدار، «نشانه» دارند و مقدار واقعی
 * هنگام نمایش از `get_public_info()` گذاشته می‌شود:
 *
 *   {{phone}}     شمارهٔ تلفن مطب، قالب‌بندی‌شده
 *   {{hours}}     زمان‌های حضور هر مطب: «مطب ظفر: شنبه و چهارشنبه، ۱۴:۰۰ تا ۱۸:۰۰»
 *   {{addresses}} نشانی هر مطب، با راه رسیدن
 *   {{booking}}   دو راه گرفتن نوبت: فرم سایت و تلفن
 *
 * این فایل فقط محاسبه است (بدون Supabase و React) تا هم صفحهٔ پرسش‌ها و هم
 * چت‌بات از همان منطق استفاده کنند.
 */

const MISSING = {
  phone: "با مطب تماس بگیرید",
  hours: "ساعت کاری در حال به‌روزرسانی است؛ برای اطمینان تماس بگیرید",
  addresses: "نشانی در صفحهٔ «تماس» آمده است",
  booking: "از صفحهٔ «نوبت» درخواست بدهید یا با مطب تماس بگیرید",
} as const;

/** «الف»، «ب» و «ج» — بدون «و» برای دو مورد و با کاما برای بیشتر */
function joinPersian(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join("، ")} و ${items.at(-1)}`;
}

/** واژه‌های معنادار متن، برای سنجش تکرار. */
function words(value: string): string[] {
  return value
    .replace(/[.,،:؛()]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

/** «راه رسیدن» چیزی جز تکرار نشانی نمی‌گوید؟ */
function isRedundant(directions: string, address: string): boolean {
  const parts = words(directions);
  return parts.length > 0 && parts.every((word) => address.includes(word));
}

export function fillFaqAnswer(answer: string, info: PublicInfo): string {
  const phone = info.siteInfo.phone ? formatPhone(info.siteInfo.phone) : MISSING.phone;

  const hours = summarizeWorkingHours(info.workingHours, info.clinics).map(
    (row) => `${row.clinic}: ${row.days}، ${row.hours}`,
  );

  const addresses = info.clinics.map((clinic) => {
    const directions =
      clinic.directions && !isRedundant(clinic.directions, clinic.address) ? clinic.directions : null;
    return directions ? `${clinic.name}: ${clinic.address} (${directions})` : `${clinic.name}: ${clinic.address}`;
  });

  const booking = [MISSING.booking.split(" یا ")[0] ?? "", info.siteInfo.phone ? `یا با شمارهٔ ${phone} تماس بگیرید` : null]
    .filter(Boolean)
    .join(" ");

  const values: Record<string, string> = {
    phone,
    hours: hours.length > 0 ? joinPersian(hours) : MISSING.hours,
    addresses: addresses.length > 0 ? joinPersian(addresses) : MISSING.addresses,
    booking: info.siteInfo.phone ? booking : MISSING.booking,
  };

  // اول `phone`، چون `booking` خودش شماره را در متن دارد و وابسته به آن است.
  return answer.replace(/\{\{(phone|hours|addresses|booking)\}\}/g, (_match, key: string) => values[key] ?? "");
}

/** همهٔ پاسخ‌های فهرست را پر می‌کند؛ خروجی همان شکل ورودی است. */
export function fillFaqItems(items: readonly PublicFaq[], info: PublicInfo): PublicFaq[] {
  return items.map((item) => ({ ...item, answer: fillFaqAnswer(item.answer, info) }));
}

/**
 * پاسخ دقیق برای پرسشی که نام یک مطب را دارد («آدرس مرزداران»). نشانی، راه رسیدن و
 * زمان‌های حضور همان مطب را مستقیم می‌گوید؛ گشتن در فهرست پرسش‌ها لازم نیست.
 */
export function answerForClinic(question: string, info: PublicInfo): { clinic: Clinic; answer: string } | null {
  const normalized = question.replace(/[يی]/g, "ی").replace(/[كک]/g, "ک").replace(/\s+/g, " ");
  const clinic = info.clinics.find((candidate) => {
    const name = candidate.name.replace(/^مطب\s+/, "");
    return name.length > 1 && normalized.includes(name);
  });
  if (!clinic) return null;

  const schedule = summarizeWorkingHours(
    info.workingHours.filter((row) => row.clinicId === clinic.id),
    info.clinics,
  ).map((row) => `${row.days}، ${row.hours}`);

  const parts = [
    `${clinic.name}: ${clinic.address}`,
    clinic.directions ? `راه رسیدن: ${clinic.directions}` : null,
    schedule.length > 0 ? `زمان‌های حضور: ${joinPersian(schedule)}` : null,
  ].filter(Boolean);

  return { clinic, answer: parts.join("\n") };
}
