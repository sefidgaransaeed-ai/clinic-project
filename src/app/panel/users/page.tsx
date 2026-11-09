import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";
import { listPanelAccounts } from "@/modules/users/data";
import { AccountsTable, CreateSecretaryForm } from "@/modules/users/users-ui";

export const metadata: Metadata = {
  title: "کاربران",
};

/**
 * صفحهٔ «کاربران» — کار `p1-12`. صاحبش **سعید (نفر اول)**.
 *
 * منطق خواندن و نوشتن در `src/modules/users/data.ts` است و این فایل فقط
 * صدایش می‌زند (بخش ۴ CLAUDE.md). منوی پنل در `src/lib/panel-routes.ts`
 * است و دست نمی‌خورد.
 *
 * ⚠️ **فقط پزشک** — و سه لایه دارد، چون هیچ‌کدام به‌تنهایی کافی نیست:
 *   ۱. `src/proxy.ts` — پیش از هر رندری، با پاسخ ۳۰۷ واقعی
 *   ۲. `requireRole` همین پایین — اگر روزی مسیر از جدول بیفتد
 *   ۳. `requireRole` در خودِ هر Server Action — چون action یک مسیر HTTP
 *      مستقل است و قفل ناوبری نمی‌گیردش
 *
 * معیار `U-04` (آخرین پزشک فعال) عمداً در این لایه نیست؛ نگهبانش trigger
 * پایگاه داده در migration ۰۰۱۲ است، چون این صفحه با کلید سرویس کار
 * می‌کند و از RLS رد می‌شود.
 */
export default async function UsersPage() {
  await requireRole(["doctor"]);

  const accounts = await listPanelAccounts();

  return (
    <section className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-base font-bold">کاربران</h2>
        <p className="text-sm opacity-70">
          حساب‌های پنل. ثبت‌نام عمومی بسته است و حساب تازه فقط از همین صفحه ساخته
          می‌شود.
        </p>
      </div>

      <AccountsTable accounts={accounts} />

      <div className="space-y-3 border-t border-black/10 pt-6 dark:border-white/15">
        <h3 className="text-sm font-bold">ساخت حساب منشی</h3>
        <CreateSecretaryForm />
      </div>
    </section>
  );
}
