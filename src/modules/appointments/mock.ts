import { addDays, getWeekday, getWeekStart, makeTehranDateTime } from "./date";
import type { Appointment, Closure, Patient, PatientGender, WorkingDay } from "./types";

interface MockPatientSeed {
  full_name: string;
  gender: PatientGender | null;
  birth_date: string | null;
  hasMobile: boolean;
}

/** مراجع‌های ۱۷ و ۱۸ موبایل ندارند و نوبتی هم ندارند؛ فقط برای آزمودن تطبیق با کد ملی‌اند. */
const mockPatientSeeds: MockPatientSeed[] = [
  { full_name: "نگار مرادی", gender: "female", birth_date: "1988-03-12", hasMobile: true },
  { full_name: "فرهاد نادری", gender: "male", birth_date: "1975-11-04", hasMobile: true },
  { full_name: "سارا اکبری", gender: "female", birth_date: null, hasMobile: true },
  { full_name: "کیان رحمانی", gender: "male", birth_date: "2001-07-21", hasMobile: true },
  { full_name: "الهام نوری", gender: "female", birth_date: "1992-01-30", hasMobile: true },
  { full_name: "رضا امینی", gender: "male", birth_date: "1969-05-17", hasMobile: true },
  { full_name: "آوا کریمی", gender: "female", birth_date: "2010-09-09", hasMobile: true },
  { full_name: "پویان صادقی", gender: null, birth_date: "1984-12-25", hasMobile: true },
  { full_name: "مریم حسینی", gender: "female", birth_date: "1979-04-02", hasMobile: true },
  { full_name: "نوید شریفی", gender: "male", birth_date: null, hasMobile: true },
  { full_name: "نازنین بهرامی", gender: "female", birth_date: "1996-08-14", hasMobile: true },
  { full_name: "یاسر توکلی", gender: "male", birth_date: "1990-02-27", hasMobile: true },
  { full_name: "رها موسوی", gender: "female", birth_date: "1983-10-06", hasMobile: true },
  { full_name: "میلاد رستمی", gender: "male", birth_date: "1998-06-19", hasMobile: true },
  { full_name: "پریسا کاظمی", gender: "female", birth_date: null, hasMobile: true },
  { full_name: "امیرحسین فلاح", gender: "male", birth_date: "1972-03-08", hasMobile: true },
  { full_name: "ندا قربانی", gender: "female", birth_date: "1995-09-02", hasMobile: false },
  { full_name: "کامران عزیزی", gender: "male", birth_date: null, hasMobile: false },
];

/** All names, identifiers, and mobile numbers in this file are fictional. */
const mockPatients: Patient[] = mockPatientSeeds.map(({ full_name, gender, birth_date, hasMobile }, index) => ({
  id: `patient-${index + 1}`,
  full_name,
  mobile: hasMobile ? `0990${String(index + 1).padStart(7, "0")}` : null,
  national_id: String(1000000000 + index),
  birth_date,
  gender,
  insurance_type_name: index % 3 === 0 ? "تأمین اجتماعی" : index % 3 === 1 ? "آزاد" : "سلامت",
}));

/** Every working day uses Saturday's hours. Thursday and Friday are weekly days off. */
const workingHours = { start_time: "11:00", end_time: "17:00" };

export const mockWorkingDays: WorkingDay[] = [
  { weekday: 6, label: "شنبه", ...workingHours },
  { weekday: 0, label: "یکشنبه", ...workingHours },
  { weekday: 1, label: "دوشنبه", ...workingHours },
  { weekday: 2, label: "سه‌شنبه", ...workingHours },
  { weekday: 3, label: "چهارشنبه", ...workingHours },
];

/** Wednesday 29 Mehr 1405: the sample holiday (a single day, not a range). */
const sampleHolidayDate = "2026-10-21";

function isWorkingDate(dateKey: string) {
  return (
    dateKey !== sampleHolidayDate &&
    mockWorkingDays.some((day) => day.weekday === getWeekday(dateKey))
  );
}

/** Moves a date forward (step 1) or backward (step -1) until it is a working day. */
function toWorkingDate(dateKey: string, step: 1 | -1) {
  let result = dateKey;
  while (!isWorkingDate(result)) {
    result = addDays(result, step);
  }
  return result;
}

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
  durationMinutes = 15,
): Appointment {
  const patient = patientFor(patientIndex);
  return {
    id,
    patient_id: patient.id,
    requester_name: patient.full_name,
    // شمارهٔ تماس هیچ نوبتی خالی نیست؛ مراجعِ بی‌موبایل یک شمارهٔ ساختگیِ جدا دارد.
    requester_mobile: patient.mobile ?? `0991${patient.id.replace(/\D/g, "").padStart(7, "0")}`,
    requested_for_self: true,
    starts_at: makeTehranDateTime(date, time),
    ends_at: makeTehranDateTime(date, plusMinutes(time, durationMinutes)),
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
  requester_national_id: string,
  requested_for_self: boolean,
): Appointment {
  return {
    id,
    patient_id: null,
    requester_name,
    requester_mobile,
    requester_national_id,
    requested_for_self,
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
  // Appointments may only fall on working days: dates that land on a day off or
  // on the sample holiday are moved to the nearest working day.
  const weekFirstDay = toWorkingDate(currentWeekStart, 1);
  const weekLastDay = toWorkingDate(addDays(currentWeekStart, 4), -1);
  const previousWeekFirstDay = toWorkingDate(addDays(currentWeekStart, -7), -1);
  const previousWeekLastDay = toWorkingDate(addDays(currentWeekStart, -3), -1);
  const nextWeekLastDay = toWorkingDate(addDays(currentWeekStart, 11), -1);
  const upcomingDay = (days: number) => toWorkingDate(addDays(today, days), 1);
  const closures: Closure[] = [
    {
      date: sampleHolidayDate,
      reason: "مرخصی برنامه‌ریزی‌شده پزشک",
    },
  ];

  const todayAppointments: Appointment[] = isWorkingDate(today)
    ? [
        patientAppointment("appointment-01", today, "11:00", "confirmed", 0, "کنترل دوره‌ای"),
        patientAppointment("appointment-02", today, "11:15", "confirmed", 1),
        patientAppointment("appointment-03", today, "11:30", "arrived", 2, "ارجاع از پزشک عمومی"),
        patientAppointment("appointment-04", today, "11:45", "done", 3),
        patientAppointment("appointment-05", today, "12:00", "no_show", 4),
        patientAppointment("appointment-06", today, "12:15", "cancelled", 5, "لغو توسط مراجع"),
        patientAppointment("appointment-07", today, "12:30", "confirmed", 6),
        patientAppointment("appointment-08", today, "12:45", "confirmed", 7),
      ]
    : [];

  const appointments: Appointment[] = [
    ...todayAppointments,

    // کد ملی تازه + موبایل آزاد، برای خودش: مراجع جدید با همین موبایل ساخته می‌شود.
    requestedAppointment("appointment-09", upcomingDay(1), "11:00", "لیلا مهربان", "09901111111", "3000000011", true),
    // برای شخص دیگر: مراجع جدید ساخته می‌شود ولی موبایل درخواست به او نمی‌رسد.
    requestedAppointment("appointment-10", upcomingDay(1), "11:15", "سامان فرهمند", "09902222222", "3000000021", false),
    // کد ملی «سارا اکبری» (patient-3) با نامی که فقط ترتیبش فرق دارد: نام مشابه است و خودکار وصل می‌شود.
    requestedAppointment("appointment-11", upcomingDay(2), "12:00", "اکبری سارا", "09903333333", "1000000002", true),
    // عمداً کد ملی «الهام نوری» (patient-5) با نام دیگر: مسدود می‌شود و پیام «کد ملی مال مراجع دیگری است» می‌آید.
    requestedAppointment("appointment-12", upcomingDay(3), "15:15", "بهنام فروغی", "09904444444", "1000000004", true),
    // کد ملی تازه، ولی موبایل «امیرحسین فلاح» (patient-16): تأیید می‌شود ولی موبایل در پروندهٔ مراجع تازه ذخیره نمی‌شود.
    requestedAppointment("appointment-13", upcomingDay(5), "14:00", "نسترن صبوری", "09900000016", "3000000046", true),
    // دو درخواست با کد ملی «ندا قربانی» (patient-17) که موبایل ندارد، با دو شکل نوشتن نام (ترتیب و «ی» عربی):
    // هر دو به همان یک مراجع وصل می‌شوند.
    requestedAppointment("appointment-32", upcomingDay(2), "16:00", "قربانی ندا", "09906666666", "1000000016", true),
    requestedAppointment("appointment-33", upcomingDay(3), "16:30", "ندا قرباني", "09907777777", "1000000016", true),

    patientAppointment("appointment-14", weekFirstDay, "13:00", "confirmed", 8),
    patientAppointment("appointment-15", weekFirstDay, "13:15", "confirmed", 9),
    // نوبت ۳۰ دقیقه‌ای: ۱۳:۳۰ تا ۱۴:۰۰؛ نوبت بعدی درست ۱۴:۰۰ شروع می‌شود.
    patientAppointment("appointment-16", weekFirstDay, "13:30", "confirmed", 10, null, 30),
    patientAppointment("appointment-17", weekFirstDay, "14:00", "confirmed", 11),
    patientAppointment("appointment-18", weekFirstDay, "14:15", "confirmed", 12),
    patientAppointment("appointment-19", weekFirstDay, "14:45", "confirmed", 13),
    patientAppointment("appointment-20", weekLastDay, "13:00", "confirmed", 14),
    patientAppointment("appointment-21", weekLastDay, "13:15", "confirmed", 15),
    patientAppointment("appointment-22", weekLastDay, "13:45", "confirmed", 0),
    patientAppointment("appointment-23", weekLastDay, "14:00", "confirmed", 1),
    // نوبت ۳۰ دقیقه‌ای: ۱۴:۳۰ تا ۱۵:۰۰؛ نوبت بعدی درست ۱۵:۰۰ شروع می‌شود.
    patientAppointment("appointment-24", weekLastDay, "14:30", "confirmed", 2, null, 30),
    patientAppointment("appointment-25", weekLastDay, "15:00", "confirmed", 3),

    patientAppointment("appointment-26", previousWeekFirstDay, "11:00", "done", 4),
    patientAppointment("appointment-27", previousWeekFirstDay, "11:15", "done", 5),
    patientAppointment("appointment-28", previousWeekLastDay, "12:30", "cancelled", 6),
    patientAppointment("appointment-29", nextWeekLastDay, "15:30", "confirmed", 7),
    patientAppointment("appointment-30", nextWeekLastDay, "15:45", "confirmed", 8),
    patientAppointment("appointment-31", nextWeekLastDay, "16:15", "confirmed", 9),
  ];

  return {
    appointments,
    closures,
    patients: mockPatients.map((patient) => ({ ...patient })),
  };
}
