import { requireAuth, roleLabel } from "@/lib/auth";
import { formatJalaliDateLong } from "@/lib/format";
import { panelRoutesFor } from "@/lib/panel-routes";

/**
 * داشبورد پنل — خوش‌آمد ساده.
 *
 * عمداً هیچ عدد و آماری ندارد: آمار نوبت‌ها کار نفر دوم و آمار مالی کار
 * نفر سوم است، و منشی هم نباید عدد مالی ببیند (`H-4`). اگر این صفحه آمار
 * داشت، همان قفل را از پشت دور می‌زد.
 *
 * صاحب این فایل: نفر اول.
 */
export default async function PanelHomePage() {
  const user = await requireAuth();
  const items = panelRoutesFor(user.role);

  return (
    <section className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-bold">
          {user.fullName}، خوش آمدید
        </h2>
        <p className="text-sm opacity-70">
          امروز {formatJalaliDateLong(new Date())} است. شما با نقش{" "}
          {roleLabel(user.role)} وارد شده‌اید.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium opacity-80">
          بخش‌هایی که به آن‌ها دسترسی دارید
        </h3>
        <ul className="flex flex-wrap gap-2 text-sm">
          {items.map((item) => (
            <li
              key={item.href}
              className="rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/15"
            >
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-lg bg-black/5 px-4 py-3 text-xs leading-6 opacity-80 dark:bg-white/10">
        این سامانه آموزشی است و همهٔ داده‌هایش ساختگی. هیچ نام، شماره تلفن یا
        اطلاعات مالی واقعی در آن نیست.
      </p>
    </section>
  );
}
