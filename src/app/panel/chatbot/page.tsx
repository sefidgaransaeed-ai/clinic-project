import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "پرسش‌های بی‌پاسخ",
};

/**
 * صفحهٔ «پرسش‌های بی‌پاسخ» — فعلاً خالی.
 *
 * صاحب این صفحه: **سعید (نفر اول)** ، در کار `p1-15`.
 * منطق و رابط کاربری‌اش در `src/modules/chatbot` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 * نکتهٔ `H-7`: ستون «رسیدگی شد» عمداً اضافه نشد، پس این فهرست انبار
 * می‌شود و خالی نمی‌شود. **این صفحه باید صفحه‌بندی داشته باشد.**
 */
export default async function ChatbotPage() {
  await requireAuth();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">پرسش‌های بی‌پاسخ</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p1-15</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
