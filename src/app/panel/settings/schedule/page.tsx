import type { Metadata } from "next";
import { Suspense } from "react";

import { requireRole } from "@/lib/auth";
import { ScheduleView } from "@/modules/schedule-settings/schedule-view";

export const metadata: Metadata = {
  title: "ساعت کاری",
};

/**
 * صفحهٔ «ساعت کاری» — کار `p2-09`. صاحب محتوا: **خانم مریم**؛ رابط در `src/modules/schedule-settings`.
 *
 * ⚠️ **فقط پزشک.** مسیر زیر `/panel/settings` است و قفل ناوبری آن را می‌بندد، ولی لایهٔ دوم همین
 * `requireRole` است. هر Server Action هم خودش `requireRole(["doctor"])` دارد.
 * لینکی به این صفحه نیست؛ لینک را نفر اول بعداً اضافه می‌کند.
 */
export default async function ScheduleSettingsPage() {
  await requireRole(["doctor"]);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-bold">ساعت کاری</h2>
        <p className="text-sm opacity-70">
          بازه‌های کاری هر روز هفته، از شنبه تا جمعه. بازه‌ای که دیگر لازم نیست غیرفعال می‌شود و ردیفش می‌ماند.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm opacity-70">ساعت‌های کاری در حال بارگذاری است.</p>}>
        <ScheduleView />
      </Suspense>
    </section>
  );
}
