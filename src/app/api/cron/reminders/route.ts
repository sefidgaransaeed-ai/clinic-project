import { isCronAuthorized } from "@/modules/notifications/cron-auth";
import { runReminders } from "@/modules/notifications/send-reminders";

// ارسال یک‌به‌یک پیام‌ها ممکن است از زمان پیش‌فرض تابع بیشتر شود.
export const maxDuration = 60;

// Vercel cron با GET و هدر Authorization: Bearer <CRON_SECRET> صدا می‌زند.
// پاسخ فقط شمارش است؛ نه شماره، نه نام، نه متن پیام. فقط نام خطا لاگ می‌شود.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron reminders: CRON_SECRET روی سرور تنظیم نشده است");
    return new Response(null, { status: 500 });
  }
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401 });
  }

  try {
    return Response.json(await runReminders());
  } catch (error) {
    console.error(
      `cron reminders: اجرا ناموفق بود (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
    return new Response(null, { status: 500 });
  }
}
