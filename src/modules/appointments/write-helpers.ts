import "server-only";

import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

import { getUnsavedExtraColumns, PAST_EDIT_LOCKED_MESSAGE, type PatientExtrasUpdate } from "./data";
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

/** `fullName` نامِ ثبت‌شده در پروندهٔ مراجع است (نه لزوماً همان که تایپ شده)؛ نوبت دستی همین را به‌عنوان نام نوبت می‌نویسد. */
export type PatientResolution =
  | { ok: true; patientId: string; fullName: string }
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
      return { ok: true, patientId: found.id, fullName: found.full_name };
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
  return { ok: true, patientId: created.id, fullName: identity.fullName };
}

export const PICKED_PATIENT_INVALID_MESSAGE = "مراجع انتخاب‌شده معتبر نیست. یک مراجع را از فهرست انتخاب کنید.";

/** مراجعِ خوانده‌شده؛ تاریخ تولد و جنسِ فعلی پرونده را هم دارد تا معلوم شود کدام فیلد خالی است. */
export type LoadedPatient =
  | { ok: true; patientId: string; fullName: string; birthDate: string | null; gender: string | null }
  | { ok: false; message: string };

/** مراجعی که منشی از فهرست پیشنهاد برداشته؛ نامش را برای نوبت لازم داریم. */
export async function loadPatient(supabase: ServerSupabase, patientId: string): Promise<LoadedPatient> {
  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, birth_date, gender")
    .eq("id", patientId)
    .maybeSingle();
  if (error) {
    logDbError("خواندن مراجع ناموفق بود", error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  if (!data) {
    return { ok: false, message: PICKED_PATIENT_INVALID_MESSAGE };
  }
  return { ok: true, patientId: data.id, fullName: data.full_name, birthDate: data.birth_date, gender: data.gender };
}

export const PATIENT_EXTRAS_NOT_SAVED_MESSAGE =
  "تاریخ تولد یا جنس مراجع در پرونده ذخیره نشد و نوبت ثبت نشد. دوباره تلاش کنید؛ اگر باز هم نشد، به پزشک خبر بدهید.";

/**
 * تاریخ تولد و جنسِ تایپ‌شده را در پروندهٔ مراجع می‌نویسد، فقط برای ستون‌هایی که در `updates` آمده‌اند (خالی‌های پرونده).
 * همه در یک `UPDATE` است و برای هر ستون `.is(ستون, null)` دارد، پس مقدارِ ثبت‌شده هیچ‌وقت بازنویسی نمی‌شود، حتی اگر کسی
 * بین خواندن و نوشتن آن را پر کرده باشد. صفر ردیف یعنی یا کسی پر کرده یا RLS ردیف را نداده؛ پرونده دوباره خوانده می‌شود:
 * ستونی هنوز خالی ماند خطاست، وگرنه (همه پر شده‌اند) موفق است. خطا هرگز بی‌صدا رد نمی‌شود.
 */
export async function saveEmptyPatientExtras(
  supabase: ServerSupabase,
  patientId: string,
  updates: PatientExtrasUpdate,
): Promise<MutationResult> {
  const columns = Object.keys(updates) as Array<"birth_date" | "gender">;
  if (columns.length === 0) {
    return { ok: true, message: "" };
  }

  let query = supabase.from("patients").update(updates).eq("id", patientId);
  for (const column of columns) {
    query = query.is(column, null);
  }
  const { data, error } = await query.select("id");
  if (error) {
    logDbError("ذخیرهٔ تاریخ تولد و جنس مراجع ناموفق بود", error);
    return { ok: false, message: mapDbError(error) };
  }
  if (data.length > 0) {
    return { ok: true, message: "" };
  }

  const { data: row, error: readError } = await supabase
    .from("patients")
    .select("birth_date, gender")
    .eq("id", patientId)
    .maybeSingle();
  if (readError) {
    logDbError("خواندن دوبارهٔ مراجع ناموفق بود", readError);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  if (!row) {
    return { ok: false, message: PICKED_PATIENT_INVALID_MESSAGE };
  }
  return getUnsavedExtraColumns(columns, row).length === 0
    ? { ok: true, message: "" }
    : { ok: false, message: PATIENT_EXTRAS_NOT_SAVED_MESSAGE };
}

/**
 * `src/lib/database.types.ts` از پیش از مایگریشن‌های مطب (۰۰۰۸) تولید شده و `clinic_for_moment` و `clinic_id` را ندارد،
 * پس نوع آن‌ها اینجا محلی تعریف می‌شود (`supabase-js` ستون ناشناخته را در `insert` رد می‌کند). با بازتولید آن فایل
 * (کار نفر اول) این نوع‌ها و تبدیل‌شان برداشته می‌شود و `insert` عادی به کار می‌رود.
 */
export type ManualAppointmentRow = TablesInsert<"appointments"> & { clinic_id: string | null };

interface ClinicColumnsClient {
  rpc(name: "clinic_for_moment", args: { p_at: string }): PromiseLike<{ data: string | null; error: DbErrorLike | null }>;
  from(table: "appointments"): { insert(row: ManualAppointmentRow): PromiseLike<{ error: DbErrorLike | null }> };
}

/** مطبِ آن لحظه از برنامهٔ هفتگی؛ بیرون از ساعت کاری `null` است (استثنای منشی، A-6) و مانع ثبت نمی‌شود. */
export async function findClinicForMoment(
  supabase: ServerSupabase,
  startsAt: string,
): Promise<{ ok: true; clinicId: string | null } | { ok: false; message: string }> {
  const { data, error } = await (supabase as unknown as ClinicColumnsClient).rpc("clinic_for_moment", { p_at: startsAt });
  if (error) {
    logDbError("پیدا کردن مطب برای نوبت ناموفق بود", error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  return { ok: true, clinicId: data };
}

/** درج یک نوبت. خطا (حتی استثنا) به پیام فارسی می‌رسد، چون تغییر نام بعد از شکستِ درج باید نوبت قبلی را برگرداند. */
export async function insertAppointment(supabase: ServerSupabase, row: ManualAppointmentRow): Promise<MutationResult> {
  try {
    const { error } = await (supabase as unknown as ClinicColumnsClient).from("appointments").insert(row);
    if (error) {
      logDbError("ثبت نوبت ناموفق بود", error);
      return { ok: false, message: mapDbError(error, "manual") };
    }
    return { ok: true, message: "" };
  } catch (error) {
    console.error("ثبت نوبت ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
}
