import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * آزمون Server Actionها فقط با mock؛ هیچ شبکه، پایگاه داده یا Supabase واقعی در کار نیست.
 * `data.ts` کاملاً جعلی است؛ آنچه می‌سنجیم نقش، تبدیل FormData، پیام فارسی و تازه‌سازی صفحه است.
 */

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  createWorkingHours: vi.fn(),
  updateWorkingHours: vi.fn(),
  deactivateWorkingHours: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("./data", () => ({
  createWorkingHours: mocks.createWorkingHours,
  updateWorkingHours: mocks.updateWorkingHours,
  deactivateWorkingHours: mocks.deactivateWorkingHours,
}));

import { createWorkingHoursAction, deactivateWorkingHoursAction, updateWorkingHoursAction } from "./actions";
import { DB_WRITE_FAILED_MESSAGE, mapDbError } from "./db-errors";
import type { WorkingHoursActionState } from "./types";
import { WORKING_HOURS_MESSAGES } from "./validation";

const ROW_ID = "33333333-3333-4333-8333-333333333333";
const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const INITIAL: WorkingHoursActionState = { error: null, ok: false };
const PATH = "/panel/settings/schedule";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** هر جا که پیام برای کاربر است: فارسی باشد و نه انگلیسیِ خام پایگاه داده. */
function expectPersianOnly(message: string | null) {
  expect(message).toMatch(/[؀-ۿ]/);
  expect(message).not.toMatch(/relation|violates|constraint|postgres|supabase|duplicate key|permission denied/i);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ id: "doctor-1", role: "doctor" });
  mocks.createWorkingHours.mockResolvedValue({ ok: true, value: { id: ROW_ID } });
  mocks.updateWorkingHours.mockResolvedValue({ ok: true, value: { id: ROW_ID } });
  mocks.deactivateWorkingHours.mockResolvedValue({ ok: true, value: { id: ROW_ID } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("قفل نقش", () => {
  const actions = [
    ["createWorkingHoursAction", createWorkingHoursAction],
    ["updateWorkingHoursAction", updateWorkingHoursAction],
    ["deactivateWorkingHoursAction", deactivateWorkingHoursAction],
  ] as const;

  it.each(actions)("%s خط اولش requireRole برای پزشک است", async (_name, action) => {
    await action(INITIAL, form({ id: ROW_ID, weekday: "0", startTime: "09:00", endTime: "12:00", isActive: "true" }));
    expect(mocks.requireRole).toHaveBeenCalledWith(["doctor"]);
  });

  it.each(actions)("%s برای منشی هیچ نوشتنی نمی‌کند", async (_name, action) => {
    // `requireRole` منشی را با redirect رد می‌کند، یعنی یک استثنا می‌اندازد.
    mocks.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      action(INITIAL, form({ id: ROW_ID, weekday: "0", startTime: "09:00", endTime: "12:00", isActive: "true" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createWorkingHours).not.toHaveBeenCalled();
    expect(mocks.updateWorkingHours).not.toHaveBeenCalled();
    expect(mocks.deactivateWorkingHours).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createWorkingHoursAction", () => {
  it("موفقیت: ok برمی‌گرداند و صفحه را تازه می‌کند", async () => {
    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("clinicId را فقط وقتی می‌فرستد که فیلد در فرم باشد و مقدار داشته باشد", async () => {
    await createWorkingHoursAction(INITIAL, form({ weekday: "2", startTime: "09:00", endTime: "12:00" }));
    expect(mocks.createWorkingHours.mock.calls[0][0]).not.toHaveProperty("clinicId");

    await createWorkingHoursAction(INITIAL, form({ weekday: "2", startTime: "09:00", endTime: "12:00", clinicId: "" }));
    expect(mocks.createWorkingHours.mock.calls[1][0]).not.toHaveProperty("clinicId");

    await createWorkingHoursAction(
      INITIAL,
      form({ weekday: "2", startTime: "09:00", endTime: "12:00", clinicId: CLINIC_ID }),
    );
    expect(mocks.createWorkingHours.mock.calls[2][0]).toMatchObject({ weekday: 2, clinicId: CLINIC_ID, isActive: true });
  });

  it("روز را عدد می‌کند و بازهٔ تازه را فعال می‌سازد", async () => {
    await createWorkingHoursAction(INITIAL, form({ weekday: "4", startTime: "14:15", endTime: "18:00" }));

    expect(mocks.createWorkingHours).toHaveBeenCalledWith({
      weekday: 4,
      startTime: "14:15",
      endTime: "18:00",
      isActive: true,
    });
  });

  it("FormData ناقص یا خراب به لایهٔ داده می‌رود و پیام فارسی می‌گیرد", async () => {
    // لایهٔ داده سنجش واقعی را می‌کند؛ اینجا همان پیام فارسیِ آن را جعل می‌کنیم.
    mocks.createWorkingHours.mockResolvedValue({ ok: false, message: WORKING_HOURS_MESSAGES.weekday });

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "abc", startTime: "09:00" }));

    expect(mocks.createWorkingHours).toHaveBeenCalledWith({
      weekday: "abc",
      startTime: "09:00",
      endTime: null,
      isActive: true,
    });
    expect(state).toEqual({ error: WORKING_HOURS_MESSAGES.weekday, ok: false });
    expectPersianOnly(state.error);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("خطای پایگاه داده پیام فارسی می‌شود، نه متن خام", async () => {
    const message = mapDbError({ code: "23514", message: 'new row violates check constraint "working_hours_check"' });
    mocks.createWorkingHours.mockResolvedValue({ ok: false, message });

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state.ok).toBe(false);
    expectPersianOnly(state.error);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("استثنای پیش‌بینی‌نشده پیام فارسی عمومی می‌دهد و جزئیات فقط در لاگ است", async () => {
    mocks.createWorkingHours.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state).toEqual({ error: DB_WRITE_FAILED_MESSAGE, ok: false });
    expect(JSON.stringify(state)).not.toContain("ECONNREFUSED");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateWorkingHoursAction", () => {
  it("شناسه را جدا و هرگز clinicId را نمی‌فرستد، حتی اگر در فرم باشد", async () => {
    const state = await updateWorkingHoursAction(
      INITIAL,
      form({
        id: ROW_ID,
        weekday: "6",
        startTime: "10:00",
        endTime: "13:30",
        isActive: "true",
        clinicId: CLINIC_ID,
      }),
    );

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.updateWorkingHours).toHaveBeenCalledWith(ROW_ID, {
      weekday: 6,
      startTime: "10:00",
      endTime: "13:30",
      isActive: true,
    });
    expect(mocks.updateWorkingHours.mock.calls[0][1]).not.toHaveProperty("clinicId");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("isActive را از «true» و «false» به بولین می‌برد", async () => {
    await updateWorkingHoursAction(
      INITIAL,
      form({ id: ROW_ID, weekday: "0", startTime: "09:00", endTime: "12:00", isActive: "false" }),
    );
    expect(mocks.updateWorkingHours.mock.calls[0][1]).toMatchObject({ isActive: false });
  });

  it("بدون شناسه، رشتهٔ خالی می‌رود و پیام فارسیِ لایهٔ داده برمی‌گردد", async () => {
    mocks.updateWorkingHours.mockResolvedValue({ ok: false, message: WORKING_HOURS_MESSAGES.id });

    const state = await updateWorkingHoursAction(INITIAL, new FormData());

    expect(mocks.updateWorkingHours.mock.calls[0][0]).toBe("");
    expect(state).toEqual({ error: WORKING_HOURS_MESSAGES.id, ok: false });
    expectPersianOnly(state.error);
  });

  it("خطای هم‌پوشانی با پیام فارسی به فرم می‌رسد", async () => {
    const message = "این بازه با ساعت کاری ثبت‌شدهٔ دیگری در همین روز (۰۹:۰۰ تا ۱۲:۰۰) هم‌پوشانی دارد.";
    mocks.updateWorkingHours.mockResolvedValue({ ok: false, message });

    const state = await updateWorkingHoursAction(
      INITIAL,
      form({ id: ROW_ID, weekday: "0", startTime: "09:00", endTime: "12:00", isActive: "true" }),
    );

    expect(state).toEqual({ error: message, ok: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deactivateWorkingHoursAction", () => {
  it("فقط شناسه را به لایهٔ داده می‌دهد و صفحه را تازه می‌کند", async () => {
    const state = await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID }));

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.deactivateWorkingHours).toHaveBeenCalledWith(ROW_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("بدون شناسه پیام فارسی می‌گیرد و چیزی تازه نمی‌شود", async () => {
    mocks.deactivateWorkingHours.mockResolvedValue({ ok: false, message: WORKING_HOURS_MESSAGES.id });

    const state = await deactivateWorkingHoursAction(INITIAL, new FormData());

    expect(mocks.deactivateWorkingHours).toHaveBeenCalledWith("");
    expect(state).toEqual({ error: WORKING_HOURS_MESSAGES.id, ok: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("خطای RLS یا نبودن ردیف پیام فارسی می‌شود", async () => {
    mocks.deactivateWorkingHours.mockResolvedValue({ ok: false, message: mapDbError({ code: "42501" }) });

    const state = await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID }));

    expect(state.ok).toBe(false);
    expectPersianOnly(state.error);
  });
});
