/**
 * خطای پایگاه داده به پیام فارسی برای کاربر پنل (کار p3-06). جدا از actions.ts است تا بی‌پایگاه
 * داده آزمون شود. فقط شکل خطای PostgREST را لازم دارد: code، message و details.
 */
export type DbErrorLike = { code?: string | null; message?: string | null; details?: string | null };

export function financeErrorMessage(error: DbErrorLike, fallback: string): string {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  // نقض یکتایی reverses_payment_id: هر پرداخت حداکثر یک‌بار معکوس می‌شود
  if (error.code === "23505" && /reverses_payment_id/.test(text)) return "این پرداخت قبلاً معکوس شده است.";
  // یکتایی نام در insurance_types و payment_methods
  if (error.code === "23505") return "این نام در فهرست هست.";
  // trigger و تابع‌های پایگاه داده پیام فارسی خودشان را می‌دهند (raise exception)
  if (error.code === "P0001" && error.message && /[؀-ۿ]/.test(error.message)) return error.message;
  // RLS: کاری که این نقش اجازه‌اش را ندارد
  if (error.code === "42501") return "اجازهٔ این کار را ندارید.";
  return fallback;
}
