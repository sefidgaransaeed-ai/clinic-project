"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { DB_WRITE_FAILED_MESSAGE } from "./db-errors";
import { validateBirthDate, validateGender, validateMobile, validateNationalId } from "./patient-validation";
import type { ServerSupabase } from "./queries";
import type { AppointmentStatus, MutationResult, NewPatientInput } from "./types";
import {
  APPOINTMENT_NOT_FOUND_MESSAGE,
  findOrCreatePatient,
  logDbError,
  STATUS_CHANGED_MESSAGE,
  updateAppointment,
  type PatientIdentity,
} from "./write-helpers";

/**
 * اکشن‌های نوشتن روی نوبت‌های پنل (تأیید، رد، لغو، بازگرداندن، تغییر وضعیت، اصلاح کد ملی).
 *
 * هر اکشن یک نقطهٔ ورودی عمومی است، پس خط اولش `requireRole` است و ورودی کلاینت دوباره سنجیده می‌شود
 * (بند ۵ CLAUDE.md: مخفی‌کردن دکمه کنترل دسترسی نیست). قفل ۷ روزه و هم‌پوشانی را خودِ پایگاه داده اجبار می‌کند.
 */

/** نتیجهٔ اکشن؛ `nationalIdConflict` یعنی رابط باید دکمهٔ «اصلاح کد ملی» را نشان بدهد. */
export type RequestActionResult = MutationResult & { nationalIdConflict?: boolean };

export type ConfirmRequestInput = {
  appointmentId: string;
  /** مراجعِ موجودی که منشی از فهرست انتخاب کرده؛ بدون آن، مراجع با کد ملی درخواست پیدا یا ساخته می‌شود. */
  patientId?: string;
  /** مراجع تازه با مشخصاتی که منشی در پنجرهٔ تأیید نوشته؛ جای مشخصات درخواست را می‌گیرد. */
  newPatient?: NewPatientInput;
};

const STATUSES: readonly AppointmentStatus[] = ["requested", "confirmed", "arrived", "done", "no_show", "cancelled"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIRMED_MESSAGE = "درخواست تأیید شد و نوبت قطعی شد.";
const REJECTED_MESSAGE = "درخواست رد شد.";
const RESTORED_MESSAGE = "درخواست به فهرست «در انتظار» برگشت.";
const CANCELLED_MESSAGE = "نوبت لغو شد.";
const STATUS_UPDATED_MESSAGE = "وضعیت نوبت عوض شد.";
const NATIONAL_ID_CORRECTED_MESSAGE = "کد ملی اصلاح شد و درخواست تأیید شد.";

const NATIONAL_ID_MISSING_MESSAGE =
  "این درخواست کد ملی ندارد. کد ملی را از مراجع بگیرید و با «اصلاح کد ملی» وارد کنید.";
const PICKED_PATIENT_INVALID_MESSAGE = "مراجع انتخاب‌شده معتبر نیست. یک مراجع را از فهرست انتخاب کنید.";
const FULL_NAME_MESSAGE = "نام و نام خانوادگی را وارد کنید.";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isStatus(value: unknown): value is AppointmentStatus {
  return STATUSES.some((status) => status === value);
}

/** هر استثنایی (قطع شبکه، نبود متغیر محیطی، …) پیام فارسی می‌شود؛ جزئیاتش فقط در لاگ سرور می‌ماند. */
async function run(work: (supabase: ServerSupabase) => Promise<RequestActionResult>): Promise<RequestActionResult> {
  try {
    return await work(await createClient());
  } catch (error) {
    console.error("نوشتن در پایگاه داده ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
}

function notFound(): RequestActionResult {
  return { ok: false, message: APPOINTMENT_NOT_FOUND_MESSAGE };
}

type IdentityResult = { ok: true; identity: PatientIdentity } | { ok: false; message: string; nationalIdConflict?: boolean };

type RequestRow = {
  requester_name: string | null;
  requester_mobile: string;
  requester_national_id: string | null;
  requested_for_self: boolean | null;
};

/** مراجع از روی خودِ درخواست: نام و کد ملی درخواست؛ شمارهٔ درخواست فقط وقتی به پروندهٔ مراجع می‌رود که مال خودش باشد (M-3). */
function identityFromRequest(request: RequestRow): IdentityResult {
  const nationalId = request.requester_national_id?.trim() ?? "";
  if (nationalId === "") {
    return { ok: false, message: NATIONAL_ID_MISSING_MESSAGE, nationalIdConflict: true };
  }
  const fullName = request.requester_name?.trim() ?? "";
  if (fullName === "") {
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  return {
    ok: true,
    identity: {
      fullName,
      nationalId,
      mobile: request.requested_for_self === true ? request.requester_mobile : null,
      birthDate: null,
      gender: null,
    },
  };
}

/** مراجع از روی فرم پنجرهٔ تأیید؛ همان سنجش‌های فرم دوباره سمت سرور انجام می‌شود، چون ورودی کلاینت قابل‌اعتماد نیست. */
function identityFromForm(form: NewPatientInput, request: RequestRow): IdentityResult {
  const fullName = form.full_name.trim();
  if (fullName === "") {
    return { ok: false, message: FULL_NAME_MESSAGE };
  }
  const nationalId = validateNationalId(form.national_id);
  if (!nationalId.ok) {
    return { ok: false, message: nationalId.message };
  }
  const mobile = validateMobile(form.mobile, { optional: true });
  if (!mobile.ok) {
    return { ok: false, message: mobile.message };
  }
  const birthDate = validateBirthDate(form.birth_date);
  if (!birthDate.ok) {
    return { ok: false, message: birthDate.message };
  }
  const gender = validateGender(form.gender);
  if (!gender.ok) {
    return { ok: false, message: gender.message };
  }
  return {
    ok: true,
    identity: {
      fullName,
      nationalId: nationalId.value,
      // شمارهٔ درخواست فقط وقتی کپی می‌شود که برای خودِ مراجع بوده و شمارهٔ شخصی نوشته نشده باشد.
      mobile: mobile.value || (request.requested_for_self === true ? request.requester_mobile : null),
      birthDate: birthDate.value,
      gender: gender.value,
    },
  };
}

function readNewPatient(value: unknown): NewPatientInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { full_name, mobile, national_id, birth_date, gender } = value as Record<string, unknown>;
  if (
    typeof full_name !== "string" ||
    typeof mobile !== "string" ||
    typeof national_id !== "string" ||
    typeof birth_date !== "string" ||
    typeof gender !== "string"
  ) {
    return null;
  }
  return { full_name, mobile, national_id, birth_date, gender: gender as NewPatientInput["gender"] };
}

/**
 * تأیید درخواست: مراجع پیدا یا ساخته می‌شود و بعد فقط یک `UPDATE` روی `status` و `patient_id` می‌خورد.
 * چون `patient_id` از پیش پر است، trigger `link_patient_on_confirm` اجرا نمی‌شود؛ پس مراجعِ هم‌کدملی با نامِ دیگر بی‌صدا وصل نمی‌شود.
 * `requester_name` و `requester_mobile` هرگز نوشته نمی‌شوند.
 */
async function confirmWithClient(
  supabase: ServerSupabase,
  userId: string,
  input: ConfirmRequestInput,
): Promise<RequestActionResult> {
  const { data: request, error } = await supabase
    .from("appointments")
    .select("status, patient_id, requester_name, requester_mobile, requester_national_id, requested_for_self")
    .eq("id", input.appointmentId)
    .maybeSingle();
  if (error) {
    logDbError("خواندن درخواست ناموفق بود", error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  if (!request) {
    return notFound();
  }
  if (request.status !== "requested") {
    return { ok: false, message: STATUS_CHANGED_MESSAGE };
  }

  let patientId = input.patientId ?? request.patient_id;
  if (!patientId) {
    const resolvedIdentity = input.newPatient
      ? identityFromForm(input.newPatient, request)
      : identityFromRequest(request);
    if (!resolvedIdentity.ok) {
      return resolvedIdentity;
    }
    const patient = await findOrCreatePatient(supabase, resolvedIdentity.identity, userId);
    if (!patient.ok) {
      return patient;
    }
    patientId = patient.patientId;
  }

  const updated = await updateAppointment(
    supabase,
    input.appointmentId,
    { status: "confirmed", patient_id: patientId },
    { expectedStatus: "requested" },
  );
  return updated.ok ? { ok: true, message: CONFIRMED_MESSAGE } : updated;
}

export async function confirmRequest(input: ConfirmRequestInput): Promise<RequestActionResult> {
  const user = await requireRole(["doctor", "secretary"]);
  if (!isUuid(input?.appointmentId)) {
    return notFound();
  }
  if (input.patientId !== undefined && !isUuid(input.patientId)) {
    return { ok: false, message: PICKED_PATIENT_INVALID_MESSAGE };
  }
  const newPatient = input.newPatient === undefined ? undefined : readNewPatient(input.newPatient);
  if (newPatient === null) {
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  return run((supabase) =>
    confirmWithClient(supabase, user.id, { appointmentId: input.appointmentId, patientId: input.patientId, newPatient }),
  );
}

/** رد درخواست: وضعیت و دلیل لغو در یک `UPDATE` (قید `appointments_cancel_reason_consistency`). */
export async function rejectRequest(appointmentId: string): Promise<RequestActionResult> {
  await requireRole(["doctor", "secretary"]);
  if (!isUuid(appointmentId)) {
    return notFound();
  }
  return run(async (supabase) => {
    const updated = await updateAppointment(
      supabase,
      appointmentId,
      { status: "cancelled", cancel_reason: "rejected" },
      { expectedStatus: "requested" },
    );
    return updated.ok ? { ok: true, message: REJECTED_MESSAGE } : updated;
  });
}

/** بازگرداندن درخواستِ ردشده به «در انتظار»؛ دلیل لغو هم‌زمان خالی می‌شود. */
export async function restoreRequest(appointmentId: string): Promise<RequestActionResult> {
  await requireRole(["doctor", "secretary"]);
  if (!isUuid(appointmentId)) {
    return notFound();
  }
  return run(async (supabase) => {
    const updated = await updateAppointment(
      supabase,
      appointmentId,
      { status: "requested", cancel_reason: null },
      { expectedStatus: "cancelled" },
    );
    return updated.ok ? { ok: true, message: RESTORED_MESSAGE } : updated;
  });
}

/**
 * تغییر وضعیت یک نوبت به هر وضعیت دیگر (پایگاه داده ترتیبی اجبار نمی‌کند). لغو همیشه با دلیل `cancelled` و
 * هر وضعیت دیگر با دلیل خالی نوشته می‌شود. برگرداندن نوبت لغوشده به فعال ممکن است با نوبت دیگری هم‌پوشانی پیدا کند.
 */
export async function changeAppointmentStatus(appointmentId: string, status: AppointmentStatus): Promise<RequestActionResult> {
  await requireRole(["doctor", "secretary"]);
  if (!isUuid(appointmentId)) {
    return notFound();
  }
  if (!isStatus(status)) {
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  return run(async (supabase) => {
    const cancelling = status === "cancelled";
    const updated = await updateAppointment(supabase, appointmentId, {
      status,
      cancel_reason: cancelling ? "cancelled" : null,
    });
    return updated.ok ? { ok: true, message: cancelling ? CANCELLED_MESSAGE : STATUS_UPDATED_MESSAGE } : updated;
  });
}

/**
 * «اصلاح کد ملی» برای درخواستی که کدش مال مراجعِ دیگری بود: کد تازه (با همان سنجش فرم) ذخیره می‌شود
 * و همان تأیید خودکار با کد جدید دوباره اجرا می‌شود. این دو نوشتن یک تراکنش نیستند؛ اگر تأیید نشد، کد اصلاح‌شده می‌ماند.
 */
export async function correctNationalId(appointmentId: string, nationalId: string): Promise<RequestActionResult> {
  const user = await requireRole(["doctor", "secretary"]);
  if (!isUuid(appointmentId)) {
    return notFound();
  }
  const valid = validateNationalId(typeof nationalId === "string" ? nationalId : "");
  if (!valid.ok) {
    return { ok: false, message: valid.message };
  }
  return run(async (supabase) => {
    const saved = await updateAppointment(
      supabase,
      appointmentId,
      { requester_national_id: valid.value },
      { expectedStatus: "requested" },
    );
    if (!saved.ok) {
      return saved;
    }
    const confirmed = await confirmWithClient(supabase, user.id, { appointmentId });
    return confirmed.ok ? { ok: true, message: NATIONAL_ID_CORRECTED_MESSAGE } : confirmed;
  });
}
