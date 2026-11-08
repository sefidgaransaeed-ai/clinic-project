export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "arrived"
  | "done"
  | "no_show"
  | "cancelled";

/** دلیل لغو؛ فقط وقتی `status = 'cancelled'` مقدار دارد، وگرنه `null` (تصمیم A-1). */
export type CancelReason = "rejected" | "cancelled" | "expired";

export type AppointmentSource = "site" | "panel";

export type PatientGender = "female" | "male";

/**
 * This intentionally mirrors the fields planned for the patients table.
 * It exists locally only until the patients module and database are connected.
 */
export interface Patient {
  id: string;
  full_name: string;
  /** شمارهٔ خودِ مراجع؛ اختیاری و می‌تواند میان چند نفر مشترک باشد. فعلاً فقط شمارهٔ همراه (۰۹…) پذیرفته می‌شود. */
  mobile: string | null;
  national_id: string;
  /** تاریخ میلادی به شکل `YYYY-MM-DD`. سن ذخیره نمی‌شود و از همین تاریخ محاسبه می‌شود. */
  birth_date: string | null;
  gender: PatientGender | null;
  insurance_type_name: string;
}

/** Matches the planned appointments table shape, using database column names. */
export interface Appointment {
  id: string;
  patient_id: string | null;
  requester_name: string;
  requester_mobile: string;
  /** فقط برای درخواست سایت؛ ستون `requester_national_id` در مدل داده (تصمیم Q-10). */
  requester_national_id?: string | null;
  /** `false` یعنی درخواست‌دهنده برای شخص دیگری وقت گرفته؛ پس «شمارهٔ تماس این نوبت» مال خودِ مراجع نیست. */
  requested_for_self: boolean;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  cancel_reason: CancelReason | null;
  source: AppointmentSource;
  /** شناسهٔ کاربر پنل؛ برای درخواست سایت `null` است (ستون `created_by` در مدل داده). */
  created_by: string | null;
  note: string | null;
}

export interface AppointmentWithPatient extends Appointment {
  patient: Patient | null;
}

export interface Closure {
  date: string;
  reason: string;
}

export interface WorkingDay {
  /** روز هفته به شمارهٔ `Date.getUTCDay()` (۰ = یکشنبه … ۶ = شنبه)، نه شمارهٔ ستون پایگاه داده (۰ = شنبه). */
  weekday: number;
  label: string;
  start_time: string;
  end_time: string;
}

export interface AppointmentSnapshot {
  appointments: AppointmentWithPatient[];
  patients: Patient[];
  /** روزهای تعطیل؛ جدول `closures`. */
  closures: Closure[];
  /** ساعت کاری هر روز هفته؛ جدول `working_hours` (فقط ردیف‌های فعال). */
  workingDays: WorkingDay[];
}

/** آنچه سرور برای یک صفحهٔ پنل می‌فرستد: ردیف‌ها به‌علاوهٔ «امروز» به وقت تهران (`YYYY-MM-DD`). */
export interface PanelSnapshot extends AppointmentSnapshot {
  today: string;
}

/** نتیجهٔ خواندن ردیف‌ها برای یک صفحه: یا داده، یا پیام فارسی خطا. */
export type PanelLoadResult<T = PanelSnapshot> = { ok: true; snapshot: T } | { ok: false; message: string };

export interface NewPatientInput {
  full_name: string;
  mobile: string;
  national_id: string;
  /** تاریخ تولد شمسی که از سه لیست ساخته شده («روز/ماه/سال»، جای انتخاب‌نشده خالی)؛ `""` یعنی `null` ذخیره شود. */
  birth_date: string;
  /** خالی یعنی انتخاب نشده و `null` ذخیره می‌شود. */
  gender: PatientGender | "";
}

/**
 * تاریخ تولد و جنسی که منشی هنگام انتخاب مراجعِ موجود نوشته. سرور فقط فیلدی را ذخیره می‌کند که در پروندهٔ مراجع خالی باشد
 * و مقدار ثبت‌شده را هرگز عوض نمی‌کند.
 */
export type PatientExtrasInput = Pick<NewPatientInput, "birth_date" | "gender">;

/** فیلدهای فرم ثبت و ویرایش مراجع در صفحهٔ مراجعان؛ فرم ثبت نوبت نوع بیمه نمی‌پرسد، برای همین جدا از `NewPatientInput` است. */
export interface PatientFormInput extends NewPatientInput {
  insurance_type_name: string;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}
