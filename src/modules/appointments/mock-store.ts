import { addDays, getTehranDateKey, makeTehranDateTime } from "./date";
import { createMockData, mockWorkingDays } from "./mock";
import { validateNationalId, validateRequesterMobile } from "./patient-validation";
import { PUBLIC_BOOKING_MESSAGES } from "./public-booking-messages";
import {
  findClosure,
  getFreeStartTimes,
  getWorkingWindow,
  minutesToTime,
  slotRange,
  SLOT_MINUTES,
  timeToMinutes,
} from "./slots";
import type { Appointment, AppointmentSnapshot, Closure, Patient } from "./types";

/**
 * انبار ساختگیِ درون‌حافظه‌ای که فقط صفحهٔ عمومی `/nobat` هنوز به آن وصل است.
 *
 * صفحه‌های پنل (نوبت‌های امروز، درخواست‌ها، تقویم، مراجعان) دیگر از اینجا نمی‌خوانند و از Supabase می‌خوانند.
 * `/nobat` در برش (ج) به `request_appointment()` وصل می‌شود و این فایل با `mock.ts` کنار گذاشته می‌شود.
 * تا آن موقع `data.ts` همین نام‌ها را دوباره export می‌کند تا `public-booking.tsx` دست‌نخورده بماند.
 */

let patients: Patient[] = [];
let appointments: Appointment[] = [];
let closures: Closure[] = [];
let hasInitialisedMockData = false;
const listeners = new Set<() => void>();

function createSnapshot(): AppointmentSnapshot {
  const patientsById = new Map(patients.map((patient) => [patient.id, patient]));

  return {
    appointments: [...appointments]
      .map((appointment) => ({
        ...appointment,
        patient: appointment.patient_id ? (patientsById.get(appointment.patient_id) ?? null) : null,
      }))
      .sort((left, right) => left.starts_at.localeCompare(right.starts_at)),
    patients: [...patients],
    closures: [...closures],
    workingDays: mockWorkingDays,
  };
}

let currentSnapshot = createSnapshot();
/** با هر `publish` یکی بالا می‌رود؛ فرم عمومی فقط برای بازخوانیِ ساعت‌ها به آن گوش می‌دهد و به خودِ نوبت‌ها دسترسی ندارد. */
let dataVersion = 0;

function publish() {
  currentSnapshot = createSnapshot();
  dataVersion += 1;
  listeners.forEach((listener) => listener());
}

/** `0` یعنی داده‌های ساختگی هنوز ساخته نشده‌اند. */
export function getAppointmentsVersion() {
  return dataVersion;
}

export function subscribeToAppointments(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
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

export function getClinicWorkingDays() {
  return mockWorkingDays;
}

export function getClosureForDate(dateKey: string): Closure | undefined {
  return findClosure(closures, dateKey);
}

const SITE_REQUEST_NAME_MAX_LENGTH = 100;

/**
 * اگر روزِ `dateKey` برای فرم عمومی پذیرفتنی نیست، پیام فارسیِ دلیلش؛ وگرنه `null`.
 * `null` یعنی خودِ روز درست است، نه اینکه ساعت خالی دارد (آن را `getPublicFreeStartTimes` نشان می‌دهد).
 * سقفی برای دورترین روز نیست: هر روز از امروز به بعد پذیرفته می‌شود.
 * تعطیلی و روز غیرکاری پیش از «گذشته‌بودن» سنجیده می‌شود، تا روز تعطیل همیشه همان پیام را بدهد.
 */
export function getPublicDayError(dateKey: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || addDays(dateKey, 0) !== dateKey) {
    return PUBLIC_BOOKING_MESSAGES.dateInvalid;
  }
  if (getClosureForDate(dateKey)) {
    return PUBLIC_BOOKING_MESSAGES.dateClosed;
  }
  if (!getWorkingWindow(mockWorkingDays, dateKey)) {
    return PUBLIC_BOOKING_MESSAGES.dateNotWorking;
  }

  const today = getTehranDateKey(now);
  if (dateKey < today) {
    return PUBLIC_BOOKING_MESSAGES.datePast;
  }
  return null;
}

/**
 * ساعت‌های شروعِ خالیِ یک روز برای بازدیدکنندهٔ سایت: فقط ساعت، نه اطلاعات نوبت‌ها؛ هم‌شکلِ `available_slots()` در مدل داده.
 * روزِ ناپذیرفتنی (`getPublicDayError`) فهرست خالی دارد و ساعت‌های گذشتهٔ امروز هم پیشنهاد نمی‌شوند.
 */
export function getPublicFreeStartTimes(dateKey: string, now: Date = new Date()): string[] {
  if (getPublicDayError(dateKey, now) !== null) {
    return [];
  }
  return getFreeStartTimes(currentSnapshot, dateKey).filter((time) => slotRange(dateKey, time).start > now.getTime());
}

export interface SiteRequestInput {
  fullName: string;
  nationalId: string;
  /** شمارهٔ تماس همین درخواست؛ شمارهٔ شخصی مراجع نیست. */
  contactMobile: string;
  dateKey: string;
  time: string;
}

/** خطای هر فیلد برای نشان‌دادن کنار همان فیلد؛ برای هر فیلد فقط اولین خطا. */
export type SiteRequestFieldErrors = Partial<Record<keyof SiteRequestInput, string>>;

export type SiteRequestResult = { ok: true } | { ok: false; errors: SiteRequestFieldErrors };

/**
 * درخواست نوبتِ فرم عمومی را می‌سنجد و به‌صورت «درخواست جدید» (`requested`) ثبت می‌کند؛ هم‌ارز `request_appointment()` در مدل داده.
 * ساعت هنگام ثبت دوباره سنجیده می‌شود، چون درخواست ساعت را اشغال نمی‌کند و ممکن است ساعت در این فاصله پر شده باشد.
 * عمداً نه یکتایی کد ملی و شمارهٔ شخصی مراجع را می‌سنجد و نه پیامی دربارهٔ مراجع‌های موجود می‌دهد، تا فرم عمومی چیزی از پرونده‌ها لو ندهد.
 * محدودیت نرخ (N-05) بدون پایگاه داده ممکن نیست و اینجا پیاده نشده است.
 */
export function createSiteRequest(input: SiteRequestInput, now: Date = new Date()): SiteRequestResult {
  const messages = PUBLIC_BOOKING_MESSAGES;
  const errors: SiteRequestFieldErrors = {};

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (!fullName) {
    errors.fullName = messages.nameEmpty;
  } else if (fullName.length > SITE_REQUEST_NAME_MAX_LENGTH) {
    errors.fullName = messages.nameTooLong;
  }

  const nationalId = validateNationalId(input.nationalId);
  if (!nationalId.ok) {
    errors.nationalId = nationalId.message;
  }

  const contact = validateRequesterMobile(input.contactMobile);
  if (!contact.ok) {
    errors.contactMobile = contact.message;
  }

  if (input.dateKey === "") {
    errors.dateKey = messages.dateEmpty;
  } else {
    const dayError = getPublicDayError(input.dateKey, now);
    const times = dayError ? [] : getPublicFreeStartTimes(input.dateKey, now);
    if (dayError) {
      errors.dateKey = dayError;
    } else if (times.length === 0) {
      errors.time = messages.dayFull;
    } else if (input.time === "") {
      errors.time = messages.timeEmpty;
    } else if (!times.includes(input.time)) {
      errors.time = messages.slotTaken;
    }
  }

  if (!nationalId.ok || !contact.ok || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  appointments = [
    ...appointments,
    {
      id: `appointment-site-${Date.now()}`,
      patient_id: null,
      requester_name: fullName,
      requester_mobile: contact.value,
      requester_national_id: nationalId.value,
      // طبق M-2 پرسش «برای خودم / برای شخص دیگری» در فرم /nobat روی شاخهٔ nobat-db هست و مقدار واقعی را می‌فرستد؛ این فرم هنوز نمی‌پرسد، پس `false` می‌گذاریم
      // تا شمارهٔ تماس هرگز در پروندهٔ مراجع کپی نشود (M-3).
      requested_for_self: false,
      starts_at: makeTehranDateTime(input.dateKey, input.time),
      ends_at: makeTehranDateTime(input.dateKey, minutesToTime(timeToMinutes(input.time) + SLOT_MINUTES)),
      status: "requested",
      cancel_reason: null,
      source: "site",
      created_by: "public-site",
      note: null,
    },
  ];
  publish();
  return { ok: true };
}
