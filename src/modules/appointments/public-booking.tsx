"use client";
import Link from "next/link";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import {
  createSiteRequest,
  getAppointmentsVersion,
  getClinicWorkingDays,
  getClosureForDate,
  getPublicDayError,
  getPublicFreeStartTimes,
  initializeMockAppointments,
  subscribeToAppointments,
  type SiteRequestFieldErrors,
} from "./data";
import {
  addDays,
  formatAppointmentTime,
  formatJalaliShortDate,
  getTehranDateKey,
  getWeekday,
  gregorianToJalali,
  JALALI_MONTH_NAMES,
  type JalaliDate,
  jalaliMonthLength,
  jalaliToGregorian,
  makeTehranDateTime,
} from "./date";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

type FieldName = keyof SiteRequestFieldErrors;

/** ترتیب فیلدها در فرم؛ پس از ثبت ناموفق نشانگر به اولین فیلدِ دارای خطا می‌رود. */
const FIELD_ORDER: FieldName[] = ["fullName", "nationalId", "contactMobile", "dateKey", "time"];

const fieldId = (name: FieldName) => `nobat-${name}`;

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100";

/** همان ظاهر فهرست‌های تاریخ تولد در پنل (appointments-ui.tsx)، با کمی فضای کمتر چون سه‌تایی کنار هم می‌نشینند. */
const dateSelectClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

/** رقم فارسی بدون جداکنندهٔ هزارگان؛ «۱۴۰۵» نه «۱٬۴۰۵». */
const persianNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });

/** داده‌های ساختگی را فقط پس از سوار شدن در مرورگر می‌سازد؛ تا آن موقع `0` است. */
function usePublicBookingData() {
  const version = useSyncExternalStore(subscribeToAppointments, getAppointmentsVersion, () => 0);

  useEffect(() => {
    initializeMockAppointments(getTehranDateKey(new Date()));
  }, []);

  return version;
}

function useTehranToday() {
  return useSyncExternalStore(
    () => () => undefined,
    () => getTehranDateKey(new Date()),
    () => null,
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-base font-medium text-rose-800">
      {error}
    </p>
  ) : null;
}

function describedBy(id: string, error?: string) {
  return error ? `${id}-error` : undefined;
}

function TextField({
  name,
  label,
  value,
  onChange,
  error,
  inputMode,
}: {
  name: FieldName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "numeric";
}) {
  const id = fieldId(name);
  return (
    <div>
      <label htmlFor={id} className="block text-base font-bold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error)}
        className={inputClass}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}

/** دلیل غیرقابل‌انتخاب‌بودن یک روز (تعطیل یا غیرکاری)؛ `null` یعنی روز انتخاب‌شدنی است. */
function getDayUnavailableReason(dateKey: string) {
  if (getClosureForDate(dateKey)) {
    return messages.dayClosed;
  }
  if (!getClinicWorkingDays().some((day) => day.weekday === getWeekday(dateKey))) {
    return messages.dayNotWorking;
  }
  return null;
}

/**
 * سال، ماه و روزِ شمسیِ انتخاب‌شده. سال یا ماهِ خالی یعنی «پیش‌فرض» (سال و ماهِ جاری)، تا هر سه فهرست همیشه
 * فهرست معتبر داشته باشند؛ روزِ خالی یعنی هنوز روزی انتخاب نشده.
 */
interface DateParts {
  year: string;
  month: string;
  day: string;
}

const EMPTY_DATE_PARTS: DateParts = { year: "", month: "", day: "" };

/** سال‌های قابل‌انتخاب: سال جاری و سال بعد. */
function getYearOptions(current: JalaliDate) {
  return [current.year, current.year + 1];
}

/** ماه‌هایی که تمامشان در گذشته نیست: در سال جاری از ماه جاری به بعد، در سال بعد همهٔ ماه‌ها. */
function getMonthOptions(year: number, current: JalaliDate) {
  const first = year > current.year ? 1 : current.month;
  return Array.from({ length: 12 - first + 1 }, (_, index) => first + index);
}

/** روزهای یک ماهِ شمسی که امروز یا بعد از امروزند، با تاریخ میلادیِ هر کدام. */
function getMonthDays(year: number, month: number, today: string) {
  const first = jalaliToGregorian(year, month, 1);
  if (!first) {
    return [];
  }
  return Array.from({ length: jalaliMonthLength(year, month) }, (_, index) => ({ day: index + 1, dateKey: addDays(first, index) })).filter(
    (item) => item.dateKey >= today,
  );
}

/** سال و ماهی که فهرست‌ها واقعاً نشان می‌دهند (پیش‌فرضِ خالی همان سال و ماه جاری است). */
function resolveYearMonth(parts: DateParts, current: JalaliDate) {
  return { year: Number(parts.year) || current.year, month: Number(parts.month) || current.month };
}

/**
 * پس از هر تغییر، بخش‌هایی که دیگر معتبر نیستند خالی می‌شوند: ماهی که در سال تازه کاملاً گذشته است به ماه جاری برمی‌گردد
 * (و روز را هم پاک می‌کند، چون دیگر معلوم نیست مال کدام ماه بوده)، و روزی که در ماه تازه نیست یا گذشته است پاک می‌شود.
 */
function normalizeDateParts(parts: DateParts, today: string): DateParts {
  const current = gregorianToJalali(today);
  const { year, month } = resolveYearMonth(parts, current);
  const monthResets = parts.month !== "" && !getMonthOptions(year, current).includes(month);
  const effectiveMonth = monthResets ? current.month : month;
  const dayIsValid = !monthResets && getMonthDays(year, effectiveMonth, today).some((item) => item.day === Number(parts.day));
  return { year: parts.year, month: monthResets ? "" : parts.month, day: dayIsValid ? parts.day : "" };
}

export function PublicBooking() {
  const version = usePublicBookingData();
  const today = useTehranToday();

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [dateParts, setDateParts] = useState<DateParts>(EMPTY_DATE_PARTS);
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<SiteRequestFieldErrors>({});
  const [submitted, setSubmitted] = useState<{ dateKey: string; time: string } | null>(null);

  // فهرست روزها و ساعت‌ها هر بار از حالت ماژول خوانده می‌شود؛ با هر تغییر داده (`version`) فرم دوباره رسم می‌شود. محاسبه ارزان است و `useMemo` لازم ندارد.
  const ready = version > 0 && today !== null;
  const todayJalali = today ? gregorianToJalali(today) : null;
  const { year, month } = todayJalali ? resolveYearMonth(dateParts, todayJalali) : { year: 0, month: 0 };
  const monthDays = ready && today ? getMonthDays(year, month, today) : [];
  const dateKey = monthDays.find((item) => item.day === Number(dateParts.day))?.dateKey ?? "";
  const dayError = ready && dateKey !== "" ? getPublicDayError(dateKey) : null;
  const times = ready && dateKey !== "" && !dayError ? getPublicFreeStartTimes(dateKey) : [];

  // ساعتی که در این فاصله پر شده یا گذشته، دیگر انتخاب‌شده حساب نمی‌شود.
  const selectedTime = times.includes(time) ? time : "";
  const dateError = errors.dateKey ?? dayError ?? undefined;
  const dayIsFull = ready && dateKey !== "" && !dayError && times.length === 0;
  const timeError = errors.time ?? (dayIsFull ? messages.dayFull : undefined);

  function clearError(name: FieldName) {
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function changeDatePart(name: keyof DateParts, value: string) {
    if (!today) {
      return;
    }
    setDateParts(normalizeDateParts({ ...dateParts, [name]: value }, today));
    setTime("");
    setErrors((previous) => ({ ...previous, dateKey: undefined, time: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createSiteRequest({ fullName, nationalId, contactMobile, dateKey, time: selectedTime });

    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((name) => result.errors[name]);
      if (first) {
        // فهرست ساعتِ روزِ پر غیرفعال است و فوکوس نمی‌گیرد؛ راه حل آن انتخاب روز دیگری است، پس فوکوس به فهرست روز می‌رود.
        const target = document.getElementById(fieldId(first));
        (target instanceof HTMLSelectElement && target.disabled ? document.getElementById(fieldId("dateKey")) : target)?.focus();
      }
      return;
    }

    // کد ملی و شمارهٔ تماس پس از ثبت در حافظهٔ فرم نمی‌مانند و صفحهٔ موفقیت هم آن‌ها را تکرار نمی‌کند.
    setSubmitted({ dateKey, time: selectedTime });
    setFullName("");
    setNationalId("");
    setContactMobile("");
    setDateParts(EMPTY_DATE_PARTS);
    setTime("");
    setErrors({});
  }

  if (submitted) {
    return (
      <section role="status" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-200 sm:p-6">
        <h2 className="text-xl font-black text-emerald-800">{messages.successTitle}</h2>
        <p className="mt-3 text-base leading-7 text-slate-800">
          {messages.successBody(
            formatJalaliShortDate(submitted.dateKey),
            formatAppointmentTime(makeTehranDateTime(submitted.dateKey, submitted.time)),
          )}
        </p>
        {/* پیوند نمایشی: داده فقط در حافظهٔ همین تب است و با رفتن از راه پیوند داخلی به پنل می‌رسد؛ با اتصال به پایگاه داده برداشته می‌شود. */}
        <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {messages.demoPanelNote}{" "}
          <Link href="/panel/requests" className="font-bold text-sky-800 underline">
            {messages.demoPanelLink}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <p className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
        {messages.demoLabel}
      </p>

      <TextField
        name="fullName"
        label={messages.labels.fullName}
        value={fullName}
        onChange={(value) => {
          setFullName(value);
          clearError("fullName");
        }}
        error={errors.fullName}
      />
      <TextField
        name="nationalId"
        label={messages.labels.nationalId}
        value={nationalId}
        onChange={(value) => {
          setNationalId(value);
          clearError("nationalId");
        }}
        error={errors.nationalId}
        inputMode="numeric"
      />
      <TextField
        name="contactMobile"
        label={messages.labels.contactMobile}
        value={contactMobile}
        onChange={(value) => {
          setContactMobile(value);
          clearError("contactMobile");
        }}
        error={errors.contactMobile}
        inputMode="numeric"
      />

      {/* روز، ماه و سال سه فهرست بومی‌اند (مثل تاریخ تولد در پنل)؛ فقط تاریخ‌های معتبر در فهرست می‌آیند و روز تعطیل یا غیرکاری غیرفعال است. */}
      <div role="group" aria-labelledby={`${fieldId("dateKey")}-label`}>
        <p id={`${fieldId("dateKey")}-label`} className="text-base font-bold text-slate-800">
          {messages.labels.day}
        </p>
        <div dir="rtl" className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] gap-2">
          <select
            id={fieldId("dateKey")}
            aria-label={messages.dateParts.day}
            value={dateParts.day}
            disabled={!ready}
            onChange={(event) => changeDatePart("day", event.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={describedBy(fieldId("dateKey"), dateError)}
            className={dateSelectClass}
          >
            <option value="">{messages.dateParts.day}</option>
            {monthDays.map((item) => {
              const reason = getDayUnavailableReason(item.dateKey);
              return (
                <option key={item.day} value={item.day} disabled={reason !== null}>
                  {reason ? `${persianNumber.format(item.day)} (${reason})` : persianNumber.format(item.day)}
                </option>
              );
            })}
          </select>
          <select
            aria-label={messages.dateParts.month}
            value={month}
            disabled={!ready}
            onChange={(event) => changeDatePart("month", event.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={describedBy(fieldId("dateKey"), dateError)}
            className={dateSelectClass}
          >
            {todayJalali
              ? getMonthOptions(year, todayJalali).map((item) => (
                  <option key={item} value={item}>
                    {JALALI_MONTH_NAMES[item - 1]}
                  </option>
                ))
              : null}
          </select>
          <select
            aria-label={messages.dateParts.year}
            value={year}
            disabled={!ready}
            onChange={(event) => changeDatePart("year", event.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={describedBy(fieldId("dateKey"), dateError)}
            className={dateSelectClass}
          >
            {todayJalali
              ? getYearOptions(todayJalali).map((item) => (
                  <option key={item} value={item}>
                    {persianNumber.format(item)}
                  </option>
                ))
              : null}
          </select>
        </div>
        {!ready ? <p className="mt-2 text-sm text-slate-600">{messages.datePreparing}</p> : null}
        <FieldError id={fieldId("dateKey")} error={dateError} />
      </div>

      <div>
        <label htmlFor={fieldId("time")} className="block text-base font-bold text-slate-800">
          {messages.labels.time}
        </label>
        <select
          id={fieldId("time")}
          value={selectedTime}
          disabled={times.length === 0}
          onChange={(event) => {
            setTime(event.target.value);
            clearError("time");
          }}
          aria-invalid={timeError ? true : undefined}
          aria-describedby={describedBy(fieldId("time"), timeError)}
          className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
        >
          <option value="">{messages.timePlaceholder}</option>
          {times.map((item) => (
            <option key={item} value={item}>
              {formatAppointmentTime(makeTehranDateTime(dateKey, item))}
            </option>
          ))}
        </select>
        {dateKey === "" || dayError ? <p className="mt-1 text-sm text-slate-600">{messages.timeNeedsDay}</p> : null}
        <FieldError id={fieldId("time")} error={timeError} />
      </div>

      <button
        type="submit"
        className="min-h-11 w-full rounded-xl bg-sky-700 px-5 text-base font-bold text-white transition hover:bg-sky-800 focus:outline-2 focus:outline-offset-2 focus:outline-sky-600 sm:w-auto"
      >
        {messages.submit}
      </button>
    </form>
  );
}
