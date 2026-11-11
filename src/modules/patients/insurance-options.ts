/**
 * فهرست نوع بیمهٔ فرم مراجع از روی ردیف‌های جدول `insurance_types`. فقط محاسبه است (بدون Supabase)،
 * پس در کامپوننت کلاینت و در آزمون هم کار می‌کند. خواندن جدول در `queries.ts` است.
 */

/** پیش‌فرض فرم مراجع تازه؛ فقط وقتی انتخاب می‌شود که در فهرست فعالِ جدول باشد. */
export const DEFAULT_INSURANCE_TYPE_NAME = "آزاد";

/**
 * نام نوع‌های بیمه را برای فهرست آماده می‌کند: فاصلهٔ دو سر برداشته، نام خالی دور ریخته و نام تکراری یک‌بار نگه داشته می‌شود.
 * فیلتر فعال‌بودن با پرسمان است (`is_active`)؛ ترتیب همان ترتیب ورودی است.
 */
export function activeInsuranceNames(rows: readonly { name: string }[]): string[] {
  const names = rows.map((row) => row.name.trim()).filter((name) => name !== "");
  return [...new Set(names)];
}

/**
 * گزینه‌های فهرست «نوع بیمه» در فرم: نوع‌های فعال، و نوع بیمهٔ فعلیِ مراجع اگر در آن‌ها نبود (مثلاً بعداً غیرفعال شده).
 * بدون این، فرم ویرایش مقدار دیگری را نشان می‌داد و ذخیره بیمهٔ مراجع را عوض می‌کرد. نوع فعلی هرگز دوبار نمی‌آید.
 */
export function buildInsuranceOptions(activeNames: readonly string[], currentName: string): string[] {
  const current = currentName.trim();
  return current === "" || activeNames.includes(current) ? [...activeNames] : [...activeNames, current];
}

/** «آزاد» اگر در فهرست فعال هست، وگرنه خالی (هیچ گزینه‌ای از پیش انتخاب نمی‌شود). */
export function defaultInsuranceName(activeNames: readonly string[]): string {
  return activeNames.includes(DEFAULT_INSURANCE_TYPE_NAME) ? DEFAULT_INSURANCE_TYPE_NAME : "";
}
