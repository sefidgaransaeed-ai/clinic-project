import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import "@/modules/finance/theme.css";
import { PaymentsScreen } from "@/modules/finance/components/payments-screen";
import { getFinanceData } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "پرداخت‌ها",
};

/**
 * پرداخت‌ها — برای پزشک و منشی.
 * محافظت سمت سرور با requireRole(['doctor', 'secretary']) اینجا می‌آید، وقتی نفر اول آن را
 * در کار p1-10 بسازد. تا آن موقع نقش با کلید موقت داخل صفحه انتخاب می‌شود.
 */
export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-70">پرداخت‌ها در حال بارگذاری است…</p>}>
      <Payments />
    </Suspense>
  );
}

async function Payments() {
  // «امروز» و دادهٔ نمونه به لحظهٔ درخواست بسته‌اند، پس این بخش هنگام درخواست ساخته می‌شود
  await connection();
  const now = new Date();
  const data = await getFinanceData(now);
  return <PaymentsScreen data={data} nowIso={now.toISOString()} />;
}
