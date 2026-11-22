import "server-only";

import { getPanelUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  CLOSURE_NOT_FOUND_MESSAGE,
  DB_READ_FAILED_MESSAGE,
  mapDbError,
  NOT_ALLOWED_MESSAGE,
  ROW_NOT_FOUND_MESSAGE,
  type DbErrorLike,
} from "./db-errors";
import {
  findAffectedByClosure,
  findAffectedByScheduleChange,
  requireConfirmation,
  type FutureAppointment,
} from "./affected-appointments";
import type {
  AffectedAppointmentView,
  ClinicOption,
  ClosureEntry,
  ConfirmationRequired,
  GuardedResult,
  Result,
  WorkingHoursEntry,
} from "./types";
import {
  CLOSURE_MESSAGES,
  validateClosure,
  validateRowId,
  validateWorkingHoursChange,
  validateWorkingHoursEdit,
  type ClosureInput,
  type WorkingHoursInput,
} from "./validation";

/**
 * خواندن و نوشتن ساعت کاری و تعطیلی — کار `p2-09`، مرحلهٔ اول (بدون رابط و بدون Server Action).
 *
 * ⚠️ فقط کلاینت کاربرِ واردشده (`createClient` از `@/lib/supabase/server`)؛ هرگز کلاینت ادمین.
 * پس قاعده‌های RLS همیشه اعمال می‌شوند: منشی می‌خواند، فقط پزشک می‌نویسد، و برای هیچ نقشی سیاست حذف نیست.
 * هر تابع نوشتن علاوه بر RLS خودش هم نقش را می‌سنجد (دو لایه، بند ۵ بخش ۷ `CLAUDE.md`)؛
 * Server Action مرحلهٔ بعد هم باید در خط اولش `requireRole(["doctor"])` داشته باشد.
 *
 * مطب (تصمیم 0011 و تصمیم مریم): روزی که ردیف فعال دارد، مطبش از همان ردیف‌ها مشتق می‌شود و پزشک انتخابش نمی‌کند.
 * روزی که ردیف فعال ندارد (بی‌ردیف یا فقط غیرفعال) `clinicId` الزامی است و باید یکی از مطب‌های `listClinics()` باشد؛
 * فرمِ مرحلهٔ بعد همان فهرست را نشان می‌دهد. مطبِ خالی هرگز نوشته نمی‌شود.
 * ویرایشِ ردیفِ موجود از این‌ها جداست: مطبِ همان ردیف حفظ می‌شود و دوباره پرسیده نمی‌شود (`updateWorkingHours`).
 *
 * عمداً این‌ها **وجود ندارند**: حذف ساعت کاری (به‌جایش `is_active = false`) و حذف تعطیلی.
 * ستون `reminder_hour` (در `app_settings`) هم اینجا خوانده یا نوشته نمی‌شود.
 *
 * ⚠️ هم‌پوشانی ساعت‌ها پیش از نوشتن در همین لایه سنجیده می‌شود، چون پایگاه داده قیدی برایش ندارد؛
 * این سنجش اتمی نیست (دو نوشتنِ هم‌زمان می‌توانند از آن رد شوند). برای یک پزشک و یک پنل کافی است؛
 * قید واقعی (exclusion constraint) کار `supabase/` است و باید به نفر اول گفته شود.
 */

function logDbError(action: string, error: DbErrorLike) {
  // فقط کد و متن فنی در لاگ سرور؛ هیچ‌کدام به کاربر نمی‌رسد.
  console.error(`[schedule-settings] ${action} failed`, error.code, error.message);
}

/** ساعتِ ستون `time` پایگاه داده «HH:MM:SS» است؛ مدل ما «HH:MM». */
function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

/** نوشتن فقط برای پزشکِ فعال؛ شناسهٔ او برای `created_by` برمی‌گردد. */
async function requireDoctor(): Promise<Result<string>> {
  const user = await getPanelUser();
  if (!user || user.role !== "doctor") return { ok: false, message: NOT_ALLOWED_MESSAGE };
  return { ok: true, value: user.id };
}

// ------------------------------------------------------------------ خواندن

/** همهٔ بازه‌های کاری (فعال و غیرفعال) با نام مطب، به ترتیب روز و ساعت شروع. */
export async function listWorkingHours(): Promise<Result<WorkingHoursEntry[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .select("id, clinic_id, weekday, start_time, end_time, is_active, clinics(name)")
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    logDbError("listWorkingHours", error);
    return { ok: false, message: DB_READ_FAILED_MESSAGE };
  }

  return {
    ok: true,
    value: data.map((row) => ({
      id: row.id,
      clinicId: row.clinic_id,
      clinicName: row.clinics?.name ?? null,
      weekday: row.weekday,
      startTime: toHourMinute(row.start_time),
      endTime: toHourMinute(row.end_time),
      isActive: row.is_active,
    })),
  };
}

/** مطب‌های فعال به ترتیب `sort_order`؛ هم برای فرمِ انتخابِ مطب و هم برای سنجش `clinicId` پیش از نوشتن. */
export async function listClinics(): Promise<Result<ClinicOption[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    logDbError("listClinics", error);
    return { ok: false, message: DB_READ_FAILED_MESSAGE };
  }

  return { ok: true, value: data.map((row) => ({ id: row.id, name: row.name })) };
}

/** ردیف‌های ساعت کاری و مطب‌های فعال با هم، برای سنجشی که هر دو را می‌خواهد. */
async function loadValidationContext(): Promise<Result<{ existing: WorkingHoursEntry[]; clinicIds: string[] }>> {
  const existing = await listWorkingHours();
  if (!existing.ok) return existing;

  const clinics = await listClinics();
  if (!clinics.ok) return clinics;

  return { ok: true, value: { existing: existing.value, clinicIds: clinics.value.map((clinic) => clinic.id) } };
}

const UNKNOWN_PATIENT_NAME = "نام ثبت‌نشده";

/**
 * نوبت‌های تأییدشدهٔ آینده برای هشدار «نوبت‌های متأثر». فقط با کلاینت کاربرِ واردشده (RLS اعمال می‌شود؛ هرگز ادمین)
 * و فقط ستون‌هایی که لازم است: زمان، مطب و نام. موبایل و کدملی عمداً خوانده نمی‌شوند.
 * نام از پروندهٔ مراجع می‌آید و اگر نوبت به مراجع وصل نیست از نامِ ثبت‌شدهٔ درخواست.
 */
async function listFutureConfirmedAppointments(): Promise<Result<FutureAppointment[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, clinic_id, requester_name, patients(full_name)")
    .eq("status", "confirmed")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    logDbError("listFutureConfirmedAppointments", error);
    return { ok: false, message: DB_READ_FAILED_MESSAGE };
  }

  return {
    ok: true,
    value: data.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      clinicId: row.clinic_id,
      patientName: row.patients?.full_name ?? row.requester_name ?? UNKNOWN_PATIENT_NAME,
    })),
  };
}

type Impact = (appointments: readonly FutureAppointment[]) => AffectedAppointmentView[];

/**
 * اگر تغییر نوبت تأییدشده‌ای را بیرون برنامه ببرد، نتیجهٔ «تأیید دوم لازم است» برمی‌گردد (چیزی نوشته نمی‌شود)؛
 * اگر مجاز بود `null`. فهرست همین‌جا و درست پیش از نوشتن تازه خوانده می‌شود، نه از فرم.
 */
async function checkImpact(
  impact: Impact,
  confirmedIds: readonly string[] | null,
  context: { closureDate?: string; values?: Record<string, string> } = {},
): Promise<Result<never> | ConfirmationRequired | null> {
  const appointments = await listFutureConfirmedAppointments();
  if (!appointments.ok) return appointments;
  return requireConfirmation(impact(appointments.value), confirmedIds, context);
}

/**
 * همهٔ تعطیلی‌ها، فعال و لغوشده، به ترتیب تاریخ. عمداً فیلتر `is_active` ندارد: این فهرستِ مدیریت است
 * و ردیف لغوشده باید دیده و دوباره فعال شود. خواننده‌های اجرایی (تقویم و ثبت نوبت) فقط فعال‌ها را می‌خوانند.
 */
export async function listClosures(): Promise<Result<ClosureEntry[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closures")
    .select("id, closure_date, reason, is_active, created_at")
    .order("closure_date", { ascending: true });

  if (error) {
    logDbError("listClosures", error);
    return { ok: false, message: DB_READ_FAILED_MESSAGE };
  }

  return {
    ok: true,
    value: data.map((row) => ({
      id: row.id,
      closureDate: row.closure_date,
      reason: row.reason ?? "",
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
  };
}

// ------------------------------------------------------------ ساعت کاری: نوشتن

/**
 * بازهٔ کاری تازه. `upsert` نمی‌زنیم: جدول کلید طبیعی یکتا (مثل روز + مطب) ندارد
 * و چند بازه در یک روز مجاز است، پس «ایجاد» و «ویرایش» دو تابع جدا هستند.
 */
export async function createWorkingHours(input: WorkingHoursInput): Promise<Result<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const context = await loadValidationContext();
  if (!context.ok) return context;

  const checked = validateWorkingHoursChange({ ...input, id: undefined }, context.value.existing, context.value.clinicIds);
  if (!checked.ok) return checked;
  const row = checked.value;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .insert({
      clinic_id: row.clinicId,
      weekday: row.weekday,
      start_time: row.startTime,
      end_time: row.endTime,
      is_active: row.isActive,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createWorkingHours", error);
    return { ok: false, message: mapDbError(error) };
  }
  return { ok: true, value: { id: data.id } };
}

/**
 * ویرایش یک بازهٔ موجود (روز، ساعت‌ها و فعال/غیرفعال‌بودن). مطبِ ردیف خودکار از خودِ ردیف خوانده می‌شود و
 * هرگز پرسیده نمی‌شود؛ `clinicId` در ورودی لازم نیست و اگر بیاید باید با مطبِ ردیف یکی باشد.
 * ستون `clinic_id` در `update` اصلاً نوشته نمی‌شود، پس ویرایش هیچ‌وقت ردیف را به مطب دیگری نمی‌برد.
 */
export async function updateWorkingHours(
  id: string,
  input: WorkingHoursInput,
  confirmedIds: readonly string[] | null = null,
): Promise<GuardedResult<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const checkedId = validateRowId(id);
  if (!checkedId.ok) return checkedId;

  const existing = await listWorkingHours();
  if (!existing.ok) return existing;

  const checked = validateWorkingHoursEdit({ ...input, id: checkedId.value }, existing.value);
  if (!checked.ok) return checked;
  const row = checked.value;

  // برنامهٔ پس از تغییر: همهٔ ردیف‌ها، با این ردیف به‌روز؛ نوبتی که از داخل برنامه به بیرون می‌افتد متأثر است.
  const guard = await checkImpact(
    (appointments) =>
      findAffectedByScheduleChange(
        appointments,
        existing.value,
        existing.value.map((entry) =>
          entry.id === checkedId.value
            ? { ...entry, weekday: row.weekday, startTime: row.startTime, endTime: row.endTime, isActive: row.isActive }
            : entry,
        ),
      ),
    confirmedIds,
    // ارسال دوم (تأیید) باید همین مقدارها را بفرستد، نه مقدار بازگشتهٔ فرم.
    {
      values: {
        weekday: String(row.weekday),
        startTime: row.startTime,
        endTime: row.endTime,
        isActive: String(row.isActive),
      },
    },
  );
  if (guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .update({
      weekday: row.weekday,
      start_time: row.startTime,
      end_time: row.endTime,
      is_active: row.isActive,
    })
    .eq("id", checkedId.value)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("updateWorkingHours", error);
    return { ok: false, message: mapDbError(error) };
  }
  if (!data) return { ok: false, message: ROW_NOT_FOUND_MESSAGE };
  return { ok: true, value: { id: data.id } };
}

/** بازه را غیرفعال می‌کند (`is_active = false`). حذف نمی‌شود: ردیف می‌ماند و بعداً می‌شود دوباره فعالش کرد. */
export async function deactivateWorkingHours(
  id: string,
  confirmedIds: readonly string[] | null = null,
): Promise<GuardedResult<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const checkedId = validateRowId(id);
  if (!checkedId.ok) return checkedId;

  const existing = await listWorkingHours();
  if (!existing.ok) return existing;

  const current = existing.value.find((entry) => entry.id === checkedId.value);
  if (!current) return { ok: false, message: ROW_NOT_FOUND_MESSAGE };

  // بازهٔ از پیش غیرفعال چیزی را کم نمی‌کند؛ فقط بازهٔ فعال هشدار می‌گیرد.
  if (current.isActive) {
    const guard = await checkImpact(
      (appointments) =>
        findAffectedByScheduleChange(
          appointments,
          existing.value,
          existing.value.map((entry) => (entry.id === checkedId.value ? { ...entry, isActive: false } : entry)),
        ),
      confirmedIds,
    );
    if (guard) return guard;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("working_hours")
    .update({ is_active: false })
    .eq("id", checkedId.value)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError("deactivateWorkingHours", error);
    return { ok: false, message: mapDbError(error) };
  }
  if (!data) return { ok: false, message: ROW_NOT_FOUND_MESSAGE };
  return { ok: true, value: { id: data.id } };
}

// ---------------------------------------------------------------- تعطیلی

/**
 * ثبت یک روز تعطیل. تعطیلی حذف‌شدنی نیست (تابع حذف عمداً نداریم)؛ اگر اشتباه ثبت شد، با `cancelClosure` لغو می‌شود
 * (ردیف می‌ماند) و با `reactivateClosure` دوباره فعال. تاریخِ ردیفِ لغوشده تازه ساخته نمی‌شود، چون تاریخ یکتاست.
 */
export async function createClosure(
  input: ClosureInput,
  confirmedIds: readonly string[] | null = null,
): Promise<GuardedResult<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const existing = await listClosures();
  if (!existing.ok) return existing;

  const checked = validateClosure(
    input,
    existing.value.map((closure) => ({ closureDate: closure.closureDate, isActive: closure.isActive })),
  );
  if (!checked.ok) return checked;

  const guard = await checkClosureImpact(checked.value.closureDate, checked.value.reason, confirmedIds);
  if (guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closures")
    .insert({
      closure_date: checked.value.closureDate,
      reason: checked.value.reason,
      created_by: doctor.value,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("createClosure", error);
    return { ok: false, message: mapDbError(error) };
  }
  return { ok: true, value: { id: data.id } };
}

/** تعطیلی در `closureDate` نوبت تأییدشدهٔ داخل برنامه را می‌بندد؟ (ثبت تازه و فعال‌سازی دوباره.) */
async function checkClosureImpact(
  closureDate: string,
  reason: string,
  confirmedIds: readonly string[] | null,
) {
  const hours = await listWorkingHours();
  if (!hours.ok) return hours;

  return checkImpact(
    (appointments) => findAffectedByClosure(appointments, closureDate, hours.value),
    confirmedIds,
    { closureDate, values: { closureDate, reason } },
  );
}

/**
 * فقط `is_active` یک تعطیلی را عوض می‌کند (تاریخ، دلیل و سازنده دست‌نخورده می‌مانند). حذف فیزیکی وجود ندارد.
 * نقش و شناسه را فراخوان پیش‌تر سنجیده است. ردیفی که پیدا نشد یا RLS پنهانش کرد پیام «پیدا نشد» می‌گیرد.
 */
async function writeClosureActive(action: string, id: string, isActive: boolean): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closures")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    logDbError(action, error);
    return { ok: false, message: mapDbError(error) };
  }
  if (!data) return { ok: false, message: CLOSURE_NOT_FOUND_MESSAGE };
  return { ok: true, value: { id: data.id } };
}

/**
 * تعطیلی را لغو می‌کند (`is_active = false`). ردیف می‌ماند و بعداً می‌شود دوباره فعالش کرد.
 * هشدار ندارد: لغو فقط روز را برای نوبت‌گیری باز می‌کند و نوبتی را بیرون برنامه نمی‌برد.
 */
export async function cancelClosure(id: string): Promise<Result<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const checkedId = validateRowId(id, CLOSURE_MESSAGES.id);
  if (!checkedId.ok) return checkedId;

  return writeClosureActive("cancelClosure", checkedId.value, false);
}

/**
 * تعطیلیِ لغوشده را دوباره فعال می‌کند: UPDATE روی همان ردیف، نه ردیف تازه (تاریخ یکتاست).
 * مثل ثبت تعطیلیِ تازه، اگر نوبت تأییدشدهٔ داخل برنامه در آن روز باشد تأیید دوم می‌خواهد.
 */
export async function reactivateClosure(
  id: string,
  confirmedIds: readonly string[] | null = null,
): Promise<GuardedResult<{ id: string }>> {
  const doctor = await requireDoctor();
  if (!doctor.ok) return doctor;

  const checkedId = validateRowId(id, CLOSURE_MESSAGES.id);
  if (!checkedId.ok) return checkedId;

  const closures = await listClosures();
  if (!closures.ok) return closures;

  const current = closures.value.find((closure) => closure.id === checkedId.value);
  if (!current) return { ok: false, message: CLOSURE_NOT_FOUND_MESSAGE };

  // تعطیلیِ از پیش فعال چیزی را نمی‌بندد؛ فقط ردیفِ لغوشده هشدار می‌گیرد.
  if (!current.isActive) {
    const guard = await checkClosureImpact(current.closureDate, current.reason, confirmedIds);
    if (guard) return guard;
  }

  return writeClosureActive("reactivateClosure", checkedId.value, true);
}
