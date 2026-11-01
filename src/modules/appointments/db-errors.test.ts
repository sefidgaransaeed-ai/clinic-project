import { describe, expect, it } from "vitest";

import { MANUAL_OVERLAP_MESSAGE, PAST_EDIT_LOCKED_MESSAGE, SLOT_TAKEN_MESSAGE } from "./data";
import { DB_WRITE_FAILED_MESSAGE, mapDbError, NATIONAL_ID_TAKEN_MESSAGE } from "./db-errors";

/** متن انگلیسی پیش‌فرض Postgres؛ نباید هیچ‌جا به کاربر برسد. */
const RAW_NATIONAL_ID_DUPLICATE = {
  code: "23505",
  message: 'duplicate key value violates unique constraint "patients_national_id_key"',
  details: "Key (national_id)=(1000000000) already exists.",
};

describe("mapDbError", () => {
  it("کد ملی تکراری (23505) پیام کد ملی می‌دهد", () => {
    expect(mapDbError(RAW_NATIONAL_ID_DUPLICATE)).toBe(NATIONAL_ID_TAKEN_MESSAGE);
  });

  it("23505 روی چیزی جز کد ملی پیام کلی می‌دهد، نه پیام کد ملی", () => {
    const message = mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "x_pkey"' });
    expect(message).toBe(DB_WRITE_FAILED_MESSAGE);
  });

  it("هم‌پوشانی (23P01) بسته به جایگاه، یکی از دو پیام مصوب را می‌دهد", () => {
    const raw = { code: "23P01", message: 'conflicting key value violates exclusion constraint "appointments_no_overlap"' };
    expect(mapDbError(raw)).toBe(SLOT_TAKEN_MESSAGE);
    expect(mapDbError(raw, "status")).toBe(SLOT_TAKEN_MESSAGE);
    expect(mapDbError(raw, "manual")).toBe(MANUAL_OVERLAP_MESSAGE);
  });

  it("خطای قفل ۷ روزه (P0001) پیام A-09 برند را می‌دهد", () => {
    expect(mapDbError({ code: "P0001", message: "raise exception text" })).toBe(PAST_EDIT_LOCKED_MESSAGE);
  });

  it("هر خطای دیگر و خطای بی‌کد پیام کلیِ فارسی می‌دهد", () => {
    expect(mapDbError({ code: "42501", message: "permission denied" })).toBe(DB_WRITE_FAILED_MESSAGE);
    expect(mapDbError({ message: "fetch failed" })).toBe(DB_WRITE_FAILED_MESSAGE);
    expect(mapDbError({})).toBe(DB_WRITE_FAILED_MESSAGE);
  });

  it("هیچ پیامی متن انگلیسی پایگاه داده را نشان نمی‌دهد", () => {
    const errors = [
      RAW_NATIONAL_ID_DUPLICATE,
      { code: "23P01", message: "conflicting key value" },
      { code: "P0001", message: "update not permitted" },
      { code: "XX000", message: "internal error" },
    ];
    for (const error of errors) {
      const message = mapDbError(error);
      expect(message).not.toMatch(/[A-Za-z]/);
      expect(message).toMatch(/[؀-ۿ]/);
    }
  });
});
