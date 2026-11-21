"use client";

import { useId, useMemo, useState } from "react";
import { toPersianDigits } from "@/lib/format";
import {
  RANGE_LABELS,
  lowScores,
  percentText,
  rangeFor,
  scoreText,
  summarize,
  tehranDayKey,
  type DashboardRange,
  type DashboardSummary,
  type SurveyAnswer,
  type WeeklyPoint,
} from "../dashboard-rules";
import { PaperCard } from "./paper";

const STAR_PATH = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

const RANGES: DashboardRange[] = ["thisMonth", "lastMonth", "last3Months"];

/** «۵ آذر» از کلید روز میلادی، به شمسی */
function shortJalali(dayKey: string): string {
  const at = new Date(`${dayKey}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    day: "numeric",
    month: "long",
  }).format(at);
}

/** متن کامل تاریخ نظر، برای فهرست پایین: «دوشنبه ۲۵ آبان» */
function fullJalaliDate(at: string): string {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(at));
}

function Star({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={filled ? "fill-current" : "fill-none stroke-current"}
      strokeWidth={1.6}
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

/** یک کارت عددی در بالای صفحه */
function StatCard({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "accent";
}) {
  return (
    <PaperCard tone={tone === "accent" ? "green" : "orange"} className="p-4">
      <p className="text-xs font-bold text-[#5f6062]">{label}</p>
      <p className="mt-1 text-3xl font-black text-(--site-navy) tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#5f6062]">{hint}</p> : null}
    </PaperCard>
  );
}

/** نمودار میله‌ای توزیع امتیازها؛ هر میله به کل پاسخ‌ها نسبت دارد */
function DistributionChart({ summary }: { summary: DashboardSummary }) {
  const max = Math.max(1, ...summary.distribution.map((bucket) => bucket.count));
  return (
    <div className="space-y-2" dir="rtl">
      {[...summary.distribution].reverse().map((bucket) => (
        <div key={bucket.score} className="flex items-center gap-2">
          <span className="flex w-14 shrink-0 items-center gap-1 text-xs font-bold text-(--site-navy)">
            {toPersianDigits(bucket.score)}
            <Star filled size={11} />
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-[#f4f4f5]">
            <div
              className={`h-full rounded-md ${bucket.score <= 2 ? "bg-[#b4342a]" : "bg-(--site-orange)"}`}
              style={{ width: `${(bucket.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-left text-xs tabular-nums text-[#5f6062]">
            {toPersianDigits(bucket.count)} <span className="opacity-70">({percentText(bucket.share)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * نمودار خطی میانگین هفتگی؛ نقطه‌ها با SVG و بی‌کتابخانه.
 *
 * هفتهٔ بی‌پاسخ (count: 0) **شکاف** است، نه صفر. اگر صفر رسم می‌شد، نمودار می‌گفت
 * «رضایت صفر شد» در حالی که فقط کسی جواب نداده. پس خط بین دو هفتهٔ باحواب، از روی
 * هفتهٔ خالی نمی‌گذرد و به دو تکه تقسیم می‌شود.
 */
function WeeklyChart({ points }: { points: DashboardSummary["weekly"] }) {
  const width = 520;
  const height = 158;
  /** حاشیهٔ راست جا برای اعداد محور امتیاز، حاشیهٔ چپ کمی کمتر */
  const padStart = 22;
  const padEnd = 20;
  const padY = 16;
  const answered = points.filter((point) => point.count > 0);
  if (answered.length === 0) {
    return <p className="py-8 text-center text-sm text-[#5f6062]">در این بازه هنوز پاسخی ثبت نشده است.</p>;
  }
  const stepX = points.length > 1 ? (width - padStart - padEnd) / (points.length - 1) : 0;
  /** ارتفاع ناحیهٔ رسم، جدا از نوار تاریخ پایین */
  const plotH = height - padY * 2;
  const yFor = (score: number) => padY + ((5 - score) / 4) * plotH;
  // چیدمان راست‌به‌چپ: قدیمی‌ترین هفته سمت راست می‌نشیند، تازه‌ترین سمت چپ — مثل
  // بقیهٔ صفحه. بدون این، خوانندهٔ فارسی نمودار را برعکس می‌خواند.
  const xFor = (index: number) => width - padStart - index * stepX;

  // هر قطعه: زنجیرهٔ هفته‌های پیوسته‌ای که پاسخ دارند
  const segments: { x: number; y: number; point: WeeklyPoint }[][] = [];
  let current: { x: number; y: number; point: WeeklyPoint }[] = [];
  points.forEach((point, index) => {
    if (point.count === 0) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: xFor(index), y: yFor(point.average), point });
  });
  if (current.length) segments.push(current);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="میانگین امتیاز هفتگی">
      {[1, 3, 5].map((score) => (
        <g key={score}>
          <line
            x1={padEnd}
            x2={width - padStart}
            y1={yFor(score)}
            y2={yFor(score)}
            stroke="#e6e7e8"
            strokeDasharray={score === 3 ? "4 4" : "0"}
          />
          <text x={width - 6} y={yFor(score) - 4} fontSize="10" fill="#5f6062" textAnchor="end">
            {toPersianDigits(score)}
          </text>
        </g>
      ))}
      {segments.map((segment, index) => {
        const path = segment.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
        return segment.length > 1 ? (
          <path
            key={`seg-${index}`}
            d={path}
            fill="none"
            stroke="var(--site-navy)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        ) : null;
      })}
      {segments.flat().map((c) => (
        <g key={c.point.weekStart}>
          <circle cx={c.x} cy={c.y} r="5" fill="#fffaf3" stroke="var(--site-navy)" strokeWidth="2.5" />
          <title>{`هفتهٔ ${shortJalali(c.point.weekStart)} — میانگین ${scoreText(c.point.average)} از ${toPersianDigits(c.point.count)} پاسخ`}</title>
        </g>
      ))}
      </svg>
      {/* تاریخ‌ها هم‌جهت با نمودار: قدیمی سمت راست، تازه سمت چپ.
          در RTL، اولین فرزند یک flex معمولی سمت راست می‌نشیند. */}
      <div className="mt-1 flex justify-between text-[11px] text-[#5f6062]">
        <span>{shortJalali(points[0].weekStart)}</span>
        <span>{shortJalali(points[points.length - 1].weekStart)}</span>
      </div>
    </div>
  );
}

export function DashboardScreen({
  answers,
  linkCreatedAt,
  nowIso,
}: {
  answers: SurveyAnswer[];
  linkCreatedAt: string[];
  nowIso: string;
}) {
  const [range, setRange] = useState<DashboardRange>("last3Months");
  const [onlyLow, setOnlyLow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const summary = useMemo(
    () => summarize(answers, linkCreatedAt, rangeFor(range, now)),
    [answers, linkCreatedAt, range, now],
  );

  const rangeDays = rangeFor(range, now);
  const recent = useMemo(() => {
    const inWindow = answers
      .filter((answer) => {
        const day = tehranDayKey(answer.submittedAt);
        return day >= rangeDays.from && day <= rangeDays.to;
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return onlyLow ? lowScores(inWindow) : inWindow;
  }, [answers, rangeDays.from, rangeDays.to, onlyLow]);

  /** اول فقط ۸ نظر؛ بقیه با دکمه — وگرنه صفحه به چند صفحهٔ بلند تبدیل می‌شود */
  const PAGE_SIZE = 8;
  const visible = expanded ? recent : recent.slice(0, PAGE_SIZE);
  const hiddenCount = recent.length - visible.length;

  return (
    <div className="site-theme space-y-5" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-(--site-navy)">رضایت مراجعان</h2>
          <p className="mt-1 text-sm text-[#5f6062]">
            از نظرهایی که مراجعان پس از نوبت ثبت کرده‌اند. نامی ثبت نمی‌شود.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-[#f4f4f5] p-1" role="group" aria-label="انتخاب بازه">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setRange(value); setExpanded(false); }}
              aria-pressed={range === value}
              className={`h-9 rounded-lg px-3 text-xs font-bold transition ${
                range === value
                  ? "bg-(--site-navy) text-white"
                  : "text-(--site-navy) hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue)"
              }`}
            >
              {RANGE_LABELS[value]}
            </button>
          ))}
        </div>
      </header>

      {summary.answerCount === 0 ? (
        <PaperCard className="p-8 text-center">
          <p className="text-sm text-[#5f6062]">
            در {RANGE_LABELS[range]} هنوز نظری ثبت نشده است.
          </p>
        </PaperCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="میانگین امتیاز"
              value={scoreText(summary.averageScore)}
              hint={`از ${toPersianDigits(summary.answerCount)} پاسخ`}
              tone="accent"
            />
            <StatCard label="تعداد پاسخ" value={toPersianDigits(summary.answerCount)} hint="نظر ثبت‌شده" />
            <StatCard
              label="نرخ پاسخ"
              value={percentText(summary.responseRate)}
              hint={`${toPersianDigits(summary.answerCount)} از ${toPersianDigits(summary.linkCount)} لینک`}
            />
            <StatCard
              label="راضی‌ها (۴ و ۵)"
              value={percentText(summary.happyShare)}
              hint="از کل پاسخ‌ها"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PaperCard className="p-5">
              <h3 className="mb-4 text-sm font-black text-(--site-navy)">توزیع امتیازها</h3>
              <DistributionChart summary={summary} />
            </PaperCard>

            <PaperCard className="p-5">
              <h3 className="mb-2 text-sm font-black text-(--site-navy)">میانگین هفتگی</h3>
              <p className="mb-3 text-xs text-[#5f6062]">شنبه آغاز هفته است؛ هفته‌های بی‌پاسخ در نمودار نیستند.</p>
              <WeeklyChart points={summary.weekly} />
            </PaperCard>
          </div>
        </>
      )}

      <PaperCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-(--site-navy)" id={`${id}-list`}>
            آخرین نظرها
          </h3>
          <button
            type="button"
            onClick={() => { setOnlyLow((value) => !value); setExpanded(false); }}
            aria-pressed={onlyLow}
            className={`h-9 rounded-lg border px-3 text-xs font-bold transition ${
              onlyLow
                ? "border-[#b4342a] bg-[#b4342a] text-white"
                : "border-[#b4342a]/40 text-[#b4342a] hover:bg-[#b4342a]/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4342a]"
            }`}
          >
            فقط ناراضی‌ها (۱ و ۲)
          </button>
        </div>

        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#5f6062]">
            {onlyLow ? "نظر ناراضی در این بازه نیست." : "نظری در این بازه ثبت نشده است."}
          </p>
        ) : (
          <ul className="divide-y divide-[#eadfce]" aria-labelledby={`${id}-list`}>
            {visible.map((answer) => (
              <li key={`${answer.submittedAt}-${answer.score}`} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-black ${
                    answer.score <= 2
                      ? "border-[#b4342a] text-[#b4342a]"
                      : "border-[#1f7a4d] text-[#1f7a4d]"
                  }`}
                >
                  {toPersianDigits(answer.score)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-0.5 ${answer.score <= 2 ? "text-[#b4342a]" : "text-(--site-orange)"}`}
                      aria-label={`امتیاز ${toPersianDigits(answer.score)} از ۵`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} filled={star <= answer.score} size={13} />
                      ))}
                    </span>
                    <span className="text-xs text-[#5f6062]">{fullJalaliDate(answer.submittedAt)}</span>
                  </div>
                  {answer.comment ? (
                    <p className="mt-1 text-sm leading-7 text-[#2b2b2e]">{answer.comment}</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#5f6062] opacity-70">بدون توضیح</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 ? (
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="h-9 rounded-lg border border-[#eadfce] px-4 text-xs font-bold text-(--site-navy) hover:bg-[#f4f4f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue)"
            >
              {toPersianDigits(hiddenCount)} نظر قبلی را هم نشان بده
            </button>
          </div>
        ) : null}
      </PaperCard>
    </div>
  );
}
