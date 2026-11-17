import { Suspense } from "react";

import { requireAuth } from "@/lib/auth";
import { PanelLoadFailed } from "@/modules/appointments/appointments-ui";
import { NewPatientView } from "@/modules/patients/patients-ui";
import { loadInsuranceNames } from "@/modules/patients/queries";

export default function NewPatientPage() {
  return (
    <Suspense fallback={<p className="px-6 py-12 text-center text-base text-slate-600">فرم مراجع در حال بارگذاری است.</p>}>
      <NewPatientContent />
    </Suspense>
  );
}

/** فهرست نوع‌های بیمه از پایگاه داده خوانده می‌شود، پس خواندنش باید پشت Suspense باشد (cacheComponents). */
async function NewPatientContent() {
  await requireAuth();

  const insurance = await loadInsuranceNames();
  if (!insurance.ok) {
    return <PanelLoadFailed title="مراجع" message={insurance.message} />;
  }

  return <NewPatientView insuranceNames={insurance.names} />;
}
