import { localPublicInfo } from "./content";
import type { Clinic, FaqItem, PublicInfo, SiteInfo, WorkingHours } from "./types";

/**
 * خواندن اطلاعات سایت عمومی.
 * فعلاً از content.ts خوانده می‌شود. وقتی پایگاه داده آماده شد، فقط همین تابع عوض می‌شود
 * تا تابع get_public_info() را صدا بزند — بقیهٔ فایل‌ها دست نمی‌خورند.
 */
export async function getPublicInfo(): Promise<PublicInfo> {
  return localPublicInfo;
}

export async function getSiteInfo(): Promise<SiteInfo> {
  const info = await getPublicInfo();
  return info.siteInfo;
}

export async function getClinics(): Promise<Clinic[]> {
  const info = await getPublicInfo();
  return info.clinics;
}

/** فقط پرسش‌های فعال، به ترتیب sortOrder */
export async function getFaqItems(): Promise<FaqItem[]> {
  const info = await getPublicInfo();
  return info.faqItems
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** فقط روزهای فعال، به ترتیب روز هفته */
export async function getWorkingHours(): Promise<WorkingHours[]> {
  const info = await getPublicInfo();
  return info.workingHours
    .filter((row) => row.isActive)
    .sort((a, b) => a.weekday - b.weekday);
}
