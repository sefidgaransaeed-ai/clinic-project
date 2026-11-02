import { createHash, timingSafeEqual } from "node:crypto";

// هدر Authorization: Bearer <CRON_SECRET> که Vercel هنگام فراخوانی cron می‌فرستد.
// هر دو طرف اول هش می‌شوند تا مقایسه با زمان ثابت انجام شود و طول رمز لو نرود
// (همان روش checkWebhookSecret در telegram-api.ts).
export function isCronAuthorized(
  authorization: string | null,
  secret: string,
): boolean {
  const received = authorization ?? "";
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}
