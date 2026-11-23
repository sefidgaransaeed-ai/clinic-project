import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";
import type { PublicBookingField } from "./public-booking-validation";

/**
 * تبدیل خطای `request_appointment` به پیام فارسی برای بازدیدکنندهٔ سایت. فقط محاسبه است (بدون Supabase)، پس در آزمون هم کار می‌کند.
 *
 * همهٔ `raise exception`های این تابع SQLSTATE یکسان `P0001` دارند و فقط متنشان فرق می‌کند، پس تشخیص با متنِ شناخته‌شده است،
 * نه با کد. متن ناشناخته (یا هر کد دیگر) هرگز نمایش داده نمی‌شود و به پیام کلیِ «با مطب تماس بگیرید» می‌رسد
 * (docs/brand-voice.md بخش ۸). آزمون کنار این فایل متن‌ها را با خود migration مقایسه می‌کند.
 */

/** هر چیزی که `error` یک پاسخ Supabase دارد (`PostgrestError`). */
export interface RequestErrorLike {
  code?: string | null;
  message?: string | null;
}

export interface MappedRequestError {
  field: PublicBookingField;
  message: string;
}

/**
 * متن‌های شناخته‌شدهٔ پایگاه داده، عیناً از supabase/migrations/20261028000009_request_with_clinic.sql، در یک فهرست.
 * ترتیب همان ترتیب بررسی‌ها در تابع است.
 */
export const KNOWN_REQUEST_ERRORS: ReadonlyArray<{ dbText: string; field: PublicBookingField; message: string }> = [
  { dbText: "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.", field: "contactMobile", message: messages.mobileRejected },
  { dbText: "کد ملی باید ۱۰ رقم باشد.", field: "nationalId", message: messages.nationalIdRejected },
  { dbText: "نام را وارد کنید.", field: "fullName", message: messages.nameEmpty },
  { dbText: "مشخص کنید نوبت برای خودتان است یا شخص دیگری.", field: "forSelf", message: messages.forSelfEmpty },
  { dbText: "این روز تعطیل است. لطفاً روز دیگری انتخاب کنید.", field: "dateKey", message: messages.dateClosed },
  { dbText: "این روز از روزهای کاری مطب نیست.", field: "dateKey", message: messages.dateNotWorking },
  {
    dbText: "از این شماره امروز بیش از حد مجاز درخواست ثبت شده است. فردا دوباره تلاش کنید یا با مطب تماس بگیرید.",
    field: "form",
    message: messages.rateLimit,
  },
  { dbText: "این زمان دیگر آزاد نیست. لطفاً زمان دیگری انتخاب کنید.", field: "time", message: messages.slotTaken },
];

/** هم‌پوشانی (قید `appointments_no_overlap`) یعنی همان ساعت در این فاصله گرفته شد. */
const EXCLUSION_VIOLATION = "23P01";
const RAISE_EXCEPTION = "P0001";

export function mapRequestError(error: RequestErrorLike | null | undefined): MappedRequestError {
  if (error?.code === RAISE_EXCEPTION) {
    const known = KNOWN_REQUEST_ERRORS.find((item) => item.dbText === (error.message ?? "").trim());
    if (known) {
      return { field: known.field, message: known.message };
    }
  }
  if (error?.code === EXCLUSION_VIOLATION) {
    return { field: "time", message: messages.slotTaken };
  }
  return { field: "form", message: messages.requestFailed };
}
