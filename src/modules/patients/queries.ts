import "server-only";

import { PANEL_LOAD_FAILED_MESSAGE } from "@/modules/appointments/data";
import { mapAppointmentRow } from "@/modules/appointments/row-mappers";
import type { AppointmentSnapshot, PanelLoadResult } from "@/modules/appointments/types";
import { createClient } from "@/lib/supabase/server";

import { mapPatientRow } from "./row-mappers";

/**
 * خواندن مراجعان از Supabase با نشست کاربر واردشده (RLS اعمال می‌شود). فقط سمت سرور.
 * هیچ نوشتنی اینجا نیست؛ ثبت و ویرایش مراجع کار برش بعدی است.
 */

const PATIENT_COLUMNS = "id, full_name, mobile, national_id, birth_date, gender, insurance_types(name)";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** صفحهٔ فهرست مراجعان فقط خودِ مراجعان را لازم دارد، نه نوبت‌ها. */
export async function loadPatientsSnapshot(): Promise<PanelLoadResult<AppointmentSnapshot>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("patients").select(PATIENT_COLUMNS).order("full_name");
    if (error) {
      console.error("خواندن مراجعان از پایگاه داده ناموفق بود:", error.message);
      return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
    }
    return {
      ok: true,
      snapshot: { appointments: [], patients: (data ?? []).map(mapPatientRow), closures: [], workingDays: [] },
    };
  } catch (error) {
    console.error("خواندن مراجعان ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
  }
}

/**
 * یک مراجع و نوبت‌هایش. شناسهٔ نامعتبر یا ناموجود خطا نیست: فهرست مراجعانِ خالی برمی‌گردد
 * و صفحه «مراجع پیدا نشد» نشان می‌دهد. شناسه‌ای که uuid نیست هرگز به پایگاه داده نمی‌رسد.
 */
export async function loadPatientDetailSnapshot(patientId: string): Promise<PanelLoadResult<AppointmentSnapshot>> {
  const empty: AppointmentSnapshot = { appointments: [], patients: [], closures: [], workingDays: [] };
  if (!UUID_PATTERN.test(patientId)) {
    return { ok: true, snapshot: empty };
  }

  try {
    const supabase = await createClient();
    const [patientResult, appointmentsResult] = await Promise.all([
      supabase.from("patients").select(PATIENT_COLUMNS).eq("id", patientId).maybeSingle(),
      supabase.from("appointments").select("*").eq("patient_id", patientId).order("starts_at"),
    ]);

    const failure = patientResult.error ?? appointmentsResult.error;
    if (failure) {
      console.error("خواندن مراجع از پایگاه داده ناموفق بود:", failure.message);
      return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
    }
    if (!patientResult.data) {
      return { ok: true, snapshot: empty };
    }

    const patient = mapPatientRow(patientResult.data);
    return {
      ok: true,
      snapshot: {
        ...empty,
        patients: [patient],
        appointments: (appointmentsResult.data ?? []).map((row) => mapAppointmentRow(row, patient)),
      },
    };
  } catch (error) {
    console.error("خواندن مراجع ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: PANEL_LOAD_FAILED_MESSAGE };
  }
}
