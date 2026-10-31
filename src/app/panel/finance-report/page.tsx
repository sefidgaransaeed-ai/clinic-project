import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import "@/modules/finance/theme.css";
import { ReportScreen } from "@/modules/finance/components/report-screen";
import { getFinanceData } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "گزارش مالی",
};

/**
 * گزارش مالی — فقط پزشک.
 * محافظت سمت سرور با requireRole(['doctor']) اینجا می‌آید، وقتی نفر اول آن را در کار p1-10
 * بسازد. پنهان‌کردن پیوند کافی نیست (CLAUDE.md ۷.۵): در پایگاه داده هم منشی فقط پرداخت‌های
 * امروز را می‌بیند (H-4) و تابع finance_report فقط برای پزشک است.
 */
export default function FinanceReportPage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-70">گزارش مالی در حال بارگذاری است…</p>}>
      <FinanceReport />
    </Suspense>
  );
}

async function FinanceReport() {
  // «امروز» و دادهٔ نمونه به لحظهٔ درخواست بسته‌اند، پس این بخش هنگام درخواست ساخته می‌شود
  await connection();
  const now = new Date();
  const data = await getFinanceData(now);
  return <ReportScreen data={data} nowIso={now.toISOString()} />;
}
