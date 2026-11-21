import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SurveyAnswer } from "./dashboard-rules";

/**
 * خواندن دادهٔ داشبورد بازخورد (کار p3-10). فقط پزشک، با نشست خودش — نه کلید مدیریتی.
 *
 * چرا مستقیم از جدول و نه از یک تابع RPC: `surveys` سیاست خواندنِ پزشک را دارد
 * (`surveys_doctor_read`)، و منشی هیچ راهی به آن ندارد (H-10). پس RLS همین‌جا قفل است و
 * نیازی به تابع جدا نیست. اگر روزی منشی هم لازم شد، این فایل باید عوض شود، نه صفحه.
 *
 * ستون‌های حساس خوانده نمی‌شوند: نه token، نه appointment_id. داشبورد فقط تاریخ، امتیاز و
 * متن نظر را لازم دارد.
 */

export type DashboardSource = {
  answers: SurveyAnswer[];
  /** لحظهٔ ساختن هر لینک، برای مخرج «نرخ پاسخ» */
  linkCreatedAt: string[];
};

/** حداکثر ردیفی که خوانده می‌شود؛ بیشتر از این، نمودار و کارت‌ها معنی عملی ندارند */
const MAX_ROWS = 5000;

/** سقف صفحهٔ Supabase؛ بیشتر از ۱۰۰۰ ردیف در یک درخواست برنمی‌گردد */
const PAGE = 1000;

/** یک روز جلو یا عقب بردن کلید روز میلادی */
function addDaysToKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function readAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error("دادهٔ بازخورد از پایگاه داده خوانده نشد.");
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * نظرسنجی‌های یک بازهٔ کلید روز میلادی، هر دو سر شامل.
 * پاسخ‌داده‌ها از `submitted_at` و لینک‌ها از `created_at` فیلتر می‌شوند، هر کدام به وقت تهران.
 */
export async function getDashboardSource(fromDay: string, toDay: string): Promise<DashboardSource> {
  const supabase = await createClient();

  // پنجرهٔ UTC را عمداً **گشادتر** از بازهٔ تهران می‌گیریم و مرز دقیق را در rules.ts
  // اعمال می‌کنیم. روز تهران ساعت ۲۰:۳۰ روز قبل به وقت UTC شروع می‌شود؛ اگر پنجره را
  // از ۰۰:۰۰ همان روز می‌گرفتیم، نظرهای ۰۰:۰۰ تا ۰۳:۳۰ بامداد تهران از دست می‌رفت.
  const fromIso = `${addDaysToKey(fromDay, -1)}T00:00:00.000Z`;
  const toIso = `${addDaysToKey(toDay, 1)}T23:59:59.999Z`;

  const answered = await readAll<{ submitted_at: string | null; score: number | null; comment: string | null }>(
    (from, to) =>
      supabase
        .from("surveys")
        .select("submitted_at, score, comment")
        .not("submitted_at", "is", null)
        .gte("submitted_at", fromIso)
        .lte("submitted_at", toIso)
        .order("submitted_at", { ascending: false })
        .range(from, to),
  );

  const links = await readAll<{ created_at: string }>((from, to) =>
    supabase
      .from("surveys")
      .select("created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .range(from, to),
  );

  return {
    answers: answered
      .filter((row) => row.submitted_at !== null && row.score !== null)
      .map((row) => ({
        submittedAt: row.submitted_at as string,
        score: row.score as number,
        comment: row.comment,
      })),
    linkCreatedAt: links.map((row) => row.created_at),
  };
}
