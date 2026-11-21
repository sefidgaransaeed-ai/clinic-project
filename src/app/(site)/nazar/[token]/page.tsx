import type { Metadata } from "next";
import { Suspense } from "react";
import { getSurvey } from "@/modules/feedback/data";
import { SurveyCard, SurveyClosed, SurveyUnavailable } from "@/modules/feedback/components/survey-card";
import { dateStamp, isSurveyToken } from "@/modules/feedback/rules";
import { WaveEdge } from "@/modules/site/components/brand-shapes";

export const metadata: Metadata = {
  title: "نظرسنجی",
  // هر لینک مال یک نوبت است و نباید در جست‌وجو بیاید، حتی بعد از برداشتن robots.ts (W-10)
  robots: { index: false, follow: false },
};

/**
 * صفحهٔ عمومی نظرسنجی پس از نوبت (کار p3-09). رابط و منطق در src/modules/feedback است.
 * مراجع حساب ندارد؛ فقط با token یک‌بارمصرف همان نوبت وارد می‌شود و چیزی جز تاریخ نوبت نمی‌بیند.
 */
export default function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <>
      <div className="h-4 bg-(--site-navy)" />
      <WaveEdge position="bottom" className="-mt-px block h-10 w-full md:h-16" />
      <section className="mx-auto max-w-md px-4 pt-4 pb-16">
        <Suspense fallback={<p className="py-16 text-center text-(--site-muted)">در حال باز کردن نظرسنجی…</p>}>
          <SurveyContent params={params} />
        </Suspense>
      </section>
    </>
  );
}

async function SurveyContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isSurveyToken(token)) return <SurveyClosed />;

  const survey = await getSurvey(token);
  if (survey.status === "closed") return <SurveyClosed />;
  if (survey.status === "unavailable") return <SurveyUnavailable />;
  return <SurveyCard token={token} stamp={dateStamp(survey.startsAt)} />;
}
