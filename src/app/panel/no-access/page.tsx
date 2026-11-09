import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "دسترسی ندارید",
};

/**
 * صفحهٔ «دسترسی ندارید».
 *
 * `requireRole` کاربر را به این‌جا می‌فرستد. عمداً نمی‌گوییم آن صفحه چه
 * چیزی نشان می‌داد یا مال چه نقشی است — همان‌قدر که لازم است می‌گوییم.
 *
 * صاحب این فایل: نفر اول.
 */
export default function NoAccessPage() {
  return (
    <section className="max-w-md space-y-4">
      <h2 className="text-base font-bold">به این صفحه دسترسی ندارید</h2>
      <p className="text-sm leading-7 opacity-80">
        این بخش برای نقش کاربری شما باز نیست. اگر فکر می‌کنید اشتباهی رخ داده،
        با پزشک مطب تماس بگیرید.
      </p>
      <Link
        href="/panel"
        className="inline-block rounded-lg border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        بازگشت به صفحهٔ اصلی پنل
      </Link>
    </section>
  );
}
