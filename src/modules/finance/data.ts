import {
  addDays,
  daysSinceSaturday,
  jalaliMonthLength,
  jalaliParts,
  jalaliToDayKey,
  tehranDayKey,
} from "./dates";
import { buildMockFinanceData, insuranceTypes, paymentMethods } from "./mock";
import { MAX_AMOUNT_TOMAN } from "./money";
import type { Appointment, FinanceData, Option, Patient, Payment, Role } from "./types";

/**
 * خواندن داده و قاعده‌های ثبت پرداخت.
 *
 * فعلاً داده از mock.ts می‌آید و ثبت‌ها فقط در همان صفحه نگه داشته می‌شوند. در کار p3-06
 * فقط getFinanceData و ثبت‌ها به Supabase وصل می‌شوند؛ همان قاعده‌ها را پایگاه داده هم
 * اجبار می‌کند (trigger و RLS)، و این‌جا هستند تا کاربر پیش از ثبت، پیام روشن ببیند.
 */

export async function getFinanceData(now: Date): Promise<FinanceData> {
  return buildMockFinanceData(now);
}

// ---------------------------------------------------------------------------
// چه کسی چه چیزی را می‌بیند — تصمیم H-4 / 0010

/**
 * پزشک همهٔ پرداخت‌ها را می‌بیند؛ منشی فقط پرداخت‌هایی که تاریخ پرداختشان امروز است، به وقت تهران.
 * در پایگاه داده همین قاعده با RLS اعمال می‌شود؛ این‌جا فقط تصویر همان است، نه قفل.
 */
export function visiblePayments(payments: Payment[], role: Role, now: Date): Payment[] {
  if (role === "doctor") return payments;
  const today = tehranDayKey(now);
  return payments.filter((payment) => tehranDayKey(payment.paidAt) === today);
}

/** ردیف معکوسِ هر پرداخت، به شناسهٔ پرداخت اصلی */
export function reversalsByOriginal(payments: Payment[]): Map<string, Payment> {
  const map = new Map<string, Payment>();
  for (const payment of payments) {
    if (payment.reversesPaymentId) map.set(payment.reversesPaymentId, payment);
  }
  return map;
}

export type ReverseCheck = { ok: true } | { ok: false; reason: string };

export function canReverse(
  payment: Payment,
  reversals: Map<string, Payment>,
  role: Role,
  now: Date,
): ReverseCheck {
  if (payment.reversesPaymentId) {
    return { ok: false, reason: "این ردیف خودش ثبت معکوس است و دوباره معکوس نمی‌شود." };
  }
  if (reversals.has(payment.id)) {
    return { ok: false, reason: "این پرداخت قبلاً معکوس شده است." };
  }
  if (payment.amountToman < 0) {
    return { ok: false, reason: "این ردیف برگشت پول است و معکوس نمی‌شود." };
  }
  if (role === "secretary" && tehranDayKey(payment.paidAt) !== tehranDayKey(now)) {
    return {
      ok: false,
      reason: "پرداخت‌های روزهای قبل را فقط پزشک می‌تواند معکوس کند. برای اصلاح با پزشک هماهنگ کنید.",
    };
  }
  return { ok: true };
}

/**
 * ردیف معکوس: آینهٔ دقیق ردیف اصلی (تصمیم H-2) با همان تاریخ پرداخت (تصمیم H-3).
 * فقط مبلغ قرینه می‌شود؛ مراجع، نوبت، روش پرداخت و بیمه همان ردیف اصلی‌اند.
 */
export function buildReversal(
  original: Payment,
  reason: string,
  recordedBy: string,
  now: Date,
): Payment {
  return {
    id: crypto.randomUUID(),
    patientId: original.patientId,
    appointmentId: original.appointmentId,
    amountToman: -original.amountToman,
    paymentMethodId: original.paymentMethodId,
    insuranceTypeId: original.insuranceTypeId,
    paidAt: original.paidAt,
    recordedBy,
    reversesPaymentId: original.id,
    note: reason.trim(),
    createdAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ثبت پرداخت تازه

export type NewPayment = {
  patientId: string | null;
  appointmentId: string | null;
  amountToman: number | null;
  paymentMethodId: string | null;
  /** null یعنی تاریخ یا ساعت واردشده معتبر نبود */
  paidAt: string | null;
  note: string;
};

export type NewPaymentErrors = Partial<Record<"patient" | "amount" | "method" | "paidAt", string>>;

// چند دقیقه فاصله تا اختلاف ساعت دستگاه‌ها ثبت درست را رد نکند
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** پیام‌ها کوتاه و کاری‌اند (brand-voice بخش ۵: پنل) و می‌گویند حالا چه کار کنید */
export function validateNewPayment(input: NewPayment, now: Date): NewPaymentErrors {
  const errors: NewPaymentErrors = {};
  if (!input.patientId) errors.patient = "مراجع را از فهرست انتخاب کنید.";
  if (!input.amountToman) errors.amount = "مبلغ را به تومان بنویسید.";
  else if (input.amountToman > MAX_AMOUNT_TOMAN) errors.amount = "این مبلغ بیش از اندازه است. رقم را بررسی کنید.";
  if (!input.paymentMethodId) errors.method = "روش پرداخت را انتخاب کنید.";
  if (!input.paidAt) {
    errors.paidAt = "تاریخ را به شکل ۱۴۰۵/۰۸/۰۶ و ساعت را کامل بنویسید.";
  } else if (new Date(input.paidAt).getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.paidAt = "زمان پرداخت بعد از الان است. تاریخ و ساعت را بررسی کنید.";
  }
  return errors;
}

// دو ثبت یکسان در این فاصله به احتمال زیاد یک پرداخت‌اند که دو بار ثبت شده
const DUPLICATE_WINDOW_MS = 10 * 60_000;

/**
 * پرداختی که همین چند دقیقه پیش برای همین مراجع و با همین مبلغ ثبت شده.
 * جلوی ثبت را نمی‌گیرد و فرم فقط می‌پرسد، چون دو پرداخت جدا با یک مبلغ هم ممکن است.
 * پرداختی که معکوس شده حساب نمی‌شود؛ ثبت دوباره‌اش همان اصلاح درست است.
 */
export function findRecentDuplicate(
  input: NewPayment,
  payments: Payment[],
  now: Date,
): Payment | null {
  const reversals = reversalsByOriginal(payments);
  const matches = payments.filter((payment) => {
    const elapsed = now.getTime() - new Date(payment.createdAt).getTime();
    return (
      payment.patientId === input.patientId &&
      payment.amountToman === input.amountToman &&
      !reversals.has(payment.id) &&
      elapsed >= 0 &&
      elapsed <= DUPLICATE_WINDOW_MS
    );
  });
  return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** نوبت‌هایی که پرداخت می‌گیرند: مراجع آمده یا قرار است بیاید */
export const PAYABLE_STATUSES: Appointment["status"][] = ["confirmed", "arrived", "done"];

/**
 * نوبت امروزِ مراجع که هنوز پرداختی رویش نیست؛ فرم همین را از پیش انتخاب می‌کند.
 * پرداخت معکوس‌شده حساب نمی‌شود، چون آن نوبت در عمل هنوز پرداخت نشده است.
 */
export function suggestAppointment(
  appointments: Appointment[],
  payments: Payment[],
  patientId: string,
  now: Date,
): Appointment | null {
  const today = tehranDayKey(now);
  const reversals = reversalsByOriginal(payments);
  const paid = new Set(
    payments
      .filter((payment) => payment.amountToman > 0 && !reversals.has(payment.id))
      .map((payment) => payment.appointmentId),
  );
  const candidates = appointments.filter(
    (appointment) =>
      appointment.patientId === patientId &&
      PAYABLE_STATUSES.includes(appointment.status) &&
      tehranDayKey(appointment.startsAt) === today &&
      !paid.has(appointment.id),
  );
  return candidates.sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
}

/** نوع بیمه هنگام ثبت از مراجع کپی می‌شود و بعد عوض نمی‌شود (تصمیم H-1) */
export function buildPayment(
  input: NewPayment,
  patient: Patient,
  recordedBy: string,
  now: Date,
): Payment {
  return {
    id: crypto.randomUUID(),
    patientId: patient.id,
    appointmentId: input.appointmentId,
    amountToman: input.amountToman ?? 0,
    paymentMethodId: input.paymentMethodId ?? "",
    insuranceTypeId: patient.insuranceTypeId,
    paidAt: input.paidAt ?? now.toISOString(),
    recordedBy,
    reversesPaymentId: null,
    note: input.note.trim() || null,
    createdAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// فیلترهای فهرست — فقط برای پزشک (منشی بازهٔ تاریخ ندارد)

export type DateRange = { from: string; to: string } | null;

export type PaymentFilters = {
  range: DateRange;
  paymentMethodId: string | null;
  patientId: string | null;
};

export type RangePreset = "all" | "today" | "week" | "month" | "lastMonth";

/** بازهٔ هر گزینهٔ آماده، به کلید روز تهران؛ هفته از شنبه و ماه شمسی */
export function presetRange(preset: RangePreset, now: Date): DateRange {
  const today = tehranDayKey(now);
  if (preset === "all") return null;
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: addDays(today, -daysSinceSaturday(now)), to: today };
  const { jy, jm } = jalaliParts(now);
  const [y, m] = preset === "month" ? [jy, jm] : jm === 1 ? [jy - 1, 12] : [jy, jm - 1];
  return { from: jalaliToDayKey(y, m, 1), to: jalaliToDayKey(y, m, jalaliMonthLength(y, m)) };
}

export function filterPayments(payments: Payment[], filters: PaymentFilters): Payment[] {
  return payments.filter((payment) => {
    if (filters.range) {
      const day = tehranDayKey(payment.paidAt);
      if (day < filters.range.from || day > filters.range.to) return false;
    }
    if (filters.paymentMethodId && payment.paymentMethodId !== filters.paymentMethodId) return false;
    if (filters.patientId && payment.patientId !== filters.patientId) return false;
    return true;
  });
}

export type DayGroup = {
  /** کلید روز تهران */
  dayKey: string;
  payments: Payment[];
  /** جمع خالص روز، با ثبت‌های معکوس */
  totalToman: number;
  paymentCount: number;
  reversalCount: number;
};

/**
 * ردیف‌های مرتب‌شده را روزبه‌روز، به وقت تهران، دسته می‌کند؛ ترتیب ردیف‌ها دست نمی‌خورد.
 * ثبت معکوس همیشه در روز پرداخت اصلی‌اش می‌نشیند، چون تاریخ پرداختش همان است (تصمیم H-3).
 */
export function groupByDay(payments: Payment[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const payment of payments) {
    const dayKey = tehranDayKey(payment.paidAt);
    let group = groups.at(-1);
    if (!group || group.dayKey !== dayKey) {
      group = { dayKey, payments: [], totalToman: 0, paymentCount: 0, reversalCount: 0 };
      groups.push(group);
    }
    group.payments.push(payment);
    group.totalToman += payment.amountToman;
    if (payment.reversesPaymentId) group.reversalCount += 1;
    else group.paymentCount += 1;
  }
  return groups;
}

/** تازه‌ترین پرداخت بالا؛ ردیف معکوس درست زیر پرداخت اصلی‌اش */
export function sortPayments(payments: Payment[]): Payment[] {
  return [...payments].sort(
    (a, b) =>
      b.paidAt.localeCompare(a.paidAt) ||
      Number(Boolean(a.reversesPaymentId)) - Number(Boolean(b.reversesPaymentId)) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

// ---------------------------------------------------------------------------
// تنظیم بیمه‌ها و روش‌های پرداخت (کار p3-07)

export type FinanceOptions = { paymentMethods: Option[]; insuranceTypes: Option[] };

/** دو فهرست صفحهٔ تنظیمات؛ در کار p3-06 از جدول‌های payment_methods و insurance_types */
export async function getFinanceOptions(): Promise<FinanceOptions> {
  return {
    paymentMethods: paymentMethods.map((option) => ({ ...option })),
    insuranceTypes: insuranceTypes.map((option) => ({ ...option })),
  };
}

/**
 * نوع بیمه‌های روشن، برای فرم مراجع (نفر دوم) و فرم پرداخت.
 * بیمهٔ خاموش در فرم تازه نمی‌آید، ولی در پرداخت‌ها و گزارش‌های قبلی می‌ماند.
 */
export async function getActiveInsuranceTypes(): Promise<Option[]> {
  return (await getFinanceOptions()).insuranceTypes.filter((option) => option.isActive);
}

/** نامی که می‌شود به فهرست داد؛ اگر نه، پیام خطا. نام تکراری با فاصلهٔ اضافه هم تکراری است */
export function optionNameError(name: string, options: Option[], exceptId?: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "نام را بنویسید.";
  if (clean.length > 40) return "نام حداکثر ۴۰ حرف باشد.";
  const taken = options.some((option) => option.id !== exceptId && option.name.trim() === clean);
  return taken ? "این نام در فهرست هست." : null;
}
