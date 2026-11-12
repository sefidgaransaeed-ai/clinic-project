/**
 * نوع‌های ماژول تنظیمات نوبت‌دهی. فایل بدون `server-only` است، پس کامپوننت سمت مرورگر هم می‌تواند
 * آن را بخواند (همان منطقِ `src/modules/users/types.ts`).
 */

/** نتیجهٔ اعتبارسنجی یا عملیات داده: یا مقدار، یا پیام فارسیِ آمادهٔ نمایش. */
export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * یک ردیف ساعت کاری. شمارهٔ روز طبق پایگاه داده: ۰ = شنبه تا ۶ = جمعه (Q-1)،
 * نه طبق `Date.getUTCDay()` که یکشنبه ۰ است.
 * ساعت‌ها «HH:MM» هستند (ثانیهٔ `time` پایگاه داده هنگام خواندن حذف می‌شود).
 */
export interface WorkingHoursEntry {
  id: string;
  /** ستون `working_hours.clinic_id` در پایگاه داده خالی‌پذیر است (تصمیم 0011). */
  clinicId: string | null;
  clinicName: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/** یک مطب برای انتخاب در فرم (فقط مطب‌های فعال). */
export interface ClinicOption {
  id: string;
  name: string;
}

/** یک روز تعطیل. تاریخ میلادی `YYYY-MM-DD` است (ستون `date`، بدون منطقهٔ زمانی). */
export interface ClosureEntry {
  id: string;
  closureDate: string;
  reason: string;
  createdAt: string;
}
