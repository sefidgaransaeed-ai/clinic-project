/**
 * تنها منبع حقیقت برای «چه نقشی به چه مسیری راه دارد».
 *
 * چرا این فایل جداست و هیچ import ندارد: سه جای مختلف باید همین جدول را
 * بخوانند و **هیچ‌کدام نباید نسخهٔ خودش را داشته باشد** —
 *
 *   ۱. `src/proxy.ts` — قفل اصلی. پیش از هر رندری، با پاسخ ۳۰۷ واقعی.
 *      در زمان اجرای edge کار می‌کند، پس نمی‌تواند چیزی از
 *      `src/lib/supabase/server.ts` یا `next/navigation` بیاورد.
 *   ۲. `src/lib/auth.ts` — لایهٔ دوم، `requireRole` در خود صفحه.
 *   ۳. `src/app/panel/layout.tsx` — فیلتر منو.
 *
 * اگر این سه از هم جدا می‌شدند، روزی منو یک چیز نشان می‌داد و قفل چیز
 * دیگری اجازه می‌داد. همین یک فایل آن را ناممکن می‌کند.
 *
 * دسترسی هر مسیر از جدول «پنل پزشک و منشی» بخش ۳ سند طرح و از تصمیم
 * `H-4` و سند `0010` می‌آید.
 *
 * صاحب این فایل: نفر اول. برای عوض کردنش متن تغییر پیشنهادی را بفرستید
 * (بند ۱ بخش ۷ CLAUDE.md).
 */

export type AppRole = "doctor" | "secretary";

export type PanelRoute = {
  href: PanelHref;
  label: string;
  roles: readonly AppRole[];
  /** صاحب صفحه طبق بخش ۳ CLAUDE.md — تا معلوم باشد کی پرش می‌کند. */
  owner: string;
};

export type PanelHref =
  | "/panel/today"
  | "/panel/requests"
  | "/panel/appointments"
  | "/panel/patients"
  | "/panel/payments"
  | "/panel/finance-report"
  | "/panel/settings"
  | "/panel/users"
  | "/panel/bot"
  | "/panel/chatbot"
  | "/panel/feedback";

const BOTH: readonly AppRole[] = ["doctor", "secretary"];
const DOCTOR_ONLY: readonly AppRole[] = ["doctor"];

/** آیتم‌های منو، به همان ترتیبی که در منو دیده می‌شوند. */
export const PANEL_ROUTES: readonly PanelRoute[] = [
  { href: "/panel/today", label: "نوبت‌های امروز", roles: BOTH, owner: "نفر دوم" },
  { href: "/panel/requests", label: "درخواست‌های نوبت", roles: BOTH, owner: "نفر دوم" },
  { href: "/panel/appointments", label: "تقویم", roles: BOTH, owner: "نفر دوم" },
  { href: "/panel/patients", label: "مراجعان", roles: BOTH, owner: "نفر دوم" },
  { href: "/panel/payments", label: "پرداخت‌ها", roles: BOTH, owner: "نفر سوم" },
  { href: "/panel/finance-report", label: "گزارش مالی", roles: DOCTOR_ONLY, owner: "نفر سوم" },
  { href: "/panel/settings", label: "تنظیمات", roles: DOCTOR_ONLY, owner: "نفر دوم و سوم" },
  { href: "/panel/users", label: "کاربران", roles: DOCTOR_ONLY, owner: "نفر اول" },
  { href: "/panel/bot", label: "ربات و یادآوری", roles: DOCTOR_ONLY, owner: "نفر دوم" },
  { href: "/panel/chatbot", label: "پرسش‌های بی‌پاسخ", roles: BOTH, owner: "نفر اول" },
  { href: "/panel/feedback", label: "بازخوردها", roles: DOCTOR_ONLY, owner: "نفر سوم" },
];

/** آیتم‌های منو برای یک نقش. */
export function panelRoutesFor(role: AppRole): readonly PanelRoute[] {
  return PANEL_ROUTES.filter((route) => route.roles.includes(role));
}

/**
 * این مسیر برای این نقش باز است یا نه.
 *
 * مسیرهایی که در جدول نیستند — `/panel` و `/panel/no-access` و
 * `/panel/change-password` — برای هر دو نقش بازند. پس **پیش‌فرض باز است**،
 * و این عمدی است: جدول فقط می‌گوید چه چیزی **بسته** است.
 *
 * دلیلش این است که وگرنه هر صفحهٔ تازه‌ای که نفر دوم یا سوم می‌ساخت، تا
 * وقتی نفر اول این جدول را به‌روز نکرده بود، برای همه ۴۰۳ می‌داد و کسی
 * نمی‌فهمید چرا. قفل واقعی داده در RLS است، نه در این جدول.
 *
 * زیرمسیرها هم حساب می‌شوند: `/panel/users/new` همان قاعدهٔ `/panel/users`
 * را می‌گیرد.
 */
export function isPanelPathAllowed(pathname: string, role: AppRole): boolean {
  const route = PANEL_ROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  return route ? route.roles.includes(role) : true;
}
