import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { TodayAppointmentsView } from "@/modules/appointments/appointments-ui";

export const metadata: Metadata = {
  title: "نوبت‌های امروز",
};

/**
 * صفحهٔ «نوبت‌های امروز».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است و فقط دو کار می‌کند: نگهبان ورود را صدا
 * می‌زند و عنوان فارسی صفحه را می‌گذارد. رابط کاربری در
 * `src/modules/appointments` است (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `A-3`: هفت روز پس از `ends_at` هیچ تغییر وضعیتی ممکن نیست — نه
 * `done` ، نه `no_show` ، نه `cancelled`. پیام خطایش فارسی و آماده است.
 */
export default async function TodayPage() {
  await requireAuth();

  return <TodayAppointmentsView />;
}
