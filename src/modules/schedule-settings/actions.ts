"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";

import {
  cancelClosure,
  createClosure,
  createWorkingHours,
  deactivateWorkingHours,
  reactivateClosure,
  updateWorkingHours,
} from "./data";
import { DB_WRITE_FAILED_MESSAGE } from "./db-errors";
import type { GuardedResult, WorkingHoursActionState } from "./types";

/**
 * Server Actionهای ساعت کاری — کار `p2-09`، مرحلهٔ ۲الف (فقط منطق؛ رابط در مرحلهٔ بعد).
 *
 * ⚠️ **Server Action یک مسیر HTTP مستقل است.** قفل ناوبری فقط صفحه را می‌گیرد، پس هر action
 * خط اولش `requireRole(["doctor"])` است. لایهٔ داده (`data.ts`) نقش را دوباره می‌سنجد و RLS هم آخرین قفل است.
 *
 * ورودی را از `FormData` می‌خوانیم و بدون سنجش به لایهٔ داده می‌دهیم؛ سنجش واقعی (روز، گام ۱۵ دقیقه، ترتیب،
 * مطب، هم‌پوشانی) آنجاست. پیام‌ها همیشه فارسی‌اند و متن خام پایگاه داده به فرم نمی‌رسد.
 *
 * مطب: ایجاد فقط وقتی `clinicId` می‌فرستد که فیلدش در فرم باشد (روزِ بی‌ردیفِ فعال)؛ ویرایش و غیرفعال‌سازی هرگز
 * `clinicId` نمی‌فرستند، چون مطبِ ردیف حفظ می‌شود.
 *
 * تأیید دوم (تصمیم 0013، بند ۶): تغییری که نوبت تأییدشدهٔ آینده را بیرون برنامه ببرد در ارسال اول ذخیره نمی‌شود و
 * فهرست متأثرها برمی‌گردد. ارسال دوم با `confirm=true` و `confirmedIds` (همان فهرستی که پزشک دید) می‌آید؛ لایهٔ داده
 * پیش از نوشتن دوباره می‌خواند و اگر فهرست فرق کرده بود باز هشدار می‌دهد. نوبت‌ها هیچ‌وقت خودکار لغو یا جابه‌جا نمی‌شوند.
 *
 * عمداً این‌ها **وجود ندارند**: حذف ساعت کاری (به‌جایش `is_active = false`).
 */

const SETTINGS_PATH = "/panel/settings/schedule";

/** رشتهٔ یک فیلد فرم؛ فیلدِ نبوده یا فایل `null` می‌شود. */
function readText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

/**
 * شناسه‌هایی که پزشک در هشدار دید و تأیید کرد. `null` یعنی ارسال اول (تأییدی در کار نیست):
 * فقط وقتی `confirm` دقیقاً «true» باشد ارسال را «دوم» می‌شماریم. محتوای شناسه‌ها اعتبارسنجی نمی‌شود؛
 * لایهٔ داده فقط آن‌ها را با فهرست تازه‌خوانده مقایسه می‌کند و چیزی با آن‌ها به پایگاه داده نمی‌رود.
 */
function readConfirmedIds(formData: FormData): string[] | null {
  if (readText(formData, "confirm")?.trim() !== "true") return null;
  return (readText(formData, "confirmedIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

/** شمارهٔ روز («۰» تا «۶» با رقم انگلیسی). هر چیز دیگر همان‌طور می‌رود تا اعتبارسنجی پیام فارسی بدهد. */
function readWeekday(formData: FormData): unknown {
  const text = readText(formData, "weekday")?.trim() ?? null;
  return text !== null && /^[0-6]$/.test(text) ? Number(text) : text;
}

/** «true» و «false» فرم به بولین؛ هر چیز دیگر همان‌طور می‌رود و اعتبارسنجی رد می‌کند. */
function readBoolean(formData: FormData, name: string): unknown {
  const text = readText(formData, name)?.trim() ?? null;
  if (text === "true") return true;
  if (text === "false") return false;
  return text;
}

/**
 * نتیجهٔ لایهٔ داده را به حالت فرم تبدیل می‌کند و صفحه را تازه می‌کند — **در خطا هم**: پس از هر خطا
 * (مثلاً هم‌زمانی دو ثبت و `23P01`) برنامهٔ تازه دوباره از پایگاه داده خوانده می‌شود و پزشک وضعیت کهنه نمی‌بیند.
 * «تأیید دوم لازم است» خطا نیست و چیزی عوض نشده؛ فقط فهرست به فرم می‌رود.
 */
function toState(result: GuardedResult<unknown>): WorkingHoursActionState {
  if (!result.ok && "confirmation" in result) {
    return { error: null, ok: false, confirmation: result.confirmation };
  }
  revalidatePath(SETTINGS_PATH);
  if (!result.ok) return { error: result.message, ok: false };
  return { error: null, ok: true };
}

/** هر استثنای پیش‌بینی‌نشده؛ جزئیات فنی فقط در لاگ سرور می‌ماند. صفحه اینجا هم تازه می‌شود. */
async function run(action: string, operation: () => Promise<GuardedResult<unknown>>): Promise<WorkingHoursActionState> {
  try {
    return toState(await operation());
  } catch (error) {
    console.error(`[schedule-settings] ${action} threw`, error);
    try {
      revalidatePath(SETTINGS_PATH);
    } catch (revalidateError) {
      console.error(`[schedule-settings] ${action} revalidate threw`, revalidateError);
    }
    return { error: DB_WRITE_FAILED_MESSAGE, ok: false };
  }
}

export async function createWorkingHoursAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  const clinicId = readText(formData, "clinicId")?.trim() ?? "";

  return run("createWorkingHoursAction", () =>
    createWorkingHours({
      weekday: readWeekday(formData),
      startTime: readText(formData, "startTime"),
      endTime: readText(formData, "endTime"),
      // بازهٔ تازه همیشه فعال ساخته می‌شود.
      isActive: true,
      // فقط وقتی فیلد مطب در فرم بوده و مقدار دارد؛ وگرنه مطب از ردیف‌های فعال همان روز مشتق می‌شود.
      ...(clinicId === "" ? {} : { clinicId }),
    }),
  );
}

export async function updateWorkingHoursAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  return run("updateWorkingHoursAction", () =>
    // `clinicId` عمداً نیست: مطبِ ردیف از خودِ ردیف خوانده و حفظ می‌شود.
    updateWorkingHours(
      readText(formData, "id") ?? "",
      {
        weekday: readWeekday(formData),
        startTime: readText(formData, "startTime"),
        endTime: readText(formData, "endTime"),
        isActive: readBoolean(formData, "isActive"),
      },
      readConfirmedIds(formData),
    ),
  );
}

export async function deactivateWorkingHoursAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  return run("deactivateWorkingHoursAction", () =>
    deactivateWorkingHours(readText(formData, "id") ?? "", readConfirmedIds(formData)),
  );
}

// ---------------------------------------------------------------- تعطیلی

/**
 * ثبت، لغو و فعال‌سازی دوبارهٔ تعطیلی. لغو و فعال‌سازی فقط `is_active` همان ردیف را عوض می‌کنند؛ حذفی وجود ندارد.
 * ثبت و فعال‌سازی دوباره هشدار نوبت‌های تأییدشدهٔ متأثر دارند (تأیید دوم)؛ لغو ندارد، چون فقط روز را باز می‌کند.
 */

export async function createClosureAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  return run("createClosureAction", () =>
    createClosure(
      {
        closureDate: readText(formData, "closureDate"),
        reason: readText(formData, "reason"),
      },
      readConfirmedIds(formData),
    ),
  );
}

export async function cancelClosureAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  return run("cancelClosureAction", () => cancelClosure(readText(formData, "id") ?? ""));
}

export async function reactivateClosureAction(
  _prev: WorkingHoursActionState,
  formData: FormData,
): Promise<WorkingHoursActionState> {
  await requireRole(["doctor"]);

  return run("reactivateClosureAction", () =>
    reactivateClosure(readText(formData, "id") ?? "", readConfirmedIds(formData)),
  );
}
