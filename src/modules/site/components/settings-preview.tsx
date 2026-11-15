"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { appointmentHref, doctorIdentity, hero } from "../copy";
import { formatPhone } from "../format";
import { cleanDraft, type SettingsDraft } from "../settings-rules";

/** تکه‌هایی از سایت که با رفتن روی یک خانه نارنجی می‌شوند */
export type PreviewTarget = "identity" | "phone" | "whatsapp" | "instagram" | "logo" | "clinics" | "about" | "faq";

const glow = (on: boolean) =>
  on ? "rounded-xl outline-3 outline-offset-2 outline-(--site-orange) transition-[outline-color]" : "";

/**
 * گوشی کنار صفحهٔ تنظیمات: سایت را پیش از ذخیره، با همان قاعده‌های خود سایت نشان می‌دهد —
 * نام فقط با تخصص و شماره (W-08)، دکمهٔ نوبت فقط با تلفن (W-09)، و هر خانهٔ خالی پنهان (W-11).
 * فقط برای چشم است؛ صفحه‌خوان همان خانه‌های فرم را می‌خواند.
 */
export function SettingsPreview({
  draft,
  target,
  defaultLogo,
}: {
  draft: SettingsDraft;
  target: PreviewTarget | null;
  defaultLogo: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const clean = cleanDraft(draft);
  const info = clean.siteInfo;
  const doctor = doctorIdentity(info);
  const bookingHref = appointmentHref(info.phone || undefined);
  const activeFaq = clean.faqItems.filter((item) => item.isActive && item.question);
  const logo = info.logo_url || defaultLogo;

  // گوشی خودش تا تکه‌ای که دارد عوض می‌شود پایین می‌رود
  useEffect(() => {
    const box = scrollRef.current;
    const element = target ? box?.querySelector<HTMLElement>(`[data-preview="${target}"]`) : null;
    if (!box || !element) return;
    const top = element.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 70;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [target]);

  return (
    <div aria-hidden="true" className="select-none">
      <div className="mx-auto h-[40rem] w-[19.5rem] rounded-[2.9rem] bg-[#15132f] p-3 shadow-[0_40px_60px_-30px_rgba(20,18,60,0.8),inset_0_0_0_2px_#3b3870]">
        <div className="relative h-full overflow-hidden rounded-[2.25rem] bg-white">
          <span className="absolute top-2 left-1/2 z-10 h-5.5 w-22 -translate-x-1/2 rounded-2xl bg-[#15132f]" />
          <div ref={scrollRef} className="h-full overflow-y-auto [scrollbar-width:none]">
            {/* سرصفحه */}
            <div className="flex items-center gap-2.5 bg-(--site-navy) px-3.5 pt-10 pb-2.5 text-white">
              <span data-preview="logo" className={glow(target === "logo")}>
                <Image
                  src={logo}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 rounded-[0.6rem] bg-white object-contain p-0.5"
                />
              </span>
              {doctor && <span className="truncate text-xs leading-tight font-black">{doctor.name}</span>}
              {bookingHref && (
                <span className="ms-auto shrink-0 rounded-lg bg-(--site-orange) px-2.5 text-[0.6875rem] font-black text-(--site-navy)">
                  {hero.primaryCta}
                </span>
              )}
            </div>

            {/* بالای صفحهٔ اول */}
            <div className="bg-(--site-navy) px-3.5 pt-1.5 pb-4.5 text-white">
              <div data-preview="identity" className={`inline-block ${glow(target === "identity")}`}>
                {doctor ? (
                  <span className="inline-block rounded-[0.6rem] border border-white/20 bg-white/5 px-2 py-1 text-[0.65rem] leading-relaxed">
                    {doctor.name}، {doctor.title}، نظام پزشکی {doctor.council}
                  </span>
                ) : (
                  <span className="inline-block rounded-[0.6rem] border border-dashed border-white/30 px-2 py-1 text-[0.65rem] text-white/60">
                    نام دکتر این‌جا دیده نمی‌شود
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-xl leading-snug font-black">{hero.title}</p>
              {info.phone && (
                <p
                  data-preview="phone"
                  dir="ltr"
                  className={`mt-2 text-end text-xs font-extrabold ${glow(target === "phone")}`}
                >
                  ☎ {formatPhone(info.phone)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3.5 p-3.5">
              <section data-preview="faq" className={glow(target === "faq")}>
                <p className="mb-2 text-[0.8rem] font-black text-(--site-navy)">پرسش‌های پرتکرار</p>
                {activeFaq.length === 0 && (
                  <p className="text-[0.7rem] text-(--site-muted)">هیچ پرسش روشنی نیست.</p>
                )}
                {activeFaq.map((item) => (
                  <p
                    key={item.key}
                    className="mb-1.5 flex justify-between gap-1.5 rounded-xl border border-(--site-grey) px-2.5 py-1.5 text-[0.7rem] font-extrabold text-(--site-navy)"
                  >
                    {item.question}
                    <span className="text-(--site-blue)">⌄</span>
                  </p>
                ))}
              </section>

              <section data-preview="clinics" className={glow(target === "clinics")}>
                <p className="mb-2 text-[0.8rem] font-black text-(--site-navy)">مطب‌ها</p>
                {clean.clinics
                  .filter((clinic) => clinic.name && clinic.address)
                  .map((clinic) => (
                    <p
                      key={clinic.id}
                      className="mb-2 border-s-[3px] border-(--site-orange) ps-2 text-[0.68rem] text-(--site-muted)"
                    >
                      <b className="block text-xs text-(--site-navy)">{clinic.name}</b>
                      {clinic.address}
                      {clinic.directions && <span className="block">{clinic.directions}</span>}
                    </p>
                  ))}
              </section>

              <section data-preview="about" className={`pb-24 ${glow(target === "about")}`}>
                <p className="mb-2 text-[0.8rem] font-black text-(--site-navy)">دربارهٔ دکتر</p>
                <p className="text-[0.7rem] whitespace-pre-line text-(--site-ink)">
                  {info.about_text || "تا متن معرفی خالی است، متن تأییدشدهٔ برندگاید این‌جا می‌آید."}
                </p>
              </section>
            </div>
          </div>

          {/* دکمه‌های شناور سایت */}
          <div className="absolute bottom-3.5 left-3 z-10 flex flex-col gap-2.5">
            {info.whatsapp_url && (
              <span
                data-preview="whatsapp"
                className={`block size-8.5 rounded-full bg-(--site-navy) ring-2 ring-white ${glow(target === "whatsapp")}`}
              />
            )}
            {info.instagram_url && (
              <span
                data-preview="instagram"
                className={`block size-8.5 rounded-full bg-(--site-blue) ring-2 ring-white ${glow(target === "instagram")}`}
              />
            )}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-center text-sm text-(--site-muted)">سایت در گوشی، پیش از ذخیره</p>
    </div>
  );
}
