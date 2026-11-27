import Image from "next/image";

import type { SitePhoto } from "../photos";

/**
 * قاب عکس مطب — یک شکل برای همهٔ جاها، تا عکس‌ها به هم شبیه بمانند.
 *
 * سه قاب دارد:
 *   - frame:  قاب سفید برجسته با سایه، مثل قاب عکس روی دیوار مطب
 *   - plain:  فقط گوشه‌های گرد، بدون قاب
 *   - inset:  پوشش کامل درون یک کارت؛ روی آن لایهٔ سرمه‌ای برای خوانایی متن
 *
 * چرا قاب: عکس‌های گرفته‌شده در نور اتاق‌اند و رنگ‌هایشان گرم و کمی متفاوت است.
 * قاب سفید و حاشیهٔ هم‌اندازه، تفاوت نور و کادر را یکدست می‌کند و به ظاهر برگه‌های
 * برندگاید (سفید، سرمه‌ای، نارنجی) نزدیک می‌ماند. بدون این کارت سفید، عکس‌ها
 * وسط صفحهٔ روشن شناور و بی‌قاعده دیده می‌شوند.
 */
/**
 * کلاس‌های نسبت باید کامل و ثابت باشند؛ Tailwind از رشتهٔ ساخته‌شده در زمان اجرا کلاس نمی‌سازد.
 */
const RATIO_CLASS = {
  "4/3": "aspect-[4/3]",
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
  "16/9": "aspect-[16/9]",
} as const;

export function ClinicPhoto({
  photo,
  variant = "frame",
  ratio = "4/3",
  className = "",
  sizes = "(min-width: 1024px) 45vw, (min-width: 640px) 70vw, 92vw",
  priority = false,
}: {
  photo: SitePhoto;
  variant?: "frame" | "plain" | "inset";
  /** نسبت کادر؛ عکس‌ها عمودی و افقی هر دو هستند، پس قاب نسبت را تعیین می‌کند */
  ratio?: keyof typeof RATIO_CLASS;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src={photo.src}
      alt={photo.alt}
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      // عکس‌های واقعی نور و رنگ گرم دارند؛ کمی اشباع کمتر تا با سرمه‌ای و نارنجی برند نجنگند
      className="h-full w-full object-cover [filter:saturate(0.92)]"
    />
  );

  const crop = `relative ${RATIO_CLASS[ratio]}`;

  if (variant === "inset") {
    return <div className={`${crop} ${className}`}>{image}</div>;
  }

  if (variant === "plain") {
    return (
      <div className={`${crop} overflow-hidden rounded-3xl bg-(--site-grey-soft) ${className}`}>
        {image}
      </div>
    );
  }

  return (
    <div className={`${crop} ${className}`}>
      {/* صفحهٔ نارنجی پشت قاب، کمی چرخیده — همان حرکت کارت «کجا درد دارید؟» */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-[1.75rem] bg-(--site-orange)"
      />
      <div className="relative h-full overflow-hidden rounded-[1.75rem] border-4 border-white bg-(--site-grey-soft) shadow-[0_26px_50px_-26px_rgba(38,34,97,0.55)]">
        {image}
      </div>
    </div>
  );
}
