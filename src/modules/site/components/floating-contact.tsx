import type { SiteInfo } from "../types";
import { InstagramIcon, WhatsAppIcon } from "./icons";

/**
 * دکمه‌های شناور واتس‌اپ و اینستاگرام — فقط لینک‌اند، بدون هیچ سرویس بیرونی.
 * لینکی که در پایگاه داده نیست، دکمه‌اش هم نمی‌آید (W-11).
 */
export function FloatingContact({ siteInfo }: { siteInfo: SiteInfo }) {
  const links = [
    {
      href: siteInfo.whatsapp_url,
      label: "گفت‌وگو در واتس‌اپ",
      icon: WhatsAppIcon,
      className: "bg-(--site-navy) text-white",
    },
    {
      href: siteInfo.instagram_url,
      label: "صفحهٔ اینستاگرام",
      icon: InstagramIcon,
      className: "bg-(--site-blue) text-white",
    },
  ].filter((link): link is typeof link & { href: string } =>
    Boolean(link.href),
  );

  if (links.length === 0) return null;

  return (
    /*
     * جای این دکمه‌ها بالای ویجت چت‌بات است (که در چیدمان سایت، پایین-چپ می‌نشیند).
     * ویجت بسته ارتفاع کمی دارد ولی باز، تا ۳۲۳ پیکسل بالا می‌آید و روی این دکمه‌ها
     * می‌افتد. فاصلهٔ ثابت کافی نیست، چون ارتفاع ویجت با پاسخ‌ها بیشتر هم می‌شود.
     * پس قاعدهٔ `.site-floating-contact` در theme.css وقتی ویجت باز است این‌ها را
     * کنار می‌برد — با `:has()`، بدون اینکه لازم باشد وضعیت را در جاوااسکریپت رد کنیم.
     */
    <div className="site-floating-contact fixed bottom-20 left-4 z-40 flex flex-col gap-3 md:bottom-24 md:left-6">
      {links.map(({ href, label, icon: LinkIcon, className }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`flex size-12 items-center justify-center rounded-full shadow-[0_8px_20px_-8px_rgba(38,34,97,0.6)] ring-2 ring-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-orange) ${className}`}
        >
          <LinkIcon className="size-6" />
        </a>
      ))}
    </div>
  );
}
