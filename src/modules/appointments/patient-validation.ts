import {
  calculateAge,
  getTehranDateKey,
  gregorianToJalali,
  JALALI_MONTH_NAMES,
  jalaliMonthLength,
  jalaliToGregorian,
} from "./date";
import { normalizeDigits } from "./patient-match";
import type { PatientGender } from "./types";

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

/**
 * پیام‌های تاریخ تولد؛ تنها جای متن‌های این فیلد. هر پیام می‌گوید چه شد و حالا چه کنید (docs/brand-voice.md بخش ۸).
 */
export const BIRTH_DATE_MESSAGES = {
  wrongFormat: "تاریخ تولد را به شکل روز/ماه/سال بنویسید؛ مثلاً ۱۲/۰۵/۱۳۷۰.",
  notDigits: "تاریخ تولد فقط باید عدد و علامت / داشته باشد. حرف یا علامت اضافه را بردارید.",
  wrongYearLength: "سال را چهاررقمی بنویسید؛ مثلاً ۱۳۷۰.",
  gregorianYear: "سال باید شمسی باشد؛ مثلاً ۱۳۷۰. اگر سال میلادی نوشته‌اید، آن را به شمسی تبدیل کنید.",
  badMonth: "ماه باید بین ۱ تا ۱۲ باشد. ماه را بررسی کنید.",
  badDay: (monthName: string, year: number, length: number) =>
    `${monthName} ${toPersianDigits(year)} ${toPersianDigits(length)} روز دارد. روزی بین ۱ تا ${toPersianDigits(length)} بنویسید.`,
  future: "تاریخ تولد نمی‌تواند در آینده باشد. سال و ماه را بررسی کنید.",
  tooOld: "سن بیشتر از ۱۲۰ سال می‌شود. سال تولد را بررسی کنید.",
  /** فقط بعضی از سه لیست روز، ماه و سال انتخاب شده است. */
  incomplete: "تاریخ تولد کامل نیست. روز، ماه و سال را هر سه انتخاب کنید، یا هر سه را خالی بگذارید.",
};

/** جنس را فقط از همین دو گزینه می‌شود انتخاب کرد؛ خالی یعنی ثبت نشود. */
export const GENDER_OPTIONS: ReadonlyArray<{ value: PatientGender; label: string }> = [
  { value: "female", label: "زن" },
  { value: "male", label: "مرد" },
];

export const GENDER_MESSAGES = {
  invalid: "جنس را از فهرست انتخاب کنید یا خالی بگذارید.",
};

/** `value` همان مقدار تمیزشده است که باید ذخیره شود. */
export type FieldValidation = { ok: true; value: string } | { ok: false; message: string };

/** `value` تاریخ میلادی `YYYY-MM-DD` است؛ برای فیلد خالی `null` (نه رشتهٔ خالی). */
export type BirthDateValidation = { ok: true; value: string | null } | { ok: false; message: string };

/** `value` برای جنسِ انتخاب‌نشده `null` است (نه رشتهٔ خالی). */
export type GenderValidation = { ok: true; value: PatientGender | null } | { ok: false; message: string };

function fail(message: string): FieldValidation {
  return { ok: false, message };
}

/**
 * نویسه‌های نامرئی که همراه عددِ کپی‌شده می‌آیند (علامت جهت، نیم‌فاصله، فاصلهٔ بی‌عرض). روی صفحه عدد درست دیده می‌شود،
 * ولی بدون برداشتنشان پیام «فقط باید عدد باشد» می‌آید.
 */
const INVISIBLE_CHARS = /[​-‏‪-‮⁠⁦-⁩﻿]/g;

/** ارقام فارسی و عربی را لاتین می‌کند و نویسه‌های نامرئی و فاصلهٔ دو سر را برمی‌دارد. رشته می‌ماند، چون صفر ابتدایی مهم است. */
export function cleanNationalId(raw: string) {
  return normalizeDigits(raw).replace(INVISIBLE_CHARS, "").trim();
}

/** ارقام فارسی و عربی را لاتین می‌کند و نویسه‌های نامرئی، فاصله و خط تیره را از همهٔ شماره برمی‌دارد. */
export function cleanMobile(raw: string) {
  return normalizeDigits(raw).replace(INVISIBLE_CHARS, "").replace(/[\s\-‐-―−]/g, "");
}

/**
 * ارقام فارسی و عربی را لاتین می‌کند، نویسه‌های نامرئی و فاصله را برمی‌دارد و هر جداکنندهٔ رایج
 * (خط تیره، نقطه، ممیز عربی و ...) را به «/» تبدیل می‌کند.
 */
export function cleanBirthDate(raw: string) {
  return normalizeDigits(raw)
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s/g, "")
    .replace(/[\-‐-―−.⁄／٫]/g, "/");
}

/** سالِ ۱۵۰۰ به بالا شمسیِ تولد نیست؛ احتمالاً سال میلادی نوشته شده است. */
const FIRST_GREGORIAN_LOOKING_YEAR = 1500;
const MAX_AGE_YEARS = 120;

/**
 * تاریخ تولد شمسی را که با روز/ماه/سال تایپ شده می‌سنجد. خالی پذیرفته می‌شود و `null` برمی‌گرداند؛
 * تاریخ درست به میلادیِ `YYYY-MM-DD` تبدیل می‌شود، چون در پایگاه داده همین شکل ذخیره می‌شود.
 * `todayKey` را آزمون‌ها می‌دهند؛ پیش‌فرض امروزِ تهران است.
 */
export function validateBirthDate(raw: string, todayKey: string = getTehranDateKey(new Date())): BirthDateValidation {
  const text = cleanBirthDate(raw);

  if (text === "") {
    return { ok: true, value: null };
  }
  if (/[^\d/]/.test(text)) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.notDigits };
  }

  // مقدار ساخته‌شده از سه لیست («روز/ماه/سال» با جای خالی): هر سه خالی یعنی تاریخی داده نشده، فقط بعضی پر یعنی ناقص.
  const slots = text.split("/");
  if (slots.length === 3 && slots.some((slot) => slot === "")) {
    return slots.every((slot) => slot === "")
      ? { ok: true, value: null }
      : { ok: false, message: BIRTH_DATE_MESSAGES.incomplete };
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d+)$/.exec(text);
  if (!match) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.wrongFormat };
  }

  const [day, month] = [Number(match[1]), Number(match[2])];
  const yearText = match[3];
  if (yearText.length !== 4) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.wrongYearLength };
  }
  const year = Number(yearText);
  if (year >= FIRST_GREGORIAN_LOOKING_YEAR) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.gregorianYear };
  }
  if (month < 1 || month > 12) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.badMonth };
  }
  const monthLength = jalaliMonthLength(year, month);
  if (day < 1 || day > monthLength) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.badDay(JALALI_MONTH_NAMES[month - 1], year, monthLength) };
  }

  const dateKey = jalaliToGregorian(year, month, day);
  if (!dateKey) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.wrongFormat };
  }
  if (dateKey > todayKey) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.future };
  }
  if (calculateAge(dateKey, todayKey) > MAX_AGE_YEARS) {
    return { ok: false, message: BIRTH_DATE_MESSAGES.tooOld };
  }

  return { ok: true, value: dateKey };
}

export type BirthDatePart = "day" | "month" | "year";
export type BirthDateParts = Record<BirthDatePart, string>;

/**
 * مقدار سه لیست تاریخ تولد را به «روز/ماه/سال» تبدیل می‌کند؛ همان چیزی که `validateBirthDate` می‌سنجد.
 * جای جزء انتخاب‌نشده خالی می‌ماند تا تاریخ ناقص هم نگه داشته و سنجیده شود؛ سه لیست خالی همان `""` است.
 */
export function composeBirthDate({ day, month, year }: BirthDateParts) {
  return day === "" && month === "" && year === "" ? "" : `${day}/${month}/${year}`;
}

/** برعکس `composeBirthDate`: هر جزء که عدد نباشد خالی حساب می‌شود، و «05» با «5» یکی است. */
export function splitBirthDate(value: string): BirthDateParts {
  const [day = "", month = "", year = ""] = value
    .split("/")
    .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : ""));
  return { day, month, year };
}

/** سال شمسی امروز تا ۱۲۰ سال پیش، از جدید به قدیم (۱۲۱ گزینه). */
export function getBirthYearOptions(todayKey: string = getTehranDateKey(new Date())) {
  const currentYear = gregorianToJalali(todayKey).year;
  return Array.from({ length: MAX_AGE_YEARS + 1 }, (_, index) => currentYear - index);
}

/**
 * تعداد گزینه‌های لیست «روز». ماه انتخاب نشده ۳۱ است. اسفندِ بدون سال ۳۰ است،
 * چون کبیسه‌بودن سال تا انتخاب سال معلوم نیست؛ با انتخاب سال، روزِ نامعتبر پاک می‌شود.
 */
export function getBirthDayCount(month: string, year: string) {
  const monthNumber = Number(month);
  if (!monthNumber) {
    return 31;
  }
  if (monthNumber === 12 && year === "") {
    return 30;
  }
  return jalaliMonthLength(Number(year), monthNumber);
}

/** یکی از سه لیست را عوض می‌کند و اگر روزِ انتخاب‌شده در ماه و سالِ تازه وجود نداشت، روز را پاک می‌کند. */
export function updateBirthDatePart(value: string, part: BirthDatePart, next: string) {
  const parts: BirthDateParts = { ...splitBirthDate(value), [part]: next };
  if (parts.day !== "" && Number(parts.day) > getBirthDayCount(parts.month, parts.year)) {
    parts.day = "";
  }
  return composeBirthDate(parts);
}

/** جنس فقط «زن» یا «مرد» یا خالی است؛ هر مقدار دیگری رد می‌شود، حتی اگر از رابط کاربری نیامده باشد. */
export function validateGender(raw: string): GenderValidation {
  if (raw === "") {
    return { ok: true, value: null };
  }
  const option = GENDER_OPTIONS.find((item) => item.value === raw);
  return option ? { ok: true, value: option.value } : { ok: false, message: GENDER_MESSAGES.invalid };
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
