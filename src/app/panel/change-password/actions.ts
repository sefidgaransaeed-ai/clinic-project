"use server";

import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error: string | null };

const MIN_LENGTH = 10;

export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  await requireAuth();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { error: `رمز عبور باید دست‌کم ${MIN_LENGTH} نویسه باشد.` };
  }
  if (password !== confirm) {
    return { error: "دو رمزی که وارد کردید یکی نیستند." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("same") || m.includes("different from the old")) {
      return { error: "رمز تازه باید با رمز فعلی متفاوت باشد." };
    }
    if (m.includes("weak") || m.includes("short")) {
      return { error: "این رمز به‌اندازهٔ کافی قوی نیست. رمز بلندتری انتخاب کنید." };
    }
    return { error: "تغییر رمز انجام نشد. اگر تکرار شد با مدیر سامانه تماس بگیرید." };
  }

  // اول رمز عوض می‌شود، بعد پرچم پایین می‌آید. اگر ترتیبش برعکس بود و
  // تغییر رمز شکست می‌خورد، کاربر با رمز موقت داخل می‌ماند و دیگر چیزی
  // مجبورش نمی‌کرد عوضش کند.
  //
  // و این‌جا `update` روی profiles نمی‌زنیم: منشی policy ویرایش ندارد و
  // آن دستور بی‌صدا صفر ردیف عوض می‌کرد. تابع migration شماره ۰۰۰۶ فقط
  // همین یک ستون را برای ردیف خودِ کاربر پایین می‌آورد.
  const { error: flagError } = await supabase.rpc("clear_must_change_password");

  if (flagError) {
    return {
      error: "رمز عوض شد، ولی وضعیت حساب به‌روز نشد. یک‌بار خارج و دوباره وارد شوید.",
    };
  }

  redirect("/panel");
}
