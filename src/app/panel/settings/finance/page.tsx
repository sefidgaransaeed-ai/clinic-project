import type { Metadata } from "next";
import "@/modules/finance/theme.css";
import { FinanceSettings } from "@/modules/finance/components/finance-settings";
import { getFinanceOptions } from "@/modules/finance/data";

export const metadata: Metadata = {
  title: "بیمه‌ها و روش‌های پرداخت",
};

/**
 * تنظیم بیمه‌ها و روش‌های پرداخت — فقط پزشک (کار p3-07).
 * محافظت سمت سرور با requireRole(['doctor']) اینجا می‌آید وقتی #30 ادغام شود؛ مسیر زیر
 * /panel/settings است و proxy همان #30 آن را برای منشی می‌بندد. در پایگاه داده هم فقط پزشک
 * می‌تواند این دو جدول را تغییر دهد.
 */
export default async function FinanceSettingsPage() {
  const options = await getFinanceOptions();
  return <FinanceSettings initial={options} />;
}
