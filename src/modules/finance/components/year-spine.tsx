"use client";

import { useId, useState } from "react";
import type { MonthTotal } from "../data";
import { formatJalaliMonthName, tehranLocalToIso, toPersianDigits } from "../dates";
import { formatShortAmount } from "../money";

type Point = { x: number; y: number };

// اندازه‌ها به واحد viewBox؛ ستون به پهنای خودش کشیده می‌شود
const ROW = 34;
const PAD = 14;
const WIDTH = 214;
const CENTER = 66;
const AMPLITUDE = 20;
const INNER = 4;
// عمق مهره با درآمد ماه بیشتر می‌شود؛ ماه بی‌پرداخت کم‌عمق‌ترین است
const DEPTH = { empty: 9, min: 14, max: 42 };
const LABEL_X = CENTER + AMPLITUDE + INNER + DEPTH.max + 14;

const fmt = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

type Vertebra = {
  month: MonthTotal;
  name: string;
  shape: string;
  /** وسط ردیف، برای نام ماه و دکمهٔ رویش */
  y: number;
};

/**
 * «ستون سال»: منحنی S ایستادهٔ لوگو با دوازده مهره، هر مهره یک ماه؛ ماه قدیمی بالا، ماه جاری
 * پایین. هرچه درآمد ماه بیشتر، مهره عمیق‌تر. با زدن روی هر مهره، گزارش همان ماه باز می‌شود.
 *
 * شکل برای صفحه‌خوان پنهان است؛ هر ردیف یک دکمهٔ واقعی با نام ماه و جمعش دارد.
 */
export function YearSpine({
  months,
  selectedFrom,
  onPick,
}: {
  months: MonthTotal[];
  /** روز اول ماهی که گزارش الان نشان می‌دهد؛ اگر بازه یک ماه کامل نیست null */
  selectedFrom: string | null;
  onPick: (month: MonthTotal) => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);

  const height = PAD * 2 + ROW * months.length;
  const curve = (t: number): Point => ({
    x: CENTER + AMPLITUDE * Math.sin(2 * Math.PI * t),
    y: PAD + (height - 2 * PAD) * t,
  });
  const normalAt = (t: number): Point => {
    const a = curve(t - 0.001);
    const b = curve(t + 0.001);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
  };
  const along = (t: number, distance: number): Point => {
    const p = curve(t);
    const n = normalAt(t);
    return { x: p.x + n.x * distance, y: p.y + n.y * distance };
  };

  const max = Math.max(0, ...months.map((month) => month.totalToman));
  const span = months.length;

  const vertebrae: Vertebra[] = months.map((month, index) => {
    const depth =
      month.totalToman > 0
        ? DEPTH.min + (DEPTH.max - DEPTH.min) * Math.sqrt(month.totalToman / max)
        : DEPTH.empty;
    const gap = 3 / (height - 2 * PAD);
    const start = index / span + gap;
    const end = (index + 1) / span - gap;
    const mid = (start + end) / 2;
    const tip = 4 / (height - 2 * PAD);
    return {
      month,
      name: formatJalaliMonthName(tehranLocalToIso(month.from, "12:00")),
      shape: fmt([
        along(start, INNER),
        along(mid, INNER),
        along(end, INNER),
        along(end, INNER + depth),
        along(mid + tip, INNER + depth),
        // نوک کوچک رو به بیرون، مثل مهره‌های لوگو
        along(mid, INNER + depth + 6),
        along(mid - tip, INNER + depth),
        along(start, INNER + depth),
      ]),
      y: curve(mid).y,
    };
  });

  // هلال آبی سمت دیگر منحنی؛ وسطش پهن و دو سرش باریک
  const swoosh = fmt([
    ...Array.from({ length: 41 }, (_, i) => along(i / 40, -3)),
    ...Array.from({ length: 41 }, (_, i) =>
      along(1 - i / 40, -3 - 13 * Math.sin(Math.PI * (1 - i / 40))),
    ),
  ]);

  const current = months.at(-1);
  const shown =
    vertebrae.find((v) => v.month.from === (preview ?? selectedFrom)) ?? vertebrae.at(-1);

  return (
    <div>
      <p id={`${id}-title`} className="mb-2 text-sm text-white/70">
        دوازده ماه اخیر
      </p>
      <div className="relative mx-auto max-w-[13.5rem]" onPointerLeave={() => setPreview(null)}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="block w-full overflow-visible"
        >
          <polygon points={swoosh} fill="var(--fin-blue)" />
          {vertebrae.map((v, index) => {
            const selected = v.month.from === selectedFrom;
            const isCurrent = v.month.from === current?.from;
            const look =
              v.month.totalToman > 0
                ? { fill: "var(--fin-orange)" }
                : v.month.totalToman < 0
                  ? { fill: "none", stroke: "var(--fin-red-light)", strokeWidth: 1.5 }
                  : { fill: "white", fillOpacity: 0.16 };
            return (
              <g
                key={v.month.from}
                className="fin-grow"
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "left center",
                  animationDelay: `${index * 40}ms`,
                }}
              >
                <polygon points={v.shape} strokeLinejoin="round" {...look} />
                {isCurrent && !selected && (
                  // ماه جاری هنوز تمام نشده
                  <polygon
                    points={v.shape}
                    fill="none"
                    stroke="var(--fin-orange)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    strokeLinejoin="round"
                  />
                )}
                {selected && (
                  <polygon
                    points={v.shape}
                    fill="none"
                    stroke="white"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                  />
                )}
              </g>
            );
          })}
          {vertebrae.map((v, index) => {
            const selected = v.month.from === selectedFrom;
            // سال فقط کنار ماه اول فهرست و کنار فروردین، تا معلوم باشد سال کجا عوض شده
            const withYear = index === 0 || v.month.jm === 1;
            return (
              <text
                key={v.month.from}
                x={LABEL_X}
                y={v.y}
                dominantBaseline="central"
                // راست‌به‌چپ، پس «end» یعنی لبهٔ چپ نوشته روی x است و نوشته به راست می‌رود
                direction="rtl"
                textAnchor="end"
                fontSize={12}
                fontWeight={selected ? 800 : 500}
                fill="white"
                fillOpacity={selected ? 1 : 0.62}
              >
                {v.name}
                {withYear ? ` ${toPersianDigits(String(v.month.jy))}` : ""}
              </text>
            );
          })}
        </svg>

        {/* هر ردیف یک دکمه، به پهنای کل ستون تا زدنش در گوشی آسان باشد */}
        <div role="group" aria-labelledby={`${id}-title`}>
          {vertebrae.map((v) => (
            <button
              key={v.month.from}
              type="button"
              aria-pressed={v.month.from === selectedFrom}
              aria-label={`${v.name} ${toPersianDigits(String(v.month.jy))}، ${formatShortAmount(v.month.totalToman)}`}
              onClick={() => onPick(v.month)}
              onPointerEnter={() => setPreview(v.month.from)}
              onFocus={() => setPreview(v.month.from)}
              onBlur={() => setPreview(null)}
              className="absolute inset-x-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              style={{
                top: `${((v.y - ROW / 2) / height) * 100}%`,
                height: `${(ROW / height) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      {shown && (
        <p className="mt-3 border-s-2 border-(--fin-orange) ps-3 text-sm">
          <span className="block font-bold">
            {shown.name} {toPersianDigits(String(shown.month.jy))}
          </span>
          <span className="block text-(--fin-orange)">
            {shown.month.count > 0 || shown.month.totalToman !== 0
              ? formatShortAmount(shown.month.totalToman)
              : "پرداختی نداشت"}
          </span>
          {shown.month.count > 0 && (
            <span className="block text-xs text-white/60">
              {toPersianDigits(String(shown.month.count))} پرداخت
            </span>
          )}
        </p>
      )}
    </div>
  );
}
