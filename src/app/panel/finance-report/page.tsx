import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import "@/modules/finance/theme.css";
import { requireRole } from "@/lib/auth";
import { ReportScreen } from "@/modules/finance/components/report-screen";
import { getFinanceData } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "گزارش مالی",
};

/**
 * گزارش مالی — فقط پزشک (کار p3-05). رابط و منطق در src/modules/finance است.
 *
 * پنهان‌کردن پیوند کافی نیست (CLAUDE.md ۷.۵). قفل سه لایه دارد: proxy منشی را پیش از رندر
 * برمی‌گرداند، requireRole همین‌جا، و در پایگاه داده منشی فقط پرداخت‌های امروز را می‌بیند
 * (H-4) و finance_report فقط برای پزشک است.
 */
export default function FinanceReportPage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-70">گزارش مالی در حال بارگذاری است…</p>}>
      <FinanceReport />
    </Suspense>
  );
}

async function FinanceReport() {
  await requireRole(["doctor"]);
  // «امروز» و دادهٔ نمونه به لحظهٔ درخواست بسته‌اند، پس این بخش هنگام درخواست ساخته می‌شود
  await connection();
  const now = new Date();
  const data = await getFinanceData(now);
  return <ReportScreen data={data} nowIso={now.toISOString()} />;
}
