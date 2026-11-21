import { describe, expect, it } from "vitest";

import {
  inRange,
  lowScores,
  rangeFor,
  scoreText,
  summarize,
  weekStartKey,
  weeklyAverages,
  type SurveyAnswer,
} from "./dashboard-rules";

/**
 * آزمون محاسبه‌های داشبورد بازخورد (کار p3-10).
 *
 * داده‌ها ساختگی‌اند (بخش ۶ CLAUDE.md). «حالا» ثابت است تا آزمون به تقویم واقعی
 * وابسته نباشد و فردا هم همان نتیجه را بدهد.
 */

/** ۱۰ آذر ۱۴۰۵ — چهارشنبه */
const NOW = new Date("2026-12-01T12:00:00.000Z");

function answer(submittedAt: string, score: number, comment: string | null = null): SurveyAnswer {
  return { submittedAt, score, comment };
}

describe("بازه‌های زمانی", () => {
  it("این ماه، از اول تا آخر همان ماه میلادی است", () => {
    const range = rangeFor("thisMonth", NOW);
    expect(range).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("ماه قبل، ماه پیش از ماه جاری است", () => {
    const range = rangeFor("lastMonth", NOW);
    expect(range).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("سه ماه اخیر از اول دو ماه قبل تا امروز است", () => {
    const range = rangeFor("last3Months", NOW);
    expect(range).toEqual({ from: "2026-10-01", to: "2026-12-01" });
  });

  it("مرز ماه از ژانویه به دسامبر سال قبل درست می‌رود", () => {
    const january = new Date("2027-01-15T10:00:00.000Z");
    expect(rangeFor("lastMonth", january)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("فوریهٔ سال کبیسه ۲۹ روز دارد", () => {
    const march = new Date("2028-03-10T10:00:00.000Z");
    expect(rangeFor("lastMonth", march)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("مرز روز تهران — H-12", () => {
  const range = { from: "2026-12-01", to: "2026-12-31" };

  it("نظر ساعت ۰۰:۳۰ تهران در همان روز تهران می‌نشیند", () => {
    // در UTC این ساعت ۲۱:۰۰ روز قبل است
    const midnight = answer("2026-11-30T21:00:00.000Z", 5);
    expect(inRange(midnight, range)).toBe(true);
  });

  it("نظر ۲۳:۵۹ تهران آخرین روز ماه، در همان ماه است", () => {
    const late = answer("2026-12-31T20:29:00.000Z", 4);
    expect(inRange(late, range)).toBe(true);
  });

  it("نظر اول ماه بعد، بیرون از بازه است", () => {
    const outside = answer("2026-12-31T21:00:00.000Z", 5);
    expect(inRange(outside, range)).toBe(false);
  });
});

describe("هفته — شنبه شروع", () => {
  it("شنبه، شروع هفتهٔ خودش است", () => {
    // ۵ دسامبر ۲۰۲۶ شنبه است
    expect(weekStartKey("2026-12-05")).toBe("2026-12-05");
  });

  it("جمعه، آخر همان هفته است و به شنبهٔ قبل برمی‌گردد", () => {
    expect(weekStartKey("2026-12-11")).toBe("2026-12-05");
  });

  it("یکشنبه، اول هفتهٔ تازه است", () => {
    expect(weekStartKey("2026-12-06")).toBe("2026-12-05");
  });
});

describe("میانگین امتیاز", () => {
  it("میانگین را با یک رقم اعشار می‌دهد", () => {
    const summary = summarize(
      [answer("2026-12-02T10:00:00.000Z", 5), answer("2026-12-03T10:00:00.000Z", 4)],
      [],
      { from: "2026-12-01", to: "2026-12-31" },
    );
    expect(summary.averageScore).toBe(4.5);
  });

  it("بازهٔ بی‌پاسخ صفر می‌دهد، نه خطا", () => {
    const summary = summarize([], [], { from: "2026-12-01", to: "2026-12-31" });
    expect(summary.averageScore).toBe(0);
    expect(summary.answerCount).toBe(0);
    expect(summary.responseRate).toBe(0);
  });

  it("پاسخ بیرون از بازه در میانگین نمی‌آید", () => {
    const summary = summarize(
      [answer("2026-12-02T10:00:00.000Z", 5), answer("2026-11-20T10:00:00.000Z", 1)],
      [],
      { from: "2026-12-01", to: "2026-12-31" },
    );
    expect(summary.averageScore).toBe(5);
    expect(summary.answerCount).toBe(1);
  });
});

describe("توزیع امتیازها", () => {
  it("همیشه پنج خانه دارد، حتی امتیاز بی‌پاسخ", () => {
    const summary = summarize(
      [answer("2026-12-02T10:00:00.000Z", 5)],
      [],
      { from: "2026-12-01", to: "2026-12-31" },
    );
    expect(summary.distribution.map((b) => b.score)).toEqual([1, 2, 3, 4, 5]);
    expect(summary.distribution.map((b) => b.count)).toEqual([0, 0, 0, 0, 1]);
  });

  it("سهم هر امتیاز از کل را درصدی می‌دهد", () => {
    const answers = [
      answer("2026-12-02T10:00:00.000Z", 5),
      answer("2026-12-03T10:00:00.000Z", 5),
      answer("2026-12-04T10:00:00.000Z", 1),
      answer("2026-12-05T10:00:00.000Z", 3),
    ];
    const summary = summarize(answers, [], { from: "2026-12-01", to: "2026-12-31" });

    expect(summary.distribution[4]).toEqual({ score: 5, count: 2, share: 50 });
    expect(summary.distribution[0]).toEqual({ score: 1, count: 1, share: 25 });
  });
});

describe("درصد راضی‌ها — امتیاز ۴ و ۵", () => {
  it("درصد امتیاز ۴ و ۵ را حساب می‌کند", () => {
    const answers = [
      answer("2026-12-02T10:00:00.000Z", 5),
      answer("2026-12-03T10:00:00.000Z", 4),
      answer("2026-12-04T10:00:00.000Z", 2),
      answer("2026-12-05T10:00:00.000Z", 1),
    ];
    const summary = summarize(answers, [], { from: "2026-12-01", to: "2026-12-31" });
    expect(summary.happyShare).toBe(50);
  });
});

describe("نرخ پاسخ", () => {
  it("پاسخ‌ها تقسیم بر لینک‌های همان بازه", () => {
    const answers = [answer("2026-12-02T10:00:00.000Z", 5), answer("2026-12-03T10:00:00.000Z", 4)];
    const links = [
      "2026-12-01T10:00:00.000Z",
      "2026-12-02T10:00:00.000Z",
      "2026-12-03T10:00:00.000Z",
      "2026-12-04T10:00:00.000Z",
    ];
    const summary = summarize(answers, links, { from: "2026-12-01", to: "2026-12-31" });
    expect(summary.linkCount).toBe(4);
    expect(summary.responseRate).toBe(50);
  });

  it("لینک بیرون از بازه در مخرج نمی‌آید", () => {
    const summary = summarize(
      [answer("2026-12-02T10:00:00.000Z", 5)],
      ["2026-12-02T10:00:00.000Z", "2026-11-15T10:00:00.000Z"],
      { from: "2026-12-01", to: "2026-12-31" },
    );
    expect(summary.linkCount).toBe(1);
    expect(summary.responseRate).toBe(100);
  });

  it("بی‌لینک، نرخ صفر است نه تقسیم بر صفر", () => {
    const summary = summarize([], [], { from: "2026-12-01", to: "2026-12-31" });
    expect(summary.responseRate).toBe(0);
  });
});

describe("میانگین هفتگی", () => {
  it("هر هفته یک نقطه می‌دهد و هفته‌های بی‌پاسخ نمی‌آیند", () => {
    const answers = [
      answer("2026-12-05T10:00:00.000Z", 5),
      answer("2026-12-06T10:00:00.000Z", 3),
      answer("2026-12-19T10:00:00.000Z", 4),
    ];
    const weekly = weeklyAverages(answers);

    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toEqual({ weekStart: "2026-12-05", average: 4, count: 2 });
    expect(weekly[1]).toEqual({ weekStart: "2026-12-19", average: 4, count: 1 });
  });

  it("هفته‌ها به ترتیب تاریخ می‌آیند", () => {
    const answers = [
      answer("2026-12-19T10:00:00.000Z", 4),
      answer("2026-12-05T10:00:00.000Z", 5),
    ];
    const weekly = weeklyAverages(answers);
    expect(weekly.map((w) => w.weekStart)).toEqual(["2026-12-05", "2026-12-19"]);
  });
});

describe("امتیازهای پایین برای پیگیری", () => {
  it("فقط ۱ و ۲ را برمی‌گرداند، تازه‌ترین اول", () => {
    const answers = [
      answer("2026-12-02T10:00:00.000Z", 1, "قدیمی"),
      answer("2026-12-09T10:00:00.000Z", 2, "تازه"),
      answer("2026-12-05T10:00:00.000Z", 5, null),
    ];
    const lows = lowScores(answers);

    expect(lows.map((a) => a.comment)).toEqual(["تازه", "قدیمی"]);
  });

  it("بی‌نظر پایین، فهرست خالی است", () => {
    expect(lowScores([answer("2026-12-02T10:00:00.000Z", 5)])).toEqual([]);
  });
});

describe("متن فارسی اعداد", () => {
  it("میانگین را با رقم فارسی و ممیز فارسی می‌نویسد", () => {
    expect(scoreText(4.25)).toBe("۴٫۳");
    expect(scoreText(5)).toBe("۵٫۰");
  });
});
