import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMobile } from "./mobile";
import type { BotLink, BotPlatform, MobileMatch } from "./types";

// تابع‌های این فایل به پایگاه داده وصل‌اند. کلاینت مدیریتی فقط در همین سه تابع
// (findMobileMatch ، saveBotLink ، findBotLink) به‌کار می‌رود: وب‌هوک نشست ندارد و
// bot_links برای anon و منشی هیچ قاعده‌ای ندارد. متن خطاها عمداً ثابت است:
// پیام خطای Supabase ممکن است ردیف (شماره) را در خود داشته باشد.

// وضعیت‌های «نوبت آینده» در پایگاه داده: requested (در انتظار تأیید) و confirmed.
const UPCOMING_STATUSES = ["requested", "confirmed"];

// تصمیم M-7 و سند ۰۰۱۲: فقط appointments.requester_mobile؛ patients.mobile نقشی ندارد.
// فقط وجود نوبت آینده برمی‌گردد (نه شماره، نه نام). mobile باید به قالب ۰۹xxxxxxxxx
// نرمال‌شده باشد؛ اگر نبود دوباره نرمال می‌شود و ناممکن‌ها null می‌دهند.
export async function findMobileMatch(
  mobile: string,
): Promise<MobileMatch | null> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) {
    return null;
  }

  const { data, error } = await createAdminClient()
    .from("appointments")
    .select("id")
    .eq("requester_mobile", normalized)
    .in("status", UPCOMING_STATUSES)
    .gt("starts_at", new Date().toISOString())
    .limit(1);
  if (error) {
    throw new Error("جست‌وجوی نوبت‌های این شماره ناموفق بود.");
  }
  return data.length > 0 ? { source: "appointment" } : null;
}

// unique (platform, chat_id): اتصال دوباره از همان حساب، ردیف قبلی را به‌روز می‌کند.
// patient_id عمداً همیشه خالی است (سند ۰۰۱۲)، حتی اگر فراخواننده چیز دیگری بدهد.
export async function saveBotLink(link: BotLink): Promise<void> {
  const { error } = await createAdminClient()
    .from("bot_links")
    .upsert(
      {
        platform: link.platform,
        chat_id: link.chatId,
        mobile: link.mobile,
        patient_id: null,
      },
      { onConflict: "platform,chat_id" },
    );
  if (error) {
    throw new Error("ذخیرهٔ اتصال ربات ناموفق بود.");
  }
}

export async function findBotLink(
  platform: BotPlatform,
  chatId: string,
): Promise<BotLink | null> {
  const { data, error } = await createAdminClient()
    .from("bot_links")
    .select("chat_id, mobile, patient_id")
    .eq("platform", platform)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (error) {
    throw new Error("خواندن اتصال ربات ناموفق بود.");
  }
  if (!data) {
    return null;
  }
  return {
    platform,
    chatId: data.chat_id,
    mobile: data.mobile,
    patientId: data.patient_id,
  };
}
