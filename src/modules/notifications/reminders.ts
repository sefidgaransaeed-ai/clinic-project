import { formatJalaliDateTime, toTehranDateString } from "@/lib/format";
import { normalizeMobile } from "./mobile";
import type { BotPlatform } from "./types";

// هستهٔ خالص یادآوری: نه شبکه، نه پایگاه داده. send-reminders.ts داده را می‌خواند، اینجا
// می‌دهد و فهرست پیام‌ها را می‌گیرد؛ خواندن، ارسال و ثبت در reminder_log را هم
// send-reminders.ts به deliverReminders تزریق می‌کند.
// هدف یادآوری هر نوبت فقط appointments.requester_mobile است (سند ۰۰۱۲).
// هر اجرا می‌فرستد: ساعت اجرا را cron تعیین می‌کند و app_settings.reminder_hour را
// این هسته نمی‌خواند. تهران ثابت +۰۳:۳۰ است (بدون ساعت تابستانی)، ولی «فردا» با
// تقویم تهران حساب می‌شود نه با ۲۴ ساعت بعد.

const TEHRAN_OFFSET = "+03:30";

export type ReminderClinic = { name: string; address: string };

export type ReminderAppointment = {
  id: string;
  // ISO؛ همان timestamptz پایگاه داده
  startsAt: string;
  status: string;
  requesterMobile: string;
  clinic: ReminderClinic | null;
};

export type ReminderLink = {
  platform: BotPlatform;
  chatId: string;
  mobile: string;
};

export type ReminderLogEntry = {
  appointmentId: string;
  platform: BotPlatform;
  result: "sent" | "failed" | "no_link";
};

export type Reminder = {
  platform: BotPlatform;
  chatId: string;
  appointmentId: string;
  text: string;
};

export type ReminderCounts = { sent: number; failed: number; skipped: number };

// «saved» یعنی ردیف نشست؛ «duplicate» یعنی برای همین (نوبت، پیام‌رسان) پیش‌تر
// «sent» ثبت شده بود. هر خطای دیگر باید throw شود.
export type ReminderDelivery = {
  send: (reminder: Reminder) => Promise<boolean>;
  log: (entry: ReminderLogEntry) => Promise<"saved" | "duplicate">;
};

// روز بعدِ یک تاریخ YYYY-MM-DD در تقویم؛ به منطقهٔ زمانی بستگی ندارد.
function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// بازهٔ [from, to) از «فردا» به وقت تهران، به‌صورت ISO در UTC؛ برای پرس‌وجوی starts_at.
export function tomorrowTehranRange(now: Date): { from: string; to: string } {
  const tomorrow = nextDateKey(toTehranDateString(now));
  return {
    from: new Date(`${tomorrow}T00:00:00${TEHRAN_OFFSET}`).toISOString(),
    to: new Date(`${nextDateKey(tomorrow)}T00:00:00${TEHRAN_OFFSET}`).toISOString(),
  };
}

// نام مراجع، توصیهٔ پزشکی و پیشنهاد ثبت یا تغییر نوبت عمداً در متن نیست.
function reminderText(startsAt: Date, clinic: ReminderClinic | null): string {
  const head =
    "یادآوری نوبت\n" + `نوبت شما فردا است: ${formatJalaliDateTime(startsAt)}`;
  return clinic
    ? `${head}\n\nمطب: ${clinic.name}\nنشانی: ${clinic.address}`
    : head;
}

export function buildReminders({
  now,
  appointments,
  links,
  sentLog,
}: {
  now: Date;
  appointments: ReminderAppointment[];
  links: ReminderLink[];
  sentLog: ReminderLogEntry[];
}): Reminder[] {
  const tomorrow = nextDateKey(toTehranDateString(now));
  const logged = new Set(
    sentLog.map((entry) => `${entry.appointmentId}:${entry.platform}`),
  );
  // شمارهٔ نامعتبر null می‌شود و نباید با شمارهٔ نامعتبر دیگر یکی حساب شود.
  const normalizedLinks = links.map((link) => ({
    link,
    mobile: normalizeMobile(link.mobile),
  }));

  const reminders: Reminder[] = [];
  const seen = new Set<string>();

  for (const appointment of appointments) {
    if (appointment.status !== "confirmed") {
      continue;
    }
    const startsAt = new Date(appointment.startsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      toTehranDateString(startsAt) !== tomorrow
    ) {
      continue;
    }

    const requesterMobile = normalizeMobile(appointment.requesterMobile);
    if (!requesterMobile) {
      continue;
    }

    const text = reminderText(startsAt, appointment.clinic);
    for (const { link, mobile } of normalizedLinks) {
      if (mobile !== requesterMobile) {
        continue;
      }
      if (logged.has(`${appointment.id}:${link.platform}`)) {
        continue;
      }
      const key = `${appointment.id}:${link.platform}:${link.chatId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      reminders.push({
        platform: link.platform,
        chatId: link.chatId,
        appointmentId: appointment.id,
        text,
      });
    }
  }

  return reminders;
}

// پیام‌هایی که باید بروند، و شمار جفت‌هایی که چون پیش‌تر «sent» ثبت شده بودند کنار رفتند.
export function planReminders(input: {
  now: Date;
  appointments: ReminderAppointment[];
  links: ReminderLink[];
  sentLog: ReminderLogEntry[];
}): { reminders: Reminder[]; alreadySent: number } {
  const reminders = buildReminders(input);
  const everything = buildReminders({ ...input, sentLog: [] });
  return { reminders, alreadySent: everything.length - reminders.length };
}

// پیام‌ها را پشت‌سرهم می‌فرستد و نتیجه را ثبت می‌کند. تلاش دوباره نیست و خطای یک پیام
// (ارسال یا ثبت) اجرا را نمی‌شکند. فقط شمارش برمی‌گرداند: نه شماره، نه نام، نه متن.
export async function deliverReminders(
  reminders: Reminder[],
  delivery: ReminderDelivery,
): Promise<ReminderCounts> {
  const counts: ReminderCounts = { sent: 0, failed: 0, skipped: 0 };

  for (const reminder of reminders) {
    let delivered = false;
    try {
      delivered = await delivery.send(reminder);
    } catch {
      delivered = false;
    }

    let outcome: "saved" | "duplicate" | "error" = "error";
    try {
      outcome = await delivery.log({
        appointmentId: reminder.appointmentId,
        platform: reminder.platform,
        result: delivered ? "sent" : "failed",
      });
    } catch {
      // پیام یا رفته یا نرفته؛ نبودِ ردیف لاگ آن را عوض نمی‌کند.
    }

    if (!delivered) {
      counts.failed += 1;
    } else if (outcome === "duplicate") {
      counts.skipped += 1;
    } else {
      counts.sent += 1;
    }
  }

  return counts;
}
