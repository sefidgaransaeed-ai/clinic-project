import { toPersianDigits } from "@/lib/format";

import { SLOT_MINUTES } from "../appointments/slots";
import type { Result } from "./types";

/**
 * اعتبارسنجی ساعت کاری و تعطیلی. فقط محاسبه است: نه Supabase، نه `server-only`، نه React؛
 * پس هم در آزمون و هم سمت مرورگر کار می‌کند. همهٔ پیام‌ها فارسی‌اند و متن خام پایگاه داده در آن‌ها نیست.
 */

// ---------------------------------------------------------------- روز هفته

/**
 * شمارهٔ روز هفته از `Date.getUTCDay()` (یکشنبه = ۰ … شنبه = ۶) به شمارهٔ پایگاه داده (شنبه = ۰ … جمعه = ۶).
 * همان تبدیلی که `getWeekStart` در ماژول نوبت‌ها هم می‌کند.
 */
export function jsWeekdayToDbWeekday(jsWeekday: number): number {
  if (!Number.isInteger(jsWeekday) || jsWeekday < 0 || jsWeekday > 6) {
    throw new RangeError("شمارهٔ روز هفته باید عددی از ۰ تا ۶ باشد.");
  }
  return (jsWeekday + 1) % 7;
}

/** روز هفتهٔ یک تاریخ میلادی `YYYY-MM-DD` به شمارهٔ پایگاه داده (شنبه = ۰). تاریخ باید پیش‌تر معتبر شده باشد. */
export function dbWeekdayOfDate(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return jsWeekdayToDbWeekday(new Date(Date.UTC(year, month - 1, day)).getUTCDay());
}

// ------------------------------------------------------------- ساعت کاری

export const WORKING_HOURS_MESSAGES = {
  weekday: "روز هفته معتبر نیست. یکی از روزهای شنبه تا جمعه را انتخاب کنید.",
  time: "ساعت را به صورت ساعت و دقیقه (مثلاً ۱۴:۳۰) وارد کنید.",
  step: `ساعت شروع و پایان باید مضرب ${toPersianDigits(SLOT_MINUTES)} دقیقه باشند (مثلاً ۱۴:۰۰ یا ۱۴:۱۵).`,
  order: "ساعت پایان باید بعد از ساعت شروع باشد. ساعت‌ها را بررسی کنید.",
  isActive: "وضعیت فعال یا غیرفعال بودن این بازه معتبر نیست. دوباره انتخاب کنید.",
  clinic: "مطب انتخاب‌شده معتبر نیست. یکی از مطب‌های فهرست را انتخاب کنید.",
  /** روزی که ردیف فعال ندارد: مطبش از هیچ‌جا مشتق نمی‌شود و پزشک باید یکی از مطب‌ها را انتخاب کند. */
  clinicRequired: "برای این روز هفته مطب را انتخاب کنید؛ ساعت کاریِ این روز در کدام مطب است؟",
  /** ساعت‌های فعالِ همین روز از پیش برای چند مطب ثبت شده‌اند، پس مطبِ این روز مشخص نیست. */
  clinicInconsistent:
    "ساعت‌های فعال این روز برای چند مطب ثبت شده‌اند، در حالی که هر روز فقط یک مطب دارد. موضوع را به پشتیبان فنی خبر بدهید.",
  /** ویرایش نمی‌تواند ردیف را به مطب دیگری ببرد؛ مطبِ ردیف از همان ردیف خوانده می‌شود. */
  clinicLocked:
    "مطبِ یک بازهٔ ثبت‌شده را نمی‌شود با ویرایش عوض کرد. اگر ساعت کاری به مطب دیگری رفته، این بازه را غیرفعال کنید و بازهٔ تازه‌ای برای آن مطب بسازید.",
  /** ردیفی که پیش از تصمیم 0011 بی‌مطب ساخته شده و مطبی برای حفظ ندارد. */
  clinicMissing:
    "برای این بازه هیچ مطبی ثبت نشده است، پس ویرایشش ممکن نیست. می‌توانید آن را غیرفعال کنید و بازهٔ تازه‌ای با مطب بسازید.",
  id: "این بازهٔ کاری شناخته نشد. صفحه را تازه کنید و دوباره تلاش کنید.",
} as const;

/** ورودی خام، مثلاً از فرم. هیچ فیلدی قابل اعتماد نیست، پس همه `unknown` هستند. */
export interface WorkingHoursInput {
  id?: unknown;
  clinicId?: unknown;
  weekday: unknown;
  startTime: unknown;
  endTime: unknown;
  isActive: unknown;
}

/**
 * ردیف پس از اعتبارسنجیِ خودِ ردیف. `clinicId` خالی یعنی «ورودی مطب نداشت»؛ `validateWorkingHoursChange`
 * یا آن را از ردیف‌های فعالِ همان روز مشتق می‌کند، یا (اگر روز ردیف فعال ندارد) درخواستِ انتخاب مطب را برمی‌گرداند.
 */
export interface WorkingHoursRow {
  id?: string;
  clinicId: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

/** ردیفی که مطبش مشخص شده؛ تنها چیزی که اجازهٔ نوشتن دارد. مطبِ خالی دیگر پذیرفته نمی‌شود. */
export type ResolvedWorkingHoursRow = Omit<WorkingHoursRow, "clinicId"> & { clinicId: string };

/**
 * ردیف موجود در پایگاه داده. `clinicId` در پایگاه داده خالی‌پذیر است (ستونِ افزوده‌شده در migration 0007)
 * ولی 0011 هر روزِ کاری را به یک مطب می‌بندد؛ ردیفِ بی‌مطب اطلاعاتی دربارهٔ مطبِ روز نمی‌دهد و نادیده گرفته می‌شود.
 */
export type ExistingWorkingHours = Pick<
  WorkingHoursRow,
  "clinicId" | "weekday" | "startTime" | "endTime" | "isActive"
> & { id: string; clinicName?: string | null };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function minutesOf(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * مضرب `SLOT_MINUTES` بودن لازم است، نه سلیقه‌ای: `available_slots` در پایگاه داده خانه‌ها را از `start_time`
 * با گام `slot_minutes` می‌سازد، و ثبت دستی (`data.ts` ماژول نوبت‌ها) ساعت شروعی را که مضرب ۱۵ نباشد رد می‌کند.
 * ساعت شروعِ ناهم‌تراز یعنی خانه‌هایی که منشی هرگز نمی‌تواند دستی ثبت کند.
 */
function isOnSlotStep(time: string): boolean {
  return minutesOf(time) % SLOT_MINUTES === 0;
}

/** شناسهٔ یک ردیف (uuid) که از بیرون آمده، مثلاً برای غیرفعال‌کردن. `message` برای ردیف‌هایی غیر از ساعت کاری. */
export function validateRowId(id: unknown, message: string = WORKING_HOURS_MESSAGES.id): Result<string> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return { ok: false, message };
  }
  return { ok: true, value: id };
}

/** یک ردیف ساعت کاری را به‌تنهایی می‌سنجد (هم‌پوشانی با ردیف‌های دیگر جداست). */
export function validateWorkingHoursRow(input: WorkingHoursInput): Result<WorkingHoursRow> {
  const { weekday, startTime, endTime, isActive } = input;

  if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.weekday };
  }

  const start = typeof startTime === "string" ? startTime.trim() : "";
  const end = typeof endTime === "string" ? endTime.trim() : "";
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.time };
  }

  if (!isOnSlotStep(start) || !isOnSlotStep(end)) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.step };
  }

  if (minutesOf(start) >= minutesOf(end)) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.order };
  }

  if (typeof isActive !== "boolean") {
    return { ok: false, message: WORKING_HOURS_MESSAGES.isActive };
  }

  const clinicId = input.clinicId ?? null;
  if (clinicId !== null && (typeof clinicId !== "string" || !UUID_PATTERN.test(clinicId))) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.clinic };
  }

  const id = input.id ?? undefined;
  if (id !== undefined && (typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.id };
  }

  return { ok: true, value: { id, clinicId, weekday, startTime: start, endTime: end, isActive } };
}

/**
 * ردیف فعالِ هم‌روز و هم‌مطبی که با `candidate` هم‌پوشانی دارد، یا `undefined`.
 * پایگاه داده این قید را ندارد. بازه‌ها نیم‌باز `[شروع، پایان)` هستند: ۱۴:۰۰–۱۶:۰۰ و ۱۶:۰۰–۱۸:۰۰ هم‌پوشانی ندارند.
 * ردیف غیرفعال خانه نمی‌سازد، پس نه خودش مانع است و نه اگر `candidate` غیرفعال باشد چیزی را می‌شکند.
 * ردیفی با همان `id` خودِ `candidate` است (ویرایش) و نادیده گرفته می‌شود.
 */
export function findWorkingHoursOverlap(
  candidate: ResolvedWorkingHoursRow,
  existing: readonly ExistingWorkingHours[],
): ExistingWorkingHours | undefined {
  if (!candidate.isActive) return undefined;

  const start = minutesOf(candidate.startTime);
  const end = minutesOf(candidate.endTime);

  return existing.find(
    (row) =>
      row.isActive &&
      row.id !== candidate.id &&
      row.weekday === candidate.weekday &&
      row.clinicId === candidate.clinicId &&
      start < minutesOf(row.endTime) &&
      minutesOf(row.startTime) < end,
  );
}

export function workingHoursOverlapMessage(row: Pick<ExistingWorkingHours, "startTime" | "endTime">): string {
  const range = `${toPersianDigits(row.startTime)} تا ${toPersianDigits(row.endTime)}`;
  return `این بازه با ساعت کاری ثبت‌شدهٔ دیگری در همین روز (${range}) هم‌پوشانی دارد. ساعت‌ها را تغییر دهید یا بازهٔ قبلی را غیرفعال کنید.`;
}

/**
 * مطبِ یک روز هفته، مشتق از ردیف‌های **فعالِ** همان روز (به‌جز ردیفِ در حال ویرایش). تصمیم 0011 + تصمیم مریم:
 *   - همه یک مطب داشتند → همان مطب؛ پزشک انتخابش نمی‌کند.
 *   - چند مطب → ناسازگاریِ داده (بیرون از این قاعده ساخته شده).
 *   - ردیف فعالی نبود → `{ ok: true, value: null }`: مطب مشتق نمی‌شود و پزشک باید انتخاب کند.
 * ردیف غیرفعال و ردیفِ بی‌مطب نادیده گرفته می‌شوند؛ روزی که فقط ردیف غیرفعال دارد مثل روزِ بی‌ردیف است.
 */
export function deriveClinicForWeekday(
  weekday: number,
  existing: readonly ExistingWorkingHours[],
  selfId?: string,
): Result<string | null> {
  const clinics = new Set(
    existing
      .filter((row) => row.isActive && row.id !== selfId && row.weekday === weekday && row.clinicId !== null)
      .map((row) => row.clinicId as string),
  );

  if (clinics.size > 1) return { ok: false, message: WORKING_HOURS_MESSAGES.clinicInconsistent };
  return { ok: true, value: clinics.size === 1 ? [...clinics][0] : null };
}

/**
 * ردیف فعالِ هم‌روز که مطبش با `candidate` فرق دارد، یا `undefined`. این قاعده به ساعت‌ها کاری ندارد:
 * ساعت‌های بی‌هم‌پوشانی هم نمی‌توانند در یک روز به دو مطب بروند. ردیف غیرفعال و ردیفِ بی‌مطب نادیده گرفته می‌شود،
 * و اگر خودِ `candidate` غیرفعال است، چیزی را نمی‌شکند.
 */
export function findWeekdayClinicConflict(
  candidate: ResolvedWorkingHoursRow,
  existing: readonly ExistingWorkingHours[],
): ExistingWorkingHours | undefined {
  if (!candidate.isActive) return undefined;

  return existing.find(
    (row) =>
      row.isActive &&
      row.id !== candidate.id &&
      row.weekday === candidate.weekday &&
      row.clinicId !== null &&
      row.clinicId !== candidate.clinicId,
  );
}

export function weekdayClinicConflictMessage(row: Pick<ExistingWorkingHours, "clinicName">): string {
  const target = row.clinicName ? `«${row.clinicName}»` : "مطب دیگری";
  return `این روز هفته برای ${target} ثبت شده و هر روز فقط به یک مطب تعلق دارد. ساعت را برای همان مطب ثبت کنید یا بازه‌های فعال این روز را غیرفعال کنید.`;
}

/**
 * اعتبارسنجی کامل **ردیفِ تازه** (ویرایش ردیف موجود: `validateWorkingHoursEdit`): خودِ ردیف، مطب،
 * یکی‌بودن مطبِ روز، و در آخر هم‌پوشانی. فقط محاسبه است؛
 * فهرست مطب‌های شناخته‌شده (`knownClinicIds`، از جدول `clinics`) را فراخوان می‌دهد.
 *
 * مطب:
 *   - روزی که ردیف فعال دارد: مطب از همان ردیف‌ها می‌آید و پزشک انتخابش نمی‌کند. `clinicId` صریح باید با آن یکی باشد.
 *   - روزی که ردیف فعال ندارد (بی‌ردیف یا فقط غیرفعال): `clinicId` الزامی است.
 *   - هر `clinicId` صریح باید یکی از `knownClinicIds` باشد.
 * خروجی همیشه `clinicId` غیرخالی دارد.
 */
export function validateWorkingHoursChange(
  input: WorkingHoursInput,
  existing: readonly ExistingWorkingHours[],
  knownClinicIds: readonly string[],
): Result<ResolvedWorkingHoursRow> {
  const checked = validateWorkingHoursRow(input);
  if (!checked.ok) return checked;

  let clinicId = checked.value.clinicId;
  if (clinicId !== null && !knownClinicIds.includes(clinicId)) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.clinic };
  }

  const derived = deriveClinicForWeekday(checked.value.weekday, existing, checked.value.id);
  if (!derived.ok) return derived;
  if (clinicId === null) {
    if (derived.value === null) return { ok: false, message: WORKING_HOURS_MESSAGES.clinicRequired };
    clinicId = derived.value;
  }
  const row: ResolvedWorkingHoursRow = { ...checked.value, clinicId };

  const conflict = findWeekdayClinicConflict(row, existing);
  if (conflict) return { ok: false, message: weekdayClinicConflictMessage(conflict) };

  const overlap = findWorkingHoursOverlap(row, existing);
  if (overlap) return { ok: false, message: workingHoursOverlapMessage(overlap) };

  return { ok: true, value: row };
}

/**
 * اعتبارسنجی ویرایشِ یک ردیف موجود (تغییر ساعت‌ها، روز، یا فعال/غیرفعال‌کردن). تصمیم مریم: مطبِ ردیف خودکار
 * حفظ می‌شود و دوباره پرسیده نمی‌شود. `input.id` الزامی است و ردیف از `existing` خوانده می‌شود.
 *
 *   - مطبِ ردیف برای قید «هر روز یک مطب» و برای هم‌پوشانی به کار می‌رود، حتی اگر ردیف تنها ردیف فعال روزش باشد.
 *   - `clinicId` صریح (اگر فرستاده شد) باید با مطبِ ردیف یکی باشد؛ ویرایش ردیف را به مطب دیگر نمی‌برد.
 *   - مطبِ ردیف لازم نیست در فهرست مطب‌های فعال باشد (ساعتِ ردیفِ یک مطبِ غیرفعال‌شده هم قابل ویرایش است).
 *   - اگر روز عوض شود یا ردیفِ غیرفعال دوباره فعال شود، مطبِ ردیف با ردیف‌های فعالِ روزِ مقصد سنجیده می‌شود.
 *   - ردیفی که مطب ندارد (داده‌ای که پیش از تصمیم 0011 ساخته شده) مطبی برای حفظ ندارد و ویرایش نمی‌شود.
 */
export function validateWorkingHoursEdit(
  input: WorkingHoursInput,
  existing: readonly ExistingWorkingHours[],
): Result<ResolvedWorkingHoursRow> {
  const checked = validateWorkingHoursRow(input);
  if (!checked.ok) return checked;

  const id = checked.value.id;
  const current = id === undefined ? undefined : existing.find((row) => row.id === id);
  if (!current) return { ok: false, message: WORKING_HOURS_MESSAGES.id };

  if (current.clinicId === null) return { ok: false, message: WORKING_HOURS_MESSAGES.clinicMissing };

  if (checked.value.clinicId !== null && checked.value.clinicId !== current.clinicId) {
    return { ok: false, message: WORKING_HOURS_MESSAGES.clinicLocked };
  }

  const row: ResolvedWorkingHoursRow = { ...checked.value, clinicId: current.clinicId };

  const conflict = findWeekdayClinicConflict(row, existing);
  if (conflict) return { ok: false, message: weekdayClinicConflictMessage(conflict) };

  const overlap = findWorkingHoursOverlap(row, existing);
  if (overlap) return { ok: false, message: workingHoursOverlapMessage(overlap) };

  return { ok: true, value: row };
}

// ----------------------------------------------------------------- تعطیلی

/** بیشینهٔ طول دلیل تعطیلی؛ این متن در پنل و گاهی در پیام به مراجع می‌آید و باید کوتاه بماند. */
export const CLOSURE_REASON_MAX_LENGTH = 100;

/** بازهٔ سالِ میلادیِ قابل‌قبول؛ تاریخ شمسیِ اشتباهی (۱۴۰۵-…) یک «تاریخ میلادی» معتبر در گذشتهٔ دور است و باید رد شود. */
export const CLOSURE_MIN_YEAR = 2000;
export const CLOSURE_MAX_YEAR = 2100;

export const CLOSURE_MESSAGES = {
  date: "تاریخ تعطیلی معتبر نیست. تاریخ را به صورت سال-ماه-روز میلادی (مثلاً ۲۰۲۶-۱۱-۲۰) وارد کنید.",
  reasonRequired: "دلیل تعطیلی را بنویسید تا منشی و مراجعان بدانند چرا مطب بسته است.",
  reasonTooLong: `دلیل تعطیلی حداکثر ${toPersianDigits(CLOSURE_REASON_MAX_LENGTH)} نویسه باشد. آن را کوتاه‌تر کنید.`,
  duplicate: "برای این تاریخ قبلاً تعطیلی ثبت شده است. تاریخ دیگری انتخاب کنید.",
  /** تاریخ یکتاست؛ ردیفِ لغوشده می‌ماند، پس ثبت تازه ممکن نیست و راهش فعال‌سازی دوبارهٔ همان ردیف است. */
  cancelledDuplicate:
    "برای این تاریخ پیش‌تر تعطیلی ثبت و لغو شده است. تعطیلی تازه نسازید؛ از فهرست تعطیلی‌ها، دکمهٔ «فعال‌سازی دوباره» را بزنید.",
  id: "این تعطیلی شناخته نشد. صفحه را تازه کنید و دوباره تلاش کنید.",
} as const;

export interface ClosureInput {
  closureDate: unknown;
  reason: unknown;
}

export interface ClosureRow {
  closureDate: string;
  reason: string;
}

/** تعطیلیِ موجود برای سنجش تکراری‌بودن: تاریخ و اینکه هنوز فعال است یا لغو شده. */
export interface ExistingClosure {
  closureDate: string;
  isActive: boolean;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** تاریخ میلادی واقعی `YYYY-MM-DD`؟ «۲۰۲۶-۰۲-۳۰» الگو را می‌خواند ولی روز واقعی نیست. */
export function isValidGregorianDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1) return false;

  // `Date.UTC` برای سال‌های ۰ تا ۹۹ آن را به ۱۹۰۰+ می‌برد، پس سال را صریح می‌گذاریم.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * یک تعطیلی را می‌سنجد. `existing` همهٔ تعطیلی‌های ثبت‌شده است، فعال و لغوشده (ستون `closure_date` یکتاست):
 * تاریخِ فعال یعنی «قبلاً ثبت شده»؛ تاریخِ لغوشده یعنی باید همان ردیف دوباره فعال شود، نه ردیف تازه.
 * دلیل بریده و فاصله‌های پشت‌سرهم یکی می‌شوند؛ دلیل خالی پذیرفته نمی‌شود.
 */
export function validateClosure(input: ClosureInput, existing: readonly ExistingClosure[]): Result<ClosureRow> {
  const closureDate = typeof input.closureDate === "string" ? input.closureDate.trim() : "";
  // تاریخ شمسیِ واردشده به‌اشتباه (مثل 1405-08-23) خودش یک تاریخ میلادیِ واقعی در سال ۱۴۰۵ است؛ بازهٔ سال جلویش را می‌گیرد.
  const year = Number(closureDate.slice(0, 4));
  if (!isValidGregorianDate(closureDate) || year < CLOSURE_MIN_YEAR || year > CLOSURE_MAX_YEAR) {
    return { ok: false, message: CLOSURE_MESSAGES.date };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length === 0) {
    return { ok: false, message: CLOSURE_MESSAGES.reasonRequired };
  }
  if (reason.length > CLOSURE_REASON_MAX_LENGTH) {
    return { ok: false, message: CLOSURE_MESSAGES.reasonTooLong };
  }

  const sameDate = existing.find((closure) => closure.closureDate === closureDate);
  if (sameDate) {
    return { ok: false, message: sameDate.isActive ? CLOSURE_MESSAGES.duplicate : CLOSURE_MESSAGES.cancelledDuplicate };
  }

  return { ok: true, value: { closureDate, reason } };
}
