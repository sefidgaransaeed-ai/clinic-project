// پیام‌رسان شماره را با پیش‌شمارهٔ کشور می‌فرستد (مثلاً 98912…)؛ پایگاه داده
// قالب ۰۹xxxxxxxxx را می‌خواهد (data-model). غیر از آن null برمی‌گردد.
// جدا از bot-handler است تا data.ts و reminders.ts هم بتوانند از آن بخوانند
// بدون اینکه چرخهٔ import بسازند یا کلاینت مدیریتی را وارد آزمون‌ها کنند.
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national: string;
  if (digits.length === 14 && digits.startsWith("0098")) {
    national = digits.slice(4);
  } else if (digits.length === 12 && digits.startsWith("98")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }
  return /^9\d{9}$/.test(national) ? `0${national}` : null;
}
