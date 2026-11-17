import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * آزمون خواندن پنل فقط با mock؛ هیچ شبکه و پایگاه داده‌ای در کار نیست.
 * تمرکز: تعطیلیِ لغوشده (`is_active = false`) نباید به تقویم و هشدار ثبت نوبت برسد (تصمیم 0013).
 */

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./data", () => ({ PANEL_LOAD_FAILED_MESSAGE: "خواندن اطلاعات پنل انجام نشد." }));

import { loadPanelSnapshot } from "./queries";

type Op = [method: string, args: unknown[]];
type Call = { table: string; ops: Op[] };
type Result = { data?: unknown; error?: { message: string } | null };

let calls: Call[];

function useFakeClient(results: Record<string, Result>) {
  calls = [];
  mocks.createClient.mockResolvedValue({
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const query: unknown = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null, ...results[table] }).then(resolve, reject);
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
    rpc: async () => ({ data: "2026-11-17", error: null }),
  });
}

const opsOf = (table: string) => calls.find((call) => call.table === table)?.ops ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loadPanelSnapshot — تعطیلی", () => {
  it("فقط تعطیلیِ فعال را می‌خواند (فیلتر is_active = true)", async () => {
    useFakeClient({});

    const result = await loadPanelSnapshot();

    expect(result.ok).toBe(true);
    expect(opsOf("closures")).toContainEqual(["eq", ["is_active", true]]);
    expect(opsOf("closures").map(([method]) => method)).not.toContain("delete");
  });

  it("ستون‌های تعطیلی و ترتیب تاریخ را حفظ می‌کند", async () => {
    useFakeClient({});

    await loadPanelSnapshot();

    expect(opsOf("closures")).toContainEqual(["select", ["closure_date, reason"]]);
    expect(opsOf("closures")).toContainEqual(["order", ["closure_date"]]);
  });

  it("ردیف‌های برگشتی را به تعطیلیِ تقویم تبدیل می‌کند", async () => {
    useFakeClient({ closures: { data: [{ closure_date: "2026-11-20", reason: "سفر علمی" }] } });

    const result = await loadPanelSnapshot();

    expect(result.ok && result.snapshot.closures).toEqual([{ date: "2026-11-20", reason: "سفر علمی" }]);
  });

  it("فیلتر ساعت کاریِ فعال را دست‌نخورده نگه می‌دارد", async () => {
    useFakeClient({});

    await loadPanelSnapshot();

    expect(opsOf("working_hours")).toContainEqual(["eq", ["is_active", true]]);
  });

  it("خطای خواندن تعطیلی پیام فارسی می‌دهد و متن خام نشت نمی‌کند", async () => {
    useFakeClient({ closures: { error: { message: "connection refused to db.internal" } } });

    const result = await loadPanelSnapshot();

    expect(result).toEqual({ ok: false, message: "خواندن اطلاعات پنل انجام نشد." });
    expect(JSON.stringify(result)).not.toContain("db.internal");
  });
});
