"use server";

import { answerQuestion, MAX_QUESTION_LENGTH, type ChatAnswer } from "./data";

export type AskResult =
  | { ok: true; answer: ChatAnswer }
  | { ok: false; message: string };

/**
 * پرسش از چت‌بات (کار p1-15، گام ۲). عمومی است — مراجع حساب ندارد.
 *
 * ⚠️ عمداً `requireRole` ندارد، چون ویجت روی سایت عمومی است. قفل واقعی این است که
 * مسیر فقط سه کار می‌کند: پاسخ از FAQ می‌دهد، هشدار پزشکی می‌دهد، یا از راه تابع
 * سقف‌دار ثبت می‌کند. هیچ خواندن یا نوشتن دیگری روی پایگاه داده ندارد (بند ۵ بخش ۷).
 *
 * بررسی طول همین‌جا انجام می‌شود تا ورودی خیلی بلند حتی به شبکه نرسد.
 */
export async function ask(question: string, previous?: string): Promise<AskResult> {
  const text = question.trim();
  if (!text) {
    return { ok: false, message: "پرسشتان را بنویسید تا ببینم پاسخی دارم یا نه." };
  }
  if (text.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      message: `پرسش حداکثر ${MAX_QUESTION_LENGTH} حرف می‌تواند باشد؛ کوتاه‌ترش کنید.`,
    };
  }
  // پرسش قبلی فقط برای ادامهٔ گفت‌وگو («ساعتش چنده؟» بعد از پرسش آدرس) و حداکثر یک پرسش.
  const context = typeof previous === "string" ? previous.trim().slice(0, MAX_QUESTION_LENGTH) : "";

  return { ok: true, answer: await answerQuestion(text, "site", context ? { previous: context } : {}) };
}
