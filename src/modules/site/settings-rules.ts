import { normalizeDigits } from "@/lib/format";
import type { Clinic, FaqItem, SiteInfo, SiteInfoKey } from "./types";

/**
 * قاعده‌های صفحهٔ «تنظیمات سایت» (کار p3-13): شکل پیش‌نویس، پاک‌سازی، بررسی و شمارش تغییرها.
 * جدا از صفحه و action است تا هم در مرورگر (پیام کنار خانه) و هم روی سرور (پیش از نوشتن)
 * همین یک قاعده اجرا شود، و بدون پایگاه داده آزمون شود.
 */

/** کلیدهایی که این صفحه می‌نویسد. address و directions از تصمیم 0011 در جدول clinics هستند */
export const EDITABLE_KEYS = [
  "doctor_name",
  "specialty_title",
  "medical_council_number",
  "doctor_focus",
  "phone",
  "whatsapp_url",
  "instagram_url",
  "logo_url",
  "about_text",
] as const satisfies readonly SiteInfoKey[];

export type EditableKey = (typeof EDITABLE_KEYS)[number];

export const KEY_LABELS: Record<EditableKey, string> = {
  doctor_name: "نام پزشک",
  specialty_title: "عنوان تخصص",
  medical_council_number: "شمارهٔ نظام پزشکی",
  doctor_focus: "حوزهٔ تخصصی",
  phone: "تلفن",
  whatsapp_url: "لینک واتس‌اپ",
  instagram_url: "لینک اینستاگرام",
  logo_url: "نشانی لوگو",
  about_text: "متن معرفی",
};

export type ClinicDraft = { id: string; name: string; address: string; directions: string };

export type FaqDraft = {
  /** null یعنی پرسش تازه که هنوز ذخیره نشده */
  id: string | null;
  /** کلید پایدار برای فهرست و پیام‌های خطا؛ برای پرسش ذخیره‌شده همان id است */
  key: string;
  question: string;
  answer: string;
  keywords: string[];
  isActive: boolean;
};

export type SettingsDraft = {
  siteInfo: Record<EditableKey, string>;
  clinics: ClinicDraft[];
  /** به ترتیبی که در سایت دیده می‌شوند */
  faqItems: FaqDraft[];
};

/** پیام خطا برای هر خانه؛ کلید: "phone"، "clinic:<id>:name"، "faq:<key>:question" و مانند این‌ها */
export type SettingsErrors = Record<string, string>;

export const LIMITS = {
  shortText: 80,
  aboutText: 3000,
  clinicName: 60,
  address: 300,
  question: 200,
  answer: 1500,
  keyword: 30,
  keywords: 12,
} as const;

export function draftFrom(siteInfo: SiteInfo, clinics: Clinic[], faqItems: FaqItem[]): SettingsDraft {
  const info = Object.fromEntries(EDITABLE_KEYS.map((key) => [key, siteInfo[key] ?? ""])) as Record<
    EditableKey,
    string
  >;
  return {
    siteInfo: info,
    clinics: clinics.map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      address: clinic.address,
      directions: clinic.directions ?? "",
    })),
    faqItems: [...faqItems]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        key: item.id,
        question: item.question,
        answer: item.answer,
        keywords: item.keywords,
        isActive: item.isActive,
      })),
  };
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();
const paragraphs = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** «wa.me/98…» → «https://wa.me/98…»؛ نشانی بدون پروتکل رایج است */
function withHttps(value: string): string {
  const clean = value.trim();
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("/")) return clean;
  return `https://${clean}`;
}

/** همان پیش‌نویس، تمیز: فاصله‌های اضافه، رقم‌های فارسی در تلفن و شماره، و https برای لینک‌ها */
export function cleanDraft(draft: SettingsDraft): SettingsDraft {
  const info = { ...draft.siteInfo };
  for (const key of EDITABLE_KEYS) info[key] = oneLine(info[key] ?? "");
  info.about_text = paragraphs(draft.siteInfo.about_text ?? "");
  info.phone = normalizeDigits(info.phone);
  info.medical_council_number = normalizeDigits(info.medical_council_number);
  info.whatsapp_url = withHttps(info.whatsapp_url);
  info.instagram_url = withHttps(info.instagram_url);
  info.logo_url = withHttps(info.logo_url);

  return {
    siteInfo: info,
    clinics: draft.clinics.map((clinic) => ({
      ...clinic,
      name: oneLine(clinic.name),
      address: oneLine(clinic.address),
      directions: oneLine(clinic.directions),
    })),
    faqItems: draft.faqItems.map((item) => ({
      ...item,
      question: oneLine(item.question),
      answer: paragraphs(item.answer),
      keywords: cleanKeywords(item.keywords),
    })),
  };
}

/** کلیدواژه‌ها: بی‌فاصلهٔ اضافه، بی‌تکرار، بی‌خالی */
export function cleanKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const keyword of keywords) {
    const clean = oneLine(keyword);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

const isHttpsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
};

const tooLong = (value: string, max: number) =>
  value.length > max ? `حداکثر ${max.toLocaleString("fa-IR")} حرف.` : null;

/** پیش‌نویس تمیزشده را بررسی می‌کند؛ خانهٔ خالی خطا نیست، یعنی آن تکه در سایت نمی‌آید (H-6) */
export function validateDraft(draft: SettingsDraft): SettingsErrors {
  const errors: SettingsErrors = {};
  const info = draft.siteInfo;
  const set = (key: string, message: string | null) => {
    if (message && !errors[key]) errors[key] = message;
  };

  for (const key of ["doctor_name", "specialty_title", "doctor_focus"] as const) {
    set(key, tooLong(info[key], LIMITS.shortText));
  }
  if (info.phone && !/^0\d{10}$/.test(info.phone)) {
    set("phone", "شمارهٔ یازده‌رقمی که با ۰ شروع می‌شود، مثل ۰۹۱۲۰۰۰۰۰۰۰.");
  }
  if (info.medical_council_number && !/^\d{3,8}$/.test(info.medical_council_number)) {
    set("medical_council_number", "فقط رقم.");
  }
  for (const key of ["whatsapp_url", "instagram_url"] as const) {
    if (info[key] && !isHttpsUrl(info[key])) set(key, "یک نشانی کامل، مثل https://wa.me/989120000000.");
  }
  if (info.logo_url && !info.logo_url.startsWith("/") && !isHttpsUrl(info.logo_url)) {
    set("logo_url", "نشانی کامل فایل لوگو، که با https:// شروع شود.");
  }
  set("about_text", tooLong(info.about_text, LIMITS.aboutText));

  const clinicNames = new Set<string>();
  for (const clinic of draft.clinics) {
    const at = (field: string) => `clinic:${clinic.id}:${field}`;
    if (!clinic.name) set(at("name"), "نام مطب را بنویسید.");
    else if (clinicNames.has(clinic.name)) set(at("name"), "نام دو مطب نباید یکی باشد.");
    clinicNames.add(clinic.name);
    set(at("name"), tooLong(clinic.name, LIMITS.clinicName));
    if (!clinic.address) set(at("address"), "نشانی مطب را بنویسید.");
    set(at("address"), tooLong(clinic.address, LIMITS.address));
    set(at("directions"), tooLong(clinic.directions, LIMITS.address));
  }

  const questions = new Set<string>();
  for (const item of draft.faqItems) {
    const at = (field: string) => `faq:${item.key}:${field}`;
    if (!item.question) set(at("question"), "پرسش را بنویسید.");
    else if (questions.has(item.question)) set(at("question"), "این پرسش در فهرست هست.");
    questions.add(item.question);
    set(at("question"), tooLong(item.question, LIMITS.question));
    if (!item.answer) set(at("answer"), "پاسخ را بنویسید.");
    set(at("answer"), tooLong(item.answer, LIMITS.answer));
    if (item.keywords.length > LIMITS.keywords) {
      set(at("keywords"), `حداکثر ${LIMITS.keywords.toLocaleString("fa-IR")} کلیدواژه.`);
    }
    if (item.keywords.some((keyword) => keyword.length > LIMITS.keyword)) {
      set(at("keywords"), `هر کلیدواژه حداکثر ${LIMITS.keyword.toLocaleString("fa-IR")} حرف.`);
    }
  }

  return errors;
}

/**
 * اگر نام پزشک نوشته شده ولی عنوان تخصص یا شمارهٔ نظام پزشکی نه، نام در سایت دیده نمی‌شود
 * (مادهٔ ۲۰، W-08). نام خانه‌های جاافتاده را برای هشدار برمی‌گرداند؛ خطا نیست و ذخیره را نمی‌بندد.
 */
export function missingForName(info: Record<EditableKey, string>): string[] {
  if (!info.doctor_name.trim()) return [];
  const missing: string[] = [];
  if (!info.specialty_title.trim()) missing.push(KEY_LABELS.specialty_title);
  if (!info.medical_council_number.trim()) missing.push(KEY_LABELS.medical_council_number);
  return missing;
}

/** چند تغییر ذخیره نشده است؛ هر خانه، هر مطب، هر پرسش و جابه‌جایی ترتیب، هر کدام یکی */
export function countChanges(saved: SettingsDraft, draft: SettingsDraft): number {
  const a = cleanDraft(saved);
  const b = cleanDraft(draft);
  let count = EDITABLE_KEYS.filter((key) => a.siteInfo[key] !== b.siteInfo[key]).length;

  for (const clinic of b.clinics) {
    const before = a.clinics.find((item) => item.id === clinic.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(clinic)) count += 1;
  }

  const savedByKey = new Map(a.faqItems.map((item) => [item.key, item]));
  for (const item of b.faqItems) {
    const before = savedByKey.get(item.key);
    if (
      !before ||
      before.question !== item.question ||
      before.answer !== item.answer ||
      before.isActive !== item.isActive ||
      before.keywords.join("،") !== item.keywords.join("،")
    ) {
      count += 1;
    }
  }
  const order = (draftItems: FaqDraft[]) =>
    draftItems.filter((item) => savedByKey.has(item.key)).map((item) => item.key).join(",");
  if (order(a.faqItems) !== order(b.faqItems)) count += 1;

  return count;
}
