import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isPanelPathAllowed, type AppRole } from "@/lib/panel-routes";

/**
 * این فایل در Next.js تا نسخهٔ ۱۵ نامش `middleware.ts` بود. از نسخهٔ ۱۶
 * نامش `proxy.ts` است و تابعش باید `proxy` نام داشته باشد؛ نام قدیمی
 * هشدار deprecated می‌دهد.
 *
 * سه کار انجام می‌دهد:
 *
 *   ۱. نشست را تازه نگه می‌دارد. توکن Supabase عمر کوتاهی دارد؛ اگر کسی
 *      تازه‌اش نکند، کاربر وسط کار بیرون می‌افتد. تازه‌سازی باید در
 *      middleware باشد چون فقط این‌جا می‌توان کوکی را روی پاسخ نوشت —
 *      در Server Component نوشتن کوکی ممکن نیست.
 *
 *   ۲. مسیرهای `/panel` را برای کاربر واردنشده به `/login` می‌برد.
 *
 *   ۳. **قفل نقش.** مسیرهای فقط‌پزشک را برای منشی با پاسخ ۳۰۷ واقعی به
 *      «دسترسی ندارید» می‌فرستد.
 *
 * بند ۳ عمداً این‌جاست و نه فقط در خود صفحه. با `cacheComponents` روشن،
 * Next پوستهٔ صفحه را **پیش از** اجرای بدنهٔ آن روی شبکه flush می‌کند. پس
 * `redirect()` داخل `requireRole` دیگر نمی‌تواند کد وضعیت را عوض کند و
 * هدایت به یک دستور جریانی تبدیل می‌شود: پاسخ ۲۰۰ می‌شود و `<title>`
 * صفحهٔ فقط‌پزشک هم در آن پاسخ می‌نشیند. مرورگر درست هدایت می‌شود، ولی هر
 * کلاینت دیگری — از جمله آزمون خودکار `tests/access` — پاسخ ۲۰۰ می‌گیرد.
 *
 * این آزمون‌شده است، حدس نیست: پیش از افزودن بند ۳، منشی روی هر پنج
 * مسیر فقط‌پزشک پاسخ ۲۰۰ می‌گرفت، در حالی که منو درست فیلتر شده بود.
 * یعنی دقیقاً همان حالتی که بند ۵ CLAUDE.md از آن حرف می‌زند.
 *
 * ⚠️ و با همهٔ این‌ها، این فایل **آخرین** قفل نیست؛ اولین قفل است. قفل
 * داده در RLS پایگاه داده است. اگر روزی همین فایل حذف شود، هیچ ردیفی لو
 * نمی‌رود.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // اگر متغیرها تنظیم نشده‌اند، middleware نباید کل سایت را بخواباند.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser و نه getSession: این یکی توکن را با سرور Supabase می‌سنجد،
  // پس کوکی دست‌کاری‌شده از آن رد نمی‌شود.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/panel")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && path.startsWith("/panel")) {
    const role = user.app_metadata?.role as AppRole | undefined;

    // نقشی که در `app_metadata` نیست یعنی حسابی که به پنل راه ندارد.
    // `requireAuth` هم همین را می‌گوید، ولی آن‌جا دیر است.
    if (role !== "doctor" && role !== "secretary") {
      const noAccess = request.nextUrl.clone();
      noAccess.pathname = "/panel/no-access";
      noAccess.search = "";
      return NextResponse.redirect(noAccess);
    }

    if (!isPanelPathAllowed(path, role)) {
      const noAccess = request.nextUrl.clone();
      noAccess.pathname = "/panel/no-access";
      noAccess.search = "";
      return NextResponse.redirect(noAccess);
    }
  }

  if (user && path === "/login") {
    const panelUrl = request.nextUrl.clone();
    panelUrl.pathname = "/panel";
    panelUrl.search = "";
    return NextResponse.redirect(panelUrl);
  }

  return response;
}

export const config = {
  // فایل‌های ایستا و تصویرها از middleware رد نمی‌شوند تا هر درخواست
  // یک رفت‌وبرگشت اضافه به Supabase نزند.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
