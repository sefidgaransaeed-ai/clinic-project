"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { hero, painAreas } from "../copy";
import { primaryButton } from "./button-styles";
import { ArrowIcon } from "./icons";

/**
 * «کجا درد دارید؟» — بازدیدکننده جای درد را انتخاب می‌کند و جملهٔ آشنای بیماران
 * و خدمت مرتبط را می‌بیند. تشخیص نیست؛ همان جدول تأییدشدهٔ برندگاید است (پرسش ۲۲).
 */
export function PainFinder({ bookingHref }: { bookingHref: string }) {
  const [selected, setSelected] = useState(0);
  // پاسخ فقط وقتی با حرکت ظاهر می‌شود که کاربر خودش انتخاب کرده باشد، نه هنگام باز شدن صفحه
  const [changed, setChanged] = useState(false);
  const titleId = useId();
  const area = painAreas[selected];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* صفحهٔ نارنجی پشت کارت، کمی چرخیده */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-[1.75rem] bg-(--site-orange)"
      />

      <div className="relative rounded-[1.75rem] bg-white p-5 text-(--site-ink) shadow-[0_30px_60px_-30px_rgba(0,0,0,0.55)] sm:p-7">
        <p id={titleId} className="text-xl font-black text-(--site-navy)">
          کجا درد دارید؟
        </p>
        <p className="mt-1 text-sm text-(--site-muted)">
          یکی را انتخاب کنید تا ببینید درمان از کجا شروع می‌شود.
        </p>

        <div role="group" aria-labelledby={titleId} className="mt-5 grid grid-cols-2 gap-2">
          {painAreas.map((option, index) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={index === selected}
              onClick={() => {
                setSelected(index);
                setChanged(true);
              }}
              className={`min-h-12 cursor-pointer rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue) ${
                index === selected
                  ? "border-(--site-navy) bg-(--site-navy) text-white"
                  : "border-(--site-grey) bg-white text-(--site-navy) hover:border-(--site-navy)/40"
              }`}
            >
              {option.area}
            </button>
          ))}
        </div>

        <div
          key={area.id}
          aria-live="polite"
          className={`mt-5 rounded-2xl bg-(--site-grey-soft) p-4 ${
            changed ? "motion-safe:animate-[site-fade-up_0.35s_ease-out]" : ""
          }`}
        >
          <p className="text-xs text-(--site-muted)">بیماران معمولاً می‌گویند</p>
          <p className="mt-1.5 w-fit rounded-2xl rounded-ss-sm bg-(--site-peach) px-4 py-2.5 font-bold text-(--site-navy)">
            «{area.says}»
          </p>
          <p className="mt-4 text-xs text-(--site-muted)">خدمت مرتبط</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {area.services.map((service) => (
              <li
                key={service}
                className="rounded-full bg-(--site-navy) px-3 py-1 text-sm text-white"
              >
                {service}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-xs text-(--site-muted)">
          تشخیص دقیق فقط بعد از معاینه است.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link href={bookingHref} className={primaryButton}>
            {hero.primaryCta}
            <ArrowIcon className="size-5" />
          </Link>
          <Link
            href={area.groupId ? `/services#${area.groupId}` : "/services"}
            className="text-sm font-bold text-(--site-blue) hover:underline"
          >
            دربارهٔ این درمان‌ها
          </Link>
        </div>
      </div>
    </div>
  );
}
