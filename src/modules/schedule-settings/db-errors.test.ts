import { describe, expect, it } from "vitest";

import {
  CLOSURE_NOT_FOUND_MESSAGE,
  DB_WRITE_FAILED_MESSAGE,
  EXCLUSION_UNKNOWN_DB_MESSAGE,
  INVALID_VALUE_MESSAGE,
  mapDbError,
  NOT_ALLOWED_MESSAGE,
  WORKING_HOURS_CLINIC_PER_DAY_DB_MESSAGE,
  WORKING_HOURS_OVERLAP_DB_MESSAGE,
} from "./db-errors";
import { CLOSURE_MESSAGES, WORKING_HOURS_MESSAGES } from "./validation";

describe("mapDbError", () => {
  it("تکراری‌بودن تاریخ تعطیلی را به پیام فارسی تبدیل می‌کند", () => {
    const raw = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "closures_closure_date_key"',
      details: "Key (closure_date)=(2026-11-20) already exists.",
    };
    expect(mapDbError(raw)).toBe(CLOSURE_MESSAGES.duplicate);
  });

  it("یکتایی دیگر یا ناشناخته پیام عمومی می‌دهد، نه متن خام", () => {
    const message = mapDbError({ code: "23505", message: 'duplicate key value violates unique constraint "x_pkey"' });
    expect(message).toBe(DB_WRITE_FAILED_MESSAGE);
    expect(message).not.toContain("x_pkey");
  });

  it("قید check، قالب نادرست تاریخ و ساعت، مطب ناموجود و نبود اجازه را جدا می‌کند", () => {
    expect(mapDbError({ code: "23514" })).toBe(INVALID_VALUE_MESSAGE);
    expect(mapDbError({ code: "22007" })).toBe(INVALID_VALUE_MESSAGE);
    expect(mapDbError({ code: "22008" })).toBe(INVALID_VALUE_MESSAGE);
    expect(mapDbError({ code: "23503" })).toBe(WORKING_HOURS_MESSAGES.clinic);
    expect(mapDbError({ code: "42501", message: 'new row violates row-level security policy for table "closures"' })).toBe(
      NOT_ALLOWED_MESSAGE,
    );
  });

  it("23P01 از قید هم‌پوشانی ساعت کاری پیام فارسیِ هم‌پوشانی می‌دهد", () => {
    const message = mapDbError({
      code: "23P01",
      message: 'conflicting key value violates exclusion constraint "working_hours_no_active_overlap"',
      details: "Key (weekday, timerange)=(0, [14:00,18:00)) conflicts with existing key.",
    });
    expect(message).toBe(WORKING_HOURS_OVERLAP_DB_MESSAGE);
    expect(message).not.toMatch(/[A-Za-z]/);
  });

  it("23P01 از قید «یک مطب در هر روز» پیام فارسیِ مطب می‌دهد", () => {
    const message = mapDbError({
      code: "23P01",
      message: 'conflicting key value violates exclusion constraint "working_hours_one_active_clinic_per_day"',
    });
    expect(message).toBe(WORKING_HOURS_CLINIC_PER_DAY_DB_MESSAGE);
    expect(message).not.toBe(WORKING_HOURS_OVERLAP_DB_MESSAGE);
    expect(message).not.toMatch(/[A-Za-z]/);
  });

  it("23P01 با نام قیدِ ناشناخته یا بدون متن پیام عمومیِ فارسی می‌دهد و نام قید نشت نمی‌کند", () => {
    for (const error of [
      { code: "23P01", message: 'conflicting key value violates exclusion constraint "some_other_excl"' },
      { code: "23P01" },
    ]) {
      const message = mapDbError(error);
      expect(message).toBe(EXCLUSION_UNKNOWN_DB_MESSAGE);
      expect(message).not.toMatch(/[A-Za-z]/);
    }
  });

  it("هر کد دیگر یا بدون کد پیام عمومی می‌دهد و متن انگلیسی نشت نمی‌کند", () => {
    for (const error of [{ code: "XX000", message: "internal error" }, { code: null, message: "boom" }, {}]) {
      const message = mapDbError(error);
      expect(message).toBe(DB_WRITE_FAILED_MESSAGE);
      expect(message).not.toMatch(/internal|boom/);
    }
  });

  it("هیچ پیامی حرف انگلیسی ندارد", () => {
    for (const message of [
      DB_WRITE_FAILED_MESSAGE,
      INVALID_VALUE_MESSAGE,
      NOT_ALLOWED_MESSAGE,
      CLOSURE_NOT_FOUND_MESSAGE,
      WORKING_HOURS_OVERLAP_DB_MESSAGE,
      WORKING_HOURS_CLINIC_PER_DAY_DB_MESSAGE,
      EXCLUSION_UNKNOWN_DB_MESSAGE,
    ]) {
      expect(message).not.toMatch(/[A-Za-z]/);
    }
  });
});
