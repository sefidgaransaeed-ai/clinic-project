import { describe, expect, it } from "vitest";
import {
  cleanDraft,
  countChanges,
  draftFrom,
  missingForName,
  validateDraft,
  type SettingsDraft,
} from "./settings-rules";

// همه ساختگی‌اند (CLAUDE.md بخش ۶)
const base: SettingsDraft = draftFrom(
  {
    doctor_name: "دکتر نمونه",
    specialty_title: "متخصص نمونه",
    medical_council_number: "123456",
    phone: "09120000000",
    whatsapp_url: "https://wa.me/989120000000",
  },
  [{ id: "c1", name: "مطب نمونه", address: "خیابان نمونه", directions: null }],
  [
    { id: "f2", question: "دوم؟", answer: "پاسخ دوم.", keywords: ["دو"], sortOrder: 2, isActive: true },
    { id: "f1", question: "اول؟", answer: "پاسخ اول.", keywords: ["یک"], sortOrder: 1, isActive: true },
  ],
);

const withInfo = (patch: Partial<SettingsDraft["siteInfo"]>): SettingsDraft => ({
  ...base,
  siteInfo: { ...base.siteInfo, ...patch },
});

describe("draftFrom", () => {
  it("کلید نداشته خانهٔ خالی است و پرسش‌ها به ترتیب sortOrder", () => {
    expect(base.siteInfo.instagram_url).toBe("");
    expect(base.siteInfo.about_text).toBe("");
    expect(base.faqItems.map((item) => item.id)).toEqual(["f1", "f2"]);
    expect(base.clinics[0].directions).toBe("");
  });
});

describe("cleanDraft", () => {
  it("رقم فارسی و خط تیره در تلفن و شماره به رقم لاتین", () => {
    const clean = cleanDraft(withInfo({ phone: "۰۹۱۲-۰۰۰-۰۰۰۰", medical_council_number: "۱۲۳۴۵۶" }));
    expect(clean.siteInfo.phone).toBe("09120000000");
    expect(clean.siteInfo.medical_council_number).toBe("123456");
  });

  it("لینک بدون پروتکل https می‌گیرد", () => {
    const clean = cleanDraft(withInfo({ whatsapp_url: "wa.me/989120000000", instagram_url: " instagram.com/x " }));
    expect(clean.siteInfo.whatsapp_url).toBe("https://wa.me/989120000000");
    expect(clean.siteInfo.instagram_url).toBe("https://instagram.com/x");
  });

  it("فاصلهٔ اضافه برداشته می‌شود ولی پاراگراف‌های متن معرفی می‌مانند", () => {
    const clean = cleanDraft(withInfo({ doctor_name: "  دکتر   نمونه ", about_text: "اول.\n\n\n\nدوم.  " }));
    expect(clean.siteInfo.doctor_name).toBe("دکتر نمونه");
    expect(clean.siteInfo.about_text).toBe("اول.\n\nدوم.");
  });

  it("کلیدواژهٔ تکراری و خالی کنار می‌رود", () => {
    const draft = { ...base, faqItems: [{ ...base.faqItems[0], keywords: ["درد", " درد ", "", "تزریق"] }] };
    expect(cleanDraft(draft).faqItems[0].keywords).toEqual(["درد", "تزریق"]);
  });
});

describe("validateDraft", () => {
  it("پیش‌نویس درست خطایی ندارد", () => {
    expect(validateDraft(cleanDraft(base))).toEqual({});
  });

  it("خانهٔ خالی خطا نیست؛ یعنی آن تکه در سایت نمی‌آید (H-6)", () => {
    const empty = withInfo({ phone: "", whatsapp_url: "", doctor_name: "", medical_council_number: "" });
    expect(validateDraft(cleanDraft(empty))).toEqual({});
  });

  it("تلفن و شمارهٔ نادرست", () => {
    const errors = validateDraft(cleanDraft(withInfo({ phone: "12345", medical_council_number: "۱۲الف" })));
    expect(errors.phone).toBeTruthy();
    expect(errors.medical_council_number).toBeTruthy();
  });

  it("لینکی که نشانی وب نیست", () => {
    const errors = validateDraft(cleanDraft(withInfo({ instagram_url: "javascript:alert(1)" })));
    expect(errors.instagram_url).toBeTruthy();
  });

  it("نشانی لوگو می‌تواند مسیر خود سایت باشد", () => {
    expect(validateDraft(cleanDraft(withInfo({ logo_url: "/logo.png" })))).toEqual({});
  });

  it("مطب بی‌نام یا بی‌نشانی، و دو مطب هم‌نام", () => {
    const draft: SettingsDraft = {
      ...base,
      clinics: [
        { id: "c1", name: "مطب نمونه", address: "", directions: "" },
        { id: "c2", name: "مطب نمونه", address: "خیابان دیگر", directions: "" },
      ],
    };
    const errors = validateDraft(cleanDraft(draft));
    expect(errors["clinic:c1:address"]).toBeTruthy();
    expect(errors["clinic:c2:name"]).toBeTruthy();
  });

  it("پرسش بی‌پاسخ و پرسش تکراری", () => {
    const draft: SettingsDraft = {
      ...base,
      faqItems: [
        ...base.faqItems,
        { id: null, key: "new-1", question: "اول؟", answer: "", keywords: [], isActive: true },
      ],
    };
    const errors = validateDraft(cleanDraft(draft));
    expect(errors["faq:new-1:question"]).toBeTruthy();
    expect(errors["faq:new-1:answer"]).toBeTruthy();
  });
});

describe("missingForName — نام بدون تخصص و شماره دیده نمی‌شود (W-08)", () => {
  it("هشدار فقط وقتی نام نوشته شده", () => {
    expect(missingForName(base.siteInfo)).toEqual([]);
    expect(missingForName(withInfo({ specialty_title: "" }).siteInfo)).toEqual(["عنوان تخصص"]);
    expect(missingForName(withInfo({ doctor_name: "", specialty_title: "" }).siteInfo)).toEqual([]);
  });
});

describe("countChanges", () => {
  it("بی‌تغییر صفر است، حتی با فاصلهٔ اضافه یا رقم فارسی", () => {
    expect(countChanges(base, base)).toBe(0);
    expect(countChanges(base, withInfo({ phone: "۰۹۱۲۰۰۰۰۰۰۰", doctor_name: "دکتر نمونه " }))).toBe(0);
  });

  it("هر خانه، هر پرسش و جابه‌جایی ترتیب یکی شمرده می‌شود", () => {
    const [first, second] = base.faqItems;
    const draft: SettingsDraft = {
      ...withInfo({ instagram_url: "instagram.com/x" }),
      faqItems: [second, { ...first, isActive: false }],
    };
    // اینستاگرام + خاموش شدن پرسش اول + جابه‌جایی ترتیب
    expect(countChanges(base, draft)).toBe(3);
  });

  it("پرسش تازه یک تغییر است", () => {
    const draft: SettingsDraft = {
      ...base,
      faqItems: [
        ...base.faqItems,
        { id: null, key: "new-1", question: "تازه؟", answer: "پاسخ.", keywords: [], isActive: true },
      ],
    };
    expect(countChanges(base, draft)).toBe(1);
  });
});
