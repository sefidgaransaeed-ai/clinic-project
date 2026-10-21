import type { Patient } from "./types";

/** نتیجه پیدا کردن مراجع برای یک درخواست نوبت */
export type PatientMatch =
  | { kind: "match"; patient: Patient } // خودکار وصل شود
  | { kind: "choose"; candidates: Patient[] } // منشی با یک کلیک انتخاب کند
  | { kind: "none" }; // مراجع جدید ساخته شود

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ارقام فارسی و عربی را به لاتین تبدیل می‌کند. */
export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch);
    return String(p >= 0 ? p : ARABIC_DIGITS.indexOf(ch));
  });
}

/** موبایل را به شکل 09xxxxxxxxx درمی‌آورد؛ اگر معتبر نبود رشته خالی برمی‌گرداند. */
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

/** برای درخواست سایت (فقط نام و موبایل) مراجع قبلی را پیدا می‌کند. */
export function findPatientForRequest(
  requesterName: string,
  requesterMobile: string,
  patients: Patient[],
): PatientMatch {
  const mobile = normalizeMobile(requesterMobile);
  if (!mobile) return { kind: "none" };

  const sameMobile = patients.filter((p) => normalizeMobile(p.mobile) === mobile);
  if (sameMobile.length === 0) return { kind: "none" };

  const similar = sameMobile.filter((p) => namesAreSimilar(p.full_name, requesterName));
  if (similar.length === 1) return { kind: "match", patient: similar[0] };
  if (similar.length > 1) return { kind: "choose", candidates: similar };
  return { kind: "choose", candidates: sameMobile };
}

/** اگر کد ملی قبلاً برای مراجع دیگری ثبت شده، همان مراجع را برمی‌گرداند. */
export function findPatientByNationalId(
  nationalId: string,
  patients: Patient[],
): Patient | null {
  const nid = normalizeDigits(nationalId).replace(/\D/g, "");
  if (nid.length !== 10) return null;
  return (
    patients.find((p) => normalizeDigits(p.national_id).replace(/\D/g, "") === nid) ??
    null
  );
}
