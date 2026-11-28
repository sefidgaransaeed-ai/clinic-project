import { describe, expect, it } from "vitest";

import { answerForClinic, fillFaqAnswer, fillFaqItems } from "./faq-fill";
import type { PublicInfo } from "./types";

// همه ساختگی‌اند (CLAUDE.md بخش ۶)
const info: PublicInfo = {
  siteInfo: { phone: "09380000000" },
  clinics: [
    { id: "c1", name: "مطب الف", address: "خیابان الف، پلاک ۱", directions: "جنب متروی الف" },
    { id: "c2", name: "مطب ب", address: "خیابان ب، پلاک ۲", directions: null },
  ],
  workingHours: [
    { clinicId: "c1", weekday: 0, startTime: "14:00:00", endTime: "18:00:00" },
    { clinicId: "c1", weekday: 3, startTime: "14:00:00", endTime: "18:00:00" },
    { clinicId: "c2", weekday: 1, startTime: "15:30:00", endTime: "19:00:00" },
  ],
  faqItems: [],
  closures: [],
};

const empty: PublicInfo = { siteInfo: {}, clinics: [], workingHours: [], faqItems: [], closures: [] };

describe("fillFaqAnswer", () => {
  it("شمارهٔ تلفن را با رقم فارسی می‌گذارد", () => {
    expect(fillFaqAnswer("تماس: {{phone}}", info)).toBe("تماس: ۰۹۳۸-۰۰۰-۰۰۰۰");
  });

  it("ساعت کاری هر مطب را با روزها می‌گذارد", () => {
    const text = fillFaqAnswer("{{hours}}", info);
    expect(text).toContain("مطب الف: شنبه و سه‌شنبه، ۱۴:۰۰ تا ۱۸:۰۰");
    expect(text).toContain("مطب ب: یکشنبه، ۱۵:۳۰ تا ۱۹:۰۰");
  });

  it("نشانی و راه رسیدن را می‌گذارد", () => {
    const text = fillFaqAnswer("{{addresses}}", info);
    expect(text).toContain("مطب الف: خیابان الف، پلاک ۱ (جنب متروی الف)");
    expect(text).toContain("مطب ب: خیابان ب، پلاک ۲");
  });

  it("دو راه نوبت را با شمارهٔ واقعی می‌گوید", () => {
    const text = fillFaqAnswer("{{booking}}", info);
    expect(text).toContain("۰۹۳۸-۰۰۰-۰۰۰۰");
    expect(text).toContain("نوبت");
  });

  it("اگر داده نبود، جملهٔ جایگزین می‌آید نه نشانهٔ خام", () => {
    const text = fillFaqAnswer("تلفن: {{phone}}؛ ساعت: {{hours}}؛ نشانی: {{addresses}}؛ نوبت: {{booking}}", empty);
    expect(text).not.toContain("{{");
    expect(text).toContain("تماس بگیرید");
  });

  it("پاسخ بی‌نشانه دست‌نخورده می‌ماند", () => {
    expect(fillFaqAnswer("ده دقیقه پیش از نوبت برسید.", info)).toBe("ده دقیقه پیش از نوبت برسید.");
  });
});

describe("fillFaqItems", () => {
  it("همهٔ پاسخ‌ها را پر می‌کند و لینک را حفظ می‌کند", () => {
    const filled = fillFaqItems(
      [
        { question: "آدرس؟", answer: "{{addresses}}", linkHref: "/contact", linkLabel: "تماس" },
        { question: "ساده؟", answer: "پاسخ." },
      ],
      info,
    );
    expect(filled[0].answer).toContain("خیابان الف");
    expect(filled[0].linkHref).toBe("/contact");
    expect(filled[1].answer).toBe("پاسخ.");
  });
});

describe("answerForClinic", () => {
  it("نام مطب را می‌شناسد و نشانی و ساعت همان مطب را می‌دهد", () => {
    const result = answerForClinic("مطب الف کجاست؟", info);
    expect(result?.clinic.id).toBe("c1");
    expect(result?.answer).toContain("خیابان الف");
    expect(result?.answer).toContain("شنبه و سه‌شنبه");
  });

  it("بدون نام مطب null می‌دهد", () => {
    expect(answerForClinic("آدرس مطب کجاست؟", info)).toBeNull();
  });
});
