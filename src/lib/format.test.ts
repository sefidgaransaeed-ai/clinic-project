import { describe, expect, it } from 'vitest';

import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatTehranTime,
  formatToman,
  isValidIranMobile,
  isValidNationalId,
  normalizeDigits,
  normalizeIranMobile,
  toPersianDigits,
  toTehranDateString,
} from './format';

describe('normalizeDigits', () => {
  it('ارقام فارسی را به لاتین تبدیل می‌کند', () => {
    expect(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('ارقام عربی را هم تبدیل می‌کند', () => {
    expect(normalizeDigits('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
  });

  it('فاصله و خط تیره را برمی‌دارد', () => {
    expect(normalizeDigits('0912 345 6789')).toBe('09123456789');
    expect(normalizeDigits('0912-345-6789')).toBe('09123456789');
  });
});

describe('formatToman', () => {
  it('جداکننده هزارگان و ارقام فارسی می‌گذارد', () => {
    expect(formatToman(3500000)).toBe('۳,۵۰۰,۰۰۰ تومان');
  });

  it('صفر را درست نشان می‌دهد', () => {
    expect(formatToman(0)).toBe('۰ تومان');
  });

  it('مبلغ منفی ردیف معکوس را با علامت نشان می‌دهد', () => {
    expect(formatToman(-3500000)).toBe('−۳,۵۰۰,۰۰۰ تومان');
  });

  it('مبلغ اعشاری را رد می‌کند — تومان اعشار ندارد', () => {
    expect(() => formatToman(1500.5)).toThrow();
  });
});

describe('تاریخ و ساعت به وقت تهران', () => {
  // تهران UTC+03:30 است. این لحظه در UTC ساعت ۲۱:۰۰ روز ۲۵ اکتبر است،
  // ولی به وقت تهران ۰۰:۳۰ بامداد روز ۲۶ اکتبر — یعنی روزش عوض می‌شود.
  const crossesMidnight = '2026-10-25T21:00:00Z';

  it('مرز روز را به وقت تهران حساب می‌کند، نه UTC', () => {
    expect(toTehranDateString(crossesMidnight)).toBe('2026-10-26');
    // اگر منطقه زمانی اعمال نمی‌شد، 2026-10-25 درمی‌آمد
  });

  it('ساعت را به وقت تهران نشان می‌دهد', () => {
    expect(formatTehranTime(crossesMidnight)).toBe('۰۰:۳۰');
  });

  it('تاریخ شمسی را با ارقام فارسی می‌دهد', () => {
    // ۲۶ اکتبر ۲۰۲۶ = ۴ آبان ۱۴۰۵
    expect(formatJalaliDate('2026-10-26T09:00:00Z')).toBe('۱۴۰۵/۰۸/۰۴');
  });

  it('تاریخ و ساعت را با هم می‌دهد', () => {
    expect(formatJalaliDateTime('2026-10-26T07:30:00Z')).toBe('۴ آبان ۱۴۰۵، ساعت ۱۱:۰۰');
  });

  it('تاریخ نامعتبر را رد می‌کند', () => {
    expect(() => formatJalaliDate('نه‌تاریخ')).toThrow();
  });
});

describe('toPersianDigits', () => {
  it('عدد و رشته را هر دو می‌پذیرد', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
    expect(toPersianDigits('۱۴۰۵')).toBe('۱۴۰۵');
  });
});

describe('normalizeIranMobile', () => {
  it('شکل‌های مختلف را یکدست می‌کند', () => {
    expect(normalizeIranMobile('09123456789')).toBe('09123456789');
    expect(normalizeIranMobile('9123456789')).toBe('09123456789');
    expect(normalizeIranMobile('+989123456789')).toBe('09123456789');
    expect(normalizeIranMobile('00989123456789')).toBe('09123456789');
    expect(normalizeIranMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
  });

  it('شماره نامعتبر را null می‌دهد', () => {
    expect(normalizeIranMobile('0812345678')).toBeNull(); // با ۰۹ شروع نمی‌شود
    expect(normalizeIranMobile('0912345678')).toBeNull(); // ده رقم
    expect(normalizeIranMobile('091234567890')).toBeNull(); // دوازده رقم
    expect(normalizeIranMobile('')).toBeNull();
  });

  it('isValidIranMobile با آن می‌خواند', () => {
    expect(isValidIranMobile('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe(true);
    expect(isValidIranMobile('02112345678')).toBe(false);
  });
});

describe('isValidNationalId', () => {
  it('کد ملی با رقم کنترل درست را می‌پذیرد', () => {
    // این دو عدد ساختگی‌اند و رقم کنترلشان با الگوریتم ساخته شده
    expect(isValidNationalId('0499370899')).toBe(true);
    expect(isValidNationalId('0084575948')).toBe(true);
  });

  it('کد ملی با رقم کنترل غلط را رد می‌کند', () => {
    expect(isValidNationalId('0499370898')).toBe(false);
    expect(isValidNationalId('1234567890')).toBe(false);
  });

  it('ده رقم یکسان را رد می‌کند', () => {
    // اینها از آزمون رقم کنترل رد می‌شوند ولی کد ملی نیستند
    expect(isValidNationalId('1111111111')).toBe(false);
    expect(isValidNationalId('0000000000')).toBe(false);
    expect(isValidNationalId('5555555555')).toBe(false);
  });

  it('طول نادرست را رد می‌کند', () => {
    expect(isValidNationalId('049937089')).toBe(false);
    expect(isValidNationalId('04993708990')).toBe(false);
    expect(isValidNationalId('')).toBe(false);
  });

  it('ارقام فارسی را هم می‌پذیرد', () => {
    expect(isValidNationalId('۰۴۹۹۳۷۰۸۹۹')).toBe(true);
  });
});
