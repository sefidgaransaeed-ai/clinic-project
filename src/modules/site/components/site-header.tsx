import Link from "next/link";
import { appointmentHref, hero } from "../copy";
import { formatPhone, phoneHref, toPersianDigits } from "../format";
import type { SiteInfo } from "../types";
import { PhoneIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { ScrollHeader } from "./scroll-header";
import { SiteLogo } from "./site-logo";

/**
 * سرصفحهٔ سرمه‌ای، یکپارچه با بالای هر صفحه.
 * برندگاید: عنوان تخصص و شمارهٔ نظام پزشکی کنار نام (مادهٔ ۲۰، W-08) و تلفن در همان نگاه اول.
 *
 * در گوشی جا برای هر سه نیست و نام بریده می‌شد، پس آنجا فقط لوگو می‌آید؛ نام تنها هرگز
 * نشان داده نمی‌شود. هر سه درست زیر سرصفحه، بالای صفحهٔ اول آمده‌اند. صفحه‌خوان هر سه را
 * از برچسب پیوند می‌خواند.
 */
export function SiteHeader({ siteInfo }: { siteInfo: SiteInfo }) {
  return (
    <ScrollHeader>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 transition-[height] duration-300 md:h-[4.75rem] md:group-data-scrolled/header:h-16">
        <Link
          href="/"
          aria-label={`${siteInfo.doctor_name}، ${siteInfo.specialty_title}، نظام پزشکی ${toPersianDigits(siteInfo.medical_council_number)}`}
          className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-white"
        >
          <SiteLogo url={siteInfo.logo_url} tone="dark" className="size-10 md:size-11" />
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-base font-black md:text-lg">
              {siteInfo.doctor_name}
            </span>
            <span className="truncate text-xs text-white/65">
              {siteInfo.specialty_title} · نظام پزشکی{" "}
              {toPersianDigits(siteInfo.medical_council_number)}
            </span>
          </span>
        </Link>

        <nav aria-label="منوی اصلی" className="ms-auto hidden md:block">
          <NavLinks />
        </nav>

        <div className="ms-auto flex items-center gap-2 md:ms-3 lg:gap-4">
          <a
            href={phoneHref(siteInfo.phone)}
            className="hidden items-center gap-2 text-sm font-bold text-white/85 transition-colors hover:text-white lg:flex"
          >
            <PhoneIcon className="size-4 text-(--site-orange)" />
            <span dir="ltr">{formatPhone(siteInfo.phone)}</span>
          </a>
          <Link
            href={appointmentHref(siteInfo.phone)}
            className="flex h-11 items-center rounded-xl bg-(--site-orange) px-4 whitespace-nowraptext-sm font-bold text-(--site-navy) transition-colors hover:bg-(--site-peach) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:px-5"
          >
            {hero.primaryCta}
          </Link>
          <MobileMenu />
        </div>
      </div>
    </ScrollHeader>
  );
}
