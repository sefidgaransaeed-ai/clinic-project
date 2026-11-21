"use server";

import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { createSurveyToken, submitSurveyAnswer, type SubmitOutcome } from "./data";
import { isSurveyToken, surveyInputError, surveyUrl } from "./rules";

export type SubmitResult = { outcome: SubmitOutcome } | { outcome: "invalid"; message: string };

/**
 * ثبت نظر مراجع؛ عمومی و بدون حساب. token تصادفی ۱۲۸ بیتی و یک‌بارمصرف است و خود
 * submit_survey در پایگاه داده پاسخ دوم و لینک کهنه را رد می‌کند.
 */
export async function submitSurvey(token: string, score: number, comment: string): Promise<SubmitResult> {
  if (!isSurveyToken(token)) return { outcome: "closed" };
  const problem = surveyInputError(score, comment);
  if (problem) return { outcome: "invalid", message: problem };
  return { outcome: await submitSurveyAnswer(token, score, comment.trim()) };
}

export type LinkResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * ساختن لینک نظرسنجی برای یک نوبت انجام‌شده؛ پزشک و منشی.
 *
 * ⚠️ Server Action یک مسیر HTTP مستقل است و قفل proxy آن را نمی‌گیرد، پس خط اول requireRole
 * است (بند ۵ بخش ۷ CLAUDE.md). خود create_survey_link هم نقش و وضعیت «انجام‌شده» را بررسی می‌کند.
 */
export async function createSurveyLink(appointmentId: string): Promise<LinkResult> {
  await requireRole(["doctor", "secretary"]);

  const token = await createSurveyToken(appointmentId);
  if (!token) {
    return { ok: false, message: "لینک ساخته نشد. شاید این نوبت هنوز «انجام‌شده» ثبت نشده است." };
  }

  // نشانی همان دامنه‌ای که پنل رویش باز است؛ روی Vercel و روی کامپیوتر یکسان کار می‌کند
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host");
  const protocol = head.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (!host) return { ok: false, message: "نشانی سایت پیدا نشد. صفحه را دوباره باز کنید." };

  return { ok: true, url: surveyUrl(`${protocol}://${host}`, token) };
}
