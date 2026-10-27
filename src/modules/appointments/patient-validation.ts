import { normalizeDigits } from "./patient-match";

/**
 * اعتبارسنجی کد ملی و موبایل با پیام مخصوص هر خطا. بدون وابستگی به React یا فرم،
 * تا فرم پنل، فرم سایت و ربات بعداً از همین‌جا استفاده کنند. فقط اولین خطا برگردانده می‌شود.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toPersianDigits(value: number) {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/** پیام‌های کد ملی؛ تنها جای متن‌های این فیلد. */
export const NATIONAL_ID_MESSAGES = {
  empty: "کد ملی را وارد کنید.",
  notDigits: "کد ملی فقط باید عدد باشد. حرف یا علامت اضافه را بردارید.",
  wrongLength: (count: number) => `کد ملی باید ۱۰ رقم باشد؛ الان ${toPersianDigits(count)} رقم است.`,
  invalid: "این کد ملی معتبر نیست. ارقام را با کارت ملی مقایسه کنید.",
  /** کد ملی یک نفر است؛ اگر مال مراجعی با نام دیگر بود، نه وصل می‌شود و نه مراجع تازه ساخته می‌شود. */
  belongsToAnotherPatient: (patientName: string) =>
    `این کد ملی قبلاً برای مراجع دیگری (${patientName}) ثبت شده است. کد ملی درست را از مراجع بگیرید.`,
};

/** پیام‌های شمارهٔ موبایل؛ تنها جای متن‌های این فیلد. */
export const MOBILE_MESSAGES = {
  empty: "شمارهٔ موبایل را وارد کنید.",
  notDigits: "شمارهٔ موبایل فقط باید عدد باشد. حرف یا علامت اضافه را بردارید.",
  wrongLength: (count: number) => `شمارهٔ موبایل باید ۱۱ رقم باشد؛ الان ${toPersianDigits(count)} رقم است.`,
  notStartingWith09: "شمارهٔ موبایل باید با ۰۹ شروع شود.",
  duplicate: "این شمارهٔ موبایل قبلاً برای مراجع دیگری ثبت شده است. موبایل را بررسی کنید یا همان مراجع را از فهرست انتخاب کنید.",
  /** هنگام تأیید خودکار: تأیید انجام می‌شود ولی موبایلِ تکراری در پروندهٔ مراجعِ تازه ذخیره نمی‌شود. */
  duplicateOnApproval:
    "نوبت تأیید شد. این شمارهٔ موبایل قبلاً برای مراجع دیگری ثبت شده بود، برای همین در پروندهٔ این مراجع ذخیره نشد. شمارهٔ شخصی خودش را بعداً در پروندهٔ او وارد کنید.",
};

/**
 * پیام‌های شمارهٔ تماسِ نوبت (`requester_mobile`)؛ جدا از شمارهٔ شخصی مراجع، چون اینجا اجباری است.
 * یکتایی ندارد: چند نوبت می‌توانند یک شمارهٔ تماس داشته باشند.
 */
export const REQUESTER_MOBILE_MESSAGES = {
  empty: "شمارهٔ تماس این نوبت وارد نشده است. موبایلی را بنویسید که برای هماهنگی نوبت می‌شود با آن تماس گرفت.",
  notDigits: "شمارهٔ تماس فقط باید عدد باشد. حرف یا علامت اضافه را بردارید.",
  wrongLength: (count: number) => `شمارهٔ تماس باید ۱۱ رقم باشد؛ الان ${toPersianDigits(count)} رقم است. شماره را کامل بنویسید.`,
  notStartingWith09: "شمارهٔ تماس باید موبایل باشد و با ۰۹ شروع شود. شمارهٔ موبایل را بنویسید.",
};

/** `value` همان مقدار تمیزشده است که باید ذخیره شود. */
export type FieldValidation = { ok: true; value: string } | { ok: false; message: string };

function fail(message: string): FieldValidation {
  return { ok: false, message };
}

/** ارقام فارسی و عربی را لاتین می‌کند و فاصلهٔ دو سر را برمی‌دارد. رشته می‌ماند، چون صفر ابتدایی مهم است. */
export function cleanNationalId(raw: string) {
  return normalizeDigits(raw).trim();
}

/** ارقام فارسی و عربی را لاتین می‌کند و فاصله و خط تیره را از همهٔ شماره برمی‌دارد. */
export function cleanMobile(raw: string) {
  return normalizeDigits(raw).replace(/[\s\-‐-―−]/g, "");
}

/** الگوریتم استاندارد کد ملی: ۱۰ رقمِ یکسان نامعتبر است و رقم دهم باید رقم کنترل باشد. */
function hasValidNationalIdCheckDigit(code: string) {
  if (/^(\d)\1{9}$/.test(code)) {
    return false;
  }

  const sum = [...code.slice(0, 9)].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  const expected = remainder < 2 ? remainder : 11 - remainder;
  return Number(code[9]) === expected;
}

export function validateNationalId(raw: string): FieldValidation {
  const value = cleanNationalId(raw);

  if (value === "") {
    return fail(NATIONAL_ID_MESSAGES.empty);
  }
  if (/\D/.test(value)) {
    return fail(NATIONAL_ID_MESSAGES.notDigits);
  }
  if (value.length !== 10) {
    return fail(NATIONAL_ID_MESSAGES.wrongLength(value.length));
  }
  if (!hasValidNationalIdCheckDigit(value)) {
    return fail(NATIONAL_ID_MESSAGES.invalid);
  }

  return { ok: true, value };
}

/** با `optional: true` مقدار خالی پذیرفته می‌شود (`value` رشتهٔ خالی است)؛ بدون آن خالی خطای `empty` می‌دهد. */
export function validateMobile(raw: string, options: { optional?: boolean } = {}): FieldValidation {
  const value = cleanMobile(raw);

  if (value === "") {
    return options.optional ? { ok: true, value } : fail(MOBILE_MESSAGES.empty);
  }
  if (/\D/.test(value)) {
    return fail(MOBILE_MESSAGES.notDigits);
  }
  if (value.length !== 11) {
    return fail(MOBILE_MESSAGES.wrongLength(value.length));
  }
  if (!value.startsWith("09")) {
    return fail(MOBILE_MESSAGES.notStartingWith09);
  }

  return { ok: true, value };
}

/** شمارهٔ تماس نوبت: اجباری و فقط موبایل (۰۹ و ۹ رقم). تکراری بودن بررسی نمی‌شود. */
export function validateRequesterMobile(raw: string): FieldValidation {
  const value = cleanMobile(raw);

  if (value === "") {
    return fail(REQUESTER_MOBILE_MESSAGES.empty);
  }
  if (/\D/.test(value)) {
    return fail(REQUESTER_MOBILE_MESSAGES.notDigits);
  }
  if (value.length !== 11) {
    return fail(REQUESTER_MOBILE_MESSAGES.wrongLength(value.length));
  }
  if (!value.startsWith("09")) {
    return fail(REQUESTER_MOBILE_MESSAGES.notStartingWith09);
  }

  return { ok: true, value };
}
