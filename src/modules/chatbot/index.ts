/**
 * نقطهٔ ورود ماژول chatbot برای مصرف بیرونی.
 *
 * چرا این فایل: راهنمای کار p1-15 می‌گوید نفر دوم باید بتواند `matchFaq` را در ماژول
 * notifications (ربات) import کند. این فایل فقط همان تابع و نوع‌هایش را بیرون می‌دهد —
 * نه کامپوننت React و نه چیزی که `server-only` بخواهد — تا import از ربات امن بماند.
 *
 * نمونه:
 *
 *     import { matchFaq } from "@/modules/chatbot";
 *     const answers = matchFaq(userMessage, faqRows);
 */

export {
  matchFaq,
  looksMedical,
  normalizePersian,
  contentWords,
  MAX_MATCHES,
  MIN_SCORE,
  type FaqMatch,
  type FaqSource,
} from "./match";
