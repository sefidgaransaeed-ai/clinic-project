import { describe, expect, it } from "vitest";
import { appointmentHref, doctorIdentity } from "./copy";
import { fromDatabase, fromLocal } from "./public-info";
import type { LocalSiteData } from "./types";

// همه ساختگی‌اند (CLAUDE.md بخش ۶)
const fullRow = {
  faq: [
    { question: "پرسش اول؟", answer: "پاسخ اول." },
    { question: "پرسش دوم؟", answer: "پاسخ دوم." },
  ],
  site_info: {
    phone: "09120000000",
    doctor_name: "دکتر نمونه",
    specialty_title: "متخصص نمونه",
    medical_council_number: "000000",
  },
  clinics: [{ id: "c1", name: "مطب نمونه", address: "خیابان نمونه", directions: null }],
  working_hours: [{ weekday: 0, start_time: "14:00:00", end_time: "18:00:00", clinic_id: "c1" }],
  closures: ["1405-09-01"],
};

describe("fromDatabase — خروجی get_public_info()", () => {
  it("همهٔ بخش‌ها را به نام‌های سایت برمی‌گرداند", () => {
    const info = fromDatabase(fullRow);
    expect(info.faqItems).toEqual(fullRow.faq);
    expect(info.siteInfo.doctor_name).toBe("دکتر نمونه");
    expect(info.clinics).toEqual([
      { id: "c1", name: "مطب نمونه", address: "خیابان نمونه", directions: null },
    ]);
    expect(info.workingHours).toEqual([
      { clinicId: "c1", weekday: 0, startTime: "14:00:00", endTime: "18:00:00" },
    ]);
    expect(info.closures).toEqual(["1405-09-01"]);
  });

  it("کلید نداشته، نبوده می‌ماند و خطا نمی‌دهد (W-11)", () => {
    const info = fromDatabase({ site_info: { phone: "09120000000" } });
    expect(info.siteInfo).toEqual({ phone: "09120000000" });
    expect(info.siteInfo.logo_url).toBeUndefined();
    expect(info.faqItems).toEqual([]);
    expect(info.clinics).toEqual([]);
  });

  it("مقدار خالی یا فقط فاصله مثل کلید نبوده است", () => {
    const info = fromDatabase({ site_info: { instagram_url: "  ", phone: "" } });
    expect(info.siteInfo).toEqual({});
  });

  it("ردیف خراب کنار می‌رود و بقیه می‌مانند", () => {
    const info = fromDatabase({
      ...fullRow,
      faq: [{ question: "بی‌پاسخ؟" }, ...fullRow.faq, "متن"],
      // بازهٔ بدون مطب (مثل ردیف‌های seed.sql پیش از تصمیم 0011)
      working_hours: [{ weekday: 1, start_time: "10:00:00", end_time: "12:00:00", clinic_id: null }],
    });
    expect(info.faqItems).toEqual(fullRow.faq);
    expect(info.workingHours).toEqual([]);
  });

  it("خروجی بی‌شکل، سایت خالی ولی سالم می‌دهد", () => {
    expect(fromDatabase(null)).toEqual({
      siteInfo: {},
      clinics: [],
      workingHours: [],
      faqItems: [],
      closures: [],
    });
  });
});

describe("fromLocal — دادهٔ نمونه مثل خروجی تابع خلاصه می‌شود", () => {
  const local: LocalSiteData = {
    siteInfo: {},
    clinics: [],
    workingHours: [
      { id: "b", clinicId: "c1", weekday: 4, startTime: "14:00:00", endTime: "18:00:00", isActive: true },
      { id: "a", clinicId: "c1", weekday: 1, startTime: "15:00:00", endTime: "19:00:00", isActive: true },
      { id: "x", clinicId: "c1", weekday: 2, startTime: "09:00:00", endTime: "10:00:00", isActive: false },
    ],
    closures: [],
    faqItems: [
      { id: "2", question: "دوم؟", answer: "۲", keywords: [], sortOrder: 2, isActive: true },
      { id: "3", question: "خاموش؟", answer: "۳", keywords: [], sortOrder: 0, isActive: false },
      { id: "1", question: "اول؟", answer: "۱", keywords: [], sortOrder: 1, isActive: true },
    ],
  };

  it("فقط پرسش‌های فعال، به ترتیب sortOrder (W-12)", () => {
    expect(fromLocal(local).faqItems.map((item) => item.question)).toEqual(["اول؟", "دوم؟"]);
  });

  it("فقط روزهای فعال، به ترتیب روز هفته", () => {
    expect(fromLocal(local).workingHours.map((row) => row.weekday)).toEqual([1, 4]);
  });
});

describe("قاعده‌های نمایش", () => {
  it("نام پزشک بدون عنوان تخصص یا شمارهٔ نظام پزشکی نمی‌آید (W-08)", () => {
    expect(doctorIdentity({ doctor_name: "دکتر نمونه", specialty_title: "متخصص نمونه" })).toBeNull();
    expect(doctorIdentity({ doctor_name: "دکتر نمونه", medical_council_number: "123" })).toBeNull();
    expect(
      doctorIdentity({
        doctor_name: "دکتر نمونه",
        specialty_title: "متخصص نمونه",
        medical_council_number: "123",
      }),
    ).toEqual({ name: "دکتر نمونه", title: "متخصص نمونه", council: "۱۲۳" });
  });

  it("پس از فعال‌شدن فرم عمومی نوبت (p2-08)، دکمه‌ها به /nobat می‌روند", () => {
    expect(appointmentHref(undefined)).toBe("/nobat");
    expect(appointmentHref("09120000000")).toBe("/nobat");
  });
});
