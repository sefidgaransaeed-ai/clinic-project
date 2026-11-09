import { Suspense } from "react";
import { PatientDetailView } from "@/modules/patients/patients-ui";

export default function PatientDetailPage({ params }: PageProps<"/panel/patients/[id]">) {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-center text-base text-slate-600">اطلاعات مراجع در حال بارگذاری است.</p>}>
      <PatientDetailContent params={params} />
    </Suspense>
  );
}

/** شناسهٔ مراجع در زمان درخواست معلوم می‌شود، پس خواندنش باید پشت Suspense باشد (cacheComponents). */
async function PatientDetailContent({ params }: { params: PageProps<"/panel/patients/[id]">["params"] }) {
  const { id } = await params;
  return <PatientDetailView patientId={id} />;
}
