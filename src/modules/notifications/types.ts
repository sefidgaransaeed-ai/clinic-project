// نوع‌های ربات پیام‌رسان. فقط فیلدهایی که کد واقعاً می‌خواند آمده‌اند؛
// API بله همین شکل را دارد، پس نام‌ها عمداً به تلگرام بسته نشده‌اند.

export type BotPlatform = "telegram" | "bale";

// تنها چیزی که بین پیام‌رسان‌ها فرق می‌کند: نشانی پایه، نام متغیرهای محیطی و جای رمز وب‌هوک.
// خود توکن و رمز اینجا نیست؛ هنگام استفاده از process.env خوانده می‌شود.
export type BotPlatformConfig = {
  platform: BotPlatform;
  baseUrl: string;
  tokenEnv: string;
  secretEnv: string;
  // تلگرام رمز را در هدر می‌فرستد؛ بله هدر رمز ندارد و رمز در نشانی وب‌هوک (?secret=) می‌آید.
  secretSource: "header" | "query";
  // فقط آزمون محلی: نام متغیری که می‌تواند نشانی پایه را به یک سرور جعلی روی همین دستگاه ببرد.
  baseUrlOverrideEnv?: string;
};

export type BotUser = {
  id: number;
};

export type BotContact = {
  phone_number: string;
  // پیام‌رسان فقط وقتی شمارهٔ مخاطب به یک حساب وصل است این را می‌فرستد
  user_id?: number;
};

export type BotMessage = {
  message_id: number;
  from?: BotUser;
  chat: { id: number; type: string };
  text?: string;
  contact?: BotContact;
};

export type BotUpdate = {
  update_id: number;
  message?: BotMessage;
};

// resize_keyboard و one_time_keyboard در مستندات بله نیستند، پس برای بله فرستاده نمی‌شوند.
export type ReplyMarkup =
  | {
      keyboard: { text: string; request_contact?: boolean }[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    }
  | { remove_keyboard: true };

export type OutgoingMessage = {
  chatId: number | string;
  text: string;
  replyMarkup?: ReplyMarkup;
};

// نتیجهٔ ارسال؛ جزئیات خطا عمداً نمی‌آید تا توکن (که در نشانی درخواست است) نشت نکند.
export type SendResult =
  | { ok: true }
  | { ok: false; reason: "no_token" | "network" | "rejected"; status?: number };

// ردیف bot_links طبق docs/data-model.md بخش ۱۰
export type BotLink = {
  platform: BotPlatform;
  chatId: string;
  mobile: string;
  patientId: string | null;
};

// نتیجهٔ تطبیق شماره (تصمیم M-5): اول patients.mobile، بعد appointments.requester_mobile
export type MobileMatch =
  | { source: "patient"; patientId: string }
  | { source: "appointment"; patientId: string | null };
