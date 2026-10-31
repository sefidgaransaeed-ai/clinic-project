import type { FinanceReport } from "../data";
import {
  daysSinceSaturday,
  formatJalaliMonthName,
  formatWeekday,
  jalaliParts,
  tehranLocalToIso,
  toPersianDigits,
} from "../dates";
import { formatShortAmount } from "../money";
import type { AppliedChoice, DayRange } from "./range-picker";

/** ظهر همان روز، تا نمایش روز با مرز نیمه‌شب جابه‌جا نشود */
const noonOf = (dayKey: string) => tehranLocalToIso(dayKey, "12:00");

// «یک» به حروف خواناتر از «۱» در وسط جمله است
const count = (value: number) => (value === 1 ? "یک" : toPersianDigits(String(value)));

/** «این ماه تا امروز»، «در مهر،»؛ سر جمله */
function periodOf(choice: AppliedChoice, range: DayRange, now: Date): string {
  if (choice === "today") return "امروز";
  if (choice === "week") return "این هفته";
  if (choice === "month") return "این ماه تا امروز";
  if (choice === "lastMonth" || choice === "pickedMonth") {
    const { jy } = jalaliParts(noonOf(range.from));
    const name = formatJalaliMonthName(noonOf(range.from));
    // سال فقط وقتی گفته می‌شود که با امسال فرق دارد
    return jy === jalaliParts(now).jy ? `در ${name}،` : `در ${name} ${count(jy)}،`;
  }
  return "در این بازه،";
}

/**
 * چند جملهٔ کوتاه به زبان ساده دربارهٔ بازه، ساخته از روی همان ارقام گزارش با الگوی ثابت.
 * متن تولیدی هوش مصنوعی نیست (CLAUDE.md ۷.۹)؛ هر جمله فقط وقتی می‌آید که حرفی برای گفتن داشته باشد.
 */
export function summarySentences({
  report,
  choice,
  range,
  now,
  methodName,
  reversalCount,
  refundCount,
}: {
  report: FinanceReport;
  choice: AppliedChoice;
  range: DayRange;
  now: Date;
  methodName: (id: string | null) => string;
  reversalCount: number;
  refundCount: number;
}): string[] {
  const period = periodOf(choice, range, now);
  if (report.count === 0 && report.netToman === 0) return [`${period} پرداختی ثبت نشده است.`];

  const sentences = [
    `${period} ${count(report.count)} پرداخت داشتید، روی هم ${formatShortAmount(report.netToman)}.`,
  ];

  // پرکارترین روز هفته، فقط وقتی بازه دست‌کم یک هفته است و بیش از یک روز هفته پرداخت داشته
  if (report.daily.length >= 7) {
    const byWeekday = new Map<number, { total: number; dayKey: string }>();
    for (const day of report.daily) {
      if (day.totalToman <= 0) continue;
      const weekday = daysSinceSaturday(noonOf(day.dayKey));
      const entry = byWeekday.get(weekday) ?? { total: 0, dayKey: day.dayKey };
      entry.total += day.totalToman;
      byWeekday.set(weekday, entry);
    }
    if (byWeekday.size > 1) {
      const best = [...byWeekday.values()].reduce((a, b) => (b.total > a.total ? b : a));
      sentences.push(`${formatWeekday(noonOf(best.dayKey))}‌ها از همه پرکارتر بودند.`);
    }
  }

  // روشی که بیشتر پرداخت‌ها با آن بوده، اگر یکی آشکارا جلوتر است
  const methods = report.byMethod.filter((line) => line.count > 0);
  if (methods.length > 1) {
    const [first, second] = [...methods].sort((a, b) => b.count - a.count);
    if (first.count > second.count) {
      sentences.push(`بیشتر پرداخت‌ها با ${methodName(first.id)} بود.`);
    }
  }

  if (reversalCount > 0) sentences.push(`${count(reversalCount)} پرداخت اصلاح شد.`);
  if (refundCount > 0) sentences.push(`${count(refundCount)} بار پول برگشت داده شد.`);
  return sentences;
}
