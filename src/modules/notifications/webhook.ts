import { handleUpdate } from "./bot-handler";
import { checkWebhookSecret, sendMessage } from "./telegram-api";
import type { BotPlatformConfig, BotUpdate } from "./types";

function isBotUpdate(value: unknown): value is BotUpdate {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { update_id?: unknown }).update_id === "number"
  );
}

// منطق مشترک مسیر وب‌هوک یک پیام‌رسان؛ مسیر هر پیام‌رسان فقط پیکربندی خودش را می‌دهد.
// نشانی درخواست (و query آن که ممکن است رمز باشد) و توکن هیچ‌جا لاگ نمی‌شود.
export async function processWebhook(
  request: Request,
  config: BotPlatformConfig,
): Promise<Response> {
  const auth = checkWebhookSecret(request, config);
  if (auth === "not_configured") {
    console.error(`${config.platform} webhook: رمز وب‌هوک روی سرور تنظیم نشده است`);
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

  // بعد از این نقطه همیشه 200؛ وگرنه ممکن است پیام‌رسان همان update را بارها دوباره بفرستد.
  // فقط نام خطا لاگ می‌شود، نه متن آن.
  try {
    const messages = await handleUpdate(update, config.platform);
    for (const message of messages) {
      const result = await sendMessage(message, config);
      if (!result.ok) {
        console.error(
          `${config.platform} webhook: ارسال پیام ناموفق بود (${result.reason}${
            result.status ? ` ${result.status}` : ""
          })`,
        );
      }
    }
  } catch (error) {
    console.error(
      `${config.platform} webhook: پردازش update ناموفق بود (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
  }

  return Response.json({ ok: true });
}
