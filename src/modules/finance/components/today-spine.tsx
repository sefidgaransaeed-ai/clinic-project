"use client";

import { useEffect, useId, useState } from "react";
import {
  formatJalaliLongDate,
  formatJalaliMonth,
  formatWeekday,
  jalaliParts,
  tehranTime,
  toPersianDigits,
} from "../dates";
import { formatAmount } from "../money";
import type { Payment, Role } from "../types";
import type { Lookups } from "./payments-list";

/** ساعت تهرانِ یک لحظه: «۱۴:۳۰» → ۱۴ */
function hourOf(at: string | Date): number {
  return Number(tehranTime(at).slice(0, 2));
}

// مهرهٔ ساعتی که هنوز نرسیده کمی بیرون از جایش است: [فاصله از ستون به پیکسل، چرخش به درجه]
const MISALIGNMENT = [
  [6, -9],
  [8, 7],
  [5, -6],
  [9, 10],
  [6, -8],
  [7, 6],
  [8, -10],
];

// اندازه‌های ستون، به پیکسل
const SPINE = { width: 260, row: 28, pad: 18, center: 108, amplitude: 30 };
// مهره از کنار منحنی شروع می‌شود و عمقش از دو سر به وسط بیشتر می‌شود، مثل نوار امضایی برند
const INNER = 5;
const DEPTH = { min: 18, max: 36 };
const GAP = 4;
const LABEL_OFFSET = INNER + DEPTH.max + 22;

type Point = { x: number; y: number };

type HourSlot = {
  hour: number;
  payments: Payment[];
  /** پرداخت‌هایی که معکوس نشده‌اند */
  live: number;
  state: "past" | "now" | "future";
  /** شکل مهره، به شکل نقطه‌های چندضلعی */
  shape: string;
  /** وسط مهره، برای عدد داخلش و دکمهٔ رویش */
  middle: Point;
  normal: Point;
  label: Point;
};

const fmt = (points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/**
 * «ستون امروز»، کشیده از روی لوگوی مطب: منحنی S ایستاده با هلال آبی، و مهره‌های گوشه‌تیز نارنجی
 * کنارش. هر مهره یک ساعت از امروز است، صبح بالا و شب پایین.
 * مهرهٔ ساعتی که پرداخت دارد نارنجی می‌شود و شمار پرداخت‌هایش داخلش نوشته می‌شود؛ مهرهٔ ساعت‌هایی که
 * هنوز نرسیده کم‌رنگ و کمی بیرون از جایش است، و با گذشت روز سر جایش می‌نشیند — همان داستان ستون سایت.
 * با انتخاب هر مهره، پرداخت‌های همان ساعت کنار ستون دیده می‌شوند.
 *
 * شکل‌ها هندسی‌اند، نه تصویر کالبدشکافی (برندگاید).
 */
export function TodaySpine({
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
  // پس از اولین نقاشی، مهره‌های ساعت‌های گذشته یکی‌یکی سر جایشان می‌نشینند
  const [settled, setSettled] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [previewHour, setPreviewHour] = useState<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const paid = entries
    .filter((payment) => !payment.reversesPaymentId)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
  const reversalCount = entries.length - paid.length;
  // جمع خالص امروز، با ثبت‌های معکوس؛ فقط برای پزشک (تصمیم H-4)
  const total = entries.reduce((sum, payment) => sum + payment.amountToman, 0);

  // ساعت‌ها: دست‌کم ۸ صبح تا ۸ شب، و هر پرداخت یا «الان» که بیرون از آن باشد
  const nowHour = hourOf(now);
  const paidHours = paid.map((payment) => hourOf(payment.paidAt));
  const first = Math.min(8, nowHour, ...paidHours);
  const last = Math.max(19, nowHour, ...paidHours);
  const count = last - first + 1;

  const height = count * SPINE.row + SPINE.pad * 2;
  const span = height - SPINE.pad * 2;
  // منحنی S ایستاده، مثل حرف S لوگو
  const curve = (t: number): Point => ({
    x: SPINE.center + SPINE.amplitude * Math.sin(2 * Math.PI * t),
    y: SPINE.pad + t * span,
  });
  // بردار عمود بر منحنی، رو به سمت مهره‌ها (راست)
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
  const depthAt = (t: number) => DEPTH.min + (DEPTH.max - DEPTH.min) * Math.sin(Math.PI * t);

  const slots: HourSlot[] = Array.from({ length: count }, (_, index) => {
    const hour = first + index;
    const gap = GAP / 2 / span;
    const start = index / count + gap;
    const end = (index + 1) / count - gap;
    const mid = (start + end) / 2;
    const tip = 4 / span;
    const outer = (t: number) => along(t, INNER + depthAt(t));
    // نوک کوچک رو به بیرون و کمی رو به پایین، مثل مهره‌های لوگو
    const apexBase = along(mid, INNER + depthAt(mid) + 6);
    const down = curve(mid + 0.001);
    const here = curve(mid);
    const downLength = Math.hypot(down.x - here.x, down.y - here.y);
    const apex = {
      x: apexBase.x + ((down.x - here.x) / downLength) * 3,
      y: apexBase.y + ((down.y - here.y) / downLength) * 3,
    };
    const shape = fmt([
      along(start, INNER),
      along(mid, INNER),
      along(end, INNER),
      outer(end),
      outer(mid + tip),
      apex,
      outer(mid - tip),
      outer(start),
    ]);
    const payments = paid.filter((payment) => hourOf(payment.paidAt) === hour);
    return {
      hour,
      payments,
      live: payments.filter((payment) => !reversals.has(payment.id)).length,
      state: hour < nowHour ? "past" : hour === nowHour ? "now" : "future",
      shape,
      middle: along(mid, INNER + depthAt(mid) / 2),
      normal: normalAt(mid),
      label: along(mid, LABEL_OFFSET),
    };
  });

  // هلال آبی سمت دیگر منحنی؛ وسطش پهن و دو سرش باریک، مثل S لوگو
  const swoosh = fmt([
    ...Array.from({ length: 41 }, (_, i) => along(i / 40, -3)),
    ...Array.from({ length: 41 }, (_, i) => along(1 - i / 40, -3 - 14 * Math.sin(Math.PI * (1 - i / 40)))),
  ]);

  const withPayments = slots.filter((slot) => slot.payments.length > 0);
  // اگر کاربر چیزی انتخاب نکرده، آخرین ساعتی که پرداخت دارد؛ پس پرداخت تازه خودش دیده می‌شود
  const shownHour = previewHour ?? selectedHour ?? withPayments.at(-1)?.hour ?? nowHour;
  const shown = slots.find((slot) => slot.hour === shownHour);
  const nowSlot = slots.find((slot) => slot.state === "now");

  const hourLabel = (hour: number) => toPersianDigits(String(hour));

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden rounded-3xl bg-(--fin-navy) bg-[radial-gradient(110%_90%_at_0%_0%,var(--fin-blue)_0%,transparent_60%)] p-5 text-white md:p-7"
    >
      <div className="grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-10">
        {/* سربرگ: تقویم، عنوان و شمارها */}
        <div className="flex flex-col gap-6 md:col-start-2 md:row-start-1">
          <div className="flex items-center gap-4">
            <CalendarSheet now={now} />
            <div>
              <h2 id={`${id}-title`} className="text-xl font-black">
                ستون امروز
              </h2>
              <p className="mt-1 max-w-sm text-sm text-white/70">
                هر مهره یک ساعت از امروز است. با گذشت روز مهره‌ها سر جایشان می‌نشینند و ساعتی که
                پرداخت دارد نارنجی می‌شود.
              </p>
            </div>
          </div>
          <dl className="flex gap-8 whitespace-nowrap">
            <div>
              <dt className="text-sm text-white/70">پرداخت امروز</dt>
              <dd className="text-3xl leading-tight font-black sm:text-4xl">
                {toPersianDigits(String(paid.length))}
              </dd>
              {reversalCount > 0 && (
                <dd className="text-sm text-(--fin-red-light)">
                  {toPersianDigits(String(reversalCount))} ثبت معکوس
                </dd>
              )}
            </div>
            {role === "doctor" && (
              <div>
                <dt className="text-sm text-white/70">جمع امروز</dt>
                <dd className="text-3xl leading-tight font-black text-(--fin-orange) sm:text-4xl">
                  <bdi dir="ltr">{formatAmount(total)}</bdi>{" "}
                  <span className="text-base font-bold">تومان</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* خود ستون */}
        <div className="md:col-start-1 md:row-span-2 md:row-start-1">
          <div className="relative mx-auto" style={{ width: SPINE.width, height }}>
            <svg
              aria-hidden="true"
              width={SPINE.width}
              height={height}
              viewBox={`0 0 ${SPINE.width} ${height}`}
              className="absolute inset-0 overflow-visible"
            >
              <polygon points={swoosh} fill="var(--fin-blue)" />

              {slots.map((slot, index) => {
                const crooked = slot.state === "future" || !settled;
                const [shift, tilt] = MISALIGNMENT[index % MISALIGNMENT.length];
                const fresh = slot.payments.some(
                  (payment) =>
                    payment.id === freshId || reversals.get(payment.id)?.id === freshId,
                );
                const allReversed = slot.payments.length > 0 && slot.live === 0;
                const look = slot.live
                  ? { fill: "var(--fin-orange)" }
                  : allReversed
                    ? { fill: "none", stroke: "var(--fin-red-light)", strokeWidth: 1.5 }
                    : slot.state === "future"
                      ? { fill: "white", fillOpacity: 0.05, stroke: "white", strokeOpacity: 0.25 }
                      : { fill: "white", fillOpacity: 0.22 };
                return (
                  <g
                    key={slot.hour}
                    className="transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transform: crooked
                        ? `translate(${(slot.normal.x * shift).toFixed(1)}px, ${(slot.normal.y * shift).toFixed(1)}px) rotate(${tilt}deg)`
                        : "none",
                      transitionDelay: `${index * 70}ms`,
                    }}
                  >
                    <g
                      className={fresh ? "motion-safe:animate-[fin-pulse_0.9s_ease-out]" : ""}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    >
                      <polygon points={slot.shape} strokeLinejoin="round" {...look} />
                      {slot.state === "now" && (
                        <polygon
                          points={slot.shape}
                          fill="none"
                          stroke="var(--fin-orange)"
                          strokeWidth={1.5}
                          strokeDasharray="3 2"
                          strokeLinejoin="round"
                        />
                      )}
                      {shownHour === slot.hour && slot.payments.length > 0 && (
                        <polygon
                          points={slot.shape}
                          fill="none"
                          stroke="white"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                        />
                      )}
                      {slot.live > 0 && (
                        <text
                          x={slot.middle.x}
                          y={slot.middle.y + 0.5}
                          dominantBaseline="central"
                          textAnchor="middle"
                          fill="var(--fin-navy)"
                          fontSize={12}
                          fontWeight={800}
                        >
                          {toPersianDigits(String(slot.live))}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

              {/* ساعت هر مهره، کنار نوکش؛ «الان» آن سوی هلال */}
              {slots.map((slot) => (
                <text
                  key={slot.hour}
                  x={slot.label.x}
                  y={slot.label.y}
                  dominantBaseline="central"
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={slot.state === "now" ? 800 : 500}
                  fill={slot.state === "now" ? "var(--fin-orange)" : "white"}
                  fillOpacity={slot.state === "future" ? 0.35 : slot.state === "now" ? 1 : 0.6}
                >
                  {hourLabel(slot.hour)}
                </text>
              ))}
              {nowSlot && (
                <text
                  x={nowSlot.middle.x - nowSlot.normal.x * 58}
                  y={nowSlot.middle.y - nowSlot.normal.y * 58}
                  dominantBaseline="central"
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={800}
                  fill="var(--fin-orange)"
                >
                  الان
                </text>
              )}
            </svg>

            {/* دکمه روی هر مهره‌ای که پرداخت دارد؛ با موس یا صفحه‌کلید پرداخت‌های همان ساعت را نشان می‌دهد */}
            <div role="group" aria-label="ساعت‌هایی از امروز که پرداخت دارند">
              {withPayments.map((slot) => (
                <button
                  key={slot.hour}
                  type="button"
                  aria-pressed={shownHour === slot.hour}
                  aria-controls={`${id}-detail`}
                  aria-label={`ساعت ${hourLabel(slot.hour)} تا ${hourLabel(slot.hour + 1)}، ${toPersianDigits(
                    String(slot.payments.length),
                  )} پرداخت`}
                  onClick={() => setSelectedHour(slot.hour)}
                  onMouseEnter={() => setPreviewHour(slot.hour)}
                  onMouseLeave={() => setPreviewHour(null)}
                  onFocus={() => setPreviewHour(slot.hour)}
                  onBlur={() => setPreviewHour(null)}
                  className="absolute cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-orange)"
                  style={{
                    left: slot.middle.x - 22,
                    top: slot.middle.y - SPINE.row / 2,
                    width: 44,
                    height: SPINE.row,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* پرداخت‌های ساعت انتخاب‌شده */}
        <div
          id={`${id}-detail`}
          aria-live="polite"
          className="self-start rounded-2xl bg-white/8 p-4 ring-1 ring-white/10 md:col-start-2 md:row-start-2"
        >
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-bold">
              ساعت {hourLabel(shownHour)} تا {hourLabel(shownHour + 1)}
              {shownHour === nowHour && <span className="ms-2 text-sm text-(--fin-orange)">الان</span>}
            </span>
            <span className="text-sm text-white/60">
              {shown && shown.payments.length > 0
                ? `${toPersianDigits(String(shown.payments.length))} پرداخت`
                : ""}
            </span>
          </p>
          {shown && shown.payments.length > 0 ? (
            <ul className="mt-2">
              {shown.payments.map((payment) => (
                <li key={payment.id} className="border-t border-white/10 first:border-0">
                  <a
                    href={`#payment-${payment.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-(--fin-orange)"
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm text-white/60">
                        {toPersianDigits(tehranTime(payment.paidAt))}
                      </span>
                      <span className="truncate font-bold">
                        {lookups.patientName(payment.patientId)}
                      </span>
                      {reversals.has(payment.id) && (
                        <span className="rounded-md bg-(--fin-red-light)/20 px-1.5 text-xs font-bold text-(--fin-red-light)">
                          معکوس شده
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap text-sm">
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
              {paid.length === 0
                ? "امروز هنوز پرداختی ثبت نشده. اولین پرداخت، اولین مهره را نارنجی می‌کند."
                : "در این ساعت پرداختی ثبت نشده."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** برگ تقویم رومیزی امروز */
function CalendarSheet({ now }: { now: Date }) {
  return (
    <>
      <p className="sr-only">
        امروز {formatWeekday(now)} {formatJalaliLongDate(now)}
      </p>
      <div
        aria-hidden="true"
        className="relative w-22 shrink-0 overflow-hidden rounded-xl bg-white text-center shadow-[0_4px_0_-1px_rgba(255,255,255,0.35)]"
      >
        {/* دو حلقهٔ صحافی بالای برگ */}
        <span className="absolute start-2.5 top-1.5 size-1.5 rounded-full bg-(--fin-navy)/60" />
        <span className="absolute end-2.5 top-1.5 size-1.5 rounded-full bg-(--fin-navy)/60" />
        <div className="bg-(--fin-orange) pt-2 pb-1 text-xs font-bold text-(--fin-navy)">
          {formatWeekday(now)}
        </div>
        <div className="pt-1 text-4xl leading-tight font-black text-(--fin-navy)">
          {toPersianDigits(String(jalaliParts(now).jd))}
        </div>
        <div className="pb-2 text-xs text-(--fin-muted)">{formatJalaliMonth(now)}</div>
      </div>
    </>
  );
}
