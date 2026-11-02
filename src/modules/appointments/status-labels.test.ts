import { describe, expect, it } from "vitest";

import { getStatusLabel } from "./status-labels";
import type { AppointmentStatus } from "./types";

describe("getStatusLabel", () => {
  it("نوبتِ لغوشده با دلیل «رد» برچسب «ردشده» می‌گیرد", () => {
    expect(getStatusLabel("cancelled", "rejected")).toBe("ردشده");
  });

  it("نوبتِ لغوشده با دلیل «لغو» برچسب «لغوشده» می‌گیرد", () => {
    expect(getStatusLabel("cancelled", "cancelled")).toBe("لغوشده");
  });

  it("نوبتِ لغوشده با دلیل «منقضی» یا بدون دلیل هم «لغوشده» می‌ماند", () => {
    expect(getStatusLabel("cancelled", "expired")).toBe("لغوشده");
    expect(getStatusLabel("cancelled", null)).toBe("لغوشده");
  });

  it("وضعیت‌های دیگر با هر دلیلی همان برچسب همیشگی را دارند", () => {
    const expected: Record<Exclude<AppointmentStatus, "cancelled">, string> = {
      requested: "درخواست جدید",
      confirmed: "تأییدشده",
      arrived: "حاضر شد",
      done: "انجام شد",
      no_show: "غایب",
    };
    for (const [status, label] of Object.entries(expected)) {
      expect(getStatusLabel(status as AppointmentStatus, null)).toBe(label);
      // دلیلِ لغو فقط برای وضعیتِ لغوشده معنا دارد؛ در وضعیت‌های دیگر نادیده گرفته می‌شود.
      expect(getStatusLabel(status as AppointmentStatus, "rejected")).toBe(label);
    }
  });
});
