import type { FinanceReport, MonthWave } from "../data";
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

/** «۲٫۵ برابر»؛ از ده به بالا بی‌اعشار */
const times = (ratio: number) =>
  toPersianDigits(String(ratio < 10 ? Math.round(ratio * 10) / 10 : Math.round(ratio))).replace(".", "٫");

/**
 * تفسیر «نوار مالی»: ماه آخر فهرست کنار ماه پیش از آن. مثل جملهٔ آخر برگهٔ نوار عصب، ولی با
 * الگوی ثابت از روی همان ارقام؛ متن تولیدی هوش مصنوعی نیست (CLAUDE.md ۷.۹).
 */
export function waveInterpretation(waves: MonthWave[]): string {
  const current = waves.at(-1);
  const before = waves.at(-2);
  if (!current || !before) return "";
  const a = formatJalaliMonthName(noonOf(current.from));
  const b = formatJalaliMonthName(noonOf(before.from));
  const ongoing = current.ongoing ? ` ${a} هنوز تمام نشده و رقم‌هایش تا امروز است.` : "";

  if (before.totalToman <= 0) {
    return current.totalToman > 0
      ? `${b} درآمدی نداشت، پس دامنهٔ ${a} را نمی‌شود با آن سنجید.${ongoing}`
      : `${a} و ${b} هیچ‌کدام درآمدی نداشتند.`;
  }

  const ratio = current.totalToman / before.totalToman;
  const percent = Math.round(Math.abs(ratio - 1) * 100);
  const amplitude =
    ratio >= 2
      ? `دامنهٔ ${a} ${times(ratio)} برابر ${b} است`
      : percent < 10
        ? `دامنهٔ ${a} تقریباً هم‌اندازهٔ ${b} است`
        : `دامنهٔ ${a} ${toPersianDigits(String(percent))}٪ ${ratio > 1 ? "بیشتر" : "کمتر"} از ${b} است`;

  let latency = "";
  if (current.halfDay && before.halfDay) {
    const diff = before.halfDay - current.halfDay;
    latency =
      Math.abs(diff) < 2
        ? " و نیمهٔ درآمدش تقریباً همان روز ماه رسید"
        : ` و نیمهٔ درآمدش ${count(Math.abs(diff))} روز ${diff > 0 ? "زودتر" : "دیرتر"} رسید`;
  }

  // علت: تعداد بیشتر عوض شده یا میانگین هر پرداخت؟
  let cause = "";
  if (percent >= 10 && before.count > 0 && current.count > 0 && current.averageToman > 0 && before.averageToman > 0) {
    const countChange = Math.log(current.count / before.count);
    const averageChange = Math.log(current.averageToman / before.averageToman);
    cause =
      Math.abs(averageChange) > Math.abs(countChange)
        ? ` علتش بیشتر ${averageChange > 0 ? "بالا رفتن" : "پایین آمدن"} میانگین هر پرداخت است، نه تعداد.`
        : ` علتش بیشتر ${countChange > 0 ? "بیشتر شدن" : "کمتر شدن"} تعداد پرداخت‌هاست.`;
  }

  return `${amplitude}${latency}.${cause}${ongoing}`;
}
