/** کلاس‌های مشترک فرم‌ها و دکمه‌های صفحه‌های مالی */

export const card = "rounded-2xl border border-(--fin-grey) bg-white p-5 md:p-6";

export const label = "mb-1.5 block text-sm font-bold text-(--fin-navy)";

export const field =
  "h-11 w-full rounded-xl border border-(--fin-grey) bg-white px-3 text-base text-(--fin-ink) outline-none transition-colors placeholder:text-(--fin-muted)/70 focus:border-(--fin-blue) focus:ring-2 focus:ring-(--fin-blue)/20 aria-invalid:border-(--fin-red)";

export const fieldError = "mt-1.5 text-sm text-(--fin-red)";

export const fieldHint = "mt-1.5 text-sm text-(--fin-muted)";

const button =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-blue) disabled:cursor-not-allowed disabled:opacity-50";

// روی نارنجی فقط متن سرمه‌ای (برندگاید)
export const primaryButton = `${button} bg-(--fin-orange) text-(--fin-navy) hover:bg-(--fin-peach)`;

export const secondaryButton = `${button} border border-(--fin-grey) bg-white text-(--fin-navy) hover:border-(--fin-navy)/40`;

export const dangerButton = `${button} bg-(--fin-red) text-white hover:bg-(--fin-red)/90`;

/** دکمهٔ گرد انتخابی؛ حالت انتخاب‌شده را از aria-pressed می‌گیرد */
export const pillButton =
  "h-9 cursor-pointer rounded-full border border-(--fin-grey) px-3.5 text-sm font-bold text-(--fin-navy) transition-colors hover:border-(--fin-navy)/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-blue) aria-pressed:border-(--fin-navy) aria-pressed:bg-(--fin-navy) aria-pressed:text-white";

export const smallButton =
  "inline-flex h-9 cursor-pointer items-center rounded-lg border border-(--fin-grey) bg-white px-3 text-sm font-bold text-(--fin-navy) transition-colors hover:border-(--fin-navy)/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-blue) disabled:cursor-not-allowed disabled:opacity-45";
