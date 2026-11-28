import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { PublicFaq } from "@/modules/site/types";
import { getPublicInfo } from "@/modules/site/data";
import { answerForClinic, fillFaqAnswer } from "@/modules/site/faq-fill";
import type { PublicInfo } from "@/modules/site/types";
import { matchFaq, looksMedical, looksGreeting, type FaqMatch } from "./match";

/**
 * دادهٔ چت‌بات (کار p1-15). منطق خواندن و نوشتن فقط این‌جاست (بخش ۴ CLAUDE.md).
 *
 * سه کار:
 *   ۱. پرسش‌های پرتکرار را برای تطبیق می‌آورد — از همان مسیری که صفحهٔ /faq می‌خواند.
 *   ۲. پرسش بی‌پاسخ را از تابع log_unanswered_question ثبت می‌کند (تصمیم H-8).
 *   ۳. فهرست بی‌پاسخ‌ها را برای صفحهٔ /panel/chatbot می‌خواند، صفحه‌به‌صفحه (تصمیم H-7).
 *
 * ⚠️ anon هیچ دسترسی مستقیمی به هیچ جدولی ندارد؛ ثبت فقط از راه تابع انجام می‌شود که
 * خودش سقف ۱۰ در شبانه‌روز از یک IP و ۳۰۰ حرف را اعمال می‌کند.
 */

/** سقف کاراکتر پرسش، هم‌تراز با قید جدول و تابع (H-8) */
export const MAX_QUESTION_LENGTH = 300;

/** اندازهٔ صفحهٔ فهرست بی‌پاسخ‌ها؛ H-7 می‌گوید فهرست انبار می‌شود، پس صفحه‌بندی لازم است */
export const PAGE_SIZE = 20;

/** کلاینت بی‌نشست با کلید عمومی؛ کوکی نمی‌خواند و برای ویجت سایت است */
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** اطلاعات عمومی با خطای بی‌صدا: ویجت نباید به‌خاطر خطای خواندن از کار بیفتد. */
async function loadPublicInfo(): Promise<PublicInfo | null> {
  try {
    return await getPublicInfo();
  } catch {
    return null;
  }
}

/** پرسش‌های پرتکرارِ فعال، به همان شکل و ترتیبی که سایت نشان می‌دهد (W-12) */
export async function getFaqForMatching(): Promise<PublicFaq[]> {
  const info = await loadPublicInfo();
  return info?.faqItems ?? [];
}

/** نتیجهٔ یک پرسش، همان چیزی که ویجت باید نشان دهد */
export type ChatAnswer =
  | { kind: "answers"; matches: FaqMatch<PublicFaq>[] }
  | { kind: "greeting" }
  | { kind: "medical" }
  | { kind: "none" };

/**
 * پاسخ‌های قالب «{{...}}» را با دادهٔ زنده پر می‌کند (مهاجرت ۲۱). اگر اطلاعات خوانده
 * نشد، متن خام نشان داده نمی‌شود؛ نشانه با جملهٔ جایگزین پر می‌شود.
 */
function fillMatches(matches: FaqMatch<PublicFaq>[], info: PublicInfo | null): FaqMatch<PublicFaq>[] {
  if (!info) return matches.map((match) => ({ ...match, item: { ...match.item, answer: match.item.answer.replace(/\{\{[a-z_]+\}\}/g, "…") } }));
  return matches.map((match) => ({
    ...match,
    item: { ...match.item, answer: fillFaqAnswer(match.item.answer, info) },
  }));
}

/**
 * پاسخ به یک پرسش کاربر.
 *
 * دوباره اجرای منطق تطبیق روی سرور، تا مرورگر فقط نمایش دهد و نتواند نتیجه را جعل کند.
 * اگر پاسخی نبود، پرسش ثبت می‌شود و «none» برمی‌گردد تا ویجت پیام تماس را نشان دهد.
 */
export async function answerQuestion(
  question: string,
  channel: "site" | "telegram" | "bale" = "site",
  options: { previous?: string } = {},
): Promise<ChatAnswer> {
  if (looksMedical(question)) return { kind: "medical" };
  if (looksGreeting(question)) return { kind: "greeting" };

  const info = await loadPublicInfo();
  const items = info?.faqItems ?? [];

  // پرسشی که نام یک مطب را دارد، پاسخ دقیق همان مطب را می‌گیرد: نشانی، راه رسیدن و زمان حضور.
  const clinicAnswer = info ? answerForClinic(question, info) : null;
  if (clinicAnswer) {
    return {
      kind: "answers",
      matches: [
        {
          item: { question: `${clinicAnswer.clinic.name} — نشانی و زمان‌های حضور`, answer: clinicAnswer.answer, linkHref: "/contact", linkLabel: "تماس و نقشه" },
          score: 10,
        },
      ],
    };
  }

  let matches = matchFaq(question, items);

  // سؤال کوتاه در ادامهٔ گفت‌وگو: «ساعتش چنده؟» بعد از «آدرس مرزداران» باید به همان موضوع بچسبد.
  if (matches.length === 0 && options.previous) {
    matches = matchFaq(`${options.previous} ${question}`, items);
  }

  if (matches.length > 0) return { kind: "answers", matches: fillMatches(matches, info) };

  await logUnanswered(question, channel);
  return { kind: "none" };
}

export type LogOutcome = "saved" | "rejected" | "unavailable";

/**
 * ثبت پرسش بی‌پاسخ از راه تابع پایگاه داده.
 *
 * ⚠️ عمداً با کلاینت بی‌نشست (anon) کار می‌کند، نه با نشست کاربر: این مسیر عمومی است و
 * کاربر مراجع حساب ندارد. سقف نرخ و طول را خود تابع اعمال می‌کند، پس حتی اگر این
 * تابع دوباره صدا زده شود، پایگاه داده بیشتر از سقف نمی‌پذیرد.
 */
export async function logUnanswered(
  question: string,
  channel: "site" | "telegram" | "bale" = "site",
): Promise<LogOutcome> {
  const text = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!text) return "rejected";

  const supabase = anonClient();
  if (!supabase) return "unavailable";

  try {
    const { error } = await supabase.rpc("log_unanswered_question", {
      p_question: text,
      p_channel: channel,
    });
    // تابع «موفق/ناموفق» برمی‌گرداند؛ خطای سقف یا طول یعنی رد شد، نه خرابی
    if (error) return error.code === "P0001" ? "rejected" : "unavailable";
    return "saved";
  } catch {
    return "unavailable";
  }
}

export type UnansweredRow = {
  id: string;
  question: string;
  channel: string;
  createdAt: string;
};

export type UnansweredPage = {
  rows: UnansweredRow[];
  /** شمارهٔ صفحهٔ بعد؛ null یعنی آخرین صفحه است */
  nextPage: number | null;
};

/**
 * یک صفحه از پرسش‌های بی‌پاسخ، جدیدترین اول (تصمیم H-7: مرتب‌سازی بر اساس created_at).
 *
 * با نشست خود پزشک یا منشی خوانده می‌شود تا RLS نقش را واقعاً بررسی کند؛ قاعدهٔ
 * chatbot_unanswered_staff_read برای هر دو نقش مشاهده می‌دهد.
 */
export async function listUnanswered(page = 1): Promise<UnansweredPage> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const from = (safePage - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chatbot_unanswered")
    .select("id, question, channel, created_at")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE); // یک ردیف اضافه می‌خوانیم تا بدانیم صفحهٔ بعد هست یا نه

  if (error || !data) return { rows: [], nextPage: null };

  const rows = data.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    question: row.question,
    channel: row.channel,
    createdAt: row.created_at,
  }));

  return { rows, nextPage: data.length > PAGE_SIZE ? safePage + 1 : null };
}
