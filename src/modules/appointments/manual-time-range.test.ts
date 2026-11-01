import { describe, expect, it } from "vitest";

import { getManualTimeRange } from "./data";

describe("getManualTimeRange", () => {
  it("ساعت دیواری تهران را به UTC می‌برد (تهران همیشه ۳:۳۰ جلوتر است)", () => {
    expect(getManualTimeRange("2026-11-02", "14:00", 30)).toEqual({
      ok: true,
      startsAt: "2026-11-02T10:30:00.000Z",
      endsAt: "2026-11-02T11:00:00.000Z",
    });
  });

  it("اولین شروع مجاز، ۰۸:۰۰ تهران، همان روزِ UTC است", () => {
    const range = getManualTimeRange("2026-11-02", "08:00", 15);
    expect(range).toMatchObject({ ok: true, startsAt: "2026-11-02T04:30:00.000Z" });
  });

  it("پایانِ دقیقاً ۲۴:۰۰ تهران مجاز است", () => {
    expect(getManualTimeRange("2026-11-02", "23:00", 60)).toEqual({
      ok: true,
      startsAt: "2026-11-02T19:30:00.000Z",
      endsAt: "2026-11-02T20:30:00.000Z",
    });
  });

  it("فقط مدت‌های ۱۵، ۳۰، ۴۵ و ۶۰ را می‌پذیرد", () => {
    for (const minutes of [15, 30, 45, 60]) {
      expect(getManualTimeRange("2026-11-02", "11:00", minutes).ok).toBe(true);
    }
    for (const minutes of [0, 10, 90, -15, Number.NaN]) {
      expect(getManualTimeRange("2026-11-02", "11:00", minutes).ok).toBe(false);
    }
  });

  it("شروع باید روی شبکهٔ ۱۵ دقیقه‌ای و ساعتِ معتبر باشد", () => {
    expect(getManualTimeRange("2026-11-02", "11:15", 15).ok).toBe(true);
    for (const time of ["11:10", "11:7", "24:00", "11:60", "", "abc"]) {
      expect(getManualTimeRange("2026-11-02", time, 15).ok).toBe(false);
    }
  });

  it("روزِ نامعتبر را رد می‌کند", () => {
    for (const dateKey of ["2026-13-01", "2026-02-30", "امروز", ""]) {
      expect(getManualTimeRange(dateKey, "11:00", 15).ok).toBe(false);
    }
  });

  it("ساعت کاری و تعطیلی را نمی‌سنجد", () => {
    expect(getManualTimeRange("2026-11-02", "21:30", 60).ok).toBe(true);
  });

  it("شروع زودتر از ۰۸:۰۰ را رد می‌کند", () => {
    for (const time of ["00:00", "03:00", "07:45"]) {
      const range = getManualTimeRange("2026-11-02", time, 15);
      expect(range.ok).toBe(false);
      expect(range).toMatchObject({ message: expect.stringContaining("۰۸:۰۰") });
    }
  });

  it("نوبتی را که پایانش از ۲۴:۰۰ می‌گذرد رد می‌کند", () => {
    expect(getManualTimeRange("2026-11-02", "23:45", 15).ok).toBe(true);
    expect(getManualTimeRange("2026-11-02", "23:15", 45).ok).toBe(true);
    for (const [time, minutes] of [["23:45", 30], ["23:30", 45], ["23:15", 60]] as const) {
      const range = getManualTimeRange("2026-11-02", time, minutes);
      expect(range.ok).toBe(false);
      expect(range).toMatchObject({ message: expect.stringContaining("۲۴:۰۰") });
    }
  });
});
