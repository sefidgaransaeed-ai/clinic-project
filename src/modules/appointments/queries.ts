import "server-only";

import { createClient } from "@/lib/supabase/server";

import { PANEL_LOAD_FAILED_MESSAGE } from "./data";
import { getTehranDateKey } from "./date";
import { buildPanelSnapshot } from "./row-mappers";
import type { PanelLoadResult } from "./types";

/**
 * خواندن ردیف‌های پنل از Supabase، با نشست کاربر واردشده (کلید anon + کوکی)، پس RLS اعمال می‌شود:
 * هر چه نقش اجازه ندهد ردیفش برنمی‌گردد. فقط سمت سرور (Server Component).
 *
 * هیچ نوشتنی اینجا نیست؛ ثبت و ویرایش کار برش بعدی است.
 */

/** نوع کلاینتی که `createClient` می‌دهد؛ برای تابع‌های کمکی مشترک با ماژول مراجعان. */
export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * «امروز» به وقت تهران. تابع `tehran_today` پایگاه داده را می‌خواند؛ اگر نشد، همان حساب قبلی سمت سرور.
 */
export async function readClinicToday(supabase: ServerSupabase): Promise<string> {
  const { data, error } = await supabase.rpc("tehran_today");
  return error || !data ? getTehranDateKey(new Date()) : data;
}

/** نوبت‌ها، مراجعان، ساعت کاری و تعطیلی‌ها برای صفحه‌های «نوبت‌های امروز»، «درخواست‌ها» و «تقویم». */
export async function loadPanelSnapshot(): Promise<PanelLoadResult> {
  try {
    const supabase = await createClient();
    const [appointments, patients, workingHours, closures, today] = await Promise.all([
      supabase.from("appointments").select("*").order("starts_at"),
      supabase
        .from("patients")
        .select("id, full_name, mobile, national_id, birth_date, gender, insurance_types(name)")
        .order("full_name"),
      supabase.from("working_hours").select("weekday, start_time, end_time").eq("is_active", true),
      supabase.from("closures").select("closure_date, reason").order("closure_date"),
      readClinicToday(supabase),
    ]);

    const failure = appointments.error ?? patients.error ?? workingHours.error ?? closures.error;
    if (failure) {
      console.error("خواندن نوبت‌ها از پایگاه داده ناموفق بود:", failure.message);
      return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
    }

    return {
      ok: true,
      snapshot: buildPanelSnapshot({
        appointments: appointments.data ?? [],
        patients: patients.data ?? [],
        workingHours: workingHours.data ?? [],
        closures: closures.data ?? [],
        today,
      }),
    };
  } catch (error) {
    console.error("خواندن نوبت‌ها ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
  }
}
