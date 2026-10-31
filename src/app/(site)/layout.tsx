import type { Metadata } from "next";
import "@/modules/site/theme.css";
import { FloatingContact } from "@/modules/site/components/floating-contact";
import { SiteFooter } from "@/modules/site/components/site-footer";
import { SiteHeader } from "@/modules/site/components/site-header";
import { getClinics, getSiteInfo, getWorkingHours } from "@/modules/site/data";

export const metadata: Metadata = {
  title: {
    default: "مطب طب فیزیکی و توان‌بخشی",
    template: "%s | مطب طب فیزیکی و توان‌بخشی",
  },
  description:
    "درمان غیرجراحی دیسک کمر و گردن، آرتروز و دردهای مفصلی",
};

/**
 * پوستهٔ سایت عمومی: سرصفحه، پایین صفحه و دکمه‌های شناور.
 * صاحب این فایل: نفر سوم. مسیر /nobat مال نفر دوم است و در این گروه نیست.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [siteInfo, clinics, workingHours] = await Promise.all([
    getSiteInfo(),
    getClinics(),
    getWorkingHours(),
  ]);

  return (
    <div className="site-theme flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-(--site-navy) px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:right-3"
      >
        رفتن به محتوای اصلی
      </a>
      <SiteHeader siteInfo={siteInfo} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter siteInfo={siteInfo} clinics={clinics} workingHours={workingHours} />
      <FloatingContact siteInfo={siteInfo} />
    </div>
  );
}
