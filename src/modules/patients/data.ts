import {
  addPatient,
  getAppointmentsSnapshot,
  getAppointmentsVersion,
  initializeMockAppointments,
  subscribeToAppointments,
  updatePatient,
} from "@/modules/appointments/data";
import { gregorianToJalali } from "@/modules/appointments/date";
import { DEFAULT_INSURANCE_TYPE_NAME } from "@/modules/appointments/mock";
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
 * خواندن و نوشتن داده‌های مراجعان. فعلاً مراجعان در همان انبار ساختگیِ ماژول نوبت نگه داشته می‌شوند
 * (هر نوبت به مراجعش وصل است)، پس اتصال به پایگاه داده فقط همین فایل و آن انبار را عوض می‌کند.
 */
export { addPatient, updatePatient };
export type { PatientFormErrors, SavePatientResult } from "@/modules/appointments/data";
export { INSURANCE_TYPE_NAMES } from "@/modules/appointments/mock";

export const subscribeToPatients = subscribeToAppointments;
export const getPatientsSnapshot = getAppointmentsSnapshot;
/** `0` یعنی داده‌های ساختگی هنوز ساخته نشده‌اند. */
export const getPatientsVersion = getAppointmentsVersion;
export const initializePatients = initializeMockAppointments;

export const EMPTY_PATIENT_FORM: PatientFormInput = {
  full_name: "",
  mobile: "",
  national_id: "",
  birth_date: "",
  gender: "",
  insurance_type_name: DEFAULT_INSURANCE_TYPE_NAME,
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
