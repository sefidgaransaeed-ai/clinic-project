import { handleUpdate } from "@/modules/notifications/bot-handler";
import {
  checkWebhookSecret,
  sendMessage,
  TELEGRAM_CONFIG,
} from "@/modules/notifications/telegram-api";
import type { BotUpdate } from "@/modules/notifications/types";

function isBotUpdate(value: unknown): value is BotUpdate {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { update_id?: unknown }).update_id === "number"
  );
}

export async function POST(request: Request) {
  const auth = checkWebhookSecret(request, TELEGRAM_CONFIG);
  if (auth === "not_configured") {
    console.error("telegram webhook: رمز وب‌هوک روی سرور تنظیم نشده است");
    return new Response(null, { status: 500 });
  }
  if (auth === "rejected") {
    return new Response(null, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isBotUpdate(update)) {
    return new Response(null, { status: 400 });
  }

  // بعد از این نقطه همیشه 200؛ وگرنه تلگرام همان update را بارها دوباره می‌فرستد.
  // فقط نام خطا لاگ می‌شود، نه متن آن.
  try {
    const messages = await handleUpdate(update, TELEGRAM_CONFIG.platform);
    for (const message of messages) {
      const result = await sendMessage(message, TELEGRAM_CONFIG);
      if (!result.ok) {
        console.error(
          `telegram webhook: ارسال پیام ناموفق بود (${result.reason}${
            result.status ? ` ${result.status}` : ""
          })`,
        );
      }
    }
  } catch (error) {
    console.error(
      `telegram webhook: پردازش update ناموفق بود (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
  }

  return Response.json({ ok: true });
}
