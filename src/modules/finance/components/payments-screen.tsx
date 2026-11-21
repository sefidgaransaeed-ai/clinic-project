"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { recordPayment, reversePayment } from "../actions";
import {
  filterPayments,
  reversalsByOriginal,
  sortPayments,
  visiblePayments,
  type NewPayment,
  type PaymentFilters,
} from "../data";
import { tehranDayKey } from "../dates";
import type { FinanceData, Payment, Role } from "../types";
import { PaymentFiltersBar } from "./payment-filters";
import { PaymentForm, type SubmitOutcome } from "./payment-form";
import { PaymentsList, type Lookups } from "./payments-list";
import { ReverseDialog } from "./reverse-dialog";
import { card } from "./styles";
import { TodayMonitor } from "./today-monitor";

const NO_FILTERS: PaymentFilters = { range: null, paymentMethodId: null, patientId: null };

// همان مدت انیمیشن fin-fresh در theme.css
const FRESH_MS = 4000;

/**
 * صفحهٔ پرداخت‌ها: فرم ثبت و فهرست.
 * ثبت و ثبت معکوس در پایگاه داده ذخیره می‌شوند (کار p3-06). ردیفی که سرور برگرداند همین‌جا به
 * فهرست اضافه می‌شود تا بی‌بارگذاری دوباره دیده شود؛ بار بعد از خود پایگاه داده می‌آید.
 */
export function PaymentsScreen({
  data,
  role,
  nowIso,
}: {
  data: FinanceData;
  /** نقش حساب واردشده، از سرور */
  role: Role;
  nowIso: string;
}) {
  // «امروز» همان لحظه‌ای است که صفحه ساخته شد، تا سرور و مرورگر یک چیز نشان دهند
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const [added, setAdded] = useState<Payment[]>([]);
  const [filters, setFilters] = useState<PaymentFilters>(NO_FILTERS);
  const [reverseTarget, setReverseTarget] = useState<Payment | null>(null);
  const [message, setMessage] = useState("");
  // ردیفی که همین الان ثبت شد چند ثانیه رنگی می‌ماند تا معلوم باشد کجای فهرست نشست
  const [freshId, setFreshId] = useState<string | null>(null);

  useEffect(() => {
    if (!freshId) return;
    const timer = setTimeout(() => setFreshId(null), FRESH_MS);
    return () => clearTimeout(timer);
  }, [freshId]);

  // هر ردیف یک بار، حتی اگر صفحه تازه شود و ردیف ثبت‌شده هم از سرور بیاید
  const allPayments = useMemo(() => {
    const byId = new Map(data.payments.map((payment) => [payment.id, payment]));
    for (const payment of added) byId.set(payment.id, payment);
    return [...byId.values()];
  }, [data.payments, added]);
  const reversals = useMemo(() => reversalsByOriginal(allPayments), [allPayments]);

  const visible = visiblePayments(allPayments, role, now);
  const todayEntries = allPayments.filter(
    (payment) => tehranDayKey(payment.paidAt) === tehranDayKey(now),
  );
  const listed = sortPayments(role === "doctor" ? filterPayments(visible, filters) : visible);

  const lookups: Lookups = {
    patientName: (patientId) =>
      data.patients.find((patient) => patient.id === patientId)?.fullName ?? "—",
    methodName: (methodId) =>
      data.paymentMethods.find((method) => method.id === methodId)?.name ?? "—",
    insuranceName: (insuranceId) =>
      data.insuranceTypes.find((insurance) => insurance.id === insuranceId)?.name ?? "بدون بیمه",
  };

  const register = async (input: NewPayment): Promise<SubmitOutcome> => {
    setMessage("");
    const result = await recordPayment(input);
    if (!result.ok) return { ok: false, message: result.message, errors: result.errors };
    const payment = result.value;
    setAdded((current) => [...current, payment]);
    setFreshId(payment.id);
    const notToday = tehranDayKey(payment.paidAt) !== tehranDayKey(now);
    setMessage(
      role === "secretary" && notToday
        ? "پرداخت ثبت شد. چون تاریخش امروز نیست، در فهرست امروز شما دیده نمی‌شود."
        : "پرداخت ثبت شد.",
    );
    return { ok: true };
  };

  const reverse = async (reason: string): Promise<string | null> => {
    if (!reverseTarget) return null;
    const result = await reversePayment(reverseTarget.id, reason);
    if (!result.ok) return result.message;
    const reversal = result.value;
    setAdded((current) => [...current, reversal]);
    setFreshId(reversal.id);
    setReverseTarget(null);
    setMessage("ثبت معکوس انجام شد. پرداخت اصلی سر جایش ماند.");
    return null;
  };

  const emptyText =
    allPayments.length === 0
      ? "هنوز پرداختی ثبت نشده"
      : role === "secretary"
        ? "امروز هنوز پرداختی ثبت نشده"
        : "پرداختی با این فیلترها پیدا نشد";

  return (
    <div className="finance-theme mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-(--fin-navy)">پرداخت‌ها</h1>
          <p className="mt-1 text-(--fin-muted)">
            {role === "doctor"
              ? "دفتر همهٔ پرداخت‌ها و ثبت‌های معکوس، روزبه‌روز."
              : "پرداخت‌های امروز. پرداخت‌های روزهای قبل را فقط پزشک می‌بیند."}
          </p>
        </div>
        {/* فقط راهنماست، نه قفل؛ قفل گزارش سمت سرور است */}
        {role === "doctor" && (
          <Link
            href="/panel/finance-report"
            className="text-sm font-bold text-(--fin-blue) underline-offset-4 hover:underline"
          >
            گزارش مالی ←
          </Link>
        )}
      </header>

      <TodayMonitor
        now={now}
        role={role}
        entries={todayEntries}
        reversals={reversals}
        lookups={lookups}
        freshId={freshId}
      />

      <p role="status" aria-live="polite" className="empty:hidden rounded-xl bg-(--fin-green-soft) px-4 py-3 font-bold text-(--fin-green)">
        {message}
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[22rem_1fr]">
        <PaymentForm
          patients={data.patients}
          appointments={data.appointments}
          payments={allPayments}
          paymentMethods={data.paymentMethods}
          initialNow={nowIso}
          onSubmit={register}
        />

        <section aria-labelledby="payments-list-title" className={card}>
          <h2 id="payments-list-title" className="mb-4 text-lg font-black text-(--fin-navy)">
            {role === "doctor" ? "دفتر پرداخت‌ها" : "پرداخت‌های امروز"}
          </h2>
          {role === "doctor" && (
            <div className="mb-5">
              <PaymentFiltersBar
                filters={filters}
                onChange={setFilters}
                paymentMethods={data.paymentMethods}
                patients={data.patients}
                now={now}
              />
            </div>
          )}
          <PaymentsList
            payments={listed}
            allPayments={allPayments}
            reversals={reversals}
            role={role}
            now={now}
            lookups={lookups}
            emptyText={emptyText}
            freshId={freshId}
            onReverse={setReverseTarget}
          />
        </section>
      </div>

      <ReverseDialog
        payment={reverseTarget}
        patientName={reverseTarget ? lookups.patientName(reverseTarget.patientId) : ""}
        methodName={reverseTarget ? lookups.methodName(reverseTarget.paymentMethodId) : ""}
        onConfirm={reverse}
        onClose={() => setReverseTarget(null)}
      />
    </div>
  );
}
