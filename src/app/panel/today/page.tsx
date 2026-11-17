import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed, TodayAppointmentsView } from "@/modules/appointments/appointments-ui";
import { loadPanelSnapshot } from "@/modules/appointments/queries";

export const metadata: Metadata = {
  title: "نوبت‌های امروز",
};

/**
 * صفحهٔ «نوبت‌های امروز».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-04`.
 * این فایل بخشی از پوستهٔ پنل است: نگهبان ورود را صدا می‌زند، ردیف‌ها را با نشست کاربر از Supabase
 * می‌خواند (RLS اعمال می‌شود) و به رابط کاربری در `src/modules/appointments` می‌دهد (بخش ۴ CLAUDE.md).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `A-3`: هفت روز پس از `ends_at` هیچ تغییر وضعیتی ممکن نیست — نه
 * `done` ، نه `no_show` ، نه `cancelled`. پیام خطایش فارسی و آماده است.
 */
export default async function TodayPage() {
  await requireAuth();

  const result = await loadPanelSnapshot();
  if (!result.ok) {
    return <PanelLoadFailed title="نوبت‌های امروز" message={result.message} />;
  }

  return <TodayAppointmentsView initialSnapshot={result.snapshot} />;
}
