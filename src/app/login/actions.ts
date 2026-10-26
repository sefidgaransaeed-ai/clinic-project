"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

/**
 * پیام خطای Supabase انگلیسی است. طبق بخش ۴ CLAUDE.md هیچ متن انگلیسی
 * نباید به کاربر نشان داده شود، پس این‌جا به فارسی ترجمه می‌شود.
 *
 * و عمداً نمی‌گوییم «ایمیل پیدا نشد» یا «رمز غلط است» — فقط می‌گوییم یکی
 * از این دو. وگرنه هر کسی می‌توانست با همین صفحه بفهمد چه ایمیل‌هایی در
 * سامانه حساب دارند.
 */
function persianAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "ایمیل یا رمز عبور درست نیست.";
  }
  if (m.includes("email not confirmed")) {
    return "این حساب هنوز تأیید نشده است. با مدیر سامانه تماس بگیرید.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "تلاش‌های ناموفق زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید.";
  }
  return "ورود انجام نشد. اگر تکرار شد با مدیر سامانه تماس بگیرید.";
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "ایمیل و رمز عبور را وارد کنید." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: persianAuthError(error.message) };
  }

  redirect("/panel");
}
