import { describe, expect, it } from "vitest";

import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";
import { PUBLIC_REQUEST_NAME_MAX_LENGTH, validatePublicRequest } from "./public-booking-validation";

const NOW = new Date("2026-11-01T08:00:00Z");

const VALID = {
  fullName: "  علی   رضایی ",
  nationalId: "0499370899",
  contactMobile: "09123456789",
  forSelf: false,
  startsAt: "2026-11-05T05:30:00+00:00",
};

function errorsOf(input: unknown) {
  const result = validatePublicRequest(input, NOW);
  return result.ok ? {} : result.errors;
}

describe("validatePublicRequest", () => {
  it("ورودی درست را تمیز می‌کند و فقط همان پنج مقدار را برمی‌گرداند", () => {
    const result = validatePublicRequest({ ...VALID, birthDate: "1370/01/01", gender: "male" }, NOW);
    expect(result).toEqual({
      ok: true,
      values: {
        fullName: "علی رضایی",
        nationalId: "0499370899",
        contactMobile: "09123456789",
        forSelf: false,
        startsAt: "2026-11-05T05:30:00.000Z",
      },
    });
  });

  it("ارقام فارسی کد ملی و شمارهٔ تماس را لاتین می‌کند", () => {
    const result = validatePublicRequest({ ...VALID, nationalId: "۰۴۹۹۳۷۰۸۹۹", contactMobile: "۰۹۱۲۳۴۵۶۷۸۹" }, NOW);
    expect(result.ok && [result.values.nationalId, result.values.contactMobile]).toEqual(["0499370899", "09123456789"]);
  });

  it("«برای خودم» می‌تواند true باشد، و بدون انتخاب یا با رشته خطا می‌دهد", () => {
    const self = validatePublicRequest({ ...VALID, forSelf: true }, NOW);
    expect(self.ok && self.values.forSelf).toBe(true);
    expect(errorsOf({ ...VALID, forSelf: null }).forSelf).toBe(messages.forSelfEmpty);
    expect(errorsOf({ ...VALID, forSelf: undefined }).forSelf).toBe(messages.forSelfEmpty);
    expect(errorsOf({ ...VALID, forSelf: "false" }).forSelf).toBe(messages.forSelfEmpty);
  });

  it("نام خالی یا خیلی بلند خطا می‌دهد", () => {
    expect(errorsOf({ ...VALID, fullName: "   " }).fullName).toBe(messages.nameEmpty);
    expect(errorsOf({ ...VALID, fullName: "ا".repeat(PUBLIC_REQUEST_NAME_MAX_LENGTH + 1) }).fullName).toBe(messages.nameTooLong);
  });

  it("کد ملی بدون رقم کنترل یا با طول غلط رد می‌شود", () => {
    expect(errorsOf({ ...VALID, nationalId: "" }).nationalId).toBeTruthy();
    expect(errorsOf({ ...VALID, nationalId: "049937089" }).nationalId).toContain("۱۰ رقم");
    expect(errorsOf({ ...VALID, nationalId: "0499370898" }).nationalId).toContain("معتبر نیست");
    expect(errorsOf({ ...VALID, nationalId: "1111111111" }).nationalId).toContain("معتبر نیست");
    expect(errorsOf({ ...VALID, nationalId: "04993708ab" }).nationalId).toContain("فقط باید عدد");
  });

  it("شمارهٔ تماس فقط موبایل ۰۹ و ۱۱ رقمی است", () => {
    expect(errorsOf({ ...VALID, contactMobile: "" }).contactMobile).toBeTruthy();
    expect(errorsOf({ ...VALID, contactMobile: "0912345678" }).contactMobile).toContain("۱۱ رقم");
    expect(errorsOf({ ...VALID, contactMobile: "02112345678" }).contactMobile).toContain("۰۹");
  });

  it("ساعت خالی، بدون منطقهٔ زمانی، نامعتبر یا گذشته رد می‌شود", () => {
    expect(errorsOf({ ...VALID, startsAt: "" }).time).toBe(messages.timeEmpty);
    expect(errorsOf({ ...VALID, startsAt: "2026-11-05T09:00:00" }).time).toBe(messages.timeEmpty);
    expect(errorsOf({ ...VALID, startsAt: "not-a-date" }).time).toBe(messages.timeEmpty);
    expect(errorsOf({ ...VALID, startsAt: "2026-11-01T08:00:00Z" }).time).toBe(messages.slotTaken);
    expect(errorsOf({ ...VALID, startsAt: "2026-10-31T05:30:00+00:00" }).time).toBe(messages.slotTaken);
  });

  it("چند خطا را با هم برمی‌گرداند و ورودی غیر شیء را می‌پذیرد", () => {
    expect(Object.keys(errorsOf({})).sort()).toEqual(["contactMobile", "forSelf", "fullName", "nationalId", "time"]);
    expect(Object.keys(errorsOf(null))).toHaveLength(5);
    expect(Object.keys(errorsOf("x"))).toHaveLength(5);
  });
});
