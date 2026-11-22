import { describe, expect, it } from "vitest";

import {
  AFFECTED_MESSAGES,
  confirmationToken,
  findAffectedByClosure,
  findAffectedByScheduleChange,
  requireConfirmation,
  type FutureAppointment,
  type ScheduleInterval,
} from "./affected-appointments";

/**
 * آزمون محاسبهٔ خالص؛ بدون Supabase و شبکه. تاریخ‌های آزمون: ۲۰۲۶-۱۱-۲۱ شنبه است (روز هفتهٔ پایگاه داده = ۰)
 * و ۲۰۲۶-۱۱-۲۲ یکشنبه (۱). ساعت‌ها در آزمون به وقت تهران نوشته می‌شوند و کمک‌تابع به UTC (منهای ۳:۳۰) می‌برد.
 */

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";
const SATURDAY = "2026-11-21";
const SUNDAY = "2026-11-22";

/** نوبت با ساعت شروعِ «تهران». */
function appointment(
  id: string,
  dateKey: string,
  time: string,
  minutes = 30,
  clinicId: string | null = CLINIC_A,
): FutureAppointment {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const startMs = Date.UTC(year, month - 1, day, hour, minute) - 210 * 60_000;
  return {
    id,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + minutes * 60_000).toISOString(),
    clinicId,
    patientName: `مراجع آزمایشی ${id}`,
  };
}

function interval(
  weekday: number,
  startTime: string,
  endTime: string,
  clinicId: string | null = CLINIC_A,
  isActive = true,
): ScheduleInterval {
  return { weekday, startTime, endTime, clinicId, isActive };
}

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("زمان تهران (+۰۳:۳۰ ثابت)", () => {
  it("نوبتِ ۰۰:۳۰ تهران که در UTC هنوز روز قبل است، به روز تهران حساب می‌شود", () => {
    const schedule = [interval(0, "00:00", "23:45")];
    const early = appointment("a1", SATURDAY, "00:30");
    expect(early.startsAt.startsWith("2026-11-20T21:00")).toBe(true);

    expect(ids(findAffectedByClosure([early], SATURDAY, schedule))).toEqual(["a1"]);
    expect(findAffectedByClosure([early], "2026-11-20", schedule)).toEqual([]);
  });

  it("ساعت نمایش‌داده‌شده تهران است، نه UTC", () => {
    const [view] = findAffectedByClosure([appointment("a1", SATURDAY, "10:15")], SATURDAY, [interval(0, "09:00", "12:00")]);
    expect(view).toEqual({
      id: "a1",
      dateKey: SATURDAY,
      startTime: "10:15",
      patientName: "مراجع آزمایشی a1",
    });
  });

  it("خروجی فقط تاریخ، ساعت، نام و شناسه دارد (موبایل و کدملی در کار نیست)", () => {
    const [view] = findAffectedByClosure([appointment("a1", SATURDAY, "10:00")], SATURDAY, [interval(0, "09:00", "12:00")]);
    expect(Object.keys(view).sort()).toEqual(["dateKey", "id", "patientName", "startTime"]);
  });
});

describe("findAffectedByClosure", () => {
  const schedule = [interval(0, "09:00", "12:00")];

  it("نوبتِ تأییدشدهٔ داخل برنامه در روز تعطیلی متأثر است", () => {
    const list = [appointment("in", SATURDAY, "10:00"), appointment("other-day", SUNDAY, "10:00")];
    expect(ids(findAffectedByClosure(list, SATURDAY, [interval(0, "09:00", "12:00"), interval(1, "09:00", "12:00")]))).toEqual([
      "in",
    ]);
  });

  it("نوبتِ از قبل بیرون برنامه (استثنای پنلی) متأثر نیست", () => {
    const list = [appointment("late", SATURDAY, "20:00"), appointment("straddle", SATURDAY, "11:45")];
    expect(findAffectedByClosure(list, SATURDAY, schedule)).toEqual([]);
  });

  it("روزِ بی‌برنامه یا بازهٔ غیرفعال: هیچ نوبتی متأثر نیست", () => {
    const list = [appointment("a1", SATURDAY, "10:00")];
    expect(findAffectedByClosure(list, SATURDAY, [])).toEqual([]);
    expect(findAffectedByClosure(list, SATURDAY, [interval(0, "09:00", "12:00", CLINIC_A, false)])).toEqual([]);
    expect(findAffectedByClosure(list, SATURDAY, [interval(1, "09:00", "12:00")])).toEqual([]);
  });

  it("دو بازهٔ چسبیده یک بازه‌اند: نوبتِ مرزی متأثر است", () => {
    const list = [appointment("span", SATURDAY, "10:30", 60)];
    const adjacent = [interval(0, "10:00", "11:00"), interval(0, "11:00", "12:00")];
    expect(ids(findAffectedByClosure(list, SATURDAY, adjacent))).toEqual(["span"]);
  });

  it("مرتب بر اساس زمان برمی‌گردد", () => {
    const list = [appointment("late", SATURDAY, "11:00"), appointment("early", SATURDAY, "09:00")];
    expect(ids(findAffectedByClosure(list, SATURDAY, schedule))).toEqual(["early", "late"]);
  });

  describe("مطب", () => {
    it("نوبتِ بی‌مطب (null) فقط با روز و ساعت سنجیده می‌شود", () => {
      const list = [appointment("no-clinic", SATURDAY, "10:00", 30, null)];
      expect(ids(findAffectedByClosure(list, SATURDAY, [interval(0, "09:00", "12:00", CLINIC_B)]))).toEqual(["no-clinic"]);
    });

    it("بازهٔ بی‌مطب (null) هم فقط با روز و ساعت سنجیده می‌شود", () => {
      const list = [appointment("a1", SATURDAY, "10:00", 30, CLINIC_A)];
      expect(ids(findAffectedByClosure(list, SATURDAY, [interval(0, "09:00", "12:00", null)]))).toEqual(["a1"]);
    });

    it("نوبتِ مطب دیگر از قبل بیرون برنامهٔ این مطب است و متأثر نیست", () => {
      const list = [appointment("b1", SATURDAY, "10:00", 30, CLINIC_B)];
      expect(findAffectedByClosure(list, SATURDAY, [interval(0, "09:00", "12:00", CLINIC_A)])).toEqual([]);
    });
  });

  it("ورودی را تغییر نمی‌دهد و تاریخ خراب را نادیده می‌گیرد", () => {
    const list = Object.freeze([
      Object.freeze(appointment("ok", SATURDAY, "10:00")),
      Object.freeze({ ...appointment("bad", SATURDAY, "10:00"), startsAt: "نه-تاریخ" }),
    ]);
    const frozenSchedule = Object.freeze([Object.freeze(interval(0, "09:00", "12:00"))]);
    expect(ids(findAffectedByClosure(list, SATURDAY, frozenSchedule))).toEqual(["ok"]);
  });
});

describe("findAffectedByScheduleChange", () => {
  const before = [interval(0, "09:00", "12:00")];

  it("کوتاه‌کردن: نوبتی که از بازهٔ جدید بیرون می‌ماند متأثر است، بقیه نه", () => {
    const list = [appointment("kept", SATURDAY, "09:30"), appointment("lost", SATURDAY, "11:00")];
    const after = [interval(0, "09:00", "11:00")];
    expect(ids(findAffectedByScheduleChange(list, before, after))).toEqual(["lost"]);
  });

  it("نوبتی که با بازهٔ جدید نصفه می‌ماند (شروع داخل، پایان بیرون) متأثر است", () => {
    const list = [appointment("half", SATURDAY, "10:45", 30)];
    expect(ids(findAffectedByScheduleChange(list, before, [interval(0, "09:00", "11:00")]))).toEqual(["half"]);
  });

  it("غیرفعال‌کردن: همهٔ نوبت‌های داخل آن بازه متأثرند", () => {
    const list = [appointment("a1", SATURDAY, "09:00"), appointment("a2", SATURDAY, "11:30")];
    const after = [interval(0, "09:00", "12:00", CLINIC_A, false)];
    expect(ids(findAffectedByScheduleChange(list, before, after))).toEqual(["a1", "a2"]);
  });

  it("غیرفعال‌کردن یکی از دو بازهٔ چسبیده فقط نوبت‌های همان بازه را متأثر می‌کند", () => {
    const two = [interval(0, "10:00", "11:00"), interval(0, "11:00", "12:00")];
    const list = [appointment("first", SATURDAY, "10:00"), appointment("second", SATURDAY, "11:00")];
    const after = [interval(0, "10:00", "11:00"), interval(0, "11:00", "12:00", CLINIC_A, false)];
    expect(ids(findAffectedByScheduleChange(list, two, after))).toEqual(["second"]);
  });

  it("تغییر روز: نوبت‌های روز قبلی متأثرند و نوبت‌های روز تازه که از قبل بیرون بودند نه", () => {
    const list = [appointment("sat", SATURDAY, "10:00"), appointment("sun", SUNDAY, "10:00")];
    const after = [interval(1, "09:00", "12:00")];
    expect(ids(findAffectedByScheduleChange(list, before, after))).toEqual(["sat"]);
  });

  it("تغییر مطب: نوبتِ مطب قبلی متأثر است؛ نوبتِ بی‌مطب فقط با روز و ساعت سنجیده می‌شود", () => {
    const list = [appointment("a", SATURDAY, "10:00", 30, CLINIC_A), appointment("none", SATURDAY, "10:00", 30, null)];
    const after = [interval(0, "09:00", "12:00", CLINIC_B)];
    expect(ids(findAffectedByScheduleChange(list, before, after))).toEqual(["a"]);
  });

  it("نوبتِ از قبل بیرون برنامه (استثنای پنلی) با هیچ تغییری متأثر نمی‌شود", () => {
    const list = [appointment("late", SATURDAY, "20:00")];
    expect(findAffectedByScheduleChange(list, before, [])).toEqual([]);
  });

  it("گسترش بازه یا بدون تغییر: هیچ نوبتی متأثر نیست", () => {
    const list = [appointment("a1", SATURDAY, "10:00")];
    expect(findAffectedByScheduleChange(list, before, [interval(0, "08:00", "13:00")])).toEqual([]);
    expect(findAffectedByScheduleChange(list, before, before)).toEqual([]);
  });

  it("فقط نوبت‌های همان روز هفتهٔ تغییرکرده را می‌سنجد (روزِ دیگر دست‌نخورده)", () => {
    const week = [interval(0, "09:00", "12:00"), interval(1, "09:00", "12:00")];
    const after = [interval(0, "09:00", "12:00"), interval(1, "09:00", "12:00", CLINIC_A, false)];
    const list = [appointment("sat", SATURDAY, "10:00"), appointment("sun", SUNDAY, "10:00")];
    expect(ids(findAffectedByScheduleChange(list, week, after))).toEqual(["sun"]);
  });
});

describe("confirmationToken", () => {
  it("شناسه‌ها را مرتب و یکتا با ویرگول می‌چسباند", () => {
    const views = [
      { id: "b", dateKey: SATURDAY, startTime: "10:00", patientName: "ب" },
      { id: "a", dateKey: SATURDAY, startTime: "09:00", patientName: "الف" },
      { id: "a", dateKey: SATURDAY, startTime: "09:00", patientName: "الف" },
    ];
    expect(confirmationToken(views)).toBe("a,b");
    expect(confirmationToken([])).toBe("");
  });
});

describe("requireConfirmation (تأیید دوم)", () => {
  const view = (id: string) => ({ id, dateKey: SATURDAY, startTime: "10:00", patientName: `مراجع ${id}` });

  it("فهرست خالی: هشداری نیست و ذخیره مجاز است، حتی اگر پیش‌تر تأییدی آمده باشد", () => {
    expect(requireConfirmation([], null)).toBeNull();
    expect(requireConfirmation([], ["a"])).toBeNull();
  });

  it("ارسال اول: فهرست برمی‌گردد و ذخیره نمی‌شود", () => {
    const result = requireConfirmation([view("b"), view("a")], null);

    expect(result).toMatchObject({
      ok: false,
      message: AFFECTED_MESSAGES.required,
      confirmation: { confirmedIds: "a,b", changedSinceShown: false },
    });
    expect(result?.confirmation.affected).toHaveLength(2);
    expect(result?.confirmation).not.toHaveProperty("closureDate");
  });

  it("ارسال دوم با همان فهرست (به هر ترتیب): ذخیره مجاز است", () => {
    expect(requireConfirmation([view("a"), view("b")], ["b", "a"])).toBeNull();
    expect(requireConfirmation([view("a")], ["a", "a"])).toBeNull();
  });

  it("ارسال دوم با فهرستِ فرق‌کرده (افزوده یا کم‌شده): دوباره هشدار با فهرست تازه", () => {
    const added = requireConfirmation([view("a"), view("b")], ["a"]);
    expect(added).toMatchObject({
      ok: false,
      message: AFFECTED_MESSAGES.changed,
      confirmation: { confirmedIds: "a,b", changedSinceShown: true },
    });

    const removed = requireConfirmation([view("a")], ["a", "b"]);
    expect(removed?.confirmation).toMatchObject({ confirmedIds: "a", changedSinceShown: true });

    expect(requireConfirmation([view("a")], [])?.confirmation.changedSinceShown).toBe(true);
  });

  it("تاریخ تعطیلی را برای متن هشدار همراه می‌کند", () => {
    const result = requireConfirmation([view("a")], null, { closureDate: SATURDAY });
    expect(result?.confirmation.closureDate).toBe(SATURDAY);
  });

  it("پیام‌ها فارسی‌اند و نام فنی ندارند", () => {
    for (const message of Object.values(AFFECTED_MESSAGES)) {
      expect(message).toMatch(/[؀-ۿ]/);
      expect(message).not.toMatch(/[A-Za-z]/);
    }
  });
});
