import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import "@/modules/finance/theme.css";
import { requireAuth } from "@/lib/auth";
import { PaymentsScreen } from "@/modules/finance/components/payments-screen";
import { getFinanceData } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "پرداخت‌ها",
};

/**
 * پرداخت‌ها — برای پزشک و منشی (کار p3-04). رابط و منطق در src/modules/finance است.
 *
 * نقش از حساب واردشده می‌آید، نه از کلیدی در صفحه. نکتهٔ H-4 و سند 0010: منشی فقط
 * پرداخت‌های امروز را می‌بیند و این در RLS اجبار می‌شود؛ صفحه فقط تصویر همان است.
 * ویرایش پرداخت در پایگاه داده مسدود است — اصلاح فقط با ردیف معکوس.
 */
export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-70">پرداخت‌ها در حال بارگذاری است…</p>}>
      <Payments />
    </Suspense>
  );
}

async function Payments() {
  const user = await requireAuth();
  // «امروز» و دادهٔ نمونه به لحظهٔ درخواست بسته‌اند، پس این بخش هنگام درخواست ساخته می‌شود
  await connection();
  const now = new Date();
  const data = await getFinanceData(now);
  return <PaymentsScreen data={data} role={user.role} nowIso={now.toISOString()} />;
}
