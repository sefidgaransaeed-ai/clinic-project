"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  busyHours,
  calculateReport,
  correctionsInRange,
  monthlyTotals,
  type MonthTotal,
  type ReportDay,
} from "../data";
import {
  formatJalaliDateTime,
  formatJalaliLongDate,
  formatJalaliMonth,
  formatWeekday,
  tehranDayKey,
  tehranLocalToIso,
  toPersianDigits,
} from "../dates";
import { csvFileName, paymentsCsv } from "../export";
import { amountInWords, formatAmount } from "../money";
import type { FinanceData } from "../types";
import {
  RangePicker,
  comparisonFor,
  rangeFor,
  type AppliedChoice,
  type DayRange,
} from "./range-picker";
import { ReportBreakdown } from "./report-breakdown";
import { ReportCalendar } from "./report-calendar";
import { ReportChart } from "./report-chart";
import { ReportCorrections } from "./report-corrections";
import { ReportCumulative } from "./report-cumulative";
import { ReportHours } from "./report-hours";
import { ReportReceipt } from "./report-receipt";
import { summarySentences } from "./report-summary";
import { card, smallButton } from "./styles";
import { Toman } from "./toman";
import { useCountUp } from "./use-count-up";
import { YearSpine } from "./year-spine";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

// تقویم روی نوار سرمه‌ای فقط تا دو ماه خواناست
const MAX_CALENDAR_DAYS = 62;

// ستون سال: ماه جاری و یازده ماه پیش از آن
const SPINE_MONTHS = 12;

const sumOf = (days: ReportDay[]) => days.reduce((sum, day) => sum + day.totalToman, 0);

/**
 * گزارش مالی — فقط پزشک. همهٔ رقم‌ها از calculateReport در data.ts می‌آیند تا آزمون‌پذیر باشند؛
 * این صفحه فقط نشانشان می‌دهد.
 */
export function ReportScreen({ data, nowIso }: { data: FinanceData; nowIso: string }) {
  // «امروز» همان لحظه‌ای است که صفحه ساخته شد، تا سرور و مرورگر یک چیز نشان دهند
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const today = tehranDayKey(now);

  // دکمه‌ای که در انتخاب بازه روشن است، و بازه‌ای که گزارش واقعاً نشان می‌دهد. این دو فقط وقتی
  // فرق دارند که «بازهٔ دلخواه» زده شده ولی تاریخ‌هایش هنوز کامل نیست.
  const [pickerChoice, setPickerChoice] = useState<AppliedChoice>("month");
  const [applied, setApplied] = useState<{ range: DayRange; choice: AppliedChoice }>(() => ({
    range: rangeFor("month", now),
    choice: "month",
  }));
  const { range, choice } = applied;
  const [showSample, setShowSample] = useState(true);

  const payments = useMemo(
    () => (showSample ? data.payments : []),
    [showSample, data.payments],
  );
  const report = useMemo(() => calculateReport(payments, range), [payments, range]);
  const comparison = useMemo(() => comparisonFor(choice, range), [choice, range]);
  const previous = useMemo(
    () => calculateReport(payments, comparison.range),
    [payments, comparison.range],
  );

  // اگر بازه هنوز تمام نشده (مثل «این ماه»)، فقط روزهای گذشته‌اش با همان روزهای بازهٔ قبل سنجیده
  // می‌شوند؛ وگرنه ده روز این ماه با سی روز ماه قبل مقایسه می‌شد
  const elapsed = report.daily.filter((day) => day.dayKey <= today).length;
  const cut = elapsed < report.daily.length ? elapsed : report.daily.length;
  const currentSum = sumOf(report.daily.slice(0, cut));
  // بازهٔ تمام‌شده با کل بازهٔ قبل سنجیده می‌شود، حتی اگر یک روز بلندتر باشد (۳۱ شهریور)
  const previousSum = sumOf(cut < report.daily.length ? previous.daily.slice(0, cut) : previous.daily);

  const months = useMemo(() => monthlyTotals(payments, now, SPINE_MONTHS), [payments, now]);
  const hours = useMemo(() => busyHours(payments, range), [payments, range]);
  const corrections = useMemo(() => correctionsInRange(payments, range), [payments, range]);
  const selectedMonth =
    months.find((month) => month.from === range.from && month.to === range.to)?.from ?? null;

  const netShown = useCountUp(report.netToman);
  const countShown = useCountUp(report.count);
  const averageShown = useCountUp(report.averageToman);

  const methodName = (id: string | null) =>
    data.paymentMethods.find((method) => method.id === id)?.name ?? "—";
  const insuranceName = (id: string | null) =>
    data.insuranceTypes.find((insurance) => insurance.id === id)?.name ?? "بدون بیمه";
  const patientName = (id: string) =>
    data.patients.find((patient) => patient.id === id)?.fullName ?? "—";
  const recorderName = (userId: string) =>
    data.profiles.find((profile) => profile.userId === userId)?.fullName ?? "—";

  const choose = (next: AppliedChoice) => {
    setPickerChoice(next);
    if (next !== "custom" && next !== "pickedMonth") {
      setApplied({ range: rangeFor(next, now), choice: next });
    }
  };

  // ماه انتخاب‌شده از ستون سال؛ اگر همین ماه یا ماه قبل است، دکمهٔ خودش هم روشن می‌شود
  const pickMonth = (month: MonthTotal) => {
    const next: AppliedChoice =
      month.from === rangeFor("month", now).from
        ? "month"
        : month.from === rangeFor("lastMonth", now).from
          ? "lastMonth"
          : "pickedMonth";
    setPickerChoice(next);
    setApplied({ range: { from: month.from, to: month.to }, choice: next });
  };

  // فایل جدول برای حسابدار، همین‌جا در مرورگر ساخته می‌شود و جایی فرستاده نمی‌شود
  const downloadCsv = () => {
    const csv = paymentsCsv(payments, range, { patientName, methodName, insuranceName });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFileName(range);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const rangeLabel =
    range.from === range.to
      ? `${formatWeekday(noonOf(range.from))} ${formatJalaliLongDate(noonOf(range.from))}`
      : `${formatJalaliLongDate(noonOf(range.from))} تا ${formatJalaliLongDate(noonOf(range.to))}`;

  const activeDays = report.daily.filter((day) => day.count > 0 || day.totalToman !== 0);
  const empty = activeDays.length === 0;
  const showCalendar = report.daily.length > 1 && report.daily.length <= MAX_CALENDAR_DAYS;
  const isMonth = choice === "month" || choice === "lastMonth" || choice === "pickedMonth";
  const receiptTitle = isMonth
    ? `رسید ${formatJalaliMonth(noonOf(range.from))}`
    : choice === "today"
      ? "رسید امروز"
      : choice === "week"
        ? "رسید این هفته"
        : "رسید بازه";
  const sentences = summarySentences({
    report,
    choice,
    range,
    now,
    methodName,
    reversalCount: corrections.filter((item) => item.original).length,
    refundCount: corrections.filter((item) => !item.original).length,
  });

  return (
    <div className="finance-theme mx-auto flex w-full max-w-7xl flex-col gap-6">
      {/* نوار موقت آزمون؛ وقتی ورود و نقش‌ها ساخته شد برداشته می‌شود */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border-2 border-dashed border-(--fin-orange) bg-(--fin-peach)/40 p-4 text-sm print:hidden">
        <p className="font-bold text-(--fin-navy)">
          حالت آزمایشی
          <span className="block font-normal text-(--fin-muted)">
            داده‌ها ساختگی‌اند. قفل «فقط پزشک» سمت سرور با ساخته‌شدن ورود و نقش‌ها اضافه می‌شود.
          </span>
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showSample}
            onChange={(event) => setShowSample(event.target.checked)}
            className="size-4 accent-(--fin-navy)"
          />
          نمایش پرداخت‌های نمونه
        </label>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-(--fin-navy)">گزارش مالی</h1>
          <p className="mt-1 text-(--fin-muted) print:hidden">
            جمع پرداخت‌ها در بازه‌ای که انتخاب می‌کنید. فقط پزشک این صفحه را می‌بیند.
          </p>
          <p className="mt-1 hidden text-sm text-(--fin-muted) print:block">
            چاپ‌شده در {formatJalaliDateTime(now)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={downloadCsv} className={smallButton} disabled={empty}>
            فایل برای حسابدار
          </button>
          <button type="button" onClick={() => window.print()} className={smallButton}>
            چاپ گزارش
          </button>
          <Link
            href="/panel/payments"
            className="ms-2 text-sm font-bold text-(--fin-blue) underline-offset-4 hover:underline"
          >
            فهرست پرداخت‌ها ←
          </Link>
        </div>
      </header>

      <div className="print:hidden">
        <RangePicker
          choice={pickerChoice}
          onChoose={choose}
          onCustomRange={(customRange) => setApplied({ range: customRange, choice: "custom" })}
        />
      </div>

      {/* چند جملهٔ ساده دربارهٔ بازه، پیش از رقم‌ها */}
      <p className="max-w-3xl border-s-4 border-(--fin-orange) ps-4 text-lg leading-loose text-(--fin-navy)">
        {sentences.join(" ")}
      </p>

      {/* سربرگ سرمه‌ای: جمع خالص بزرگ و مقایسه، شمار و میانگین، و تقویم بازه */}
      <section
        aria-label="خلاصهٔ بازه"
        className="relative isolate break-inside-avoid overflow-hidden rounded-3xl bg-(--fin-navy) bg-[radial-gradient(110%_120%_at_0%_0%,var(--fin-blue)_0%,transparent_60%)] p-5 text-white md:p-7"
      >
        <div
          className={`grid gap-x-10 gap-y-8 ${
            showCalendar
              ? "[grid-template-areas:'nums'_'spine'_'cal'] md:grid-cols-[13.5rem_minmax(0,1fr)] md:[grid-template-areas:'nums_nums'_'spine_cal'] xl:grid-cols-[minmax(0,1fr)_13.5rem_minmax(16rem,19rem)] xl:[grid-template-areas:'nums_spine_cal'] print:grid-cols-[minmax(0,1fr)_17rem] print:[grid-template-areas:'nums_cal']"
              : "[grid-template-areas:'nums'_'spine'] md:grid-cols-[minmax(0,1fr)_13.5rem] md:[grid-template-areas:'nums_spine'] print:grid-cols-1 print:[grid-template-areas:'nums']"
          }`}
        >
          <div className="min-w-0 [grid-area:nums]">
            <p className="text-sm text-white/70">{rangeLabel}</p>
            <p className="mt-4 text-sm text-white/70">جمع خالص</p>
            <p className="text-4xl leading-tight font-black text-(--fin-orange) sm:text-5xl">
              {/* رقم شمارنده فقط برای چشم است؛ صفحه‌خوان رقم نهایی را می‌خواند */}
              <bdi dir="ltr" aria-hidden="true">
                {formatAmount(netShown)}
              </bdi>
              <span className="sr-only">{formatAmount(report.netToman)}</span>{" "}
              <span className="text-lg font-bold">تومان</span>
            </p>

            <CompareChip
              current={currentSum}
              previous={previousSum}
              phrase={comparison.phrase}
              hidden={elapsed === 0}
            />

            <p className="mt-4 border-s-2 border-(--fin-orange) ps-2.5 text-sm text-white/85">
              <span className="text-white/60">به حروف: </span>
              {report.netToman < 0 ? "منفی " : ""}
              {amountInWords(report.netToman)}
            </p>
            <p className="mt-1 text-xs text-white/55">
              پرداخت‌ها، منهای ثبت‌های معکوس و برگشت پول.
            </p>

            <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 whitespace-nowrap">
              <div>
                <dt className="text-sm text-white/70">تعداد پرداخت</dt>
                <dd className="text-3xl leading-tight font-black">
                  <span aria-hidden="true">{toPersianDigits(String(countShown))}</span>
                  <span className="sr-only">{toPersianDigits(String(report.count))}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-white/70">میانگین هر پرداخت</dt>
                <dd className="text-3xl leading-tight font-black">
                  <bdi dir="ltr" aria-hidden="true">
                    {formatAmount(averageShown)}
                  </bdi>
                  <span className="sr-only">{formatAmount(report.averageToman)}</span>{" "}
                  <span className="text-base font-bold">تومان</span>
                </dd>
              </div>
            </dl>
          </div>

          {/* ستون سال برای جابه‌جایی بین ماه‌هاست؛ روی کاغذ کاری ندارد */}
          <div className="[grid-area:spine] print:hidden">
            <YearSpine months={months} selectedFrom={selectedMonth} onPick={pickMonth} />
          </div>

          {showCalendar && (
            <div className="w-full max-w-[20rem] [grid-area:cal]">
              <ReportCalendar
                key={`${range.from}:${range.to}`}
                days={report.daily}
                today={today}
              />
            </div>
          )}
        </div>
      </section>

      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-(--fin-grey) px-6 py-12 text-center">
          <span aria-hidden="true" className="flex gap-1">
            <span className="h-2.5 w-5 rounded-sm bg-(--fin-orange)/40" />
            <span className="h-2.5 w-7 rounded-sm bg-(--fin-orange)" />
            <span className="h-2.5 w-5 rounded-sm bg-(--fin-orange)/40" />
          </span>
          <p className="font-bold text-(--fin-navy)">در این بازه پرداختی ثبت نشده</p>
          <p className="text-sm text-(--fin-muted)">بازهٔ دیگری انتخاب کنید.</p>
        </div>
      ) : (
        <>
          <div className={`grid items-start gap-6 ${report.daily.length > 1 ? "xl:grid-cols-2" : ""}`}>
            <section className={`${card} break-inside-avoid`} aria-labelledby="report-chart-title">
              <h2 id="report-chart-title" className="mb-4 text-lg font-black text-(--fin-navy)">
                جمع هر روز
              </h2>
              <ReportChart
                key={`${range.from}:${range.to}`}
                days={report.daily}
                today={today}
                previous={previous.daily}
                previousName={comparison.name}
              />
            </section>
            {/* برای یک روز، خط جمع حرفی بیش از همان یک رقم ندارد */}
            {report.daily.length > 1 && (
              <section className={`${card} break-inside-avoid`} aria-labelledby="report-cumulative-title">
                <h2 id="report-cumulative-title" className="mb-1 text-lg font-black text-(--fin-navy)">
                  جمع روی هم
                </h2>
                <ReportCumulative
                  days={report.daily}
                  previous={previous.daily}
                  today={today}
                  previousName={comparison.name}
                  untilLabel={choice === "month" ? "تا آخر ماه" : "تا آخر بازه"}
                />
              </section>
            )}
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ReportBreakdown
              title="به تفکیک روش پرداخت"
              lines={report.byMethod}
              nameOf={methodName}
            />
            <ReportBreakdown
              title="به تفکیک بیمه"
              lines={report.byInsurance}
              nameOf={insuranceName}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <ReportHours grid={hours} />
              <ReportCorrections
                corrections={corrections}
                patientName={patientName}
                methodName={(id) => methodName(id)}
                recorderName={recorderName}
              />
            </div>
            <ReportReceipt
              days={report.daily}
              today={today}
              title={receiptTitle}
              rangeLabel={rangeLabel}
              netToman={report.netToman}
              count={report.count}
              issuedAt={now}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * «۱۲٪ بیشتر از همین روزهای مهر». جهت با کلمه گفته می‌شود، نه فقط با رنگ و پیکان؛ و رقم بازهٔ
 * قبل هم زیرش هست تا درصد از کجا آمده معلوم باشد.
 */
function CompareChip({
  current,
  previous,
  phrase,
  hidden,
}: {
  current: number;
  previous: number;
  phrase: string;
  hidden: boolean;
}) {
  // بازه‌ای که هنوز هیچ روزش نرسیده، یا بازهٔ قبلی که برگشت پولش از دریافتش بیشتر بوده،
  // درصد معناداری ندارد
  if (hidden || previous < 0) return null;
  if (previous === 0) {
    return <p className="mt-3 text-sm text-white/60">{phrase} پرداختی نداشت.</p>;
  }

  const change = (current - previous) / previous;
  const percent = Math.round(Math.abs(change) * 100);
  const direction = percent === 0 ? "same" : change > 0 ? "up" : "down";
  // از دو برابر به بالا «۲٫۵ برابر» خواناتر از «۱۵۰٪ بیشتر» است
  const ratio = current / previous;
  const times = toPersianDigits(String(ratio < 10 ? Math.round(ratio * 10) / 10 : Math.round(ratio)))
    .replace(".", "٫");
  const sentence =
    direction === "same"
      ? `تقریباً برابر با ${phrase}`
      : ratio >= 2
        ? `${times} برابر ${phrase}`
        : `${toPersianDigits(String(percent))}٪ ${direction === "up" ? "بیشتر" : "کمتر"} از ${phrase}`;

  return (
    <div className="mt-3">
      <p className="inline-flex items-center gap-2 rounded-[3px] bg-white/10 px-2.5 py-1 text-sm font-bold">
        {direction !== "same" && (
          // مثلث گوشه‌تیز، هم‌شکل نوک مهره‌های لوگو
          <svg
            aria-hidden="true"
            viewBox="0 0 10 10"
            fill="currentColor"
            className={`size-2.5 ${direction === "up" ? "text-(--fin-orange)" : "rotate-180 text-(--fin-red-light)"}`}
          >
            <polygon points="5,0 10,10 0,10" />
          </svg>
        )}
        {sentence}
      </p>
      <p className="mt-1 text-xs text-white/55">
        {phrase}: <Toman amount={previous} />
      </p>
    </div>
  );
}
