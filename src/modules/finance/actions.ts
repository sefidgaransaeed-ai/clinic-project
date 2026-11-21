"use server";

import { requireRole } from "@/lib/auth";
import { canReverse, optionNameError, validateNewPayment, type NewPayment, type NewPaymentErrors } from "./data";
import { financeErrorMessage as dbMessage } from "./db-errors";
import {
  getAppointmentPatient,
  getPatientInsurance,
  getPayment,
  insertOption,
  insertPayment,
  listOptions,
  updateOption,
  type OptionKind,
} from "./db";
import type { Option, Payment } from "./types";

/**
 * ذخیره‌های ماژول مالی (کار p3-06).
 *
 * ⚠️ Server Action یک مسیر HTTP مستقل است و قفل proxy آن را نمی‌گیرد، پس خط اول هر کدام
 * requireRole است (بند ۵ بخش ۷ CLAUDE.md). لایهٔ بعدی RLS و trigger پایگاه داده است.
 * قاعده‌های data.ts این‌جا دوباره اجرا می‌شوند، چون پیام‌های مرورگر قابل دور زدن‌اند.
 */

export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; errors?: NewPaymentErrors };

const NOTE_MAX = 500;

// ---------------------------------------------------------------------------
// پرداخت

/** ثبت پرداخت تازه؛ پزشک و منشی */
export async function recordPayment(input: NewPayment): Promise<ActionResult<Payment>> {
  const user = await requireRole(["doctor", "secretary"]);

  const errors = validateNewPayment(input, new Date());
  if (!Number.isInteger(input.amountToman) || (input.amountToman ?? 0) <= 0) {
    errors.amount ??= "مبلغ را به تومان و بدون اعشار بنویسید.";
  }
  if (input.note.trim().length > NOTE_MAX) {
    return { ok: false, message: "توضیح حداکثر ۵۰۰ حرف باشد." };
  }
  if (Object.keys(errors).length > 0 || !input.patientId || !input.paymentMethodId || !input.paidAt) {
    return { ok: false, message: "چند خانه ایراد دارد؛ کنار هر کدام نوشته شده.", errors };
  }

  try {
    // H-1: بیمه از خود پروندهٔ مراجع و همین لحظه کپی می‌شود، نه از چیزی که مرورگر فرستاده
    const patient = await getPatientInsurance(input.patientId);
    if (!patient) return { ok: false, message: "این مراجع پیدا نشد. صفحه را دوباره باز کنید." };

    const method = (await listOptions("method")).find((option) => option.id === input.paymentMethodId);
    if (!method?.isActive) {
      return {
        ok: false,
        message: "این روش پرداخت خاموش شده است. روش دیگری انتخاب کنید.",
        errors: { method: "روش پرداخت دیگری انتخاب کنید." },
      };
    }

    if (input.appointmentId && (await getAppointmentPatient(input.appointmentId)) !== input.patientId) {
      return { ok: false, message: "این نوبت مال مراجع دیگری است. نوبت را دوباره انتخاب کنید." };
    }

    const written = await insertPayment({
      patient_id: input.patientId,
      appointment_id: input.appointmentId,
      amount_toman: input.amountToman as number,
      payment_method_id: input.paymentMethodId,
      insurance_type_id: patient.insuranceTypeId,
      paid_at: input.paidAt,
      recorded_by: user.id,
      note: input.note.trim() || null,
    });
    if (!written.ok) return { ok: false, message: dbMessage(written.error, "پرداخت ثبت نشد. دوباره امتحان کنید.") };
    return { ok: true, value: written.value };
  } catch {
    return { ok: false, message: "پرداخت ثبت نشد. اتصال را بررسی کنید و دوباره امتحان کنید." };
  }
}

/**
 * ثبت معکوس: آینهٔ دقیق ردیف اصلی (H-2) با همان تاریخ پرداخت (H-3). ردیف اصلی از خود
 * پایگاه داده خوانده می‌شود، نه از مرورگر؛ منشی فقط پرداخت‌های امروز را می‌بیند (H-4 و 0010).
 */
export async function reversePayment(paymentId: string, reason: string): Promise<ActionResult<Payment>> {
  const user = await requireRole(["doctor", "secretary"]);

  const note = reason.trim();
  if (!note) return { ok: false, message: "علت را کوتاه بنویسید؛ در سابقهٔ پرداخت می‌ماند." };
  if (note.length > NOTE_MAX) return { ok: false, message: "علت حداکثر ۵۰۰ حرف باشد." };

  try {
    const original = await getPayment(paymentId);
    if (!original) {
      return {
        ok: false,
        message:
          user.role === "secretary"
            ? "این پرداخت پیدا نشد. پرداخت‌های روزهای قبل را فقط پزشک می‌تواند معکوس کند."
            : "این پرداخت پیدا نشد. صفحه را دوباره باز کنید.",
      };
    }

    // معکوس قبلی را پایگاه داده با یکتایی reverses_payment_id رد می‌کند
    const check = canReverse(original, new Map(), user.role, new Date());
    if (!check.ok) return { ok: false, message: check.reason };

    const written = await insertPayment({
      patient_id: original.patientId,
      appointment_id: original.appointmentId,
      amount_toman: -original.amountToman,
      payment_method_id: original.paymentMethodId,
      insurance_type_id: original.insuranceTypeId,
      paid_at: original.paidAt,
      recorded_by: user.id,
      reverses_payment_id: original.id,
      note,
    });
    if (!written.ok) return { ok: false, message: dbMessage(written.error, "ثبت معکوس انجام نشد. دوباره امتحان کنید.") };
    return { ok: true, value: written.value };
  } catch {
    return { ok: false, message: "ثبت معکوس انجام نشد. اتصال را بررسی کنید و دوباره امتحان کنید." };
  }
}

// ---------------------------------------------------------------------------
// بیمه‌ها و روش‌های پرداخت؛ فقط پزشک، و حذف ندارد

const isKind = (kind: string): kind is OptionKind => kind === "insurance" || kind === "method";
const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

export async function addFinanceOption(kind: OptionKind, name: string): Promise<ActionResult<Option>> {
  await requireRole(["doctor"]);
  if (!isKind(kind)) return { ok: false, message: "فهرست مشخص نیست." };
  try {
    const problem = optionNameError(name, await listOptions(kind));
    if (problem) return { ok: false, message: problem };
    const written = await insertOption(kind, cleanName(name));
    if (!written.ok) return { ok: false, message: dbMessage(written.error, "اضافه نشد. دوباره امتحان کنید.") };
    return { ok: true, value: written.value };
  } catch {
    return { ok: false, message: "اضافه نشد. اتصال را بررسی کنید و دوباره امتحان کنید." };
  }
}

export async function renameFinanceOption(kind: OptionKind, id: string, name: string): Promise<ActionResult<Option>> {
  await requireRole(["doctor"]);
  if (!isKind(kind)) return { ok: false, message: "فهرست مشخص نیست." };
  try {
    const problem = optionNameError(name, await listOptions(kind), id);
    if (problem) return { ok: false, message: problem };
    return saved(await updateOption(kind, id, { name: cleanName(name) }), "نام ذخیره نشد.");
  } catch {
    return { ok: false, message: "نام ذخیره نشد. اتصال را بررسی کنید و دوباره امتحان کنید." };
  }
}

export async function setFinanceOptionActive(
  kind: OptionKind,
  id: string,
  isActive: boolean,
): Promise<ActionResult<Option>> {
  await requireRole(["doctor"]);
  if (!isKind(kind)) return { ok: false, message: "فهرست مشخص نیست." };
  try {
    return saved(await updateOption(kind, id, { is_active: isActive }), "تغییر ذخیره نشد.");
  } catch {
    return { ok: false, message: "تغییر ذخیره نشد. اتصال را بررسی کنید و دوباره امتحان کنید." };
  }
}

function saved(
  written: Awaited<ReturnType<typeof updateOption>>,
  fallback: string,
): ActionResult<Option> {
  if (!written.ok) return { ok: false, message: dbMessage(written.error, `${fallback} دوباره امتحان کنید.`) };
  if (!written.value) return { ok: false, message: `${fallback} این مورد پیدا نشد؛ صفحه را دوباره باز کنید.` };
  return { ok: true, value: written.value };
}
