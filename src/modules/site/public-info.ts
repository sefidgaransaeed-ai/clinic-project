import type { Json } from "@/lib/database.types";
import type { Clinic, LocalSiteData, PublicFaq, PublicInfo, SiteInfo, WorkingHours } from "./types";

/**
 * تبدیل اطلاعات سایت به نوع‌های سایت، جدا از data.ts تا بدون پایگاه داده آزمون شود.
 */

/** دادهٔ نمونه را همان‌طور خلاصه می‌کند که get_public_info() جدول‌ها را */
export function fromLocal(local: LocalSiteData): PublicInfo {
  return {
    siteInfo: local.siteInfo,
    clinics: local.clinics,
    workingHours: local.workingHours
      .filter((row) => row.isActive)
      .sort((a, b) => a.weekday - b.weekday)
      .map(({ clinicId, weekday, startTime, endTime }) => ({ clinicId, weekday, startTime, endTime })),
    // تعطیلی‌های نمونه تاریخ ندارند؛ فیلتر «از امروز به بعد» کار پایگاه داده است
    closures: local.closures.map((closure) => closure.closureDate),
    faqItems: local.faqItems
      .filter((item) => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ question, answer }) => ({ question, answer })),
  };
}

// ---------------------------------------------------------------------------
// تبدیل خروجی get_public_info() (jsonb) به نوع‌های سایت. هر چیزی که شکلش درست نیست، کنار
// گذاشته می‌شود تا یک ردیف خراب کل سایت را نشکند (W-11).

type JsonObject = { [key: string]: Json | undefined };

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const arrayOf = (value: Json | undefined): Json[] => (Array.isArray(value) ? value : []);

const text = (value: Json | undefined): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

export function fromDatabase(data: Json): PublicInfo {
  const root = isObject(data) ? data : {};

  const siteInfo: SiteInfo = {};
  const rawSiteInfo = root.site_info;
  if (isObject(rawSiteInfo)) {
    for (const [key, value] of Object.entries(rawSiteInfo)) {
      const clean = text(value);
      if (clean) siteInfo[key as keyof SiteInfo] = clean;
    }
  }

  const clinics: Clinic[] = arrayOf(root.clinics).flatMap((row) => {
    if (!isObject(row)) return [];
    const id = text(row.id);
    const name = text(row.name);
    const address = text(row.address);
    if (!id || !name || !address) return [];
    return [{ id, name, address, directions: text(row.directions) }];
  });

  const workingHours: WorkingHours[] = arrayOf(root.working_hours).flatMap((row) => {
    if (!isObject(row)) return [];
    const clinicId = text(row.clinic_id);
    const startTime = text(row.start_time);
    const endTime = text(row.end_time);
    if (!clinicId || !startTime || !endTime || typeof row.weekday !== "number") return [];
    return [{ clinicId, weekday: row.weekday, startTime, endTime }];
  });

  const faqItems: PublicFaq[] = arrayOf(root.faq).flatMap((row) => {
    if (!isObject(row)) return [];
    const question = text(row.question);
    const answer = text(row.answer);
    const keywords = arrayOf(row.keywords).flatMap((keyword) => {
      const clean = text(keyword);
      return clean ? [clean] : [];
    });
    return question && answer ? [{ question, answer, ...(keywords.length > 0 ? { keywords } : {}) }] : [];
  });

  const closures = arrayOf(root.closures).flatMap((day) => {
    const clean = text(day);
    return clean ? [clean] : [];
  });

  return { siteInfo, clinics, workingHours, faqItems, closures };
}
