import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton } from "@/modules/site/components/button-styles";
import { ChapterSpine } from "@/modules/site/components/chapter-spine";
import { CheckIcon } from "@/modules/site/components/icons";
import { PageIntro } from "@/modules/site/components/page-intro";
import { PatientExchange } from "@/modules/site/components/patient-exchange";
import { SectionHeading } from "@/modules/site/components/section-heading";
import { appointmentHref, hero, serviceGroups } from "@/modules/site/copy";
import { getSiteInfo } from "@/modules/site/data";
import { toPersianDigits } from "@/modules/site/format";

export const metadata: Metadata = {
  title: "خدمات",
};

// ستون مهره‌ها: یک مهره برای هر گروه درمان، و دو مهره برای بخش‌های پایانی صفحه
const CHAPTERS = [
  ...serviceGroups.map((group) => ({ id: group.id, label: group.short })),
  { id: "match", label: "شما می‌گویید" },
  { id: "next-step", label: "نوبت" },
];

export default async function ServicesPage() {
  const siteInfo = await getSiteInfo();

  return (
    <>
      <ChapterSpine chapters={CHAPTERS} />

      <PageIntro
        eyebrow="خدمات"
        title="درمان غیرجراحی درد کمر، گردن و مفاصل"
        description="اول علت درد پیدا می‌شود؛ بعد از میان این روش‌ها، فقط درمانی پیشنهاد می‌شود که برای شما لازم است."
      />

      <section aria-label="گروه‌های خدمت" className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <ol className="flex flex-col gap-6">
          {serviceGroups.map((group, index) => (
            <li
              key={group.id}
              id={group.id}
              className="grid scroll-mt-28 gap-6 rounded-3xl border border-(--site-grey) bg-white p-6 md:grid-cols-[1fr_1.1fr] md:p-10"
            >
              <div>
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-(--site-navy) text-xl font-black text-(--site-orange)">
                  <span className="sr-only">گروه </span>
                  {toPersianDigits(String(index + 1))}
                </span>
                <h2 className="text-2xl font-bold text-(--site-navy) md:text-3xl">{group.title}</h2>
                <p className="mt-3 text-lg text-(--site-muted)">{group.solves}</p>
                <p className="mt-6 w-fit rounded-2xl rounded-ss-sm bg-(--site-peach) px-4 py-3 font-medium text-(--site-navy)">
                  «{group.patientSays}»
                </p>
              </div>
              <ul className="flex flex-col gap-3 self-center rounded-2xl bg-(--site-grey-soft) p-5 md:p-6">
                {group.services.map((service) => (
                  <li key={service} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-(--site-navy)">
                      <CheckIcon className="size-4" />
                    </span>
                    <span>{service}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="match"
        aria-labelledby="match-title"
        className="scroll-mt-24 bg-(--site-grey-soft)"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1fr_1.1fr] md:py-20">
          <SectionHeading
            id="match-title"
            eyebrow="از زبان بیماران"
            title="شما چه می‌گویید، و چه خدمتی به آن پاسخ می‌دهد"
            description="بیشتر بیماران با یکی از همین جمله‌ها به مطب می‌آیند. لازم نیست نام درمان را بدانید."
          />
          <PatientExchange surface="white" />
        </div>
      </section>

      <section
        id="next-step"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 text-center md:py-20"
      >
        <h2 className="text-2xl font-bold text-(--site-navy)">
          نمی‌دانید کدام درمان برای شماست؟
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-(--site-muted)">
          لازم نیست بدانید. در معاینه، علت درد پیدا می‌شود و درمان مناسب برایتان توضیح داده می‌شود.
        </p>
        <Link href={appointmentHref(siteInfo.phone)} className={`${primaryButton} mt-8`}>
          {hero.primaryCta}
        </Link>
      </section>
    </>
  );
}
