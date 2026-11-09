import type { Metadata } from "next";
import "@/modules/finance/theme.css";
import { requireRole } from "@/lib/auth";
import { FinanceSettings } from "@/modules/finance/components/finance-settings";
import { getFinanceOptions } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "بیمه‌ها و روش‌های پرداخت",
};

/**
 * تنظیم بیمه‌ها و روش‌های پرداخت — فقط پزشک (کار p3-07).
 * مسیر زیر /panel/settings است و proxy آن را برای منشی پیش از رندر می‌بندد؛ requireRole لایهٔ
 * دوم است. در پایگاه داده هم فقط پزشک می‌تواند این دو جدول را تغییر دهد.
 */
export default async function FinanceSettingsPage() {
  await requireRole(["doctor"]);
  const options = await getFinanceOptions();
  return <FinanceSettings initial={options} />;
}
