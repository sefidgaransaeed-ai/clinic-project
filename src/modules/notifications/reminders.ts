import { formatJalaliDateTime, toTehranDateString } from "@/lib/format";
import { normalizeMobile } from "./bot-handler";
import type { BotPlatform } from "./types";

// هستهٔ خالص یادآوری: نه شبکه، نه پایگاه داده. مسیر cron داده را می‌خواند، اینجا
// می‌دهد و فهرست پیام‌ها را می‌گیرد؛ ارسال و ثبت در reminder_log کار خود مسیر است.
// تهران ثابت +۰۳:۳۰ است (بدون ساعت تابستانی)، ولی «فردا» با تقویم تهران حساب می‌شود
// نه با ۲۴ ساعت بعد.

const DEFAULT_REMINDER_HOUR = 18;

const tehranHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran",
  hour: "numeric",
  hourCycle: "h23",
});

export type ReminderClinic = { name: string; address: string };

export type ReminderAppointment = {
  id: string;
  // ISO؛ همان timestamptz پایگاه داده
  startsAt: string;
  status: string;
  requesterMobile: string;
  // patients.mobile؛ شمارهٔ شخصی ممکن است ثبت نشده باشد
  patientMobile: string | null;
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

// app_settings.reminder_hour متن است؛ فقط عدد صحیح ۰ تا ۲۳ پذیرفته می‌شود، وگرنه پیش‌فرض ۱۸.
export function parseReminderHour(value: string | null | undefined): number {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,2}$/.test(trimmed)) {
    return DEFAULT_REMINDER_HOUR;
  }
  const hour = Number(trimmed);
  return hour <= 23 ? hour : DEFAULT_REMINDER_HOUR;
}

function tehranHour(date: Date): number {
  const part = tehranHourFormatter
    .formatToParts(date)
    .find((item) => item.type === "hour");
  return Number(part?.value);
}

// روز بعدِ یک تاریخ YYYY-MM-DD در تقویم؛ به منطقهٔ زمانی بستگی ندارد.
function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
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
  reminderHour,
  appointments,
  links,
  sentLog,
}: {
  now: Date;
  reminderHour: number;
  appointments: ReminderAppointment[];
  links: ReminderLink[];
  sentLog: ReminderLogEntry[];
}): Reminder[] {
  if (tehranHour(now) !== reminderHour) {
    return [];
  }

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

    const numbers = new Set<string>();
    for (const raw of [appointment.requesterMobile, appointment.patientMobile]) {
      const mobile = raw === null ? null : normalizeMobile(raw);
      if (mobile) {
        numbers.add(mobile);
      }
    }
    if (numbers.size === 0) {
      continue;
    }

    const text = reminderText(startsAt, appointment.clinic);
    for (const { link, mobile } of normalizedLinks) {
      if (!mobile || !numbers.has(mobile)) {
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
