import { addDays, tehranDayKey, tehranLocalToIso } from "./dates";
import type { Appointment, FinanceData, Option, Patient, Payment, Profile } from "./types";

/**
 * دادهٔ ساختگی ماژول مالی — CLAUDE.md بخش ۶: هیچ نام، شماره یا کد ملی واقعی.
 *
 * تاریخ‌ها نسبت به «الان» ساخته می‌شوند تا همیشه چند پرداخت «امروز» باشد (برای نمای منشی).
 * عددها با یک مولد ثابت ساخته می‌شوند، پس هر بار همان داده می‌آید.
 */

const profiles: Profile[] = [
  { userId: "user-doctor", fullName: "پزشک (نمونه)", role: "doctor" },
  { userId: "user-secretary", fullName: "منشی (نمونه)", role: "secretary" },
];

// همان مقدارهای supabase/seed.sql
const paymentMethods: Option[] = [
  { id: "method-pos", name: "کارت‌خوان", isActive: true },
  { id: "method-transfer", name: "کارت‌به‌کارت", isActive: true },
];

const insuranceTypes: Option[] = [
  { id: "ins-free", name: "آزاد", isActive: true },
  { id: "ins-tamin", name: "تأمین اجتماعی", isActive: true },
  { id: "ins-khadamat", name: "خدمات درمانی", isActive: true },
];

const PATIENT_NAMES = [
  "زهرا احمدی",
  "محمد رضایی",
  "فاطمه کریمی",
  "علی موسوی",
  "مریم حسینی",
  "رضا نوری",
  "سمیه قاسمی",
  "حسین جعفری",
  "نرگس شریفی",
  "مهدی صادقی",
  "لیلا رحیمی",
  "امیر کاظمی",
];

const AMOUNTS = [350_000, 450_000, 600_000, 800_000, 950_000, 1_200_000, 1_500_000, 2_500_000];
const CLINIC_TIMES = ["14:10", "14:45", "15:30", "16:05", "16:40", "17:20", "18:00", "18:35"];

/** مولد عدد شبه‌تصادفی با دانهٔ ثابت؛ Math.random نه، تا داده هر بار یکی باشد */
function seeded(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    // بیت‌های بالا را برمی‌دارد؛ بیت‌های پایین این مولد الگوی تکراری دارند
    return Math.floor((state / 2147483648) * max);
  };
}

export function buildMockFinanceData(now: Date): FinanceData {
  const random = seeded(1405);
  const today = tehranDayKey(now);

  const patients: Patient[] = PATIENT_NAMES.map((fullName, index) => ({
    id: `patient-${index + 1}`,
    fullName,
    // دو نفر شمارهٔ شخصی ندارند (تصمیم M-1)
    mobile: index % 6 === 5 ? null : `0912000${String(index + 1).padStart(4, "0")}`,
    insuranceTypeId: insuranceTypes[index % insuranceTypes.length].id,
  }));

  // زمان‌های امروز بین نیمه‌شب تهران و الان پخش می‌شوند تا هیچ‌کدام در آینده نباشد
  const midnight = new Date(tehranLocalToIso(today, "00:00")).getTime();
  const todayTimes = [0.35, 0.55, 0.7, 0.85, 0.95].map((share) =>
    new Date(midnight + (now.getTime() - midnight) * share).toISOString(),
  );

  const appointments: Appointment[] = [];
  const payments: Payment[] = [];

  const addPayment = (paidAt: string, patient: Patient, withAppointment: boolean) => {
    let appointmentId: string | null = null;
    if (withAppointment) {
      appointmentId = `appointment-${appointments.length + 1}`;
      appointments.push({ id: appointmentId, patientId: patient.id, startsAt: paidAt, status: "done" });
    }
    payments.push({
      id: `payment-${payments.length + 1}`,
      patientId: patient.id,
      appointmentId,
      amountToman: AMOUNTS[random(AMOUNTS.length)],
      paymentMethodId: paymentMethods[random(paymentMethods.length)].id,
      insuranceTypeId: patient.insuranceTypeId,
      paidAt,
      recordedBy: random(4) === 0 ? "user-doctor" : "user-secretary",
      reversesPaymentId: null,
      note: random(5) === 0 ? "پیش‌پرداخت جلسهٔ بعد" : null,
      createdAt: paidAt,
    });
  };

  // ۳۵ پرداخت در ۶۰ روز گذشته، و ۵ پرداخت امروز
  for (let index = 0; index < 35; index += 1) {
    const day = addDays(today, -(1 + random(60)));
    const paidAt = tehranLocalToIso(day, CLINIC_TIMES[random(CLINIC_TIMES.length)]);
    addPayment(paidAt, patients[random(patients.length)], random(4) !== 0);
  }
  todayTimes.forEach((paidAt) => addPayment(paidAt, patients[random(patients.length)], true));

  // سه اصلاح: یکی امروز (منشی هم می‌بیند)، دو تا روی پرداخت‌های روزهای قبل
  for (const target of [payments[payments.length - 2], payments[3], payments[17]]) {
    payments.push({
      ...target,
      id: `payment-${payments.length + 1}`,
      amountToman: -target.amountToman,
      recordedBy: "user-doctor",
      reversesPaymentId: target.id,
      note: "مبلغ اشتباه وارد شده بود",
      createdAt: new Date(
        Math.min(new Date(target.paidAt).getTime() + 20 * 60_000, now.getTime()),
      ).toISOString(),
    });
  }

  // دو نوبت امروز که هنوز پرداخت ندارند؛ با انتخاب این دو مراجع، فرم نوبتشان را خودش انتخاب می‌کند
  appointments.push(
    {
      id: `appointment-${appointments.length + 1}`,
      patientId: patients[8].id,
      startsAt: new Date(midnight + (now.getTime() - midnight) * 0.9).toISOString(),
      status: "arrived",
    },
    {
      id: `appointment-${appointments.length + 2}`,
      patientId: patients[11].id,
      startsAt: tehranLocalToIso(today, "18:35"),
      status: "confirmed",
    },
  );

  return { profiles, patients, appointments, paymentMethods, insuranceTypes, payments };
}
