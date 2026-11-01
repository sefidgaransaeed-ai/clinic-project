import { SignatureWaves, SpineOrnament } from "./brand-shapes";

/**
 * زمینهٔ بخش‌های سرمه‌ای، در سه لایه:
 * هالهٔ نرم نور (آبی، با رگه‌ای از نارنجی)، چند موج نازک امضایی، و یک ستون مهرهٔ بزرگ در کنار.
 * داخل یک بخش با کلاس relative isolate گذاشته شود.
 * ستون فقط در صفحه‌های پهن دیده می‌شود تا پشت متن نیفتد.
 */
export function HeroBackdrop({
  spine = true,
  spineClassName = "top-1/2 left-[2%] h-[88%] -translate-y-1/2",
}: {
  spine?: boolean;
  spineClassName?: string;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(55%_75%_at_12%_35%,rgba(64,64,153,0.85),transparent_70%),radial-gradient(35%_55%_at_0%_100%,rgba(248,148,29,0.16),transparent_70%)]" />
      {/* موج‌ها زیر متن (سمت راست) محو می‌شوند تا خوانایی تیتر به هم نخورد؛ در موبایل ارتفاع ثابت دارند تا کش نیایند */}
      <SignatureWaves className="absolute inset-x-0 bottom-0 h-56 w-full [mask-image:linear-gradient(to_right,#000_30%,transparent_80%)] md:h-[70%]" />
      {spine && (
        <SpineOrnament className={`absolute hidden w-auto lg:block ${spineClassName}`} />
      )}
    </div>
  );
}
