import { toPersianDigits } from "../dates";
import { card } from "./styles";

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

// ضلع مربع نارنجی به نسبت خانه، مثل تقویم نوار سرمه‌ای
const SIZE = { min: 0.3, max: 0.8 };

/**
 * «ساعت‌های پرکار»: جدول روزهای هفته در برابر ساعت‌های روز. در هر خانه یک مربع نارنجی به اندازهٔ
 * شمار پرداخت‌های آن ساعت. ساعتِ ثبت پرداخت است، نه ساعت نوبت، پس تصویر نزدیکی از شلوغی مطب است.
 *
 * یک جدول واقعی است تا صفحه‌خوان هم بتواند خانه‌به‌خانه بخواندش.
 */
export function ReportHours({ grid }: { grid: number[][] }) {
  const busy = grid.flatMap((row, weekday) =>
    row.map((count, hour) => ({ weekday, hour, count })),
  );
  const used = busy.filter((cell) => cell.count > 0);
  if (used.length === 0) return null;

  const first = Math.min(...used.map((cell) => cell.hour));
  const last = Math.max(...used.map((cell) => cell.hour));
  const hours = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const top = used.reduce((best, cell) => (cell.count > best.count ? cell : best));
  // شلوغ‌ترین خانه فقط وقتی گفته می‌شود که از بقیه جلوتر باشد، نه وقتی چند خانه برابرند
  const clearWinner = used.filter((cell) => cell.count === top.count).length === 1;

  return (
    <section className={`${card} break-inside-avoid`} aria-labelledby="report-hours-title">
      <h2 id="report-hours-title" className="text-lg font-black text-(--fin-navy)">
        ساعت‌های پرکار
      </h2>
      <p className="mt-1 text-sm text-(--fin-muted)">
        {clearWinner
          ? `${WEEKDAYS[top.weekday]}‌ها حدود ساعت ${toPersianDigits(String(top.hour))} از همه شلوغ‌تر بوده.`
          : "هنوز ساعتی آشکارا از بقیه شلوغ‌تر نیست."}{" "}
        بر اساس ساعت ثبت پرداخت، نه ساعت نوبت.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <td />
              {hours.map((hour) => (
                <th key={hour} scope="col" className="font-normal text-(--fin-muted)">
                  {toPersianDigits(String(hour))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((name, weekday) => (
              <tr key={name}>
                <th
                  scope="row"
                  className="pe-2 text-start font-normal whitespace-nowrap text-(--fin-ink)"
                >
                  {name}
                </th>
                {hours.map((hour) => {
                  const count = grid[weekday][hour];
                  const side = count > 0 ? SIZE.min + (SIZE.max - SIZE.min) * Math.sqrt(count / top.count) : 0;
                  return (
                    <td key={hour} className="p-0">
                      <span className="relative block size-6 rounded-[2px] bg-(--fin-grey-soft)">
                        {count > 0 && (
                          <>
                            <span
                              aria-hidden="true"
                              className="absolute end-[10%] bottom-[10%] bg-(--fin-orange)"
                              style={{ width: `${side * 100}%`, height: `${side * 100}%` }}
                            />
                            <span className="sr-only">{toPersianDigits(String(count))} پرداخت</span>
                          </>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
