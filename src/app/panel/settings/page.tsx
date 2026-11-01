import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "تنظیمات",
};

/**
 * صفحهٔ «تنظیمات» — فعلاً خالی.
 *
 * صاحب این صفحه: **خانم مریم و خانم هستی** ، در کار `p2-09 و p3-13`.
 * منطق و رابط کاربری‌اش در `src/modules/schedule-settings و src/modules/site` نوشته می‌شود و این فایل فقط آن را
 * صدا می‌زند (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 *
 * این فایل بخشی از پوستهٔ پنل است و صاحبش نفر اول است، ولی **محتوایش**
 * مال صاحب بالاست. برای پر کردنش همین فایل را عوض کنید؛ منوی پنل در
 * `src/lib/panel-routes.ts` است و آن را دست نزنید.
 *
 * ⚠️ **فقط پزشک.** منشی با وارد کردن مستقیم این نشانی به صفحهٔ «دسترسی
 * ندارید» می‌رسد — این قفل همین `requireRole` در خط اول است، نه فیلتر منو.
 * نکتهٔ `A-2`: قواعد ساعت کاری و تعطیلی عمداً در پایگاه داده اجبار
 * نمی‌شوند و در کد می‌مانند. و `site_info` یازده کلید دارد (`H-6`) — «کلید
 * خالی» یعنی ردیفش وجود ندارد، نه رشتهٔ خالی.
 */
export default async function SettingsPage() {
  await requireRole(["doctor"]);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">تنظیمات</h2>
      <p className="text-sm opacity-70">
        این صفحه هنوز ساخته نشده است. محتوایش در کار <code>p2-09 و p3-13</code> اضافه
        می‌شود.
      </p>
    </section>
  );
}
