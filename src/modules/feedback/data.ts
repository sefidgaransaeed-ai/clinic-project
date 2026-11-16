import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * خواندن و نوشتن نظرسنجی پس از نوبت (کار p3-09). منطق داده فقط این‌جاست (بخش ۴ CLAUDE.md).
 *
 * مراجع حساب ندارد، پس صفحهٔ نظرسنجی فقط دو تابع عمومی get_survey و submit_survey را با کلید
 * عمومی صدا می‌زند؛ به هیچ جدولی راه ندارد. ساختن لینک و فهرست نوبت‌ها با نشست خود پزشک یا
 * منشی است و نقش را خود تابع‌های پایگاه داده هم بررسی می‌کنند. منشی به جدول surveys دسترسی
 * ندارد و نتیجه‌ها را نمی‌بیند (H-10).
 */

/** خطایی که تابع plpgsql با raise exception می‌دهد: لینک نامعتبر، پاسخ‌داده یا کهنه */
const RAISED = "P0001";

/** کلاینت بی‌نشست با کلید عمومی، برای صفحهٔ عمومی؛ کوکی نمی‌خواند */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SurveyLookup =
  | { status: "open"; startsAt: string }
  /** نامعتبر، قبلاً پاسخ‌داده، یا بیش از یک ماه از ساختنش گذشته — پایگاه داده این سه را جدا نمی‌کند */
  | { status: "closed" }
  /** پایگاه داده در دسترس نیست؛ لینک شاید سالم باشد */
  | { status: "unavailable" };

export async function getSurvey(token: string): Promise<SurveyLookup> {
  const supabase = anonClient();
  if (!supabase) return { status: "unavailable" };
  try {
    const { data, error } = await supabase.rpc("get_survey", { p_token: token });
    if (error) return error.code === RAISED ? { status: "closed" } : { status: "unavailable" };
    const row = data?.[0];
    return row ? { status: "open", startsAt: row.starts_at } : { status: "closed" };
  } catch {
    return { status: "unavailable" };
  }
}

export type SubmitOutcome = "saved" | "closed" | "unavailable";

/** بررسی امتیاز و متن پیش از این‌جا در action انجام شده؛ پایگاه داده هم دوباره بررسی می‌کند */
export async function submitSurveyAnswer(token: string, score: number, comment: string): Promise<SubmitOutcome> {
  const supabase = anonClient();
  if (!supabase) return "unavailable";
  try {
    const { error } = await supabase.rpc("submit_survey", {
      p_token: token,
      p_score: score,
      p_comment: comment,
    });
    if (!error) return "saved";
    return error.code === RAISED ? "closed" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export type LinkCandidate = { appointmentId: string; patientName: string; startsAt: string };

/** نوبت‌های انجام‌شدهٔ چند روز اخیر که هنوز لینک نظرسنجی ندارند، تازه‌ترین اول */
export async function getLinkCandidates(days = 7): Promise<LinkCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("done_appointments_without_survey", { p_days: days });
  if (error) throw new Error("فهرست نوبت‌های انجام‌شده از پایگاه داده خوانده نشد.");
  return (data ?? []).map((row) => ({
    appointmentId: row.appointment_id,
    patientName: row.patient_name,
    startsAt: row.starts_at,
  }));
}

/** token لینک نظرسنجی یک نوبت انجام‌شده؛ اگر از قبل لینک داشته، همان را برمی‌گرداند */
export async function createSurveyToken(appointmentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_survey_link", { p_appointment_id: appointmentId });
  return error || !data ? null : data;
}
