import { matchesSearchFields, newestFirst, normalizeSearchText, parseQuery, type ParsedQuery } from "./search";
import type { AppointmentSnapshot, Patient } from "./types";

/**
 * فقط برای پنل (منشی و پزشک): جست‌وجوی مراجع و شمارهٔ تماسِ آخرین نوبتِ آن‌ها.
 * این فایل نام، کد ملی و موبایلِ مراجع‌ها را برمی‌گرداند؛ پس هرگز از مسیرهای عمومی سایت
 * (مثل /nobat) و فرم‌های عمومی import نشود و از `data.ts` هم دوباره export نشود.
 */

/** حداکثر پیشنهادِ زیر فیلد نام در ثبت نوبت دستی. */
export const PATIENT_SUGGESTION_LIMIT = 6;

/** پیشنهاد از این تعداد حرفِ تایپ‌شده (بدون فاصله) شروع می‌شود. */
export const PATIENT_SUGGESTION_MIN_CHARS = 2;

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
 * جست‌وجوی مراجع با نام، موبایل یا کد ملی. پرسش خالی شش مراجع اول را برمی‌گرداند.
 * مراجعی که نامشان با حرف‌های تایپ‌شده شروع می‌شود جلوترند.
 */
export function searchPatients(snapshot: AppointmentSnapshot, query: string, limit?: number): Patient[] {
  if (parseQuery(query) === null) {
    return snapshot.patients.slice(0, DEFAULT_LIST_SIZE);
  }
  const matches = rankedMatches(snapshot.patients, query);
  return limit === undefined ? matches : matches.slice(0, limit);
}

/**
 * پیشنهاد مراجع هنگام تایپ نام: با کمتر از ۲ حرف، یا وقتی چیزی نمی‌خواند، فهرست خالی است
 * و جریان عادیِ مراجع تازه می‌ماند.
 */
export function suggestPatients(snapshot: AppointmentSnapshot, typedName: string): Patient[] {
  if (normalizeSearchText(typedName).replace(/ /g, "").length < PATIENT_SUGGESTION_MIN_CHARS) {
    return [];
  }
  return rankedMatches(snapshot.patients, typedName).slice(0, PATIENT_SUGGESTION_LIMIT);
}

/**
 * شمارهٔ تماسِ پیشنهادی برای ثبت نوبت دستیِ این مراجع: `requester_mobile` جدیدترین نوبتش
 * (با هر وضعیت، حتی آینده؛ تاریخ یکسان با ترتیب شناسه). اگر نوبتی ندارد موبایل خودش، وگرنه خالی.
 */
export function getSuggestedContactMobile(snapshot: AppointmentSnapshot, patient: Patient): string {
  const latest = snapshot.appointments.filter((appointment) => appointment.patient_id === patient.id).sort(newestFirst)[0];
  return latest?.requester_mobile || patient.mobile || "";
}
