import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { KNOWN_REQUEST_ERRORS, mapRequestError } from "./public-booking-errors";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

/** متن انگلیسی پیش‌فرض Postgres/PostgREST؛ نباید هیچ‌جا به بازدیدکننده برسد. */
const RAW_ENGLISH = [
  { code: "42501", message: "permission denied for function request_appointment" },
  { code: "23P01", message: 'conflicting key value violates exclusion constraint "appointments_no_overlap"' },
  { code: "P0001", message: "something unexpected happened" },
  { code: "PGRST301", message: "JWT expired" },
  { code: "22007", message: 'invalid input syntax for type timestamp with time zone: "abc"' },
];

const HAS_LATIN_LETTER = /[A-Za-z]/;

/** `raise exception '...'`های تابع `request_appointment` را مستقیم از migration می‌خواند. */
function readRaisedTexts() {
  const sql = readFileSync(
    fileURLToPath(new URL("../../../supabase/migrations/20261028000009_request_with_clinic.sql", import.meta.url)),
    "utf8",
  );
  return [...sql.matchAll(/raise exception '([^']+)'/g)].map((match) => match[1]);
}

describe("mapRequestError", () => {
  it.each(KNOWN_REQUEST_ERRORS)("متن شناخته‌شده «$dbText» به پیام فارسی خودش می‌رسد", ({ dbText, field, message }) => {
    expect(mapRequestError({ code: "P0001", message: dbText })).toEqual({ field, message });
  });

  it("هر متن شناخته‌شده پیام جدا دارد و هیچ پیامی حرف انگلیسی ندارد", () => {
    const mapped = KNOWN_REQUEST_ERRORS.map((item) => item.message);
    expect(new Set(mapped).size).toBe(mapped.length);
    for (const message of mapped) {
      expect(message).not.toMatch(HAS_LATIN_LETTER);
    }
  });

  it("فهرست متن‌ها دقیقاً همان raise exceptionهای migration است", () => {
    const raised = readRaisedTexts();
    expect(raised.length).toBeGreaterThan(0);
    expect(KNOWN_REQUEST_ERRORS.map((item) => item.dbText).sort()).toEqual([...raised].sort());
  });

  it("محدودیت نرخ فارسی و دیدنی می‌ماند و متنش همان متن پایگاه داده است", () => {
    const rateLimit = KNOWN_REQUEST_ERRORS.find((item) => item.message === messages.rateLimit);
    expect(rateLimit?.dbText).toBe(messages.rateLimit);
    expect(mapRequestError({ code: "P0001", message: messages.rateLimit })).toEqual({ field: "form", message: messages.rateLimit });
  });

  it("متن شناخته‌شده فقط با کد P0001 تبدیل می‌شود", () => {
    const [first] = KNOWN_REQUEST_ERRORS;
    expect(mapRequestError({ code: "42501", message: first.dbText }).message).toBe(messages.requestFailed);
  });

  it("هم‌پوشانی (23P01) یعنی ساعت پر شده است", () => {
    expect(mapRequestError({ code: "23P01", message: RAW_ENGLISH[1].message })).toEqual({ field: "time", message: messages.slotTaken });
  });

  it("خطای ناشناخته پیام کلی می‌دهد که می‌گوید چه کنید، و متن انگلیسی نشان نمی‌دهد", () => {
    for (const raw of RAW_ENGLISH.filter((item) => item.code !== "23P01")) {
      const mapped = mapRequestError(raw);
      expect(mapped).toEqual({ field: "form", message: messages.requestFailed });
      expect(mapped.message).not.toContain(raw.message);
      expect(mapped.message).not.toMatch(HAS_LATIN_LETTER);
    }
    expect(messages.requestFailed).toContain("با مطب تماس بگیرید");
  });

  it("خطای تهی یا بدون کد هم پیام کلی می‌دهد", () => {
    expect(mapRequestError(null).message).toBe(messages.requestFailed);
    expect(mapRequestError(undefined).message).toBe(messages.requestFailed);
    expect(mapRequestError({}).message).toBe(messages.requestFailed);
  });
});
