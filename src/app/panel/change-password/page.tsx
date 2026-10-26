import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "تغییر رمز عبور",
};

/**
 * تغییر رمز عبور — به خواست خود کاربر.
 *
 * حالت **اجباری** جای دیگری است: اگر `must_change_password` روشن باشد،
 * پوستهٔ پنل همین فرم را به‌جای محتوای صفحه نشان می‌دهد و منو را هم
 * نمی‌آورد. آن‌جا `redirect` نگذاشتیم چون این صفحه خودش زیر همان پوسته
 * است و هدایت، حلقهٔ بی‌پایان می‌ساخت.
 *
 * صاحب این فایل: نفر اول.
 */
export default async function ChangePasswordPage() {
  await requireAuth();

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-bold">تغییر رمز عبور</h2>
        <p className="text-sm opacity-70">
          رمز تازه را دو بار وارد کنید. پس از ذخیره، به صفحهٔ اصلی پنل
          برمی‌گردید.
        </p>
      </div>

      <ChangePasswordForm />
    </section>
  );
}
