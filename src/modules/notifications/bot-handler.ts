import { findMobileMatch, saveBotLink } from "./data";
import type {
  BotContact,
  BotMessage,
  BotPlatform,
  BotUpdate,
  OutgoingMessage,
  ReplyMarkup,
} from "./types";

// متن‌ها طبق docs/brand-voice.md: «شما»، بدون سرزنش، و در خطا هم بگوید حالا چه کنید.
// هر جا شماره‌ای نام برده می‌شود، یکی از دو نام کامل می‌آید (نه «موبایل» تنها).
const SHARE_BUTTON = "اشتراک شمارهٔ من";

const texts = {
  welcome:
    "سلام، به ربات مطب خوش آمدید.\n" +
    "این ربات یادآوری نوبت را در همین گفتگو برایتان می‌فرستد. برای فعال‌شدن آن، " +
    `دکمهٔ «${SHARE_BUTTON}» را بزنید تا حساب شما به نوبت‌هایتان وصل شود.\n` +
    "ربات نوبت ثبت یا جابه‌جا نمی‌کند و توصیهٔ پزشکی هم نمی‌دهد.",
  // جای پاسخ پرسش‌های پرتکرار (matchFaq) در کار بعدی
  otherText:
    "پیام شما را دریافت کردم، ولی هنوز نمی‌توانم به پرسش‌ها پاسخ بدهم. " +
    "برای فعال‌کردن یادآوری نوبت، /start را بفرستید.",
  notOwnContact:
    "این شماره به حساب خودتان تعلق ندارد، برای همین ذخیره نشد. " +
    `لطفاً با دکمهٔ «${SHARE_BUTTON}» شمارهٔ همین حساب را بفرستید.`,
  unrecognizedNumber:
    "قالب این شماره برای سامانهٔ مطب قابل شناسایی نیست، برای همین ذخیره نشد. " +
    "برای راهنمایی با مطب تماس بگیرید.",
  linkedPatient:
    "ممنون، حساب شما وصل شد. یادآوری نوبت‌هایی که «شمارهٔ شخصی مراجع» در آن‌ها " +
    "همین شمارهٔ حساب شما باشد، در همین گفتگو برایتان می‌آید.",
  linkedAppointment:
    "ممنون، حساب شما وصل شد. یادآوری نوبت‌هایی که «شمارهٔ تماس این نوبت» در آن‌ها " +
    "همین شمارهٔ حساب شما باشد، در همین گفتگو برایتان می‌آید.",
  linkedNoMatch:
    "شمارهٔ حساب شما ذخیره شد، ولی نوبت آینده‌ای پیدا نکردم که «شمارهٔ شخصی مراجع» " +
    "یا «شمارهٔ تماس این نوبت» در آن همین شماره باشد. وقتی نوبتی با این شماره ثبت " +
    "شود، یادآوری‌اش در همین گفتگو می‌آید.",
  saveFailed:
    "الان نتوانستم حساب شما را وصل کنم. چند دقیقه دیگر دوباره /start را بفرستید.",
};

// بله فقط keyboard را مستند کرده؛ resize_keyboard و one_time_keyboard در مستندات آن نیست.
function shareKeyboardFor(platform: BotPlatform): ReplyMarkup {
  const keyboard = [[{ text: SHARE_BUTTON, request_contact: true }]];
  return platform === "bale"
    ? { keyboard }
    : { keyboard, resize_keyboard: true, one_time_keyboard: true };
}

const removeKeyboard: ReplyMarkup = { remove_keyboard: true };

// پیام‌رسان شماره را با پیش‌شمارهٔ کشور می‌فرستد (مثلاً 98912…)؛ پایگاه داده
// قالب ۰۹xxxxxxxxx را می‌خواهد (data-model). غیر از آن null برمی‌گردد.
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national: string;
  if (digits.length === 14 && digits.startsWith("0098")) {
    national = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith("98")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }
  return /^9\d{9}$/.test(national) ? `0${national}` : null;
}

function isStartCommand(text: string | undefined): boolean {
  return text !== undefined && /^\/start(@\w+)?(\s|$)/.test(text);
}

function reply(
  message: BotMessage,
  text: string,
  replyMarkup?: ReplyMarkup,
): OutgoingMessage {
  return { chatId: message.chat.id, text, replyMarkup };
}

async function handleContact(
  message: BotMessage,
  contact: BotContact,
  platform: BotPlatform,
): Promise<OutgoingMessage[]> {
  // فقط شمارهٔ خود فرستنده پذیرفته می‌شود؛ مخاطبِ فورواردشده یا دستی‌فرستاده‌شده
  // user_id حساب دیگری را دارد یا اصلاً ندارد.
  // TODO: مستندات بله می‌گوید user_id فقط ۳۲ بیت کم‌ارزش را دارد. مقایسهٔ سخت‌گیرانهٔ زیر برای
  // بله هم نگه داشته شد (کوتاه‌کردن به ۳۲ بیت ممکن است حساب دیگری را بپذیرد)، ولی باید با یک
  // حساب واقعی بله دوباره تأیید شود: اگر شناسه‌ها بزرگ‌تر از ۳۲ بیت باشند، کاربر درست هم رد می‌شود.
  if (contact.user_id === undefined || contact.user_id !== message.from?.id) {
    return [reply(message, texts.notOwnContact, shareKeyboardFor(platform))];
  }

  const mobile = normalizeMobile(contact.phone_number);
  if (!mobile) {
    return [reply(message, texts.unrecognizedNumber, removeKeyboard)];
  }

  try {
    const match = await findMobileMatch(mobile);
    await saveBotLink({
      platform,
      chatId: String(message.chat.id),
      mobile,
      patientId: match?.patientId ?? null,
    });
    const text = !match
      ? texts.linkedNoMatch
      : match.source === "patient"
        ? texts.linkedPatient
        : texts.linkedAppointment;
    return [reply(message, text, removeKeyboard)];
  } catch {
    return [reply(message, texts.saveFailed, removeKeyboard)];
  }
}

// یک update را به فهرست پیام‌های خروجی تبدیل می‌کند؛ ارسال کار مسیر است.
// فقط گفتگوی خصوصی: وگرنه یادآوری ممکن بود به یک گروه برود.
export async function handleUpdate(
  update: BotUpdate,
  platform: BotPlatform,
): Promise<OutgoingMessage[]> {
  const message = update.message;
  if (!message?.from || message.chat.type !== "private") {
    return [];
  }
  if (message.contact) {
    return handleContact(message, message.contact, platform);
  }
  if (isStartCommand(message.text)) {
    return [reply(message, texts.welcome, shareKeyboardFor(platform))];
  }
  return [reply(message, texts.otherText)];
}
