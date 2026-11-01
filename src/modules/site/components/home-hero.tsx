import Link from "next/link";
import { appointmentHref, hero } from "../copy";
import { formatPhone, phoneHref, summarizeWorkingHours, toPersianDigits } from "../format";
import type { Clinic, SiteInfo, WorkingHours } from "../types";
import { Underline, WaveEdge } from "./brand-shapes";
import { ghostButtonOnDark, primaryButton } from "./button-styles";
import { HeroBackdrop } from "./hero-backdrop";
import { ArrowIcon, ClockIcon, PhoneIcon, PlayIcon } from "./icons";
import { PainFinder } from "./pain-finder";

/**
 * بالای صفحهٔ اول: تیتر برند با حروف درشت، روی زمینهٔ نور و موج و ستون مهره‌ها،
 * و کنارش «کجا درد دارید؟». پایینش لبهٔ موجی امضای برند.
 */
export function HomeHero({
  id,
  siteInfo,
  clinics,
  workingHours,
}: {
  id: string;
  siteInfo: SiteInfo;
  clinics: Clinic[];
  workingHours: WorkingHours[];
}) {
  const [before, highlighted, after] = hero.titleParts;
  const bookingHref = appointmentHref(siteInfo.phone);

  return (
    <>
      <section
        id={id}
        aria-labelledby="hero-title"
        className="relative isolate scroll-mt-24 overflow-hidden bg-(--site-navy) text-white"
      >
        <HeroBackdrop />

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:pt-20 lg:pb-12">
          <div>
            {/* نام پزشک هرگز تنها نمی‌آید: تخصص و شمارهٔ نظام پزشکی کنارش (مادهٔ ۲۰، W-08) */}
            <p className="mb-7 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/90">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--site-orange)" />
              <span>
                {siteInfo.doctor_name}، {siteInfo.specialty_title}، نظام پزشکی{" "}
                {toPersianDigits(siteInfo.medical_council_number)}
              </span>
            </p>

            <h1
              id="hero-title"
              className="text-[clamp(2.5rem,6.2vw,4.75rem)] leading-[1.22] font-black text-balance"
            >
              {before}{" "}
              <span className="relative inline-block whitespace-nowrap text-(--site-peach)">
                {highlighted}
                <Underline className="absolute inset-x-0 -bottom-2 h-4 w-full" />
              </span>{" "}
              {after}
            </h1>

            <p className="mt-7 max-w-xl text-lg text-white/80 md:text-xl">
              {hero.subtitle}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={bookingHref} className={primaryButton}>
                {hero.primaryCta}
                <ArrowIcon className="size-5" />
              </Link>
              <a
                href={siteInfo.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className={ghostButtonOnDark}
              >
                <PlayIcon className="size-5" />
                {hero.secondaryCta}
              </a>
            </div>

            {/* برندگاید: راه تماس در همان نگاه اول */}
            <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm">
              <div className="flex items-center gap-3">
                <dt className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-(--site-orange)">
                  <PhoneIcon className="size-5" />
                  <span className="sr-only">تلفن هماهنگی و نوبت</span>
                </dt>
                <dd>
                  <a
                    href={phoneHref(siteInfo.phone)}
                    dir="ltr"
                    className="font-bold text-white hover:underline"
                  >
                    {formatPhone(siteInfo.phone)}
                  </a>
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-(--site-orange)">
                  <ClockIcon className="size-5" />
                  <span className="sr-only">ساعت کاری</span>
                </dt>
                <dd className="text-white/85">
                  {summarizeWorkingHours(workingHours, clinics).map((row) => (
                    <span key={`${row.clinic} ${row.days}`} className="block">
                      <span className="font-bold text-white">{row.clinic}:</span>{" "}
                      {row.days}، {row.hours}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <PainFinder bookingHref={bookingHref} />
        </div>
      </section>

      <WaveEdge position="bottom" className="-mt-px block h-14 w-full md:h-24" />
    </>
  );
}
