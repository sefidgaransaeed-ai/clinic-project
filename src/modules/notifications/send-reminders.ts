import { createAdminClient } from "@/lib/supabase/admin";
import {
  deliverReminders,
  planReminders,
  tomorrowTehranRange,
  type Reminder,
  type ReminderAppointment,
  type ReminderCounts,
  type ReminderLink,
  type ReminderLogEntry,
} from "./reminders";
import { BALE_CONFIG, sendMessage, TELEGRAM_CONFIG } from "./telegram-api";
import type { BotPlatform, BotPlatformConfig } from "./types";

// ردیف‌کنندهٔ یادآوری روزانه. کلاینت مدیریتی فقط در loadReminderInput و
// logReminderResult به‌کار می‌رود: مسیر cron نشست ندارد و bot_links و reminder_log
// برای anon هیچ قاعده‌ای ندارند. متن خطاها عمداً ثابت است (ممکن است ردیف
// شماره داشته باشد) و هیچ‌جا شماره، نام یا متن پیام لاگ نمی‌شود.

const PLATFORM_CONFIGS: Record<BotPlatform, BotPlatformConfig> = {
  telegram: TELEGRAM_CONFIG,
  bale: BALE_CONFIG,
};

// کد خطای نقض یکتایی در PostgreSQL؛ برای reminder_log یعنی «پیش‌تر sent ثبت شده».
const UNIQUE_VIOLATION = "23505";

function isBotPlatform(value: string): value is BotPlatform {
  return value === "telegram" || value === "bale";
}

type ReminderInput = {
  appointments: ReminderAppointment[];
  links: ReminderLink[];
  sentLog: ReminderLogEntry[];
};

// نوبت‌های تأییدشدهٔ بازه، لینک‌های ربات هم‌شماره با requester_mobile آن‌ها، و
// جفت‌های (نوبت، پیام‌رسان) که پیش‌تر result='sent' دارند.
async function loadReminderInput(range: {
  from: string;
  to: string;
}): Promise<ReminderInput> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("appointments")
    .select("id, starts_at, status, requester_mobile, clinics(name, address)")
    .eq("status", "confirmed")
    .gte("starts_at", range.from)
    .lt("starts_at", range.to);
  if (error) {
    throw new Error("خواندن نوبت‌های فردا ناموفق بود.");
  }
  if (rows.length === 0) {
    return { appointments: [], links: [], sentLog: [] };
  }

  const appointments: ReminderAppointment[] = rows.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    status: row.status,
    requesterMobile: row.requester_mobile,
    clinic: row.clinics ? { name: row.clinics.name, address: row.clinics.address } : null,
  }));
  const mobiles = [...new Set(appointments.map((a) => a.requesterMobile))];
  const ids = appointments.map((a) => a.id);

  const [linksResult, logResult] = await Promise.all([
    admin.from("bot_links").select("platform, chat_id, mobile").in("mobile", mobiles),
    admin
      .from("reminder_log")
      .select("appointment_id, platform")
      .eq("result", "sent")
      .in("appointment_id", ids),
  ]);
  if (linksResult.error) {
    throw new Error("خواندن اتصال‌های ربات ناموفق بود.");
  }
  if (logResult.error) {
    throw new Error("خواندن لاگ یادآوری‌ها ناموفق بود.");
  }

  const links: ReminderLink[] = [];
  for (const row of linksResult.data) {
    if (isBotPlatform(row.platform)) {
      links.push({ platform: row.platform, chatId: row.chat_id, mobile: row.mobile });
    }
  }
  const sentLog: ReminderLogEntry[] = [];
  for (const row of logResult.data) {
    if (isBotPlatform(row.platform)) {
      sentLog.push({ appointmentId: row.appointment_id, platform: row.platform, result: "sent" });
    }
  }

  return { appointments, links, sentLog };
}

// ثبت نتیجه در reminder_log. نقض یکتایی یعنی «پیش‌تر sent ثبت شده»، نه خطا.
async function logReminderResult(
  entry: ReminderLogEntry,
): Promise<"saved" | "duplicate"> {
  const { error } = await createAdminClient().from("reminder_log").insert({
    appointment_id: entry.appointmentId,
    platform: entry.platform,
    result: entry.result,
  });
  if (!error) {
    return "saved";
  }
  if (error.code === UNIQUE_VIOLATION) {
    return "duplicate";
  }
  console.error("reminders: ثبت نتیجه در reminder_log ناموفق بود");
  throw new Error("ثبت نتیجهٔ یادآوری ناموفق بود.");
}

async function sendReminder(reminder: Reminder): Promise<boolean> {
  const result = await sendMessage(
    { chatId: reminder.chatId, text: reminder.text },
    PLATFORM_CONFIGS[reminder.platform],
  );
  if (!result.ok) {
    console.error(
      `reminders: ارسال ${reminder.platform} ناموفق بود (${result.reason}${
        result.status ? ` ${result.status}` : ""
      })`,
    );
  }
  return result.ok;
}

// هر اجرا می‌فرستد؛ ساعت اجرا را cron تعیین می‌کند. خطای خواندن پایگاه داده throw می‌شود
// تا مسیر ۵۰۰ بدهد.
export async function runReminders(now: Date = new Date()): Promise<ReminderCounts> {
  const input = await loadReminderInput(tomorrowTehranRange(now));
  const plan = planReminders({ now, ...input });
  const counts = await deliverReminders(plan.reminders, {
    send: sendReminder,
    log: logReminderResult,
  });
  return { ...counts, skipped: counts.skipped + plan.alreadySent };
}
