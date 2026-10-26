import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "درخواست‌های نوبت",
};

/**
 * صفحهٔ «درخواست‌های نوبت» — فعلاً خالی.
 *
 * صاحب این صفحه: **خانم مریم (نفر دوم)** ، در کار `p2-04`.
 * منطق و رابط کاربری‌اش در `src/modules/appointments` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 * نکتهٔ `M-3`: وقتی درخواست را `confirmed` می‌کنید، پایگاه داده **خودش**
 * رکورد مراجع را می‌سازد یا پیدا می‌کند. در کد انجامش ندهید.
 */
export default async function RequestsPage() {
  await requireAuth();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">درخواست‌های نوبت</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p2-04</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
