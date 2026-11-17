"use server";

import { requireRole } from "@/lib/auth";
import { mapDbError } from "@/modules/appointments/db-errors";
import type { PatientFormInput } from "@/modules/appointments/types";
import { logDbError } from "@/modules/appointments/write-helpers";

import {
  buildPatientInsert,
  buildPatientUpdate,
  insuranceNotSavedNotice,
  isPatientId,
  parsePatientForm,
  PATIENT_CREATED_MESSAGE,
  PATIENT_NOT_FOUND_MESSAGE,
  PATIENT_UPDATED_MESSAGE,
  type PatientSaveResult,
} from "./patient-input";
import { resolveInsurance, runPatientWrite } from "./write-helpers";

/**
 * اکشن‌های ثبت و ویرایش مراجع.
 *
 * هر اکشن یک نقطهٔ ورودی عمومی است، پس خط اولش `requireRole` است و ورودی کلاینت دوباره سنجیده می‌شود
 * (بند ۵ CLAUDE.md: مخفی‌کردن دکمه کنترل دسترسی نیست). «شمارهٔ شخصی مراجع» یکتا نیست (تصمیم M-7)، پس تکراری‌بودنش بررسی نمی‌شود؛
 * کد ملیِ تکراری را قید یکتای پایگاه داده (`23505`) می‌گیرد و `mapDbError` فارسی‌اش می‌کند.
 */

/** ثبت مراجع تازه؛ `patientId` برگشتی همان است که صفحه با آن `/panel/patients/[id]` را باز می‌کند. */
export async function createPatient(input: PatientFormInput): Promise<PatientSaveResult> {
  const user = await requireRole(["doctor", "secretary"]);
  const parsed = parsePatientForm(input);
  if (!parsed.ok) {
    return parsed;
  }

  return runPatientWrite(async (supabase) => {
    const insurance = await resolveInsurance(supabase, parsed.insuranceName);
    if (!insurance.ok) {
      return insurance;
    }

    const { data, error } = await supabase
      .from("patients")
      .insert(buildPatientInsert(parsed.fields, user.id, insurance.lookup))
      .select("id")
      .single();
    if (error) {
      logDbError("ساخت مراجع ناموفق بود", error);
      return { ok: false, message: mapDbError(error) };
    }
    return {
      ok: true,
      message: PATIENT_CREATED_MESSAGE,
      patientId: data.id,
      notice: insuranceNotSavedNotice(insurance.lookup),
    };
  });
}

/**
 * ویرایش همهٔ فیلدهای مراجع، کد ملی هم. نوع بیمه فقط وقتی عوض می‌شود که نامش در `insurance_types` پیدا شود.
 * سیاست RLS ردیفِ دیده‌نشدنی را بی‌صدا از دسترس بیرون می‌برد (بدون خطا، صفر ردیف)؛ برای همین `.select("id")` می‌گیریم
 * و صفر ردیف را «پیدا نشد» می‌خوانیم. مراجع قفل ۷ روزه ندارد.
 */
export async function updatePatient(patientId: string, input: PatientFormInput): Promise<PatientSaveResult> {
  await requireRole(["doctor", "secretary"]);
  if (!isPatientId(patientId)) {
    return { ok: false, message: PATIENT_NOT_FOUND_MESSAGE };
  }
  const parsed = parsePatientForm(input);
  if (!parsed.ok) {
    return parsed;
  }

  return runPatientWrite(async (supabase) => {
    const insurance = await resolveInsurance(supabase, parsed.insuranceName);
    if (!insurance.ok) {
      return insurance;
    }

    const { data, error } = await supabase
      .from("patients")
      .update(buildPatientUpdate(parsed.fields, insurance.lookup))
      .eq("id", patientId)
      .select("id");
    if (error) {
      logDbError("ویرایش مراجع ناموفق بود", error);
      return { ok: false, message: mapDbError(error) };
    }
    if (data.length === 0) {
      return { ok: false, message: PATIENT_NOT_FOUND_MESSAGE };
    }
    return {
      ok: true,
      message: PATIENT_UPDATED_MESSAGE,
      patientId,
      notice: insuranceNotSavedNotice(insurance.lookup),
    };
  });
}
