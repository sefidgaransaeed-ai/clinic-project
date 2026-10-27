import {
  addDays,
  appointmentDateKey,
  formatAppointmentTime,
  getWeekday,
  makeTehranDateTime,
  toLatinDigits,
} from "./date";
import {
  createMockData,
  mockWorkingDays,
} from "./mock";
import {
  cleanMobile,
  cleanNationalId,
  MOBILE_MESSAGES,
  NATIONAL_ID_MESSAGES,
  validateMobile,
  validateNationalId,
} from "./patient-validation";
import { searchAppointments } from "./search";
import {
  appointmentRange,
  MANUAL_DURATION_OPTIONS,
  minutesToTime,
  rangesOverlap,
  slotRange,
  SLOT_MINUTES,
  timeToMinutes,
  type TimeRange,
} from "./slots";
import type {
  Appointment,
  AppointmentSnapshot,
  AppointmentStatus,
  Closure,
  MutationResult,
  NewPatientInput,
  Patient,
} from "./types";

/** تا پایان این‌همه روزِ تقویمی پس از روز نوبت می‌شود وضعیتش را عوض کرد؛ هم‌ارز app_settings.past_edit_days در مدل داده. */
export const PAST_EDIT_DAYS = 7;

/** متن مصوب برند (معیار A-09 در docs/brand-voice.md). */
export const PAST_EDIT_LOCKED_MESSAGE =
  "وضعیت نوبت‌های قدیمی‌تر از ۷ روز قابل تغییر نیست. برای اصلاح با پزشک هماهنگ کنید.";

/** پیام «بازه پر است» برای تغییر وضعیت نوبت، که منشی می‌تواند بازهٔ دیگری را از تقویم بگیرد؛ بدون نام و ساعت. */
export const SLOT_TAKEN_MESSAGE =
  "این بازه قبلاً به فرد دیگری داده شده است. لطفاً بازهٔ خالی دیگری را در تقویم هفتگی انتخاب کنید.";

/** هم‌پوشانی در ثبت دستی؛ منشی می‌تواند ساعت شروع یا مدت را عوض کند. بدون نام و ساعتِ نوبت دیگر. */
export const MANUAL_OVERLAP_MESSAGE =
  "این مدت با نوبت دیگری هم‌پوشانی دارد. ساعت شروع دیگری انتخاب کنید یا مدت را کمتر کنید.";

const MANUAL_DURATION_MESSAGE = "مدت نوبت باید ۱۵، ۳۰، ۴۵ یا ۶۰ دقیقه باشد. یکی از گزینه‌ها را انتخاب کنید.";

const MANUAL_START_MESSAGE = "این ساعت شروع پذیرفته نمی‌شود. یکی از ساعت‌های فهرست را انتخاب کنید.";

const NOT_WORKING_DAY_MESSAGE = "این روز جزو روزهای کاری مطب نیست. یک روز کاری انتخاب کنید.";

/** نوبتی که از ساعت پایان همان روز بیرون می‌زند؛ ساعت پایان از تنظیمات ساعت کاریِ همان روز می‌آید. */
function outsideWorkingHoursMessage(dateKey: string, closingTime: string) {
  const closing = formatAppointmentTime(makeTehranDateTime(dateKey, closingTime));
  return `این نوبت از ساعت کاری مطب بیرون می‌زند؛ ساعت کاری آن روز تا ${closing} است. ساعت شروع زودتر یا مدت کمتری انتخاب کنید.`;
}

/** «بازه پر است» هنگام تأیید درخواست سایت؛ زمان درخواست را نمی‌شود جابه‌جا کرد، پس راه‌حل رد یا هماهنگی است. */
export const REQUEST_SLOT_TAKEN_MESSAGE =
  "این بازه قبلاً پر شده است. این درخواست را رد کنید یا با مراجع برای زمان دیگری هماهنگ کنید.";

/** «بازه پر است» هنگام بازگرداندن درخواست ردشده؛ درخواست همچنان لغوشده می‌ماند. */
export const RESTORE_SLOT_TAKEN_MESSAGE =
  "این بازه قبلاً پر شده است. این درخواست همچنان لغوشده می‌ماند؛ با مراجع برای زمان دیگری هماهنگ کنید.";

/** درخواستی که دیگر در انتظار نیست (قبلاً تأیید یا رد شده) را نمی‌شود دوباره تأیید کرد. */
const REQUEST_NOT_PENDING_MESSAGE =
  "این درخواست دیگر در انتظار تأیید نیست. فهرست را تازه کنید و وضعیت فعلی‌اش را ببینید.";

let patients: Patient[] = [];
let appointments: Appointment[] = [];
let closures: Closure[] = [];
let hasInitialisedMockData = false;
/** همان «امروز»ی که به `initializeMockAppointments` داده شده؛ مرجع قاعدهٔ مهلت تغییر وضعیت. */
let clinicToday: string | null = null;
const listeners = new Set<() => void>();

/** وضعیت‌هایی که منشی تا ۷ روز پس از نوبت می‌تواند بینشان جابه‌جا شود، به ترتیب نمایش. */
export const SELECTABLE_STATUSES: AppointmentStatus[] = [
  "confirmed",
  "arrived",
  "done",
  "no_show",
  "cancelled",
];

/** این وضعیت‌ها ساعت را اشغال می‌کنند؛ مطابق قید هم‌پوشانی در مدل داده. */
const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = ["confirmed", "arrived", "done"];

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
  clinicToday = today;
  patients = mockData.patients;
  appointments = mockData.appointments;
  closures = mockData.closures;
  hasInitialisedMockData = true;
  publish();
}

export function getDayAppointments(snapshot: AppointmentSnapshot, dateKey: string) {
  return snapshot.appointments.filter((appointment) => appointmentDateKey(appointment.starts_at) === dateKey);
}

export function getRequestedAppointments(snapshot: AppointmentSnapshot) {
  return snapshot.appointments.filter((appointment) => appointment.status === "requested");
}

export function getCalendarAppointments(snapshot: AppointmentSnapshot, weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  return snapshot.appointments.filter((appointment) => {
    const dateKey = appointmentDateKey(appointment.starts_at);
    return SLOT_BLOCKING_STATUSES.includes(appointment.status) && dateKey >= weekStart && dateKey <= weekEnd;
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

export function getSelectableStatuses() {
  return SELECTABLE_STATUSES;
}

/** ساعت کاریِ همان روز از تنظیمات ساعت کاری (به دقیقه از نیمه‌شب)، یا `null` اگر آن روز کاری نیست. */
function getWorkingWindow(dateKey: string) {
  const day = getClinicWorkingDays().find((item) => item.weekday === getWeekday(dateKey));
  if (!day) {
    return null;
  }
  return { start: timeToMinutes(day.start_time), end: timeToMinutes(day.end_time), closingTime: day.end_time };
}

/**
 * ساعت‌های شروعِ آزاد در یک روز برای نوبتی به مدت `durationMinutes`: خانه‌هایی که کل نوبت داخل ساعت کاری
 * همان روز جا می‌شود و با هیچ نوبتِ فعالی هم‌پوشانی ندارد. روز تعطیل یا غیرکاری فهرست خالی دارد.
 * فقط ساعت برمی‌گرداند، نه اطلاعات نوبت‌ها؛ فرم عمومی بعداً همین را به جای `available_slots` می‌خواند.
 */
export function getFreeStartTimes(
  snapshot: AppointmentSnapshot,
  dateKey: string,
  durationMinutes: number = SLOT_MINUTES,
) {
  const hours = getWorkingWindow(dateKey);
  if (!hours || getClosureForDate(dateKey)) {
    return [];
  }

  const activeRanges = snapshot.appointments
    .filter((item) => SLOT_BLOCKING_STATUSES.includes(item.status))
    .map(appointmentRange);

  return getAppointmentSlots().filter((time) => {
    const start = timeToMinutes(time);
    return (
      start >= hours.start &&
      start + durationMinutes <= hours.end &&
      !activeRanges.some((range) => rangesOverlap(slotRange(dateKey, time, durationMinutes), range))
    );
  });
}

/** نوبتِ فعالِ دیگری که با بازهٔ `[start, end)` هم‌پوشانی دارد (به‌جز خود نوبتِ در دست بررسی). */
function findOverlap(range: TimeRange, ignoreAppointmentId: string) {
  return appointments.find(
    (item) =>
      item.id !== ignoreAppointmentId &&
      SLOT_BLOCKING_STATUSES.includes(item.status) &&
      rangesOverlap(range, appointmentRange(item)),
  );
}

/** نوبتِ فعالِ دیگری که با بازهٔ همین نوبت (یا درخواست) هم‌پوشانی دارد، نه فقط هم‌ساعت است. */
function findAppointmentConflict(appointment: Appointment) {
  return findOverlap(appointmentRange(appointment), appointment.id);
}

/**
 * مهلت تغییر وضعیتِ نوبتی که در روز `startsAt` است، تا `today` تمام شده یا نه.
 * فقط روز تقویمی (به وقت تهران) مقایسه می‌شود؛ روز هفتم هنوز مجاز است و از روز هشتم بسته می‌شود.
 */
export function isPastEditWindowClosed(startsAt: string, today: string) {
  return addDays(appointmentDateKey(startsAt), PAST_EDIT_DAYS) < today;
}

/**
 * وضعیت این نوبت دیگر قابل تغییر نیست؟ با همان «امروز»ی که داده‌های ساختگی با آن ساخته شده‌اند.
 * پیش از مقداردهی اولیه نوبتی وجود ندارد، پس حالت `null` در عمل پیش نمی‌آید.
 */
export function isAppointmentStatusLocked(appointment: Pick<Appointment, "starts_at">) {
  return clinicToday !== null && isPastEditWindowClosed(appointment.starts_at, clinicToday);
}

export function updateAppointmentStatus(
  appointmentId: string,
  nextStatus: AppointmentStatus,
): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);

  if (!appointment) {
    return { ok: false, message: "این نوبت پیدا نشد. صفحه را تازه کنید و دوباره امتحان کنید." };
  }

  // درخواستِ در انتظار هنوز نوبت نیست؛ رد کردنش (جریان «درخواست‌ها») به این مهلت وابسته نیست.
  if (appointment.status !== "requested" && isAppointmentStatusLocked(appointment)) {
    return { ok: false, message: PAST_EDIT_LOCKED_MESSAGE };
  }

  if (!SELECTABLE_STATUSES.includes(nextStatus)) {
    return { ok: false, message: "این وضعیت را از اینجا نمی‌شود انتخاب کرد. یکی از دکمه‌های وضعیت را بزنید." };
  }

  if (appointment.status === nextStatus) {
    return { ok: false, message: "نوبت هم‌اکنون در همین وضعیت است." };
  }

  // نوبتِ بدون مراجع هنوز قطعی نشده؛ فقط لغو آن مجاز است و تأیید از بخش «درخواست‌ها» انجام می‌شود.
  if (appointment.patient_id === null && nextStatus !== "cancelled") {
    return {
      ok: false,
      message: "این درخواست هنوز به مراجعی وصل نشده است. ابتدا آن را در بخش «درخواست‌ها» تأیید کنید.",
    };
  }

  // بازگشت از وضعیتِ بدون اشغال (لغوشده یا غایب) به وضعیتِ اشغال‌کننده، فقط اگر ساعت خالی مانده باشد.
  if (SLOT_BLOCKING_STATUSES.includes(nextStatus) && !SLOT_BLOCKING_STATUSES.includes(appointment.status)) {
    const conflict = findAppointmentConflict(appointment);
    if (conflict) {
      return { ok: false, message: SLOT_TAKEN_MESSAGE };
    }
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
      .filter((value): value is string => value !== null)
      .map((value) => toLatinDigits(value).toLocaleLowerCase("fa-IR"))
      .some((value) => value.includes(normalizedQuery)),
  );
}

/** جست‌وجو میان همهٔ نوبت‌ها، بدون توجه به وضعیت، منبع، روز یا زبانهٔ انتخاب‌شده. */
export function searchAllAppointments(snapshot: AppointmentSnapshot, query: string) {
  return searchAppointments(snapshot.appointments, query);
}

/** خطای هر فیلد برای نشان‌دادن کنار همان فیلد؛ برای هر فیلد فقط اولین خطا. */
export type PatientFieldErrors = Partial<Record<keyof NewPatientInput, string>>;

/**
 * موبایل برای مراجعِ دیگری ثبت شده است؟ مراجعی که با همین کد ملی پیدا شود خودِ همین فرد است
 * (انتخاب از فهرست)، پس موبایل خودش تکراری حساب نمی‌شود.
 */
function isMobileOfAnotherPatient(input: NewPatientInput) {
  const sameNationalId = findPatientByNationalId(input.national_id, patients);
  return findPatientByMobile(input.mobile, patients, sameNationalId?.id) !== null;
}

export function getPatientFieldErrors(input: NewPatientInput): PatientFieldErrors {
  const errors: PatientFieldErrors = {};

  if (!input.full_name.trim()) {
    errors.full_name = "نام و نام خانوادگی را وارد کنید.";
  }

  const mobile = validateMobile(input.mobile, { optional: true });
  if (!mobile.ok) {
    errors.mobile = mobile.message;
  } else if (isMobileOfAnotherPatient(input)) {
    errors.mobile = MOBILE_MESSAGES.duplicate;
  }

  const nationalId = validateNationalId(input.national_id);
  if (!nationalId.ok) {
    errors.national_id = nationalId.message;
  }

  return errors;
}

function validatePatientFields(input: NewPatientInput): MutationResult {
  const errors = getPatientFieldErrors(input);
  const message = errors.full_name ?? errors.mobile ?? errors.national_id;
  return message ? { ok: false, message } : { ok: true, message: "" };
}

function validateNewPatient(input: NewPatientInput): MutationResult {
  const fields = validatePatientFields(input);
  if (!fields.ok) {
    return fields;
  }

  if (patients.some((patient) => patient.national_id === cleanNationalId(input.national_id))) {
    return {
      ok: false,
      message: "مراجعی با این کد ملی از قبل ثبت شده است. کد ملی را بررسی کنید یا همان مراجع را از فهرست انتخاب کنید.",
    };
  }

  return { ok: true, message: "" };
}

function createPatient(input: NewPatientInput): Patient {
  const patient: Patient = {
    id: `patient-local-${Date.now()}`,
    full_name: input.full_name.trim(),
    mobile: cleanMobile(input.mobile) || null,
    national_id: cleanNationalId(input.national_id),
    birth_date: null,
    gender: null,
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
    return { ok: false, message: REQUEST_NOT_PENDING_MESSAGE };
  }

  // پیش از هر تغییری (حتی ساختن مراجع): اگر ساعت پر شده، درخواست در انتظار می‌ماند.
  const conflict = findAppointmentConflict(appointment);
  if (conflict) {
    return { ok: false, message: REQUEST_SLOT_TAKEN_MESSAGE };
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
          requester_mobile: patient.mobile ?? item.requester_mobile,
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

/**
 * درخواست‌های سایت که تأیید شده‌اند و بعداً هر وضعیتِ غیرِ لغو گرفته‌اند
 * (تأییدشده، حاضر شد، انجام شد، غایب). با تغییر وضعیت از فهرست بیرون نمی‌روند.
 */
export function getApprovedRequests(snapshot: AppointmentSnapshot) {
  return snapshot.appointments.filter(
    (appointment) =>
      appointment.source === "site" &&
      appointment.status !== "requested" &&
      appointment.status !== "cancelled",
  );
}

/** همهٔ درخواست‌های سایتِ لغوشده؛ چه رد شده باشند چه بعد از تأیید لغو شده باشند. */
export function getCancelledRequests(snapshot: AppointmentSnapshot) {
  return snapshot.appointments.filter(
    (appointment) => appointment.source === "site" && appointment.status === "cancelled",
  );
}

/** در انتظار + تأییدشده + لغوشده؛ سه گروه جدا و بدون جاافتادگی. */
export function getAllRequests(snapshot: AppointmentSnapshot) {
  return [
    ...getRequestedAppointments(snapshot),
    ...getApprovedRequests(snapshot),
    ...getCancelledRequests(snapshot),
  ];
}

export function rejectRequestedAppointment(appointmentId: string): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: "این درخواست دیگر در انتظار نیست، پس رد نمی‌شود. فهرست را تازه کنید." };
  }

  return updateAppointmentStatus(appointmentId, "cancelled");
}

/** درخواست ردشده را به همان وضعیت «درخواست جدید» برمی‌گرداند. */
export function restoreRejectedRequest(appointmentId: string): MutationResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || !isRejectedRequest(appointment)) {
    return {
      ok: false,
      message: "فقط درخواست‌های ردشده را می‌شود بازگرداند و این درخواست رد نشده است. وضعیتش را در فهرست بررسی کنید.",
    };
  }

  // درخواستی که ساعتش پر شده دیگر تأیید‌شدنی نیست؛ پس به «درخواست جدید» برنمی‌گردد.
  const conflict = findAppointmentConflict(appointment);
  if (conflict) {
    return { ok: false, message: RESTORE_SLOT_TAKEN_MESSAGE };
  }

  appointments = appointments.map((item) =>
    item.id === appointmentId ? { ...item, status: "requested" } : item,
  );
  publish();
  return { ok: true, message: "درخواست به وضعیت «درخواست جدید» برگشت." };
}

/** نتیجهٔ بررسی مراجع پیش از ثبت نوبت دستی. */
export type ManualPatientCheck =
  | { kind: "invalid"; errors: PatientFieldErrors }
  | { kind: "same_national_id"; patient: Patient }
  | { kind: "similar"; candidates: Patient[] }
  | { kind: "new" };

/**
 * قالب فیلدها و تکراری‌نبودن موبایل را می‌سنجد، سپس مراجع هم‌کدملی یا هم‌نام را پیدا می‌کند.
 * موبایلِ مراجعِ دیگر خطای `invalid` است، پس مراجع «مشابه» فقط بر پایهٔ نام پیدا می‌شود.
 */
export function checkManualPatient(input: NewPatientInput): ManualPatientCheck {
  const errors = getPatientFieldErrors(input);
  if (Object.keys(errors).length > 0) {
    return { kind: "invalid", errors };
  }

  const sameNationalId = findPatientByNationalId(input.national_id, patients);
  if (sameNationalId) {
    return { kind: "same_national_id", patient: sameNationalId };
  }

  const candidates = patients.filter((patient) => namesAreSimilar(patient.full_name, input.full_name));
  return candidates.length > 0 ? { kind: "similar", candidates } : { kind: "new" };
}

/**
 * روز و ساعت شروع و مدتِ نوبت دستی را می‌سنجد: روز کاری و باز باشد، شروع روی شبکهٔ ۱۵ دقیقه‌ای باشد،
 * پایان از ساعت کاری همان روز بیرون نزند و با هیچ نوبتِ فعالی هم‌پوشانی نداشته باشد.
 */
export function checkManualSlot(input: { dateKey: string; time: string; durationMinutes: number }): MutationResult {
  const { dateKey, time, durationMinutes } = input;

  if (!(MANUAL_DURATION_OPTIONS as readonly number[]).includes(durationMinutes)) {
    return { ok: false, message: MANUAL_DURATION_MESSAGE };
  }

  const closure = getClosureForDate(dateKey);
  if (closure) {
    return { ok: false, message: `این روز تعطیل است (${closure.reason}). روز کاری دیگری را انتخاب کنید.` };
  }

  const hours = getWorkingWindow(dateKey);
  if (!hours) {
    return { ok: false, message: NOT_WORKING_DAY_MESSAGE };
  }

  const start = timeToMinutes(time);
  if (!/^\d{2}:\d{2}$/.test(time) || start % SLOT_MINUTES !== 0 || start < hours.start || start >= hours.end) {
    return { ok: false, message: MANUAL_START_MESSAGE };
  }

  if (start + durationMinutes > hours.end) {
    return { ok: false, message: outsideWorkingHoursMessage(dateKey, hours.closingTime) };
  }

  // همان تعریفِ «ساعتِ پر» که در تأیید، بازگرداندن و تغییر وضعیت هم به کار می‌رود (نوبتِ دیگری را نادیده نمی‌گیریم).
  if (findOverlap(slotRange(dateKey, time, durationMinutes), "")) {
    return { ok: false, message: MANUAL_OVERLAP_MESSAGE };
  }

  return { ok: true, message: "" };
}

export function createManualAppointment(input: {
  dateKey: string;
  time: string;
  durationMinutes: number;
  /** توضیح اداری اختیاری؛ خالی یعنی `null` ذخیره شود. */
  note?: string;
  patient: NewPatientInput;
  patientId?: string;
}): MutationResult {
  // پیش از ساختن مراجع: اگر بازه نپذیرفتنی است، هیچ مراجعی ساخته نمی‌شود.
  const slot = checkManualSlot(input);
  if (!slot.ok) {
    return slot;
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
      requester_mobile: patient.mobile ?? "",
      requested_for_self: true,
      starts_at: makeTehranDateTime(input.dateKey, input.time),
      ends_at: makeTehranDateTime(input.dateKey, minutesToTime(timeToMinutes(input.time) + input.durationMinutes)),
      status: "confirmed",
      source: "panel",
      created_by: "mock-secretary",
      note: input.note?.trim() || null,
    },
  ];
  publish();
  return { ok: true, message: "نوبت دستی ثبت شد." };
}


import {
  findPatientByMobile,
  findPatientByNationalId,
  findPatientForRequest,
  namesAreSimilar,
  normalizeMobile,
} from "./patient-match";

/**
 * `slotTaken` یعنی ساعت پر است و `nationalIdConflict` یعنی کد ملی مال مراجعی با نام دیگر است؛
 * در هر دو حالت انتخاب یا ثبت مراجع کمکی نمی‌کند و پیام باید روی کارت درخواست بماند.
 */
export type AutoConfirmResult = MutationResult & { slotTaken?: boolean; nationalIdConflict?: boolean };

const INCOMPLETE_REQUEST_MESSAGE =
  "نام یا کد ملی این درخواست کامل نیست، برای همین مراجع خودکار وصل نشد. مراجع را دستی انتخاب یا ثبت کنید.";

/**
 * تأیید خودکار: مراجع را فقط از روی کد ملی پیدا یا می‌سازد.
 * کد ملی نیست: مراجع تازه. هست و نام مشابه است: وصل می‌شود. هست و نام فرق دارد: مسدود می‌شود.
 */
export function autoConfirmRequestedAppointment(appointmentId: string): AutoConfirmResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: REQUEST_NOT_PENDING_MESSAGE };
  }

  // پیش از پیدا کردن یا ساختن مراجع، تا در حالت ساعتِ پر هیچ مراجعی ساخته نشود.
  const conflict = findAppointmentConflict(appointment);
  if (conflict) {
    return { ok: false, message: REQUEST_SLOT_TAKEN_MESSAGE, slotTaken: true };
  }

  // نامِ خالی را با «کد ملی مال مراجع دیگری است» اشتباه نگیریم.
  if (!appointment.requester_name.trim()) {
    return { ok: false, message: INCOMPLETE_REQUEST_MESSAGE };
  }

  // نامِ درخواست همیشه نام خودِ مراجع است، حتی وقتی `requested_for_self` نادرست است.
  const match = findPatientForRequest(
    appointment.requester_name,
    appointment.requester_national_id,
    patients,
  );

  if (match.kind === "match") {
    return confirmRequestedAppointment(appointmentId, { patientId: match.patient.id });
  }

  if (match.kind === "conflict") {
    return {
      ok: false,
      message: NATIONAL_ID_MESSAGES.belongsToAnotherPatient(match.patient.full_name),
      nationalIdConflict: true,
    };
  }

  const nationalId = validateNationalId(appointment.requester_national_id ?? "");
  if (!nationalId.ok) {
    return { ok: false, message: INCOMPLETE_REQUEST_MESSAGE };
  }

  // موبایل درخواست فقط وقتی مال خودِ مراجع است که درخواست برای خودش باشد.
  // اگر قبلاً برای مراجع دیگری ثبت شده، تأیید انجام می‌شود ولی موبایل ذخیره نمی‌شود.
  const requestMobile = appointment.requested_for_self ? normalizeMobile(appointment.requester_mobile) : "";
  const mobileTaken = requestMobile !== "" && findPatientByMobile(requestMobile, patients) !== null;
  const patient = createPatient({
    full_name: appointment.requester_name,
    mobile: mobileTaken ? "" : requestMobile,
    national_id: nationalId.value,
  });
  const result = confirmRequestedAppointment(appointmentId, { patientId: patient.id });
  return mobileTaken && result.ok ? { ...result, message: MOBILE_MESSAGES.duplicateOnApproval } : result;
}

/** `invalidNationalId` یعنی کد ملی تازه معتبر نیست و `message` خطای همان فیلد است. */
export type CorrectNationalIdResult = AutoConfirmResult & { invalidNationalId?: boolean };

/**
 * منشی کد ملیِ درخواست را اصلاح می‌کند (مثلاً پس از پیام «کد ملی مال مراجع دیگری است»).
 * کد تازه جای `requester_national_id` می‌نشیند و همان تأیید خودکار دوباره اجرا می‌شود.
 */
export function correctRequestNationalId(appointmentId: string, rawNationalId: string): CorrectNationalIdResult {
  const appointment = appointments.find((item) => item.id === appointmentId);
  if (!appointment || appointment.status !== "requested") {
    return { ok: false, message: REQUEST_NOT_PENDING_MESSAGE };
  }

  const nationalId = validateNationalId(rawNationalId);
  if (!nationalId.ok) {
    return { ok: false, message: nationalId.message, invalidNationalId: true };
  }

  appointments = appointments.map((item) =>
    item.id === appointmentId ? { ...item, requester_national_id: nationalId.value } : item,
  );
  // اگر تأیید دوباره مسدود شود، خودش چیزی منتشر نمی‌کند؛ پس کد تازه را همین‌جا منتشر می‌کنیم.
  publish();
  return autoConfirmRequestedAppointment(appointmentId);
}