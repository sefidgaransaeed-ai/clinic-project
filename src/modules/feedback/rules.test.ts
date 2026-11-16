import { describe, expect, it } from "vitest";
import { COMMENT_MAX, dateStamp, isSurveyToken, SCORE_WORDS, surveyInputError, surveyUrl } from "./rules";

describe("isSurveyToken", () => {
  it("فقط ۳۲ نویسهٔ hex، همان شکلی که create_survey_link می‌سازد", () => {
    expect(isSurveyToken("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isSurveyToken("0123456789ABCDEF0123456789ABCDEF")).toBe(false);
    expect(isSurveyToken("0123456789abcdef")).toBe(false);
    expect(isSurveyToken("../../panel")).toBe(false);
    expect(isSurveyToken("")).toBe(false);
  });
});

describe("surveyInputError", () => {
  it("امتیاز باید عدد صحیح ۱ تا ۵ باشد", () => {
    expect(surveyInputError(0, "")).toBeTruthy();
    expect(surveyInputError(6, "")).toBeTruthy();
    expect(surveyInputError(2.5, "")).toBeTruthy();
    expect(surveyInputError(1, "")).toBeNull();
    expect(surveyInputError(5, "خوب بود")).toBeNull();
  });

  it("متن حداکثر ۱۰۰۰ حرف، مثل submit_survey", () => {
    expect(surveyInputError(4, "ا".repeat(COMMENT_MAX))).toBeNull();
    expect(surveyInputError(4, "ا".repeat(COMMENT_MAX + 1))).toBeTruthy();
    // فاصله‌های دو سر شمرده نمی‌شوند، چون پیش از ثبت برداشته می‌شوند
    expect(surveyInputError(4, `  ${"ا".repeat(COMMENT_MAX)}  `)).toBeNull();
  });
});

describe("surveyUrl", () => {
  it("نشانی کامل، بدون / تکراری", () => {
    const token = "0123456789abcdef0123456789abcdef";
    expect(surveyUrl("https://example.com", token)).toBe(`https://example.com/nazar/${token}`);
    expect(surveyUrl("https://example.com/", token)).toBe(`https://example.com/nazar/${token}`);
  });
});

describe("dateStamp — به وقت تهران و شمسی", () => {
  it("ظهر ۲۵ آبان ۱۴۰۵، دوشنبه", () => {
    expect(dateStamp("2026-11-16T12:00:00Z")).toEqual({
      weekday: "دوشنبه",
      day: "۲۵",
      month: "آبان",
      year: "۱۴۰۵",
    });
  });

  it("ساعت ۰۰:۳۰ بامداد تهران هنوز در UTC روز قبل است؛ مهر باید روز تهران را نشان دهد", () => {
    // ۲۱:۰۰ UTC روز ۱۵ نوامبر = ۰۰:۳۰ بامداد ۱۶ نوامبر به وقت تهران
    expect(dateStamp("2026-11-15T21:00:00Z").day).toBe("۲۵");
  });
});

describe("SCORE_WORDS", () => {
  it("برای هر امتیاز یک واژه", () => {
    expect(SCORE_WORDS[1]).toBe("خیلی ناراضی");
    expect(SCORE_WORDS[5]).toBe("خیلی راضی");
    expect(SCORE_WORDS).toHaveLength(6);
  });
});
