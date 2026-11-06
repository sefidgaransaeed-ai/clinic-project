import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { PatientsListView } from "@/modules/patients/patients-ui";

export const metadata: Metadata = {
  title: "مراجعان",
};

/**
 * صفحهٔ «مراجعان».
 *
 * صاحب محتوا: **خانم مریم (نفر دوم)** ، کار `p2-05`.
 * این فایل بخشی از پوستهٔ پنل است و فقط دو کار می‌کند: نگهبان ورود را صدا
 * می‌زند و عنوان فارسی صفحه را می‌گذارد. رابط کاربری در
 * `src/modules/patients` است (بخش ۴ CLAUDE.md: `data.ts` هر ماژول جدا بماند).
 * منوی پنل در `src/lib/panel-routes.ts` است و دست نمی‌خورد.
 *
 * نکتهٔ `M-1` و `M-6`: `mobile` یکتا ولی **اختیاری** است، و `birth_date` و
 * `gender` هم اختیاری‌اند. تطبیق مراجع با **کد ملی** است، نه موبایل (`Q-5`).
 */
export default async function PatientsPage() {
  await requireAuth();

  return <PatientsListView />;
}
