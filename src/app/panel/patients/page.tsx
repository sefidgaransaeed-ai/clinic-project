import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed } from "@/modules/appointments/appointments-ui";
import { PatientsListView } from "@/modules/patients/patients-ui";
import { loadPatientsSnapshot } from "@/modules/patients/queries";

export const metadata: Metadata = {
  title: "مراجعان",
};

/**
 * صفحهٔ «مراجعان».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-05`.
 * این فایل بخشی از پوستهٔ پنل است: نگهبان ورود را صدا می‌زند، مراجعان را با نشست کاربر از Supabase
 * می‌خواند (RLS اعمال می‌شود) و به رابط کاربری در `src/modules/patients` می‌دهد
 * (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `M-1` و `M-6`: `mobile` یکتا ولی **اختیاری** است، و `birth_date` و
 * `gender` هم اختیاری‌اند. تطبیق مراجع با **کد ملی** است، نه موبایل (`Q-5`).
 */
export default async function PatientsPage() {
  await requireAuth();

  const result = await loadPatientsSnapshot();
  if (!result.ok) {
    return <PanelLoadFailed title="مراجعان" message={result.message} />;
  }

  return <PatientsListView initialSnapshot={result.snapshot} />;
}
