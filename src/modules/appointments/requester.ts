import { normalizeDigits, normalizeMobile, normalizeName } from "./patient-match";
import type { Appointment, Patient } from "./types";

/**
 * نامِ رسمیِ مراجع و نام و موبایلِ تایپ‌شده در سایت دو چیزند: `requester_*` ستون‌های خودِ نوبت‌اند و پس از
 * تأیید هیچ‌وقت عوض نمی‌شوند، و پروندهٔ مراجع (`patient`) نام و موبایل رسمی را نگه می‌دارد.
 * فقط محاسبه است و به React یا انبار داده وابسته نیست، تا نسخهٔ پایگاه داده همین قاعده‌ها را دوباره به کار ببرد.
 */

type WithPatient = { patient?: Patient | null };

/** نامی که روی نوبت نشان داده می‌شود: نام رسمی مراجع، و تا وصل‌نشدن مراجع همان نامی که در سایت نوشته شده. */
export function getOfficialName(appointment: Pick<Appointment, "requester_name"> & WithPatient) {
  return appointment.patient?.full_name ?? appointment.requester_name;
}

/** موبایلی که روی نوبت نشان داده می‌شود؛ مثل `getOfficialName`. */
export function getOfficialMobile(appointment: Pick<Appointment, "requester_mobile"> & WithPatient) {
  return appointment.patient?.mobile ?? appointment.requester_mobile;
}

/** ارقام فارسی و لاتین، ی/ک عربی، نیم‌فاصله و فاصله تفاوت حساب نمی‌شوند: «محمد رضا» با «محمدرضا» یکی است. */
function comparableName(name: string) {
  return normalizeName(name).replace(/ /g, "");
}

/** موبایل نامعتبر هم با همان ارقامش مقایسه می‌شود، تا دو مقدار یکسانِ نامعتبر تفاوت دیده نشوند. */
function comparableMobile(mobile: string) {
  return normalizeMobile(mobile) || normalizeDigits(mobile).replace(/\D/g, "");
}

export interface SiteGivenDetails {
  name: string;
  mobile: string;
}

/**
 * نام و موبایلی که فرد در سایت نوشته، فقط وقتی نوبت از سایت آمده، به مراجعی وصل است و نام یا موبایلِ او با مراجع فرق دارد.
 * اگر یکسان باشند، هنوز مراجعی وصل نشده (همان جزئیات خودِ عنوان کارت است) یا نوبت را منشی ثبت کرده `null` برمی‌گرداند.
 * نوبت دستی هیچ نوشتهٔ سایتی ندارد؛ `requester_*` در آن فقط رونوشتِ زمان ثبت است و با ویرایش مراجع کهنه می‌شود.
 */
export function getSiteGivenDetails(
  appointment: Pick<Appointment, "requester_name" | "requester_mobile" | "source"> & WithPatient,
): SiteGivenDetails | null {
  const { patient } = appointment;
  if (!patient || appointment.source !== "site") {
    return null;
  }

  const sameName = comparableName(patient.full_name) === comparableName(appointment.requester_name);
  const sameMobile = comparableMobile(patient.mobile) === comparableMobile(appointment.requester_mobile);
  return sameName && sameMobile
    ? null
    : { name: appointment.requester_name, mobile: appointment.requester_mobile };
}
