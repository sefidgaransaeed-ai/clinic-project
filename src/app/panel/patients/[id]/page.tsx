import { Suspense } from "react";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed } from "@/modules/appointments/appointments-ui";
import { PatientDetailView } from "@/modules/patients/patients-ui";
import { loadInsuranceNames, loadPatientDetailSnapshot } from "@/modules/patients/queries";

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
  const [result, insurance] = await Promise.all([loadPatientDetailSnapshot(id), loadInsuranceNames()]);
  if (!result.ok) {
    return <PanelLoadFailed title="مراجع" message={result.message} />;
  }
  if (!insurance.ok) {
    return <PanelLoadFailed title="مراجع" message={insurance.message} />;
  }

  return <PatientDetailView patientId={id} initialSnapshot={result.snapshot} insuranceNames={insurance.names} />;
}
