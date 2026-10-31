import { formatPhone, phoneHref, summarizeWorkingHours } from "../format";
import type { Clinic, SiteInfo, WorkingHours } from "../types";
import { MapPinIcon, PhoneIcon } from "./icons";

/**
 * تلفن، و برای هر مطب روز و ساعت و نشانی — برندگاید: «راه تماس را در همان نگاه اول بگذارید».
 * tone="dark" برای زمینهٔ سرمه‌ای است.
 */
export function ContactDetails({
  siteInfo,
  clinics,
  workingHours,
  tone = "light",
}: {
  siteInfo: SiteInfo;
  clinics: Clinic[];
  workingHours: WorkingHours[];
  tone?: "light" | "dark";
}) {
  const label = tone === "dark" ? "text-white/70" : "text-(--site-muted)";
  const value = tone === "dark" ? "text-white" : "text-(--site-ink)";
  const icon =
    tone === "dark"
      ? "bg-white/10 text-(--site-orange)"
      : "bg-(--site-peach) text-(--site-navy)";

  const rows = [
    {
      key: "phone",
      Icon: PhoneIcon,
      title: "تلفن هماهنگی و نوبت",
      content: (
        <a
          href={phoneHref(siteInfo.phone)}
          dir="ltr"
          className="font-bold underline-offset-4 hover:underline"
        >
          {formatPhone(siteInfo.phone)}
        </a>
      ),
    },
    ...clinics.map((clinic) => ({
      key: clinic.id,
      Icon: MapPinIcon,
      title: clinic.name,
      content: (
        <>
          {summarizeWorkingHours(
            workingHours.filter((row) => row.clinicId === clinic.id),
            clinics,
          ).map((row) => (
            <span key={row.days} className="block font-medium">
              {row.days}، {row.hours}
            </span>
          ))}
          <span className={`block text-sm ${label}`}>{clinic.address}</span>
        </>
      ),
    })),
  ];

  return (
    <ul className="flex flex-col gap-4">
      {rows.map(({ key, Icon, title, content }) => (
        <li key={key} className="flex items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${icon}`}
          >
            <Icon className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className={`text-sm ${label}`}>{title}</span>
            <span className={value}>{content}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
