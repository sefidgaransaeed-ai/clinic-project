/**
 * توابع مشترک نمایش و اعتبارسنجی.
 *
 * چرا یک‌جا: هر ماژول اگر خودش تاریخ شمسی بسازد، یکی `Asia/Tehran` را
 * می‌گذارد و یکی نمی‌گذارد، و گزارش‌ها با هم نمی‌خوانند.
 *
 * قاعدهٔ پروژه (بخش ۴ CLAUDE.md): زمان در پایگاه داده UTC است و
 * `timestamptz`؛ در نمایش شمسی و به وقت `Asia/Tehran`.
 */

const TEHRAN = 'Asia/Tehran';
const PERSIAN_LOCALE = 'fa-IR-u-ca-persian-nu-latn';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

// ---------------------------------------------------------------- ارقام

/**
 * ارقام فارسی و عربی را به لاتین تبدیل می‌کند و جداکننده‌ها را برمی‌دارد.
 *
 * لازم است چون کاربر فارسی‌زبان با صفحه‌کلید فارسی «۰۹۱۲…» می‌نویسد، و
 * بعضی صفحه‌کلیدها ارقام عربی («٠١٢…») می‌دهند که نقطه‌کد دیگری دارند.
 */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // فارسی
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // عربی
    .replace(/[‌‏\s-]/g, ''); // نیم‌فاصله، علامت راست‌چین، فاصله، خط تیره
}

/** ارقام لاتین را برای نمایش به فارسی تبدیل می‌کند. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

// ----------------------------------------------------------------- مبلغ

/**
 * مبلغ را به تومان با جداکننده هزارگان و ارقام فارسی نشان می‌دهد.
 *
 * ورودی **عدد صحیح تومان** است، نه ریال و نه اعشاری (بخش ۴ CLAUDE.md).
 * مبلغ منفی برای ردیف معکوس به‌کار می‌رود و علامتش حفظ می‌شود.
 */
export function formatToman(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error('مبلغ باید یک عدد باشد.');
  }
  if (!Number.isInteger(amount)) {
    throw new Error('مبلغ باید عدد صحیح باشد؛ تومان اعشار ندارد.');
  }

  const sign = amount < 0 ? '−' : '';
  const grouped = Math.abs(amount).toLocaleString('en-US');
  return `${sign}${toPersianDigits(grouped)} تومان`;
}

// ---------------------------------------------------------------- تاریخ

function toDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('تاریخ نامعتبر است.');
  }
  return date;
}

/** تاریخ شمسی به شکل «۱۴۰۵/۰۸/۰۴» به وقت تهران. */
export function formatJalaliDate(value: Date | string): string {
  const parts = new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    timeZone: TEHRAN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value));

  return toPersianDigits(parts);
}

/** تاریخ شمسی با نام ماه، به شکل «۴ آبان ۱۴۰۵». */
export function formatJalaliDateLong(value: Date | string): string {
  const parts = new Intl.DateTimeFormat(PERSIAN_LOCALE, {
    timeZone: TEHRAN,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(toDate(value));

  return toPersianDigits(parts);
}

/** ساعت به وقت تهران، به شکل «۱۱:۳۰». */
export function formatTehranTime(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    timeZone: TEHRAN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(value));

  return toPersianDigits(parts);
}

/** تاریخ و ساعت با هم، به شکل «۴ آبان ۱۴۰۵، ساعت ۱۱:۳۰». */
export function formatJalaliDateTime(value: Date | string): string {
  return `${formatJalaliDateLong(value)}، ساعت ${formatTehranTime(value)}`;
}

/**
 * تاریخ روز به وقت تهران، به شکل `YYYY-MM-DD` میلادی.
 *
 * برای فرستادن به توابع پایگاه داده که ورودی `date` می‌گیرند — مثل
 * `available_slots(day)` و `finance_report(from, to)`. مرز روز باید به وقت
 * تهران حساب شود، نه UTC (تصمیم `H-12`): ساعت ۰۱:۰۰ بامداد تهران در UTC
 * هنوز روز قبل است.
 */
export function toTehranDateString(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toDate(value));

  return parts; // en-CA خروجی YYYY-MM-DD می‌دهد
}

// ----------------------------------------------------------- اعتبارسنجی

/**
 * شمارهٔ موبایل ایران را به شکل یکدست `09xxxxxxxxx` برمی‌گرداند، یا `null`
 * اگر معتبر نباشد.
 *
 * شکل‌هایی که پذیرفته می‌شوند: `09123456789` ، `9123456789` ،
 * `+989123456789` ، `00989123456789` ، `989123456789` — و همه با ارقام
 * فارسی یا عربی.
 */
export function normalizeIranMobile(input: string): string | null {
  let value = normalizeDigits(input).replace(/^\+/, '');

  if (value.startsWith('0098')) value = value.slice(4);
  else if (value.startsWith('98')) value = value.slice(2);

  if (value.startsWith('9') && value.length === 10) value = `0${value}`;

  return /^09\d{9}$/.test(value) ? value : null;
}

/** آیا شمارهٔ موبایل ایران معتبر است. */
export function isValidIranMobile(input: string): boolean {
  return normalizeIranMobile(input) !== null;
}

/**
 * کد ملی ایران را با **رقم کنترل** بررسی می‌کند.
 *
 * ده رقم بودن کافی نیست: `1111111111` ده رقم است ولی کد ملی نیست. ده رقم
 * یکسان عمداً رد می‌شود، چون بعضی‌شان از آزمون رقم کنترل رد می‌شوند و
 * داده‌ای می‌سازند که شبیه کد ملی است ولی نیست.
 */
export function isValidNationalId(input: string): boolean {
  const value = normalizeDigits(input);

  if (!/^\d{10}$/.test(value)) return false;
  if (/^(\d)\1{9}$/.test(value)) return false;

  const check = Number(value[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(value[i]) * (10 - i);
  }

  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}
