import { describe, expect, it } from "vitest";

import { PATIENT_SUGGESTION_LIMIT, suggestPatients } from "./panel-patient-search";
import type { AppointmentSnapshot, Patient } from "./types";

/** همهٔ نام‌ها و شماره‌ها ساختگی‌اند. */
function patient(id: string, fullName: string, nationalId: string, mobile: string | null): Patient {
  return { id, full_name: fullName, national_id: nationalId, mobile, birth_date: null, gender: null, insurance_type_name: "آزاد" };
}

function snapshotOf(patients: Patient[]): AppointmentSnapshot {
  return { appointments: [], patients, closures: [], workingDays: [] };
}

const nasim = patient("p1", "نسیم رضایی", "1234567890", "09121110001");
const arman = patient("p2", "آرمان کاظمی", "1239999999", null);
const sara = patient("p3", "سارا نوری", "5550000000", "09351110002");
const snapshot = snapshotOf([nasim, arman, sara]);

describe("suggestPatients", () => {
  it("با ۲ حرف از نام پیشنهاد می‌دهد و با یک حرف نه", () => {
    expect(suggestPatients(snapshot, "نس")).toEqual([nasim]);
    expect(suggestPatients(snapshot, "ن")).toEqual([]);
  });

  it("با ۳ رقم اول کد ملی پیشنهاد می‌دهد، و با ۲ رقم نه", () => {
    expect(suggestPatients(snapshot, "123")).toEqual([nasim, arman]);
    expect(suggestPatients(snapshot, "12")).toEqual([]);
  });

  it("رقم فارسی هم کار می‌کند", () => {
    expect(suggestPatients(snapshot, "۱۲۳۹")).toEqual([arman]);
  });

  it("با ۳ رقم اول شماره، با صفر اول یا بدون آن، پیشنهاد می‌دهد", () => {
    expect(suggestPatients(snapshot, "0912")).toEqual([nasim]);
    expect(suggestPatients(snapshot, "912")).toEqual([nasim]);
    expect(suggestPatients(snapshot, "0935")).toEqual([sara]);
  });

  it("رقم میانهٔ کد ملی یا شماره پیشنهاد نمی‌دهد؛ فقط پیشوند", () => {
    expect(suggestPatients(snapshot, "456")).toEqual([]);
    expect(suggestPatients(snapshot, "111")).toEqual([]);
  });

  it("حداکثر هشت پیشنهاد می‌دهد", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      patient(`m${index}`, `مراجع ${index}`, `77700000${String(index).padStart(2, "0")}`, null),
    );
    expect(PATIENT_SUGGESTION_LIMIT).toBe(8);
    expect(suggestPatients(snapshotOf(many), "777")).toHaveLength(8);
  });
});
