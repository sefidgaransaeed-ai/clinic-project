import { Suspense } from "react";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed } from "@/modules/appointments/appointments-ui";
import { PatientDetailView } from "@/modules/patients/patients-ui";
import { loadPatientDetailSnapshot } from "@/modules/patients/queries";

export default function PatientDetailPage({ params }: PageProps<"/panel/patients/[id]">) {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-center text-base text-slate-600">اطلاعات مراجع در حال بارگذاری است.</p>}>
      <PatientDetailContent params={params} />
    </Suspense>
  );
}

/** شناسهٔ مراجع در زمان درخواست معلوم می‌شود، پس خواندنش باید پشت Suspense باشد (cacheComponents). */
async function PatientDetailContent({ params }: { params: PageProps<"/panel/patients/[id]">["params"] }) {
  await requireAuth();

  const { id } = await params;
  const result = await loadPatientDetailSnapshot(id);
  if (!result.ok) {
    return <PanelLoadFailed title="مراجع" message={result.message} />;
  }

  return <PatientDetailView patientId={id} initialSnapshot={result.snapshot} />;
}
