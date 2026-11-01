import type { Metadata } from "next";
import Link from "next/link";
import { outlineButton, primaryButton } from "@/modules/site/components/button-styles";
import { ChevronDownIcon, PhoneIcon } from "@/modules/site/components/icons";
import { PageIntro } from "@/modules/site/components/page-intro";
import { appointmentHref, hero } from "@/modules/site/copy";
import { getFaqItems, getSiteInfo } from "@/modules/site/data";
import { phoneHref } from "@/modules/site/format";

export const metadata: Metadata = {
  title: "پرسش‌های پرتکرار",
};

export default async function FaqPage() {
  const [faqItems, siteInfo] = await Promise.all([getFaqItems(), getSiteInfo()]);

  return (
    <>
      <PageIntro
        eyebrow="پرسش‌های پرتکرار"
        title="پیش از نوبت، شاید این‌ها را بپرسید"
        description="پاسخ‌ها کلی‌اند. تشخیص و پیشنهاد درمان فقط بعد از معاینه ممکن است."
      />

      <section className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        {/* details/summary: بدون جاوااسکریپت باز و بسته می‌شود و صفحه‌خوان‌ها آن را می‌شناسند */}
        <div className="flex flex-col gap-3">
          {faqItems.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border border-(--site-grey) bg-white open:border-(--site-orange) open:bg-(--site-grey-soft)"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 text-lg font-bold text-(--site-navy) focus-visible:outline-2 focus-visible:outline-(--site-blue) [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDownIcon className="size-5 shrink-0 text-(--site-blue) transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5">{item.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-(--site-peach) p-6 text-center">
          <p className="text-lg font-bold text-(--site-navy)">پرسش شما اینجا نبود؟</p>
          <p className="mt-1">با مطب تماس بگیرید؛ با حوصله پاسخ می‌دهیم.</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={phoneHref(siteInfo.phone)} className={`${outlineButton} bg-white`}>
              <PhoneIcon className="size-5" />
              تماس تلفنی
            </a>
            <Link href={appointmentHref(siteInfo.phone)} className={primaryButton}>
              {hero.primaryCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
