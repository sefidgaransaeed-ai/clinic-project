import {
  addDays,
  appointmentDateKey,
  appointmentLocalTime,
  toLatinDigits,
} from "./date";
import {
  createMockData,
  mockWorkingDays,
} from "./mock";
import type {
  Appointment,
  AppointmentSnapshot,
  AppointmentStatus,
  Closure,
  MutationResult,
  NewPatientInput,
  Patient,
} from "./types";

let patients: Patient[] = [];
let appointments: Appointment[] = [];
let closures: Closure[] = [];
let hasInitialisedMockData = false;
const listeners = new Set<() => void>();

export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["arrived", "no_show", "cancelled"],
  arrived: ["done"],
  done: [],
  no_show: [],
  cancelled: [],
};

function createSnapshot(): AppointmentSnapshot {
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  return {
    appointments: [...appointments]
      .map((appointment) => ({
        ...appointment,
        patient: appointment.patient_id ? patientsById.get(appointment.patient_id) ?? null : null,
      }))
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at)),
    patients: [...patients],
  };
}

let currentSnapshot = createSnapshot();

function publish() {
  currentSnapshot = createSnapshot();
  listeners.forEach((listener) => listener());
}

export function subscribeToAppointments(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppointmentsSnapshot() {
  return currentSnapshot;
}

/** Initializes the in-memory demo only after the browser has mounted. */
export function initializeMockAppointments(today: string) {
  if (hasInitialisedMockData) {
    return;
  }

  const mockData = createMockData(today);
  patients = mockData.patients;
  appointments = mockData.appointments;
  closures = mockData.closures;
  hasInitialisedMockData = true;
  publish();
}

export function getTodayAppointments(snapshot: AppointmentSnapshot, today: string) {
  return snapshot.appointments.filter((appointment) => appointmentDateKey(appointment.starts_at) === today);
}

export function getRequestedAppointments(snapshot: AppointmentSnapshot) {
  return snapshot.appointments.filter((appointment) => appointment.status === "requested");
}

export function getCalendarAppointments(snapshot: AppointmentSnapshot, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  return snapshot.appointments.filter((appointment) => {
    const dateKey = appointmentDateKey(appointment.starts_at);
    return appointment.status === "confirmed" && dateKey >= weekStart && dateKey <= weekEnd;
  });
}

export function getClinicWorkingDays() {
  return mockWorkingDays;
}

export function getClosureForDate(dateKey: string): Closure | undefined {
  return closures.find((closure) => closure.date === dateKey);
}

export function getAppointmentSlots() {
  const slots: string[] = [];
  for (let minutes = 11 * 60; minutes < 17 * 60; minutes += 15) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return slots;
}

export function getAllowedStatusTransitions(status: AppointmentStatus) {
  return STATUS_TRANSITIONS[status];
}

export function updateAppointmentStatus(
  appointmentId: string,
  nextStatus: AppointmentStatus,
): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);

  if (!appointment) {
    return { ok: false, message: "نوبت موردنظر پیدا نشد." };
  }

  if (!STATUS_TRANSITIONS[appointment.status].includes(nextStatus)) {
    return { ok: false, message: "این تغییر وضعیت در چرخهٔ نوبت مجاز نیست." };
  }

  appointments = appointments.map((item) =>
    item.id === appointmentId ? { ...item, status: nextStatus } : item,
  );
  publish();
  return { ok: true, message: "وضعیت نوبت به‌روزرسانی شد." };
}

export function searchPatients(snapshot: AppointmentSnapshot, query: string) {
  const normalizedQuery = toLatinDigits(query).trim().toLocaleLowerCase("fa-IR");
  if (!normalizedQuery) {
    return snapshot.patients.slice(0, 6);
  }

  return snapshot.patients.filter((patient) =>
    [patient.full_name, patient.mobile, patient.national_id]
      .map((value) => toLatinDigits(value).toLocaleLowerCase("fa-IR"))
      .some((value) => value.includes(normalizedQuery)),
  );
}

function validatePatientFields(input: NewPatientInput): MutationResult {
  if (!input.full_name.trim()) {
    return { ok: false, message: "نام و نام خانوادگی را وارد کنید." };
  }

  if (!/^09\d{9}$/.test(toLatinDigits(input.mobile))) {
    return { ok: false, message: "شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد." };
  }

  if (!/^\d{10}$/.test(toLatinDigits(input.national_id))) {
    return { ok: false, message: "کد ملی باید ۱۰ رقم باشد." };
  }

  return { ok: true, message: "" };
}

function validateNewPatient(input: NewPatientInput): MutationResult {
  const fields = validatePatientFields(input);
  if (!fields.ok) {
    return fields;
  }

  if (patients.some((patient) => patient.national_id === toLatinDigits(input.national_id))) {
    return { ok: false, message: "مراجعی با این کد ملی از قبل وجود دارد." };
  }

  return { ok: true, message: "" };
}

function createPatient(input: NewPatientInput): Patient {
  const patient: Patient = {
    id: `patient-local-${Date.now()}`,
    full_name: input.full_name.trim(),
    mobile: toLatinDigits(input.mobile),
    national_id: toLatinDigits(input.national_id),
    insurance_type_name: "آزاد",
  };
  patients = [...patients, patient];
  return patient;
}

export function confirmRequestedAppointment(
  appointmentId: string,
  input: { patientId?: string; newPatient?: NewPatientInput },
): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: "این درخواست دیگر قابل تأیید نیست." };
  }

  let patient: Patient | undefined;
  if (input.patientId) {
    patient = patients.find((item) => item.id === input.patientId);
  } else if (input.newPatient) {
    const validation = validateNewPatient(input.newPatient);
    if (!validation.ok) {
      return validation;
    }
    patient = createPatient(input.newPatient);
  }

  if (!patient) {
    return { ok: false, message: "یک مراجع موجود را انتخاب یا مراجع جدیدی ثبت کنید." };
  }

  appointments = appointments.map((item) =>
    item.id === appointmentId
      ? {
          ...item,
          patient_id: patient.id,
          requester_name: patient.full_name,
          requester_mobile: patient.mobile,
          status: "confirmed",
          note: "تأییدشده در نسخهٔ نمایشی",
        }
      : item,
  );
  publish();
  return { ok: true, message: "درخواست نوبت با موفقیت تأیید شد." };
}

/** درخواست سایتی که منشی رد کرده و هیچ‌وقت به مراجعی وصل نشده است. */
function isRejectedRequest(appointment: Appointment) {
  return (
    appointment.status === "cancelled" &&
    appointment.source === "site" &&
    appointment.patient_id === null
  );
}

export function getRejectedRequests(snapshot: AppointmentSnapshot) {
  return snapshot.appointments.filter(isRejectedRequest);
}

export function rejectRequestedAppointment(appointmentId: string): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: "این درخواست دیگر قابل رد کردن نیست." };
  }

  return updateAppointmentStatus(appointmentId, "cancelled");
}

/** درخواست ردشده را به همان وضعیت «درخواست جدید» برمی‌گرداند. */
export function restoreRejectedRequest(appointmentId: string): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || !isRejectedRequest(appointment)) {
    return { ok: false, message: "این درخواست قابل بازگرداندن نیست." };
  }

  appointments = appointments.map((item) =>
    item.id === appointmentId ? { ...item, status: "requested" } : item,
  );
  publish();
  return { ok: true, message: "درخواست به وضعیت «درخواست جدید» برگشت." };
}

/** نتیجهٔ بررسی مراجع پیش از ثبت نوبت دستی. */
export type ManualPatientCheck =
  | { kind: "invalid"; message: string }
  | { kind: "same_national_id"; patient: Patient }
  | { kind: "similar"; candidates: Patient[] }
  | { kind: "new" };

/** قالب فیلدها را می‌سنجد، سپس مراجع هم‌کدملی یا مشابه (هم‌موبایل یا هم‌نام) را پیدا می‌کند. */
export function checkManualPatient(input: NewPatientInput): ManualPatientCheck {
  const fields = validatePatientFields(input);
  if (!fields.ok) {
    return { kind: "invalid", message: fields.message };
  }

  const sameNationalId = findPatientByNationalId(input.national_id, patients);
  if (sameNationalId) {
    return { kind: "same_national_id", patient: sameNationalId };
  }

  const mobile = normalizeMobile(input.mobile);
  const candidates = patients.filter(
    (patient) =>
      normalizeMobile(patient.mobile) === mobile || namesAreSimilar(patient.full_name, input.full_name),
  );
  return candidates.length > 0 ? { kind: "similar", candidates } : { kind: "new" };
}

export function createManualAppointment(input: {
  dateKey: string;
  time: string;
  patient: NewPatientInput;
  patientId?: string;
}): MutationResult {
  const closure = getClosureForDate(input.dateKey);
  if (closure) {
    return { ok: false, message: `این روز تعطیل است: ${closure.reason}` };
  }

  const existingAppointment = appointments.find(
    (appointment) =>
      appointmentDateKey(appointment.starts_at) === input.dateKey &&
      appointmentLocalTime(appointment.starts_at) === input.time &&
      ["confirmed", "arrived", "done"].includes(appointment.status),
  );

  if (existingAppointment) {
    return { ok: false, message: "این بازه پیش‌تر به نوبت دیگری داده شده است." };
  }

  let patient: Patient | undefined;
  if (input.patientId) {
    patient = patients.find((item) => item.id === input.patientId);
    if (!patient) {
      return { ok: false, message: "این مراجع پیدا نشد. فهرست را دوباره بررسی کنید." };
    }
  } else {
    const validation = validateNewPatient(input.patient);
    if (!validation.ok) {
      return validation;
    }
    patient = createPatient(input.patient);
  }

  appointments = [
    ...appointments,
    {
      id: `appointment-local-${Date.now()}`,
      patient_id: patient.id,
      requester_name: patient.full_name,
      requester_mobile: patient.mobile,
      starts_at: `${input.dateKey}T${input.time}:00+03:30`,
      ends_at: `${input.dateKey}T${getEndTime(input.time)}:00+03:30`,
      status: "confirmed",
      source: "panel",
      created_by: "mock-secretary",
      note: "نوبت دستی در نسخهٔ نمایشی",
    },
  ];
  publish();
  return { ok: true, message: "نوبت دستی ثبت شد." };
}

function getEndTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const end = hour * 60 + minute + 15;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(
    2,
    "0",
  )}`;
}


import { findPatientByNationalId, findPatientForRequest, namesAreSimilar, normalizeMobile } from "./patient-match";

/** تأیید خودکار: مراجع را از روی موبایل و نام پیدا یا می‌سازد. */
export function autoConfirmRequestedAppointment(appointmentId: string): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: "این درخواست دیگر قابل تأیید نیست." };
  }

  const match = findPatientForRequest(
    appointment.requester_name,
    appointment.requester_mobile,
    patients,
  );

  if (match.kind === "match") {
    return confirmRequestedAppointment(appointmentId, { patientId: match.patient.id });
  }

  if (match.kind === "choose") {
    return {
      ok: false,
      message: "چند مراجع با این موبایل ثبت شده است؛ لطفاً یکی را انتخاب کنید.",
    };
  }

  const mobile = normalizeMobile(appointment.requester_mobile);
  if (!appointment.requester_name.trim() || !mobile) {
    return { ok: false, message: "نام یا موبایل درخواست معتبر نیست؛ مراجع را دستی ثبت کنید." };
  }

  const patient = createPatient({
    full_name: appointment.requester_name,
    mobile,
    national_id: "",
  });
  return confirmRequestedAppointment(appointmentId, { patientId: patient.id });
}