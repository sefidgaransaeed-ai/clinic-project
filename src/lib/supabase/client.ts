import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

/**
 * کلاینت Supabase برای کامپوننت‌های سمت مرورگر.
 *
 * فقط کلید عمومی را می‌خواند. هر چیزی که این کلاینت می‌بیند، با قاعده‌های
 * RLS محافظت می‌شود — پس «مخفی کردن دکمه» جای کنترل دسترسی را نمی‌گیرد
 * (بند ۵ CLAUDE.md).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('متغیرهای NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY تنظیم نشده‌اند.');
  }

  return createBrowserClient<Database>(url, anonKey);
}
