import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ماژول‌های `server-only` (write-helpers، auth، کلاینت Supabase) جعلی می‌شوند، پس `actions.ts` بی‌آنکه چیزی از
 * پایگاه داده یا `server-only` واقعی بارگذاری شود اجرا می‌شود و فقط رفتار اکشن‌ها سنجیده می‌شود.
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

import { bookManualAppointment, renameAppointment } from "./actions";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const OLD_APPOINTMENT_ID = "22222222-2222-4222-8222-222222222222";

/** مراجعِ انتخاب‌شده با `extras` که هر دو فیلدش در پرونده خالی است؛ اگر کسی ذخیره‌شان کند، `birth_date` و `gender` می‌رسند. */
const input = {
  dateKey: "2030-01-15",
  time: "10:00",
  durationMinutes: 30,
  contactMobile: "09123456789",
  patientId: PATIENT_ID,
  extras: { birth_date: "12/05/1370", gender: "female" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadPatient.mockResolvedValue({ ok: true, patientId: PATIENT_ID, fullName: "مراجع آزمون", birthDate: null, gender: null });
  mocks.findClinicForMoment.mockResolvedValue({ ok: true, clinicId: null });
  mocks.saveEmptyPatientExtras.mockResolvedValue({ ok: true, message: "" });
  mocks.updateAppointment.mockResolvedValue({ ok: true, message: "" });
  mocks.insertAppointment.mockResolvedValue({ ok: true, message: "" });
  mocks.rpc.mockResolvedValue({ data: "new-appointment-id", error: null });
});

describe("extras در ثبت نوبت دستی و تغییر نام", () => {
  it("تغییر نام، extras را نادیده می‌گیرد و هیچ داده‌ای در پروندهٔ مراجع نمی‌نویسد، ولی بقیهٔ مراحل را انجام می‌دهد", async () => {
    const result = await renameAppointment(OLD_APPOINTMENT_ID, input);

    expect(result.ok).toBe(true);
    // اگر صدا زده شود هم باید با `{}` باشد (بی‌اثر)؛ هر ستونِ پر یعنی نوشتن در پرونده.
    for (const call of mocks.saveEmptyPatientExtras.mock.calls) {
      expect(call[2]).toEqual({});
    }
    // لغو و درج در یک RPC است؛ مسیر قدیمیِ دو نوشتنِ جدا دیگر صدا زده نمی‌شود.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.updateAppointment).not.toHaveBeenCalled();
    expect(mocks.insertAppointment).not.toHaveBeenCalled();
  });

  it("ثبت نوبت دستی با همان ورودی مثل قبل فقط فیلدهای خالی را برای ذخیره می‌فرستد", async () => {
    const result = await bookManualAppointment(input);

    expect(result.ok).toBe(true);
    expect(mocks.saveEmptyPatientExtras).toHaveBeenCalledWith(expect.anything(), PATIENT_ID, {
      birth_date: "1991-08-03",
      gender: "female",
    });
    expect(mocks.insertAppointment).toHaveBeenCalledTimes(1);
  });
});
