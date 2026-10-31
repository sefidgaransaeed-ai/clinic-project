import { BALE_CONFIG } from "@/modules/notifications/telegram-api";
import { processWebhook } from "@/modules/notifications/webhook";

// وب‌هوک بله را با این نشانی ثبت کنید: https://<دامنه>/api/bale?secret=<BALE_WEBHOOK_SECRET>
export async function POST(request: Request) {
  return processWebhook(request, BALE_CONFIG);
}
