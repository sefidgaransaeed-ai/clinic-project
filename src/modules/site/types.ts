/**
 * شکل اطلاعات سایت عمومی، طبق سند مدل داده (بخش ۶ و ۷).
 * نام ستون‌های پایگاه داده snake_case است و اینجا camelCase؛ تبدیل در data.ts انجام می‌شود.
 */

/** یک ردیف از جدول faq_items؛ صفحهٔ تنظیمات پنل همهٔ ستون‌ها را لازم دارد */
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
};

/** پرسشی که سایت نشان می‌دهد. get_public_info() فقط پرسش‌های فعال را، به ترتیب، می‌دهد (W-12) */
export type PublicFaq = {
  question: string;
  answer: string;
};

/**
 * کلیدهای جدول site_info (تصمیم H-6).
 * address و directions در سند هستند، ولی از تصمیم 0011 به بعد نشانی هر مطب در جدول clinics است
 * و سایت آن دو را از site_info نمی‌خواند.
 */
export type SiteInfoKey =
  | "address"
  | "phone"
  | "whatsapp_url"
  | "instagram_url"
  | "doctor_name"
  | "specialty_title"
  | "medical_council_number"
  | "doctor_focus"
  | "about_text"
  | "directions"
  | "logo_url";

/**
 * «کلید خالی» یعنی ردیفش نیست، نه رشتهٔ خالی (H-6). پس هر کلید ممکن است نباشد و هر صفحه باید
 * بی‌خطا جایش را خالی بگذارد (W-11).
 */
export type SiteInfo = Partial<Record<SiteInfoKey, string>>;

/** یک مطب فعال. پزشک در دو مطب کار می‌کند (تصمیم 0011) */
export type Clinic = {
  id: string;
  name: string;
  address: string;
  directions: string | null;
};

/** یک بازهٔ کاری فعال که سایت نشان می‌دهد. شمارهٔ روز: ۰ = شنبه تا ۶ = جمعه */
export type WorkingHours = {
  clinicId: string;
  weekday: number;
  /** "HH:MM:SS" */
  startTime: string;
  endTime: string;
};

/** یک ردیف از جدول working_hours */
export type WorkingHoursRow = WorkingHours & {
  id: string;
  isActive: boolean;
};

/** یک ردیف از جدول closures */
export type Closure = {
  id: string;
  closureDate: string;
  reason: string | null;
};

/** همان چیزی که تابع get_public_info() برمی‌گرداند، با نام‌های camelCase */
export type PublicInfo = {
  faqItems: PublicFaq[];
  siteInfo: SiteInfo;
  clinics: Clinic[];
  workingHours: WorkingHours[];
  /** روزهای تعطیل از امروز به بعد، "YYYY-MM-DD" */
  closures: string[];
};

/**
 * دادهٔ نمونهٔ content.ts، به شکل ردیف‌های جدول. وقتی کلیدهای پایگاه داده نیست، data.ts آن را
 * همان‌طور خلاصه می‌کند که get_public_info() جدول‌ها را خلاصه می‌کند.
 */
export type LocalSiteData = {
  siteInfo: SiteInfo;
  clinics: Clinic[];
  workingHours: WorkingHoursRow[];
  closures: Closure[];
  faqItems: FaqItem[];
};
