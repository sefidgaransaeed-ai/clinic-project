import { normalizeDigits } from "./patient-match";
import { matchesSearchFields, newestFirst, normalizeSearchText, parseQuery, type ParsedQuery } from "./search";
import type { AppointmentSnapshot, Patient } from "./types";

/**
 * فقط برای پنل (منشی و پزشک): جست‌وجوی مراجع و شمارهٔ تماسِ آخرین نوبتِ آن‌ها.
 * این فایل نام، کد ملی و شمارهٔ شخصی مراجع‌ها را برمی‌گرداند؛ پس هرگز از مسیرهای عمومی سایت
 * (مثل /nobat) و فرم‌های عمومی import نشود و از `data.ts` هم دوباره export نشود.
 */

/** حداکثر پیشنهادِ زیر فیلد نام در ثبت نوبت دستی. */
export const PATIENT_SUGGESTION_LIMIT = 8;

/** پیشنهاد از این تعداد حرفِ تایپ‌شده (بدون فاصله) شروع می‌شود. */
export const PATIENT_SUGGESTION_MIN_CHARS = 2;

/** وقتی فقط رقم تایپ شده (ابتدای کد ملی یا شماره)، پیشنهاد از این تعداد رقم شروع می‌شود. */
export const PATIENT_SUGGESTION_MIN_DIGITS = 3;

/** ردیف مراجع‌های بدون پرسش (صفحهٔ تأیید درخواست) همین‌قدر اول فهرست است. */
const DEFAULT_LIST_SIZE = 6;

/** نیم‌فاصله و فاصله مهم نیست: «محمدر» هم اول «محمد رضا» را می‌گیرد. */
function startsWithWord(name: string, word: string) {
  return name.split(" ").some((part) => part.startsWith(word)) || name.replace(/ /g, "").startsWith(word);
}

/** همهٔ کلمه‌های تایپ‌شده اولِ یکی از کلمه‌های نام باشند؛ این‌ها پیش از تطبیق‌های میانهٔ نام می‌آیند. */
function startsWithAllWords(patient: Patient, query: ParsedQuery) {
  const name = normalizeSearchText(patient.full_name);
  return query.words.length > 0 && query.words.every((word) => startsWithWord(name, word));
}

function rankedMatches(patients: Patient[], query: string): Patient[] {
  const parsed = parseQuery(query);
  if (!parsed) {
    return [];
  }

  const matches = patients.filter((patient) =>
    matchesSearchFields(parsed, {
      names: [patient.full_name],
      mobiles: [patient.mobile],
      nationalIds: [patient.national_id],
    }),
  );
  // مرتب‌سازی پایدار است: داخل هر گروه ترتیب فهرست مراجع می‌ماند.
  return [...matches].sort(
    (left, right) => Number(!startsWithAllWords(left, parsed)) - Number(!startsWithAllWords(right, parsed)),
  );
}

/**
 * جست‌وجوی مراجع با نام، شماره یا کد ملی. پرسش خالی شش مراجع اول را برمی‌گرداند.
 * مراجعی که نامشان با حرف‌های تایپ‌شده شروع می‌شود جلوترند.
 */
export function searchPatients(snapshot: AppointmentSnapshot, query: string, limit?: number): Patient[] {
  if (parseQuery(query) === null) {
    return snapshot.patients.slice(0, DEFAULT_LIST_SIZE);
  }
  const matches = rankedMatches(snapshot.patients, query);
  return limit === undefined ? matches : matches.slice(0, limit);
}

function digitsOnly(value: string | null): string {
  return normalizeDigits(value ?? "").replace(/\D/g, "");
}

/**
 * رقم‌های تایپ‌شده ابتدای کد ملی یا ابتدای شمارهٔ شخصی مراجع‌اند. «۹۱۲…» بدون صفر اول هم به «۰۹۱۲…» می‌رسد.
 * فقط پیشوند حساب می‌شود، نه هر جای شماره؛ جست‌وجوی عمومی (`searchPatients`) همان قاعدهٔ «هر جا» را نگه می‌دارد.
 */
function startsWithDigits(patient: Patient, digits: string): boolean {
  const mobile = digitsOnly(patient.mobile);
  return (
    digitsOnly(patient.national_id).startsWith(digits) ||
    mobile.startsWith(digits) ||
    (digits.startsWith("9") && mobile.startsWith(`0${digits}`))
  );
}

/**
 * پیشنهاد مراجع هنگام تایپ در فیلد نام: با کمتر از ۲ حرف، یا وقتی چیزی نمی‌خواند، فهرست خالی است
 * و جریان عادیِ مراجع تازه می‌ماند. اگر فقط رقم تایپ شده باشد، از ۳ رقم به بعد مراجعی که کد ملی یا شمارهٔ شخصی‌اش
 * با آن شروع می‌شود پیشنهاد می‌شود. مراجع هیچ‌وقت خودکار و فقط با شماره وصل نمی‌شود؛ منشی باید یکی را انتخاب کند.
 */
export function suggestPatients(snapshot: AppointmentSnapshot, typedName: string): Patient[] {
  if (normalizeSearchText(typedName).replace(/ /g, "").length < PATIENT_SUGGESTION_MIN_CHARS) {
    return [];
  }
  const parsed = parseQuery(typedName);
  if (parsed && parsed.words.length === 0) {
    const digits = parsed.numbers[0] ?? "";
    if (digits.length < PATIENT_SUGGESTION_MIN_DIGITS) {
      return [];
    }
    return snapshot.patients.filter((patient) => startsWithDigits(patient, digits)).slice(0, PATIENT_SUGGESTION_LIMIT);
  }
  return rankedMatches(snapshot.patients, typedName).slice(0, PATIENT_SUGGESTION_LIMIT);
}

/**
 * شمارهٔ تماسِ پیشنهادی برای ثبت نوبت دستیِ این مراجع: `requester_mobile` جدیدترین نوبتش
 * (با هر وضعیت، حتی آینده؛ تاریخ یکسان با ترتیب شناسه). اگر نوبتی ندارد شمارهٔ شخصی مراجع، وگرنه خالی.
 */
export function getSuggestedContactMobile(snapshot: AppointmentSnapshot, patient: Patient): string {
  const latest = snapshot.appointments.filter((appointment) => appointment.patient_id === patient.id).sort(newestFirst)[0];
  return latest?.requester_mobile || patient.mobile || "";
}
