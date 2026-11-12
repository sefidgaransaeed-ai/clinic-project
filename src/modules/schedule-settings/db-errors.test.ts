import { describe, expect, it } from "vitest";

import {
  DB_WRITE_FAILED_MESSAGE,
  INVALID_VALUE_MESSAGE,
  mapDbError,
  NOT_ALLOWED_MESSAGE,
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

  it("هر کد دیگر یا بدون کد پیام عمومی می‌دهد و متن انگلیسی نشت نمی‌کند", () => {
    for (const error of [{ code: "XX000", message: "internal error" }, { code: null, message: "boom" }, {}]) {
      const message = mapDbError(error);
      expect(message).toBe(DB_WRITE_FAILED_MESSAGE);
      expect(message).not.toMatch(/internal|boom/);
    }
  });

  it("هیچ پیامی حرف انگلیسی ندارد", () => {
    for (const message of [DB_WRITE_FAILED_MESSAGE, INVALID_VALUE_MESSAGE, NOT_ALLOWED_MESSAGE]) {
      expect(message).not.toMatch(/[A-Za-z]/);
    }
  });
});
