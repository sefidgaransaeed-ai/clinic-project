import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "تنظیمات" };

/** ورودی مشترک تنظیمات؛ خود صفحه و زیرصفحه‌ها فقط برای پزشک‌اند. */
export default async function SettingsPage() {
  await requireRole(["doctor"]);

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-bold">تنظیمات</h2>
        <p className="text-sm text-slate-600">بخش موردنظر را برای مشاهده و تغییر تنظیمات انتخاب کنید.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/panel/settings/site"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700"
        >
          <h3 className="font-bold">تنظیمات سایت</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">اطلاعات مطب‌ها، راه‌های تماس و پرسش‌های پرتکرار</p>
        </Link>
        <Link
          href="/panel/settings/finance"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-700"
        >
          <h3 className="font-bold">تنظیمات مالی</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">بیمه‌ها و روش‌های پرداخت</p>
        </Link>
      </div>
    </section>
  );
}
