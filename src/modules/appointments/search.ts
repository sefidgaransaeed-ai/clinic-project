import { normalizeDigits, normalizeMobile, normalizeName } from "./patient-match";
import type { AppointmentWithPatient } from "./types";

/**
 * جست‌وجوی نوبت با نام، شماره یا کد ملی. فقط محاسبه است و به React یا انبار داده وابسته نیست،
 * تا نسخهٔ پایگاه داده بعداً همین قاعده‌ها را دوباره به کار ببرد.
 */

/** نویسه‌های نامرئی که همراه متن کپی‌شده می‌آیند؛ نیم‌فاصله جدا و در `normalizeName` پردازش می‌شود. */
const INVISIBLE_CHARS = /[​‍‎‏‪-‮⁦-⁩﻿]/g;

/**
 * ارقام فارسی و عربی را لاتین می‌کند، ي/ك/ى عربی را به ی/ک فارسی برمی‌گرداند،
 * نیم‌فاصله را فاصله می‌کند و نویسه‌های نامرئی و فاصلهٔ دو سر را برمی‌دارد.
 */
export function normalizeSearchText(raw: string): string {
  const visible = raw.replace(INVISIBLE_CHARS, "");
  return normalizeName(normalizeDigits(visible).replace(/ى/g, "ی")).toLowerCase();
}

/** عبارتی که پس از یکدست‌سازی چیزی برای جست‌وجو نمی‌ماند (خالی یا فقط فاصله) جست‌وجو حساب نمی‌شود. */
export function hasSearchQuery(query: string): boolean {
  return normalizeSearchText(query) !== "";
}

export interface ParsedQuery {
  /** کلمه‌های نام؛ هر کدام باید در نام بیاید، به هر ترتیب. */
  words: string[];
  /** رقم‌های پشت‌سرهم؛ هر کدام باید در شماره یا کد ملی بیاید. */
  numbers: string[];
}

/** عبارتی که فقط رقم و جداکننده است (مثل «0912-345 6789» یا «+98 912…») یک شمارهٔ واحد است. */
const NUMBER_ONLY = /^[\d\s+\-().]+$/;

export function parseQuery(query: string): ParsedQuery | null {
  const text = normalizeSearchText(query);
  if (text === "") {
    return null;
  }

  if (NUMBER_ONLY.test(text)) {
    const digits = text.replace(/\D/g, "");
    return digits === "" ? null : { words: [], numbers: [digits] };
  }

  const words: string[] = [];
  const numbers: string[] = [];
  for (const token of text.split(" ")) {
    (/^\d+$/.test(token) ? numbers : words).push(token);
  }
  return { words, numbers };
}

function digitsOf(value: string | null | undefined): string {
  return normalizeDigits(value ?? "").replace(/\D/g, "");
}

/** شماره را به شکل 09xxxxxxxxx درمی‌آورد؛ اگر قالبش معتبر نبود همان ارقامش را نگه می‌دارد. */
function canonicalMobile(value: string | null | undefined): string {
  return normalizeMobile(value ?? "") || digitsOf(value);
}

/** نیم‌فاصله و فاصله مهم نیست: «محمدرضا» با «محمد رضا» یکی است. */
function nameHasWord(name: string, word: string): boolean {
  return name.includes(word) || name.replace(/ /g, "").includes(word);
}

function numberMatches(digits: string, mobiles: string[], nationalIds: string[]): boolean {
  // «9123456789» و «989123456789» هم باید به همان شمارهٔ «09123456789» برسند.
  const asMobile = normalizeMobile(digits);
  return (
    mobiles.some((mobile) => mobile.includes(digits) || (asMobile !== "" && mobile.includes(asMobile))) ||
    nationalIds.some((nationalId) => nationalId.includes(digits))
  );
}

/** مقدارهای خامِ یک رکورد که عبارت جست‌وجو با آن‌ها سنجیده می‌شود؛ یکدست‌سازی با خودِ تابع است. */
export interface SearchFields {
  names: (string | null | undefined)[];
  mobiles: (string | null | undefined)[];
  nationalIds: (string | null | undefined)[];
}

/**
 * قاعدهٔ یکسانِ تطبیق برای نوبت و مراجع: ی/ک عربی، ارقام فارسی و لاتین، نیم‌فاصله و ترتیب کلمه‌ها.
 * فقط متن را می‌سنجد و به دادهٔ مراجع یا نوبت وابسته نیست.
 */
export function matchesSearchFields(query: ParsedQuery, fields: SearchFields): boolean {
  const names = fields.names.filter((name): name is string => Boolean(name)).map(normalizeSearchText);
  const mobiles = fields.mobiles.map(canonicalMobile).filter(Boolean);
  const nationalIds = fields.nationalIds.map(digitsOf).filter(Boolean);

  // همهٔ کلمه‌های نام باید در یک نام بیایند، نه پخش در دو نام.
  const wordsMatch = query.words.length === 0 || names.some((name) => query.words.every((word) => nameHasWord(name, word)));
  return wordsMatch && query.numbers.every((digits) => numberMatches(digits, mobiles, nationalIds));
}

/**
 * مشخصات مراجع وصل‌شده و مشخصاتی که خودِ درخواست دارد، هر دو دیده می‌شوند؛
 * چون درخواستِ هنوز وصل‌نشده فقط همین‌ها را دارد و نام ثبت‌شده در سایت ممکن است با پروندهٔ مراجع فرق کند.
 */
function matchesParsedQuery(appointment: AppointmentWithPatient, query: ParsedQuery): boolean {
  const { patient } = appointment;
  return matchesSearchFields(query, {
    names: [patient?.full_name, appointment.requester_name],
    mobiles: [patient?.mobile, appointment.requester_mobile],
    nationalIds: [patient?.national_id, appointment.requester_national_id],
  });
}

export function newestFirst(left: AppointmentWithPatient, right: AppointmentWithPatient): number {
  return Date.parse(right.starts_at) - Date.parse(left.starts_at) || left.id.localeCompare(right.id);
}

/**
 * همهٔ نوبت‌هایی که با عبارت می‌خوانند، جدیدترینِ تاریخ نوبت اول. وضعیت و منبع نوبت اهمیتی ندارد.
 * عبارت خالی چیزی برنمی‌گرداند؛ نمایش فهرست عادی با فراخواننده است.
 */
export function searchAppointments(appointments: AppointmentWithPatient[], query: string): AppointmentWithPatient[] {
  const parsed = parseQuery(query);
  if (!parsed) {
    return [];
  }
  return appointments.filter((appointment) => matchesParsedQuery(appointment, parsed)).sort(newestFirst);
}
