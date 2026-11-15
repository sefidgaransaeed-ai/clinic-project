import type { ReportDay } from "../data";
import { formatShortAmount } from "../money";

// اندازهٔ نمودار به واحد viewBox؛ نمودار به پهنای کارت کشیده می‌شود
const W = 600;
const H = 200;
// پیش‌بینی با کمتر از سه روز گذشته بیشتر حدس است تا حساب
const MIN_DAYS_FOR_FORECAST = 3;

const runningSum = (days: ReportDay[]) => {
  let sum = 0;
  return days.map((day) => (sum += day.totalToman));
};

/**
 * «جمع روی هم»: خطی که روزبه‌روز بالا می‌رود و نشان می‌دهد درآمد تا هر روز به کجا رسیده.
 * خط‌چین کم‌رنگ همان مسیر در بازهٔ قبل است. اگر بازه هنوز تمام نشده، خط‌چین نارنجی می‌گوید با همین
 * سرعتِ روزانه، آخر بازه به کجا می‌رسد.
 *
 * روزها از راست به چپ جلو می‌روند، مثل نمودار ستونی. شکل برای صفحه‌خوان پنهان است؛ جمله‌های
 * بالای نمودار همهٔ حرفش را می‌زنند.
 */
export function ReportCumulative({
  days,
  previous,
  today,
  previousName,
  untilLabel,
}: {
  days: ReportDay[];
  previous: ReportDay[];
  today: string;
  previousName: string;
  /** «تا آخر ماه» یا «تا آخر بازه» */
  untilLabel: string;
}) {
  const n = days.length;
  const elapsed = days.filter((day) => day.dayKey <= today).length;
  const current = runningSum(days.slice(0, elapsed));
  const before = runningSum(previous.slice(0, n));
  const reached = current.at(-1) ?? 0;
  const forecast =
    elapsed >= MIN_DAYS_FOR_FORECAST && elapsed < n ? Math.round((reached / elapsed) * n) : null;

  const values = [0, ...current, ...before, forecast ?? 0];
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const span = top - bottom || 1;
  // ده درصد بالای نمودار خالی می‌ماند تا برچسب‌ها جا داشته باشند
  const x = (index: number) => W - ((index + 0.5) / n) * W;
  const y = (value: number) => H - ((value - bottom) / span) * H * 0.88;
  const points = (sums: number[]) => sums.map((sum, index) => `${x(index)},${y(sum)}`).join(" ");

  const last = { x: x(elapsed - 1), y: y(reached) };
  const end = forecast === null ? null : { x: x(n - 1), y: y(forecast) };
  const beforeAtSameDay = before[elapsed - 1];

  return (
    <figure>
      <figcaption className="text-sm text-(--fin-muted)">
        {forecast !== null ? (
          <>
            اگر همین‌طور پیش برود، {untilLabel} حدود{" "}
            <strong className="text-(--fin-ink)">{formatShortAmount(forecast)}</strong> می‌شود.
          </>
        ) : (
          <>
            جمع کل: <strong className="text-(--fin-ink)">{formatShortAmount(reached)}</strong>.
          </>
        )}
        {elapsed < n
          ? beforeAtSameDay !== undefined &&
            elapsed > 0 && (
              <span className="block">
                {previousName} تا همین روز: {formatShortAmount(beforeAtSameDay)}.
              </span>
            )
          : previous.length > 0 && (
              <span className="block">
                {previousName}: {formatShortAmount(previous.reduce((sum, day) => sum + day.totalToman, 0))}.
              </span>
            )}
      </figcaption>

      <div aria-hidden="true" className="relative mt-4 h-44">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <line
            x1={0}
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--fin-navy)"
            strokeOpacity={0.25}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {before.length > 1 && (
            <polyline
              points={points(before)}
              fill="none"
              stroke="var(--fin-navy)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {current.length > 0 && (
            <polygon
              points={`${x(0)},${y(0)} ${points(current)} ${last.x},${y(0)}`}
              fill="var(--fin-orange)"
              fillOpacity={0.14}
            />
          )}
          {end && (
            <line
              x1={last.x}
              y1={last.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--fin-orange)"
              strokeWidth={2}
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {current.length > 1 && (
            <polyline
              points={points(current)}
              fill="none"
              stroke="var(--fin-orange)"
              strokeWidth={3}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* نقطه‌ها و برچسب‌ها بیرون از svg، تا با کشیده‌شدن نمودار بیضی نشوند */}
        {elapsed > 0 && (
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white bg-(--fin-navy)"
            style={{ left: `${(last.x / W) * 100}%`, top: `${(last.y / H) * 100}%` }}
          />
        )}
        {end && (
          <span
            className="absolute -translate-y-full pb-1.5 text-xs font-bold whitespace-nowrap text-(--fin-orange)"
            style={{ left: `${(end.x / W) * 100}%`, top: `${(end.y / H) * 100}%` }}
          >
            حدود {formatShortAmount(forecast ?? 0)}
          </span>
        )}
      </div>

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-(--fin-muted)">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[3px] w-4 bg-(--fin-orange)" />
          این بازه
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-(--fin-navy)/40" />
          {previousName}
        </span>
        {end && (
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-(--fin-orange)" />
            پیش‌بینی
          </span>
        )}
      </p>
    </figure>
  );
}
