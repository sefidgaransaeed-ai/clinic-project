import { addDays, appointmentDateKey } from "./date";
import { findPatientByNationalId, namesAreSimilar } from "./patient-match";
import { validateBirthDate, validateGender, validateMobile, validateNationalId } from "./patient-validation";
import { searchAppointments } from "./search";
import {
  findOverlap,
  MANUAL_DURATION_OPTIONS,
  MANUAL_FIRST_START_MINUTES,
  MANUAL_LAST_END_MINUTES,
  SLOT_BLOCKING_STATUSES,
  SLOT_MINUTES,
  slotRange,
  timeToMinutes,
} from "./slots";
import type {
  AppointmentSnapshot,
  AppointmentStatus,
  MutationResult,
  NewPatientInput,
  Patient,
  PatientFormInput,
} from "./types";

/**
 * محاسبه و فیلترهای خالص روی ردیف‌هایی که سرور از Supabase می‌خواند (`queries.ts` + `row-mappers.ts`).
 * این فایل به انبار حافظه یا Supabase وابسته نیست و در کامپوننت‌های کلاینت هم import می‌شود.
 * ثبت و ویرایش نوبت‌ها (تأیید، رد، لغو، نوبت دستی، تغییر نام) در `actions.ts` به پایگاه داده وصل است؛ ثبت و ویرایش مراجع هنوز نیست.
 */

/** تا پایان این‌همه روزِ تقویمی پس از روز نوبت می‌شود وضعیتش را عوض کرد؛ هم‌ارز app_settings.past_edit_days در مدل داده. */
export const PAST_EDIT_DAYS = 7;

/** متن مصوب برند (معیار A-09 در docs/brand-voice.md). */
export const PAST_EDIT_LOCKED_MESSAGE =
  "وضعیت نوبت‌های قدیمی‌تر از ۷ روز قابل تغییر نیست. برای اصلاح با پزشک هماهنگ کنید.";

/** هر کار ثبت یا ویرایش تا وصل‌شدن به پایگاه داده همین پیام را می‌دهد. */
export const DB_NOT_CONNECTED_MESSAGE = "ثبت هنوز به پایگاه داده وصل نشده است.";

/** وقتی خواندن از پایگاه داده نشود. جزئیات فنی در لاگ سرور می‌ماند، نه روی صفحه. */
export const PANEL_LOAD_FAILED_MESSAGE =
  "خواندن اطلاعات از پایگاه داده انجام نشد. صفحه را دوباره باز کنید؛ اگر باز هم نشد، به پزشک خبر بدهید.";

/** پیام «بازه پر است» برای تغییر وضعیت نوبت، که منشی می‌تواند بازهٔ دیگری را از تقویم بگیرد؛ بدون نام و ساعت. */
export const SLOT_TAKEN_MESSAGE =
  "این بازه قبلاً به فرد دیگری داده شده است. لطفاً بازهٔ خالی دیگری را در تقویم هفتگی انتخاب کنید.";

/** هم‌پوشانی در ثبت دستی؛ منشی می‌تواند ساعت شروع یا مدت را عوض کند. بدون نام و ساعتِ نوبت دیگر. */
export const MANUAL_OVERLAP_MESSAGE =
  "این مدت با نوبت دیگری هم‌پوشانی دارد. ساعت شروع دیگری انتخاب کنید یا مدت را کمتر کنید.";

const MANUAL_DURATION_MESSAGE = "مدت نوبت باید ۱۵، ۳۰، ۴۵ یا ۶۰ دقیقه باشد. یکی از گزینه‌ها را انتخاب کنید.";

const MANUAL_START_MESSAGE = "این ساعت شروع پذیرفته نمی‌شود. یکی از ساعت‌های فهرست را انتخاب کنید.";

const MANUAL_TOO_EARLY_MESSAGE = "نوبت دستی زودتر از ساعت ۰۸:۰۰ صبح ثبت نمی‌شود. ساعت شروع دیگری انتخاب کنید.";

const MANUAL_TOO_LATE_MESSAGE = "این نوبت از ساعت ۲۴:۰۰ شب بیرون می‌زند. ساعت شروع زودتر یا مدت کمتری انتخاب کنید.";

/** وضعیت‌هایی که منشی تا ۷ روز پس از نوبت می‌تواند بینشان جابه‌جا شود، به ترتیب نمایش. */
export const SELECTABLE_STATUSES: AppointmentStatus[] = [
  "confirmed",
  "arrived",
  "done",
  "no_show",
  "cancelled",
];

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

export function getSelectableStatuses() {
  return SELECTABLE_STATUSES;
}

/**
 * مهلت تغییر وضعیتِ نوبتی که در روز `startsAt` است، تا `today` تمام شده یا نه.
 * فقط روز تقویمی (به وقت تهران) مقایسه می‌شود؛ روز هفتم هنوز مجاز است و از روز هشتم بسته می‌شود.
 */
export function isPastEditWindowClosed(startsAt: string, today: string) {
  return addDays(appointmentDateKey(startsAt), PAST_EDIT_DAYS) < today;
}

/** وضعیت این نوبت دیگر قابل تغییر نیست؟ `today` همان «امروز»ِ تهران است که سرور همراه ردیف‌ها می‌فرستد. */
export function isAppointmentStatusLocked(appointment: { starts_at: string }, today: string) {
  return isPastEditWindowClosed(appointment.starts_at, today);
}

/** جست‌وجو میان همهٔ نوبت‌ها، بدون توجه به وضعیت، منبع، روز یا زبانهٔ انتخاب‌شده. */
export function searchAllAppointments(snapshot: AppointmentSnapshot, query: string) {
  return searchAppointments(snapshot.appointments, query);
}

/** خطای هر فیلد برای نشان‌دادن کنار همان فیلد؛ برای هر فیلد فقط اولین خطا. */
export type PatientFieldErrors = Partial<Record<keyof NewPatientInput, string>>;

export function getPatientFieldErrors(input: NewPatientInput): PatientFieldErrors {
  const errors: PatientFieldErrors = {};

  if (!input.full_name.trim()) {
    errors.full_name = "نام و نام خانوادگی را وارد کنید.";
  }

  // «شمارهٔ شخصی مراجع» ممکن است میان اعضای یک خانواده مشترک باشد (تصمیم خانم مریم). با تصمیم M-1 و قید یکتای پایگاه داده
  // فرق دارد؛ بررسی تکراری‌بودنِ «شمارهٔ شخصی مراجع» منتظر تصمیم بک‌اند است و فعلاً فقط قالبش سنجیده می‌شود.
  const mobile = validateMobile(input.mobile, { optional: true });
  if (!mobile.ok) {
    errors.mobile = mobile.message;
  }

  const nationalId = validateNationalId(input.national_id);
  if (!nationalId.ok) {
    errors.national_id = nationalId.message;
  }

  const birthDate = validateBirthDate(input.birth_date);
  if (!birthDate.ok) {
    errors.birth_date = birthDate.message;
  }

  const gender = validateGender(input.gender);
  if (!gender.ok) {
    errors.gender = gender.message;
  }

  return errors;
}

/**
 * تاریخ تولد و جنسِ تایپ‌شده برای مراجعِ موجود: هر فیلد جدا، فقط وقتی در پرونده خالی (`null`) است سنجیده
 * و برای ذخیره آماده می‌شود. مقدارِ ثبت‌شده در پرونده هرگز بازنویسی نمی‌شود، و نام، کد ملی و شمارهٔ شخصی مراجع اصلاً دست نمی‌خورند.
 */
function resolveExistingPatientExtras(existing: Patient, input: NewPatientInput) {
  const errors: PatientFieldErrors = {};
  const updates: Partial<Pick<Patient, "birth_date" | "gender">> = {};

  if (existing.birth_date === null) {
    const birthDate = validateBirthDate(input.birth_date);
    if (!birthDate.ok) {
      errors.birth_date = birthDate.message;
    } else if (birthDate.value !== null) {
      updates.birth_date = birthDate.value;
    }
  }

  if (existing.gender === null) {
    const gender = validateGender(input.gender);
    if (!gender.ok) {
      errors.gender = gender.message;
    } else if (gender.value !== null) {
      updates.gender = gender.value;
    }
  }

  return { errors, updates };
}

/** خطای فیلدهای تاریخ تولد و جنس برای مراجعِ موجودی که منشی از فهرست انتخاب کرده؛ فقط فیلدهای خالیِ پرونده سنجیده می‌شوند. */
export function getExistingPatientFieldErrors(
  snapshot: AppointmentSnapshot,
  patientId: string,
  input: NewPatientInput,
): PatientFieldErrors {
  const existing = snapshot.patients.find((item) => item.id === patientId);
  return existing ? resolveExistingPatientExtras(existing, input).errors : {};
}

/** خطای هر فیلد فرم ثبت و ویرایش مراجع؛ برای هر فیلد فقط اولین خطا. */
export type PatientFormErrors = Partial<Record<keyof PatientFormInput, string>>;

/** نتیجهٔ بررسی مراجع پیش از ثبت نوبت دستی. */
export type ManualPatientCheck =
  | { kind: "invalid"; errors: PatientFieldErrors }
  | { kind: "same_national_id"; patient: Patient }
  | { kind: "similar"; candidates: Patient[] }
  | { kind: "new" };

/**
 * قالب فیلدها را می‌سنجد، سپس مراجع هم‌کدملی یا هم‌نام را پیدا می‌کند.
 * شمارهٔ شخصی مراجع در پیدا کردن مراجع «مشابه» نقشی ندارد؛ فقط نام سنجیده می‌شود.
 */
export function checkManualPatient(snapshot: AppointmentSnapshot, input: NewPatientInput): ManualPatientCheck {
  const errors = getPatientFieldErrors(input);
  if (Object.keys(errors).length > 0) {
    return { kind: "invalid", errors };
  }

  const sameNationalId = findPatientByNationalId(input.national_id, snapshot.patients);
  if (sameNationalId) {
    return { kind: "same_national_id", patient: sameNationalId };
  }

  const candidates = snapshot.patients.filter((patient) => namesAreSimilar(patient.full_name, input.full_name));
  return candidates.length > 0 ? { kind: "similar", candidates } : { kind: "new" };
}

export type ManualTimeRange = { ok: true; startsAt: string; endsAt: string } | { ok: false; message: string };

/**
 * سنجش‌های نوبت دستی که ساعت کاری و تعطیلی را شامل نمی‌شود (پزشک و منشی می‌توانند بیرون از آن‌ها هم نوبت بدهند):
 * مدت یکی از گزینه‌ها، روز معتبر، شروع روی شبکهٔ ۱۵ دقیقه‌ای، شروع نه زودتر از ۰۸:۰۰ و پایان نه دیرتر از ۲۴:۰۰ وقت تهران.
 * بدون نیاز به ردیف‌ها، برای اکشن سرور. خروجی دو لحظهٔ UTC برای ستون `timestamptz` است.
 * هم‌پوشانی را اینجا نمی‌سنجیم: قید پایگاه داده (`23P01`) کار را می‌کند.
 */
export function getManualTimeRange(dateKey: string, time: string, durationMinutes: number): ManualTimeRange {
  if (!(MANUAL_DURATION_OPTIONS as readonly number[]).includes(durationMinutes)) {
    return { ok: false, message: MANUAL_DURATION_MESSAGE };
  }
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && addDays(dateKey, 0) === dateKey;
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && timeToMinutes(time) % SLOT_MINUTES === 0;
  if (!validDay || !validTime) {
    return { ok: false, message: MANUAL_START_MESSAGE };
  }
  const startMinutes = timeToMinutes(time);
  if (startMinutes < MANUAL_FIRST_START_MINUTES) {
    return { ok: false, message: MANUAL_TOO_EARLY_MESSAGE };
  }
  if (startMinutes + durationMinutes > MANUAL_LAST_END_MINUTES) {
    return { ok: false, message: MANUAL_TOO_LATE_MESSAGE };
  }
  const { start, end } = slotRange(dateKey, time, durationMinutes);
  return { ok: true, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}

/**
 * سنجشِ سخت نوبت دستی: همان `getManualTimeRange` (مدت، شبکهٔ ۱۵ دقیقه‌ای، ۰۸:۰۰ تا ۲۴:۰۰) و هم‌پوشانی با نوبتِ فعال.
 * روز تعطیل، روز غیرکاری و بیرون از ساعت کاری مانع نیستند؛ آن‌ها هشدار و تأیید دوم می‌خواهند (`getManualSlotWarning`).
 * `ignoreAppointmentId` فقط در تغییر نام می‌آید: نوبتِ قدیمی در همان مرحله‌ای لغو می‌شود که نوبت تازه ثبت می‌شود،
 * پس با آن هم‌پوشانی حساب نمی‌شود.
 */
export function checkManualSlot(
  snapshot: AppointmentSnapshot,
  input: {
    dateKey: string;
    time: string;
    durationMinutes: number;
    ignoreAppointmentId?: string;
  },
): MutationResult {
  const { dateKey, time, durationMinutes } = input;

  const range = getManualTimeRange(dateKey, time, durationMinutes);
  if (!range.ok) {
    return { ok: false, message: range.message };
  }

  // همان تعریفِ «ساعتِ پر» که در تأیید، بازگرداندن و تغییر وضعیت هم به کار می‌رود (نوبتِ دیگری را نادیده نمی‌گیریم).
  if (findOverlap(snapshot.appointments, slotRange(dateKey, time, durationMinutes), input.ignoreAppointmentId ?? "")) {
    return { ok: false, message: MANUAL_OVERLAP_MESSAGE };
  }

  return { ok: true, message: "" };
}

/**
 * نام‌هایی که صفحهٔ عمومی `/nobat` هنوز از انبار ساختگی می‌گیرد؛ در برش (ج) به `request_appointment()` وصل می‌شود
 * و این بلوک با `mock-store.ts` برداشته می‌شود. صفحه‌های پنل از این‌ها استفاده نمی‌کنند.
 */
export {
  createSiteRequest,
  getAppointmentsVersion,
  getClinicWorkingDays,
  getClosureForDate,
  getPublicDayError,
  getPublicFreeStartTimes,
  initializeMockAppointments,
  subscribeToAppointments,
  type SiteRequestFieldErrors,
  type SiteRequestInput,
  type SiteRequestResult,
} from "./mock-store";
