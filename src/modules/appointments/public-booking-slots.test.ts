import { describe, expect, it } from "vitest";

import { toLatinDigits } from "./date";
import { findSlot, groupSlotsByClinic } from "./public-booking-slots";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";

/** ردیف‌های `available_slots(day)`؛ ۰۵:۳۰ UTC همان ۰۹:۰۰ تهران است (+۰۳:۳۰). دادهٔ ساختگی است. */
const ROWS = [
  { starts_at: "2026-11-05T05:30:00+00:00", ends_at: "2026-11-05T05:45:00+00:00", clinic_id: CLINIC_A, clinic_name: "مطب شمال", clinic_address: "نشانی شمال" },
  { starts_at: "2026-11-05T05:45:00+00:00", ends_at: "2026-11-05T06:00:00+00:00", clinic_id: CLINIC_A, clinic_name: "مطب شمال", clinic_address: "نشانی شمال" },
  { starts_at: "2026-11-05T12:30:00+00:00", ends_at: "2026-11-05T12:45:00+00:00", clinic_id: CLINIC_B, clinic_name: "مطب جنوب", clinic_address: "نشانی جنوب" },
];

describe("groupSlotsByClinic", () => {
  it("ساعت‌ها را بر اساس مطب گروه می‌کند و نام و نشانی را از ردیف می‌گیرد", () => {
    const groups = groupSlotsByClinic(ROWS);
    expect(groups.map((group) => [group.clinicId, group.clinicName, group.clinicAddress, group.slots.length])).toEqual([
      [CLINIC_A, "مطب شمال", "نشانی شمال", 2],
      [CLINIC_B, "مطب جنوب", "نشانی جنوب", 1],
    ]);
  });

  it("برچسب ساعت به وقت تهران است و مقدار، لحظهٔ اصلی پایگاه داده", () => {
    const [first] = groupSlotsByClinic(ROWS)[0].slots;
    expect(first.startsAt).toBe("2026-11-05T05:30:00+00:00");
    expect(toLatinDigits(first.label)).toBe("09:00");
    expect(toLatinDigits(groupSlotsByClinic(ROWS)[1].slots[0].label)).toBe("16:00");
  });

  it("دو بازهٔ یک مطب در یک روز یک گروه می‌شوند، با ترتیب اولین ساعت", () => {
    const rows = [ROWS[0], ROWS[2], { ...ROWS[1], starts_at: "2026-11-05T13:00:00+00:00" }];
    const groups = groupSlotsByClinic(rows);
    expect(groups.map((group) => group.clinicName)).toEqual(["مطب شمال", "مطب جنوب"]);
    expect(groups[0].slots).toHaveLength(2);
  });

  it("ردیف بدون مطب گروه جدا بدون نام می‌شود", () => {
    const [group] = groupSlotsByClinic([{ starts_at: ROWS[0].starts_at, clinic_id: null, clinic_name: null, clinic_address: null }]);
    expect(group).toMatchObject({ clinicId: null, clinicName: null, clinicAddress: null });
    expect(group.slots).toHaveLength(1);
  });

  it("روز تعطیل یا پر فهرست خالی است، و ردیف خراب یا ورودی غیر آرایه کنار گذاشته می‌شود", () => {
    expect(groupSlotsByClinic([])).toEqual([]);
    expect(groupSlotsByClinic(null)).toEqual([]);
    expect(groupSlotsByClinic({})).toEqual([]);
    expect(groupSlotsByClinic([null, 3, { starts_at: "نه تاریخ" }, { clinic_id: CLINIC_A }])).toEqual([]);
  });
});

describe("findSlot", () => {
  it("مطب و ساعتِ انتخاب‌شده را برمی‌گرداند، و برای ساعت ناموجود null", () => {
    const groups = groupSlotsByClinic(ROWS);
    expect(findSlot(groups, "2026-11-05T12:30:00+00:00")?.group.clinicName).toBe("مطب جنوب");
    expect(findSlot(groups, "2026-11-05T09:00:00+00:00")).toBeNull();
    expect(findSlot(groups, "")).toBeNull();
  });
});
