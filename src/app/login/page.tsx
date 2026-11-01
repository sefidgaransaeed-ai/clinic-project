import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "ورود به پنل",
};

/**
 * صفحهٔ ورود.
 *
 * ثبت‌نام **وجود ندارد** و نباید داشته باشد (بند ۴ CLAUDE.md). حساب منشی
 * را پزشک در صفحهٔ «کاربران» می‌سازد. گزینهٔ «Allow new users to sign up»
 * در داشبورد Supabase هم خاموش است، پس حتی اگر کسی مستقیم به API بزند
 * حسابی ساخته نمی‌شود.
 *
 * صاحب این فایل: نفر اول.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-7">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-bold">ورود به پنل مطب</h1>
          <p className="text-sm opacity-70">
            ایمیل و رمز عبوری که مدیر سامانه به شما داده است را وارد کنید.
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs opacity-60">
          حساب کاربری را پزشک مطب می‌سازد؛ در این سامانه ثبت‌نام وجود ندارد.
        </p>
      </div>
    </main>
  );
}
