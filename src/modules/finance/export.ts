import { paymentsInRange, reversalsByOriginal } from "./data";
import { formatJalaliDate, tehranLocalToIso, tehranTime, toLatinDigits, toPersianDigits } from "./dates";
import type { Payment } from "./types";

type Names = {
  patientName: (patientId: string) => string;
  methodName: (methodId: string) => string;
  insuranceName: (insuranceId: string | null) => string;
};

const HEADERS = ["تاریخ", "ساعت", "مراجع", "مبلغ (تومان)", "روش پرداخت", "بیمه", "نوع", "توضیح"];

/**
 * یک خانهٔ متنی. متنی که با = یا + یا - یا @ شروع شود، در اکسل فرمول خوانده می‌شود و می‌تواند
 * کار ناخواسته‌ای بکند؛ پس یک ' جلویش می‌آید تا متن بماند.
 */
function textCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function kindOf(payment: Payment, reversals: Map<string, Payment>): string {
  if (payment.reversesPaymentId) return "ثبت معکوس";
  if (payment.amountToman < 0) return "برگشت پول";
  if (reversals.has(payment.id)) return "پرداخت (معکوس شده)";
  return "پرداخت";
}

/**
 * فهرست پرداخت‌های بازه برای حسابدار، به شکل فایل جدول که اکسل باز می‌کند.
 * نشانهٔ BOM در ابتدا هست تا اکسل نوشتهٔ فارسی را درست بخواند. مبلغ با رقم لاتین است تا اکسل
 * آن را عدد بداند و بتواند جمع بزند؛ تاریخ و ساعت با رقم فارسی، تا اکسل آن را تاریخ میلادی نپندارد.
 */
export function paymentsCsv(
  payments: Payment[],
  range: { from: string; to: string },
  names: Names,
): string {
  const reversals = reversalsByOriginal(payments);
  const rows = paymentsInRange(payments, range)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.createdAt.localeCompare(b.createdAt))
    .map((payment) =>
      [
        textCell(formatJalaliDate(payment.paidAt)),
        textCell(toPersianDigits(tehranTime(payment.paidAt))),
        textCell(names.patientName(payment.patientId)),
        String(payment.amountToman),
        textCell(names.methodName(payment.paymentMethodId)),
        textCell(names.insuranceName(payment.insuranceTypeId)),
        textCell(kindOf(payment, reversals)),
        textCell(payment.note ?? ""),
      ].join(","),
    );
  return `\uFEFF${[HEADERS.map(textCell).join(","), ...rows].join("\r\n")}\r\n`;
}

/** «payments-1405-08-01-to-1405-08-30.csv»؛ نام فایل با رقم لاتین، تا در هر سیستمی باز شود */
export function csvFileName(range: { from: string; to: string }): string {
  const jalali = (dayKey: string) =>
    toLatinDigits(formatJalaliDate(tehranLocalToIso(dayKey, "12:00"))).replace(/\//g, "-");
  return `payments-${jalali(range.from)}-to-${jalali(range.to)}.csv`;
}
