import { toLatinDigits, toPersianDigits } from "./dates";

const tomanFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

/** بزرگ‌ترین مبلغی که فرم می‌پذیرد: ۹۹۹ میلیارد تومان */
export const MAX_AMOUNT_TOMAN = 999_999_999_999;

/** ۱۲۵۰۰۰۰ → «۱٬۲۵۰٬۰۰۰»؛ منفی با «−» در ابتدا. برای نمایش با واژهٔ تومان، کامپوننت Toman */
export function formatAmount(amountToman: number): string {
  const digits = tomanFormat.format(Math.abs(amountToman));
  return amountToman < 0 ? `−${digits}` : digits;
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد"];

/** ۰ تا ۹۹۹ به حروف: ۴۵۰ → «چهارصد و پنجاه» */
function threeDigitsInWords(n: number): string {
  const rest = n % 100;
  const parts = [HUNDREDS[Math.floor(n / 100)]];
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else parts.push(TENS[Math.floor(rest / 10)], ONES[rest % 10]);
  return parts.filter(Boolean).join(" و ");
}

/**
 * مبلغ به حروف، مثل روی چک: ۱۲۵۰۰۰۰ → «یک میلیون و دویست و پنجاه هزار تومان».
 * زیر کادر مبلغ می‌آید تا صفر کم یا زیادی پیش از ثبت دیده شود.
 */
export function amountInWords(amountToman: number): string {
  if (amountToman === 0) return "صفر تومان";
  const groups: string[] = [];
  let rest = Math.abs(amountToman);
  for (let scale = 0; rest > 0 && scale < SCALES.length; scale += 1) {
    const group = rest % 1000;
    rest = Math.floor(rest / 1000);
    if (group === 0) continue;
    // «هزار» تنها، نه «یک هزار»؛ ولی «یک میلیون»
    const words = group === 1 && scale === 1 ? "" : threeDigitsInWords(group);
    groups.unshift([words, SCALES[scale]].filter(Boolean).join(" "));
  }
  return `${groups.join(" و ")} تومان`;
}

/**
 * متنی که کاربر در کادر مبلغ تایپ کرده → عدد صحیح تومان.
 * رقم فارسی و جداکننده‌ها را می‌پذیرد؛ هر چیز دیگری را دور می‌ریزد. کادر خالی → null.
 */
export function parseAmount(input: string): number | null {
  const digits = toLatinDigits(input).replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits.slice(0, String(MAX_AMOUNT_TOMAN).length));
}

/** یک رقم اعشار فارسی: ۱۹.۸ → «۱۹٫۸»، ۲۰ → «۲۰» */
const oneDecimal = (value: number) =>
  toPersianDigits(String(Math.round(value * 10) / 10)).replace(".", "٫");

/** مبلغ کوتاه برای جمله‌ها: «۱۹٫۸ میلیون تومان»، «۸۵۰ هزار تومان». جدول‌ها رقم کامل دارند */
export function formatShortAmount(amountToman: number): string {
  const abs = Math.abs(amountToman);
  const sign = amountToman < 0 ? "منفی " : "";
  if (abs >= 1_000_000_000) return `${sign}${oneDecimal(abs / 1_000_000_000)} میلیارد تومان`;
  if (abs >= 1_000_000) return `${sign}${oneDecimal(abs / 1_000_000)} میلیون تومان`;
  if (abs >= 1_000) return `${sign}${toPersianDigits(String(Math.round(abs / 1_000)))} هزار تومان`;
  return `${sign}${toPersianDigits(String(abs))} تومان`;
}
