import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * تغییر نام فقط یک RPC (`replace_appointment`) صدا می‌زند. شبکه و پایگاه داده جعلی‌اند؛ سنجیده می‌شود چه آرگومانی می‌رود،
 * خطا چه پیامی می‌شود، و در خطا هیچ نوشتن جداگانه‌ای (لغو یا درجِ دستی) اجرا نمی‌شود.
 */
const mocks = vi.hoisted(() => ({
  saveEmptyPatientExtras: vi.fn(),
  loadPatient: vi.fn(),
  findClinicForMoment: vi.fn(),
  insertAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));
vi.mock("./write-helpers", () => ({
  APPOINTMENT_NOT_FOUND_MESSAGE: "نوبت پیدا نشد.",
  PICKED_PATIENT_INVALID_MESSAGE: "مراجع نامعتبر است.",
  STATUS_CHANGED_MESSAGE: "وضعیت عوض شده است.",
  logDbError: vi.fn(),
  findOrCreatePatient: vi.fn(),
  ...mocks,
}));

import { renameAppointment } from "./actions";
import { MANUAL_OVERLAP_MESSAGE, PAST_EDIT_LOCKED_MESSAGE } from "./data";
import {
  APPOINTMENT_INPUT_INVALID_MESSAGE,
  APPOINTMENT_OR_PATIENT_NOT_FOUND_MESSAGE,
  APPOINTMENT_STATUS_CHANGED_MESSAGE,
  DB_WRITE_FAILED_MESSAGE,
} from "./db-errors";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const OLD_APPOINTMENT_ID = "22222222-2222-4222-8222-222222222222";

const input = {
  dateKey: "2030-01-15",
  time: "10:00",
  durationMinutes: 30,
  contactMobile: "09123456789",
  patientId: PATIENT_ID,
};

/** مثل پاسخ `PostgrestError`: فقط `code` و متن خام انگلیسی؛ متن خام نباید به کاربر برسد. */
function dbError(code: string) {
  return { data: null, error: { code, message: `raw english text for ${code}`, details: null } };
}

function expectNoSeparateWrites() {
  expect(mocks.updateAppointment).not.toHaveBeenCalled();
  expect(mocks.insertAppointment).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPatient.mockResolvedValue({ ok: true, patientId: PATIENT_ID, fullName: "مراجع آزمون", birthDate: null, gender: null });
  mocks.findClinicForMoment.mockResolvedValue({ ok: true, clinicId: null });
  mocks.saveEmptyPatientExtras.mockResolvedValue({ ok: true, message: "" });
  mocks.rpc.mockResolvedValue({ data: "33333333-3333-4333-8333-333333333333", error: null });
});

describe("renameAppointment با RPC replace_appointment", () => {
  it("RPC را یک‌بار و با آرگومان‌های دقیق صدا می‌زند و همان نتیجهٔ موفق قبلی را می‌دهد", async () => {
    const result = await renameAppointment(OLD_APPOINTMENT_ID, { ...input, note: "  یادداشت آزمون  " });

    expect(result).toEqual({ ok: true, message: "نوبت تازه ثبت شد و نوبت قبلی لغو شد." });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("replace_appointment", {
      p_appointment_id: OLD_APPOINTMENT_ID,
      p_patient_id: PATIENT_ID,
      // ۱۰:۰۰ وقت تهران (UTC+3:30، بدون ساعت تابستانی) و مدت ۳۰ دقیقه.
      p_starts_at: "2030-01-15T06:30:00.000Z",
      p_ends_at: "2030-01-15T07:00:00.000Z",
      p_requester_mobile: "09123456789",
      p_note: "یادداشت آزمون",
    });
    expectNoSeparateWrites();
  });

  it.each([undefined, "", "   "])("یادداشت خالی (%j) به‌صورت undefined می‌رود، نه null", async (note) => {
    const result = await renameAppointment(OLD_APPOINTMENT_ID, { ...input, note });

    expect(result.ok).toBe(true);
    const args = mocks.rpc.mock.calls[0][1] as { p_note?: string | null };
    expect(args.p_note).toBeUndefined();
    expect(args.p_note).not.toBeNull();
  });

  it("هم‌پوشانی (23P01) پیام هم‌پوشانی ثبت دستی را می‌دهد و هیچ لغو یا درج جداگانه‌ای نمی‌شود", async () => {
    mocks.rpc.mockResolvedValue(dbError("23P01"));

    const result = await renameAppointment(OLD_APPOINTMENT_ID, input);

    expect(result).toEqual({ ok: false, message: MANUAL_OVERLAP_MESSAGE });
    expectNoSeparateWrites();
  });

  it("نوبتِ عوض‌شده (55000) پیام فارسی ثابت می‌دهد و هیچ لغو یا درج جداگانه‌ای نمی‌شود", async () => {
    mocks.rpc.mockResolvedValue(dbError("55000"));

    const result = await renameAppointment(OLD_APPOINTMENT_ID, input);

    expect(result).toEqual({ ok: false, message: APPOINTMENT_STATUS_CHANGED_MESSAGE });
    expectNoSeparateWrites();
  });

  it.each([
    ["P0002", APPOINTMENT_OR_PATIENT_NOT_FOUND_MESSAGE],
    ["22023", APPOINTMENT_INPUT_INVALID_MESSAGE],
    ["P0001", PAST_EDIT_LOCKED_MESSAGE],
    ["42501", DB_WRITE_FAILED_MESSAGE],
  ])("خطای %s پیام فارسی ثابتِ خودش را می‌دهد و متن خام پایگاه داده نمی‌رسد", async (code, expected) => {
    mocks.rpc.mockResolvedValue(dbError(code));

    const result = await renameAppointment(OLD_APPOINTMENT_ID, input);

    expect(result).toEqual({ ok: false, message: expected });
    expect(result.message).not.toMatch(/[A-Za-z]/);
    expectNoSeparateWrites();
  });

  it("استثنای RPC (مثلاً قطع شبکه) پیام عمومی می‌دهد و چیزی جداگانه نوشته نمی‌شود", async () => {
    mocks.rpc.mockRejectedValue(new Error("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await renameAppointment(OLD_APPOINTMENT_ID, input);

    expect(result).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
    expectNoSeparateWrites();
  });

  it("خطای ورودی پیش از RPC برمی‌گردد و RPC اصلاً صدا زده نمی‌شود", async () => {
    const result = await renameAppointment(OLD_APPOINTMENT_ID, { ...input, contactMobile: "123" });

    expect(result.ok).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expectNoSeparateWrites();
  });
});
