import type { Tables } from "@/lib/database.types";
import type { Patient, PatientGender } from "@/modules/appointments/types";

/**
 * تبدیل ردیف جدول `patients` به شکلی که صفحه‌ها می‌شناسند. فقط محاسبه است (بدون Supabase و React)،
 * پس هم روی سرور و هم در آزمون با ردیف ساختگی کار می‌کند.
 *
 * `insurance_types` همان join پرسمان است: `insurance_types(name)`. مراجعی که نوع بیمه ندارد `null` می‌گیرد.
 */
export type PatientRow = Pick<Tables<"patients">, "id" | "full_name" | "mobile" | "national_id" | "birth_date" | "gender"> & {
  insurance_types: { name: string } | null;
};

function toGender(value: string | null): PatientGender | null {
  if (value === null || value === "female" || value === "male") {
    return value;
  }
  throw new Error(`جنس نامعتبر در ردیف مراجع: ${value}`);
}

export function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    full_name: row.full_name,
    mobile: row.mobile,
    national_id: row.national_id,
    birth_date: row.birth_date,
    gender: toGender(row.gender),
    // خالی یعنی در پرونده نوع بیمه‌ای ثبت نشده؛ صفحه «ثبت نشده» نشان می‌دهد، نه یک مقدار ساختگی.
    insurance_type_name: row.insurance_types?.name ?? "",
  };
}
