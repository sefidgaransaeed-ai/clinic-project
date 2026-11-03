import { describe, expect, it } from "vitest";
import { normalizeMobile } from "./mobile";

// فقط شمارهٔ ساختگی.
describe("normalizeMobile", () => {
  it.each([
    ["09120000001", "09120000001"],
    ["9120000001", "09120000001"],
    ["989120000001", "09120000001"],
    ["+989120000001", "09120000001"],
    ["+98 912 000 0001", "09120000001"],
    ["00989120000001", "09120000001"],
    ["0912-000-0001", "09120000001"],
  ])("قالب %j را به ۰۹xxxxxxxxx می‌رساند", (raw, expected) => {
    expect(normalizeMobile(raw)).toBe(expected);
  });

  it.each(["", "abc", "0912", "08120000001", "091200000012", "+1 202 555 0100"])(
    "ورودی نامعتبر %j را null می‌دهد",
    (raw) => {
      expect(normalizeMobile(raw)).toBeNull();
    },
  );

  it("نتیجهٔ خودش را دوباره نرمال کند همان می‌ماند", () => {
    const once = normalizeMobile("+98 912 000 0001");
    expect(normalizeMobile(once ?? "")).toBe(once);
  });
});
