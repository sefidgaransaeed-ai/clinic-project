import { addDays, getWeekStart, makeTehranDateTime } from "./date";
import type { Appointment, Closure, Patient, WorkingDay } from "./types";

const fictionalPatientNames = [
  "نگار مرادی",
  "فرهاد نادری",
  "سارا اکبری",
  "کیان رحمانی",
  "الهام نوری",
  "رضا امینی",
  "آوا کریمی",
  "پویان صادقی",
  "مریم حسینی",
  "نوید شریفی",
  "نازنین بهرامی",
  "یاسر توکلی",
  "رها موسوی",
  "میلاد رستمی",
  "پریسا کاظمی",
  "امیرحسین فلاح",
];

/** All names, identifiers, and mobile numbers in this file are fictional. */
const mockPatients: Patient[] = fictionalPatientNames.map((full_name, index) => ({
  id: `patient-${index + 1}`,
  full_name,
  mobile: `0990${String(index + 1).padStart(7, "0")}`,
  national_id: String(1000000000 + index),
  insurance_type_name: index % 3 === 0 ? "تأمین اجتماعی" : index % 3 === 1 ? "آزاد" : "سلامت",
}));

export const mockWorkingDays: WorkingDay[] = [
  { weekday: 6, label: "شنبه", start_time: "11:00", end_time: "17:00" },
  { weekday: 3, label: "چهارشنبه", start_time: "11:00", end_time: "17:00" },
];

function plusMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

function patientFor(index: number) {
  return mockPatients[index % mockPatients.length];
}

function patientAppointment(
  id: string,
  date: string,
  time: string,
  status: Appointment["status"],
  patientIndex: number,
  note: string | null = null,
): Appointment {
  const patient = patientFor(patientIndex);
  return {
    id,
    patient_id: patient.id,
    requester_name: patient.full_name,
    requester_mobile: patient.mobile,
    starts_at: makeTehranDateTime(date, time),
    ends_at: makeTehranDateTime(date, plusMinutes(time, 15)),
    status,
    source: "panel",
    created_by: "mock-secretary",
    note,
  };
}

function requestedAppointment(
  id: string,
  date: string,
  time: string,
  requester_name: string,
  requester_mobile: string,
): Appointment {
  return {
    id,
    patient_id: null,
    requester_name,
    requester_mobile,
    starts_at: makeTehranDateTime(date, time),
    ends_at: makeTehranDateTime(date, plusMinutes(time, 15)),
    status: "requested",
    source: "site",
    created_by: "public-site",
    note: "درخواست ثبت‌شده از سایت (دادهٔ ساختگی)",
  };
}

/**
 * Builds a fresh, date-relative data set after the client has mounted.
 * Keeping this factory free of current-time reads lets Next.js prerender the
 * client boundary safely while still making the demo useful on the current day.
 */
export function createMockData(today: string): {
  appointments: Appointment[];
  closures: Closure[];
  patients: Patient[];
} {
  const currentWeekStart = getWeekStart(today);
  const saturday = currentWeekStart;
  const wednesday = addDays(currentWeekStart, 4);
  const closures: Closure[] = [
    {
      date: wednesday,
      reason: "مرخصی برنامه‌ریزی‌شده پزشک",
    },
  ];

  const appointments: Appointment[] = [
  patientAppointment("appointment-01", today, "11:00", "confirmed", 0, "کنترل دوره‌ای"),
  patientAppointment("appointment-02", today, "11:15", "confirmed", 1),
  patientAppointment("appointment-03", today, "11:30", "arrived", 2, "ارجاع از پزشک عمومی"),
  patientAppointment("appointment-04", today, "11:45", "done", 3),
  patientAppointment("appointment-05", today, "12:00", "no_show", 4),
  patientAppointment("appointment-06", today, "12:15", "cancelled", 5, "لغو توسط مراجع"),
  patientAppointment("appointment-07", today, "12:30", "confirmed", 6),
  patientAppointment("appointment-08", today, "12:45", "confirmed", 7),

  requestedAppointment("appointment-09", addDays(today, 1), "11:00", "لیلا مهربان", "09901111111"),
  requestedAppointment("appointment-10", addDays(today, 1), "11:15", "سامان فرهمند", "09902222222"),
  requestedAppointment("appointment-11", addDays(today, 2), "12:00", "مهسا پارسا", "09903333333"),
  requestedAppointment("appointment-12", addDays(today, 3), "13:15", "بهنام فروغی", "09904444444"),
  requestedAppointment("appointment-13", addDays(today, 5), "14:00", "نسترن صبوری", "09905555555"),

  patientAppointment("appointment-14", saturday, "13:00", "confirmed", 8),
  patientAppointment("appointment-15", saturday, "13:15", "confirmed", 9),
  patientAppointment("appointment-16", saturday, "13:30", "confirmed", 10),
  patientAppointment("appointment-17", saturday, "14:00", "confirmed", 11),
  patientAppointment("appointment-18", saturday, "14:15", "confirmed", 12),
  patientAppointment("appointment-19", saturday, "14:45", "confirmed", 13),
  patientAppointment("appointment-20", wednesday, "13:00", "confirmed", 14),
  patientAppointment("appointment-21", wednesday, "13:15", "confirmed", 15),
  patientAppointment("appointment-22", wednesday, "13:45", "confirmed", 0),
  patientAppointment("appointment-23", wednesday, "14:00", "confirmed", 1),
  patientAppointment("appointment-24", wednesday, "14:30", "confirmed", 2),
  patientAppointment("appointment-25", wednesday, "15:00", "confirmed", 3),

  patientAppointment("appointment-26", addDays(saturday, -7), "11:00", "done", 4),
  patientAppointment("appointment-27", addDays(saturday, -7), "11:15", "done", 5),
  patientAppointment("appointment-28", addDays(saturday, -3), "12:30", "cancelled", 6),
  patientAppointment("appointment-29", addDays(wednesday, 7), "15:30", "confirmed", 7),
  patientAppointment("appointment-30", addDays(wednesday, 7), "15:45", "confirmed", 8),
  patientAppointment("appointment-31", addDays(wednesday, 7), "16:15", "confirmed", 9),
  ];

  return {
    appointments,
    closures,
    patients: mockPatients.map((patient) => ({ ...patient })),
  };
}
