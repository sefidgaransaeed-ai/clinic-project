import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { formatJalaliDateTime } from "@/lib/format";
import { listUnanswered } from "@/modules/chatbot/data";

export const metadata: Metadata = {
  title: "پرسش‌های بی‌پاسخ",
};

/**
 * صفحهٔ «پرسش‌های بی‌پاسخ» — کار `p1-15`. صاحبش **سعید (نفر اول)**.
 *
 * منطق خواندن در `src/modules/chatbot/data.ts` است و این فایل فقط صدایش می‌زند.
 *
 * ⚠️ تصمیم H-7: ستون «رسیدگی شد» عمداً ساخته نشد و پرسش حذف هم نمی‌شود. پس این
 * فهرست **انبار می‌شود و خالی نمی‌شود** — از این رو صفحه‌بندی دارد، نه فرض کوتاه‌ماندن.
 *
 * ⚠️ فقط پزشک و منشی، از سه لایه: proxy، همین requireRole، و قاعدهٔ RLS جدول.
 */
export default async function ChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(["doctor", "secretary"]);

  const params = await searchParams;
  const requested = Number(params.page ?? "1");
  const page = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
  const { rows, nextPage } = await listUnanswered(page);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-bold">پرسش‌های بی‌پاسخ</h2>
        <p className="text-sm opacity-70">
          پرسش‌هایی که چت‌بات سایت پاسخشان را نداشت. هر پرسش را که به پرسش‌های پرتکرار
          اضافه کنید، دفعهٔ بعد پاسخ داده می‌شود.
        </p>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        این فهرست عمداً خالی نمی‌شود و پایگاه داده راه حذف ندارد؛ پس با گذشت زمان بلند
        می‌شود و صفحه‌به‌صفحه دیده می‌شود.
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-black/10 p-6 text-center text-sm opacity-70 dark:border-white/15">
          {page > 1 ? "این صفحه خالی است." : "هنوز پرسش بی‌پاسخی ثبت نشده است."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/15"
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm leading-6">{row.question}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-60">
                  <span>{formatJalaliDateTime(row.createdAt)}</span>
                  <span>{channelLabel(row.channel)}</span>
                </p>
              </div>
              <Link
                href="/panel/settings/site"
                className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-bold transition hover:border-black/40 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/20 dark:hover:border-white/50"
              >
                افزودن به پرسش‌های پرتکرار
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || nextPage) && (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="صفحه‌بندی">
          {page > 1 ? (
            <Link href={`/panel/chatbot?page=${page - 1}`} className="rounded-lg border border-black/15 px-3 py-1.5 dark:border-white/20">
              صفحهٔ قبل
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs opacity-60">صفحهٔ {page}</span>
          {nextPage ? (
            <Link href={`/panel/chatbot?page=${nextPage}`} className="rounded-lg border border-black/15 px-3 py-1.5 dark:border-white/20">
              صفحهٔ بعد
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}

/** نام فارسی کانال؛ مقدار پایگاه داده انگلیسی است */
function channelLabel(channel: string): string {
  switch (channel) {
    case "site":
      return "سایت";
    case "telegram":
      return "تلگرام";
    case "bale":
      return "بله";
    default:
      return channel;
  }
}
