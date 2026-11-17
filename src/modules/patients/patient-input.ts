import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { DB_WRITE_FAILED_MESSAGE } from "@/modules/appointments/db-errors";
import {
  validateBirthDate,
  validateGender,
  validateMobile,
  validateNationalId,
} from "@/modules/appointments/patient-validation";
import type { PatientGender } from "@/modules/appointments/types";

/**
 * آماده‌سازی ورودی فرم مراجع برای نوشتن در `patients`. فقط محاسبه است (بدون Supabase و `server-only`)،
 * پس اکشن‌ها و آزمون‌ها از همین‌جا استفاده می‌کنند. ورودی کلاینت قابل‌اعتماد نیست، پس همه‌چیز دوباره سنجیده می‌شود.
 */

export const PATIENT_FULL_NAME_MESSAGE = "نام و نام خانوادگی را وارد کنید.";

export const PATIENT_NOT_FOUND_MESSAGE =
  "این مراجع پیدا نشد. صفحه را تازه کنید؛ ممکن است کسی دیگر آن را تغییر داده باشد.";

export const PATIENT_CREATED_MESSAGE = "مراجع ثبت شد.";
export const PATIENT_UPDATED_MESSAGE = "اطلاعات مراجع ذخیره شد.";

/** نتیجهٔ اکشن‌های ثبت و ویرایش؛ `notice` هشداری است که ثبت را ناموفق نمی‌کند (نوع بیمه ذخیره نشد). */
export type PatientSaveResult =
  | { ok: true; message: string; patientId: string; notice?: string }
  | { ok: false; message: string };

export type PatientSaveSuccess = Extract<PatientSaveResult, { ok: true }>;

/** ستون‌های `patients` که از فرم می‌آیند؛ فیلد اختیاریِ خالی `null` است (رشتهٔ خالی قید `mobile` را می‌شکند). */
export interface PatientFields {
  full_name: string;
  national_id: string;
  mobile: string | null;
  /** تاریخ میلادی `YYYY-MM-DD`؛ فرم شمسی است و اینجا تبدیل شده. */
  birth_date: string | null;
  gender: PatientGender | null;
}

export type ParsedPatientForm =
  | { ok: true; fields: PatientFields; insuranceName: string }
  | { ok: false; message: string };

/** رشتهٔ خالی (یا فقط فاصله) `null` می‌شود؛ مقدار پرشده بدون فاصلهٔ دو سر می‌ماند. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const FORM_KEYS = ["full_name", "mobile", "national_id", "birth_date", "gender", "insurance_type_name"] as const;

function readStrings(value: unknown): Record<(typeof FORM_KEYS)[number], string> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const strings: Partial<Record<(typeof FORM_KEYS)[number], string>> = {};
  for (const key of FORM_KEYS) {
    const field = record[key];
    if (typeof field !== "string") {
      return null;
    }
    strings[key] = field;
  }
  return strings as Record<(typeof FORM_KEYS)[number], string>;
}

/**
 * فرم مراجع را می‌سنجد و برای نوشتن آماده می‌کند. فقط اولین خطا برمی‌گردد و ترتیبش ترتیب فیلدهای فرم است.
 * تاریخ تولدِ شمسیِ «روز/ماه/سال» همین‌جا (با `validateBirthDate`) به میلادی تبدیل می‌شود.
 */
export function parsePatientForm(value: unknown): ParsedPatientForm {
  const form = readStrings(value);
  if (!form) {
    return { ok: false, message: DB_WRITE_FAILED_MESSAGE };
  }

  const fullName = emptyToNull(form.full_name);
  if (fullName === null) {
    return { ok: false, message: PATIENT_FULL_NAME_MESSAGE };
  }
  const mobile = validateMobile(form.mobile, { optional: true });
  if (!mobile.ok) {
    return { ok: false, message: mobile.message };
  }
  const nationalId = validateNationalId(form.national_id);
  if (!nationalId.ok) {
    return { ok: false, message: nationalId.message };
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
    fields: {
      full_name: fullName,
      national_id: nationalId.value,
      mobile: emptyToNull(mobile.value),
      birth_date: birthDate.value,
      gender: gender.value,
    },
    insuranceName: form.insurance_type_name.trim(),
  };
}

export type InsuranceTypeRow = { id: string; name: string };

/** `blank`: فرم نوعی انتخاب نکرده. `unknown`: نامی که در `insurance_types` نیست (مثلاً فهرست آمادهٔ فرم با پایگاه داده نمی‌خواند). */
export type InsuranceLookup = { kind: "blank" } | { kind: "found"; id: string } | { kind: "unknown"; name: string };

export function lookupInsurance(name: string, types: readonly InsuranceTypeRow[]): InsuranceLookup {
  const wanted = name.trim();
  if (wanted === "") {
    return { kind: "blank" };
  }
  const match = types.find((type) => type.name.trim() === wanted);
  return match ? { kind: "found", id: match.id } : { kind: "unknown", name: wanted };
}

/** پیامِ هشدار وقتی نوع بیمه ذخیره نشد؛ فقط برای نامِ ناشناخته، نه نامِ خالی. */
export function insuranceNotSavedNotice(lookup: InsuranceLookup): string | undefined {
  return lookup.kind === "unknown"
    ? `نوع بیمهٔ «${lookup.name}» در فهرست بیمه‌های مطب نیست و ذخیره نشد. به پزشک خبر بدهید تا آن را به فهرست اضافه کند.`
    : undefined;
}

/** ثبت: نام ناشناخته و خالی هر دو `null` می‌شوند. */
export function buildPatientInsert(
  fields: PatientFields,
  createdBy: string,
  insurance: InsuranceLookup,
): TablesInsert<"patients"> {
  return { ...fields, insurance_type_id: insurance.kind === "found" ? insurance.id : null, created_by: createdBy };
}

/**
 * ویرایش: همهٔ فیلدها نوشته می‌شوند، ولی `insurance_type_id` فقط وقتی که نام در فهرست پیدا شد؛
 * با نام ناشناخته یا خالی کلیدش اصلاً نیست تا بیمهٔ ثبت‌شدهٔ مراجع هیچ‌وقت پاک نشود.
 */
export function buildPatientUpdate(fields: PatientFields, insurance: InsuranceLookup): TablesUpdate<"patients"> {
  return insurance.kind === "found" ? { ...fields, insurance_type_id: insurance.id } : { ...fields };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPatientId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
