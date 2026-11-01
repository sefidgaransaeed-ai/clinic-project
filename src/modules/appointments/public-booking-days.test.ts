import { describe, expect, it } from "vitest";

import { gregorianToJalali } from "./date";
import {
  clinicWeekday,
  EMPTY_DATE_PARTS,
  getDayError,
  getDayUnavailable,
  getDayUnavailableLabel,
  getMonthDays,
  getMonthOptions,
  getYearOptions,
  groupClinicWeekdays,
  isRealDateKey,
  normalizeDateParts,
  parsePublicInfo,
  type PublicBookingInfo,
} from "./public-booking-days";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";

/** همان شکل jsonb که `get_public_info()` برمی‌گرداند؛ شنبه ۰ تا جمعه ۶ و ساعت «HH:MM:SS». دادهٔ ساختگی است. */
const RAW_INFO = {
  faq: [{ question: "پرسش", answer: "پاسخ" }],
  site_info: { phone: "000" },
  clinics: [
    { id: CLINIC_A, name: "مطب شمال", address: "نشانی آزمایشی شمال", directions: null },
    { id: CLINIC_B, name: "مطب جنوب", address: "نشانی آزمایشی جنوب", directions: "راهنما" },
  ],
  working_hours: [
    { weekday: 0, start_time: "09:00:00", end_time: "13:00:00", clinic_id: CLINIC_A },
    { weekday: 2, start_time: "09:00:00", end_time: "13:00:00", clinic_id: CLINIC_A },
    { weekday: 3, start_time: "16:00:00", end_time: "20:00:00", clinic_id: CLINIC_B },
  ],
  closures: ["2026-11-14"],
};

// ۱ نوامبر ۲۰۲۶ یکشنبه است: شنبه ۷ نوامبر، دوشنبه ۲ نوامبر، سه‌شنبه ۳ نوامبر، چهارشنبه ۴ نوامبر.
const info = parsePublicInfo(RAW_INFO) as PublicBookingInfo;
const TODAY = "2026-11-01";

describe("clinicWeekday", () => {
  it("شنبه ۰ تا جمعه ۶ است، نه شیوهٔ جاوااسکریپت", () => {
    expect(clinicWeekday("2026-11-07")).toBe(0);
    expect(clinicWeekday("2026-11-01")).toBe(1);
    expect(clinicWeekday("2026-11-06")).toBe(6);
  });
});

describe("isRealDateKey", () => {
  it("فقط تاریخ واقعی تقویم را می‌پذیرد", () => {
    expect(isRealDateKey("2026-11-01")).toBe(true);
    expect(isRealDateKey("2026-02-31")).toBe(false);
    expect(isRealDateKey("2026-1-1")).toBe(false);
    expect(isRealDateKey("0001-01-01")).toBe(false);
    expect(isRealDateKey(20261101)).toBe(false);
    expect(isRealDateKey(undefined)).toBe(false);
  });
});

describe("parsePublicInfo", () => {
  it("فقط کلیدهای لازم را می‌گیرد و ساعت را به HH:MM کوتاه می‌کند", () => {
    expect(info).toEqual({
      clinics: [
        { id: CLINIC_A, name: "مطب شمال", address: "نشانی آزمایشی شمال" },
        { id: CLINIC_B, name: "مطب جنوب", address: "نشانی آزمایشی جنوب" },
      ],
      workingHours: [
        { weekday: 0, startTime: "09:00", endTime: "13:00", clinicId: CLINIC_A },
        { weekday: 2, startTime: "09:00", endTime: "13:00", clinicId: CLINIC_A },
        { weekday: 3, startTime: "16:00", endTime: "20:00", clinicId: CLINIC_B },
      ],
      closures: ["2026-11-14"],
    });
  });

  it("ردیف خراب را کنار می‌گذارد و کلید غایب را خالی می‌گیرد", () => {
    const parsed = parsePublicInfo({
      clinics: [{ id: 5, name: "x", address: "y" }, null],
      working_hours: [{ weekday: 9, start_time: "09:00:00", end_time: "10:00:00" }, { weekday: 1, start_time: "09:00:00", end_time: "10:00:00" }],
      closures: ["2026-02-31", "نه تاریخ", "2026-11-20"],
    });
    expect(parsed).toEqual({
      clinics: [],
      workingHours: [{ weekday: 1, startTime: "09:00", endTime: "10:00", clinicId: null }],
      closures: ["2026-11-20"],
    });
    expect(parsePublicInfo({})).toEqual({ clinics: [], workingHours: [], closures: [] });
  });

  it("ورودی غیر شیء را رد می‌کند", () => {
    expect(parsePublicInfo(null)).toBeNull();
    expect(parsePublicInfo("x")).toBeNull();
    expect(parsePublicInfo([])).toBeNull();
  });
});

describe("روز تعطیل و غیرکاری", () => {
  it("روز کاری انتخاب‌شدنی است", () => {
    expect(getDayUnavailable("2026-11-07", info)).toBeNull();
    expect(getDayUnavailableLabel("2026-11-07", info)).toBeNull();
    expect(getDayError("2026-11-07", TODAY, info)).toBeNull();
  });

  it("روز تعطیل و روز غیرکاری برچسب و پیام خودشان را دارند", () => {
    // ۱۴ نوامبر شنبه (کاری) است ولی تعطیل شده؛ ۸ نوامبر یکشنبه است و کاری نیست.
    expect(getDayUnavailable("2026-11-14", info)).toBe("closed");
    expect(getDayUnavailableLabel("2026-11-14", info)).toBe(messages.dayClosed);
    expect(getDayError("2026-11-14", TODAY, info)).toBe(messages.dateClosed);
    expect(getDayUnavailable("2026-11-08", info)).toBe("notWorking");
    expect(getDayUnavailableLabel("2026-11-08", info)).toBe(messages.dayNotWorking);
    expect(getDayError("2026-11-08", TODAY, info)).toBe(messages.dateNotWorking);
  });

  it("خالی، نامعتبر و گذشته پیام خودشان را دارند", () => {
    expect(getDayError("", TODAY, info)).toBe(messages.dateEmpty);
    expect(getDayError("2026-02-31", TODAY, info)).toBe(messages.dateInvalid);
    expect(getDayError("2026-10-31", TODAY, info)).toBe(messages.datePast);
  });

  it("بدون ساعت کاری، همهٔ روزها غیرکاری‌اند", () => {
    expect(getDayUnavailable("2026-11-07", { clinics: [], workingHours: [], closures: [] })).toBe("notWorking");
  });
});

describe("groupClinicWeekdays", () => {
  it("هر مطب را با روزهای هفته‌اش به ترتیب شنبه تا جمعه می‌دهد", () => {
    expect(groupClinicWeekdays(info)).toEqual([
      { clinic: info.clinics[0], weekdayNames: ["شنبه", "دوشنبه"] },
      { clinic: info.clinics[1], weekdayNames: ["سه‌شنبه"] },
    ]);
  });

  it("مطبی که هیچ روز کاری ندارد نمی‌آید", () => {
    expect(groupClinicWeekdays({ ...info, workingHours: [] })).toEqual([]);
  });
});

describe("فهرست تاریخ شمسی", () => {
  const current = gregorianToJalali(TODAY);

  it("سال جاری و دو سال بعد؛ سقف دیگری نیست", () => {
    expect(getYearOptions(current)).toEqual([current.year, current.year + 1, current.year + 2]);
  });

  it("ماه‌های سال جاری از ماه جاری و سال‌های بعد همهٔ ماه‌ها", () => {
    expect(getMonthOptions(current.year, current)[0]).toBe(current.month);
    expect(getMonthOptions(current.year, current)).toHaveLength(12 - current.month + 1);
    expect(getMonthOptions(current.year + 2, current)).toHaveLength(12);
  });

  it("روزهای ماه جاری از امروز شروع می‌شود، و ماه بعد کامل است", () => {
    const days = getMonthDays(current.year, current.month, TODAY);
    expect(days[0]).toEqual({ day: current.day, dateKey: TODAY });
    expect(getMonthDays(current.year + 1, 1, TODAY)[0].day).toBe(1);
  });

  it("روزِ گذشته یا ماهِ گذشته پس از تغییر سال پاک می‌شود", () => {
    const parts = { year: String(current.year + 1), month: "1", day: "5" };
    expect(normalizeDateParts(parts, TODAY)).toEqual(parts);
    expect(normalizeDateParts({ year: String(current.year), month: "1", day: "5" }, TODAY)).toEqual({
      year: String(current.year),
      month: "",
      day: "",
    });
    expect(normalizeDateParts(EMPTY_DATE_PARTS, TODAY)).toEqual(EMPTY_DATE_PARTS);
  });
});
