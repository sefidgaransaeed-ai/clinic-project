import type { Tables } from "@/lib/database.types";
import { mapPatientRow, type PatientRow } from "@/modules/patients/row-mappers";

import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
  AppointmentWithPatient,
  CancelReason,
  Closure,
  PanelSnapshot,
  Patient,
  WorkingDay,
} from "./types";

/**
 * تبدیل ردیف‌های پایگاه داده به شکل داده‌ای که صفحه‌های پنل می‌شناسند. فقط محاسبه است
 * (بدون Supabase و React)، پس هم روی سرور و هم در آزمون با ردیف ساختگی کار می‌کند.
 *
 * ستون `clinic_id` (تصمیم A-7) هنوز در `src/lib/database.types.ts` نیست؛ تا بازتولید آن فایل
 * همین‌جا محلی تعریف می‌شود. صفحه‌ها فعلاً مطب را نشان نمی‌دهند، پس نگاشت آن را نمی‌خواند.
 */
export type AppointmentRow = Tables<"appointments"> & { clinic_id?: string | null };
export type WorkingHoursRow = Pick<Tables<"working_hours">, "weekday" | "start_time" | "end_time">;
export type ClosureRow = Pick<Tables<"closures">, "closure_date" | "reason">;

/** ایران ساعت تابستانی ندارد؛ اختلاف تهران با UTC همیشه ۳:۳۰ است (همان فرض `makeTehranDateTime`). */
const TEHRAN_OFFSET_MS = 210 * 60_000;

/**
 * زمان `timestamptz` پایگاه داده (UTC) را به همان لحظه با ساعت دیواری تهران برمی‌گرداند،
 * مثلاً `2026-10-30T10:30:00+00:00` ← `2026-10-30T14:00:00+03:30`.
 * بقیهٔ کد (`appointmentLocalTime` که ساعت را از متن می‌برد، و `Date.parse`) به همین قالب تکیه دارد.
 */
export function toTehranIso(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new Error(`زمان نامعتبر در ردیف نوبت: ${value}`);
  }
  return `${new Date(time + TEHRAN_OFFSET_MS).toISOString().slice(0, 19)}+03:30`;
}

const STATUSES: readonly AppointmentStatus[] = ["requested", "confirmed", "arrived", "done", "no_show", "cancelled"];
const CANCEL_REASONS: readonly CancelReason[] = ["rejected", "cancelled", "expired"];
const SOURCES: readonly AppointmentSource[] = ["site", "panel"];

function oneOf<T extends string>(allowed: readonly T[], value: string, what: string): T {
  const match = allowed.find((item) => item === value);
  if (match === undefined) {
    throw new Error(`${what} نامعتبر در ردیف نوبت: ${value}`);
  }
  return match;
}

export function mapAppointmentRow(row: AppointmentRow, patient: Patient | null): AppointmentWithPatient {
  const appointment: Appointment = {
    id: row.id,
    patient_id: row.patient_id,
    // نوبت ثبت‌شده در پنل `requester_name` ندارد؛ نامی که تقویم نشان می‌دهد نام مراجع است.
    requester_name: row.requester_name ?? patient?.full_name ?? "",
    requester_mobile: row.requester_mobile,
    requester_national_id: row.requester_national_id,
    // این ستون فقط برای درخواست سایت پر است؛ نوبت پنلی همیشه برای خودِ مراجع حساب می‌شود.
    requested_for_self: row.requested_for_self ?? true,
    starts_at: toTehranIso(row.starts_at),
    ends_at: toTehranIso(row.ends_at),
    status: oneOf(STATUSES, row.status, "وضعیت"),
    cancel_reason: row.cancel_reason === null ? null : oneOf(CANCEL_REASONS, row.cancel_reason, "دلیل لغو"),
    source: oneOf(SOURCES, row.source, "منبع"),
    created_by: row.created_by,
    note: row.note,
  };
  return { ...appointment, patient };
}

/** برچسب روز هفته به ترتیب `Date.getUTCDay()`: ۰ = یکشنبه … ۶ = شنبه. */
const WEEKDAY_LABELS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

/** `HH:MM:SS` ستون `time` را به `HH:MM` می‌برد. */
function toClockTime(value: string): string {
  if (!/^\d{2}:\d{2}/.test(value)) {
    throw new Error(`ساعت نامعتبر در ساعت کاری: ${value}`);
  }
  return value.slice(0, 5);
}

/**
 * شمارهٔ روز در پایگاه داده `0 = شنبه … 6 = جمعه` است (تصمیم Q-1)؛ کد صفحه‌ها از
 * `Date.getUTCDay()` (`0 = یکشنبه … 6 = شنبه`) استفاده می‌کند. اگر تبدیل نشود، ساعت کاری یک روز جابه‌جا می‌شود.
 */
export function mapWorkingHoursRow(row: WorkingHoursRow): WorkingDay {
  const weekday = (row.weekday + 6) % 7;
  return {
    weekday,
    label: WEEKDAY_LABELS[weekday],
    start_time: toClockTime(row.start_time),
    end_time: toClockTime(row.end_time),
  };
}

export function mapClosureRow(row: ClosureRow): Closure {
  return { date: row.closure_date, reason: row.reason ?? "" };
}

export interface PanelRows {
  appointments: AppointmentRow[];
  patients: PatientRow[];
  workingHours: WorkingHoursRow[];
  closures: ClosureRow[];
  /** `YYYY-MM-DD` به وقت تهران. */
  today: string;
}

/** ردیف‌های خام را به یک `PanelSnapshot` می‌رساند؛ نوبت‌ها به ترتیب زمان شروع. */
export function buildPanelSnapshot(rows: PanelRows): PanelSnapshot {
  const patients = rows.patients.map(mapPatientRow);
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  const appointments = rows.appointments
    .map((row) => mapAppointmentRow(row, row.patient_id ? (patientsById.get(row.patient_id) ?? null) : null))
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at));

  return {
    appointments,
    patients,
    closures: rows.closures.map(mapClosureRow),
    workingDays: rows.workingHours.map(mapWorkingHoursRow),
    today: rows.today,
  };
}
