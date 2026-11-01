import { redirect } from "next/navigation";

import { type AppRole } from "@/lib/panel-routes";
import { createClient } from "@/lib/supabase/server";

/**
 * نقش و دسترسی — سمت سرور.
 *
 * ⚠️ قاعدهٔ بند ۵ CLAUDE.md: مخفی‌کردن یک آیتم منو کنترل دسترسی نیست.
 * منوی این پروژه بر اساس نقش فیلتر می‌شود، ولی **آن فقط برای آسودگی
 * چشم کاربر است**. قفل واقعی دو جاست:
 *
 *   ۱. همین فایل — `requireRole` در بالای هر صفحهٔ محافظت‌شده
 *   ۲. قاعده‌های RLS در پایگاه داده — که حتی اگر این لایه هم دور زده شود
 *      ردیفی برنمی‌گردانند
 *
 * و نکتهٔ مهم: نقشِ معتبر آن است که در `app_metadata` حساب Supabase نشسته،
 * چون **همان** چیزی است که داخل JWT می‌رود و RLS می‌خواندش. ستون
 * `profiles.role` برای نمایش و گزارش است. اگر این دو با هم نخوانند، باید
 * `app_metadata` برنده باشد وگرنه منو یک چیز نشان می‌دهد و پایگاه داده
 * چیز دیگری اجازه می‌دهد.
 */

export type { AppRole };

export type PanelUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  mustChangePassword: boolean;
};

function isAppRole(value: unknown): value is AppRole {
  return value === "doctor" || value === "secretary";
}

/**
 * کاربر واردشده را برمی‌گرداند، یا `null` اگر وارد نشده باشد.
 *
 * `null` هم برمی‌گرداند وقتی حساب هست ولی قابل استفاده نیست:
 *   — نقشی در `app_metadata` ندارد
 *   — رکورد `profiles` ندارد
 *   — `is_active` خاموش است (حساب غیرفعال‌شده)
 *
 * هر سه مورد یعنی «این حساب به پنل راه ندارد»، پس تفکیکشان به کار
 * فراخوان نمی‌آید.
 */
export async function getPanelUser(): Promise<PanelUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const role = user.app_metadata?.role;
  if (!isAppRole(role)) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role,
    mustChangePassword: profile.must_change_password,
  };
}

/** کاربر واردشده، یا هدایت به صفحهٔ ورود. */
export async function requireAuth(): Promise<PanelUser> {
  const user = await getPanelUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * کاربر واردشده با یکی از نقش‌های مجاز، وگرنه هدایت به «دسترسی ندارید».
 *
 * این تابع را در **خط اول** هر صفحهٔ محافظت‌شده و هر Server Action بگذارید:
 *
 *     export default async function Page() {
 *       await requireRole(["doctor"]);
 *       …
 *     }
 */
export async function requireRole(roles: readonly AppRole[]): Promise<PanelUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect("/panel/no-access");
  return user;
}

/** برچسب فارسی نقش، برای نمایش در سرصفحه. */
export function roleLabel(role: AppRole): string {
  return role === "doctor" ? "پزشک" : "منشی";
}
