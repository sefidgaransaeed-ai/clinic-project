import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

/**
 * کلاینت Supabase برای Server Component و Server Action و Route Handler.
 *
 * نشست کاربر را از کوکی می‌خواند، پس `auth.uid()` و نقش داخل JWT در
 * قاعده‌های RLS درست کار می‌کنند.
 *
 * ⚠️ در Next.js ۱۶ تابع `cookies()` ناهمگام است، پس این تابع هم ناهمگام
 * است و باید با `await` صدا زده شود:
 *
 *     const supabase = await createClient();
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('متغیرهای NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY تنظیم نشده‌اند.');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // در Server Component نوشتن کوکی مجاز نیست و خطا می‌دهد.
        // تازه‌سازی نشست کار middleware است، نه این‌جا — پس خطا را
        // عمداً نادیده می‌گیریم تا صفحه‌های خواندنی نشکنند.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // از Server Component صدا زده شده؛ بی‌خطر است.
        }
      },
    },
  });
}
