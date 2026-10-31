import { createHash, timingSafeEqual } from "node:crypto";
import type {
  BotPlatformConfig,
  OutgoingMessage,
  SendResult,
} from "./types";

// نشانی پایه جدا نگه داشته شده تا بله (https://tapi.bale.ai/bot<TOKEN>/) با
// تغییر همین ثابت و نام متغیرها از همین کد استفاده کند.
export const TELEGRAM_CONFIG: BotPlatformConfig = {
  platform: "telegram",
  baseUrl: "https://api.telegram.org",
  tokenEnv: "TELEGRAM_BOT_TOKEN",
  secretEnv: "TELEGRAM_WEBHOOK_SECRET",
};

const REQUEST_TIMEOUT_MS = 8000;

// توکن در خود نشانی درخواست است، پس هیچ‌جا خطای fetch یا نشانی چاپ نمی‌شود؛
// فقط یک متن ثابت و کد وضعیت برمی‌گردد.
export async function sendMessage(
  message: OutgoingMessage,
  config: BotPlatformConfig = TELEGRAM_CONFIG,
): Promise<SendResult> {
  const token = process.env[config.tokenEnv];
  if (!token) {
    return { ok: false, reason: "no_token" };
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: message.chatId,
        text: message.text,
        reply_markup: message.replyMarkup,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) {
    return { ok: false, reason: "rejected", status: response.status };
  }
  return { ok: true };
}

export type WebhookAuth = "ok" | "rejected" | "not_configured";

// هدر رمز وب‌هوک را با زمان ثابت مقایسه می‌کند. هر دو طرف اول هش می‌شوند تا
// طول رمز هم از روی زمان پاسخ لو نرود. اگر رمز سمت سرور تنظیم نشده باشد،
// هیچ درخواستی پذیرفته نمی‌شود.
export function checkWebhookSecret(
  request: Request,
  config: BotPlatformConfig = TELEGRAM_CONFIG,
): WebhookAuth {
  const expected = process.env[config.secretEnv];
  if (!expected) {
    return "not_configured";
  }
  // نام این هدر برای بله هنوز از مستندات رسمی تأیید نشده است.
  const received = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "rejected";
}
