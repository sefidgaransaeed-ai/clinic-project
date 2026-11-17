import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed, WeeklyAppointmentsView } from "@/modules/appointments/appointments-ui";
import { loadPanelSnapshot } from "@/modules/appointments/queries";

export const metadata: Metadata = {
  title: "تقویم نوبت‌ها",
};

/**
 * صفحهٔ «تقویم نوبت‌ها».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است: نگهبان ورود را صدا می‌زند، ردیف‌ها را با نشست کاربر از Supabase
 * می‌خواند (RLS اعمال می‌شود) و به رابط کاربری در `src/modules/appointments` می‌دهد (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `A-1`: هنگام رد یا لغو، ستون `cancel_reason` باید پر شود:
 * `rejected` یا `cancelled` یا `expired`.
 */
export default async function AppointmentsPage() {
  await requireAuth();

  const result = await loadPanelSnapshot();
  if (!result.ok) {
    return <PanelLoadFailed title="تقویم نوبت‌ها" message={result.message} />;
  }

  return <WeeklyAppointmentsView initialSnapshot={result.snapshot} />;
}
