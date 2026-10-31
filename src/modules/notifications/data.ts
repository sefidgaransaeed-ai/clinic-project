import type { BotLink, BotPlatform, MobileMatch } from "./types";

// فعلاً همه‌چیز در حافظه است. امضای تابع‌ها همان چیزی است که اتصال Supabase
// بعداً در همین فایل جایگزین می‌کند؛ بقیهٔ ماژول فقط از این تابع‌ها می‌خواند.
// داده‌ها ساختگی‌اند و شماره‌ها واقعی نیستند.

type MockPatient = { id: string; mobile: string | null };
type MockAppointment = { patientId: string | null; requesterMobile: string };

const mockPatients: MockPatient[] = [
  { id: "mock-patient-1", mobile: "09120000001" },
  // مراجعی که شمارهٔ شخصی ندارد (تصمیم M-1)
  { id: "mock-patient-2", mobile: null },
];

// نوبت‌های آینده؛ requester_mobile همیشه پر است (تصمیم A-4)
const mockUpcomingAppointments: MockAppointment[] = [
  { patientId: "mock-patient-2", requesterMobile: "09120000002" },
  // درخواست هنوز تأییدنشده، پس مراجعی به آن وصل نیست
  { patientId: null, requesterMobile: "09120000003" },
];

const botLinks = new Map<string, BotLink>();

function linkKey(platform: BotPlatform, chatId: string): string {
  return `${platform}:${chatId}`;
}

// تصمیم M-5: اول patients.mobile، اگر نبود requester_mobile نوبت‌های آینده.
// mobile باید به قالب ۰۹xxxxxxxxx نرمال‌شده باشد.
export async function findMobileMatch(
  mobile: string,
): Promise<MobileMatch | null> {
  const patient = mockPatients.find((p) => p.mobile === mobile);
  if (patient) {
    return { source: "patient", patientId: patient.id };
  }
  const appointment = mockUpcomingAppointments.find(
    (a) => a.requesterMobile === mobile,
  );
  if (appointment) {
    return { source: "appointment", patientId: appointment.patientId };
  }
  return null;
}

// unique (platform, chat_id): اتصال دوباره از همان حساب، ردیف قبلی را به‌روز می‌کند.
export async function saveBotLink(link: BotLink): Promise<void> {
  botLinks.set(linkKey(link.platform, link.chatId), link);
}

export async function findBotLink(
  platform: BotPlatform,
  chatId: string,
): Promise<BotLink | null> {
  return botLinks.get(linkKey(platform, chatId)) ?? null;
}
