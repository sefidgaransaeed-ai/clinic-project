/**
 * ظاهر دکمه‌های سایت عمومی، تا همه‌جا یکسان باشند.
 * دکمهٔ نوبت نارنجی با متن سرمه‌ای است — متن سفید روی نارنجی ممنوع (برندگاید، قواعد رنگ).
 */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

export const primaryButton = `${base} bg-(--site-orange) text-(--site-navy) hover:bg-(--site-peach) focus-visible:outline-(--site-navy)`;

/** روی زمینهٔ سرمه‌ای */
export const ghostButtonOnDark = `${base} border border-white/35 text-white hover:bg-white/10 focus-visible:outline-white`;

/** روی زمینهٔ روشن */
export const outlineButton = `${base} border border-(--site-navy)/25 text-(--site-navy) hover:bg-(--site-grey-soft) focus-visible:outline-(--site-blue)`;
