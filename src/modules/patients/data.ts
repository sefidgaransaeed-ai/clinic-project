import { gregorianToJalali } from "@/modules/appointments/date";
import { searchPatients } from "@/modules/appointments/panel-patient-search";
import { composeBirthDate } from "@/modules/appointments/patient-validation";
import { newestFirst, parseQuery } from "@/modules/appointments/search";
import type {
  AppointmentSnapshot,
  AppointmentWithPatient,
  Patient,
  PatientFormInput,
} from "@/modules/appointments/types";

/**
 * جست‌وجو و نگاشت‌های خالص روی مراجعانی که سرور از Supabase خوانده (`queries.ts` + `row-mappers.ts`).
 * این فایل به Supabase وابسته نیست و در کامپوننت‌های کلاینت هم import می‌شود. ثبت و ویرایش مراجع در `actions.ts` است.
 */
export type { PatientFormErrors } from "@/modules/appointments/data";

/** نوع بیمه خالی است؛ فرم مراجع تازه پیش‌فرضش را از فهرست `insurance_types` می‌گیرد (`defaultInsuranceName`). */
export const EMPTY_PATIENT_FORM: PatientFormInput = {
  full_name: "",
  mobile: "",
  national_id: "",
  birth_date: "",
  gender: "",
  insurance_type_name: "",
};

/** عبارتی که پس از یکدست‌سازی چیزی برای جست‌وجو نمی‌ماند (خالی، فقط فاصله یا فقط علامت) جست‌وجو حساب نمی‌شود. */
export function hasPatientQuery(query: string): boolean {
  return parseQuery(query) !== null;
}

/** جست‌وجوی خالی همهٔ مراجعان را به ترتیب حروف الفبا برمی‌گرداند؛ جست‌وجوی پرشده نتیجه‌ها را به ترتیب شباهت نام. */
export function listPatients(snapshot: AppointmentSnapshot, query: string): Patient[] {
  if (!hasPatientQuery(query)) {
    return [...snapshot.patients].sort((left, right) => left.full_name.localeCompare(right.full_name, "fa"));
  }
  return searchPatients(snapshot, query);
}

export function getPatientById(snapshot: AppointmentSnapshot, patientId: string): Patient | null {
  return snapshot.patients.find((patient) => patient.id === patientId) ?? null;
}

/** نوبت‌های وصل‌شده به این مراجع (هر وضعیتی)، جدیدترین اول. */
export function getPatientAppointments(snapshot: AppointmentSnapshot, patientId: string): AppointmentWithPatient[] {
  return snapshot.appointments.filter((appointment) => appointment.patient_id === patientId).sort(newestFirst);
}

/** مقدار اولیهٔ فرم ویرایش: تاریخ تولد از میلادیِ ذخیره‌شده به «روز/ماه/سال» شمسی برمی‌گردد. */
export function patientToFormInput(patient: Patient): PatientFormInput {
  const birth = patient.birth_date ? gregorianToJalali(patient.birth_date) : null;
  return {
    full_name: patient.full_name,
    mobile: patient.mobile ?? "",
    national_id: patient.national_id,
    birth_date: birth
      ? composeBirthDate({ day: String(birth.day), month: String(birth.month), year: String(birth.year) })
      : "",
    gender: patient.gender ?? "",
    insurance_type_name: patient.insurance_type_name,
  };
}
