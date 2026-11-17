import type { Metadata } from "next";
import "@/modules/site/theme.css";
import { formatTehranTime } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { SurveyLinks } from "@/modules/feedback/components/survey-links";
import { getLinkCandidates } from "@/modules/feedback/data";
import { dateStamp } from "@/modules/feedback/rules";

export const metadata: Metadata = {
  title: "لینک‌های نظرسنجی",
};

/**
 * لینک‌های نظرسنجی — پزشک و منشی (کار p3-09). رابط و منطق در src/modules/feedback است.
 *
 * قفل سه لایه دارد: proxy، requireRole همین‌جا و در action ساختن لینک، و خود تابع‌های پایگاه
 * داده که is_staff را بررسی می‌کنند. منشی فقط لینک می‌سازد؛ به جدول surveys و نتیجه‌ها راه
 * ندارد (H-10).
 *
 * ⚠️ در src/lib/panel-routes.ts همهٔ /panel/feedback فقط برای پزشک است، پس تا نفر اول ردیف
 * /panel/feedback/links را برای هر دو نقش اضافه نکند، proxy منشی را برمی‌گرداند.
 */
export default async function SurveyLinksPage() {
  await requireRole(["doctor", "secretary"]);
  const candidates = await getLinkCandidates(7);

  return (
    <SurveyLinks
      rows={candidates.map((row) => ({
        appointmentId: row.appointmentId,
        patientName: row.patientName,
        time: formatTehranTime(row.startsAt),
        stamp: dateStamp(row.startsAt),
      }))}
    />
  );
}
