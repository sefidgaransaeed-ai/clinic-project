import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * کلاینت Supabase برای صفحهٔ عمومی `/nobat`: فقط کلید عمومی (anon) و بدون کوکی، پس هر بازدیدکننده — حتی منشیِ واردشده —
 * با نقش `anon` وارد می‌شود و فقط توابع عمومی (`get_public_info`، `available_slots`، `request_appointment`) را می‌بیند.
 * کلید `SUPABASE_SERVICE_ROLE_KEY` هرگز اینجا خوانده نمی‌شود (بند ۳ CLAUDE.md).
 * عمداً بدون نوع `Database` است: `available_slots` در `database.types.ts` هنوز ستون‌های مطب را ندارد، و خروجی را خودمان می‌سنجیم.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("متغیرهای NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY تنظیم نشده‌اند.");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
