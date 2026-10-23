import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پنل پزشک و منشی",
};

/**
 * پوسته پنل. فعلاً فقط سرصفحه دارد.
 * منوی کناری بر اساس نقش کاربر و نوار خروج در کار p1-10 اینجا اضافه می‌شود.
 * صاحب این فایل: نفر اول.
 */
export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/15">
        <h1 className="text-lg font-bold">پنل پزشک و منشی</h1>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
