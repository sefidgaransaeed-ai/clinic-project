import { toPersianDigits } from "@/lib/format";

/**
 * قاعده‌های نظرسنجی پس از نوبت (کار p3-09)، جدا از صفحه‌ها تا هم در مرورگر و هم روی سرور
 * یکی باشند و بدون پایگاه داده آزمون شوند. خود پایگاه داده هم همین‌ها را دوباره اجبار می‌کند
 * (submit_survey: امتیاز ۱ تا ۵ و متن تا ۱۰۰۰ حرف).
 */

/** واژهٔ هر امتیاز؛ خانهٔ صفر خالی است تا شمارهٔ امتیاز همان شمارهٔ خانه باشد */
export const SCORE_WORDS = ["", "خیلی ناراضی", "ناراضی", "معمولی", "راضی", "خیلی راضی"] as const;

export const COMMENT_MAX = 1000;

/** token را create_survey_link با encode(gen_random_bytes(16), 'hex') می‌سازد: ۳۲ نویسهٔ hex */
export function isSurveyToken(token: string): boolean {
  return /^[0-9a-f]{32}$/.test(token);
}

export function surveyInputError(score: number, comment: string): string | null {
  if (!Number.isInteger(score) || score < 1 || score > 5) return "یکی از ستاره‌ها را انتخاب کنید.";
  if (comment.trim().length > COMMENT_MAX) {
    return `متن نظر حداکثر ${toPersianDigits(COMMENT_MAX)} حرف باشد.`;
  }
  return null;
}

/** نشانی کامل صفحهٔ نظرسنجی؛ origin مثل «https://example.com» بدون / پایانی */
export function surveyUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/nazar/${token}`;
}

export type DateStamp = { weekday: string; day: string; month: string; year: string };

const STAMP_FORMAT = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
  timeZone: "Asia/Tehran",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * تکه‌های مهر تاریخ نوبت، به وقت تهران و شمسی: «دوشنبه»، «۲۵»، «آبان»، «۱۴۰۵».
 * تکه‌ها جدا می‌آیند چون ترتیب Intl برای تقویم شمسی همیشه «روز ماه سال» نیست.
 */
export function dateStamp(value: string | Date): DateStamp {
  const parts = STAMP_FORMAT.formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    weekday: part("weekday"),
    day: toPersianDigits(part("day")),
    month: part("month"),
    year: toPersianDigits(part("year")),
  };
}
