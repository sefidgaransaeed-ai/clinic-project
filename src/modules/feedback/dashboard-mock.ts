import type { SurveyAnswer } from "./dashboard-rules";
import type { DashboardSource } from "./dashboard-data";

/**
 * دادهٔ نمونهٔ داشبورد بازخورد، برای دیدن صفحه پیش از اتصال کامل و برای آزمون.
 * همه ساختگی‌اند (بخش ۶ CLAUDE.md) — هیچ نام، شماره یا نظر واقعی در این فایل نیست.
 *
 * نظرسنجی‌ها نسبت به «حالا» ساخته می‌شوند تا هر روز صفحه پر به نظر برسد، نه خالی.
 */

/** چند نظر ساختگی با امتیاز و متن، نسبت به now */
const SAMPLES: { daysAgo: number; score: number; comment: string | null }[] = [
  { daysAgo: 1, score: 5, comment: "خیلی راضی بودم، توضیح‌ها کامل بود." },
  { daysAgo: 2, score: 4, comment: null },
  { daysAgo: 3, score: 5, comment: "درد کمرم خیلی بهتر شد." },
  { daysAgo: 5, score: 2, comment: "انتظار در مطب طولانی بود." },
  { daysAgo: 6, score: 5, comment: null },
  { daysAgo: 8, score: 4, comment: "برخورد خوب بود." },
  { daysAgo: 9, score: 5, comment: null },
  { daysAgo: 11, score: 1, comment: "ساعت نوبت عوض شد و خبر نداشتم." },
  { daysAgo: 12, score: 3, comment: "متوسط بود." },
  { daysAgo: 14, score: 4, comment: null },
  { daysAgo: 16, score: 5, comment: "تجهیزات تازه بود." },
  { daysAgo: 18, score: 4, comment: null },
  { daysAgo: 21, score: 5, comment: null },
  { daysAgo: 24, score: 2, comment: "پارکینگ پیدا نکردم." },
  { daysAgo: 27, score: 5, comment: "توصیه می‌کنم." },
  { daysAgo: 31, score: 4, comment: null },
  { daysAgo: 35, score: 5, comment: null },
  { daysAgo: 38, score: 3, comment: "منتظر بودم بیشتر توضیح بدهند." },
  { daysAgo: 44, score: 5, comment: null },
  { daysAgo: 52, score: 4, comment: "خوب بود." },
  { daysAgo: 60, score: 5, comment: null },
  { daysAgo: 71, score: 4, comment: null },
];

/** روز چند روز پیش، ساعت ۱۰ صبح تهران (۰۶:۳۰ UTC) */
function daysAgoIso(now: Date, days: number): string {
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days, 6, 30));
  return at.toISOString();
}

/**
 * دادهٔ نمونه: ۲۲ پاسخ و چند لینک بی‌پاسخ.
 * تعداد لینک‌ها بیشتر از پاسخ‌هاست تا «نرخ پاسخ» عددی معنی‌دار (نه صد در صد) نشان دهد.
 */
export function buildDashboardSource(now: Date = new Date()): DashboardSource {
  const answers: SurveyAnswer[] = SAMPLES.map((sample) => ({
    submittedAt: daysAgoIso(now, sample.daysAgo),
    score: sample.score,
    comment: sample.comment,
  }));

  // لینک‌ها: برای هر پاسخ یک لینک، به‌علاوه چند لینک بی‌پاسخ
  const linkCreatedAt = [
    ...SAMPLES.map((sample) => daysAgoIso(now, sample.daysAgo + 2)),
    ...Array.from({ length: 9 }, (_, index) => daysAgoIso(now, 4 + index * 7)),
  ];

  return { answers, linkCreatedAt };
}
