import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { primaryButton } from "@/modules/site/components/button-styles";
import { ClinicPhoto } from "@/modules/site/components/clinic-photo";
import {
  ClockIcon,
  InstagramIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/modules/site/components/icons";
import { PageIntro } from "@/modules/site/components/page-intro";
import { appointmentHref, hero } from "@/modules/site/copy";
import { getClinics, getSiteInfo, getWorkingHours } from "@/modules/site/data";
import {
  formatPhone,
  phoneHref,
  summarizeWorkingHours,
  weeklySchedule,
} from "@/modules/site/format";
import { sitePhotos } from "@/modules/site/photos";

export const metadata: Metadata = {
  title: "تماس",
};

export default async function ContactPage() {
  const [siteInfo, clinics, workingHours] = await Promise.all([
    getSiteInfo(),
    getClinics(),
    getWorkingHours(),
  ]);
  const schedule = weeklySchedule(workingHours, clinics);
  const bookingHref = appointmentHref(siteInfo.phone);
  // هر تکه‌ای که در پایگاه داده نیست، بی‌خطا کنار می‌رود (W-11)
  const { phone, whatsapp_url: whatsapp, instagram_url: instagram } = siteInfo;

  return (
    <>
      <PageIntro
        eyebrow="تماس"
        title="راه‌های تماس با مطب"
        description="پیش از گرفتن نوبت، روند درمان و هزینه‌ها را تلفنی برایتان توضیح می‌دهیم."
      />

      <section className="mx-auto max-w-4xl px-4 pt-10 md:pt-12">
        <div className="grid items-center gap-6 rounded-3xl bg-(--site-grey-soft) p-6 md:grid-cols-[auto_1fr] md:gap-10 md:p-8">
          <ClinicPhoto
            photo={sitePhotos.reception}
            ratio="3/4"
            sizes="(min-width: 768px) 22vw, 60vw"
            className="mx-auto w-full max-w-[13rem]"
          />
          <div>
            <h2 className="text-2xl font-bold text-(--site-navy) md:text-3xl">
              مطب را از نزدیک ببینید
            </h2>
            <p className="mt-3 text-lg text-(--site-muted)">
              پیش از آمدن، فضای پذیرش مطب را ببینید تا بدانید کجا مراجعه کنید.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2 md:py-20">
        <div className="flex flex-col gap-4">
          {phone && (
            <ContactCard icon={<PhoneIcon className="size-5" />} title="تلفن هماهنگی و نوبت">
              <a
                href={phoneHref(phone)}
                dir="ltr"
                className="text-xl font-bold text-(--site-navy) hover:underline"
              >
                {formatPhone(phone)}
              </a>
              <p className="mt-1 text-sm text-(--site-muted)">
                پاسخ‌گو: دستیار پزشک، برای هر دو مطب
              </p>
            </ContactCard>
          )}

          {clinics.map((clinic) => (
            <ContactCard
              key={clinic.id}
              icon={<MapPinIcon className="size-5" />}
              title={clinic.name}
            >
              {summarizeWorkingHours(
                workingHours.filter((row) => row.clinicId === clinic.id),
                clinics,
              ).map((row) => (
                <p key={row.days} className="font-bold text-(--site-navy)">
                  {row.days}، {row.hours}
                </p>
              ))}
              <p className="mt-2 font-medium text-(--site-ink)">{clinic.address}</p>
              {clinic.directions && (
                <p className="mt-1 text-(--site-muted)">{clinic.directions}</p>
              )}
            </ContactCard>
          ))}

          {(whatsapp || instagram) && (
            <ContactCard icon={<WhatsAppIcon className="size-5" />} title="پیام‌رسان‌ها">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium text-(--site-blue) hover:underline"
                  >
                    <WhatsAppIcon className="size-5" />
                    گفت‌وگو در واتس‌اپ
                  </a>
                )}
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium text-(--site-blue) hover:underline"
                  >
                    <InstagramIcon className="size-5" />
                    ویدئوهای آموزشی در اینستاگرام
                  </a>
                )}
              </div>
            </ContactCard>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ContactCard icon={<ClockIcon className="size-5" />} title="ساعت کاری">
            <table className="w-full text-start">
              <caption className="sr-only">ساعت کاری دو مطب در روزهای هفته</caption>
              <tbody>
                {schedule.map((row) => (
                  <tr
                    key={row.day}
                    className="border-b border-(--site-grey) last:border-b-0"
                  >
                    <th scope="row" className="py-2 text-start font-medium">
                      {row.day}
                    </th>
                    <td
                      className={`py-2 text-end ${
                        row.hours ? "font-bold text-(--site-navy)" : "text-(--site-muted)"
                      }`}
                    >
                      {row.hours ?? "تعطیل"}
                      {row.clinic && (
                        <span className="block text-xs font-medium text-(--site-blue)">
                          {row.clinic}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ContactCard>

          {bookingHref && (
            <div className="rounded-2xl bg-(--site-navy) p-6 text-white">
              <p className="text-lg font-bold">نوبت بگیرید</p>
              <p className="mt-1 text-white/85">
                برای گرفتن نوبت با تلفن مطب تماس بگیرید.
              </p>
              <Link href={bookingHref} className={`${primaryButton} mt-5`}>
                {hero.primaryCta}
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ContactCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-s-4 border-(--site-orange) bg-(--site-grey-soft) p-6">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-(--site-blue)">
        <span className="flex size-8 items-center justify-center rounded-lg bg-(--site-peach) text-(--site-navy)">
          {icon}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}
