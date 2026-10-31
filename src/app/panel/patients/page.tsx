import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "مراجعان",
};

/**
 * صفحهٔ «مراجعان» — فعلاً خالی.
 *
 * صاحب این صفحه: **خانم مریم (نفر دوم)** ، در کار `p2-05`.
 * منطق و رابط کاربری‌اش در `src/modules/patients` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 * نکتهٔ `M-1` و `M-6`: `mobile` یکتا ولی **اختیاری** است، و `birth_date` و
 * `gender` هم اختیاری‌اند. تطبیق مراجع با **کد ملی** است، نه موبایل (`Q-5`).
 */
export default async function PatientsPage() {
  await requireAuth();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">مراجعان</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p2-05</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
