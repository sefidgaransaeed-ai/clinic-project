import type { Metadata } from "next";
import "@/modules/site/theme.css";
import { requireRole } from "@/lib/auth";
import logo from "@/modules/site/assets/logo.png";
import { SiteSettings } from "@/modules/site/components/site-settings";
import { draftFrom } from "@/modules/site/settings-rules";
import { getSiteSettings } from "@/modules/site/settings-data";

export const metadata: Metadata = {
  title: "تنظیمات سایت",
};

/**
 * تنظیمات سایت عمومی — فقط پزشک (کار p3-13). رابط و منطق در src/modules/site است.
 *
 * پنهان‌کردن پیوند کافی نیست (CLAUDE.md ۷.۵). قفل سه لایه دارد: proxy منشی را پیش از رندر از
 * همهٔ /panel/settings برمی‌گرداند، requireRole همین‌جا و در action ذخیره، و در پایگاه داده فقط
 * پزشک faq_items و site_info و clinics را تغییر می‌دهد.
 */
export default async function SiteSettingsPage() {
  await requireRole(["doctor"]);
  const settings = await getSiteSettings();

  return (
    <SiteSettings
      initial={draftFrom(settings.siteInfo, settings.clinics, settings.faqItems)}
      hours={settings.hours}
      defaultLogo={logo.src}
    />
  );
}
