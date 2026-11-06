import type { Patient } from "./types";

/** نتیجه پیدا کردن مراجع برای یک درخواست نوبت */
export type PatientMatch =
  | { kind: "match"; patient: Patient } // کد ملی و نام یکی است؛ خودکار وصل شود
  | { kind: "conflict"; patient: Patient } // کد ملی مال مراجعی با نام دیگر است؛ نه وصل شود نه ساخته شود
  | { kind: "none" }; // کد ملی پیدا نشد؛ مراجع جدید ساخته شود

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی و عربی را به لاتین تبدیل می‌کند. */
export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch);
    return String(p >= 0 ? p : ARABIC_DIGITS.indexOf(ch));
  });
}

/** شماره را به شکل 09xxxxxxxxx درمی‌آورد؛ اگر معتبر نبود رشته خالی برمی‌گرداند. */
export function normalizeMobile(raw: string): string {
  let d = normalizeDigits(raw).replace(/\D/g, "");
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("9")) d = "0" + d;
  return /^09\d{9}$/.test(d) ? d : "";
}

/** نام را یکدست می‌کند: ی/ک عربی، نیم‌فاصله، اعراب و فاصله اضافه. */
export function normalizeName(raw: string): string {
  return raw
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0640]/g, "")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** «محمد رضا» = «محمدرضا» = «رضا محمد» و یک غلط تایپی کوچک هم پذیرفته می‌شود. */
export function namesAreSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  const ka = na.replace(/ /g, "");
  const kb = nb.replace(/ /g, "");
  if (ka === kb) return true;
  const sa = na.split(" ").sort().join("");
  const sb = nb.split(" ").sort().join("");
  if (sa === sb) return true;
  return Math.min(ka.length, kb.length) >= 6 && editDistance(ka, kb) <= 1;
}

/**
 * برای درخواست سایت مراجع قبلی را فقط از روی کد ملی پیدا می‌کند؛ یک کد ملی یعنی یک نفر.
 * نامِ درخواست همیشه نام خودِ مراجع است، حتی وقتی درخواست‌دهنده کس دیگری است.
 * شماره در پیدا کردن یا پیشنهاد مراجع نقشی ندارد.
 */
export function findPatientForRequest(
  requesterName: string,
  requesterNationalId: string | null | undefined,
  patients: Patient[],
): PatientMatch {
  const patient = findPatientByNationalId(requesterNationalId ?? "", patients);
  if (!patient) return { kind: "none" };
  return namesAreSimilar(patient.full_name, requesterName)
    ? { kind: "match", patient }
    : { kind: "conflict", patient };
}

/**
 * اگر کد ملی قبلاً برای مراجع دیگری ثبت شده، همان مراجع را برمی‌گرداند.
 * مراجعِ `exceptPatientId` حساب نمی‌شود؛ مثلاً خودِ مراجعی که پروندهٔ او ویرایش می‌شود.
 */
export function findPatientByNationalId(
  nationalId: string,
  patients: Patient[],
  exceptPatientId?: string,
): Patient | null {
  const nid = normalizeDigits(nationalId).replace(/\D/g, "");
  if (nid.length !== 10) return null;
  return (
    patients.find((p) => p.id !== exceptPatientId && normalizeDigits(p.national_id).replace(/\D/g, "") === nid) ??
    null
  );
}
