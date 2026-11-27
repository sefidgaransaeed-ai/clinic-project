import { answerQuestion } from "@/modules/chatbot/data";

import { findMobileMatch, saveBotLink } from "./data";
import { normalizeMobile } from "./mobile";
import type {
  BotContact,
  BotMessage,
  BotPlatform,
  BotUpdate,
  OutgoingMessage,
  ReplyMarkup,
} from "./types";

// متن‌ها طبق docs/brand-voice.md: «شما»، بدون سرزنش، و در خطا هم بگوید حالا چه کنید.
// هر جا شماره‌ای نام برده می‌شود، نام کامل آن می‌آید (نه «موبایل» تنها).
const SHARE_BUTTON = "اشتراک شمارهٔ من";

const texts = {
  welcome:
    "سلام، به ربات مطب خوش آمدید.\n" +
    "این ربات یادآوری نوبت را در همین گفتگو برایتان می‌فرستد و به پرسش‌های پرتکرار " +
    "پاسخ می‌دهد. برای فعال‌شدن یادآوری، " +
    `دکمهٔ «${SHARE_BUTTON}» را بزنید تا حساب شما به نوبت‌هایتان وصل شود.\n` +
    "ربات نوبت ثبت یا جابه‌جا نمی‌کند و توصیهٔ پزشکی هم نمی‌دهد.",
  /** پاسخ پرسش‌های پرتکرار از همان دادهٔ ویجت سایت (کار p1-15). */
  greeting:
    "سلام. پرسشتان را همین‌جا بنویسید؛ مثلاً ساعت کاری، آدرس یا هزینهٔ ویزیت. " +
    "برای فعال‌کردن یادآوری نوبت، /start را بفرستید.",
  medical:
    "این ربات توصیهٔ پزشکی نمی‌دهد. برای بررسی وضعیتتان با مطب تماس بگیرید. " +
    "پرسش‌های اجرایی مثل نوبت، ساعت کاری و آدرس را همین‌جا می‌توانید بپرسید.",
  none:
    "پاسخ این پرسش را در پرسش‌های پرتکرار پیدا نکردم؛ پرسشتان ثبت شد تا مطب ببیند. " +
    "برای پاسخ سریع‌تر با مطب تماس بگیرید یا /start را برای یادآوری نوبت بفرستید.",
  // فقط وقتی خودِ پردازش خطا بدهد؛ پیام کاربر پاسخ داده نشده می‌ماند.
  otherText:
    "الان نتوانستم پرسشتان را بررسی کنم. چند لحظه بعد دوباره بنویسید یا با مطب تماس بگیرید.",
  notOwnContact:
    "این شماره به حساب خودتان تعلق ندارد، برای همین ذخیره نشد. " +
    `لطفاً با دکمهٔ «${SHARE_BUTTON}» شمارهٔ همین حساب را بفرستید.`,
  unrecognizedNumber:
    "قالب این شماره برای سامانهٔ مطب قابل شناسایی نیست، برای همین ذخیره نشد. " +
    "برای راهنمایی با مطب تماس بگیرید.",
  linkedAppointment:
    "ممنون، حساب شما وصل شد. یادآوری نوبت‌هایی که «شمارهٔ تماس این نوبت» در آن‌ها " +
    "همین شمارهٔ حساب شما باشد، در همین گفتگو برایتان می‌آید.",
  linkedNoMatch:
    "شمارهٔ حساب شما ذخیره شد، ولی نوبت آینده‌ای پیدا نکردم که «شمارهٔ تماس این نوبت» " +
    "در آن همین شماره باشد. وقتی نوبتی با این شماره ثبت شود، یادآوری‌اش در همین " +
    "گفتگو می‌آید.",
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

/** فقط حداکثر دو پاسخ؛ پیام تلگرام نباید طولانی شود و پاسخ‌ها کوتاه‌اند. */
function buildAnswerText(matches: readonly { item: { question: string; answer: string } }[]): string {
  const body = matches
    .slice(0, 2)
    .map(({ item }) => `${item.question}\n${item.answer}`)
    .join("\n\n");
  return `${body}\n\nبرای پرسش دیگر بنویسید؛ /start هم یادآوری نوبت را فعال می‌کند.`;
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
      patientId: null,
    });
    const text = match ? texts.linkedAppointment : texts.linkedNoMatch;
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

  const text = message.text?.trim();
  if (!text) {
    return [];
  }

  // پاسخ پرسش‌های پرتکرار: همان منطق ویجت سایت (کار p1-15)، از همان داده.
  // پرسش بی‌پاسخ با کانال telegram ثبت می‌شود تا در صفحهٔ «پرسش‌های بی‌پاسخ» دیده شود.
  try {
    const answer = await answerQuestion(text, "telegram");
    switch (answer.kind) {
      case "medical":
        return [reply(message, texts.medical)];
      case "greeting":
        return [reply(message, texts.greeting)];
      case "answers":
        return [reply(message, buildAnswerText(answer.matches))];
      default:
        return [reply(message, texts.none)];
    }
  } catch {
    return [reply(message, texts.otherText)];
  }
}
