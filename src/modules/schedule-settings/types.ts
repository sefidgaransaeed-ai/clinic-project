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

/**
 * یک روز تعطیل. تاریخ میلادی `YYYY-MM-DD` است (ستون `date`، بدون منطقهٔ زمانی).
 * `isActive = false` یعنی تعطیلی لغو شده: ردیف می‌ماند ولی روز را نمی‌بندد (تصمیم 0013).
 */
export interface ClosureEntry {
  id: string;
  closureDate: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * حالتی که Server Actionهای ساعت کاری به فرم برمی‌گردانند (`useActionState`).
 * `error` پیام فارسیِ آمادهٔ نمایش است؛ متن خام پایگاه داده هرگز در آن نیست.
 */
export interface WorkingHoursActionState {
  error: string | null;
  ok: boolean;
  /** وقتی تغییر هنوز ذخیره نشده و پزشک باید فهرست نوبت‌های متأثر را تأیید کند. */
  confirmation?: ScheduleConfirmation;
}

// ------------------------------------------------- هشدار نوبت‌های متأثر (تصمیم 0013، بند ۶)

/**
 * یک نوبتِ تأییدشدهٔ آینده که با تغییر پیشنهادی بیرون برنامه می‌افتد. فقط همین چهار چیز به رابط می‌رسد:
 * تاریخ و ساعت (به وقت تهران) و نام؛ شمارهٔ موبایل و کدملی هرگز خوانده یا نشان داده نمی‌شود.
 */
export interface AffectedAppointmentView {
  id: string;
  /** `YYYY-MM-DD` میلادی به وقت تهران. */
  dateKey: string;
  /** «HH:MM» به وقت تهران. */
  startTime: string;
  patientName: string;
}

/**
 * آنچه پزشک باید ببیند و تأیید کند. `confirmedIds` همان فهرست شناسه‌هاست (مرتب، با ویرگول) که در ارسال دوم
 * برمی‌گردد؛ سرور پیش از نوشتن دوباره می‌خواند و فقط اگر با این فهرست یکی بود می‌نویسد.
 */
export interface ScheduleConfirmation {
  affected: AffectedAppointmentView[];
  confirmedIds: string;
  /** برای تعطیلی: تاریخ آن (`YYYY-MM-DD`) تا متن هشدار تاریخ شمسی و روز هفته را نشان دهد. */
  closureDate?: string;
  /** پزشک فهرستی را تأیید کرده بود ولی تا لحظهٔ ذخیره فهرست فرق کرد؛ چیزی ذخیره نشد. */
  changedSinceShown: boolean;
  /**
   * مقدارهایی که در ارسال اول فرستاده شد (روز، ساعت، فعال‌بودن، تاریخ یا دلیل تعطیلی).
   * React بعد از هر Server Action فیلدهای فرم را به حالت اول برمی‌گرداند؛ اگر دکمهٔ «تأیید می‌کنم» به فرم
   * تکیه کند، ارسال دوم مقدار بازگشته را می‌فرستد نه انتخاب پزشک. این‌ها در فرم تأیید hidden می‌شوند.
   */
  values?: Record<string, string>;
}

/** نتیجهٔ «ذخیره نشد؛ تأیید دوم لازم است». `message` فارسی است تا هر جا که فقط `message` می‌خواند کار کند. */
export interface ConfirmationRequired {
  ok: false;
  message: string;
  confirmation: ScheduleConfirmation;
}

export type GuardedResult<T> = Result<T> | ConfirmationRequired;
