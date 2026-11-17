"use client";

import { useId } from "react";
import { canReverse, groupByDay, type ReverseCheck } from "../data";
import {
  addDays,
  formatJalaliLongDate,
  formatWeekday,
  tehranDayKey,
  tehranLocalToIso,
  tehranTime,
  toPersianDigits,
} from "../dates";
import type { Payment, Role } from "../types";
import { smallButton } from "./styles";
import { Toman } from "./toman";

export type Lookups = {
  patientName: (patientId: string) => string;
  methodName: (methodId: string) => string;
  insuranceName: (insuranceId: string | null) => string;
};

type Row = {
  payment: Payment;
  reversal: Payment | null;
  original: Payment | null;
  check: ReverseCheck;
};

/**
 * فهرست پرداخت‌ها به شکل دفتر روزنامه: هر روز سرتیتر خودش را دارد و روزها روی یک ستون
 * با مهره‌های نارنجی چیده می‌شوند (همان نشانهٔ ستون سایت). در صفحهٔ پهن هر ردیف یک سطر جدول
 * است و در موبایل یک کارت. ثبت معکوس مثل اصلاح با جوهر قرمز است: پرداخت اصلی سر جایش می‌ماند
 * و ردیف قرمز زیرش با یک قلاب به آن وصل می‌شود.
 */
export function PaymentsList({
  payments,
  allPayments,
  reversals,
  role,
  now,
  lookups,
  emptyText,
  freshId,
  onReverse,
}: {
  payments: Payment[];
  allPayments: Payment[];
  reversals: Map<string, Payment>;
  role: Role;
  now: Date;
  lookups: Lookups;
  emptyText: string;
  /** ردیفی که همین الان ثبت شد و چند ثانیه هلویی می‌ماند */
  freshId: string | null;
  onReverse: (payment: Payment) => void;
}) {
  const id = useId();

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-(--fin-grey) px-6 py-12 text-center">
        <span aria-hidden="true" className="flex gap-1">
          <span className="h-2.5 w-5 rounded-sm bg-(--fin-orange)/40" />
          <span className="h-2.5 w-7 rounded-sm bg-(--fin-orange)" />
          <span className="h-2.5 w-5 rounded-sm bg-(--fin-orange)/40" />
        </span>
        <p className="font-bold text-(--fin-navy)">{emptyText}</p>
        <p className="text-sm text-(--fin-muted)">پرداخت تازه را از فرم «ثبت پرداخت» وارد کنید.</p>
      </div>
    );
  }

  // جمع روز فقط برای پزشک؛ منشی «جمع‌زنی» نمی‌بیند (تصمیم H-4)
  const showTotals = role === "doctor";
  const today = tehranDayKey(now);
  const yesterday = addDays(today, -1);
  const groups = groupByDay(payments);
  const byId = new Map(allPayments.map((payment) => [payment.id, payment]));

  const toRow = (payment: Payment): Row => ({
    payment,
    reversal: reversals.get(payment.id) ?? null,
    original: payment.reversesPaymentId ? (byId.get(payment.reversesPaymentId) ?? null) : null,
    check: canReverse(payment, reversals, role, now),
  });

  const dayTitle = (dayKey: string) => {
    // ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود
    const noon = tehranLocalToIso(dayKey, "12:00");
    if (dayKey === today) return { main: "امروز", detail: `${formatWeekday(noon)} ${formatJalaliLongDate(noon)}` };
    if (dayKey === yesterday) return { main: "دیروز", detail: `${formatWeekday(noon)} ${formatJalaliLongDate(noon)}` };
    return { main: formatWeekday(noon), detail: formatJalaliLongDate(noon) };
  };

  const status = (row: Row) => {
    if (row.original) {
      return (
        <span className="text-sm">
          <span className="rounded-md bg-(--fin-red-soft) px-2 py-0.5 font-bold text-(--fin-red)">
            ثبت معکوس
          </span>{" "}
          <a
            href={`#payment-${row.original.id}`}
            className="text-(--fin-blue) underline-offset-4 hover:underline"
          >
            برای پرداخت ساعت {toPersianDigits(tehranTime(row.original.paidAt))}
          </a>
        </span>
      );
    }
    if (row.reversal) {
      return (
        <a
          href={`#payment-${row.reversal.id}`}
          className="rounded-md bg-(--fin-grey-soft) px-2 py-0.5 text-sm font-bold text-(--fin-muted) hover:underline"
        >
          معکوس شده
        </a>
      );
    }
    if (row.payment.amountToman < 0) {
      return <span className="text-sm text-(--fin-muted)">برگشت پول</span>;
    }
    return null;
  };

  const action = (row: Row) => {
    // برای ردیف معکوس و پرداخت معکوس‌شده دکمه غیرفعال است و علتش برای صفحه‌خوان گفته می‌شود
    const reasonId = `${id}-${row.payment.id}-reason`;
    return (
      <>
        <button
          type="button"
          className={smallButton}
          disabled={!row.check.ok}
          aria-describedby={row.check.ok ? undefined : reasonId}
          title={row.check.ok ? undefined : row.check.reason}
          onClick={() => onReverse(row.payment)}
        >
          ثبت معکوس
        </button>
        {!row.check.ok && (
          <span id={reasonId} className="sr-only">
            {row.check.reason}
          </span>
        )}
      </>
    );
  };

  const amount = (payment: Payment) => (
    <Toman
      amount={payment.amountToman}
      className={`font-bold ${payment.amountToman < 0 ? "text-(--fin-red)" : "text-(--fin-navy)"}`}
    />
  );

  const renderRow = (row: Row) => (
    <li
      key={row.payment.id}
      id={`payment-${row.payment.id}`}
      className={`relative grid scroll-mt-24 grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl border p-4 text-sm target:outline-2 target:outline-(--fin-orange) lg:grid-cols-(--fin-row) lg:items-center lg:rounded-none lg:border-0 lg:border-b lg:px-3 lg:py-3 ${
        row.original
          ? // قلاب قرمز در فاصلهٔ ستون و ردیف: از وسط پرداخت اصلی (ردیف بالا) تا وسط همین ردیف
            "border-(--fin-red)/25 bg-(--fin-red-soft)/60 lg:before:absolute lg:before:-start-4 lg:before:-top-7.5 lg:before:bottom-1/2 lg:before:w-3 lg:before:rounded-s-md lg:before:border-y-2 lg:before:border-s-2 lg:before:border-(--fin-red)/55"
          : "border-(--fin-grey) bg-white"
      } ${row.payment.id === freshId ? "animate-[fin-fresh_4s_ease-out]" : ""}`}
    >
      <span className="order-2 col-span-2 text-(--fin-muted) lg:order-none lg:col-span-1 lg:text-(--fin-ink)">
        <span className="sr-only">ساعت پرداخت: </span>
        {toPersianDigits(tehranTime(row.payment.paidAt))}
      </span>
      <span className="order-1 font-bold text-(--fin-navy) lg:order-none lg:font-medium lg:text-(--fin-ink)">
        <span className="sr-only">مراجع: </span>
        {lookups.patientName(row.payment.patientId)}
      </span>
      <span className="order-1 text-end lg:order-none lg:text-start">
        <span className="sr-only">مبلغ: </span>
        {amount(row.payment)}
      </span>
      <span className="order-3 lg:order-none">
        <span className="sr-only">روش: </span>
        {lookups.methodName(row.payment.paymentMethodId)}
      </span>
      <span className="order-3 text-(--fin-muted) lg:order-none">
        <span className="sr-only">بیمه: </span>
        {lookups.insuranceName(row.payment.insuranceTypeId)}
      </span>
      <span className="order-4 col-span-2 flex flex-col gap-1 empty:hidden lg:order-none lg:empty:flex lg:col-span-1">
        {status(row)}
        {row.payment.note && <span className="text-(--fin-muted)">{row.payment.note}</span>}
      </span>
      <span className="order-5 col-span-2 mt-1 lg:order-none lg:col-span-1 lg:mt-0 lg:text-end">
        {action(row)}
      </span>
    </li>
  );

  return (
    <>
      <p className="mb-3 text-sm text-(--fin-muted)">
        {toPersianDigits(String(payments.length))} ردیف در {toPersianDigits(String(groups.length))}{" "}
        روز
      </p>

      {/*
        عنوان ستون‌ها فقط در صفحهٔ پهن دیده می‌شوند؛ صفحه‌خوان برچسب هر خانه را از متن پنهان کنارش می‌خواند.
        فاصلهٔ سمت راستش همان فاصلهٔ ردیف‌ها از ستون مهره‌هاست.
      */}
      <div
        aria-hidden="true"
        className="hidden grid-cols-(--fin-row) gap-3 ps-14 pe-3 text-sm text-(--fin-muted) lg:grid"
      >
        <span>ساعت</span>
        <span>مراجع</span>
        <span>مبلغ</span>
        <span>روش</span>
        <span>بیمه</span>
        <span>وضعیت و توضیح</span>
        <span />
      </div>

      <ol aria-label="پرداخت‌ها روزبه‌روز، تازه‌ترین روز بالا" className="relative">
        {/* ستون: خط سرمه‌ای کم‌رنگ که مهره‌های روزها رویش می‌نشینند */}
        <span
          aria-hidden="true"
          className="absolute start-[9px] top-6 bottom-2 w-0.5 rounded-full bg-(--fin-navy)/20 lg:start-[13px]"
        />
        {groups.map((group) => {
          const title = dayTitle(group.dayKey);
          const headingId = `${id}-day-${group.dayKey}`;
          const isToday = group.dayKey === today;
          return (
            <li
              key={group.dayKey}
              aria-labelledby={headingId}
              className="relative ps-8 pt-5 lg:ps-11"
            >
              {/* مهرهٔ روز: مربع گوشه‌تیز نوار امضایی برند؛ امروز نارنجی */}
              <span
                aria-hidden="true"
                className={`absolute start-[3px] top-[1.65rem] size-3.5 rounded-[2px] lg:start-[5px] lg:top-[1.6rem] lg:size-4 ${
                  isToday
                    ? "bg-(--fin-orange) outline-2 outline-offset-2 outline-(--fin-navy)"
                    : "border border-(--fin-orange)/60 bg-(--fin-peach)"
                }`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b-2 border-(--fin-navy) pb-2">
                <h3 id={headingId} className="text-base font-black text-(--fin-navy)">
                  {title.main}{" "}
                  <span className="ms-1 text-sm font-medium text-(--fin-muted)">{title.detail}</span>
                </h3>
                <p className="flex flex-wrap gap-x-3 text-sm text-(--fin-muted)">
                  <span>
                    {toPersianDigits(String(group.paymentCount))} پرداخت
                    {group.reversalCount > 0 &&
                      `، ${toPersianDigits(String(group.reversalCount))} ثبت معکوس`}
                  </span>
                  {/* جمع و مبلغش با هم می‌شکنند؛ خط جداکننده فقط وقتی در یک سطرند */}
                  {showTotals && (
                    <span className="whitespace-nowrap sm:border-s sm:border-(--fin-grey) sm:ps-3">
                      <span className="sr-only">، </span>
                      جمع روز: <Toman amount={group.totalToman} className="font-bold text-(--fin-navy)" />
                    </span>
                  )}
                </p>
              </div>
              <ul className="mt-3 flex flex-col gap-3 lg:mt-0 lg:gap-0">
                {group.payments.map((payment) => renderRow(toRow(payment)))}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}
