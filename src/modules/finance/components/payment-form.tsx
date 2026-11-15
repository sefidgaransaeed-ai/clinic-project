"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  findRecentDuplicate,
  PAYABLE_STATUSES,
  suggestAppointment,
  validateNewPayment,
  type NewPayment,
  type NewPaymentErrors,
} from "../data";
import {
  addDays,
  dayKeyToJalali,
  formatJalaliDate,
  formatJalaliDateTime,
  parseJalaliDate,
  tehranDayKey,
  tehranLocalToIso,
  tehranTime,
  toLatinDigits,
  toPersianDigits,
} from "../dates";
import type { Appointment, Option, Patient, Payment } from "../types";
import { MoneyInput } from "./money-input";
import { PatientPicker } from "./patient-picker";
import {
  field,
  fieldError,
  fieldHint,
  label,
  pillButton,
  primaryButton,
  secondaryButton,
} from "./styles";
import { Toman } from "./toman";

type Draft = {
  patientId: string | null;
  appointmentId: string;
  amountToman: number | null;
  paymentMethodId: string;
  date: string;
  time: string;
  note: string;
};

// همان مدت انیمیشن fin-stamp در theme.css
const STAMP_MS = 2600;

function emptyDraft(now: Date): Draft {
  return {
    patientId: null,
    appointmentId: "",
    amountToman: null,
    paymentMethodId: "",
    date: formatJalaliDate(now),
    time: toPersianDigits(tehranTime(now)),
    note: "",
  };
}

/** «تاریخ شمسی + ساعت تهران» → لحظهٔ UTC؛ اگر یکی معتبر نبود null */
function toPaidAt(date: string, time: string): string | null {
  const dayKey = parseJalaliDate(date);
  const hhmm = toLatinDigits(time).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!dayKey || !hhmm) return null;
  return tehranLocalToIso(dayKey, `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`);
}

/**
 * فرم ثبت پرداخت. ویرایش و حذف ندارد: اصلاح فقط با «ثبت معکوس» در فهرست.
 * onSubmit پرداخت معتبر را می‌گیرد؛ payments برای پیدا کردن نوبت پرداخت‌نشده و ثبت تکراری است.
 */
export function PaymentForm({
  patients,
  appointments,
  payments,
  paymentMethods,
  initialNow,
  onSubmit,
}: {
  patients: Patient[];
  appointments: Appointment[];
  payments: Payment[];
  paymentMethods: Option[];
  initialNow: string;
  onSubmit: (payment: NewPayment) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(new Date(initialNow)));
  const [errors, setErrors] = useState<NewPaymentErrors>({});
  // با هر ثبت عوض می‌شود تا کادر جست‌وجوی مراجع هم خالی شود
  const [round, setRound] = useState(0);
  // نوبتی که فرم خودش انتخاب کرد، تا زیر کادر گفته شود
  const [autoAppointmentId, setAutoAppointmentId] = useState<string | null>(null);
  // پرداخت مشابهی که چند دقیقه پیش ثبت شده؛ تا کاربر جواب ندهد، ثبت انجام نمی‌شود
  const [duplicate, setDuplicate] = useState<Payment | null>(null);
  const keepFormRef = useRef<HTMLButtonElement>(null);
  // مهر «ثبت شد» با هر ثبت یک بار روی برگ رسید می‌خورد؛ عدد تازه یعنی انیمیشن از نو
  const [stamp, setStamp] = useState<{ key: number; at: Date } | null>(null);

  useEffect(() => {
    if (!stamp) return;
    const timer = setTimeout(() => setStamp(null), STAMP_MS);
    return () => clearTimeout(timer);
  }, [stamp]);

  // «امروز» همان روزی است که صفحه با آن ساخته شد، مثل بقیهٔ صفحه
  const today = tehranDayKey(initialNow);
  const dayChoices = [
    { text: "امروز", dayKey: today },
    { text: "دیروز", dayKey: addDays(today, -1) },
  ];

  useEffect(() => {
    // دکمهٔ بی‌خطر فوکوس می‌گیرد تا Enter دوم پرداخت را دوباره ثبت نکند
    if (duplicate) keepFormRef.current?.focus();
  }, [duplicate]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // هر تغییری یعنی کاربر دارد فرم را اصلاح می‌کند؛ هشدار تکراری کنار می‌رود
    setDuplicate(null);
  };

  const choosePatient = (patientId: string | null) => {
    const suggestion = patientId
      ? suggestAppointment(appointments, payments, patientId, new Date(initialNow))
      : null;
    setDraft((current) => ({ ...current, patientId, appointmentId: suggestion?.id ?? "" }));
    setAutoAppointmentId(suggestion?.id ?? null);
    setDuplicate(null);
  };

  const reset = (now: Date) => {
    setDraft(emptyDraft(now));
    setErrors({});
    setAutoAppointmentId(null);
    setDuplicate(null);
    setRound((value) => value + 1);
  };

  const patientAppointments = appointments
    .filter(
      (appointment) =>
        appointment.patientId === draft.patientId &&
        PAYABLE_STATUSES.includes(appointment.status),
    )
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const autoAppointment =
    autoAppointmentId && draft.appointmentId === autoAppointmentId
      ? patientAppointments.find((appointment) => appointment.id === autoAppointmentId)
      : undefined;

  const activeMethods = paymentMethods.filter((method) => method.isActive);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const now = new Date();
    const input: NewPayment = {
      patientId: draft.patientId,
      appointmentId: draft.appointmentId || null,
      amountToman: draft.amountToman,
      paymentMethodId: draft.paymentMethodId || null,
      paidAt: toPaidAt(draft.date, draft.time),
      note: draft.note,
    };
    const found = validateNewPayment(input, now);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // تمرکز روی اولین کادر نادرست تا کاربر بداند کجا را درست کند
      const first = event.currentTarget.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
      return;
    }
    // بار اول اگر شبیه ثبت چند دقیقه پیش بود می‌پرسد؛ با «بله، ثبت شود» همین تابع دوباره می‌آید و ثبت می‌کند
    if (!duplicate) {
      const recent = findRecentDuplicate(input, payments, now);
      if (recent) {
        setDuplicate(recent);
        return;
      }
    }
    onSubmit(input);
    reset(now);
    setStamp({ key: now.getTime(), at: now });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden rounded-2xl border border-(--fin-grey) bg-white"
    >
      {/* اعلام ثبت با پیام بالای صفحه است؛ مهر فقط نشانهٔ دیدنی است */}
      {stamp && (
        <span
          key={stamp.key}
          aria-hidden="true"
          className="pointer-events-none absolute end-4 top-3 z-10 grid size-24 -rotate-12 place-items-center rounded-full border-[3px] border-(--fin-orange) bg-(--fin-navy)/60 text-(--fin-orange) motion-safe:animate-[fin-stamp_2.6s_ease-out_forwards] motion-reduce:animate-[fin-fade_2.6s_linear_forwards]"
        >
          <span className="grid size-[4.75rem] place-items-center rounded-full border border-dashed border-(--fin-orange)/80 text-center leading-tight">
            <span>
              <span className="block text-lg font-black">ثبت شد</span>
              <span className="block text-[11px] font-bold">{formatJalaliDate(stamp.at)}</span>
            </span>
          </span>
        </span>
      )}

      {/* سربرگ رسید: نوار سرمه‌ای با لبهٔ دندانه‌دار، مثل برگی که از دفترچهٔ رسید کنده شده */}
      <div className="fin-zigzag bg-(--fin-navy) px-5 pt-5 pb-8 text-white md:px-6">
        <h2 id={`${id}-title`} className="text-lg font-black">
          ثبت پرداخت
        </h2>
        <p className="mt-1 text-sm text-white/75">
          پرداخت ثبت‌شده ویرایش و پاک نمی‌شود. اگر اشتباه شد، از فهرست «ثبت معکوس» بزنید.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <PatientPicker
          key={round}
          patients={patients}
          value={draft.patientId}
          onChange={choosePatient}
          error={errors.patient}
        />

        <div>
          <label htmlFor={`${id}-appointment`} className={label}>
            نوبت مرتبط <span className="font-normal text-(--fin-muted)">(اختیاری)</span>
          </label>
          <select
            id={`${id}-appointment`}
            className={field}
            value={draft.appointmentId}
            disabled={!draft.patientId}
            aria-describedby={`${id}-appointment-hint`}
            onChange={(event) => update("appointmentId", event.target.value)}
          >
            <option value="">بدون نوبت مرتبط</option>
            {patientAppointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {`${formatJalaliDateTime(appointment.startsAt)}${
                  tehranDayKey(appointment.startsAt) === today ? " (امروز)" : ""
                }`}
              </option>
            ))}
          </select>
          <p id={`${id}-appointment-hint`} className={`${fieldHint} empty:hidden`}>
            {autoAppointment
              ? `نوبت امروز ساعت ${toPersianDigits(tehranTime(autoAppointment.startsAt))} خودکار انتخاب شد. اگر پرداخت برای نوبت دیگری است، عوضش کنید.`
              : draft.patientId && patientAppointments.length === 0
                ? "این مراجع نوبتی ندارد؛ پرداخت بدون نوبت ثبت می‌شود."
                : ""}
          </p>
        </div>

        <MoneyInput
          value={draft.amountToman}
          onChange={(amountToman) => update("amountToman", amountToman)}
          error={errors.amount}
        />

        <fieldset>
          <legend className={label}>روش پرداخت</legend>
          <div className="flex flex-wrap gap-2">
            {activeMethods.map((method) => (
              <label
                key={method.id}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-(--fin-grey) px-4 text-sm font-bold text-(--fin-navy) has-checked:border-(--fin-navy) has-checked:bg-(--fin-navy) has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--fin-blue)"
              >
                <input
                  type="radio"
                  name={`${id}-method`}
                  value={method.id}
                  checked={draft.paymentMethodId === method.id}
                  onChange={() => update("paymentMethodId", method.id)}
                  aria-describedby={errors.method ? `${id}-method-error` : undefined}
                  className="sr-only"
                />
                {method.name}
              </label>
            ))}
          </div>
          {errors.method && (
            <p id={`${id}-method-error`} className={fieldError}>
              {errors.method}
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className={label}>تاریخ و ساعت پرداخت</legend>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              aria-label="تاریخ پرداخت (شمسی)"
              aria-invalid={Boolean(errors.paidAt)}
              aria-describedby={`${id}-when`}
              placeholder="۱۴۰۵/۰۸/۰۶"
              className={`${field} text-right`}
              value={draft.date}
              onChange={(event) => update("date", event.target.value)}
            />
            {/* کادر ساعت خود مرورگر در بعضی دستگاه‌ها ۱۲ساعته است؛ اینجا همیشه ۲۴ساعته */}
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              aria-label="ساعت پرداخت (۲۴ساعته)"
              aria-invalid={Boolean(errors.paidAt)}
              aria-describedby={`${id}-when`}
              placeholder="۱۴:۳۰"
              maxLength={5}
              className={`${field} text-center`}
              value={draft.time}
              onChange={(event) => update("time", event.target.value)}
            />
          </div>
          <div className="mt-2 flex gap-2">
            {dayChoices.map((choice) => (
              <button
                key={choice.dayKey}
                type="button"
                className={pillButton}
                aria-pressed={parseJalaliDate(draft.date) === choice.dayKey}
                onClick={() => update("date", dayKeyToJalali(choice.dayKey))}
              >
                {choice.text}
              </button>
            ))}
          </div>
          <p id={`${id}-when`} className={errors.paidAt ? fieldError : fieldHint}>
            {errors.paidAt ?? "پیش‌فرض همین الان است، به وقت تهران و ۲۴ساعته."}
          </p>
        </fieldset>

        <div>
          <label htmlFor={`${id}-note`} className={label}>
            توضیح <span className="font-normal text-(--fin-muted)">(اختیاری)</span>
          </label>
          <textarea
            id={`${id}-note`}
            rows={2}
            maxLength={500}
            className={`${field} h-auto py-2`}
            value={draft.note}
            onChange={(event) => update("note", event.target.value)}
          />
        </div>

        {duplicate ? (
          <div className="rounded-xl border border-(--fin-orange) bg-(--fin-peach)/50 p-4">
            <div role="alert">
              <p className="font-bold text-(--fin-navy)">این پرداخت چند دقیقه پیش ثبت شده</p>
              <p className="mt-1 text-sm">
                برای {patients.find((patient) => patient.id === duplicate.patientId)?.fullName} همین
                مبلغ، <Toman amount={duplicate.amountToman} />، ساعت{" "}
                {toPersianDigits(tehranTime(duplicate.createdAt))} ثبت شده است. اگر پرداخت
                جداگانه‌ای است، دوباره ثبت کنید.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className={primaryButton}>
                بله، ثبت شود
              </button>
              <button
                ref={keepFormRef}
                type="button"
                className={secondaryButton}
                onClick={() => reset(new Date())}
              >
                نه، ثبت نکن
              </button>
            </div>
          </div>
        ) : (
          <button type="submit" className={`${primaryButton} w-full`}>
            ثبت پرداخت
          </button>
        )}
      </div>
    </form>
  );
}
