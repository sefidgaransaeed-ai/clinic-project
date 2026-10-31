import Link from "next/link";
import {
  outlineButton,
  primaryButton,
} from "@/modules/site/components/button-styles";
import { ChapterHeading } from "@/modules/site/components/chapter-heading";
import { ChapterSpine } from "@/modules/site/components/chapter-spine";
import { ContactDetails } from "@/modules/site/components/contact-details";
import { DaySky } from "@/modules/site/components/day-sky";
import { HomeHero } from "@/modules/site/components/home-hero";
import {
  ArrowIcon,
  CheckIcon,
  DocumentIcon,
  PhoneIcon,
  SearchIcon,
  SignpostIcon,
  TargetIcon,
} from "@/modules/site/components/icons";
import { SentencePoster } from "@/modules/site/components/sentence-poster";
import { ServiceBento } from "@/modules/site/components/service-bento";
import { TreatmentPath } from "@/modules/site/components/treatment-path";
import {
  appointmentHref,
  beliefLine,
  dailyLifeLine,
  hero,
  keyMessages,
  sharedCommitment,
} from "@/modules/site/copy";
import { getClinics, getSiteInfo, getWorkingHours } from "@/modules/site/data";
import { phoneHref } from "@/modules/site/format";

const MESSAGE_ICONS = {
  search: SearchIcon,
  target: TargetIcon,
  document: DocumentIcon,
  signpost: SignpostIcon,
};

/**
 * صفحهٔ اول، مثل یک داستان در فصل‌ها — روی یک ستون فقرات.
 * ترتیب فصل‌ها از طرح بروشور برندگاید می‌آید: درد ← تشخیص ← مسیر ← زندگی ← همراهی ← نوبت.
 * ستون کنار صفحه (ChapterSpine) نشان می‌دهد کجای داستان هستید.
 */
const CHAPTERS = [
  { id: "start", label: "شروع" },
  { id: "pain", label: "درد" },
  { id: "diagnosis", label: "تشخیص" },
  { id: "path", label: "مسیر" },
  { id: "life", label: "زندگی" },
  { id: "together", label: "همراهی" },
  { id: "appointment", label: "نوبت" },
];

export default async function HomePage() {
  const [siteInfo, clinics, workingHours] = await Promise.all([
    getSiteInfo(),
    getClinics(),
    getWorkingHours(),
  ]);
  const bookingHref = appointmentHref(siteInfo.phone);

  return (
    <>
      <ChapterSpine chapters={CHAPTERS} />

      <HomeHero
        id="start"
        siteInfo={siteInfo}
        clinics={clinics}
        workingHours={workingHours}
      />

      <section aria-label="اصول کار مطب" className="mx-auto max-w-6xl px-4 pt-6 md:pt-4">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
          {keyMessages.map(({ icon, text }) => {
            const MessageIcon = MESSAGE_ICONS[icon];
            return (
              <li
                key={text}
                className="flex items-start gap-3 lg:border-s lg:border-(--site-grey) lg:px-6 lg:first:border-s-0 lg:first:ps-0"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--site-peach) text-(--site-navy)">
                  <MessageIcon className="size-5" />
                </span>
                <span className="pt-1 font-medium text-(--site-navy)">{text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* فصل ۱ — درد */}
      <section id="pain" aria-labelledby="pain-title" className="scroll-mt-24 py-16 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <ChapterHeading
            id="pain-title"
            number={1}
            name="درد"
            title="این جمله‌ها برایتان آشناست؟"
          />
        </div>
        <SentencePoster />
        <figure className="mx-auto mt-16 max-w-3xl px-4 text-center">
          {/* سه مهرهٔ کوچک، به جای علامت نقل‌قول */}
          <span aria-hidden="true" className="flex items-center justify-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-(--site-orange)/50" />
            <span className="h-3.5 w-8 rounded-md bg-(--site-orange)" />
            <span className="h-2.5 w-5 rounded-sm bg-(--site-orange)/50" />
          </span>
          <blockquote className="mt-6 text-xl leading-snug font-black text-balance text-(--site-navy) md:text-2xl">
            {beliefLine}
          </blockquote>
          <figcaption className="mx-auto mt-5 max-w-xl text-base text-(--site-muted)">
            {dailyLifeLine}
          </figcaption>
          <Link href={bookingHref} className={`${primaryButton} mt-9`}>
            {hero.primaryCta}
            <ArrowIcon className="size-5" />
          </Link>
        </figure>
      </section>

      {/* فصل ۲ — تشخیص و درمان */}
      <section
        id="diagnosis"
        aria-labelledby="diagnosis-title"
        className="scroll-mt-24 bg-(--site-grey-soft)"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <ChapterHeading
              id="diagnosis-title"
              number={2}
              name="تشخیص"
              title="اول علت درد، بعد درمان"
              description="درمان‌ها در سه گروه‌اند. کنار هر گروه، جمله‌ای آمده که بیماران معمولاً با آن به مطب می‌آیند."
            />
            <Link
              href="/services"
              className="inline-flex shrink-0 items-center gap-2 font-bold text-(--site-blue) hover:underline"
            >
              همهٔ خدمات
              <ArrowIcon className="size-5" />
            </Link>
          </div>
          <ServiceBento />
        </div>
      </section>

      {/* فصل ۳ — مسیر */}
      <section
        id="path"
        aria-labelledby="path-title"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24"
      >
        <ChapterHeading
          id="path-title"
          number={3}
          name="مسیر"
          title="چهار قدم تا شروع درمان"
        />
        <TreatmentPath />
        <div className="mt-12 flex justify-center">
          <a href={phoneHref(siteInfo.phone)} className={outlineButton}>
            <PhoneIcon className="size-5" />
            قدم اول: تماس بگیرید
          </a>
        </div>
      </section>

      {/* فصل ۴ — زندگی */}
      <DaySky id="life" bookingHref={bookingHref} />

      {/* فصل ۵ — همراهی */}
      <section
        id="together"
        aria-labelledby="together-title"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24"
      >
        <ChapterHeading
          id="together-title"
          number={5}
          name="همراهی"
          title="سهم شما در درمان"
          description={sharedCommitment.intro}
        />
        <div className="relative mt-12 grid overflow-hidden rounded-[2rem] border border-(--site-grey) md:grid-cols-2">
          <CommitmentHalf title="تعهد پزشک" items={sharedCommitment.doctor} />
          {/* «و» میان دو نیمه: پزشک و شما */}
          <div aria-hidden="true" className="relative h-0 md:hidden">
            <AndBadge className="absolute top-0 left-1/2 flex -translate-x-1/2 -translate-y-1/2" />
          </div>
          <CommitmentHalf title="سهم شما" items={sharedCommitment.patient} highlighted />
          <AndBadge className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex" />
        </div>
      </section>

      {/* فصل ۶ — نوبت */}
      <section
        id="appointment"
        aria-labelledby="appointment-title"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 md:pb-24"
      >
        <div className="grid gap-10 rounded-[2rem] bg-(--site-grey-soft) p-6 lg:grid-cols-[1.5fr_1fr] lg:items-center lg:p-12">
          <div>
            <ChapterHeading
              id="appointment-title"
              number={6}
              name="نوبت"
              title="برای شروع، تماس بگیرید"
              description="روند درمان و هزینه‌ها را پیش از نوبت برایتان توضیح می‌دهیم."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={bookingHref} className={primaryButton}>
                {hero.primaryCta}
              </Link>
              <a href={phoneHref(siteInfo.phone)} className={`${outlineButton} bg-white`}>
                <PhoneIcon className="size-5" />
                تماس تلفنی
              </a>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6">
            <ContactDetails
              siteInfo={siteInfo}
              clinics={clinics}
              workingHours={workingHours}
            />
          </div>
        </div>
      </section>
    </>
  );
}

function CommitmentHalf({
  title,
  items,
  highlighted = false,
}: {
  title: string;
  items: string[];
  highlighted?: boolean;
}) {
  return (
    <div className={`p-6 md:p-10 ${highlighted ? "bg-(--site-peach)" : "bg-white"}`}>
      <h3 className="text-2xl font-black text-(--site-navy)">{title}</h3>
      <ul className="mt-5 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <CheckIcon className="mt-1 size-5 shrink-0 text-(--site-navy)" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AndBadge({ className }: { className: string }) {
  return (
    <span
      className={`z-10 size-14 items-center justify-center rounded-full bg-(--site-navy) pb-1 text-2xl font-black text-white ring-8 ring-white ${className}`}
    >
      و
    </span>
  );
}
