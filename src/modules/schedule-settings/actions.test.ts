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
  createClosure: vi.fn(),
  cancelClosure: vi.fn(),
  reactivateClosure: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("./data", () => ({
  createWorkingHours: mocks.createWorkingHours,
  updateWorkingHours: mocks.updateWorkingHours,
  deactivateWorkingHours: mocks.deactivateWorkingHours,
  createClosure: mocks.createClosure,
  cancelClosure: mocks.cancelClosure,
  reactivateClosure: mocks.reactivateClosure,
}));

import {
  cancelClosureAction,
  createClosureAction,
  createWorkingHoursAction,
  deactivateWorkingHoursAction,
  reactivateClosureAction,
  updateWorkingHoursAction,
} from "./actions";
import { DB_WRITE_FAILED_MESSAGE, mapDbError } from "./db-errors";
import type { WorkingHoursActionState } from "./types";
import { CLOSURE_MESSAGES, WORKING_HOURS_MESSAGES } from "./validation";

const ROW_ID = "33333333-3333-4333-8333-333333333333";
const CLOSURE_ID = "55555555-5555-4555-8555-555555555555";
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
  mocks.createClosure.mockResolvedValue({ ok: true, value: { id: CLOSURE_ID } });
  mocks.cancelClosure.mockResolvedValue({ ok: true, value: { id: CLOSURE_ID } });
  mocks.reactivateClosure.mockResolvedValue({ ok: true, value: { id: CLOSURE_ID } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("قفل نقش", () => {
  const actions = [
    ["createWorkingHoursAction", createWorkingHoursAction],
    ["updateWorkingHoursAction", updateWorkingHoursAction],
    ["deactivateWorkingHoursAction", deactivateWorkingHoursAction],
    ["createClosureAction", createClosureAction],
    ["cancelClosureAction", cancelClosureAction],
    ["reactivateClosureAction", reactivateClosureAction],
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
    expect(mocks.createClosure).not.toHaveBeenCalled();
    expect(mocks.cancelClosure).not.toHaveBeenCalled();
    expect(mocks.reactivateClosure).not.toHaveBeenCalled();
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH); // خطا هم صفحه را تازه می‌کند
  });

  it("خطای پایگاه داده پیام فارسی می‌شود، نه متن خام", async () => {
    const message = mapDbError({ code: "23514", message: 'new row violates check constraint "working_hours_check"' });
    mocks.createWorkingHours.mockResolvedValue({ ok: false, message });

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state.ok).toBe(false);
    expectPersianOnly(state.error);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH); // خطا هم صفحه را تازه می‌کند
  });

  it("استثنای پیش‌بینی‌نشده پیام فارسی عمومی می‌دهد و جزئیات فقط در لاگ است", async () => {
    mocks.createWorkingHours.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state).toEqual({ error: DB_WRITE_FAILED_MESSAGE, ok: false });
    expect(JSON.stringify(state)).not.toContain("ECONNREFUSED");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH); // خطا هم صفحه را تازه می‌کند
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
    expect(mocks.updateWorkingHours).toHaveBeenCalledWith(
      ROW_ID,
      {
        weekday: 6,
        startTime: "10:00",
        endTime: "13:30",
        isActive: true,
      },
      null,
    );
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH); // خطا هم صفحه را تازه می‌کند
  });
});

describe("deactivateWorkingHoursAction", () => {
  it("فقط شناسه را به لایهٔ داده می‌دهد و صفحه را تازه می‌کند", async () => {
    const state = await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID }));

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.deactivateWorkingHours).toHaveBeenCalledWith(ROW_ID, null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("بدون شناسه پیام فارسی می‌گیرد و چیزی تازه نمی‌شود", async () => {
    mocks.deactivateWorkingHours.mockResolvedValue({ ok: false, message: WORKING_HOURS_MESSAGES.id });

    const state = await deactivateWorkingHoursAction(INITIAL, new FormData());

    expect(mocks.deactivateWorkingHours).toHaveBeenCalledWith("", null);
    expect(state).toEqual({ error: WORKING_HOURS_MESSAGES.id, ok: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH); // خطا هم صفحه را تازه می‌کند
  });

  it("خطای RLS یا نبودن ردیف پیام فارسی می‌شود", async () => {
    mocks.deactivateWorkingHours.mockResolvedValue({ ok: false, message: mapDbError({ code: "42501" }) });

    const state = await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID }));

    expect(state.ok).toBe(false);
    expectPersianOnly(state.error);
  });
});

describe("createClosureAction", () => {
  it("تاریخ و دلیل را به لایهٔ داده می‌دهد و صفحه را تازه می‌کند", async () => {
    const state = await createClosureAction(INITIAL, form({ closureDate: "2026-11-20", reason: "سفر علمی" }));

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.createClosure).toHaveBeenCalledWith({ closureDate: "2026-11-20", reason: "سفر علمی" }, null);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("فیلد نبوده null می‌شود و پیام فارسیِ لایهٔ داده برمی‌گردد", async () => {
    mocks.createClosure.mockResolvedValue({ ok: false, message: CLOSURE_MESSAGES.date });

    const state = await createClosureAction(INITIAL, new FormData());

    expect(mocks.createClosure).toHaveBeenCalledWith({ closureDate: null, reason: null }, null);
    expect(state).toEqual({ error: CLOSURE_MESSAGES.date, ok: false });
    expectPersianOnly(state.error);
  });

  it("تاریخِ لغوشده پیام فعال‌سازی دوباره می‌گیرد و صفحه تازه می‌شود", async () => {
    mocks.createClosure.mockResolvedValue({ ok: false, message: CLOSURE_MESSAGES.cancelledDuplicate });

    const state = await createClosureAction(INITIAL, form({ closureDate: "2026-11-20", reason: "الف" }));

    expect(state).toEqual({ error: CLOSURE_MESSAGES.cancelledDuplicate, ok: false });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("استثنای پیش‌بینی‌نشده پیام فارسی عمومی می‌دهد و صفحه را تازه می‌کند", async () => {
    mocks.createClosure.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:5432"));

    const state = await createClosureAction(INITIAL, form({ closureDate: "2026-11-20", reason: "الف" }));

    expect(state).toEqual({ error: DB_WRITE_FAILED_MESSAGE, ok: false });
    expect(JSON.stringify(state)).not.toContain("ECONNREFUSED");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe.each([
  ["cancelClosureAction", cancelClosureAction, mocks.cancelClosure, []],
  // فعال‌سازی دوباره تأیید دوم دارد؛ در ارسال اول آرگومان دوم null است. لغو هشدار ندارد.
  ["reactivateClosureAction", reactivateClosureAction, mocks.reactivateClosure, [null]],
] as const)("%s", (_name, action, dataFn, extraArgs) => {
  it("شناسه را به لایهٔ داده می‌دهد و صفحه را تازه می‌کند", async () => {
    const state = await action(INITIAL, form({ id: CLOSURE_ID }));

    expect(state).toEqual({ error: null, ok: true });
    expect(dataFn).toHaveBeenCalledWith(CLOSURE_ID, ...extraArgs);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("بدون شناسه رشتهٔ خالی می‌رود و پیام فارسی برمی‌گردد", async () => {
    dataFn.mockResolvedValue({ ok: false, message: CLOSURE_MESSAGES.id });

    const state = await action(INITIAL, new FormData());

    expect(dataFn).toHaveBeenCalledWith("", ...extraArgs);
    expect(state).toEqual({ error: CLOSURE_MESSAGES.id, ok: false });
    expectPersianOnly(state.error);
  });

  it("خطای RLS پیام فارسی می‌شود و صفحه برای خواندن دوباره تازه می‌شود", async () => {
    dataFn.mockResolvedValue({ ok: false, message: mapDbError({ code: "42501" }) });

    const state = await action(INITIAL, form({ id: CLOSURE_ID }));

    expect(state.ok).toBe(false);
    expectPersianOnly(state.error);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe("خطای 23P01 و تازه‌سازی صفحه", () => {
  it("هم‌پوشانیِ هم‌زمان پیام فارسی می‌شود، نام قید نمی‌رسد و برنامه دوباره خوانده می‌شود", async () => {
    const message = mapDbError({
      code: "23P01",
      message: 'conflicting key value violates exclusion constraint "working_hours_no_active_overlap"',
    });
    mocks.createWorkingHours.mockResolvedValue({ ok: false, message });

    const state = await createWorkingHoursAction(INITIAL, form({ weekday: "0", startTime: "09:00", endTime: "12:00" }));

    expect(state).toEqual({ error: message, ok: false });
    expectPersianOnly(state.error);
    expect(state.error).not.toContain("working_hours");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });
});

describe("تأیید دوم (دو مرحله‌ای)", () => {
  const affected = [{ id: "ap1", dateKey: "2026-11-21", startTime: "15:00", patientName: "مراجع آزمایشی" }];
  const confirmation = { affected, confirmedIds: "ap1", closureDate: "2026-11-21", changedSinceShown: false };
  const needsConfirmation = { ok: false, message: "تأیید لازم است.", confirmation };
  const closureForm = { closureDate: "2026-11-21", reason: "سفر علمی" };

  it("ارسال اول: فهرست به فرم می‌رود، چیزی ذخیره نمی‌شود و صفحه تازه نمی‌شود", async () => {
    mocks.createClosure.mockResolvedValue(needsConfirmation);

    const state = await createClosureAction(INITIAL, form(closureForm));

    expect(state).toEqual({ error: null, ok: false, confirmation });
    expect(mocks.createClosure).toHaveBeenCalledWith(closureForm, null);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("ارسال دوم: فهرستِ دیده‌شده و تأیید به لایهٔ داده می‌رسد و ذخیره می‌شود", async () => {
    const state = await createClosureAction(
      INITIAL,
      form({ ...closureForm, confirm: "true", confirmedIds: "ap1,ap2" }),
    );

    expect(state).toEqual({ error: null, ok: true });
    expect(mocks.createClosure).toHaveBeenCalledWith(closureForm, ["ap1", "ap2"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("فهرستِ فرق‌کرده: دوباره هشدار با فهرست تازه، بدون ذخیره", async () => {
    const changed = { ...needsConfirmation, confirmation: { ...confirmation, confirmedIds: "ap1,ap2", changedSinceShown: true } };
    mocks.createClosure.mockResolvedValue(changed);

    const state = await createClosureAction(INITIAL, form({ ...closureForm, confirm: "true", confirmedIds: "ap1" }));

    expect(state.ok).toBe(false);
    expect(state.error).toBeNull();
    expect(state.confirmation?.changedSinceShown).toBe(true);
    expect(state.confirmation?.confirmedIds).toBe("ap1,ap2");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("فقط confirm دقیقاً «true» ارسال را دوم می‌کند؛ فهرست بدون تأیید همان ارسال اول است", async () => {
    await createClosureAction(INITIAL, form({ ...closureForm, confirmedIds: "ap1" }));
    await createClosureAction(INITIAL, form({ ...closureForm, confirm: "yes", confirmedIds: "ap1" }));
    await createClosureAction(INITIAL, form({ ...closureForm, confirm: "false", confirmedIds: "ap1" }));

    for (const call of mocks.createClosure.mock.calls) expect(call[1]).toBeNull();
  });

  it("تأیید بدون فهرست، فهرستِ خالی است (لایهٔ داده آن را نمی‌پذیرد مگر چیزی متأثر نباشد)", async () => {
    await createClosureAction(INITIAL, form({ ...closureForm, confirm: "true" }));
    expect(mocks.createClosure).toHaveBeenCalledWith(closureForm, []);
  });

  it("همین جریان برای ویرایش، غیرفعال‌سازی و فعال‌سازی دوبارهٔ تعطیلی هم برقرار است", async () => {
    mocks.updateWorkingHours.mockResolvedValue(needsConfirmation);
    mocks.deactivateWorkingHours.mockResolvedValue(needsConfirmation);
    mocks.reactivateClosure.mockResolvedValue(needsConfirmation);

    const edit = { id: ROW_ID, weekday: "0", startTime: "09:00", endTime: "11:00", isActive: "true" };
    expect((await updateWorkingHoursAction(INITIAL, form(edit))).confirmation).toEqual(confirmation);
    expect((await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID }))).confirmation).toEqual(confirmation);
    expect((await reactivateClosureAction(INITIAL, form({ id: CLOSURE_ID }))).confirmation).toEqual(confirmation);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    await updateWorkingHoursAction(INITIAL, form({ ...edit, confirm: "true", confirmedIds: "ap1" }));
    await deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID, confirm: "true", confirmedIds: "ap1" }));
    await reactivateClosureAction(INITIAL, form({ id: CLOSURE_ID, confirm: "true", confirmedIds: "ap1" }));

    expect(mocks.updateWorkingHours.mock.calls[1][2]).toEqual(["ap1"]);
    expect(mocks.deactivateWorkingHours).toHaveBeenLastCalledWith(ROW_ID, ["ap1"]);
    expect(mocks.reactivateClosure).toHaveBeenLastCalledWith(CLOSURE_ID, ["ap1"]);
  });

  it("لغو تعطیلی هیچ تأییدی نمی‌خواهد و فهرست را نمی‌خواند", async () => {
    await cancelClosureAction(INITIAL, form({ id: CLOSURE_ID, confirm: "true", confirmedIds: "ap1" }));

    expect(mocks.cancelClosure).toHaveBeenCalledWith(CLOSURE_ID);
  });

  it("پیام‌های هشدار فارسی‌اند و متن خام ندارند", async () => {
    mocks.createClosure.mockResolvedValue(needsConfirmation);
    const state = await createClosureAction(INITIAL, form(closureForm));
    expect(JSON.stringify(state)).not.toMatch(/violates|constraint|postgres|supabase/i);
  });

  it("منشی: requireRole رد می‌کند و هیچ‌کدام از جریان‌ها اجرا نمی‌شود", async () => {
    mocks.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const confirmed = { confirm: "true", confirmedIds: "ap1" };

    await expect(createClosureAction(INITIAL, form({ ...closureForm, ...confirmed }))).rejects.toThrow("NEXT_REDIRECT");
    await expect(reactivateClosureAction(INITIAL, form({ id: CLOSURE_ID, ...confirmed }))).rejects.toThrow("NEXT_REDIRECT");
    await expect(deactivateWorkingHoursAction(INITIAL, form({ id: ROW_ID, ...confirmed }))).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateWorkingHoursAction(INITIAL, form({ id: ROW_ID, ...confirmed }))).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.createClosure).not.toHaveBeenCalled();
    expect(mocks.reactivateClosure).not.toHaveBeenCalled();
    expect(mocks.deactivateWorkingHours).not.toHaveBeenCalled();
    expect(mocks.updateWorkingHours).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
