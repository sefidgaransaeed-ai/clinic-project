import { describe, expect, it } from "vitest";
import { financeErrorMessage } from "@/modules/finance/db-errors";

const FALLBACK = "ثبت نشد.";

describe("financeErrorMessage — خطای پایگاه داده به پیام فارسی", () => {
  it("معکوس دوباره (یکتایی reverses_payment_id)", () => {
    const error = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "payments_reverses_payment_id_key"',
      details: "Key (reverses_payment_id)=(…) already exists.",
    };
    expect(financeErrorMessage(error, FALLBACK)).toBe("این پرداخت قبلاً معکوس شده است.");
  });

  it("نام تکراری بیمه یا روش پرداخت", () => {
    const error = { code: "23505", message: 'duplicate key value violates unique constraint "insurance_types_name_key"' };
    expect(financeErrorMessage(error, FALLBACK)).toBe("این نام در فهرست هست.");
  });

  it("پیام فارسی trigger همان‌طور می‌رسد (H-2)", () => {
    const error = { code: "P0001", message: "مبلغ ثبت معکوس باید دقیقاً قرینهٔ مبلغ اصلی باشد." };
    expect(financeErrorMessage(error, FALLBACK)).toBe(error.message);
  });

  it("پیام انگلیسی هرگز به کاربر نمی‌رسد", () => {
    expect(financeErrorMessage({ code: "P0001", message: "something failed" }, FALLBACK)).toBe(FALLBACK);
    expect(financeErrorMessage({ code: "08006", message: "connection failure" }, FALLBACK)).toBe(FALLBACK);
  });

  it("RLS: نقش اجازه ندارد", () => {
    const error = { code: "42501", message: 'new row violates row-level security policy for table "payments"' };
    expect(financeErrorMessage(error, FALLBACK)).toBe("اجازهٔ این کار را ندارید.");
  });
});
