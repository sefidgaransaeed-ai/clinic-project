import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { RequestsAppointmentsView } from "@/modules/appointments/appointments-ui";

export const metadata: Metadata = {
  title: "درخواست‌های نوبت",
};

/**
 * صفحهٔ «درخواست‌های نوبت».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است و فقط دو کار می‌کند: نگهبان ورود را صدا
 * می‌زند و عنوان فارسی صفحه را می‌گذارد. رابط کاربری در
 * `src/modules/appointments` است (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `M-3`: وقتی درخواست را `confirmed` می‌کنید، پایگاه داده **خودش**
 * رکورد مراجع را می‌سازد یا پیدا می‌کند. در کد انجامش ندهید.
 */
export default async function RequestsPage() {
  await requireAuth();

  return <RequestsAppointmentsView />;
}
