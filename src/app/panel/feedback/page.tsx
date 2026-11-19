import type { Metadata } from "next";
import { connection } from "next/server";
import "@/modules/site/theme.css";

import { requireRole } from "@/lib/auth";
import { DashboardScreen } from "@/modules/feedback/components/dashboard-screen";
import { getDashboardSource } from "@/modules/feedback/dashboard-data";
import { rangeFor } from "@/modules/feedback/dashboard-rules";

export const metadata: Metadata = {
  title: "بازخوردها",
};

/**
 * داشبورد بازخورد — کار p3-10.
 *
 * صاحب این صفحه محتوایی: **خانم هستی (نفر سوم)**. این فایل بخشی از پوستهٔ پنل است و
 * صاحبش نفر اول، ولی محتوایش مال بالاست؛ منوی پنل در `src/lib/panel-routes.ts` است و
 * دست نمی‌خورد.
 *
 * ⚠️ **فقط پزشک.** منشی با وارد کردن مستقیم این نشانی به صفحهٔ «دسترسی ندارید»
 * می‌رسد — قفل همین `requireRole` در خط اول است، نه فیلتر منو.
 *
 * چرا `connection()`: «امروز» باید لحظهٔ درخواست باشد، نه لحظهٔ ساخت. وگرنه صفحه به‌صورت
 * ثابت ساخته می‌شود و بازهٔ «این ماه» برای همیشه روی روز اول قفل می‌ماند.
 *
 * داده در سرور خوانده می‌شود، ولی محاسبه‌ها در مرورگر با `dashboard-rules.ts` انجام
 * می‌شوند تا عوض‌کردن بازه بی‌درنگ باشد. سه ماه حداکثر چند صد ردیف است، پس همه را یک‌جا
 * می‌فرستیم و با `rangeFor` روی مرورگر فیلتر می‌کنیم.
 */
export default async function FeedbackPage() {
  await requireRole(["doctor"]);
  await connection();

  const now = new Date();
  // گشادترین بازه‌ای که انتخاب‌ها لازم دارند: «سه ماه اخیر»
  const widest = rangeFor("last3Months", now);
  const source = await getDashboardSource(widest.from, widest.to);

  return (
    <section className="space-y-3">
      <h1 className="text-base font-bold">بازخوردها</h1>
      <DashboardScreen
        answers={source.answers}
        linkCreatedAt={source.linkCreatedAt}
        nowIso={now.toISOString()}
      />
    </section>
  );
}
