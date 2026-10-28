export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "arrived"
  | "done"
  | "no_show"
  | "cancelled";

export type AppointmentSource = "site" | "panel";

export type PatientGender = "female" | "male";

/**
 * This intentionally mirrors the fields planned for the patients table.
 * It exists locally only until the patients module and database are connected.
 */
export interface Patient {
  id: string;
  full_name: string;
  /** شمارهٔ خودِ مراجع؛ اختیاری و یکتا. فعلاً فقط موبایل (۰۹…) پذیرفته می‌شود. */
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
  /** `false` یعنی درخواست‌دهنده برای شخص دیگری وقت گرفته؛ پس موبایل درخواست مال خودِ مراجع نیست. */
  requested_for_self: boolean;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  created_by: string;
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
  weekday: number;
  label: string;
  start_time: string;
  end_time: string;
}

export interface AppointmentSnapshot {
  appointments: AppointmentWithPatient[];
  patients: Patient[];
}

export interface NewPatientInput {
  full_name: string;
  mobile: string;
  national_id: string;
  /** تاریخ تولد شمسی که از سه لیست ساخته شده («روز/ماه/سال»، جای انتخاب‌نشده خالی)؛ `""` یعنی `null` ذخیره شود. */
  birth_date: string;
  /** خالی یعنی انتخاب نشده و `null` ذخیره می‌شود. */
  gender: PatientGender | "";
}

export interface MutationResult {
  ok: boolean;
  message: string;
}
