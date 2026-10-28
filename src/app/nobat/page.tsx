import type { Metadata } from "next";
import { PublicBooking } from "@/modules/appointments/public-booking";
import { PUBLIC_BOOKING_MESSAGES } from "@/modules/appointments/public-booking-messages";

export const metadata: Metadata = {
  title: PUBLIC_BOOKING_MESSAGES.pageTitle,
};

/** صفحهٔ عمومی درخواست نوبت؛ فقط عنوان و فرم. منطق در src/modules/appointments است. */
export default function NobatPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 text-right text-slate-900 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{PUBLIC_BOOKING_MESSAGES.pageTitle}</h1>
        <p className="mb-5 mt-3 text-base leading-7 text-slate-700">{PUBLIC_BOOKING_MESSAGES.intro}</p>
        <PublicBooking />
      </div>
    </main>
  );
}
