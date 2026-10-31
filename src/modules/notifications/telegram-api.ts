import { createHash, timingSafeEqual } from "node:crypto";
import type {
  BotPlatformConfig,
  OutgoingMessage,
  SendResult,
} from "./types";

// هر پیام‌رسان فقط با نشانی پایه، نام متغیرهای محیطی و جای رمز وب‌هوک فرق می‌کند.
export const TELEGRAM_CONFIG: BotPlatformConfig = {
  platform: "telegram",
  baseUrl: "https://api.telegram.org",
  tokenEnv: "TELEGRAM_BOT_TOKEN",
  secretEnv: "TELEGRAM_WEBHOOK_SECRET",
  secretSource: "header",
};

// بله: https://tapi.bale.ai/bot<TOKEN>/METHOD
export const BALE_CONFIG: BotPlatformConfig = {
  platform: "bale",
  baseUrl: "https://tapi.bale.ai",
  tokenEnv: "BALE_BOT_TOKEN",
  secretEnv: "BALE_WEBHOOK_SECRET",
  secretSource: "query",
  baseUrlOverrideEnv: "BALE_API_BASE_URL_DEV",
};

const REQUEST_TIMEOUT_MS = 8000;

// نشانی پایهٔ واقعی، یا در آزمون محلی نشانی سرور جعلی. نشانی جایگزین فقط خارج از انتشار
// و فقط برای localhost یا 127.0.0.1 پذیرفته می‌شود؛ هر چیز دیگر null برمی‌گرداند تا
// درخواست اصلاً ارسال نشود (وگرنه توکن ساختگی به سرور واقعی می‌رفت).
function resolveBaseUrl(config: BotPlatformConfig): string | null {
  const override = config.baseUrlOverrideEnv
    ? process.env[config.baseUrlOverrideEnv]
    : undefined;
  if (!override) {
    return config.baseUrl;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL !== undefined) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(override);
  } catch {
    return null;
  }
  const isLoopback =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  return isLoopback ? url.origin : null;
}

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

  const baseUrl = resolveBaseUrl(config);
  if (!baseUrl) {
    return { ok: false, reason: "network" };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/bot${token}/sendMessage`, {
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

// رمزی که درخواست آورده است. بله در مستندات رسمی خود هدر رمز ندارد (setWebhook فقط url
// می‌گیرد)، پس رمز در query نشانی وب‌هوک است. نشانی و query هرگز لاگ نمی‌شود.
function readReceivedSecret(request: Request, config: BotPlatformConfig): string {
  if (config.secretSource === "header") {
    return request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  }
  try {
    return new URL(request.url).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

// رمز وب‌هوک را با زمان ثابت مقایسه می‌کند. هر دو طرف اول هش می‌شوند تا
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
  const received = readReceivedSecret(request, config);
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "rejected";
}
