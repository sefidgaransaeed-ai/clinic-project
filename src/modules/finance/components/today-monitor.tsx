"use client";

import { useId, useState, type ReactNode } from "react";
import { formatJalaliLongDate, formatWeekday, tehranTime, toPersianDigits } from "../dates";
import { formatAmount, formatShortAmount } from "../money";
import type { Payment, Role } from "../types";
import type { Lookups } from "./payments-list";

/** ساعت و دقیقهٔ تهرانِ یک لحظه، به ساعت اعشاری: «۱۴:۳۰» → ۱۴٫۵ */
function hoursOf(at: string | Date): number {
  const [hours, minutes] = tehranTime(at).split(":").map(Number);
  return hours + minutes / 60;
}

// اندازه‌های صفحهٔ نوار، به واحد viewBox؛ صفحه به پهنای خودش کشیده می‌شود
const W = 1000;
const H = 240;
const BASE = 150;
const PAD = 30;
// پهنای یک ضربان کامل؛ اگر دو پرداخت نزدیک‌تر از این باشند ضربان‌ها باریک‌تر می‌شوند
const BEAT = 90;
// ضربان پرداخت معکوس‌شده رو به پایین است و همیشه هم‌اندازه
const DOWN_BEAT = 38;

// درصد گردشده، تا سرور و مرورگر یک رقم بنویسند
const pct = (value: number) => `${value.toFixed(2)}%`;
// نوشته‌ای که وسطش روی نقطه است، نزدیک لبهٔ صفحه به سمت داخل می‌رود تا بریده نشود
const edgeShift = (percent: number) => (percent > 85 ? -92 : percent < 15 ? -8 : -50);

type Beat = {
  payment: Payment;
  x: number;
  /** بلندی ضربان */
  height: number;
  reversed: boolean;
  /** باریکی ضربان، از صفر تا یک */
  scale: number;
};

/**
 * یک ضربان: موج کوچک، فرورفتگی، ضربان تیز، فرورفتگی دوم و موج آرام بعدی.
 * روز از راست به چپ می‌رود، پس ضربان هم از راست کشیده می‌شود.
 */
function beatPath({ x, height, reversed, scale: s }: Beat): string {
  const up = reversed ? 1 : -1;
  const small = Math.max(s, 0.4);
  return [
    `L${x + 34 * s} ${BASE}`,
    `Q${x + 28 * s} ${BASE - 9 * small} ${x + 22 * s} ${BASE}`,
    `L${x + 6 * s} ${BASE}`,
    `L${x + 3 * s} ${BASE + 6 * small}`,
    `L${x} ${BASE + up * height}`,
    `L${x - 4 * s} ${BASE - up * 16 * small}`,
    `L${x - 9 * s} ${BASE}`,
    `L${x - 20 * s} ${BASE}`,
    `Q${x - 32 * s} ${BASE - 18 * small} ${x - 44 * s} ${BASE}`,
  ].join(" ");
}

/**
 * «مانیتور امروز»: روز مطب مثل صفحهٔ مانیتور علائم حیاتی. هر پرداخت امروز یک ضربان است؛ ضربان
 * بلندتر یعنی مبلغ بیشتر، و پرداختی که معکوس شده ضربان رو به پایین دارد. خط نارنجی ساعت الان است و
 * بعد از آن نوار هنوز ننوشته. کنار صفحه رقم‌های امروز است؛ جمع امروز را فقط پزشک می‌بیند (تصمیم H-4).
 * با زدن هر ساعت، پرداخت‌های همان ساعت زیر صفحه دیده می‌شوند.
 */
export function TodayMonitor({
  now,
  role,
  entries,
  reversals,
  lookups,
  freshId,
}: {
  now: Date;
  role: Role;
  /** پرداخت‌ها و ثبت‌های معکوس امروز */
  entries: Payment[];
  reversals: Map<string, Payment>;
  lookups: Lookups;
  freshId: string | null;
}) {
  const id = useId();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const paid = entries
    .filter((payment) => !payment.reversesPaymentId)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const reversalCount = entries.length - paid.length;
  // جمع خالص امروز، با ثبت‌های معکوس
  const total = entries.reduce((sum, payment) => sum + payment.amountToman, 0);

  // ساعت‌ها: دست‌کم ۸ صبح تا ۸ شب، و هر پرداخت یا «الان» که بیرون از آن باشد
  const nowAt = hoursOf(now);
  const times = paid.map((payment) => hoursOf(payment.paidAt));
  const start = Math.floor(Math.min(8, nowAt, ...times));
  const end = Math.ceil(Math.max(20, nowAt + 0.01, ...times.map((time) => time + 0.01)));
  const X = (hours: number) => PAD + ((end - hours) / (end - start)) * (W - 2 * PAD);

  const max = Math.max(1, ...paid.map((payment) => payment.amountToman));
  // ضربان‌ها از راست (صبح) به چپ
  const beats: Beat[] = paid
    .map((payment) => ({
      payment,
      x: X(hoursOf(payment.paidAt)),
      reversed: reversals.has(payment.id),
      height: 0,
      scale: 1,
    }))
    .sort((a, b) => b.x - a.x)
    .map((beat, index, all) => {
      const right = index > 0 ? all[index - 1].x - beat.x : Infinity;
      const left = index < all.length - 1 ? beat.x - all[index + 1].x : Infinity;
      return {
        ...beat,
        height: beat.reversed
          ? DOWN_BEAT
          : 34 + 80 * Math.sqrt(Math.max(0, beat.payment.amountToman) / max),
        scale: Math.min(1, right / BEAT, left / BEAT),
      };
    });

  const nowX = X(nowAt);
  const traceEnd = Math.min(nowX, ...beats.map((beat) => beat.x - 44 * beat.scale));
  const trace = `M${W} ${BASE} ${beats.map(beatPath).join(" ")} L${traceEnd} ${BASE}`;

  const hours = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const hourOf = (payment: Payment) => Math.floor(hoursOf(payment.paidAt));
  const hoursWithPayments = [...new Set(paid.map(hourOf))];
  // اگر کاربر چیزی انتخاب نکرده، آخرین ساعتی که پرداخت دارد؛ پس پرداخت تازه خودش دیده می‌شود
  const shownHour = selectedHour ?? hoursWithPayments.at(-1) ?? Math.floor(nowAt);
  const shown = paid.filter((payment) => hourOf(payment) === shownHour);

  const label = (hour: number) => toPersianDigits(String(hour));

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-3xl border-[6px] border-[#2f2b6e] bg-[#15123d] p-4 text-white shadow-[inset_0_0_40px_rgba(64,64,153,0.5)] md:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-black">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-(--fin-orange) shadow-[0_0_8px_var(--fin-orange)] motion-safe:animate-pulse"
          />
          مانیتور امروز
        </h2>
        <p className="text-sm text-white/60">
          {formatWeekday(now)} {formatJalaliLongDate(now)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        {/* صفحهٔ نوار */}
        <div className="relative h-56 overflow-hidden rounded-xl bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[40px_40px] md:h-64">
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
          >
            {/* باقی روز: نقطه‌چین کم‌رنگ */}
            <line
              x1={traceEnd}
              y1={BASE}
              x2={PAD}
              y2={BASE}
              stroke="white"
              strokeOpacity={0.3}
              strokeWidth={2}
              strokeDasharray="2 8"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={trace}
              fill="none"
              stroke="var(--fin-orange)"
              strokeWidth={2.6}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: "drop-shadow(0 0 4px var(--fin-orange))" }}
            />
            <line
              x1={nowX}
              y1={14}
              x2={nowX}
              y2={H - 30}
              stroke="var(--fin-orange)"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* ساعت الان، بالای خط */}
          <span
            className="absolute top-1.5 rounded-md bg-(--fin-orange) px-2 text-xs leading-5 font-black whitespace-nowrap text-(--fin-navy)"
            style={{ left: pct((nowX / W) * 100), translate: `${edgeShift((nowX / W) * 100)}% 0` }}
          >
            الان {toPersianDigits(tehranTime(now))}
          </span>

          {/* مبلغ هر ضربان، اگر جا باشد؛ همه در فهرست زیر صفحه هم هستند */}
          {beats
            .filter((beat) => beat.scale >= 0.6)
            .map((beat) => {
              const fresh =
                beat.payment.id === freshId || reversals.get(beat.payment.id)?.id === freshId;
              return (
                <span
                  key={beat.payment.id}
                  aria-hidden="true"
                  className={`absolute text-xs font-black whitespace-nowrap ${
                    beat.reversed ? "text-(--fin-red-light)" : "text-white"
                  } ${fresh ? "motion-safe:animate-[fin-pulse_0.9s_ease-out]" : ""}`}
                  style={{
                    left: pct((beat.x / W) * 100),
                    top: pct(((BASE + (beat.reversed ? beat.height : -beat.height - 6)) / H) * 100),
                    // نزدیک لبه‌ها نوشته به سمت داخل صفحه می‌رود تا بریده نشود
                    translate: `${edgeShift((beat.x / W) * 100)}% ${beat.reversed ? "4px" : "-100%"}`,
                  }}
                >
                  {beat.reversed ? "معکوس شد" : formatShortAmount(beat.payment.amountToman).replace(" تومان", "")}
                </span>
              );
            })}

          {/* شمارهٔ ساعت‌ها؛ در گوشی یکی‌درمیان */}
          {hours.map((hour, index) => (
            <span
              key={hour}
              aria-hidden="true"
              className={`absolute bottom-2 -translate-x-1/2 text-xs font-bold text-white/50 ${index % 2 ? "hidden sm:block" : ""}`}
              style={{ left: pct((X(hour) / W) * 100) }}
            >
              {label(hour)}
            </span>
          ))}

          {/* هر ساعتی که پرداخت دارد یک دکمه است، به پهنای همان ساعت */}
          <div role="group" aria-label="ساعت‌هایی از امروز که پرداخت دارند">
            {hoursWithPayments.map((hour) => {
              const count = paid.filter((payment) => hourOf(payment) === hour).length;
              return (
                <button
                  key={hour}
                  type="button"
                  aria-pressed={shownHour === hour}
                  aria-controls={`${id}-detail`}
                  aria-label={`ساعت ${label(hour)} تا ${label(hour + 1)}، ${toPersianDigits(String(count))} پرداخت`}
                  onClick={() => setSelectedHour(hour)}
                  className="absolute inset-y-0 cursor-pointer transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white aria-pressed:bg-white/8"
                  style={{
                    left: pct((X(hour + 1) / W) * 100),
                    width: pct(((X(hour) - X(hour + 1)) / W) * 100),
                  }}
                />
              );
            })}
          </div>

          {paid.length === 0 && (
            <p className="absolute inset-x-4 top-6 text-center text-sm text-white/70">
              امروز هنوز پرداختی ثبت نشده. اولین پرداخت، اولین ضربان را می‌زند.
            </p>
          )}
        </div>

        {/* رقم‌های امروز، کنار صفحه؛ در گوشی بالای صفحه */}
        <dl className="order-first grid grid-cols-2 gap-2.5 md:order-none md:grid-cols-1 md:content-start">
          <Readout label="پرداخت امروز" tone="text-(--fin-orange)" big>
            {toPersianDigits(String(paid.length))}
          </Readout>
          {role === "doctor" && (
            <Readout label="جمع امروز · تومان">
              <bdi dir="ltr">{formatAmount(total)}</bdi>
            </Readout>
          )}
          <Readout label="ثبت معکوس" tone="text-(--fin-red-light)">
            {toPersianDigits(String(reversalCount))}
          </Readout>
        </dl>
      </div>

      {/* پرداخت‌های ساعت انتخاب‌شده */}
      <div
        id={`${id}-detail`}
        aria-live="polite"
        className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <p className="flex items-baseline justify-between gap-3">
          <span className="font-bold">
            ساعت {label(shownHour)} تا {label(shownHour + 1)}
            {shownHour === Math.floor(nowAt) && (
              <span className="ms-2 text-sm text-(--fin-orange)">الان</span>
            )}
          </span>
          <span className="text-sm text-white/60">
            {shown.length > 0 ? `${toPersianDigits(String(shown.length))} پرداخت` : ""}
          </span>
        </p>
        {shown.length > 0 ? (
          <ul className="mt-2">
            {shown.map((payment) => (
              <li key={payment.id} className="border-t border-white/10 first:border-0">
                <a
                  href={`#payment-${payment.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-(--fin-orange)"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-sm text-white/60">
                      {toPersianDigits(tehranTime(payment.paidAt))}
                    </span>
                    <span className="truncate font-bold">{lookups.patientName(payment.patientId)}</span>
                    {reversals.has(payment.id) && (
                      <span className="rounded-md bg-(--fin-red-light)/20 px-1.5 text-xs font-bold text-(--fin-red-light)">
                        معکوس شده
                      </span>
                    )}
                  </span>
                  <span className="text-sm whitespace-nowrap">
                    <bdi dir="ltr" className="font-bold text-(--fin-orange)">
                      {formatAmount(payment.amountToman)}
                    </bdi>{" "}
                    تومان
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/70">
            {paid.length === 0 ? "هنوز ضربانی ثبت نشده." : "در این ساعت پرداختی ثبت نشده."}
          </p>
        )}
      </div>
    </section>
  );
}

function Readout({
  label,
  tone = "text-white",
  big = false,
  children,
}: {
  label: string;
  tone?: string;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/12 px-3.5 py-2.5">
      <dt className="text-xs text-white/60">{label}</dt>
      <dd className={`font-black leading-tight ${big ? "text-4xl" : "text-2xl"} ${tone}`}>{children}</dd>
    </div>
  );
}
