import { describe, expect, it } from "vitest";

import { DB_WRITE_FAILED_MESSAGE } from "@/modules/appointments/db-errors";
import { NATIONAL_ID_MESSAGES } from "@/modules/appointments/patient-validation";

import {
  buildPatientInsert,
  buildPatientUpdate,
  emptyToNull,
  insuranceNotSavedNotice,
  isPatientId,
  lookupInsurance,
  parsePatientForm,
  PATIENT_FULL_NAME_MESSAGE,
  type InsuranceTypeRow,
  type PatientFields,
} from "./patient-input";

/** همهٔ نام‌ها و شماره‌ها ساختگی‌اند؛ «۱۲۳۴۵۶۷۸۹۱» رقم کنترل درست دارد. */
const VALID_NATIONAL_ID = "1234567891";

const FORM = {
  full_name: "سارا نمونه",
  mobile: "09120000000",
  national_id: VALID_NATIONAL_ID,
  birth_date: "01/01/1400",
  gender: "female",
  insurance_type_name: "آزاد",
};

const INSURANCE_TYPES: InsuranceTypeRow[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "آزاد" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "خدمات درمانی" },
];

const FIELDS: PatientFields = {
  full_name: "سارا نمونه",
  national_id: VALID_NATIONAL_ID,
  mobile: null,
  birth_date: null,
  gender: null,
};

describe("emptyToNull", () => {
  it("رشتهٔ خالی و فقط فاصله null می‌شود", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("   ")).toBeNull();
  });

  it("مقدار پرشده بدون فاصلهٔ دو سر می‌ماند", () => {
    expect(emptyToNull(" 09120000000 ")).toBe("09120000000");
  });
});

describe("parsePatientForm", () => {
  it("فیلدهای اختیاریِ خالی null می‌شوند، نه رشتهٔ خالی", () => {
    const parsed = parsePatientForm({ ...FORM, mobile: "", birth_date: "", gender: "", insurance_type_name: "" });
    expect(parsed).toEqual({
      ok: true,
      fields: { full_name: "سارا نمونه", national_id: VALID_NATIONAL_ID, mobile: null, birth_date: null, gender: null },
      insuranceName: "",
    });
  });

  it("تاریخ تولد شمسیِ روز/ماه/سال به میلادیِ YYYY-MM-DD تبدیل می‌شود", () => {
    const first = parsePatientForm({ ...FORM, birth_date: "01/01/1400" });
    expect(first.ok && first.fields.birth_date).toBe("2021-03-21");

    const second = parsePatientForm({ ...FORM, birth_date: "12/05/1370" });
    expect(second.ok && second.fields.birth_date).toBe("1991-08-03");
  });

  it("رقم فارسی در کد ملی و شماره لاتین می‌شود و نام و بیمه از فاصلهٔ دو سر پاک می‌شوند", () => {
    const parsed = parsePatientForm({
      ...FORM,
      full_name: "  سارا نمونه ",
      mobile: "۰۹۱۲۰۰۰۰۰۰۰",
      national_id: "۱۲۳۴۵۶۷۸۹۱",
      insurance_type_name: " آزاد ",
    });
    expect(parsed).toMatchObject({
      ok: true,
      fields: { full_name: "سارا نمونه", mobile: "09120000000", national_id: VALID_NATIONAL_ID, gender: "female" },
      insuranceName: "آزاد",
    });
  });

  it("نام خالی، کد ملی نامعتبر، شمارهٔ بد و جنس ناشناخته هر کدام پیام فارسی می‌دهند", () => {
    expect(parsePatientForm({ ...FORM, full_name: "  " })).toEqual({ ok: false, message: PATIENT_FULL_NAME_MESSAGE });
    expect(parsePatientForm({ ...FORM, national_id: "" })).toEqual({ ok: false, message: NATIONAL_ID_MESSAGES.empty });
    expect(parsePatientForm({ ...FORM, national_id: "1234567890" })).toEqual({
      ok: false,
      message: NATIONAL_ID_MESSAGES.invalid,
    });
    expect(parsePatientForm({ ...FORM, mobile: "0912" }).ok).toBe(false);
    expect(parsePatientForm({ ...FORM, birth_date: "40/01/1400" }).ok).toBe(false);
    expect(parsePatientForm({ ...FORM, gender: "other" }).ok).toBe(false);
  });

  it("ورودی ناقص یا غیررشته‌ای (ورودی کلاینت) پیام کلی می‌دهد", () => {
    expect(parsePatientForm(null)).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
    expect(parsePatientForm({ ...FORM, mobile: undefined })).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
    expect(parsePatientForm({ ...FORM, national_id: 1234567891 })).toEqual({ ok: false, message: DB_WRITE_FAILED_MESSAGE });
  });
});

describe("lookupInsurance", () => {
  it("نام موجود به شناسه نگاشت می‌شود", () => {
    expect(lookupInsurance("خدمات درمانی", INSURANCE_TYPES)).toEqual({ kind: "found", id: INSURANCE_TYPES[1].id });
    expect(lookupInsurance("  آزاد ", INSURANCE_TYPES)).toEqual({ kind: "found", id: INSURANCE_TYPES[0].id });
  });

  it("نام خالی blank و نامِ بیرون از فهرست unknown است", () => {
    expect(lookupInsurance("", INSURANCE_TYPES)).toEqual({ kind: "blank" });
    expect(lookupInsurance("  ", INSURANCE_TYPES)).toEqual({ kind: "blank" });
    expect(lookupInsurance("سلامت", INSURANCE_TYPES)).toEqual({ kind: "unknown", name: "سلامت" });
    expect(lookupInsurance("آزاد", [])).toEqual({ kind: "unknown", name: "آزاد" });
  });
});

describe("insuranceNotSavedNotice", () => {
  it("فقط برای نام ناشناخته هشدار می‌دهد و نام را در آن می‌آورد", () => {
    expect(insuranceNotSavedNotice({ kind: "unknown", name: "سلامت" })).toContain("«سلامت»");
    expect(insuranceNotSavedNotice({ kind: "blank" })).toBeUndefined();
    expect(insuranceNotSavedNotice({ kind: "found", id: INSURANCE_TYPES[0].id })).toBeUndefined();
  });
});

describe("buildPatientInsert", () => {
  it("بیمهٔ پیداشده شناسه می‌گیرد و created_by کاربر است", () => {
    expect(buildPatientInsert(FIELDS, "user-1", { kind: "found", id: INSURANCE_TYPES[0].id })).toEqual({
      ...FIELDS,
      insurance_type_id: INSURANCE_TYPES[0].id,
      created_by: "user-1",
    });
  });

  it("نام ناشناخته یا خالی insurance_type_id را null می‌فرستد", () => {
    expect(buildPatientInsert(FIELDS, "user-1", { kind: "unknown", name: "سلامت" }).insurance_type_id).toBeNull();
    expect(buildPatientInsert(FIELDS, "user-1", { kind: "blank" }).insurance_type_id).toBeNull();
  });
});

describe("buildPatientUpdate", () => {
  it("همهٔ فیلدها از جمله کد ملی نوشته می‌شوند و بیمهٔ پیداشده شناسه می‌گیرد", () => {
    expect(buildPatientUpdate(FIELDS, { kind: "found", id: INSURANCE_TYPES[1].id })).toEqual({
      ...FIELDS,
      insurance_type_id: INSURANCE_TYPES[1].id,
    });
  });

  it("نام ناشناخته یا خالی کلید insurance_type_id را اصلاً نمی‌فرستد تا بیمهٔ ثبت‌شده پاک نشود", () => {
    const unknown = buildPatientUpdate(FIELDS, { kind: "unknown", name: "سلامت" });
    const blank = buildPatientUpdate(FIELDS, { kind: "blank" });
    expect("insurance_type_id" in unknown).toBe(false);
    expect("insurance_type_id" in blank).toBe(false);
    expect(unknown.national_id).toBe(VALID_NATIONAL_ID);
  });
});

describe("isPatientId", () => {
  it("فقط uuid را می‌پذیرد", () => {
    expect(isPatientId(INSURANCE_TYPES[0].id)).toBe(true);
    expect(isPatientId("not-a-uuid")).toBe(false);
    expect(isPatientId(undefined)).toBe(false);
  });
});
