import { describe, expect, it } from "vitest";
import {
  MAX_MATCHES,
  contentWords,
  looksMedical,
  matchFaq,
  normalizePersian,
  type FaqSource,
} from "./match";

// همهٔ پرسش‌ها ساختگی‌اند (CLAUDE.md بخش ۶)
const FAQS: FaqSource[] = [
  {
    question: "برای گرفتن نوبت چه کار کنم؟",
    answer: "با شمارهٔ مطب تماس بگیرید یا فرم نوبت را در سایت پر کنید.",
    keywords: ["نوبت", "رزرو", "وقت گرفتن"],
  },
  {
    question: "ساعات کاری مطب چه زمانی است؟",
    answer: "شنبه تا چهارشنبه از ساعت نه تا هفده.",
    keywords: ["ساعت کاری", "ساعات", "باز است"],
  },
  {
    question: "آیا بیمه قبول می‌شود؟",
    answer: "بیمه‌های تکمیلی پذیرفته می‌شوند؛ جزئیات را تلفنی بپرسید.",
    keywords: ["بیمه", "تکمیلی"],
  },
  {
    question: "هزینه ویزیت چقدر است؟",
    answer: "هزینه به نوع ویزیت بستگی دارد؛ هنگام تماس اعلام می‌شود.",
    keywords: ["هزینه", "قیمت", "تعرفه"],
  },
  {
    question: "آدرس مطب کجاست؟",
    answer: "نشانی کامل در صفحهٔ تماس سایت آمده است.",
    keywords: ["آدرس", "کجا", "نشانی"],
  },
  {
    question: "نوبتم را چطور لغو کنم؟",
    answer: "دست‌کم یک روز پیش از نوبت با مطب تماس بگیرید.",
    keywords: ["لغو", "کنسل", "باطل"],
  },
  {
    question: "آیا فیزیوتراپی هم انجام می‌شود؟",
    answer: "بله، جلسات فیزیوتراپی در مطب برگزار می‌شود.",
    keywords: ["فیزیوتراپی", "توان‌بخشی"],
  },
  {
    question: "چقدر زودتر باید برسم؟",
    answer: "یک ربع پیش از ساعت نوبت در مطب باشید.",
    keywords: ["زودتر", "چه موقع برسم"],
  },
];

describe("normalizePersian", () => {
  it("ي و ك عربی را به فارسی برمی‌گرداند", () => {
    expect(normalizePersian("علي")).toBe(normalizePersian("علی"));
    expect(normalizePersian("كمك")).toBe(normalizePersian("کمک"));
  });

  it("ارقام فارسی و عربی را به لاتین برمی‌گرداند", () => {
    expect(normalizePersian("ساعت ۹ تا ۱۷")).toBe("ساعت 9 تا 17");
    expect(normalizePersian("ساعت ٩ تا ١٧")).toBe("ساعت 9 تا 17");
  });

  it("نیم‌فاصله و فاصلهٔ اضافه را یکی می‌کند", () => {
    expect(normalizePersian("می‌روم")).toBe(normalizePersian("می روم"));
    expect(normalizePersian("الف    ب")).toBe("الف ب");
  });

  it("علائم را حذف می‌کند", () => {
    expect(normalizePersian("بیمه؟!")).toBe("بیمه");
  });
});

describe("contentWords", () => {
  it("واژه‌های عمومی و تک‌حرفی را می‌اندازد", () => {
    expect(contentWords("برای گرفتن نوبت چه کار کنم")).toEqual(["گرفتن", "نوبت", "کار", "کنم"]);
  });
});

describe("matchFaq — ده نمونهٔ راهنما با املاهای مختلف", () => {
  it("۱. نوبت با املای ساده", () => {
    const [first] = matchFaq("چطور نوبت بگیرم؟", FAQS);
    expect(first?.item.question).toContain("نوبت");
  });

  it("۲. نوبت با ي عربی", () => {
    const [first] = matchFaq("چطور نوبت بگيرم؟", FAQS);
    expect(first?.item.question).toContain("نوبت");
  });

  it("۳. نوبت با ک عربی", () => {
    const [first] = matchFaq("برای نوبت چي كار كنم", FAQS);
    expect(first?.item.question).toContain("نوبت");
  });

  it("۴. ساعات کاری با نیم‌فاصله", () => {
    const [first] = matchFaq("ساعات‌کاری مطب چه موقع است", FAQS);
    expect(first?.item.question).toContain("ساعات کاری");
  });

  it("۵. ساعات کاری با ارقام و علائم", () => {
    const [first] = matchFaq("مطب کی بازه؟ ساعت کاری؟", FAQS);
    expect(first?.item.question).toContain("ساعات کاری");
  });

  it("۶. بیمه", () => {
    const [first] = matchFaq("بیمه تکمیلی قبول می‌کنید؟", FAQS);
    expect(first?.item.question).toContain("بیمه");
  });

  it("۷. هزینه با املای قیمت", () => {
    const [first] = matchFaq("قیمت ویزیت چنده", FAQS);
    expect(first?.item.question).toContain("هزینه");
  });

  it("۸. آدرس", () => {
    const [first] = matchFaq("مطب کجاست؟ آدرسشو می‌دید؟", FAQS);
    expect(first?.item.question).toContain("آدرس");
  });

  it("۹. لغو نوبت", () => {
    const [first] = matchFaq("می‌خوام نوبتمو کنسل کنم", FAQS);
    expect(first?.item.question).toContain("لغو");
  });

  it("۱۰. فیزیوتراپی", () => {
    const [first] = matchFaq("فیزیوتراپی دارید؟", FAQS);
    expect(first?.item.question).toContain("فیزیوتراپی");
  });
});

describe("matchFaq — رفتار عمومی", () => {
  it("برای پرسش بی‌ربط چیزی برنمی‌گرداند", () => {
    expect(matchFaq("امروز هوا چطور است", FAQS)).toEqual([]);
  });

  it("متن خالی چیزی برنمی‌گرداند", () => {
    expect(matchFaq("", FAQS)).toEqual([]);
    expect(matchFaq("   ؟!  ", FAQS)).toEqual([]);
  });

  it("بیشتر از MAX_MATCHES برنمی‌گرداند", () => {
    const results = matchFaq("نوبت بیمه هزینه آدرس ساعت", FAQS, { minScore: 0 });
    expect(results.length).toBeLessThanOrEqual(MAX_MATCHES);
  });

  it("نتایج بر اساس امتیاز نزولی مرتب‌اند", () => {
    const results = matchFaq("نوبت بگیرم", FAQS, { minScore: 0 });
    const scores = results.map((r) => r.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("فهرست خالی ورودی چیزی برنمی‌گرداند", () => {
    expect(matchFaq("نوبت", [])).toEqual([]);
  });
});

describe("looksMedical", () => {
  it("پرسش دربارهٔ دارو را درمانی می‌شناسد", () => {
    expect(looksMedical("چه دارویی برای کمر درد بخورم؟")).toBe(true);
  });

  it("پرسش دربارهٔ تشخیص را درمانی می‌شناسد", () => {
    expect(looksMedical("تشخیص بیماری من چیه؟")).toBe(true);
  });

  it("پرسش عمومی مطب را درمانی نمی‌شناسد", () => {
    expect(looksMedical("ساعت کاری مطب چند است؟")).toBe(false);
    expect(looksMedical("آدرس مطب کجاست")).toBe(false);
  });
});
