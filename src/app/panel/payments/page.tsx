import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "پرداخت‌ها",
};

/**
 * صفحهٔ «پرداخت‌ها» — فعلاً خالی.
 *
 * صاحب این صفحه: **خانم هستی (نفر سوم)** ، در کار `p3-04`.
 * منطق و رابط کاربری‌اش در `src/modules/finance` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 * نکتهٔ `H-4` و سند `0010`: منشی **فقط پرداخت‌های امروز** را می‌بیند و این
 * در RLS اجبار می‌شود، نه در کد. فیلتر بازهٔ تاریخ برای نقش منشی گذاشته
 * نشود. و ویرایش پرداخت در پایگاه داده مسدود است — اصلاح فقط با ردیف معکوس.
 */
export default async function PaymentsPage() {
  await requireAuth();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">پرداخت‌ها</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p3-04</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
