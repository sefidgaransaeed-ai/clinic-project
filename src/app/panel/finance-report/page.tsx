import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "گزارش مالی",
};

/**
 * صفحهٔ «گزارش مالی» — فعلاً خالی.
 *
 * صاحب این صفحه: **خانم هستی (نفر سوم)** ، در کار `p3-05`.
 * منطق و رابط کاربری‌اش در `src/modules/finance` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 *
 * ⚠️ **فقط پزشک.** منشی با وارد کردن مستقیم این نشانی به صفحهٔ «دسترسی
 * ندارید» می‌رسد — این قفل همین `requireRole` در خط اول است، نه فیلتر منو.
 * نکتهٔ `H-11` و `H-12`: تابع `finance_report(from, to)` شش خروجی دارد و
 * مرز روزها را به وقت `Asia/Tehran` حساب می‌کند. خودتان جمع نزنید.
 */
export default async function FinanceReportPage() {
  await requireRole(["doctor"]);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">گزارش مالی</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p3-05</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
