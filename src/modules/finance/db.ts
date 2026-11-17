import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { FinanceOptions } from "./data";
import type { Appointment, FinanceData, Option, Patient, Payment, Profile } from "./types";

/**
 * تنها جای خواندن و نوشتن جدول‌های مالی در پایگاه داده (کار p3-06).
 *
 * چرا جدا از data.ts: data.ts قاعده‌هایی دارد که صفحه‌ها در مرورگر هم اجرا می‌کنند (فیلتر،
 * گروه‌بندی روز، گزارش). اگر کلاینت سرور که کوکی می‌خواند آن‌جا بود، کد مرورگر هم آن را
 * می‌کشید و ساخت می‌شکست. پس این فایل server-only است و data.ts بی‌تغییر برای هر دو طرف می‌ماند.
 *
 * همه‌چیز با نشست خود کاربر خوانده و نوشته می‌شود، نه کلید مدیریتی، تا RLS واقعاً اعمال شود:
 * منشی فقط پرداخت‌های امروز را می‌بیند (H-4 و 0010)، فقط پزشک بیمه و روش پرداخت را تغییر
 * می‌دهد، و پرداخت ویرایش و حذف ندارد.
 */

type Tables = Database["public"]["Tables"];
type PaymentRow = Tables["payments"]["Row"];
type PaymentInsert = Tables["payments"]["Insert"];

/** PostgREST بیش از این تعداد ردیف را در یک پاسخ نمی‌دهد؛ بیشترش صفحه‌به‌صفحه خوانده می‌شود */
const PAGE = 1000;

/** گزارش ماه‌ها را تا یک سال پیش از سه ماه اخیر می‌سنجد؛ پرداخت‌های قدیمی‌تر لازم نیست */
const PAYMENT_HISTORY_DAYS = 500;

/** فرم پرداخت نوبت‌های همین روزها را پیشنهاد می‌دهد */
const APPOINTMENT_DAYS_BACK = 45;

const DAY_MS = 24 * 60 * 60_000;

export class FinanceDbError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

const fail = (what: string, error: PostgrestError | null) =>
  new FinanceDbError(`${what} از پایگاه داده خوانده نشد.`, error?.code);

async function readAll<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  what: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1);
    if (error) throw fail(what, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export const toPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  patientId: row.patient_id,
  appointmentId: row.appointment_id,
  amountToman: Number(row.amount_toman),
  paymentMethodId: row.payment_method_id,
  insuranceTypeId: row.insurance_type_id,
  paidAt: row.paid_at,
  recordedBy: row.recorded_by,
  reversesPaymentId: row.reverses_payment_id,
  note: row.note,
  createdAt: row.created_at,
});

const toOption = (row: { id: string; name: string; is_active: boolean }): Option => ({
  id: row.id,
  name: row.name,
  isActive: row.is_active,
});

// ---------------------------------------------------------------------------
// خواندن

/** همهٔ داده‌ای که صفحهٔ پرداخت‌ها و گزارش لازم دارند، به اندازهٔ دسترسی کاربر واردشده */
export async function getFinanceData(now: Date): Promise<FinanceData> {
  const supabase = await createClient();
  const paymentsSince = new Date(now.getTime() - PAYMENT_HISTORY_DAYS * DAY_MS).toISOString();
  const appointmentsFrom = new Date(now.getTime() - APPOINTMENT_DAYS_BACK * DAY_MS).toISOString();
  const appointmentsTo = new Date(now.getTime() + 2 * DAY_MS).toISOString();

  const [profiles, patients, appointments, options, payments] = await Promise.all([
    // منشی فقط نمایهٔ خودش را می‌خواند؛ نام ثبت‌کننده‌های دیگر برایش «—» می‌شود
    supabase.from("profiles").select("user_id, full_name, role"),
    readAll(
      (from, to) =>
        supabase.from("patients").select("id, full_name, mobile, insurance_type_id").order("id").range(from, to),
      "فهرست مراجعان",
    ),
    supabase
      .from("appointments")
      .select("id, patient_id, starts_at, status")
      .not("patient_id", "is", null)
      .gte("starts_at", appointmentsFrom)
      .lte("starts_at", appointmentsTo),
    getFinanceOptions(),
    readAll(
      (from, to) =>
        supabase
          .from("payments")
          .select("*")
          .gte("paid_at", paymentsSince)
          .order("paid_at", { ascending: false })
          .order("id")
          .range(from, to),
      "پرداخت‌ها",
    ),
  ]);

  if (profiles.error) throw fail("نام کاربران", profiles.error);
  if (appointments.error) throw fail("نوبت‌ها", appointments.error);

  return {
    profiles: (profiles.data ?? []).map(
      (row): Profile => ({ userId: row.user_id, fullName: row.full_name, role: row.role as Profile["role"] }),
    ),
    patients: patients.map(
      (row): Patient => ({
        id: row.id,
        fullName: row.full_name,
        mobile: row.mobile,
        insuranceTypeId: row.insurance_type_id,
      }),
    ),
    appointments: (appointments.data ?? []).flatMap((row): Appointment[] =>
      row.patient_id
        ? [{ id: row.id, patientId: row.patient_id, startsAt: row.starts_at, status: row.status as Appointment["status"] }]
        : [],
    ),
    paymentMethods: options.paymentMethods,
    insuranceTypes: options.insuranceTypes,
    payments: payments.map(toPayment),
  };
}

export type OptionKind = "insurance" | "method";

const TABLE = { insurance: "insurance_types", method: "payment_methods" } as const;

/** دو فهرست، روشن و خاموش با هم؛ خاموش‌ها برای نام پرداخت‌های قبلی لازم‌اند */
export async function getFinanceOptions(): Promise<FinanceOptions> {
  const supabase = await createClient();
  const [methods, insurances] = await Promise.all([
    supabase.from("payment_methods").select("id, name, is_active").order("created_at"),
    supabase.from("insurance_types").select("id, name, is_active").order("created_at"),
  ]);
  if (methods.error) throw fail("روش‌های پرداخت", methods.error);
  if (insurances.error) throw fail("نوع بیمه‌ها", insurances.error);
  return {
    paymentMethods: (methods.data ?? []).map(toOption),
    insuranceTypes: (insurances.data ?? []).map(toOption),
  };
}

/**
 * نوع بیمه‌های روشن، برای فرم مراجع (نفر دوم) و فرم پرداخت.
 * بیمهٔ خاموش در فرم تازه نمی‌آید، ولی در پرداخت‌ها و گزارش‌های قبلی می‌ماند.
 */
export async function getActiveInsuranceTypes(): Promise<Option[]> {
  return (await getFinanceOptions()).insuranceTypes.filter((option) => option.isActive);
}

export async function listOptions(kind: OptionKind): Promise<Option[]> {
  const options = await getFinanceOptions();
  return kind === "insurance" ? options.insuranceTypes : options.paymentMethods;
}

/** یک پرداخت، اگر کاربر اجازهٔ دیدنش را دارد؛ منشی فقط پرداخت‌های امروز را می‌بیند */
export async function getPayment(id: string): Promise<Payment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (error) throw fail("پرداخت", error);
  return data ? toPayment(data) : null;
}

/** بیمهٔ همین لحظهٔ مراجع، برای تصویر لحظهٔ ثبت (H-1)؛ null یعنی مراجعی با این شناسه نیست */
export async function getPatientInsurance(patientId: string): Promise<{ insuranceTypeId: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("insurance_type_id")
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw fail("مراجع", error);
  return data ? { insuranceTypeId: data.insurance_type_id } : null;
}

/** مراجعِ یک نوبت، تا پرداخت به نوبت کس دیگری وصل نشود */
export async function getAppointmentPatient(appointmentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw fail("نوبت", error);
  return data?.patient_id ?? null;
}

// ---------------------------------------------------------------------------
// نوشتن؛ خطای پایگاه داده همان‌طور برمی‌گردد تا action پیام فارسی درست را بگذارد

export type Written<T> = { ok: true; value: T } | { ok: false; error: PostgrestError };

export async function insertPayment(row: PaymentInsert): Promise<Written<Payment>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").insert(row).select("*").single();
  return error ? { ok: false, error } : { ok: true, value: toPayment(data) };
}

export async function insertOption(kind: OptionKind, name: string): Promise<Written<Option>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .insert({ name })
    .select("id, name, is_active")
    .single();
  return error ? { ok: false, error } : { ok: true, value: toOption(data) };
}

/** null یعنی هیچ ردیفی عوض نشد؛ RLS به جای خطا، بی‌صدا هیچ ردیفی را برنمی‌گرداند */
export async function updateOption(
  kind: OptionKind,
  id: string,
  patch: { name?: string; is_active?: boolean },
): Promise<Written<Option | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .update(patch)
    .eq("id", id)
    .select("id, name, is_active")
    .maybeSingle();
  return error ? { ok: false, error } : { ok: true, value: data ? toOption(data) : null };
}
