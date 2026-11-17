import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed, RequestsAppointmentsView } from "@/modules/appointments/appointments-ui";
import { loadPanelSnapshot } from "@/modules/appointments/queries";

export const metadata: Metadata = {
  title: "درخواست‌های نوبت",
};

/**
 * صفحهٔ «درخواست‌های نوبت».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است: نگهبان ورود را صدا می‌زند، ردیف‌ها را با نشست کاربر از Supabase
 * می‌خواند (RLS اعمال می‌شود) و به رابط کاربری در `src/modules/appointments` می‌دهد (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `M-3`: وقتی درخواست را `confirmed` می‌کنید، پایگاه داده **خودش**
 * رکورد مراجع را می‌سازد یا پیدا می‌کند. در کد انجامش ندهید.
 */
export default async function RequestsPage() {
  await requireAuth();

  const result = await loadPanelSnapshot();
  if (!result.ok) {
    return <PanelLoadFailed title="درخواست‌های نوبت" message={result.message} />;
  }

  return <RequestsAppointmentsView initialSnapshot={result.snapshot} />;
}
