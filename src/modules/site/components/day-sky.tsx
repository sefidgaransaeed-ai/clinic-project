import Link from "next/link";
import { dailyGoal, hero } from "../copy";
import { primaryButton } from "./button-styles";
import { ChapterHeading } from "./chapter-heading";
import { MomentIllustration } from "./illustrations";

// هر لحظه روی چه زمینه‌ای می‌نشیند: صبح روی هلویی، روز روی روشن، شب روی سرمه‌ای
const CARD_TONES = [
  "bg-white/70 text-(--site-navy)",
  "bg-white text-(--site-navy) shadow-[0_20px_40px_-28px_rgba(38,34,97,0.5)]",
  "border border-white/15 bg-white/10 text-white",
];

/**
 * فصل «زندگی»: آسمانی که از هلویی صبح (راست) به سرمه‌ای شب (چپ) می‌رود،
 * و خورشید روی یک قوس تا ماه می‌رسد. در موبایل، صبح بالا و شب پایین است.
 */
export function DaySky({ id, bookingHref }: { id: string; bookingHref: string }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="relative isolate scroll-mt-24 overflow-hidden bg-[linear-gradient(to_bottom,var(--site-peach),#f4f4f5_34%,var(--site-blue)_70%,var(--site-navy))] md:bg-[linear-gradient(to_left,var(--site-peach),#f4f4f5_34%,var(--site-blue)_72%,var(--site-navy))]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <ChapterHeading
          id={`${id}-title`}
          number={4}
          name="زندگی"
          title="برگشتن به یک روز عادی"
          description={dailyGoal.intro}
        />

        {/* مسیر خورشید تا ماه */}
        <svg
          viewBox="0 0 1000 150"
          className="mt-8 hidden h-auto w-full md:block"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M955 132 C 820 10, 180 10, 45 132"
            fill="none"
            stroke="var(--site-orange)"
            strokeWidth={2.5}
            strokeDasharray="2 12"
            strokeLinecap="round"
          />
          <circle cx="955" cy="132" r="16" fill="var(--site-orange)" />
          <path
            d="M955 98v-10M925 110l-7-7M985 110l7-7M920 132h-10M990 132h10"
            stroke="var(--site-orange)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx="500" cy="40" r="7" fill="var(--site-orange)" />
          <path d="M52 112a20 20 0 1 0 14 34 16 16 0 0 1-14-34Z" fill="#ffffff" />
          <path
            d="M110 70v8M106 74h8M150 96v6M147 99h6"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>

        <ul className="mt-10 grid gap-4 md:mt-2 md:grid-cols-3 md:gap-6">
          {dailyGoal.moments.map((moment, index) => (
            <li
              key={moment.key}
              className={`flex items-center gap-4 rounded-3xl p-5 backdrop-blur-sm md:block md:p-7 ${CARD_TONES[index]}`}
            >
              <MomentIllustration name={moment.key} className="size-14 shrink-0 md:size-16" />
              <div className="md:mt-6">
                <p className={`text-sm font-bold ${index === 2 ? "text-(--site-orange)" : "text-(--site-blue)"}`}>
                  {moment.label}
                </p>
                <p className="mt-1 text-xl font-black">{moment.title}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-start gap-5 md:ms-auto md:max-w-sm">
          <p className="text-sm text-white/80">{dailyGoal.note}</p>
          <Link href={bookingHref} className={primaryButton}>
            {hero.primaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
