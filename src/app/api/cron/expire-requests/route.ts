import { isCronAuthorized } from "@/modules/notifications/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * مجری تصمیم `N-03` و `A-5`: درخواست‌های سایت که تأیید نشده‌اند و زمانشان
 * گذشته، یک‌بار در روز `cancelled` با `cancel_reason = 'expired'` می‌شوند.
 *
 * منطق در خود پایگاه داده است (`expire_stale_requests()`)، نه اینجا. این مسیر
 * فقط نگهبان است و تابع را صدا می‌زند.
 *
 * دو لایهٔ نگهبانی روی این تابع هست و هر دو لازم‌اند:
 *   ۱. همین‌جا — هدر `Authorization: Bearer <CRON_SECRET>` که Vercel می‌فرستد
 *   ۲. داخل خود تابع — اگر `request.jwt.claims` نقشی جز `service_role` داشته
 *      باشد، تابع خودش رد می‌کند (فایل `0005_function_grants.sql`)
 *
 * پاسخ فقط یک عدد است؛ هیچ شماره و نام و شناسه‌ای برنمی‌گردد.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron expire-requests: CRON_SECRET روی سرور تنظیم نشده است");
    return new Response(null, { status: 500 });
  }
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401 });
  }

  try {
    const { data, error } = await createAdminClient().rpc("expire_stale_requests");
    if (error) {
      throw new Error(error.message);
    }
    return Response.json({ expired: data ?? 0 });
  } catch (error) {
    // فقط نام خطا لاگ می‌شود، نه متن آن — متن ممکن است داده داشته باشد.
    console.error(
      `cron expire-requests: اجرا ناموفق بود (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
    return new Response(null, { status: 500 });
  }
}
