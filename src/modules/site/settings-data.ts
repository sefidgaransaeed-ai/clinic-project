import "server-only";

import { createClient } from "@/lib/supabase/server";
import { summarizeWorkingHours } from "./format";
import type { Clinic, FaqItem, SiteInfo } from "./types";

/**
 * خواندن جدول‌ها برای صفحهٔ «تنظیمات سایت» با نشست خود پزشک، تا RLS واقعاً اعمال شود.
 * برخلاف data.ts که فقط پرسش‌های روشن را از get_public_info() می‌گیرد، این‌جا پرسش‌های خاموش
 * و کلیدواژه‌ها هم لازم‌اند.
 */

export type SiteSettingsData = {
  siteInfo: SiteInfo;
  clinics: Clinic[];
  faqItems: FaqItem[];
  /** ساعت‌های کاری، فقط برای نمایش روی تابلو؛ از تنظیمات نوبت‌دهی عوض می‌شوند */
  hours: { clinic: string; days: string; hours: string }[];
};

export async function getSiteSettings(): Promise<SiteSettingsData> {
  const supabase = await createClient();
  const [info, clinics, faq, hours] = await Promise.all([
    supabase.from("site_info").select("key, value"),
    supabase
      .from("clinics")
      .select("id, name, address, directions")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("faq_items")
      .select("id, question, answer, keywords, sort_order, is_active")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("working_hours")
      .select("clinic_id, weekday, start_time, end_time")
      .eq("is_active", true)
      .order("weekday"),
  ]);

  const failed = [info, clinics, faq, hours].find((result) => result.error);
  if (failed?.error) throw new Error("اطلاعات تنظیمات سایت از پایگاه داده خوانده نشد.");

  const clinicList: Clinic[] = (clinics.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    directions: row.directions,
  }));

  return {
    siteInfo: Object.fromEntries((info.data ?? []).map((row) => [row.key, row.value])) as SiteInfo,
    clinics: clinicList,
    faqItems: (faq.data ?? []).map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
    hours: summarizeWorkingHours(
      (hours.data ?? []).flatMap((row) =>
        row.clinic_id
          ? [{ clinicId: row.clinic_id, weekday: row.weekday, startTime: row.start_time, endTime: row.end_time }]
          : [],
      ),
      clinicList,
    ),
  };
}
