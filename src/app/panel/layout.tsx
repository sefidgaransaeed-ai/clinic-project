import type { Metadata } from "next";

import { requireAuth, roleLabel } from "@/lib/auth";
import { panelRoutesFor } from "@/lib/panel-routes";

import { signOut } from "./actions";
import { ChangePasswordForm } from "./change-password/change-password-form";
import { DesktopNav, MobileNav } from "./panel-nav";

export const metadata: Metadata = {
  title: "پنل پزشک و منشی",
};

/**
 * هیچ مسیری زیر `/panel` پیش‌ساخت نمی‌شود.
 *
 * دلیلش `cacheComponents` در `next.config.ts` است: با آن روشن، Next هر
 * صفحه را پیش‌ساخت می‌کند مگر صریح بگوییم نه. و صفحه‌های پنل همه کوکی
 * نشست را می‌خوانند، یعنی خروجی‌شان برای هر کاربر فرق می‌کند.
 *
 * اگر این خط نباشد، build با خطای «uncached or runtime data during
 * prerendering» می‌شکند — و اگر روزی راهی پیدا شد که نشکند، بدتر است:
 * صفحهٔ پزشک برای منشی cache می‌شد.
 */
export const instant = false;

/**
 * پوسته پنل: سرصفحه با نام و نقش کاربر و دکمهٔ خروج، و منوی کناری که
 * بر اساس نقش فیلتر می‌شود.
 *
 * ⚠️ `requireAuth` این‌جا هر مسیر `/panel/**` را برای کاربر واردنشده
 * می‌بندد، ولی **جای `requireRole` در خود صفحه را نمی‌گیرد.** هر صفحهٔ
 * فقط‌پزشک باید خودش `requireRole(["doctor"])` را صدا بزند؛ وگرنه منشی
 * با وارد کردن مستقیم نشانی داخل می‌شود و فیلتر منو هیچ کمکی نمی‌کند.
 *
 * صاحب این فایل: نفر اول.
 */
export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireAuth();

  const items = panelRoutesFor(user.role);

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative flex flex-wrap items-center gap-3 border-b border-black/10 px-6 py-4 dark:border-white/15">
        <h1 className="text-lg font-bold">پنل مطب</h1>

        {user.mustChangePassword ? null : <MobileNav items={items} />}

        <div className="ms-auto flex items-center gap-3 text-sm">
          <span className="opacity-80">
            {user.fullName}
            <span className="mx-1 opacity-50">·</span>
            {roleLabel(user.role)}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-black/15 px-3 py-1.5 transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              خروج
            </button>
          </form>
        </div>
      </header>

      {user.mustChangePassword ? (
        // رمز موقت باید عوض شود و تا آن موقع هیچ بخش دیگری باز نیست.
        //
        // چرا از این‌جا به صفحهٔ تغییر رمز هدایت نمی‌کنیم: آن صفحه خودش زیر
        // همین پوسته است، پس هدایت حلقهٔ بی‌پایان می‌ساخت. گذاشتن فرم
        // به‌جای محتوا هم ساده‌تر است و هم محکم‌تر — راهی برای رد شدن از آن
        // نمی‌ماند، چون منو هم رندر نمی‌شود.
        <main className="flex-1 px-6 py-6">
          <section className="max-w-md space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-bold">رمز عبور خود را عوض کنید</h2>
              <p className="text-sm leading-7 opacity-80">
                رمزی که به شما داده شده موقت است. تا وقتی عوضش نکنید، بخش‌های
                دیگر پنل باز نمی‌شوند.
              </p>
            </div>
            <ChangePasswordForm />
          </section>
        </main>
      ) : (
        <div className="flex flex-1 flex-col gap-6 px-6 py-6 md:flex-row">
          <aside className="md:w-56 md:shrink-0">
            <DesktopNav items={items} />
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      )}
    </div>
  );
}
