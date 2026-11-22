import { CLOSURE_MESSAGES, WORKING_HOURS_MESSAGES } from "./validation";

/**
 * تبدیل خطای پایگاه داده به پیام فارسی برای پزشک. فقط محاسبه است (بدون Supabase)، پس در آزمون هم کار می‌کند.
 * همان الگوی `mapDbError` ماژول نوبت‌ها: تشخیص با `code`، نه با متن انگلیسی؛ هرگز متن خام یا کد خطا به کاربر نمی‌رسد.
 */

/** هر چیزی که `error` یک پاسخ Supabase دارد (`PostgrestError`)؛ فقط همین سه فیلد خوانده می‌شود. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/** هر خطای ناشناخته؛ جزئیات فنی در لاگ سرور می‌ماند. */
export const DB_WRITE_FAILED_MESSAGE =
  "ثبت انجام نشد. چند لحظه بعد دوباره تلاش کنید؛ اگر باز هم نشد، به پشتیبان فنی خبر بدهید.";

export const DB_READ_FAILED_MESSAGE =
  "خواندن تنظیمات انجام نشد. صفحه را تازه کنید؛ اگر باز هم نشد، به پشتیبان فنی خبر بدهید.";

/** قاعدهٔ RLS: فقط پزشک در `working_hours` و `closures` می‌نویسد و منشی فقط می‌خواند (`42501`). */
export const NOT_ALLOWED_MESSAGE = "فقط پزشک می‌تواند ساعت کاری و تعطیلی را تغییر دهد.";

/** به‌روزرسانیِ بی‌ردیف: یا شناسه وجود ندارد، یا RLS ردیف را از دید پنهان کرده؛ در هر دو حالت «پیدا نشد» دقیق‌ترین حرف است. */
export const ROW_NOT_FOUND_MESSAGE =
  "این بازهٔ کاری پیدا نشد یا اجازهٔ تغییرش را ندارید. صفحه را تازه کنید و دوباره تلاش کنید.";

/** مثل بالا ولی برای تعطیلی (لغو و فعال‌سازی دوباره روی ردیف تعطیلی کار می‌کنند). */
export const CLOSURE_NOT_FOUND_MESSAGE =
  "این تعطیلی پیدا نشد یا اجازهٔ تغییرش را ندارید. صفحه را تازه کنید و دوباره تلاش کنید.";

export const INVALID_VALUE_MESSAGE =
  "روز، ساعت یا تاریخ واردشده پذیرفته نشد. مقدارها را بررسی کنید و دوباره تلاش کنید.";

/** `23P01` از قید `working_hours_no_active_overlap`: بازهٔ فعال با بازهٔ فعال دیگرِ همان روز هم‌پوشانی دارد (هم‌زمانی دو ثبت). */
export const WORKING_HOURS_OVERLAP_DB_MESSAGE =
  "این بازه با یک ساعت کاری فعالِ دیگر در همین روز هم‌پوشانی دارد. برنامهٔ تازه را دوباره بخوانید، ساعت‌ها را اصلاح کنید و دوباره تلاش کنید.";

/** `23P01` از قید `working_hours_one_active_clinic_per_day`: بازه‌های فعال یک روز باید همه مال یک مطب باشند. */
export const WORKING_HOURS_CLINIC_PER_DAY_DB_MESSAGE =
  "بازه‌های فعالِ یک روز باید همه برای یک مطب باشند و این روز برای مطب دیگری ثبت شده است. برنامهٔ تازه را دوباره بخوانید و بازه‌های فعال آن روز را بررسی کنید.";

/** هر `23P01` با نام قید ناشناخته. */
export const EXCLUSION_UNKNOWN_DB_MESSAGE =
  "این تغییر با برنامهٔ ثبت‌شده در تعارض است. برنامهٔ تازه را دوباره بخوانید و دوباره تلاش کنید.";

/**
 * - `23505`: `closures.closure_date` یکتاست (تنها قید یکتایی این دو جدول).
 * - `23P01`: یکی از دو قید exclusion ساعت کاری (migration 0014)؛ نام قید در متن خطاست. تشخیص با نام قید است و
 *   نامِ ناشناخته پیام عمومی می‌گیرد، نه متن خام.
 * - `23514`: قید `weekday between 0 and 6` یا `end_time > start_time` (اعتبارسنجی پیش از آن باید جلویش را بگیرد).
 * - `22007`/`22008`: قالب یا مقدار تاریخ و ساعت را پایگاه داده نپذیرفته.
 * - `23503`: مطبِ انتخاب‌شده در `clinics` نیست.
 * - `42501`: RLS اجازهٔ نوشتن نداده.
 */
export function mapDbError(error: DbErrorLike): string {
  switch (error.code) {
    case "23505": {
      const text = `${error.message ?? ""} ${error.details ?? ""}`;
      return text.includes("closure_date") ? CLOSURE_MESSAGES.duplicate : DB_WRITE_FAILED_MESSAGE;
    }
    case "23P01": {
      const text = `${error.message ?? ""} ${error.details ?? ""}`;
      if (text.includes("working_hours_no_active_overlap")) return WORKING_HOURS_OVERLAP_DB_MESSAGE;
      if (text.includes("working_hours_one_active_clinic_per_day")) return WORKING_HOURS_CLINIC_PER_DAY_DB_MESSAGE;
      return EXCLUSION_UNKNOWN_DB_MESSAGE;
    }
    case "23514":
    case "22007":
    case "22008":
      return INVALID_VALUE_MESSAGE;
    case "23503":
      return WORKING_HOURS_MESSAGES.clinic;
    case "42501":
      return NOT_ALLOWED_MESSAGE;
    default:
      return DB_WRITE_FAILED_MESSAGE;
  }
}
