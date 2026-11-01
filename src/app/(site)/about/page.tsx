import type { Metadata } from "next";
import Link from "next/link";
import { primaryButton } from "@/modules/site/components/button-styles";
import { PageIntro } from "@/modules/site/components/page-intro";
import { SectionHeading } from "@/modules/site/components/section-heading";
import {
  aboutParagraphs,
  appointmentHref,
  brandValues,
  hero,
  signatureLine,
  treatmentGoal,
} from "@/modules/site/copy";
import { getSiteInfo } from "@/modules/site/data";
import { toPersianDigits } from "@/modules/site/format";

export const metadata: Metadata = {
  title: "دربارهٔ دکتر",
};

export default async function AboutPage() {
  const siteInfo = await getSiteInfo();

  return (
    <>
      <PageIntro
        eyebrow="دربارهٔ دکتر"
        title={siteInfo.doctor_name}
        // نام پزشک تنها نمی‌آید: تخصص و شمارهٔ نظام پزشکی درست زیرش (مادهٔ ۲۰، W-08)
        description={`${siteInfo.specialty_title}، نظام پزشکی ${toPersianDigits(siteInfo.medical_council_number)} — ${siteInfo.doctor_focus}`}
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr] md:py-20">
        <div className="flex flex-col gap-5 text-lg">
          {aboutParagraphs(
            siteInfo.doctor_name,
            siteInfo.specialty_title,
            toPersianDigits(siteInfo.medical_council_number),
          ).map(
            (paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ),
          )}
        </div>

        <aside className="flex flex-col gap-4 self-start">
          <p className="rounded-e-2xl border-s-4 border-(--site-orange) bg-(--site-peach) p-5 text-lg font-bold text-(--site-navy)">
            {signatureLine}
          </p>
          <dl className="rounded-2xl bg-(--site-grey-soft) p-5 text-sm">
            <dt className="text-(--site-muted)">عنوان تخصص</dt>
            <dd className="mb-3 font-medium text-(--site-navy)">{siteInfo.specialty_title}</dd>
            <dt className="text-(--site-muted)">شمارهٔ نظام پزشکی</dt>
            <dd className="font-medium text-(--site-navy)">
              {toPersianDigits(siteInfo.medical_council_number)}
            </dd>
          </dl>
        </aside>
      </section>

      <section aria-labelledby="values-title" className="bg-(--site-grey-soft)">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <SectionHeading id="values-title" eyebrow="ارزش‌ها" title="آنچه در درمان رعایت می‌شود" />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {brandValues.map((value) => (
              <li
                key={value.title}
                className="rounded-2xl border-s-4 border-(--site-navy) bg-white p-6"
              >
                <h3 className="text-lg font-bold text-(--site-navy)">{value.title}</h3>
                <p className="mt-2 text-(--site-muted)">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="flex flex-col gap-6 rounded-3xl bg-(--site-navy) p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <p className="max-w-2xl text-lg md:text-xl">{treatmentGoal}</p>
          <Link href={appointmentHref(siteInfo.phone)} className={`${primaryButton} shrink-0`}>
            {hero.primaryCta}
          </Link>
        </div>
      </section>
    </>
  );
}
