import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/**
 * کلاینت مدیریتی — با کلید `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * ⚠️ این کلاینت **از همهٔ قاعده‌های RLS رد می‌شود.** هر چیزی که با آن
 * بنویسید یا بخوانید، بدون بررسی نقش انجام می‌شود.
 *
 * خط اول فایل `import 'server-only'` است: اگر کسی اشتباهی این فایل را در
 * یک کامپوننت سمت مرورگر `import` کند، **build می‌شکند** — نه اینکه کلید
 * بی‌صدا در بستهٔ مرورگر بنشیند. این همان بند ۳ CLAUDE.md است.
 *
 * کجا به‌کارش می‌بریم:
 *   — مسیر `api/cron` برای `expire_stale_requests()` و یادآوری روزانه
 *   — ساخت و غیرفعال‌کردن حساب منشی در صفحهٔ مدیریت کاربران
 *
 * کجا به‌کارش **نمی‌بریم:** هیچ صفحهٔ معمولی پنل. آن‌ها باید از
 * `src/lib/supabase/server.ts` استفاده کنند تا RLS واقعاً اعمال شود.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('متغیر NEXT_PUBLIC_SUPABASE_URL تنظیم نشده است.');
  }
  if (!serviceRoleKey) {
    throw new Error('متغیر SUPABASE_SERVICE_ROLE_KEY تنظیم نشده است.');
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      // این کلاینت نشست ندارد و نباید داشته باشد.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
