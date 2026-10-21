/**
 * صفحه موقت پنل.
 * داشبورد واقعی و منوی نقش‌ها در کار p1-10 ساخته می‌شود.
 */
export default function PanelHomePage() {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold">خوش آمدید</h2>
      <p className="text-sm opacity-80">
        این صفحه موقت است تا مسیر <code>/panel</code> قابل باز شدن باشد. ورود،
        نقش‌ها و منوی پنل در کار p1-10 ساخته می‌شوند.
      </p>
    </section>
  );
}
