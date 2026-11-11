import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DB_WRITE_FAILED_MESSAGE } from "@/modules/appointments/db-errors";
import type { ServerSupabase } from "@/modules/appointments/queries";
import { logDbError } from "@/modules/appointments/write-helpers";

import { lookupInsurance, type InsuranceLookup, type PatientSaveResult } from "./patient-input";

/**
 * کمک‌های نوشتن مراجع در Supabase؛ با نشست کاربر واردشده، پس RLS اعمال می‌شود. فقط سمت سرور.
 * فایل `actions.ts` فقط تابع async صادر می‌کند، برای همین بقیه اینجاست.
 */

/** هر استثنایی (قطع شبکه، نبود متغیر محیطی، …) پیام فارسی می‌شود؛ جزئیاتش فقط در لاگ سرور می‌ماند. */
export async function runPatientWrite(
  work: (supabase: ServerSupabase) => Promise<PatientSaveResult>,
): Promise<PatientSaveResult> {
  try {
    return await work(await createClient());
  } catch (error) {
    console.error("نوشتن مراجع در پایگاه داده ناموفق بود:", error instanceof Error ? error.message : error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
}

/**
 * نام نوع بیمهٔ فرم را با `insurance_types` می‌خواند. برای نام خالی به پایگاه داده نمی‌رویم.
 * اگر خواندن نشد، نوشتن انجام نمی‌شود؛ وگرنه بیمهٔ مراجع بی‌صدا `null` می‌شد.
 */
export async function resolveInsurance(
  supabase: ServerSupabase,
  name: string,
): Promise<{ ok: true; lookup: InsuranceLookup } | { ok: false; message: string }> {
  if (name === "") {
    return { ok: true, lookup: { kind: "blank" } };
  }
  const { data, error } = await supabase.from("insurance_types").select("id, name");
  if (error) {
    logDbError("خواندن نوع‌های بیمه ناموفق بود", error);
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }
  return { ok: true, lookup: lookupInsurance(name, data) };
}
