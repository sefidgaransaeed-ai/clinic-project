import "server-only";

import type { TablesUpdate } from "@/lib/database.types";

import { PAST_EDIT_LOCKED_MESSAGE } from "./data";
import { DB_WRITE_FAILED_MESSAGE, mapDbError, type DbErrorContext, type DbErrorLike } from "./db-errors";
import { namesAreSimilar } from "./patient-match";
import { NATIONAL_ID_MESSAGES } from "./patient-validation";
import type { ServerSupabase } from "./queries";
import type { AppointmentStatus, MutationResult, PatientGender } from "./types";

/**
 * کمک‌های نوشتن در Supabase برای اکشن‌های نوبت؛ با نشست کاربر واردشده، پس RLS اعمال می‌شود. فقط سمت سرور.
 */

export const APPOINTMENT_NOT_FOUND_MESSAGE =
  "این نوبت پیدا نشد. صفحه را تازه کنید؛ ممکن است کسی دیگر آن را تغییر داده باشد.";

export const STATUS_CHANGED_MESSAGE =
  "وضعیت این نوبت در این فاصله عوض شده است. صفحه را تازه کنید و دوباره بررسی کنید.";

/** جزئیات فنی فقط در لاگ سرور می‌ماند؛ به صفحه نمی‌رسد. */
export function logDbError(what: string, error: DbErrorLike) {
  console.error(`${what}:`, error.code ?? "", error.message ?? "");
}

/**
 * یک `UPDATE` روی نوبت. RLS برای نوبتِ قدیمی‌تر از ۷ روز ردیف را بی‌صدا از دسترس بیرون می‌برد
 * (بدون خطا، صفر ردیف)، پس `.select("id")` می‌گیریم و در صورت صفر ردیف ردیف را دوباره می‌خوانیم:
 * نبود ردیف یعنی «پیدا نشد»، تغییر وضعیت از زیر دست یعنی «عوض شده»، وگرنه قفل ۷ روزه.
 * خطایی که به trigger برسد (`P0001`)، هم‌پوشانی (`23P01`) و بقیه با `mapDbError` فارسی می‌شوند.
 *
 * `expectedStatus` شرط `WHERE status = …` را اضافه می‌کند؛ جلوی دوبار زدن یک دکمه و تأییدِ دوباره را می‌گیرد.
 */
export async function updateAppointment(
  supabase: ServerSupabase,
  appointmentId: string,
  patch: TablesUpdate<"appointments">,
  options: { expectedStatus?: AppointmentStatus; context?: DbErrorContext } = {},
): Promise<MutationResult> {
  let query = supabase.from("appointments").update(patch).eq("id", appointmentId);
  if (options.expectedStatus) {
    query = query.eq("status", options.expectedStatus);
  }
  const { data, error } = await query.select("id");
  if (error) {
    logDbError("به‌روزرسانی نوبت ناموفق بود", error);
    return { ok: false, message: mapDbError(error, options.context) };
  }
  if (data.length > 0) {
    return { ok: true, message: "" };
  }

  const { data: row, error: readError } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (readError) {
    logDbError("خواندن دوبارهٔ نوبت ناموفق بود", readError);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  if (!row) {
    return { ok: false, message: APPOINTMENT_NOT_FOUND_MESSAGE };
  }
  if (options.expectedStatus && row.status !== options.expectedStatus) {
    return { ok: false, message: STATUS_CHANGED_MESSAGE };
  }
  return { ok: false, message: PAST_EDIT_LOCKED_MESSAGE };
}

/** مشخصات مراجع برای پیدا کردن یا ساختن؛ همه پیش‌تر سنجیده شده‌اند و فیلد اختیاریِ خالی `null` است (رشتهٔ خالی قید را می‌شکند). */
export interface PatientIdentity {
  fullName: string;
  nationalId: string;
  mobile: string | null;
  birthDate: string | null;
  gender: PatientGender | null;
}

export type PatientResolution =
  | { ok: true; patientId: string }
  | { ok: false; message: string; nationalIdConflict?: boolean };

/**
 * مراجع را با کد ملی پیدا می‌کند. هم‌نام (با همان یکدست‌سازیِ `namesAreSimilar`) را می‌پذیرد؛
 * کد ملیِ مراجعِ دیگر را رد می‌کند تا منشی کد را اصلاح کند؛ و اگر مراجعی نبود، می‌سازد.
 * (trigger پایگاه داده نام را نمی‌سنجد و تاریخ تولد و جنس را نمی‌نویسد، برای همین پیش از `UPDATE` اینجا انجام می‌شود.)
 */
export async function findOrCreatePatient(
  supabase: ServerSupabase,
  identity: PatientIdentity,
  createdBy: string,
): Promise<PatientResolution> {
  const { data: found, error: findError } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("national_id", identity.nationalId)
    .maybeSingle();
  if (findError) {
    logDbError("جست‌وجوی مراجع با کد ملی ناموفق بود", findError);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }

  if (found) {
    if (namesAreSimilar(found.full_name, identity.fullName)) {
      return { ok: true, patientId: found.id };
    }
    return {
      ok: false,
      message: NATIONAL_ID_MESSAGES.belongsToAnotherPatient(found.full_name),
      nationalIdConflict: true,
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("patients")
    .insert({
      full_name: identity.fullName,
      national_id: identity.nationalId,
      mobile: identity.mobile,
      birth_date: identity.birthDate,
      gender: identity.gender,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (insertError) {
    logDbError("ساخت مراجع ناموفق بود", insertError);
    return { ok: false, message: mapDbError(insertError) };
  }
  return { ok: true, patientId: created.id };
}
