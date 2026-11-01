import { describe, expect, it } from "vitest";

import { checkManualSlot, MANUAL_OVERLAP_MESSAGE } from "./data";
import { getCalendarSlotTimes, getManualSlotWarning, getManualStartOptions, pickInitialStartTime } from "./manual-slots";
import type { AppointmentSnapshot, AppointmentWithPatient, WorkingDay } from "./types";

/** همهٔ نام‌ها و شماره‌ها ساختگی‌اند. ۱ نوامبر ۲۰۲۶ یکشنبه است. */
const SUNDAY = "2026-11-01";
const MONDAY = "2026-11-02";
const TUESDAY = "2026-11-03";

const workingDays: WorkingDay[] = [
  { weekday: 0, label: "یکشنبه", start_time: "14:00", end_time: "18:00" },
  { weekday: 2, label: "سه‌شنبه", start_time: "14:00", end_time: "18:00" },
];

function booking(id: string, startsAt: string, endsAt: string, status: AppointmentWithPatient["status"] = "confirmed"): AppointmentWithPatient {
  return {
    id,
    patient_id: null,
    requester_name: "نمونهٔ آزمون",
    requester_mobile: "09900000000",
    requested_for_self: false,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    cancel_reason: null,
    source: "panel",
    created_by: null,
    note: null,
    patient: null,
  };
}

function makeSnapshot(appointments: AppointmentWithPatient[] = []): AppointmentSnapshot {
  return {
    appointments,
    patients: [],
    // سه‌شنبه تعطیل است و دوشنبه روز کاری نیست.
    closures: [{ date: TUESDAY, reason: "مناسبت" }],
    workingDays,
  };
}

const TAKEN_1500 = booking("a1", `${SUNDAY}T15:00:00+03:30`, `${SUNDAY}T15:30:00+03:30`);

function timesOf(options: ReturnType<typeof getManualStartOptions>, pick: (option: ReturnType<typeof getManualStartOptions>[number]) => boolean) {
  return options.filter(pick).map((option) => option.time);
}

describe("getManualStartOptions", () => {
  it("همهٔ شروع‌ها از ۰۸:۰۰ تا ۲۳:۴۵ با گام ۱۵ دقیقه را می‌دهد", () => {
    const options = getManualStartOptions(makeSnapshot(), SUNDAY, 15);
    expect(options).toHaveLength(64);
    expect(options[0].time).toBe("08:00");
    expect(options[1].time).toBe("08:15");
    expect(options.at(-1)?.time).toBe("23:45");
  });

  it("ساعت‌های داخل ساعت کاری را از بیرونش جدا می‌کند", () => {
    const inside = timesOf(getManualStartOptions(makeSnapshot(), SUNDAY, 15), (option) => option.inWorkingHours);
    expect(inside[0]).toBe("14:00");
    expect(inside.at(-1)).toBe("17:45");
    expect(inside).toHaveLength(16);
  });

  it("نوبتی که پایانش از ساعت کاری می‌گذرد بیرون از ساعت کاری حساب می‌شود", () => {
    const inside = timesOf(getManualStartOptions(makeSnapshot(), SUNDAY, 60), (option) => option.inWorkingHours);
    expect(inside.at(-1)).toBe("17:00");
  });

  it("ساعت پر را بر اساس مدت انتخاب‌شده غیرفعال می‌کند", () => {
    const snapshot = makeSnapshot([TAKEN_1500]);
    expect(timesOf(getManualStartOptions(snapshot, SUNDAY, 15), (option) => option.taken)).toEqual(["15:00", "15:15"]);
    expect(timesOf(getManualStartOptions(snapshot, SUNDAY, 30), (option) => option.taken)).toEqual(["14:45", "15:00", "15:15"]);
    expect(timesOf(getManualStartOptions(snapshot, SUNDAY, 60), (option) => option.taken)).toEqual(["14:15", "14:30", "14:45", "15:00", "15:15"]);
  });

  it("نوبتِ لغوشده یا نوبتِ در تغییر نام، ساعت را پر نمی‌کند", () => {
    const cancelled = booking("a2", `${SUNDAY}T16:00:00+03:30`, `${SUNDAY}T16:30:00+03:30`, "cancelled");
    expect(timesOf(getManualStartOptions(makeSnapshot([cancelled]), SUNDAY, 30), (option) => option.taken)).toEqual([]);
    expect(timesOf(getManualStartOptions(makeSnapshot([TAKEN_1500]), SUNDAY, 30, "a1"), (option) => option.taken)).toEqual([]);
  });

  it("در روز تعطیل و روز غیرکاری هیچ ساعتی داخل ساعت کاری نیست", () => {
    expect(timesOf(getManualStartOptions(makeSnapshot(), TUESDAY, 15), (option) => option.inWorkingHours)).toEqual([]);
    expect(timesOf(getManualStartOptions(makeSnapshot(), MONDAY, 15), (option) => option.inWorkingHours)).toEqual([]);
  });
});

describe("pickInitialStartTime", () => {
  it("ساعتی را که منشی زده، اگر آزاد باشد نگه می‌دارد", () => {
    const options = getManualStartOptions(makeSnapshot([TAKEN_1500]), SUNDAY, 15);
    expect(pickInitialStartTime(options, "14:30")).toBe("14:30");
  });

  it("اگر ساعت پر باشد اولین ساعت آزادِ داخل ساعت کاری را می‌دهد", () => {
    const options = getManualStartOptions(makeSnapshot([TAKEN_1500]), SUNDAY, 15);
    expect(pickInitialStartTime(options, "15:00")).toBe("14:00");
  });

  it("در روز تعطیل اولین ساعت آزاد ۰۸:۰۰ است", () => {
    const options = getManualStartOptions(makeSnapshot(), TUESDAY, 15);
    expect(pickInitialStartTime(options, "08:00")).toBe("08:00");
  });
});

describe("getManualSlotWarning", () => {
  it("نوبت عادی داخل ساعت کاری هشدار ندارد", () => {
    expect(getManualSlotWarning(makeSnapshot(), { dateKey: SUNDAY, time: "14:00", durationMinutes: 60 })).toBeNull();
    expect(getManualSlotWarning(makeSnapshot(), { dateKey: SUNDAY, time: "17:00", durationMinutes: 60 })).toBeNull();
  });

  it("پیش از شروع ساعت کاری یا با پایان بعد از آن، «خارج از ساعت کاری» می‌گوید", () => {
    for (const [time, minutes] of [["13:45", 15], ["17:45", 30], ["20:00", 15]] as const) {
      const warning = getManualSlotWarning(makeSnapshot(), { dateKey: SUNDAY, time, durationMinutes: minutes });
      expect(warning?.reason).toBe("out_of_hours");
      expect(warning?.title).toBe("خارج از ساعت کاری");
    }
  });

  it("روز غیرکاری را با نام قاعده می‌گوید", () => {
    const warning = getManualSlotWarning(makeSnapshot(), { dateKey: MONDAY, time: "14:00", durationMinutes: 15 });
    expect(warning).toMatchObject({ reason: "non_working_day", title: "روز غیرکاری" });
  });

  it("روز تعطیل را بدون دلیل می‌گوید و بر بقیه مقدم است", () => {
    const warning = getManualSlotWarning(makeSnapshot(), { dateKey: TUESDAY, time: "14:00", durationMinutes: 15 });
    expect(warning).toEqual({ reason: "closure", title: "روز تعطیل", message: "این روز تعطیل است." });
  });
});

describe("checkManualSlot", () => {
  it("روز تعطیل، روز غیرکاری و بیرون از ساعت کاری را مانع نمی‌داند", () => {
    for (const dateKey of [TUESDAY, MONDAY, SUNDAY]) {
      expect(checkManualSlot(makeSnapshot(), { dateKey, time: "20:00", durationMinutes: 30 }).ok).toBe(true);
    }
  });

  it("شروع زودتر از ۰۸:۰۰ و پایان بعد از ۲۴:۰۰ را رد می‌کند", () => {
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "07:45", durationMinutes: 15 }).ok).toBe(false);
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "23:45", durationMinutes: 30 }).ok).toBe(false);
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "23:45", durationMinutes: 15 }).ok).toBe(true);
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "23:00", durationMinutes: 60 }).ok).toBe(true);
  });

  it("شبکهٔ ۱۵ دقیقه‌ای و مدت‌های مجاز را نگه می‌دارد", () => {
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "14:10", durationMinutes: 15 }).ok).toBe(false);
    expect(checkManualSlot(makeSnapshot(), { dateKey: SUNDAY, time: "14:00", durationMinutes: 20 }).ok).toBe(false);
  });

  it("هم‌پوشانی با نوبت فعال را رد می‌کند، مگر نوبتِ در تغییر نام", () => {
    const snapshot = makeSnapshot([TAKEN_1500]);
    expect(checkManualSlot(snapshot, { dateKey: SUNDAY, time: "14:45", durationMinutes: 30 })).toEqual({ ok: false, message: MANUAL_OVERLAP_MESSAGE });
    expect(checkManualSlot(snapshot, { dateKey: SUNDAY, time: "14:45", durationMinutes: 15 }).ok).toBe(true);
    expect(checkManualSlot(snapshot, { dateKey: SUNDAY, time: "14:45", durationMinutes: 30, ignoreAppointmentId: "a1" }).ok).toBe(true);
  });
});

describe("getCalendarSlotTimes", () => {
  it("بدون نوبتِ بیرون از ساعت کاری، فقط ساعت‌های کاری را می‌دهد", () => {
    const times = getCalendarSlotTimes(workingDays, [TAKEN_1500]);
    expect(times[0]).toBe("14:00");
    expect(times.at(-1)).toBe("17:45");
    expect(times).toHaveLength(16);
  });

  it("خانه‌های نوبتِ بیرون از ساعت کاری را مرتب اضافه می‌کند، بدون پرکردن فاصله", () => {
    const morning = booking("b1", `${TUESDAY}T09:00:00+03:30`, `${TUESDAY}T09:30:00+03:30`);
    const night = booking("b2", `${TUESDAY}T22:30:00+03:30`, `${TUESDAY}T23:15:00+03:30`);
    const times = getCalendarSlotTimes(workingDays, [night, morning]);
    expect(times.slice(0, 3)).toEqual(["09:00", "09:15", "14:00"]);
    expect(times.slice(-4)).toEqual(["17:45", "22:30", "22:45", "23:00"]);
    expect(times).not.toContain("09:30");
  });
});
