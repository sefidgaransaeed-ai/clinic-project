import { describe, expect, it } from "vitest";

import { getUnsavedExtraColumns, resolveExistingPatientExtras } from "./data";
import { BIRTH_DATE_MESSAGES, GENDER_MESSAGES } from "./patient-validation";

/** ۱۲ مرداد ۱۳۷۰ شمسی. */
const TYPED_BIRTH = "12/05/1370";
const TYPED_BIRTH_GREGORIAN = "1991-08-03";

const EMPTY = { birth_date: null, gender: null };

describe("resolveExistingPatientExtras", () => {
  it("وقتی هر دو فیلدِ پرونده خالی است، هر دو برای ذخیره می‌آیند و تاریخ شمسی به میلادی می‌شود", () => {
    const { errors, updates } = resolveExistingPatientExtras(EMPTY, { birth_date: TYPED_BIRTH, gender: "female" });
    expect(errors).toEqual({});
    expect(updates).toEqual({ birth_date: TYPED_BIRTH_GREGORIAN, gender: "female" });
  });

  it("تاریخ تولدِ ثبت‌شده بازنویسی نمی‌شود؛ فقط جنسِ خالی ذخیره می‌شود", () => {
    const { errors, updates } = resolveExistingPatientExtras(
      { birth_date: "1980-01-01", gender: null },
      { birth_date: TYPED_BIRTH, gender: "male" },
    );
    expect(errors).toEqual({});
    expect(updates).toEqual({ gender: "male" });
    expect(Object.keys(updates)).not.toContain("birth_date");
  });

  it("جنسِ ثبت‌شده بازنویسی نمی‌شود؛ فقط تاریخ تولدِ خالی ذخیره می‌شود", () => {
    const { errors, updates } = resolveExistingPatientExtras(
      { birth_date: null, gender: "female" },
      { birth_date: TYPED_BIRTH, gender: "male" },
    );
    expect(errors).toEqual({});
    expect(updates).toEqual({ birth_date: TYPED_BIRTH_GREGORIAN });
    expect(Object.keys(updates)).not.toContain("gender");
  });

  it("وقتی هر دو فیلد پر است هیچ‌چیز ذخیره نمی‌شود", () => {
    const { errors, updates } = resolveExistingPatientExtras(
      { birth_date: "1980-01-01", gender: "female" },
      { birth_date: TYPED_BIRTH, gender: "male" },
    );
    expect(errors).toEqual({});
    expect(updates).toEqual({});
  });

  it("مقدارِ نادرستِ تایپ‌شده برای فیلدی که در پرونده پر است خطا نمی‌دهد و ذخیره هم نمی‌شود", () => {
    const { errors, updates } = resolveExistingPatientExtras(
      { birth_date: "1980-01-01", gender: "female" },
      { birth_date: "نادرست", gender: "x" as never },
    );
    expect(errors).toEqual({});
    expect(updates).toEqual({});
  });

  it("فیلدِ خالیِ پرونده که چیزی برایش تایپ نشده کلید نمی‌سازد (null هرگز نوشته نمی‌شود)", () => {
    const { errors, updates } = resolveExistingPatientExtras(EMPTY, { birth_date: "", gender: "" });
    expect(errors).toEqual({});
    expect(updates).toEqual({});
    expect(Object.values(updates)).not.toContain(null);
  });

  it("تاریخ ناقص یا نادرست برای فیلدِ خالی خطای فارسی همان فیلد را می‌دهد و چیزی ذخیره نمی‌شود", () => {
    const incomplete = resolveExistingPatientExtras(EMPTY, { birth_date: "12//1370", gender: "" });
    expect(incomplete.errors).toEqual({ birth_date: BIRTH_DATE_MESSAGES.incomplete });
    expect(incomplete.updates).toEqual({});

    const gregorian = resolveExistingPatientExtras(EMPTY, { birth_date: "12/05/1991", gender: "" });
    expect(gregorian.errors).toEqual({ birth_date: BIRTH_DATE_MESSAGES.gregorianYear });
    expect(gregorian.updates).toEqual({});
  });

  it("جنسِ نامعتبر برای فیلدِ خالی خطا می‌دهد، ولی تاریخ تولدِ درست همچنان آماده می‌ماند", () => {
    const { errors, updates } = resolveExistingPatientExtras(EMPTY, {
      birth_date: TYPED_BIRTH,
      gender: "other" as never,
    });
    expect(errors).toEqual({ gender: GENDER_MESSAGES.invalid });
    expect(updates).toEqual({ birth_date: TYPED_BIRTH_GREGORIAN });
  });

  it("ورودی را عوض نمی‌کند", () => {
    const existing = { birth_date: null, gender: "female" };
    const typed = { birth_date: TYPED_BIRTH, gender: "male" as const };
    resolveExistingPatientExtras(existing, typed);
    expect(existing).toEqual({ birth_date: null, gender: "female" });
    expect(typed).toEqual({ birth_date: TYPED_BIRTH, gender: "male" });
  });
});

describe("getUnsavedExtraColumns", () => {
  it("ستونی که هنوز خالی است ذخیره‌نشده حساب می‌شود", () => {
    expect(getUnsavedExtraColumns(["birth_date", "gender"], EMPTY)).toEqual(["birth_date", "gender"]);
  });

  it("وقتی همهٔ ستون‌ها حالا پر شده‌اند (کسِ دیگری پر کرده) چیزی ذخیره‌نشده نیست", () => {
    expect(getUnsavedExtraColumns(["birth_date", "gender"], { birth_date: "1980-01-01", gender: "male" })).toEqual([]);
  });

  it("یک ستونِ پر و یک ستونِ خالی: فقط ستونِ خالی ذخیره‌نشده است", () => {
    expect(getUnsavedExtraColumns(["birth_date", "gender"], { birth_date: "1980-01-01", gender: null })).toEqual(["gender"]);
    expect(getUnsavedExtraColumns(["birth_date", "gender"], { birth_date: null, gender: "female" })).toEqual(["birth_date"]);
  });

  it("فقط ستون‌های خواسته‌شده سنجیده می‌شوند", () => {
    expect(getUnsavedExtraColumns(["gender"], { birth_date: null, gender: "female" })).toEqual([]);
    expect(getUnsavedExtraColumns([], EMPTY)).toEqual([]);
  });
});
