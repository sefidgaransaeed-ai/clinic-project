"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  busyHours,
  calculateReport,
  correctionsInRange,
  monthWaves,
  monthlyTotals,
  type ReportDay,
} from "../data";
import {
  formatJalaliDateTime,
  formatJalaliLongDate,
  formatJalaliMonth,
  formatWeekday,
  jalaliParts,
  tehranDayKey,
  tehranLocalToIso,
  toPersianDigits,
} from "../dates";
import { csvFileName, paymentsCsv } from "../export";
import { amountInWords, formatAmount, formatShortAmount } from "../money";
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
import { summarySentences, waveInterpretation } from "./report-summary";
import { GlassKnee } from "./glass-knee";
import { NerveReport } from "./nerve-report";
import { card, smallButton } from "./styles";
import { Toman } from "./toman";
import { useCountUp } from "./use-count-up";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

// تقویم بازه فقط تا دو ماه خواناست
const MAX_CALENDAR_DAYS = 62;

// شمار ماه‌های «گزارش نوار مالی»
const WAVE_MONTHS = 3;

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

  const hours = useMemo(() => busyHours(payments, range), [payments, range]);
  const corrections = useMemo(() => correctionsInRange(payments, range), [payments, range]);

  // «گزارش نوار مالی»: سه ماه تا ماهی که گزارش نشان می‌دهد؛ اگر بازه یک ماه کامل نیست، تا ماه جاری
  const isMonth = choice === "month" || choice === "lastMonth" || choice === "pickedMonth";
  const anchor = jalaliParts(noonOf(isMonth ? range.from : today));
  const waves = useMemo(
    () => monthWaves(payments, { jy: anchor.jy, jm: anchor.jm }, today, WAVE_MONTHS),
    [payments, anchor.jy, anchor.jm, today],
  );
  const selectedMonth = isMonth ? range.from : null;

  // نور زانو: جمع بازه کنار میانهٔ جمع دوازده ماه تمام‌شدهٔ اخیر
  const typicalMonth = useMemo(() => {
    const totals = monthlyTotals(payments, now, 13)
      .slice(0, 12)
      .map((month) => month.totalToman)
      .sort((a, b) => a - b);
    return (totals[5] + totals[6]) / 2;
  }, [payments, now]);
  const glow = typicalMonth > 0 ? report.netToman / typicalMonth : 0.25;

  // روشی که بیشترین سهم را دارد، برای برچسب کنار زانو
  const topMethod = report.byMethod.reduce<(typeof report.byMethod)[number] | null>(
    (top, line) => (!top || line.totalToman > top.totalToman ? line : top),
    null,
  );
  const topShare =
    topMethod && report.netToman > 0 ? Math.round((topMethod.totalToman / report.netToman) * 100) : 0;

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

  // ماه انتخاب‌شده از «گزارش نوار مالی»؛ اگر همین ماه یا ماه قبل است، دکمهٔ خودش هم روشن می‌شود
  const pickMonth = (month: { from: string; to: string }) => {
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
      {/* نوار موقت آزمون؛ با اتصال به پایگاه داده (کار p3-06) برداشته می‌شود */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border-2 border-dashed border-(--fin-orange) bg-(--fin-peach)/40 p-4 text-sm print:hidden">
        <p className="font-bold text-(--fin-navy)">
          حالت آزمایشی
          <span className="block font-normal text-(--fin-muted)">
            داده‌ها ساختگی‌اند.
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

      {/* کارت شیشه‌ای: جمع خالص بزرگ، مقایسه و جملهٔ خلاصه، و زانوی شیشه‌ای با رقم‌های اصلی */}
      <section
        aria-label="خلاصهٔ بازه"
        className="relative isolate break-inside-avoid overflow-hidden rounded-[2rem] border border-white bg-[radial-gradient(80%_70%_at_100%_0%,#fdeedd_0%,transparent_60%),radial-gradient(70%_70%_at_0%_100%,#e3e6fb_0%,transparent_60%),#f6f7fc] p-5 shadow-[0_30px_60px_-40px_rgba(38,34,97,0.55)] md:p-7"
      >
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] print:grid-cols-1">
          <div className="min-w-0">
            <p className="text-sm text-(--fin-muted)">{rangeLabel} · جمع خالص</p>
            <p className="mt-1 text-5xl leading-tight font-black text-(--fin-navy) sm:text-6xl">
              {/* رقم شمارنده فقط برای چشم است؛ صفحه‌خوان رقم نهایی را می‌خواند */}
              <bdi dir="ltr" aria-hidden="true">
                {formatAmount(netShown)}
              </bdi>
              <span className="sr-only">{formatAmount(report.netToman)}</span>{" "}
              <span className="text-xl font-bold">تومان</span>
            </p>

            <CompareChip
              current={currentSum}
              previous={previousSum}
              phrase={comparison.phrase}
              hidden={elapsed === 0}
            />

            <p className="mt-4 border-s-2 border-(--fin-orange) ps-2.5 text-sm text-(--fin-navy)">
              <span className="text-(--fin-muted)">به حروف: </span>
              {report.netToman < 0 ? "منفی " : ""}
              {amountInWords(report.netToman)}
            </p>
            <p className="mt-1 text-xs text-(--fin-muted)">پرداخت‌ها، منهای ثبت‌های معکوس و برگشت پول.</p>

            {/* چند جملهٔ ساده دربارهٔ بازه */}
            <p className="mt-5 max-w-xl border-s-4 border-(--fin-orange) ps-3.5 text-lg leading-loose text-(--fin-navy)">
              {sentences.join(" ")}
            </p>

            <div className="mt-5 print:hidden">
              <RangePicker
                choice={pickerChoice}
                onChoose={choose}
                onCustomRange={(customRange) => setApplied({ range: customRange, choice: "custom" })}
              />
            </div>

            {/* روی کاغذ زانو نمی‌آید، پس رقم‌هایش اینجا نوشته می‌شوند */}
            <p className="mt-4 hidden text-sm text-(--fin-navy) print:block">
              {toPersianDigits(String(report.count))} پرداخت · میانگین هر پرداخت{" "}
              {formatShortAmount(report.averageToman)}
            </p>
          </div>

          <div className="relative h-[26rem] overflow-hidden rounded-[1.75rem] border border-white bg-[radial-gradient(60%_55%_at_50%_58%,rgba(248,148,29,0.2),transparent_70%),linear-gradient(160deg,rgba(255,255,255,0.7),rgba(222,226,250,0.6))] print:hidden">
            <GlassKnee glow={glow} className="absolute inset-0 m-auto h-full" />
            <FloatChip className="top-6 right-4" dot>
              <span className="block text-2xl leading-tight font-black">
                <span aria-hidden="true">{toPersianDigits(String(countShown))}</span>
                <span className="sr-only">{toPersianDigits(String(report.count))}</span>
              </span>
              پرداخت
            </FloatChip>
            <FloatChip className="top-[44%] left-3">
              <span className="block text-2xl leading-tight font-black">
                <span aria-hidden="true">{formatShortAmount(averageShown).replace(" تومان", "")}</span>
                <span className="sr-only">{formatShortAmount(report.averageToman)}</span>
              </span>
              میانگین هر پرداخت
            </FloatChip>
            {topMethod && topShare > 0 && (
              <FloatChip className="right-5 bottom-6">
                <span className="block text-2xl leading-tight font-black">
                  {toPersianDigits(String(topShare))}٪
                </span>
                با {methodName(topMethod.id)}
              </FloatChip>
            )}
          </div>
        </div>
      </section>

      {/* سه ماه پشت سر هم، مثل برگهٔ نوار عصب؛ جای ستون سال را هم می‌گیرد */}
      <NerveReport
        waves={waves}
        selectedFrom={selectedMonth}
        onPick={pickMonth}
        interpretation={waveInterpretation(waves)}
      />

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
            <div className="flex min-w-0 flex-col gap-6">
              {/* تقویم بازه: هر روز یک مربع نارنجی به اندازهٔ درآمدش */}
              {showCalendar && (
                <section
                  aria-label="تقویم بازه"
                  className="break-inside-avoid rounded-3xl bg-(--fin-navy) bg-[radial-gradient(110%_120%_at_0%_0%,var(--fin-blue)_0%,transparent_60%)] p-5 text-white"
                >
                  <h2 className="mb-3 text-lg font-black">تقویم بازه</h2>
                  <ReportCalendar key={`${range.from}:${range.to}`} days={report.daily} today={today} />
                </section>
              )}
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
          </div>
        </>
      )}
    </div>
  );
}

/** برچسب شناور مات کنار زانو؛ dot یعنی با مربع نارنجی کوچک روی سرمه‌ای */
function FloatChip({
  className,
  dot = false,
  children,
}: {
  className: string;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      className={`absolute flex items-center gap-2.5 rounded-2xl border border-white bg-white/75 px-3.5 py-2 text-xs font-bold text-(--fin-navy) shadow-[0_14px_30px_-18px_rgba(38,34,97,0.5)] backdrop-blur ${className}`}
    >
      {dot && (
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-xl bg-(--fin-navy)">
          <span className="size-3 rounded-[3px] bg-(--fin-orange) shadow-[0_0_10px_rgba(248,148,29,0.8)]" />
        </span>
      )}
      <span>{children}</span>
    </p>
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
    return <p className="mt-3 text-sm text-(--fin-muted)">{phrase} پرداختی نداشت.</p>;
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
      {/* روی نارنجی فقط نوشتهٔ سرمه‌ای (برندگاید) */}
      <p
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-sm font-black ${
          direction === "up"
            ? "bg-(--fin-orange) text-(--fin-navy)"
            : direction === "down"
              ? "bg-(--fin-blue) text-white"
              : "bg-white text-(--fin-navy) ring-1 ring-(--fin-grey)"
        }`}
      >
        {direction !== "same" && (
          // مثلث گوشه‌تیز، جهت را هم با شکل می‌گوید
          <svg
            aria-hidden="true"
            viewBox="0 0 10 10"
            fill="currentColor"
            className={`size-2.5 ${direction === "down" ? "rotate-180" : ""}`}
          >
            <polygon points="5,0 10,10 0,10" />
          </svg>
        )}
        {sentence}
      </p>
      <p className="mt-1 text-xs text-(--fin-muted)">
        {phrase}: <Toman amount={previous} />
      </p>
    </div>
  );
}
