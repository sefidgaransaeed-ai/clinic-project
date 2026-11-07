import { MANUAL_OVERLAP_MESSAGE, PAST_EDIT_LOCKED_MESSAGE, SLOT_TAKEN_MESSAGE } from "./data";

/**
 * تبدیل خطای پایگاه داده به پیام فارسی برای منشی. فقط محاسبه است (بدون Supabase)، پس در آزمون هم کار می‌کند.
 * قاعدهٔ متن: چه شد، حالا چه کار کنید؛ هرگز متن انگلیسی پایگاه داده یا کد خطا نشان داده نمی‌شود (docs/brand-voice.md بخش ۸).
 * متن انگلیسی پیش‌فرض پایگاه داده برای هر قید یکی است، پس تشخیص با `code` انجام می‌شود، نه با متن.
 */

/** هر چیزی که `error` یک پاسخ Supabase دارد (`PostgrestError`)؛ فقط همین سه فیلد خوانده می‌شود. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/** کد ملی ستون یکتاست (`patients.national_id`)؛ کد ۲۳۵۰۵ روی آن یعنی مراجع دیگری همین کد را دارد. */
export const NATIONAL_ID_TAKEN_MESSAGE =
  "این کد ملی قبلاً برای مراجع دیگری ثبت شده است. کد ملی را بررسی کنید یا همان مراجع را از فهرست انتخاب کنید.";

/** هر خطای ناشناخته؛ جزئیات فنی در لاگ سرور می‌ماند. */
export const DB_WRITE_FAILED_MESSAGE =
  "ثبت انجام نشد. چند لحظه بعد دوباره تلاش کنید؛ اگر باز هم نشد، به پزشک خبر بدهید.";

/**
 * `context` فقط متن «بازه پر است» را تعیین می‌کند:
 * - `status`: تأیید، بازگرداندن یا تغییر وضعیتِ نوبتِ موجود؛ منشی بازهٔ دیگری را از تقویم می‌گیرد.
 * - `manual`: ثبت نوبت دستی؛ منشی ساعت شروع یا مدت را عوض می‌کند.
 */
export type DbErrorContext = "status" | "manual";

export function mapDbError(error: DbErrorLike, context: DbErrorContext = "status"): string {
  switch (error.code) {
    case "23505": {
      const text = `${error.message ?? ""} ${error.details ?? ""}`;
      return text.includes("national_id") ? NATIONAL_ID_TAKEN_MESSAGE : DB_WRITE_FAILED_MESSAGE;
    }
    case "23P01":
      return context === "manual" ? MANUAL_OVERLAP_MESSAGE : SLOT_TAKEN_MESSAGE;
    case "P0001":
      // تنها `raise exception`ی که روی نوبت‌ها و مراجعان می‌نشیند، قفل ۷ روزهٔ `check_appointment_edit_window` است.
      return PAST_EDIT_LOCKED_MESSAGE;
    default:
      return DB_WRITE_FAILED_MESSAGE;
  }
}
