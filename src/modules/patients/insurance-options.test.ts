import { describe, expect, it } from "vitest";

import {
  activeInsuranceNames,
  buildInsuranceOptions,
  DEFAULT_INSURANCE_TYPE_NAME,
  defaultInsuranceName,
} from "./insurance-options";

/** نام‌های seed.sql؛ ترتیب همان ترتیبی است که پرسمان می‌دهد. */
const SEED = ["آزاد", "تأمین اجتماعی", "خدمات درمانی"];

describe("activeInsuranceNames", () => {
  it("نام‌ها را با همان ترتیب ورودی برمی‌گرداند", () => {
    expect(activeInsuranceNames(SEED.map((name) => ({ name })))).toEqual(SEED);
  });

  it("فاصلهٔ دو سر را برمی‌دارد، نام خالی را دور می‌ریزد و تکراری را یک‌بار نگه می‌دارد", () => {
    const rows = [{ name: " آزاد " }, { name: "" }, { name: "   " }, { name: "آزاد" }, { name: "خدمات درمانی" }];
    expect(activeInsuranceNames(rows)).toEqual(["آزاد", "خدمات درمانی"]);
  });

  it("بدون ردیف، فهرست خالی است", () => {
    expect(activeInsuranceNames([])).toEqual([]);
  });
});

describe("buildInsuranceOptions", () => {
  it("بیمهٔ فعلیِ فعال دوبار نمی‌آید", () => {
    expect(buildInsuranceOptions(SEED, "تأمین اجتماعی")).toEqual(SEED);
  });

  it("بیمهٔ فعلیِ غیرفعال یا ناموجود در فهرست می‌ماند و فقط یک‌بار می‌آید", () => {
    expect(buildInsuranceOptions(SEED, "سلامت")).toEqual([...SEED, "سلامت"]);
  });

  it("مراجع بدون بیمه چیزی به فهرست اضافه نمی‌کند", () => {
    expect(buildInsuranceOptions(SEED, "")).toEqual(SEED);
    expect(buildInsuranceOptions(SEED, "  ")).toEqual(SEED);
  });

  it("فاصلهٔ دو سر نام فعلی را نادیده می‌گیرد", () => {
    expect(buildInsuranceOptions(SEED, " آزاد ")).toEqual(SEED);
    expect(buildInsuranceOptions(SEED, " سلامت ")).toEqual([...SEED, "سلامت"]);
  });

  it("فهرست ورودی را تغییر نمی‌دهد", () => {
    const active = [...SEED];
    buildInsuranceOptions(active, "سلامت");
    expect(active).toEqual(SEED);
  });

  it("وقتی هیچ نوع فعالی نیست، فقط بیمهٔ فعلی می‌ماند", () => {
    expect(buildInsuranceOptions([], "سلامت")).toEqual(["سلامت"]);
    expect(buildInsuranceOptions([], "")).toEqual([]);
  });
});

describe("defaultInsuranceName", () => {
  it("«آزاد» در فهرست فعال باشد پیش‌فرض است", () => {
    expect(DEFAULT_INSURANCE_TYPE_NAME).toBe("آزاد");
    expect(defaultInsuranceName(SEED)).toBe("آزاد");
  });

  it("«آزاد» در فهرست نباشد، پیش‌فرض خالی است", () => {
    expect(defaultInsuranceName(["تأمین اجتماعی", "خدمات درمانی"])).toBe("");
    expect(defaultInsuranceName([])).toBe("");
  });
});
