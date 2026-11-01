import Link from "next/link";
import { navLinks, signatureLine } from "../copy";
import { toPersianDigits } from "../format";
import type { Clinic, SiteInfo, WorkingHours } from "../types";
import { WaveEdge } from "./brand-shapes";
import { ContactDetails } from "./contact-details";

export function SiteFooter({
  siteInfo,
  clinics,
  workingHours,
}: {
  siteInfo: SiteInfo;
  clinics: Clinic[];
  workingHours: WorkingHours[];
}) {
  return (
    <footer className="mt-auto">
      <WaveEdge position="top" className="-mb-px block h-14 w-full md:h-24" />

      <div className="bg-(--site-navy) text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
          {/* برندگاید: عنوان تخصص و شمارهٔ نظام پزشکی همیشه کنار نام (مادهٔ ۲۰) */}
          <div>
            <p className="text-lg font-bold">{siteInfo.doctor_name}</p>
            <p className="text-white/85">{siteInfo.specialty_title}</p>
            <p className="text-sm text-(--site-orange)">{siteInfo.doctor_focus}</p>
            <p className="mt-2 text-sm text-white/70">
              شمارهٔ نظام پزشکی: {toPersianDigits(siteInfo.medical_council_number)}
            </p>
            <p className="mt-5 border-s-2 border-(--site-orange) ps-3 text-sm text-white/85">
              {signatureLine}
            </p>
          </div>

          <nav aria-label="پیوندهای پایین صفحه">
            <p className="mb-3 font-bold">صفحه‌ها</p>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/" className="text-white/85 hover:text-white hover:underline">
                  صفحهٔ اول
                </Link>
              </li>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-white/85 hover:text-white hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="mb-3 font-bold">راه تماس</p>
            <ContactDetails
              siteInfo={siteInfo}
              clinics={clinics}
              workingHours={workingHours}
              tone="dark"
            />
          </div>
        </div>

        {/* فاصلهٔ پایین در موبایل تا دکمه‌های شناور روی این متن نیفتند */}
        <p className="border-t border-white/10 px-4 pt-4 pb-20 text-center text-xs text-white/60 md:pb-4">
          {/* نام پزشک این‌جا تنها می‌آمد (W-08)؛ نام و تخصص و شماره بالاتر در همین پایین صفحه هست */}
          همهٔ حقوق این سایت محفوظ است.
        </p>
      </div>
    </footer>
  );
}
