import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/lib/database.types";
import logo from "./assets/logo.png";
import { localSiteData } from "./content";
import { fromDatabase, fromLocal } from "./public-info";
import type { Clinic, PublicFaq, PublicInfo, SiteInfo, WorkingHours } from "./types";

/**
 * خواندن اطلاعات سایت عمومی از تابع get_public_info() (کار p3-13، W-07).
 *
 * بازدیدکنندهٔ سایت حساب ندارد و به جدول‌ها راه ندارد، پس فقط همین تابع با کلید عمومی صدا زده
 * می‌شود. کلاینت کوکی نمی‌خواند، چون نتیجه برای همه یکی است و نگه داشته می‌شود.
 */

/** برچسب نگه‌داری؛ صفحهٔ تنظیمات سایت بعد از هر ذخیره با همین برچسب سایت را تازه می‌کند */
export const PUBLIC_INFO_TAG = "public-info";

/**
 * لوگو فایل خود سایت است (src/modules/site/assets) و ردیف logo_url ندارد؛ seed-clinics.sql عمداً
 * آن را نگذاشته. اگر روزی ردیفش ساخته شد، همان به جای این فایل نشان داده می‌شود.
 */
const DEFAULT_LOGO = logo.src;

export async function getPublicInfo(): Promise<PublicInfo> {
  "use cache";
  cacheTag(PUBLIC_INFO_TAG);
  // اگر تغییری از راه دیگری جز صفحهٔ تنظیمات به پایگاه داده برسد، دست‌کم هر ساعت دیده می‌شود
  cacheLife("hours");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // سایت واقعی نباید هرگز دادهٔ نمونه نشان دهد، حتی اگر کلیدی در Vercel جا افتاده باشد
    if (process.env.VERCEL) {
      throw new Error("متغیرهای NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY تنظیم نشده‌اند.");
    }
    // روی کامپیوتر اعضا که کلید ندارند، دادهٔ نمونه
    return withDefaultLogo(fromLocal(localSiteData));
  }

  try {
    const supabase = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("get_public_info");
    if (error) throw error;
    return withDefaultLogo(fromDatabase(data));
  } catch (error) {
    // روی Vercel خطا پنهان نمی‌شود: سایت واقعی نباید هرگز دادهٔ نمونه نشان دهد. اگر نسخهٔ سالمی
    // از قبل نگه داشته شده، Next.js همان را نشان می‌دهد؛ وگرنه ساخت با خطا متوقف می‌شود.
    if (process.env.VERCEL) throw error;
    // روی کامپیوتر اعضا، مثلاً با کلید جانشین برای npm run build، دادهٔ نمونه
    console.warn("اطلاعات سایت از پایگاه داده خوانده نشد؛ دادهٔ نمونه نشان داده می‌شود.");
    return withDefaultLogo(fromLocal(localSiteData));
  }
}

export async function getSiteInfo(): Promise<SiteInfo> {
  return (await getPublicInfo()).siteInfo;
}

export async function getClinics(): Promise<Clinic[]> {
  return (await getPublicInfo()).clinics;
}

/** فقط پرسش‌های فعال، به ترتیب (W-12)؛ خود تابع پایگاه داده فیلتر و مرتب می‌کند */
export async function getFaqItems(): Promise<PublicFaq[]> {
  return (await getPublicInfo()).faqItems;
}

/** فقط روزهای فعال، به ترتیب روز هفته */
export async function getWorkingHours(): Promise<WorkingHours[]> {
  return (await getPublicInfo()).workingHours;
}

function withDefaultLogo(info: PublicInfo): PublicInfo {
  return { ...info, siteInfo: { logo_url: DEFAULT_LOGO, ...info.siteInfo } };
}
