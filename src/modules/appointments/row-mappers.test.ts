import { describe, expect, it } from "vitest";

import { mapPatientRow } from "@/modules/patients/row-mappers";

import { getAllRequests, getCalendarAppointments, getDayAppointments, isAppointmentStatusLocked } from "./data";
import {
  buildPanelSnapshot,
  mapAppointmentRow,
  mapWorkingHoursRow,
  toTehranIso,
  type AppointmentRow,
} from "./row-mappers";
import { getAppointmentSlots, getFreeStartTimes } from "./slots";

/** همهٔ نام‌ها و شماره‌ها ساختگی‌اند. */
const siteRequest: AppointmentRow = {
  id: "11111111-1111-4111-8111-111111111111",
  clinic_id: null,
  patient_id: null,
  requester_name: "لیلا مهربان",
  requester_mobile: "09901111111",
  requester_national_id: "3000000011",
  requested_for_self: false,
  starts_at: "2026-11-02T10:30:00+00:00",
  ends_at: "2026-11-02T10:45:00+00:00",
  status: "requested",
  cancel_reason: null,
  source: "site",
  created_by: null,
  note: null,
  created_at: "2026-11-01T08:00:00+00:00",
};

const patientRow = {
  id: "22222222-2222-4222-8222-222222222222",
  full_name: "نگار مرادی",
  mobile: null,
  national_id: "1000000000",
  birth_date: "1988-03-12",
  gender: "female",
  insurance_types: null,
};

const panelAppointment: AppointmentRow = {
  id: "33333333-3333-4333-8333-333333333333",
  clinic_id: null,
  patient_id: patientRow.id,
  requester_name: null,
  requester_mobile: "09902222222",
  requester_national_id: null,
  requested_for_self: null,
  starts_at: "2026-11-02T11:00:00+00:00",
  ends_at: "2026-11-02T11:30:00+00:00",
  status: "confirmed",
  cancel_reason: null,
  source: "panel",
  created_by: "44444444-4444-4444-8444-444444444444",
  note: "هماهنگی تلفنی",
  created_at: "2026-11-01T09:00:00+00:00",
};

describe("toTehranIso", () => {
  it("UTC را به ساعت دیواری تهران با پسوند +03:30 می‌برد", () => {
    expect(toTehranIso("2026-11-02T10:30:00+00:00")).toBe("2026-11-02T14:00:00+03:30");
  });

  it("نوبت پایان شب به روز بعدِ تهران می‌رود", () => {
    expect(toTehranIso("2026-11-02T21:00:00+00:00")).toBe("2026-11-03T00:30:00+03:30");
  });

  it("زمان نامعتبر را رد می‌کند", () => {
    expect(() => toTehranIso("not-a-date")).toThrow();
  });
});

describe("mapWorkingHoursRow", () => {
  it("شمارهٔ روز پایگاه داده (۰ = شنبه) را به شمارهٔ روز جاوااسکریپت (۰ = یکشنبه) می‌برد", () => {
    expect(mapWorkingHoursRow({ weekday: 0, start_time: "14:00:00", end_time: "18:00:00" })).toEqual({
      weekday: 6,
      label: "شنبه",
      start_time: "14:00",
      end_time: "18:00",
    });
    expect(mapWorkingHoursRow({ weekday: 1, start_time: "15:30:00", end_time: "19:00:00" }).weekday).toBe(0);
    expect(mapWorkingHoursRow({ weekday: 4, start_time: "14:00:00", end_time: "18:00:00" }).weekday).toBe(3);
    expect(mapWorkingHoursRow({ weekday: 6, start_time: "14:00:00", end_time: "18:00:00" }).weekday).toBe(5);
  });
});

describe("mapPatientRow", () => {
  it("مراجع بدون نوع بیمه نام بیمهٔ خالی می‌گیرد، نه مقدار ساختگی", () => {
    expect(mapPatientRow(patientRow)).toMatchObject({ full_name: "نگار مرادی", gender: "female", insurance_type_name: "" });
  });

  it("نام نوع بیمه را از join برمی‌دارد", () => {
    expect(mapPatientRow({ ...patientRow, insurance_types: { name: "سلامت" } }).insurance_type_name).toBe("سلامت");
  });

  it("جنس نامعتبر را رد می‌کند", () => {
    expect(() => mapPatientRow({ ...patientRow, gender: "other" })).toThrow();
  });
});

describe("mapAppointmentRow", () => {
  it("درخواست سایت را بدون تغییر نام و شماره نگه می‌دارد", () => {
    const mapped = mapAppointmentRow(siteRequest, null);
    expect(mapped).toMatchObject({
      requester_name: "لیلا مهربان",
      requester_mobile: "09901111111",
      requested_for_self: false,
      starts_at: "2026-11-02T14:00:00+03:30",
      ends_at: "2026-11-02T14:15:00+03:30",
      status: "requested",
      source: "site",
      created_by: null,
      patient: null,
    });
  });

  it("نوبت پنلی نام مراجع را می‌گیرد و requested_for_self خالی را درست حساب می‌کند", () => {
    const patient = mapPatientRow(patientRow);
    const mapped = mapAppointmentRow(panelAppointment, patient);
    expect(mapped.requester_name).toBe("نگار مرادی");
    expect(mapped.requested_for_self).toBe(true);
    expect(mapped.patient).toBe(patient);
  });

  it("نوبت پنلی بدون نام و بدون مراجع پیداشده نمی‌شکند و نام خالی می‌گیرد", () => {
    const mapped = mapAppointmentRow(panelAppointment, null);
    expect(mapped.requester_name).toBe("");
    expect(mapped.requested_for_self).toBe(true);
    expect(mapped.patient).toBeNull();
  });

  it("وضعیت ناشناخته را رد می‌کند", () => {
    expect(() => mapAppointmentRow({ ...siteRequest, status: "weird" }, null)).toThrow();
  });
});

describe("buildPanelSnapshot", () => {
  const snapshot = buildPanelSnapshot({
    appointments: [panelAppointment, siteRequest],
    patients: [patientRow],
    workingHours: [
      { weekday: 1, start_time: "15:30:00", end_time: "19:00:00" },
      { weekday: 3, start_time: "14:00:00", end_time: "18:00:00" },
    ],
    closures: [{ closure_date: "2026-11-09", reason: null }],
    today: "2026-11-02",
  });

  it("نوبت‌ها را به ترتیب زمان می‌چیند و مراجع را وصل می‌کند", () => {
    expect(snapshot.appointments.map((item) => item.id)).toEqual([siteRequest.id, panelAppointment.id]);
    expect(snapshot.appointments[1].patient?.full_name).toBe("نگار مرادی");
    expect(snapshot.closures).toEqual([{ date: "2026-11-09", reason: "" }]);
    expect(snapshot.today).toBe("2026-11-02");
  });

  it("فیلترهای خالص روی ردیف‌های نگاشت‌شده کار می‌کنند", () => {
    // ۲ نوامبر ۲۰۲۶ دوشنبه است؛ هر دو نوبت در همین روزِ تهران‌اند.
    expect(getDayAppointments(snapshot, "2026-11-02")).toHaveLength(2);
    expect(getAllRequests(snapshot).map((item) => item.id)).toEqual([siteRequest.id]);
    // هفتهٔ شنبه ۳۱ اکتبر؛ فقط نوبت تأییدشده ساعت را اشغال می‌کند، نه درخواست.
    expect(getCalendarAppointments(snapshot, "2026-10-31").map((item) => item.id)).toEqual([panelAppointment.id]);
    // روز هفتم پس از نوبت هنوز مجاز است و از روز هشتم بسته می‌شود.
    expect(isAppointmentStatusLocked(snapshot.appointments[1], "2026-11-09")).toBe(false);
    expect(isAppointmentStatusLocked(snapshot.appointments[1], "2026-11-10")).toBe(true);
  });

  it("خانه‌های تقویم از ساعت کاری واقعی می‌آیند", () => {
    const slots = getAppointmentSlots(snapshot.workingDays);
    expect(slots[0]).toBe("14:00");
    expect(slots.at(-1)).toBe("18:45");

    // یکشنبه ۱ نوامبر: ساعت ۱۵:۳۰ تا ۱۹:۰۰ و هیچ نوبتی ندارد.
    const sunday = getFreeStartTimes(snapshot, "2026-11-01");
    expect(sunday[0]).toBe("15:30");
    expect(sunday.at(-1)).toBe("18:45");
    // دوشنبه روز کاری نیست.
    expect(getFreeStartTimes(snapshot, "2026-11-02")).toEqual([]);
  });

  it("نوبت تأییدشده با ساعت UTC، ساعت تهرانِ درست را اشغال می‌کند", () => {
    // سه‌شنبه ۳ نوامبر، ۱۰:۳۰ تا ۱۱:۰۰ UTC = ۱۴:۰۰ تا ۱۴:۳۰ تهران.
    const booked: AppointmentRow = {
      ...panelAppointment,
      id: "55555555-5555-4555-8555-555555555555",
      starts_at: "2026-11-03T10:30:00+00:00",
      ends_at: "2026-11-03T11:00:00+00:00",
    };
    const withBooking = buildPanelSnapshot({
      appointments: [booked],
      patients: [patientRow],
      workingHours: [{ weekday: 3, start_time: "14:00:00", end_time: "18:00:00" }],
      closures: [],
      today: "2026-11-01",
    });
    expect(getFreeStartTimes(withBooking, "2026-11-03")[0]).toBe("14:30");
  });
});
