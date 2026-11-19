import { toPersianDigits } from "@/lib/format";

/**
 * قاعده‌های داشبورد بازخورد (کار p3-10)، جدا از صفحه تا با آزمون سنجیده شود.
 *
 * همهٔ محاسبه‌ها روی «نظرسنجی‌های پاسخ‌داده» کار می‌کنند: ردیفی که `submitted_at` دارد
 * و امتیازش بین ۱ و ۵ است. لینک ساخته‌شده ولی بی‌پاسخ در میانگین نمی‌آید، ولی در
 * «نرخ پاسخ» مخرج است — وگرنه نرخ همیشه صد درصد می‌شد.
 *
 * مرز روز و ماه به وقت تهران است، همان قاعدهٔ H-12 که در مالی هم داریم.
 */

export type SurveyAnswer = {
  /** لحظهٔ ثبت نظر، UTC */
  submittedAt: string;
  score: number;
  comment: string | null;
};

export type DashboardRange = "thisMonth" | "lastMonth" | "last3Months";

export const RANGE_LABELS: Record<DashboardRange, string> = {
  thisMonth: "این ماه",
  lastMonth: "ماه قبل",
  last3Months: "سه ماه اخیر",
};

/** بازهٔ هر انتخاب، به‌صورت کلید روز میلادی «YYYY-MM-DD» و شامل هر دو سر */
export type DayRange = { from: string; to: string };

const TEHRAN = "Asia/Tehran";

/** کلید روز میلادی به وقت تهران */
export function tehranDayKey(at: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof at === "string" ? new Date(at) : at);
}

function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ماه میلادی یک کلید روز، پس از جابه‌جایی با شمار ماه‌ها */
function monthShift(dayKey: string, months: number): { year: number; month: number } {
  const [y, m] = dayKey.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  return { year: Math.floor(total / 12), month: (total % 12 + 12) % 12 + 1 };
}

function monthBounds(year: number, month: number): DayRange {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

/**
 * بازهٔ انتخاب‌شده. «این ماه» و «ماه قبل» ماه **میلادی** جاری‌اند، چون صفحهٔ گزارش مالی هم
 * همین کار را می‌کند و دو صفحه با دو تقویم مختلف گیج‌کننده می‌شد.
 */
export function rangeFor(range: DashboardRange, now: Date): DayRange {
  const today = tehranDayKey(now);
  if (range === "thisMonth") {
    const { year, month } = monthShift(today, 0);
    return monthBounds(year, month);
  }
  if (range === "lastMonth") {
    const { year, month } = monthShift(today, -1);
    return monthBounds(year, month);
  }
  // سه ماه اخیر: از اول ماهِ دو ماه قبل تا امروز
  const { year, month } = monthShift(today, -2);
  return { from: monthBounds(year, month).from, to: today };
}

export function inRange(answer: SurveyAnswer, range: DayRange): boolean {
  const day = tehranDayKey(answer.submittedAt);
  return day >= range.from && day <= range.to;
}

/** هفتهٔ یک روز: شنبه‌ها شروع هفته است، مثل تقویم ایران */
export function weekStartKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // ۰ = یکشنبه
  // شنبه در جاوااسکریپت ۶ است؛ فاصله تا شنبهٔ قبل:
  const back = (weekday + 1) % 7;
  return addDays(dayKey, -back);
}

export type ScoreBucket = { score: number; count: number; share: number };

export type WeeklyPoint = { weekStart: string; average: number; count: number };

export type DashboardSummary = {
  /** میانگین امتیاز، یک رقم اعشار؛ صفر اگر پاسخی نیست */
  averageScore: number;
  /** تعداد نظرهای ثبت‌شده در بازه */
  answerCount: number;
  /** تعداد لینک‌های ساخته‌شده در بازه (پاسخ‌داده و بی‌پاسخ) */
  linkCount: number;
  /** درصد پاسخ‌ها به لینک‌ها، عدد صحیح ۰ تا ۱۰۰؛ صفر اگر لینکی نیست */
  responseRate: number;
  /** درصد امتیاز ۴ و ۵ از کل پاسخ‌ها */
  happyShare: number;
  /** توزیع امتیازها، همیشه پنج خانه از ۱ تا ۵ حتی خالی */
  distribution: ScoreBucket[];
  /** میانگین هفتگی؛ هفته‌های بی‌پاسخ نمی‌آیند */
  weekly: WeeklyPoint[];
};

/**
 * همهٔ ارقام داشبورد.
 *
 * `linkCreatedAt` فهرست لحظهٔ ساختن لینک‌هاست — از `surveys.created_at`. بدون آن نرخ پاسخ
 * ساخته نمی‌شود، چون مخرجش تعداد لینک‌های همان بازه است.
 */
export function summarize(
  answers: SurveyAnswer[],
  linkCreatedAt: string[],
  range: DayRange,
): DashboardSummary {
  const inWindow = answers.filter((a) => inRange(a, range) && a.score >= 1 && a.score <= 5);
  const linksInWindow = linkCreatedAt.filter((at) => {
    const day = tehranDayKey(at);
    return day >= range.from && day <= range.to;
  });

  const answerCount = inWindow.length;
  const sum = inWindow.reduce((total, a) => total + a.score, 0);
  const averageScore = answerCount > 0 ? Math.round((sum / answerCount) * 10) / 10 : 0;

  const counts = new Map<number, number>();
  for (let score = 1; score <= 5; score += 1) counts.set(score, 0);
  for (const answer of inWindow) counts.set(answer.score, (counts.get(answer.score) ?? 0) + 1);

  const distribution: ScoreBucket[] = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: counts.get(score) ?? 0,
    share: answerCount > 0 ? Math.round(((counts.get(score) ?? 0) / answerCount) * 100) : 0,
  }));

  const happy = (counts.get(4) ?? 0) + (counts.get(5) ?? 0);
  const happyShare = answerCount > 0 ? Math.round((happy / answerCount) * 100) : 0;

  const linkCount = linksInWindow.length;
  const responseRate = linkCount > 0 ? Math.round((answerCount / linkCount) * 100) : 0;

  return {
    averageScore,
    answerCount,
    linkCount,
    responseRate,
    happyShare,
    distribution,
    weekly: weeklyAverages(inWindow, range),
  };
}

/**
 * میانگین هفتگی. اگر `range` داده شود، همهٔ هفته‌های آن بازه برگردانده می‌شوند و هفتهٔ
 * بی‌پاسخ `average: 0` و `count: 0` می‌گیرد — این در نمودار به «شکاف» تبدیل می‌شود،
 * نه نقطهٔ دروغین صفر. بدون `range` فقط هفته‌های دارای پاسخ برمی‌گردند.
 */
export function weeklyAverages(answers: SurveyAnswer[], range?: DayRange): WeeklyPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const answer of answers) {
    const week = weekStartKey(tehranDayKey(answer.submittedAt));
    const bucket = buckets.get(week) ?? { sum: 0, count: 0 };
    bucket.sum += answer.score;
    bucket.count += 1;
    buckets.set(week, bucket);
  }

  if (range) {
    for (let week = weekStartKey(range.from); week <= range.to; week = addDays(week, 7)) {
      if (!buckets.has(week)) buckets.set(week, { sum: 0, count: 0 });
    }
  }

  return [...buckets.entries()]
    .map(([weekStart, bucket]) => ({
      weekStart,
      average: bucket.count > 0 ? Math.round((bucket.sum / bucket.count) * 10) / 10 : 0,
      count: bucket.count,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** نظرهایی که برای پیگیری مهم‌اند: امتیاز ۱ و ۲، تازه‌ترین اول */
export function lowScores(answers: SurveyAnswer[]): SurveyAnswer[] {
  return answers
    .filter((a) => a.score <= 2)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** «۸۵٪» با رقم فارسی */
export function percentText(value: number): string {
  return `${toPersianDigits(value)}٪`;
}

/** میانگین با رقم فارسی و یک اعشار؛ «۴٫۲» */
export function scoreText(value: number): string {
  const fixed = value.toFixed(1);
  return toPersianDigits(fixed).replace(".", "٫");
}
