import type { SiteInfo } from "../types";
import { InstagramIcon, WhatsAppIcon } from "./icons";

/** دکمه‌های شناور واتس‌اپ و اینستاگرام — فقط لینک‌اند، بدون هیچ سرویس بیرونی. */
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
  ];

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-3 md:bottom-6 md:left-6">
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
