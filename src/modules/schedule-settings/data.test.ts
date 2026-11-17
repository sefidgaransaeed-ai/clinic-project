import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * آزمون لایهٔ داده فقط با mock؛ هیچ شبکه و هیچ پایگاه داده‌ای در کار نیست.
 * «کلاینت» جعلی هر `from(table)` را با نتیجه‌ای از صف همان جدول جواب می‌دهد و همهٔ فراخوانی‌ها را ثبت می‌کند.
 */

const mocks = vi.hoisted(() => ({
  getPanelUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getPanelUser: mocks.getPanelUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import * as data from "./data";
import {
  CLOSURE_NOT_FOUND_MESSAGE,
  DB_READ_FAILED_MESSAGE,
  DB_WRITE_FAILED_MESSAGE,
  NOT_ALLOWED_MESSAGE,
  ROW_NOT_FOUND_MESSAGE,
  WORKING_HOURS_OVERLAP_DB_MESSAGE,
} from "./db-errors";
import { CLOSURE_MESSAGES, WORKING_HOURS_MESSAGES } from "./validation";

const DOCTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CLINIC_ID = "22222222-2222-4222-8222-222222222222";
const ROW_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ROW_ID = "44444444-4444-4444-8444-444444444444";

/** دو مطب آزمایشی؛ اگر آزمونی صفِ `clinics` نداده باشد، همین‌ها برمی‌گردند. */
const DEFAULT_CLINICS = [
  { id: CLINIC_ID, name: "مطب آزمایشی یک" },
  { id: OTHER_CLINIC_ID, name: "مطب آزمایشی دو" },
];

type Op = [method: string, args: unknown[]];
type Call = { table: string; ops: Op[] };
type Result = { data?: unknown; error?: { code?: string; message?: string; details?: string } | null };

let calls: Call[];

function useFakeClient(queues: Record<string, Result[]>) {
  calls = [];
  mocks.createClient.mockResolvedValue({
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const result = queues[table]?.shift() ?? (table === "clinics" ? { data: DEFAULT_CLINICS } : table === "appointments" ? { data: [] } : undefined);
      if (!result) throw new Error(`نتیجهٔ آماده‌ای برای ${table} نیست`);
      const query: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
                Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
            }
            if (typeof prop !== "string") return undefined;
            return (...args: unknown[]) => {
              call.ops.push([prop, args]);
              return query;
            };
          },
        },
      );
      return query;
    },
  });
}

const allMethods = () => calls.flatMap((call) => call.ops.map(([method]) => method));
const opArgs = (table: string, method: string) =>
  calls
    .filter((call) => call.table === table)
    .flatMap((call) => call.ops)
    .find(([name]) => name === method)?.[1];

function asDoctor() {
  mocks.getPanelUser.mockResolvedValue({ id: DOCTOR_ID, role: "doctor", fullName: "پزشک آزمایشی" });
}

const goodHours = { clinicId: CLINIC_ID, weekday: 0, startTime: "14:00", endTime: "18:00", isActive: true };
const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: OTHER_ROW_ID,
  clinic_id: CLINIC_ID,
  weekday: 0,
  start_time: "14:00:00",
  end_time: "18:00:00",
  is_active: true,
  clinics: { name: "مطب آزمایشی" },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  calls = [];
  asDoctor();
});

describe("سطح عمومی ماژول", () => {
  it("هیچ تابع حذفی ندارد", () => {
    expect(Object.keys(data).sort()).toEqual([
      "cancelClosure",
      "createClosure",
      "createWorkingHours",
      "deactivateWorkingHours",
      "listClinics",
      "listClosures",
      "listWorkingHours",
      "reactivateClosure",
      "updateWorkingHours",
    ]);
  });
});

describe("listWorkingHours", () => {
  it("ردیف‌ها را با نام مطب می‌خواند، ثانیه را حذف می‌کند و reminder_hour را نمی‌خواهد", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }] });

    const result = await data.listWorkingHours();

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: OTHER_ROW_ID,
          clinicId: CLINIC_ID,
          clinicName: "مطب آزمایشی",
          weekday: 0,
          startTime: "14:00",
          endTime: "18:00",
          isActive: true,
        },
      ],
    });
    const [columns] = opArgs("working_hours", "select") as [string];
    expect(columns).toContain("clinics(name)");
    expect(columns).not.toContain("reminder_hour");
  });

  it("مطبِ خالی را null برمی‌گرداند", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ clinic_id: null, clinics: null })] }] });
    const result = await data.listWorkingHours();
    expect(result.ok && result.value[0]).toMatchObject({ clinicId: null, clinicName: null });
  });

  it("خطای پایگاه داده را به پیام فارسی تبدیل می‌کند و متن خام را نشان نمی‌دهد", async () => {
    useFakeClient({ working_hours: [{ error: { code: "XX000", message: "connection refused to db.internal" } }] });
    expect(await data.listWorkingHours()).toEqual({ ok: false, message: DB_READ_FAILED_MESSAGE });
  });
});

describe("listClinics", () => {
  it("مطب‌های فعال را به ترتیب sort_order و فقط با id و name می‌خواند (برای فرمِ انتخاب مطب)", async () => {
    useFakeClient({ clinics: [{ data: DEFAULT_CLINICS }] });

    expect(await data.listClinics()).toEqual({ ok: true, value: DEFAULT_CLINICS });
    expect(opArgs("clinics", "select")).toEqual(["id, name"]);
    expect(opArgs("clinics", "eq")).toEqual(["is_active", true]);
    expect(opArgs("clinics", "order")).toEqual(["sort_order", { ascending: true }]);
    expect(allMethods()).not.toContain("delete");
  });

  it("خطا را به پیام فارسی تبدیل می‌کند", async () => {
    useFakeClient({ clinics: [{ error: { code: "XX000", message: "boom" } }] });
    expect(await data.listClinics()).toEqual({ ok: false, message: DB_READ_FAILED_MESSAGE });
  });
});

const closureRow = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  closure_date: "2026-11-20",
  reason: null,
  is_active: true,
  created_at: "2026-11-01T00:00:00Z",
  ...overrides,
});

describe("listClosures", () => {
  it("تعطیلی‌ها را می‌خواند و دلیلِ خالی را رشتهٔ خالی می‌کند", async () => {
    useFakeClient({ closures: [{ data: [closureRow()] }] });
    expect(await data.listClosures()).toEqual({
      ok: true,
      value: [{ id: "c1", closureDate: "2026-11-20", reason: "", isActive: true, createdAt: "2026-11-01T00:00:00Z" }],
    });
  });

  it("ستون is_active را می‌خواند و فعال و لغوشده را هر دو برمی‌گرداند (بدون فیلتر)", async () => {
    useFakeClient({
      closures: [{ data: [closureRow(), closureRow({ id: "c2", closure_date: "2026-11-21", is_active: false })] }],
    });

    const result = await data.listClosures();

    expect(result.ok && result.value.map((closure) => closure.isActive)).toEqual([true, false]);
    const [columns] = opArgs("closures", "select") as [string];
    expect(columns).toContain("is_active");
    expect(allMethods()).not.toContain("eq");
  });

  it("خطا را به پیام فارسی تبدیل می‌کند", async () => {
    useFakeClient({ closures: [{ error: { code: "XX000", message: "boom" } }] });
    expect(await data.listClosures()).toEqual({ ok: false, message: DB_READ_FAILED_MESSAGE });
  });
});

describe("createWorkingHours", () => {
  it("بازهٔ درست را با ستون‌های snake_case درج می‌کند", async () => {
    useFakeClient({ working_hours: [{ data: [] }, { data: { id: ROW_ID } }] });

    const result = await data.createWorkingHours({ ...goodHours, id: "باید نادیده گرفته شود" });

    expect(result).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "insert")).toEqual([
      { clinic_id: CLINIC_ID, weekday: 0, start_time: "14:00", end_time: "18:00", is_active: true },
    ]);
  });

  it("بدون clinicId مطب را از ردیف فعالِ همان روز می‌گیرد (پزشک مطب انتخاب نمی‌کند)", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }, { data: { id: ROW_ID } }] });

    const withoutClinic = { ...goodHours, clinicId: undefined };
    const result = await data.createWorkingHours({ ...withoutClinic, startTime: "18:00", endTime: "19:00" });

    expect(result).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "insert")).toEqual([
      { clinic_id: CLINIC_ID, weekday: 0, start_time: "18:00", end_time: "19:00", is_active: true },
    ]);
  });

  it("روزی که ردیف فعال ندارد (مثل دوشنبه) و clinicId نیامده رد می‌شود و پیام انتخاب مطب می‌دهد", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }] });

    const withoutClinic = { ...goodHours, clinicId: undefined };
    expect(await data.createWorkingHours({ ...withoutClinic, weekday: 2 })).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.clinicRequired,
    });
    expect(allMethods()).not.toContain("insert");
  });

  it("روزِ بی‌ردیف را با مطبِ انتخاب‌شده از فهرست مطب‌ها درج می‌کند", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }, { data: { id: ROW_ID } }] });

    const result = await data.createWorkingHours({ ...goodHours, weekday: 2, clinicId: OTHER_CLINIC_ID });

    expect(result).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "insert")).toEqual([
      { clinic_id: OTHER_CLINIC_ID, weekday: 2, start_time: "14:00", end_time: "18:00", is_active: true },
    ]);
  });

  it("مطبی که در فهرست مطب‌های فعال نیست رد می‌شود", async () => {
    useFakeClient({ working_hours: [{ data: [] }], clinics: [{ data: [DEFAULT_CLINICS[0]] }] });

    const result = await data.createWorkingHours({ ...goodHours, clinicId: OTHER_CLINIC_ID });

    expect(result).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
    expect(allMethods()).not.toContain("insert");
  });

  it("روزی که فقط ردیف غیرفعال دارد مثل روزِ بی‌ردیف است: مطب باید انتخاب شود", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ is_active: false })] }] });

    const withoutClinic = { ...goodHours, clinicId: undefined };
    expect(await data.createWorkingHours(withoutClinic)).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.clinicRequired,
    });
    expect(allMethods()).not.toContain("insert");
  });

  it("اگر خواندن مطب‌ها شکست بخورد، بدون نوشتن پیام فارسی می‌دهد", async () => {
    useFakeClient({ working_hours: [{ data: [] }], clinics: [{ error: { code: "XX000", message: "boom" } }] });

    expect(await data.createWorkingHours(goodHours)).toEqual({ ok: false, message: DB_READ_FAILED_MESSAGE });
    expect(allMethods()).not.toContain("insert");
  });

  it("مطبِ دومِ فعال در همان روز را رد می‌کند، حتی بدون هم‌پوشانی", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }] });

    const result = await data.createWorkingHours({
      ...goodHours,
      clinicId: OTHER_CLINIC_ID,
      startTime: "19:00",
      endTime: "20:00",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("هر روز فقط به یک مطب تعلق دارد");
    expect(allMethods()).not.toContain("insert");
  });

  it("منشی یا کاربر ناشناس را پیش از هر پرسشی رد می‌کند", async () => {
    useFakeClient({ working_hours: [] });

    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    expect(await data.createWorkingHours(goodHours)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    mocks.getPanelUser.mockResolvedValue(null);
    expect(await data.createWorkingHours(goodHours)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    expect(calls).toHaveLength(0);
  });

  it("ورودی نامعتبر را بدون هیچ نوشتنی رد می‌کند", async () => {
    useFakeClient({ working_hours: [{ data: [] }] });
    const result = await data.createWorkingHours({ ...goodHours, startTime: "18:00", endTime: "14:00" });
    expect(result).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.order });
    expect(allMethods()).not.toContain("insert");
  });

  it("بازهٔ هم‌پوشان با ردیف فعالِ هم‌روز و هم‌مطب را رد می‌کند", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow()] }] });
    const result = await data.createWorkingHours({ ...goodHours, startTime: "16:00", endTime: "19:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("هم‌پوشانی");
    expect(allMethods()).not.toContain("insert");
  });

  it("خطای RLS را به پیام «فقط پزشک» تبدیل می‌کند", async () => {
    useFakeClient({
      working_hours: [{ data: [] }, { error: { code: "42501", message: 'new row violates row-level security policy for table "working_hours"' } }],
    });
    expect(await data.createWorkingHours(goodHours)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
  });

  it("خطای ناشناخته پیام عمومی می‌دهد", async () => {
    useFakeClient({ working_hours: [{ data: [] }, { error: { code: "XX000", message: "internal" } }] });
    expect(await data.createWorkingHours(goodHours)).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
  });
});

describe("updateWorkingHours", () => {
  /** ویرایش بدون clinicId: مطب از خودِ ردیف می‌آید و فرم آن را نمی‌فرستد. */
  const edit = (overrides: Record<string, unknown> = {}) => ({
    weekday: 0,
    startTime: "14:00",
    endTime: "18:00",
    isActive: true,
    ...overrides,
  });

  it("ساعت را بدون clinicId ویرایش می‌کند؛ مطب نه پرسیده می‌شود، نه نوشته می‌شود", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: { id: ROW_ID } }] });

    const result = await data.updateWorkingHours(ROW_ID, edit({ endTime: "17:00" }));

    expect(result).toEqual({ ok: true, value: { id: ROW_ID } });
    const [payload] = opArgs("working_hours", "update") as [Record<string, unknown>];
    expect(payload).toEqual({ weekday: 0, start_time: "14:00", end_time: "17:00", is_active: true });
    expect(payload).not.toHaveProperty("clinic_id");
    const updateCall = calls.find((call) => call.table === "working_hours" && call.ops.some(([method]) => method === "update"));
    expect(updateCall?.ops).toContainEqual(["eq", ["id", ROW_ID]]);
    // فهرست مطب‌ها برای ویرایش خوانده نمی‌شود.
    expect(calls.map((call) => call.table)).not.toContain("clinics");
  });

  it("تنها ردیف فعالِ یک روز هم بدون clinicId ویرایش می‌شود", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: { id: ROW_ID } }] });
    expect(await data.updateWorkingHours(ROW_ID, edit({ startTime: "15:00" }))).toEqual({ ok: true, value: { id: ROW_ID } });
  });

  it("clinicIdِ هم‌مطب را می‌پذیرد (فرستادنش اشکالی ندارد، فقط لازم نیست)", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: { id: ROW_ID } }] });
    expect(await data.updateWorkingHours(ROW_ID, edit({ clinicId: CLINIC_ID }))).toEqual({ ok: true, value: { id: ROW_ID } });
  });

  it("clinicIdِ متفاوت را رد می‌کند و چیزی نمی‌نویسد", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }] });

    expect(await data.updateWorkingHours(ROW_ID, edit({ clinicId: OTHER_CLINIC_ID }))).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.clinicLocked,
    });
    expect(allMethods()).not.toContain("update");
  });

  it("غیرفعال‌کردن با ویرایش مطب را حفظ می‌کند و پرسشی ندارد", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: { id: ROW_ID } }] });

    expect(await data.updateWorkingHours(ROW_ID, edit({ isActive: false }))).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "update")).toEqual([
      { weekday: 0, start_time: "14:00", end_time: "18:00", is_active: false },
    ]);
  });

  it("فعال‌کردن دوباره با مطبِ ردیف سنجیده می‌شود: اگر روز به مطب دیگری رسیده باشد رد می‌شود", async () => {
    useFakeClient({
      working_hours: [
        {
          data: [
            dbRow({ id: ROW_ID, is_active: false }),
            dbRow({ id: OTHER_ROW_ID, clinic_id: OTHER_CLINIC_ID, clinics: { name: "مطب آزمایشی دو" }, start_time: "19:00:00", end_time: "20:00:00" }),
          ],
        },
      ],
    });

    const result = await data.updateWorkingHours(ROW_ID, edit({ isActive: true }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("هر روز فقط به یک مطب تعلق دارد");
    expect(allMethods()).not.toContain("update");
  });

  it("فعال‌کردن دوباره وقتی روز ردیف فعال دیگری ندارد بدون پرسش مطب انجام می‌شود", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID, is_active: false })] }, { data: { id: ROW_ID } }] });
    expect(await data.updateWorkingHours(ROW_ID, edit({ isActive: true }))).toEqual({ ok: true, value: { id: ROW_ID } });
  });

  it("هم‌پوشانی با ردیف دیگرِ همان مطب و همان روز را رد می‌کند", async () => {
    useFakeClient({
      working_hours: [
        { data: [dbRow({ id: ROW_ID, start_time: "18:00:00", end_time: "19:00:00" }), dbRow({ id: OTHER_ROW_ID })] },
      ],
    });
    const result = await data.updateWorkingHours(ROW_ID, edit({ startTime: "17:00", endTime: "19:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("هم‌پوشانی");
    expect(allMethods()).not.toContain("update");
  });

  it("ردیفِ مجاور (پایان = شروع بعدی) هم‌پوشانی نیست", async () => {
    useFakeClient({
      working_hours: [
        { data: [dbRow({ id: ROW_ID, start_time: "18:00:00", end_time: "19:00:00" }), dbRow({ id: OTHER_ROW_ID })] },
        { data: { id: ROW_ID } },
      ],
    });
    expect((await data.updateWorkingHours(ROW_ID, edit({ startTime: "18:00", endTime: "20:00" }))).ok).toBe(true);
  });

  it("ردیفِ بی‌مطبِ قدیمی ویرایش نمی‌شود (مطبی برای حفظ ندارد)", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID, clinic_id: null, clinics: null })] }] });
    expect(await data.updateWorkingHours(ROW_ID, edit())).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinicMissing });
    expect(allMethods()).not.toContain("update");
  });

  it("ردیفی که در فهرست نیست «شناخته نشد» می‌دهد و چیزی نمی‌نویسد", async () => {
    useFakeClient({ working_hours: [{ data: [] }] });
    expect(await data.updateWorkingHours(ROW_ID, edit())).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
    expect(allMethods()).not.toContain("update");
  });

  it("اگر ردیف هنگام نوشتن ناپدید شد (یا RLS پنهانش کرد) پیام «پیدا نشد» می‌دهد", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: null }] });
    expect(await data.updateWorkingHours(ROW_ID, edit())).toEqual({ ok: false, message: ROW_NOT_FOUND_MESSAGE });
  });

  it("شناسهٔ نامعتبر را بدون پرسش رد می‌کند", async () => {
    useFakeClient({ working_hours: [] });
    expect(await data.updateWorkingHours("1 or 1=1", goodHours)).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
    expect(calls).toHaveLength(0);
  });

  it("منشی نمی‌تواند", async () => {
    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    useFakeClient({ working_hours: [] });
    expect(await data.updateWorkingHours(ROW_ID, goodHours)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("deactivateWorkingHours", () => {
  it("فقط is_active را false می‌کند و هیچ‌وقت حذف نمی‌کند", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: { id: ROW_ID } }] });

    expect(await data.deactivateWorkingHours(ROW_ID)).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "update")).toEqual([{ is_active: false }]);
    expect(allMethods()).not.toContain("delete");
  });

  it("ردیف ناموجود (یا پنهان‌شده با RLS هنگام نوشتن) را «پیدا نشد» می‌گوید", async () => {
    useFakeClient({ working_hours: [{ data: [dbRow({ id: ROW_ID })] }, { data: null }] });
    expect(await data.deactivateWorkingHours(ROW_ID)).toEqual({ ok: false, message: ROW_NOT_FOUND_MESSAGE });
  });

  it("منشی و شناسهٔ نامعتبر را بدون پرسش رد می‌کند", async () => {
    useFakeClient({ working_hours: [] });
    expect(await data.deactivateWorkingHours("x")).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });

    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    expect(await data.deactivateWorkingHours(ROW_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("createClosure", () => {
  it("تعطیلی را با created_by پزشک درج می‌کند", async () => {
    useFakeClient({ closures: [{ data: [] }, { data: { id: "c1" } }], working_hours: [{ data: [] }] });

    const result = await data.createClosure({ closureDate: "2026-11-20", reason: " سفر علمی " });

    expect(result).toEqual({ ok: true, value: { id: "c1" } });
    expect(opArgs("closures", "insert")).toEqual([
      { closure_date: "2026-11-20", reason: "سفر علمی", created_by: DOCTOR_ID },
    ]);
    expect(allMethods()).not.toContain("delete");
  });

  it("تاریخِ تعطیلیِ فعال را پیش از درج رد می‌کند", async () => {
    useFakeClient({ closures: [{ data: [closureRow({ id: "c0", reason: "الف" })] }] });
    expect(await data.createClosure({ closureDate: "2026-11-20", reason: "ب" })).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.duplicate,
    });
    expect(allMethods()).not.toContain("insert");
  });

  it("تاریخِ تعطیلیِ لغوشده را رد می‌کند و پیام فعال‌سازی دوباره می‌دهد؛ درج یا به‌روزرسانی نمی‌کند", async () => {
    useFakeClient({ closures: [{ data: [closureRow({ id: "c0", is_active: false })] }] });
    expect(await data.createClosure({ closureDate: "2026-11-20", reason: "ب" })).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.cancelledDuplicate,
    });
    expect(allMethods()).not.toContain("insert");
    expect(allMethods()).not.toContain("update");
  });

  it("اگر هم‌زمان کس دیگری همان تاریخ را ثبت کرده بود، خطای ۲۳۵۰۵ پیام تکراری می‌شود", async () => {
    useFakeClient({
      closures: [
        { data: [] },
        { error: { code: "23505", message: 'duplicate key value violates unique constraint "closures_closure_date_key"' } },
      ],
      working_hours: [{ data: [] }],
    });
    expect(await data.createClosure({ closureDate: "2026-11-20", reason: "ب" })).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.duplicate,
    });
  });

  it("ورودی نامعتبر و منشی را رد می‌کند", async () => {
    useFakeClient({ closures: [{ data: [] }] });
    expect(await data.createClosure({ closureDate: "2026-02-30", reason: "الف" })).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.date,
    });

    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    expect(await data.createClosure({ closureDate: "2026-11-20", reason: "الف" })).toEqual({
      ok: false,
      message: NOT_ALLOWED_MESSAGE,
    });
    expect(allMethods()).not.toContain("insert");
  });
});

describe("cancelClosure", () => {
  const CLOSURE_ID = "55555555-5555-4555-8555-555555555555";

  it("فقط is_active را false می‌کند، با شناسهٔ همان ردیف؛ حذف و هشدار ندارد", async () => {
    useFakeClient({ closures: [{ data: { id: CLOSURE_ID } }] });

    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: true, value: { id: CLOSURE_ID } });
    expect(opArgs("closures", "update")).toEqual([{ is_active: false }]);
    expect(opArgs("closures", "eq")).toEqual(["id", CLOSURE_ID]);
    expect(allMethods()).not.toContain("delete");
    expect(allMethods()).not.toContain("insert");
    // لغو روز را باز می‌کند و نوبتی را بیرون برنامه نمی‌برد: نه نوبت‌ها خوانده می‌شوند، نه ساعت کاری.
    expect(calls.map((call) => call.table)).toEqual(["closures"]);
  });

  it("ردیفِ ناموجود یا پنهان‌شده با RLS «پیدا نشد» می‌گوید", async () => {
    useFakeClient({ closures: [{ data: null }] });
    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: false, message: CLOSURE_NOT_FOUND_MESSAGE });
  });

  it("خطای RLS و خطای ناشناخته پیام فارسی می‌شود و متن خام نمی‌رسد", async () => {
    useFakeClient({
      closures: [{ error: { code: "42501", message: 'new row violates row-level security policy for table "closures"' } }],
    });
    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    useFakeClient({ closures: [{ error: { code: "XX000", message: "internal" } }] });
    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
  });

  it("شناسهٔ نامعتبر و منشی را بدون هیچ پرسشی رد می‌کند", async () => {
    useFakeClient({ closures: [] });
    expect(await data.cancelClosure("1 or 1=1")).toEqual({ ok: false, message: CLOSURE_MESSAGES.id });

    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    mocks.getPanelUser.mockResolvedValue(null);
    expect(await data.cancelClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

/** ردیف نوبتِ تأییدشده آن‌طور که PostgREST برمی‌گرداند. شنبه ۲۰۲۶-۱۱-۲۱، ساعت تهران = UTC + ۳:۳۰. */
const apptRow = (id: string, startsAt: string, endsAt: string, overrides: Record<string, unknown> = {}) => ({
  id,
  starts_at: startsAt,
  ends_at: endsAt,
  clinic_id: CLINIC_ID,
  requester_name: null,
  patients: { full_name: "مراجع آزمایشی" },
  ...overrides,
});
/** ۱۵:۰۰ تا ۱۵:۳۰ تهران، شنبه: داخل برنامهٔ ۱۴:۰۰–۱۸:۰۰ آزمون. */
const INSIDE = ["2026-11-21T11:30:00Z", "2026-11-21T12:00:00Z"] as const;
/** ۲۰:۰۰ تا ۲۰:۳۰ تهران، شنبه: از قبل بیرون برنامه (استثنای پنلی). */
const OUTSIDE = ["2026-11-21T16:30:00Z", "2026-11-21T17:00:00Z"] as const;

describe("reactivateClosure", () => {
  const CLOSURE_ID = "55555555-5555-4555-8555-555555555555";
  const cancelled = closureRow({ id: CLOSURE_ID, closure_date: "2026-11-21", is_active: false });

  it("فقط is_active را true می‌کند و ردیف تازه نمی‌سازد (روز بدون نوبتِ متأثر)", async () => {
    useFakeClient({
      closures: [{ data: [cancelled] }, { data: { id: CLOSURE_ID } }],
      working_hours: [{ data: [dbRow()] }],
    });

    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: true, value: { id: CLOSURE_ID } });
    expect(opArgs("closures", "update")).toEqual([{ is_active: true }]);
    expect(opArgs("closures", "eq")).toEqual(["id", CLOSURE_ID]);
    expect(allMethods()).not.toContain("insert");
    expect(allMethods()).not.toContain("delete");
  });

  it("تعطیلیِ از پیش فعال هشدار نمی‌خواهد و نوبت‌ها خوانده نمی‌شوند", async () => {
    useFakeClient({
      closures: [{ data: [closureRow({ id: CLOSURE_ID, closure_date: "2026-11-21" })] }, { data: { id: CLOSURE_ID } }],
    });

    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: true, value: { id: CLOSURE_ID } });
    expect(calls.map((call) => call.table)).not.toContain("appointments");
  });

  it("شناسه‌ای که در فهرست نیست «پیدا نشد» می‌گوید و چیزی نمی‌نویسد", async () => {
    useFakeClient({ closures: [{ data: [] }] });
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: CLOSURE_NOT_FOUND_MESSAGE });
    expect(allMethods()).not.toContain("update");
  });

  it("اگر ردیف هنگام نوشتن ناپدید شد یا RLS پنهانش کرد «پیدا نشد» می‌گوید", async () => {
    useFakeClient({
      closures: [{ data: [cancelled] }, { data: null }],
      working_hours: [{ data: [dbRow()] }],
    });
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: CLOSURE_NOT_FOUND_MESSAGE });
  });

  it("خطای RLS و خطای ناشناخته پیام فارسی می‌شود و متن خام نمی‌رسد", async () => {
    useFakeClient({
      closures: [
        { data: [cancelled] },
        { error: { code: "42501", message: 'new row violates row-level security policy for table "closures"' } },
      ],
      working_hours: [{ data: [dbRow()] }],
    });
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    useFakeClient({
      closures: [{ data: [cancelled] }, { error: { code: "XX000", message: "internal" } }],
      working_hours: [{ data: [dbRow()] }],
    });
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
  });

  it("شناسهٔ نامعتبر و منشی را بدون هیچ پرسشی رد می‌کند", async () => {
    useFakeClient({ closures: [] });
    expect(await data.reactivateClosure("1 or 1=1")).toEqual({ ok: false, message: CLOSURE_MESSAGES.id });

    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });

    mocks.getPanelUser.mockResolvedValue(null);
    expect(await data.reactivateClosure(CLOSURE_ID)).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });

  it("روزی با نوبتِ تأییدشدهٔ داخل برنامه: ارسال اول فهرست می‌دهد و چیزی نمی‌نویسد", async () => {
    useFakeClient({
      closures: [{ data: [cancelled] }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    const result = await data.reactivateClosure(CLOSURE_ID);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      confirmation: { confirmedIds: "ap1", closureDate: "2026-11-21", changedSinceShown: false },
    });
    expect(allMethods()).not.toContain("update");
  });

  it("ارسال دوم با همان فهرست: فعال می‌شود", async () => {
    useFakeClient({
      closures: [{ data: [cancelled] }, { data: { id: CLOSURE_ID } }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    expect(await data.reactivateClosure(CLOSURE_ID, ["ap1"])).toEqual({ ok: true, value: { id: CLOSURE_ID } });
    expect(opArgs("closures", "update")).toEqual([{ is_active: true }]);
  });
});

describe("هشدار نوبت‌های متأثر: ثبت تعطیلی", () => {
  const closure = { closureDate: "2026-11-21", reason: "سفر علمی" };

  it("ارسال اول: فهرست (تاریخ، ساعت تهران و نام) برمی‌گردد و چیزی درج نمی‌شود", async () => {
    useFakeClient({
      closures: [{ data: [] }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    const result = await data.createClosure(closure);

    expect(result).toMatchObject({
      ok: false,
      confirmation: {
        affected: [{ id: "ap1", dateKey: "2026-11-21", startTime: "15:00", patientName: "مراجع آزمایشی" }],
        confirmedIds: "ap1",
        closureDate: "2026-11-21",
        changedSinceShown: false,
      },
    });
    expect(allMethods()).not.toContain("insert");
    expect(allMethods()).not.toContain("update");
    expect(allMethods()).not.toContain("delete");
  });

  it("نوبت‌ها فقط با کلاینت کاربر و فقط تأییدشدهٔ آینده خوانده می‌شوند، بدون موبایل و کدملی", async () => {
    useFakeClient({
      closures: [{ data: [] }, { data: { id: "c1" } }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [] }],
    });

    await data.createClosure(closure);

    const [columns] = opArgs("appointments", "select") as [string];
    expect(columns).not.toMatch(/mobile|national|phone/i);
    expect(columns).toContain("patients(full_name)");
    expect(opArgs("appointments", "eq")).toEqual(["status", "confirmed"]);
    const [gteColumn, gteValue] = opArgs("appointments", "gte") as [string, string];
    expect(gteColumn).toBe("starts_at");
    expect(Number.isNaN(Date.parse(gteValue))).toBe(false);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("ارسال دوم با همان فهرست: ذخیره می‌شود", async () => {
    useFakeClient({
      closures: [{ data: [] }, { data: { id: "c1" } }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    expect(await data.createClosure(closure, ["ap1"])).toEqual({ ok: true, value: { id: "c1" } });
    expect(opArgs("closures", "insert")).toEqual([
      { closure_date: "2026-11-21", reason: "سفر علمی", created_by: DOCTOR_ID },
    ]);
  });

  it("فهرست بین دو ارسال فرق کرد (نوبت تازه): دوباره هشدار با فهرست تازه و بدون ذخیره", async () => {
    useFakeClient({
      closures: [{ data: [] }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [
        {
          data: [
            apptRow("ap1", ...INSIDE),
            apptRow("ap2", "2026-11-21T12:30:00Z", "2026-11-21T13:00:00Z"),
          ],
        },
      ],
    });

    const result = await data.createClosure(closure, ["ap1"]);

    expect(result).toMatchObject({
      ok: false,
      confirmation: { confirmedIds: "ap1,ap2", changedSinceShown: true },
    });
    expect(allMethods()).not.toContain("insert");
  });

  it("تأییدِ فهرستِ دیگر یا ساختگی هیچ‌وقت ذخیره نمی‌کند", async () => {
    useFakeClient({
      closures: [{ data: [] }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    const result = await data.createClosure(closure, ["zzz"]);

    expect(result.ok).toBe(false);
    expect(allMethods()).not.toContain("insert");
  });

  it("نوبتِ بیرون برنامه (استثنای پنلی) یا روز دیگر هشدار نمی‌سازد و تعطیلی ذخیره می‌شود", async () => {
    useFakeClient({
      closures: [{ data: [] }, { data: { id: "c1" } }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ data: [apptRow("out", ...OUTSIDE), apptRow("other-day", "2026-11-22T11:30:00Z", "2026-11-22T12:00:00Z")] }],
    });

    expect(await data.createClosure(closure)).toEqual({ ok: true, value: { id: "c1" } });
  });

  it("خواندن نوبت‌ها شکست بخورد، چیزی ذخیره نمی‌شود و پیام فارسی می‌آید", async () => {
    useFakeClient({
      closures: [{ data: [] }],
      working_hours: [{ data: [dbRow()] }],
      appointments: [{ error: { code: "XX000", message: "connection refused to db.internal" } }],
    });

    const result = await data.createClosure(closure);

    expect(result).toEqual({ ok: false, message: DB_READ_FAILED_MESSAGE });
    expect(allMethods()).not.toContain("insert");
  });

  it("منشی پیش از هر خواندنی رد می‌شود (نوبت‌ها هم خوانده نمی‌شوند)", async () => {
    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    useFakeClient({});

    expect(await data.createClosure(closure, ["ap1"])).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("هشدار نوبت‌های متأثر: ساعت کاری", () => {
  const edit = (overrides: Record<string, unknown> = {}) => ({
    weekday: 0,
    startTime: "14:00",
    endTime: "18:00",
    isActive: true,
    ...overrides,
  });
  const scheduleRow = (overrides: Record<string, unknown> = {}) => dbRow({ id: ROW_ID, ...overrides });

  it("کوتاه‌کردن که نوبتی را بیرون می‌برد: ارسال اول فهرست می‌دهد و چیزی نمی‌نویسد", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    const result = await data.updateWorkingHours(ROW_ID, edit({ endTime: "15:00" }));

    expect(result).toMatchObject({
      ok: false,
      confirmation: { affected: [{ id: "ap1", dateKey: "2026-11-21", startTime: "15:00" }], changedSinceShown: false },
    });
    expect(allMethods()).not.toContain("update");
  });

  it("کوتاه‌کردن: ارسال دوم با همان فهرست ذخیره می‌کند", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }, { data: { id: ROW_ID } }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    expect(await data.updateWorkingHours(ROW_ID, edit({ endTime: "15:00" }), ["ap1"])).toEqual({
      ok: true,
      value: { id: ROW_ID },
    });
    expect(opArgs("working_hours", "update")).toEqual([
      { weekday: 0, start_time: "14:00", end_time: "15:00", is_active: true },
    ]);
  });

  it("کوتاه‌کردن: فهرست بین دو ارسال فرق کرد، دوباره هشدار و بدون ذخیره", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE), apptRow("ap2", "2026-11-21T12:30:00Z", "2026-11-21T13:00:00Z")] }],
    });

    const result = await data.updateWorkingHours(ROW_ID, edit({ endTime: "15:00" }), ["ap1"]);

    expect(result).toMatchObject({ ok: false, confirmation: { confirmedIds: "ap1,ap2", changedSinceShown: true } });
    expect(allMethods()).not.toContain("update");
  });

  it("تغییر روز نوبت‌های روز قبلی را متأثر می‌کند", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });

    const result = await data.updateWorkingHours(ROW_ID, edit({ weekday: 1 }));

    expect(result).toMatchObject({ ok: false, confirmation: { confirmedIds: "ap1" } });
    expect(allMethods()).not.toContain("update");
  });

  it("گسترش بازه یا نوبتِ بیرون برنامه: بدون هشدار ذخیره می‌شود", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }, { data: { id: ROW_ID } }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE), apptRow("out", ...OUTSIDE)] }],
    });

    expect(await data.updateWorkingHours(ROW_ID, edit({ endTime: "19:00" }))).toEqual({
      ok: true,
      value: { id: ROW_ID },
    });
  });

  it("غیرفعال‌کردن بازه‌ای که نوبت دارد: ارسال اول هشدار، ارسال دوم ذخیره", async () => {
    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });
    const first = await data.deactivateWorkingHours(ROW_ID);
    expect(first).toMatchObject({ ok: false, confirmation: { confirmedIds: "ap1" } });
    expect(allMethods()).not.toContain("update");

    useFakeClient({
      working_hours: [{ data: [scheduleRow()] }, { data: { id: ROW_ID } }],
      appointments: [{ data: [apptRow("ap1", ...INSIDE)] }],
    });
    expect(await data.deactivateWorkingHours(ROW_ID, ["ap1"])).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(opArgs("working_hours", "update")).toEqual([{ is_active: false }]);
    expect(allMethods()).not.toContain("delete");
  });

  it("بازهٔ از پیش غیرفعال: نوبت‌ها خوانده نمی‌شوند و بدون هشدار انجام می‌شود", async () => {
    useFakeClient({ working_hours: [{ data: [scheduleRow({ is_active: false })] }, { data: { id: ROW_ID } }] });

    expect(await data.deactivateWorkingHours(ROW_ID)).toEqual({ ok: true, value: { id: ROW_ID } });
    expect(calls.map((call) => call.table)).not.toContain("appointments");
  });

  it("غیرفعال‌کردنِ شناسه‌ای که در فهرست نیست «پیدا نشد» می‌گوید", async () => {
    useFakeClient({ working_hours: [{ data: [] }] });
    expect(await data.deactivateWorkingHours(ROW_ID)).toEqual({ ok: false, message: ROW_NOT_FOUND_MESSAGE });
    expect(allMethods()).not.toContain("update");
  });

  it("ساختن بازهٔ تازه فقط برنامه را گسترش می‌دهد: نوبت‌ها خوانده نمی‌شوند", async () => {
    useFakeClient({ working_hours: [{ data: [] }, { data: { id: ROW_ID } }] });

    await data.createWorkingHours(goodHours);

    expect(calls.map((call) => call.table)).not.toContain("appointments");
  });

  it("منشی پیش از هر خواندنی رد می‌شود", async () => {
    mocks.getPanelUser.mockResolvedValue({ id: "s", role: "secretary" });
    useFakeClient({});

    expect(await data.updateWorkingHours(ROW_ID, edit(), ["ap1"])).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(await data.deactivateWorkingHours(ROW_ID, ["ap1"])).toEqual({ ok: false, message: NOT_ALLOWED_MESSAGE });
    expect(calls).toHaveLength(0);
  });
});

describe("خطای 23P01 در نوشتن ساعت کاری", () => {
  it("هم‌زمانیِ دو ثبت (قید هم‌پوشانی) پیام فارسی می‌دهد، نه متن خام", async () => {
    useFakeClient({
      working_hours: [
        { data: [] },
        {
          error: {
            code: "23P01",
            message: 'conflicting key value violates exclusion constraint "working_hours_no_active_overlap"',
          },
        },
      ],
    });

    const result = await data.createWorkingHours(goodHours);

    expect(result).toEqual({ ok: false, message: WORKING_HOURS_OVERLAP_DB_MESSAGE });
    expect(JSON.stringify(result)).not.toContain("exclusion");
  });
});

describe("کلاینت ادمین", () => {
  it("در هیچ مسیری استفاده نمی‌شود", async () => {
    useFakeClient({
      working_hours: [
        { data: [] },
        { data: [] },
        { data: { id: ROW_ID } },
        { data: [dbRow({ id: ROW_ID })] },
        { data: { id: ROW_ID } },
        { data: [] },
        { data: [] },
      ],
      closures: [
        { data: [] },
        { data: { id: "c1" } },
        { data: { id: "c1" } },
        { data: [closureRow({ id: "55555555-5555-4555-8555-555555555555", is_active: false })] },
        { data: { id: "c1" } },
      ],
    });
    await data.listWorkingHours();
    await data.listClinics();
    await data.createWorkingHours(goodHours);
    await data.deactivateWorkingHours(ROW_ID);
    await data.createClosure({ closureDate: "2026-11-20", reason: "الف" });
    await data.cancelClosure("55555555-5555-4555-8555-555555555555");
    await data.reactivateClosure("55555555-5555-4555-8555-555555555555");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
