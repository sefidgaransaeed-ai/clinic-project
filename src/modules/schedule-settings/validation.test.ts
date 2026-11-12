import { describe, expect, it } from "vitest";

import {
  CLOSURE_MESSAGES,
  CLOSURE_REASON_MAX_LENGTH,
  dbWeekdayOfDate,
  findWorkingHoursOverlap,
  isValidGregorianDate,
  jsWeekdayToDbWeekday,
  deriveClinicForWeekday,
  findWeekdayClinicConflict,
  validateClosure,
  validateRowId,
  validateWorkingHoursChange,
  validateWorkingHoursEdit,
  validateWorkingHoursRow,
  WORKING_HOURS_MESSAGES,
  type ExistingWorkingHours,
  type ResolvedWorkingHoursRow,
  type WorkingHoursInput,
} from "./validation";

const CLINIC_A = "11111111-1111-4111-8111-111111111111";
const CLINIC_B = "22222222-2222-4222-8222-222222222222";
const ROW_ID = "33333333-3333-4333-8333-333333333333";

function row(overrides: Partial<WorkingHoursInput> = {}): WorkingHoursInput {
  return { clinicId: CLINIC_A, weekday: 0, startTime: "14:00", endTime: "18:00", isActive: true, ...overrides };
}

function existing(overrides: Partial<ExistingWorkingHours> = {}): ExistingWorkingHours {
  return { id: ROW_ID, clinicId: CLINIC_A, weekday: 0, startTime: "14:00", endTime: "18:00", isActive: true, ...overrides };
}

describe("jsWeekdayToDbWeekday", () => {
  it("شنبه ۰، یکشنبه ۱ و جمعه ۶ می‌شود", () => {
    expect(jsWeekdayToDbWeekday(6)).toBe(0); // JS: شنبه
    expect(jsWeekdayToDbWeekday(0)).toBe(1); // JS: یکشنبه
    expect(jsWeekdayToDbWeekday(1)).toBe(2);
    expect(jsWeekdayToDbWeekday(2)).toBe(3);
    expect(jsWeekdayToDbWeekday(3)).toBe(4);
    expect(jsWeekdayToDbWeekday(4)).toBe(5);
    expect(jsWeekdayToDbWeekday(5)).toBe(6); // JS: جمعه
  });

  it("عدد بیرون از ۰ تا ۶ یا غیرصحیح را رد می‌کند", () => {
    expect(() => jsWeekdayToDbWeekday(7)).toThrow(RangeError);
    expect(() => jsWeekdayToDbWeekday(-1)).toThrow(RangeError);
    expect(() => jsWeekdayToDbWeekday(1.5)).toThrow(RangeError);
  });
});

describe("dbWeekdayOfDate", () => {
  it("از روی تاریخ میلادی واقعی روز را می‌یابد", () => {
    expect(dbWeekdayOfDate("2026-11-14")).toBe(0); // شنبه
    expect(dbWeekdayOfDate("2026-11-15")).toBe(1); // یکشنبه
    expect(dbWeekdayOfDate("2026-11-18")).toBe(4); // چهارشنبه
    expect(dbWeekdayOfDate("2026-11-13")).toBe(6); // جمعه
  });
});

describe("validateWorkingHoursRow", () => {
  it("ردیف درست را می‌پذیرد و نرمال می‌کند", () => {
    const result = validateWorkingHoursRow(row({ startTime: " 14:00 ", endTime: "18:15" }));
    expect(result).toEqual({
      ok: true,
      value: { id: undefined, clinicId: CLINIC_A, weekday: 0, startTime: "14:00", endTime: "18:15", isActive: true },
    });
  });

  it("در سطح خودِ ردیف مطبِ خالی یعنی «ورودی مطب نداشت» (مشتق‌کردنش با validateWorkingHoursChange است)", () => {
    const result = validateWorkingHoursRow(row({ clinicId: null }));
    expect(result.ok && result.value.clinicId).toBeNull();
    expect(validateWorkingHoursRow({ weekday: 0, startTime: "14:00", endTime: "18:00", isActive: true }).ok).toBe(true);
  });

  it.each([0, 3, 6])("روز %i را می‌پذیرد", (weekday) => {
    expect(validateWorkingHoursRow(row({ weekday })).ok).toBe(true);
  });

  it.each([-1, 7, 1.5, "0", null, undefined, Number.NaN])("روز %j را رد می‌کند", (weekday) => {
    expect(validateWorkingHoursRow(row({ weekday }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.weekday });
  });

  it.each(["", "9:00", "24:00", "14:60", "14-00", "14:00:00", "۱۴:۰۰", "abc"])("ساعت %j را رد می‌کند", (startTime) => {
    expect(validateWorkingHoursRow(row({ startTime }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.time });
  });

  it("ساعت غیررشته‌ای را رد می‌کند", () => {
    expect(validateWorkingHoursRow(row({ endTime: 1800 }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.time });
    expect(validateWorkingHoursRow(row({ startTime: null }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.time });
  });

  it("گام ۱۵ دقیقه‌ای را الزام می‌کند (هم‌گام با SLOT_MINUTES ماژول نوبت‌ها)", () => {
    expect(validateWorkingHoursRow(row({ startTime: "14:10" }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.step });
    expect(validateWorkingHoursRow(row({ endTime: "18:20" }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.step });
    expect(validateWorkingHoursRow(row({ startTime: "15:30", endTime: "19:00" })).ok).toBe(true);
    expect(validateWorkingHoursRow(row({ startTime: "14:45", endTime: "15:00" })).ok).toBe(true);
  });

  it("شروع باید قبل از پایان باشد", () => {
    const message = { ok: false, message: WORKING_HOURS_MESSAGES.order };
    expect(validateWorkingHoursRow(row({ startTime: "18:00", endTime: "14:00" }))).toEqual(message);
    expect(validateWorkingHoursRow(row({ startTime: "14:00", endTime: "14:00" }))).toEqual(message);
  });

  it("is_active فقط بولین پذیرفته می‌شود", () => {
    expect(validateWorkingHoursRow(row({ isActive: false })).ok).toBe(true);
    for (const isActive of ["true", 1, 0, null, undefined]) {
      expect(validateWorkingHoursRow(row({ isActive }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.isActive });
    }
  });

  it("شناسهٔ مطب یا ردیف نامعتبر را رد می‌کند", () => {
    expect(validateWorkingHoursRow(row({ clinicId: "x" }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
    expect(validateWorkingHoursRow(row({ clinicId: 5 }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
    expect(validateWorkingHoursRow(row({ id: "x" }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
    expect(validateWorkingHoursRow(row({ id: ROW_ID })).ok).toBe(true);
  });
});

describe("validateRowId", () => {
  it("uuid را می‌پذیرد و بقیه را رد می‌کند", () => {
    expect(validateRowId(ROW_ID)).toEqual({ ok: true, value: ROW_ID });
    expect(validateRowId("1 or 1=1")).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
    expect(validateRowId(undefined)).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
  });
});

describe("findWorkingHoursOverlap", () => {
  const candidate = (overrides: Partial<WorkingHoursInput> = {}): ResolvedWorkingHoursRow => {
    const result = validateWorkingHoursRow(row(overrides));
    if (!result.ok || result.value.clinicId === null) throw new Error("ردیف آزمون باید معتبر و دارای مطب باشد");
    return { ...result.value, clinicId: result.value.clinicId };
  };

  it("بازهٔ هم‌پوشان در همان روز و همان مطب را پیدا می‌کند", () => {
    const other = existing({ startTime: "16:00", endTime: "19:00" });
    expect(findWorkingHoursOverlap(candidate(), [other])).toBe(other);
  });

  it("بازهٔ کاملاً داخل یا کاملاً دربرگیرنده را هم‌پوشان می‌داند", () => {
    expect(findWorkingHoursOverlap(candidate({ startTime: "15:00", endTime: "16:00" }), [existing()])).toBeDefined();
    expect(findWorkingHoursOverlap(candidate({ startTime: "13:00", endTime: "20:00" }), [existing()])).toBeDefined();
  });

  it("بازه‌های پشت‌سرهم (پایان = شروع بعدی) هم‌پوشانی ندارند", () => {
    expect(findWorkingHoursOverlap(candidate({ startTime: "18:00", endTime: "20:00" }), [existing()])).toBeUndefined();
    expect(findWorkingHoursOverlap(candidate({ startTime: "12:00", endTime: "14:00" }), [existing()])).toBeUndefined();
  });

  it("روز یا مطب دیگر مانع نیست", () => {
    expect(findWorkingHoursOverlap(candidate(), [existing({ weekday: 1 })])).toBeUndefined();
    expect(findWorkingHoursOverlap(candidate(), [existing({ clinicId: CLINIC_B })])).toBeUndefined();
  });

  it("ردیف غیرفعال مانع نیست، و ردیف تازهٔ غیرفعال چیزی را نمی‌شکند", () => {
    expect(findWorkingHoursOverlap(candidate(), [existing({ isActive: false })])).toBeUndefined();
    expect(findWorkingHoursOverlap(candidate({ isActive: false }), [existing()])).toBeUndefined();
  });

  it("خودِ ردیفِ در حال ویرایش با خودش هم‌پوشانی ندارد", () => {
    expect(findWorkingHoursOverlap(candidate({ id: ROW_ID, endTime: "17:00" }), [existing()])).toBeUndefined();
  });
});

const KNOWN = [CLINIC_A, CLINIC_B];

function change(input: WorkingHoursInput, rows: readonly ExistingWorkingHours[] = [existing()]) {
  return validateWorkingHoursChange(input, rows, KNOWN);
}

describe("validateWorkingHoursChange", () => {
  it("هم‌پوشانی را با پیام فارسی و ساعت‌های ردیف موجود رد می‌کند", () => {
    const result = change(row({ startTime: "16:00", endTime: "19:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("هم‌پوشانی");
      expect(result.message).toContain("۱۴:۰۰ تا ۱۸:۰۰");
      expect(result.message).not.toMatch(/[A-Za-z]/);
    }
  });

  it("خطای خودِ ردیف را پیش از هر قاعدهٔ دیگر برمی‌گرداند", () => {
    expect(change(row({ startTime: "20:00" }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.order });
  });

  describe("روزِ دارای ردیف فعال: مطب مشتق می‌شود", () => {
    it("بدون clinicId مطب را از ردیف فعالِ همان روز می‌گیرد", () => {
      const result = change(row({ clinicId: undefined, startTime: "18:00", endTime: "20:00" }));
      expect(result.ok && result.value.clinicId).toBe(CLINIC_A);
    });

    it("clinicIdِ صریحِ هم‌مطب را می‌پذیرد", () => {
      expect(change(row({ startTime: "18:00", endTime: "20:00" })).ok).toBe(true);
    });

    it("مطبِ دوم را رد می‌کند، حتی اگر ساعت‌ها هم‌پوشانی نداشته باشند", () => {
      const result = change(row({ clinicId: CLINIC_B, startTime: "19:00", endTime: "20:00" }), [
        existing({ clinicName: "مطب ظفر" }),
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("هر روز فقط به یک مطب تعلق دارد");
        expect(result.message).toContain("«مطب ظفر»");
        expect(result.message).not.toContain("هم‌پوشانی");
      }
    });

    it("هم‌پوشانی همچنان برای همان روز و همان مطب سنجیده می‌شود", () => {
      const result = change(row({ clinicId: undefined, startTime: "16:00", endTime: "19:00" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("هم‌پوشانی");
    });

    it("ردیف‌های فعالِ چندمطبیِ از پیش موجود را ناسازگار می‌گوید", () => {
      const rows = [existing(), existing({ id: "o", clinicId: CLINIC_B, startTime: "19:00", endTime: "20:00" })];
      expect(change(row({ clinicId: undefined, startTime: "20:00", endTime: "21:00" }), rows)).toEqual({
        ok: false,
        message: WORKING_HOURS_MESSAGES.clinicInconsistent,
      });
    });
  });

  describe("روزِ بی‌ردیف فعال: پزشک مطب را انتخاب می‌کند", () => {
    it("روزی که هرگز ردیف نداشته (مثل دوشنبه) بدون clinicId رد می‌شود و مطب ساخته نمی‌شود", () => {
      const required = { ok: false, message: WORKING_HOURS_MESSAGES.clinicRequired };
      expect(change(row({ clinicId: undefined, weekday: 2 }))).toEqual(required);
      expect(change(row({ clinicId: null, weekday: 2 }))).toEqual(required);
      expect(change(row({ clinicId: undefined }), [])).toEqual(required);
    });

    it("پیام انتخاب مطب فارسی است و به پشتیبان فنی ارجاع نمی‌دهد", () => {
      expect(WORKING_HOURS_MESSAGES.clinicRequired).toContain("مطب را انتخاب کنید");
      expect(WORKING_HOURS_MESSAGES.clinicRequired).not.toContain("پشتیبان");
      expect(WORKING_HOURS_MESSAGES.clinicRequired).not.toMatch(/[A-Za-z]/);
    });

    it("با clinicIdِ شناخته‌شده می‌پذیرد، برای هر دو مطب", () => {
      for (const clinicId of KNOWN) {
        const result = change(row({ clinicId, weekday: 2 }));
        expect(result.ok && result.value.clinicId).toBe(clinicId);
      }
    });

    it("clinicIdِ ناشناخته (uuid معتبر ولی بیرون از فهرست مطب‌ها) را رد می‌کند", () => {
      const stranger = "99999999-9999-4999-8999-999999999999";
      expect(change(row({ clinicId: stranger, weekday: 2 }))).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
      expect(change(row({ clinicId: stranger }), [])).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
      // فهرست مطب‌ها خالی باشد (مثلاً هیچ مطب فعالی نیست)، هیچ clinicId پذیرفته نمی‌شود.
      expect(validateWorkingHoursChange(row({ weekday: 2 }), [], []).ok).toBe(false);
    });

    it("روزی که فقط ردیف غیرفعال دارد مثل روزِ بی‌ردیف است: مطب انتخاب می‌شود و ردیف غیرفعال مانع نیست", () => {
      const inactive = [existing({ isActive: false })];
      expect(change(row({ clinicId: undefined }), inactive)).toEqual({
        ok: false,
        message: WORKING_HOURS_MESSAGES.clinicRequired,
      });
      // انتخابِ مطبِ دیگر هم آزاد است؛ ردیف غیرفعال مطبِ روز را قفل نمی‌کند.
      const result = change(row({ clinicId: CLINIC_B }), inactive);
      expect(result.ok && result.value.clinicId).toBe(CLINIC_B);
    });

    it("بعد از اولین ردیف فعال، همان روز فقط به همان مطب می‌رسد", () => {
      const first = change(row({ clinicId: CLINIC_B, weekday: 2 }));
      expect(first.ok).toBe(true);
      const afterFirst = [existing({ weekday: 2, clinicId: CLINIC_B })];
      expect(change(row({ clinicId: CLINIC_A, weekday: 2, startTime: "19:00", endTime: "20:00" }), afterFirst).ok).toBe(false);
      const derived = change(row({ clinicId: undefined, weekday: 2, startTime: "19:00", endTime: "20:00" }), afterFirst);
      expect(derived.ok && derived.value.clinicId).toBe(CLINIC_B);
    });

    it("ویرایشِ تنها ردیف فعال یک روز، مطب را دوباره می‌خواهد (خودش منبع مشتق‌شدن نیست)", () => {
      expect(change(row({ id: ROW_ID, clinicId: undefined, endTime: "17:00" }))).toEqual({
        ok: false,
        message: WORKING_HOURS_MESSAGES.clinicRequired,
      });
      expect(change(row({ id: ROW_ID, clinicId: CLINIC_B, endTime: "17:00" })).ok).toBe(true);
    });
  });

  it("ردیفِ تازهٔ غیرفعال قید مطب را نمی‌شکند، ولی مطبِ غیرخالی می‌خواهد", () => {
    expect(change(row({ clinicId: CLINIC_B, isActive: false })).ok).toBe(true);
    expect(change(row({ clinicId: undefined, isActive: false, weekday: 2 })).ok).toBe(false);
  });

  it("خروجی همیشه مطب غیرخالی دارد", () => {
    const result = change(row({ clinicId: CLINIC_B, weekday: 5 }));
    expect(result.ok && typeof result.value.clinicId).toBe("string");
  });
});

describe("deriveClinicForWeekday", () => {
  it("از ردیف‌های فعالِ همان روز مطب را می‌گیرد", () => {
    expect(deriveClinicForWeekday(0, [existing(), existing({ id: "x", startTime: "18:00", endTime: "19:00" })])).toEqual({
      ok: true,
      value: CLINIC_A,
    });
  });

  it("ردیف روز دیگر، ردیفِ بی‌مطب و ردیفِ غیرفعال را نادیده می‌گیرد (مطب مشتق نمی‌شود)", () => {
    expect(
      deriveClinicForWeekday(0, [existing({ weekday: 1 }), existing({ id: "y", clinicId: null }), existing({ id: "z", isActive: false })]),
    ).toEqual({ ok: true, value: null });
    expect(deriveClinicForWeekday(0, [])).toEqual({ ok: true, value: null });
  });

  it("خودِ ردیفِ در حال ویرایش منبع نیست", () => {
    expect(deriveClinicForWeekday(0, [existing()], ROW_ID)).toEqual({ ok: true, value: null });
    expect(deriveClinicForWeekday(0, [existing(), existing({ id: "o", clinicId: CLINIC_B })], ROW_ID)).toEqual({
      ok: true,
      value: CLINIC_B,
    });
  });

  it("ردیف‌های فعال چند مطبی را ناسازگار می‌گوید", () => {
    expect(deriveClinicForWeekday(0, [existing(), existing({ id: "o", clinicId: CLINIC_B })])).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.clinicInconsistent,
    });
  });
});

describe("validateWorkingHoursEdit", () => {
  /** ویرایش: ورودی clinicId ندارد و مطب از ردیفِ خودِ `ROW_ID` می‌آید. */
  const edit = (overrides: Partial<WorkingHoursInput> = {}, rows: readonly ExistingWorkingHours[] = [existing()]) =>
    validateWorkingHoursEdit(row({ id: ROW_ID, clinicId: undefined, ...overrides }), rows);

  it("مطبِ ردیف را حفظ می‌کند، حتی وقتی تنها ردیف فعالِ روز است", () => {
    const result = edit({ endTime: "17:00" });
    expect(result).toEqual({
      ok: true,
      value: { id: ROW_ID, clinicId: CLINIC_A, weekday: 0, startTime: "14:00", endTime: "17:00", isActive: true },
    });
  });

  it("clinicIdِ هم‌مطب یا null را می‌پذیرد", () => {
    expect(edit({ clinicId: CLINIC_A }).ok).toBe(true);
    expect(edit({ clinicId: null }).ok).toBe(true);
  });

  it("clinicIdِ متفاوت را با پیام فارسی رد می‌کند", () => {
    const result = edit({ clinicId: CLINIC_B });
    expect(result).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinicLocked });
    expect(WORKING_HOURS_MESSAGES.clinicLocked).not.toMatch(/[A-Za-z]/);
  });

  it("clinicIdِ نامعتبر را همان پیام مطبِ نامعتبر رد می‌کند", () => {
    expect(edit({ clinicId: "x" })).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinic });
  });

  it("به فهرست مطب‌های فعال نیاز ندارد؛ مطبِ ردیف هر چه باشد حفظ می‌شود", () => {
    const result = edit({}, [existing({ clinicId: "99999999-9999-4999-8999-999999999999" })]);
    expect(result.ok).toBe(true);
  });

  it("غیرفعال‌کردن و دوباره فعال‌کردن مطب را نمی‌پرسد", () => {
    expect(edit({ isActive: false }).ok).toBe(true);
    expect(edit({ isActive: true }, [existing({ isActive: false })]).ok).toBe(true);
  });

  it("قید یک‌مطبی با مطبِ ردیف سنجیده می‌شود: فعال‌کردنِ دوباره وقتی روز به مطب دیگر رسیده رد می‌شود", () => {
    const rows = [
      existing({ isActive: false }),
      existing({ id: "o", clinicId: CLINIC_B, clinicName: "مطب ظفر", startTime: "19:00", endTime: "20:00" }),
    ];
    const result = edit({ isActive: true }, rows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("«مطب ظفر»");
      expect(result.message).toContain("هر روز فقط به یک مطب تعلق دارد");
    }
    // ردیفِ غیرفعال همچنان بی‌مشکل است.
    expect(edit({ isActive: false }, rows).ok).toBe(true);
  });

  it("انتقال به روزی که مطبِ دیگری دارد رد می‌شود، و به روزِ بی‌ردیف آزاد است", () => {
    const rows = [existing(), existing({ id: "o", weekday: 1, clinicId: CLINIC_B })];
    expect(edit({ weekday: 1 }, rows).ok).toBe(false);
    const free = edit({ weekday: 2 }, rows);
    expect(free.ok && free.value.clinicId).toBe(CLINIC_A);
  });

  it("هم‌پوشانی با ردیف دیگرِ همان مطب و همان روز رد می‌شود، و خودِ ردیف مانع نیست", () => {
    const rows = [existing({ startTime: "18:00", endTime: "19:00" }), existing({ id: "o", startTime: "14:00", endTime: "18:00" })];
    const clash = edit({ startTime: "17:00", endTime: "19:00" }, rows);
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.message).toContain("هم‌پوشانی");
    expect(edit({ startTime: "18:00", endTime: "20:00" }, rows).ok).toBe(true);
  });

  it("خطای خودِ ردیف (ساعت، گام ۱۵ دقیقه) همچنان رد می‌شود", () => {
    expect(edit({ startTime: "20:00" })).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.order });
    expect(edit({ startTime: "14:10" })).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.step });
  });

  it("بدون id یا با ردیفی که در فهرست نیست رد می‌شود", () => {
    expect(validateWorkingHoursEdit(row({ clinicId: undefined }), [existing()])).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.id,
    });
    expect(edit({}, [])).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.id });
  });

  it("ردیفِ بی‌مطبِ قدیمی مطبی برای حفظ ندارد و ویرایش نمی‌شود", () => {
    expect(edit({}, [existing({ clinicId: null })])).toEqual({ ok: false, message: WORKING_HOURS_MESSAGES.clinicMissing });
  });

  it("ساخت ردیفِ تازه با قاعدهٔ ۱c بدون تغییر می‌ماند: روز بی‌ردیف مطب می‌خواهد", () => {
    expect(validateWorkingHoursChange(row({ clinicId: undefined, weekday: 2 }), [existing()], KNOWN)).toEqual({
      ok: false,
      message: WORKING_HOURS_MESSAGES.clinicRequired,
    });
  });
});

describe("findWeekdayClinicConflict", () => {
  const candidate = (clinicId: string, isActive = true): ResolvedWorkingHoursRow => ({
    clinicId,
    weekday: 0,
    startTime: "19:00",
    endTime: "20:00",
    isActive,
  });

  it("ردیف فعال هم‌روزِ مطب دیگر را پیدا می‌کند", () => {
    const other = existing();
    expect(findWeekdayClinicConflict(candidate(CLINIC_B), [other])).toBe(other);
  });

  it("مطب یکسان، روز دیگر، ردیف غیرفعال و ردیفِ بی‌مطب تعارض نیستند", () => {
    expect(findWeekdayClinicConflict(candidate(CLINIC_A), [existing()])).toBeUndefined();
    expect(findWeekdayClinicConflict(candidate(CLINIC_B), [existing({ weekday: 3 })])).toBeUndefined();
    expect(findWeekdayClinicConflict(candidate(CLINIC_B), [existing({ isActive: false })])).toBeUndefined();
    expect(findWeekdayClinicConflict(candidate(CLINIC_B), [existing({ clinicId: null })])).toBeUndefined();
    expect(findWeekdayClinicConflict(candidate(CLINIC_B, false), [existing()])).toBeUndefined();
  });
});

describe("isValidGregorianDate", () => {
  it.each(["2026-11-14", "2028-02-29", "2026-12-31", "2026-01-01"])("%s معتبر است", (value) => {
    expect(isValidGregorianDate(value)).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-11-31", "2026-11-00", "2026-1-5", "20261114", "1405-08-23x", "", "0000-01-01"])(
    "%j نامعتبر است",
    (value) => {
      expect(isValidGregorianDate(value)).toBe(false);
    },
  );
});

describe("validateClosure", () => {
  it("تعطیلی درست را می‌پذیرد و دلیل را مرتب می‌کند", () => {
    expect(validateClosure({ closureDate: "2026-11-20", reason: "  سفر   علمی  " }, [])).toEqual({
      ok: true,
      value: { closureDate: "2026-11-20", reason: "سفر علمی" },
    });
  });

  it("تاریخ نامعتبر یا غیررشته را رد می‌کند", () => {
    const bad = { ok: false, message: CLOSURE_MESSAGES.date };
    expect(validateClosure({ closureDate: "2026-02-30", reason: "الف" }, [])).toEqual(bad);
    expect(validateClosure({ closureDate: "1405-08-30", reason: "الف" }, [])).toEqual(bad); // تاریخ شمسی به‌اشتباه
    expect(validateClosure({ closureDate: "2101-01-01", reason: "الف" }, [])).toEqual(bad);
    expect(validateClosure({ closureDate: "1999-12-31", reason: "الف" }, [])).toEqual(bad);
    expect(validateClosure({ closureDate: undefined, reason: "الف" }, [])).toEqual(bad);
    expect(validateClosure({ closureDate: 20261120, reason: "الف" }, [])).toEqual(bad);
  });

  it("دلیل اجباری است", () => {
    const required = { ok: false, message: CLOSURE_MESSAGES.reasonRequired };
    expect(validateClosure({ closureDate: "2026-11-20", reason: "" }, [])).toEqual(required);
    expect(validateClosure({ closureDate: "2026-11-20", reason: "   " }, [])).toEqual(required);
    expect(validateClosure({ closureDate: "2026-11-20", reason: null }, [])).toEqual(required);
  });

  it("دلیل بلندتر از سقف را رد می‌کند و دقیقاً سقف را می‌پذیرد", () => {
    expect(validateClosure({ closureDate: "2026-11-20", reason: "ا".repeat(CLOSURE_REASON_MAX_LENGTH) }, []).ok).toBe(true);
    expect(validateClosure({ closureDate: "2026-11-20", reason: "ا".repeat(CLOSURE_REASON_MAX_LENGTH + 1) }, [])).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.reasonTooLong,
    });
  });

  it("تاریخ تکراری را رد می‌کند", () => {
    expect(validateClosure({ closureDate: "2026-11-20", reason: "الف" }, ["2026-11-19", "2026-11-20"])).toEqual({
      ok: false,
      message: CLOSURE_MESSAGES.duplicate,
    });
  });

  it("همهٔ پیام‌ها فارسی‌اند", () => {
    for (const message of [...Object.values(CLOSURE_MESSAGES), ...Object.values(WORKING_HOURS_MESSAGES)]) {
      expect(message).not.toMatch(/[A-Za-z]{3,}/);
    }
  });
});
