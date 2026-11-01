/**
 * شکل اطلاعات سایت عمومی، طبق سند مدل داده (بخش ۵ و ۷).
 * نام ستون‌های پایگاه داده snake_case است و اینجا camelCase؛ تبدیل در data.ts انجام می‌شود.
 */

/** یک ردیف از جدول faq_items */
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
};

/**
 * کلیدهای جدول site_info.
 * چهار کلید اول در سند مدل داده آمده‌اند. بقیه پیشنهاد این ماژول‌اند و باید به سند اضافه شوند.
 * نام سه کلید اطلاعات پزشک همان نام‌های تصمیم 0007 است.
 */
export type SiteInfoKey =
  | "address"
  | "phone"
  | "whatsapp_url"
  | "instagram_url"
  // پیشنهادی — هنوز در سند مدل داده نیستند
  | "doctor_name"
  | "specialty_title"
  | "doctor_focus"
  | "medical_council_number"
  | "directions"
  // نشانی فایل لوگو؛ خالی یعنی هنوز لوگویی ثبت نشده و جای خالی نشان داده می‌شود
  | "logo_url";

export type SiteInfo = Record<SiteInfoKey, string>;

/**
 * یک مطب. پیشنهاد این ماژول — مدل داده فعلاً فقط یک مطب دارد (یک address در site_info)،
 * ولی پزشک در دو مطب کار می‌کند.
 */
export type Clinic = {
  id: string;
  name: string;
  address: string;
  directions: string | null;
};

/**
 * یک ردیف از جدول working_hours. شمارهٔ روز: ۰ = شنبه تا ۶ = جمعه.
 * clinicId پیشنهادی است و در مدل داده نیست: هر بازه مال کدام مطب است.
 */
export type WorkingHours = {
  id: string;
  clinicId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

/** یک ردیف از جدول closures */
export type Closure = {
  id: string;
  closureDate: string;
  reason: string | null;
};

/** همان چیزی که تابع get_public_info() برمی‌گرداند */
export type PublicInfo = {
  faqItems: FaqItem[];
  siteInfo: SiteInfo;
  // پیشنهادی — get_public_info() فعلاً مطب‌ها را برنمی‌گرداند
  clinics: Clinic[];
  workingHours: WorkingHours[];
  closures: Closure[];
};
