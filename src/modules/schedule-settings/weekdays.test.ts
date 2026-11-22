import { describe, expect, it } from "vitest";

import type { WorkingHoursEntry } from "./types";
import { validateWorkingHoursRow } from "./validation";
import { groupByWeekday, TIME_OPTIONS, WEEKDAY_NAMES, WEEKDAY_NUMBERS, weekdayName } from "./weekdays";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";

let counter = 0;
function entry(overrides: Partial<WorkingHoursEntry>): WorkingHoursEntry {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    clinicId: CLINIC_A,
    clinicName: "مطب آزمایشی یک",
    weekday: 0,
    startTime: "09:00",
    endTime: "12:00",
    isActive: true,
    ...overrides,
  };
}

describe("نام روزها", () => {
  it("شنبه ۰ است و جمعه ۶", () => {
    expect(WEEKDAY_NAMES).toHaveLength(7);
    expect(weekdayName(0)).toBe("شنبه");
    expect(weekdayName(1)).toBe("یکشنبه");
    expect(weekdayName(6)).toBe("جمعه");
    expect(WEEKDAY_NUMBERS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("شمارهٔ نامعتبر نامی ندارد", () => {
    expect(weekdayName(7)).toBeUndefined();
    expect(weekdayName(-1)).toBeUndefined();
    expect(weekdayName(1.5)).toBeUndefined();
  });
});

describe("گزینه‌های ساعت", () => {
  it("از ۰۰:۰۰ تا ۲۳:۴۵ با گام ۱۵ دقیقه است", () => {
    expect(TIME_OPTIONS).toHaveLength(96);
    expect(TIME_OPTIONS[0]).toEqual({ value: "00:00", label: "۰۰:۰۰" });
    expect(TIME_OPTIONS[1].value).toBe("00:15");
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1]).toEqual({ value: "23:45", label: "۲۳:۴۵" });
  });

  it("هر گزینه را اعتبارسنجی می‌پذیرد (ساعت شروع و پایان)", () => {
    for (const option of TIME_OPTIONS.slice(0, -1)) {
      const result = validateWorkingHoursRow({
        weekday: 0,
        startTime: option.value,
        endTime: "23:45",
        isActive: true,
      });
      expect(result.ok, option.value).toBe(true);
    }
  });
});

describe("گروه‌بندی بر اساس روز", () => {
  it("همیشه هفت گروه از شنبه تا جمعه می‌دهد، حتی بدون ردیف", () => {
    const groups = groupByWeekday([]);
    expect(groups.map((group) => group.name)).toEqual([...WEEKDAY_NAMES]);
    expect(groups.every((group) => group.rows.length === 0 && group.needsClinicChoice)).toBe(true);
  });

  it("ردیف‌ها به ترتیب ساعت شروع در گروه روز خودشان می‌روند", () => {
    const late = entry({ weekday: 0, startTime: "16:00", endTime: "19:00" });
    const early = entry({ weekday: 0, startTime: "09:00", endTime: "12:00" });
    const tuesday = entry({ weekday: 3 });

    const groups = groupByWeekday([late, tuesday, early]);

    expect(groups[0].rows.map((row) => row.startTime)).toEqual(["09:00", "16:00"]);
    expect(groups[3].rows).toEqual([tuesday]);
    expect(groups[1].rows).toEqual([]);
  });

  it("مطب روز از ردیف‌های فعال مشتق می‌شود و نیازی به انتخاب نیست", () => {
    const [saturday] = groupByWeekday([entry({ weekday: 0 }), entry({ weekday: 0, startTime: "16:00", endTime: "19:00" })]);

    expect(saturday.clinic).toEqual({ id: CLINIC_A, name: "مطب آزمایشی یک" });
    expect(saturday.needsClinicChoice).toBe(false);
    expect(saturday.isClinicInconsistent).toBe(false);
  });

  it("روزی که فقط ردیف غیرفعال دارد مثل روز بی‌ردیف است و انتخاب مطب می‌خواهد", () => {
    const inactive = entry({ weekday: 1, isActive: false, clinicId: CLINIC_B, clinicName: "مطب آزمایشی دو" });
    const monday = groupByWeekday([inactive])[2];
    const sunday = groupByWeekday([inactive])[1];

    expect(sunday.rows).toEqual([inactive]);
    expect(sunday.activeRows).toEqual([]);
    expect(sunday.clinic).toBeNull();
    expect(sunday.needsClinicChoice).toBe(true);
    expect(monday.needsClinicChoice).toBe(true);
  });

  it("چند مطبِ فعال در یک روز ناسازگاری است و مطبی مشتق نمی‌شود", () => {
    const [saturday] = groupByWeekday([
      entry({ weekday: 0 }),
      entry({ weekday: 0, clinicId: CLINIC_B, clinicName: "مطب آزمایشی دو", startTime: "16:00", endTime: "19:00" }),
    ]);

    expect(saturday.isClinicInconsistent).toBe(true);
    expect(saturday.clinic).toBeNull();
    expect(saturday.needsClinicChoice).toBe(false);
  });

  it("ردیفِ بی‌مطب مطبِ روز را مشتق نمی‌کند", () => {
    const [saturday] = groupByWeekday([entry({ weekday: 0, clinicId: null, clinicName: null })]);

    expect(saturday.clinic).toBeNull();
    expect(saturday.needsClinicChoice).toBe(true);
  });

  it("ردیفی با روز نامعتبر نادیده گرفته می‌شود", () => {
    const groups = groupByWeekday([entry({ weekday: 9 })]);
    expect(groups.flatMap((group) => group.rows)).toEqual([]);
  });

  it("ورودی را تغییر نمی‌دهد", () => {
    const rows = [entry({ weekday: 0, startTime: "16:00", endTime: "19:00" }), entry({ weekday: 0 })];
    const before = rows.map((row) => row.id);
    groupByWeekday(rows);
    expect(rows.map((row) => row.id)).toEqual(before);
  });
});
