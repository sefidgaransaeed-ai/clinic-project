import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { WeeklyAppointmentsView } from "@/modules/appointments/appointments-ui";

export const metadata: Metadata = {
  title: "تقویم نوبت‌ها",
};

/**
 * صفحهٔ «تقویم نوبت‌ها».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است و فقط دو کار می‌کند: نگهبان ورود را صدا
 * می‌زند و عنوان فارسی صفحه را می‌گذارد. رابط کاربری در
 * `src/modules/appointments` است (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `A-1`: هنگام رد یا لغو، ستون `cancel_reason` باید پر شود:
 * `rejected` یا `cancelled` یا `expired`.
 */
export default async function AppointmentsPage() {
  await requireAuth();

  return <WeeklyAppointmentsView />;
}
