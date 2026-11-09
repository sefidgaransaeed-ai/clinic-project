"use client";

import { useId } from "react";
import type { MonthWave, WaveStatus } from "../data";
import { formatJalaliMonthName, tehranLocalToIso, toPersianDigits } from "../dates";
import { formatShortAmount } from "../money";

// اندازه‌های هر موج، به واحد viewBox؛ موج به پهنای ردیف کشیده می‌شود
const W = 1000;
const H = 100;
const BASE = 62;
// محور افقی روزهای ماه است، از روز ۱ (راست) تا روز ۳۱ (چپ)
const RIGHT = 975;
const LEFT = 25;
const X = (day: number) => RIGHT - ((day - 1) / 30) * (RIGHT - LEFT);

// درصد گردشده، تا سرور و مرورگر یک رقم بنویسند
const pct = (value: number) => `${value.toFixed(2)}%`;

const AXIS_DAYS = [1, 6, 11, 16, 21, 26, 31];

const STATUS: Record<WaveStatus, { text: string; className: string }> = {
  high: { text: "▲ بالاتر از معمول", className: "bg-(--fin-orange) text-(--fin-navy)" },
  normal: { text: "معمول", className: "bg-(--fin-grey-soft) text-(--fin-navy)" },
  low: { text: "▼ پایین‌تر از معمول", className: "bg-(--fin-blue) text-white" },
  ongoing: { text: "هنوز تمام نشده", className: "bg-(--fin-grey-soft) text-(--fin-muted)" },
};

const short = (amount: number) => formatShortAmount(amount).replace(" تومان", "");
const nameOf = (wave: MonthWave) => formatJalaliMonthName(tehranLocalToIso(wave.from, "12:00"));

/**
 * موج یک ماه، به شکل پاسخ عصب در نوار عصب و عضله: نشانهٔ کوچک شروع ماه در راست، خط صاف تا روزی
 * که ماه به نیمهٔ درآمدش رسید («تأخیر»)، و آنجا یک موج دوفازی که بلندی‌اش جمع ماه است («دامنه»).
 */
function wavePath(wave: MonthWave, amplitude: number): string {
  const start = `M${W} ${BASE} L${RIGHT + 10} ${BASE} l-2 -8 l-2 14 l-2 -6`;
  if (wave.halfDay === null) return `${start} L0 ${BASE}`;
  const x = X(wave.halfDay);
  const a = amplitude;
  return [
    start,
    `L${x + 4} ${BASE}`,
    `C ${x - 6} ${BASE}, ${x - 10} ${BASE - a}, ${x - 22} ${BASE - a}`,
    `C ${x - 36} ${BASE - a}, ${x - 40} ${BASE + a * 0.45}, ${x - 56} ${BASE + a * 0.45}`,
    `C ${x - 70} ${BASE + a * 0.45}, ${x - 76} ${BASE}, ${x - 100} ${BASE}`,
    `L0 ${BASE}`,
  ].join(" ");
}

/**
 * «گزارش نوار مالی»: چند ماه پشت سر هم مثل برگهٔ نوار عصب — موج‌ها زیر هم، جدول اندازه‌ها و یک
 * خط تفسیر. هر موج و هر ردیف جدول یک دکمه است و گزارش همان ماه را باز می‌کند؛ پس با زدن ماه
 * بالایی، ماه‌های قبل‌تر هم می‌آیند.
 */
export function NerveReport({
  waves,
  selectedFrom,
  onPick,
  interpretation,
}: {
  /** قدیمی‌ترین اول */
  waves: MonthWave[];
  /** روز اول ماهی که گزارش الان نشان می‌دهد؛ اگر بازه یک ماه کامل نیست null */
  selectedFrom: string | null;
  onPick: (wave: MonthWave) => void;
  interpretation: string;
}) {
  const id = useId();
  const max = Math.max(1, ...waves.map((wave) => wave.totalToman));
  const amplitudeOf = (wave: MonthWave) =>
    wave.totalToman > 0 ? 8 + 40 * Math.sqrt(wave.totalToman / max) : 0;
  const last = waves.at(-1);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="break-inside-avoid rounded-3xl bg-(--fin-paper) p-5 shadow-[0_30px_60px_-40px_rgba(38,34,97,0.5)] ring-1 ring-(--fin-paper-line) md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b-[3px] border-(--fin-navy) pb-3.5">
        <div>
          <h2 id={`${id}-title`} className="text-xl font-black text-(--fin-navy)">
            گزارش نوار مالی
          </h2>
          <p className="text-sm text-(--fin-muted) print:hidden">
            برای دیدن گزارش هر ماه روی موجش بزنید. برای ماه‌های قبل‌تر، موج بالایی را بزنید.
          </p>
        </div>
        <p className="text-sm text-(--fin-muted)">
          محور افقی: <b className="text-(--fin-navy)">روزهای ماه</b>
        </p>
      </div>

      {/* موج‌ها؛ هر ردیف یک دکمه */}
      <div className="mt-4 rounded-2xl bg-white bg-[radial-gradient(rgba(38,34,97,0.16)_1px,transparent_1.2px)] bg-size-[20px_20px] p-2 ring-1 ring-(--fin-paper-line)">
        <div role="group" aria-label="ماه‌های نوار مالی">
          {waves.map((wave) => {
            const selected = wave.from === selectedFrom;
            const amplitude = amplitudeOf(wave);
            const x = wave.halfDay === null ? null : (X(wave.halfDay) / W) * 100;
            const peak = wave.halfDay === null ? null : ((X(wave.halfDay) - 22) / W) * 100;
            const color = selected ? "text-(--fin-orange)" : "text-(--fin-navy)";
            return (
              <button
                key={wave.from}
                type="button"
                aria-pressed={selected}
                aria-label={`${nameOf(wave)} ${toPersianDigits(String(wave.jy))}، ${formatShortAmount(wave.totalToman)}${
                  wave.halfDay ? `، نیمهٔ درآمد روز ${toPersianDigits(String(wave.halfDay))}` : ""
                }`}
                onClick={() => onPick(wave)}
                className="grid w-full cursor-pointer grid-cols-[5.5rem_minmax(0,1fr)] items-center rounded-xl text-start transition-colors hover:bg-(--fin-peach)/30 focus-visible:outline-2 focus-visible:outline-(--fin-blue) sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                <span className="ps-2">
                  <span className={`block font-black ${selected ? "text-(--fin-orange)" : "text-(--fin-navy)"}`}>
                    {nameOf(wave)}
                  </span>
                  <span className="block text-xs text-(--fin-muted)">{short(wave.totalToman)}</span>
                </span>
                <span aria-hidden="true" className={`relative block h-20 ${color}`}>
                  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
                    <path
                      d={wavePath(wave, amplitude)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={selected ? 3 : 2.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {x !== null && peak !== null && (
                    <>
                      {/* نشانگر دامنه بالای قلهٔ موج */}
                      <span
                        className="absolute size-0 -translate-x-1/2 border-x-[6px] border-t-[9px] border-x-transparent border-t-current"
                        style={{ left: pct(peak), top: `calc(${pct(BASE - amplitude)} - 13px)` }}
                      />
                      {/* نشانگر تأخیر زیر شروع موج، با روزش */}
                      <span
                        className="absolute flex -translate-x-1/2 flex-col items-center text-[0.6875rem] leading-tight font-black whitespace-nowrap"
                        style={{ left: pct(x), top: `calc(${pct(BASE)} + 6px)` }}
                      >
                        <span className="size-0 border-x-[6px] border-b-[9px] border-x-transparent border-b-current" />
                        روز {toPersianDigits(String(wave.halfDay))}
                      </span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* روزهای ماه */}
        <div aria-hidden="true" className="grid grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)]">
          <span className="ps-2 text-xs text-(--fin-muted)">روز</span>
          <span className="relative block h-5">
            {AXIS_DAYS.map((day) => (
              <span
                key={day}
                className="absolute -translate-x-1/2 text-xs font-bold text-(--fin-muted)"
                style={{ left: pct((X(day) / W) * 100) }}
              >
                {toPersianDigits(String(day))}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* جدول اندازه‌ها */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-(--fin-paper-line) text-xs text-(--fin-muted)">
              <th className="px-2 py-2 text-start font-bold">ماه</th>
              <th className="px-2 py-2 text-start font-bold">دامنه: جمع خالص</th>
              <th className="px-2 py-2 text-start font-bold">تأخیر: نیمهٔ درآمد</th>
              <th className="px-2 py-2 text-start font-bold">تعداد پرداخت</th>
              <th className="px-2 py-2 text-start font-bold">میانگین هر پرداخت</th>
              <th className="px-2 py-2 text-start font-bold">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {waves.map((wave) => {
              const selected = wave.from === selectedFrom;
              const status = STATUS[wave.status];
              return (
                <tr
                  key={wave.from}
                  className={`border-b border-dashed border-(--fin-paper-line) font-bold whitespace-nowrap text-(--fin-navy) ${
                    selected ? "bg-(--fin-orange)/12" : ""
                  }`}
                >
                  <td className="px-2 py-3 font-black">
                    <button
                      type="button"
                      onClick={() => onPick(wave)}
                      className="cursor-pointer underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-(--fin-blue)"
                    >
                      {nameOf(wave)} {toPersianDigits(String(wave.jy))}
                    </button>
                  </td>
                  <td className="px-2 py-3">{formatShortAmount(wave.totalToman)}</td>
                  <td className="px-2 py-3">
                    {wave.halfDay ? `روز ${toPersianDigits(String(wave.halfDay))}` : "—"}
                  </td>
                  <td className="px-2 py-3">{toPersianDigits(String(wave.count))}</td>
                  <td className="px-2 py-3">{wave.count > 0 ? formatShortAmount(wave.averageToman) : "—"}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex rounded-md px-2 text-xs font-black ${status.className}`}>
                      {status.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {interpretation && (
        <p className="mt-4 border-s-4 border-(--fin-orange) ps-3.5 text-(--fin-navy)">
          <span className="block text-xs font-bold text-(--fin-muted)">تفسیر</span>
          {interpretation}
        </p>
      )}
      {last && (
        <p className="mt-3 text-xs text-(--fin-muted)">
          «معمول» یعنی محدوده‌ای که نیمی از ماه‌های یک سالِ پیش از این ماه‌ها در آن بوده‌اند.
        </p>
      )}
    </section>
  );
}
