"use client";
import Link from "next/link";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import {
  appointmentDateKey,
  formatAppointmentTime,
  formatJalaliShortDate,
  getTehranDateKey,
  gregorianToJalali,
  JALALI_MONTH_NAMES,
} from "./date";
import { loadPublicSlots, submitPublicRequest } from "./public-booking-actions";
import {
  type DateParts,
  EMPTY_DATE_PARTS,
  getDayError,
  getDayOptionLabel,
  getDayUnavailableLabel,
  getMonthDays,
  getMonthOptions,
  getYearOptions,
  groupClinicWeekdays,
  normalizeDateParts,
  type PublicBookingInfo,
  resolveYearMonth,
} from "./public-booking-days";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";
import { findSlot, type PublicClinicSlots } from "./public-booking-slots";
import {
  type PublicBookingField,
  type PublicRequestErrors,
  validatePublicRequest,
} from "./public-booking-validation";

type ForSelfChoice = "" | "self" | "other";

/** ترتیب فیلدها در فرم؛ پس از ثبت ناموفق نشانگر به اولین فیلدِ دارای خطا می‌رود. خطای `form` فیلد ندارد. */
const FIELD_ORDER: Exclude<PublicBookingField, "form">[] = ["fullName", "nationalId", "contactMobile", "forSelf", "dateKey", "time"];

const fieldId = (name: PublicBookingField) => `nobat-${name}`;

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100";

/** همان ظاهر فهرست‌های تاریخ تولد در پنل (appointments-ui.tsx)، با کمی فضای کمتر چون سه‌تایی کنار هم می‌نشینند. */
const dateSelectClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

/** رقم فارسی بدون جداکنندهٔ هزارگان؛ «۱۴۰۵» نه «۱٬۴۰۵». */
const persianNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });

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
  name: PublicBookingField;
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

/** نشانی مطب به‌صورت متن دیده‌شونده (نه `title`)، چون tooltip روی گوشی کار نمی‌کند. */
function ClinicLine({ name, address }: { name: string | null; address: string | null }) {
  return (
    <p className="text-sm leading-6 text-slate-700">
      <span className="font-bold text-slate-900">{name ?? messages.clinicWithoutName}</span>
      {address ? ` — ${address}` : null}
    </p>
  );
}

/** ساعت‌های خالیِ روز انتخاب‌شده؛ `dateKey` و `token` می‌گویند این پاسخ مال کدام درخواست است. */
interface LoadedSlots {
  dateKey: string;
  token: number;
  groups: PublicClinicSlots[];
  error?: string;
}

interface Submitted {
  startsAt: string;
  clinic: { name: string; address: string } | null;
}

export function PublicBooking({ info }: { info: PublicBookingInfo }) {
  const today = useTehranToday();

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [contactMobile, setContactMobile] = useState("");
  const [forSelf, setForSelf] = useState<ForSelfChoice>("");
  const [dateParts, setDateParts] = useState<DateParts>(EMPTY_DATE_PARTS);
  const [startsAt, setStartsAt] = useState("");
  const [errors, setErrors] = useState<PublicRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // فهرست روزها از `get_public_info` است و محاسبه ارزان؛ فهرست ساعت‌ها فقط وقتی روزِ انتخاب‌شدنی داریم از سرور گرفته می‌شود.
  const ready = today !== null;
  const todayJalali = today ? gregorianToJalali(today) : null;
  const { year, month } = todayJalali ? resolveYearMonth(dateParts, todayJalali) : { year: 0, month: 0 };
  const monthDays = ready && today ? getMonthDays(year, month, today) : [];
  const dateKey = monthDays.find((item) => item.day === Number(dateParts.day))?.dateKey ?? "";
  const dayError = ready && today && dateKey !== "" ? getDayError(dateKey, today, info) : null;
  const slotsDateKey = dateKey !== "" && !dayError ? dateKey : "";

  useEffect(() => {
    if (slotsDateKey === "") {
      return;
    }
    let cancelled = false;
    loadPublicSlots(slotsDateKey)
      .then((result) => {
        if (!cancelled) {
          setLoaded({
            dateKey: slotsDateKey,
            token: reloadToken,
            groups: result.ok ? result.groups : [],
            error: result.ok ? undefined : result.message,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({ dateKey: slotsDateKey, token: reloadToken, groups: [], error: messages.slotsFailed });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slotsDateKey, reloadToken]);

  // پاسخِ مالِ روزِ دیگر یا درخواستِ قدیمی نادیده گرفته می‌شود؛ تا پاسخ برسد «در حال گرفتن» است.
  const current = slotsDateKey !== "" && loaded?.dateKey === slotsDateKey && loaded.token === reloadToken ? loaded : null;
  const slotsReady = current !== null;
  const loadingSlots = slotsDateKey !== "" && !slotsReady;
  const groups = current?.groups ?? [];
  const slotsError = current?.error;

  // ساعتی که در این فاصله پر شده یا گذشته، دیگر انتخاب‌شده حساب نمی‌شود.
  const selected = findSlot(groups, startsAt);
  const selectedStartsAt = selected ? startsAt : "";
  const dateError = errors.dateKey ?? dayError ?? undefined;
  const dayIsFull = slotsReady && !slotsError && groups.every((group) => group.slots.length === 0);
  const timeError = errors.time ?? slotsError ?? (dayIsFull ? messages.dayFull : undefined);
  const clinicWeekdays = groupClinicWeekdays(info);

  function clearError(name: PublicBookingField) {
    setErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
  }

  function changeDatePart(name: keyof DateParts, value: string) {
    if (!today) {
      return;
    }
    setDateParts(normalizeDateParts({ ...dateParts, [name]: value }, today));
    setStartsAt("");
    setErrors((previous) => ({ ...previous, dateKey: undefined, time: undefined, form: undefined }));
  }

  function focusFirstError(found: PublicRequestErrors) {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (!first) {
      return;
    }
    // فهرست ساعتِ روزِ پر غیرفعال است و فوکوس نمی‌گیرد؛ راه حل آن انتخاب روز دیگری است، پس فوکوس به فهرست روز می‌رود.
    const target = document.getElementById(fieldId(first));
    (target instanceof HTMLSelectElement && target.disabled ? document.getElementById(fieldId("dateKey")) : target)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const validation = validatePublicRequest({
      fullName,
      nationalId,
      contactMobile,
      forSelf: forSelf === "" ? null : forSelf === "self",
      startsAt: selectedStartsAt,
    });
    const found: PublicRequestErrors = validation.ok ? {} : { ...validation.errors };
    if (dateKey === "") {
      found.dateKey = messages.dateEmpty;
      delete found.time;
    } else if (dayError) {
      found.dateKey = dayError;
      delete found.time;
    } else if (dayIsFull) {
      found.time = messages.dayFull;
    }

    if (!validation.ok || Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    const result = await submitPublicRequest(validation.values).catch(
      (): { ok: false; errors: PublicRequestErrors } => ({ ok: false, errors: { form: messages.requestFailed } }),
    );
    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.time) {
        // ساعت در این فاصله پر شده؛ فهرست تازه گرفته می‌شود تا بازدیدکننده ساعت دیگری انتخاب کند.
        setStartsAt("");
        setReloadToken((token) => token + 1);
      }
      focusFirstError(result.errors);
      return;
    }

    // کد ملی و شمارهٔ تماس پس از ثبت در حافظهٔ فرم نمی‌مانند و صفحهٔ موفقیت هم آن‌ها را تکرار نمی‌کند.
    const clinicName = selected?.group.clinicName;
    setSubmitted({
      startsAt: validation.values.startsAt,
      clinic: clinicName ? { name: clinicName, address: selected.group.clinicAddress ?? "" } : null,
    });
    setFullName("");
    setNationalId("");
    setContactMobile("");
    setForSelf("");
    setDateParts(EMPTY_DATE_PARTS);
    setStartsAt("");
    setErrors({});
  }

  if (submitted) {
    return (
      <section role="status" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-200 sm:p-6">
        <h2 className="text-xl font-black text-emerald-800">{messages.successTitle}</h2>
        <p className="mt-3 text-base leading-7 text-slate-800">
          {messages.successBody(
            formatJalaliShortDate(appointmentDateKey(submitted.startsAt)),
            formatAppointmentTime(submitted.startsAt),
            submitted.clinic,
          )}
        </p>
        {/* پیوند نمایشی (برگرفته از نسخهٔ ساختگی): برای کاربر عمومی به ورود می‌رسد و در برش بعدی برداشته می‌شود. */}
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

      {/* «برای خودم / برای شخص دیگری» پیش‌فرض ندارد؛ تا انتخاب نشود فرم ثبت نمی‌شود. */}
      <fieldset aria-describedby={describedBy(fieldId("forSelf"), errors.forSelf)}>
        <legend className="text-base font-bold text-slate-800">{messages.forSelfLegend}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["self", "other"] as const).map((choice) => (
            <label
              key={choice}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 text-base has-[:checked]:border-sky-600 has-[:checked]:bg-sky-50"
            >
              <input
                type="radio"
                id={choice === "self" ? fieldId("forSelf") : undefined}
                name="nobat-for-self"
                value={choice}
                checked={forSelf === choice}
                onChange={() => {
                  setForSelf(choice);
                  clearError("forSelf");
                }}
                className="size-4 accent-sky-700"
              />
              {messages.forSelfOptions[choice]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">{messages.forSelfHint}</p>
        <FieldError id={fieldId("forSelf")} error={errors.forSelf} />
      </fieldset>

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
              const reason = getDayUnavailableLabel(item.dateKey, info);
              return (
                <option key={item.day} value={item.day} disabled={reason !== null}>
                  {getDayOptionLabel(persianNumber.format(item.day), item.dateKey, info)}
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

        {clinicWeekdays.length > 0 ? (
          <div className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-bold text-slate-800">{messages.clinicsByWeekdayTitle(clinicWeekdays.length)}</p>
            {clinicWeekdays.map(({ clinic, weekdayNames }) => (
              <div key={clinic.id}>
                <p className="text-sm text-slate-600">{weekdayNames.join("، ")}</p>
                <ClinicLine name={clinic.name} address={clinic.address} />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor={fieldId("time")} className="block text-base font-bold text-slate-800">
          {messages.labels.time}
        </label>
        {slotsReady && groups.some((group) => group.clinicName) ? (
          <div className="mt-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-bold text-slate-800">{messages.clinicOfDay}</p>
            {groups.map((group) => (
              <ClinicLine key={group.clinicId ?? "none"} name={group.clinicName} address={group.clinicAddress} />
            ))}
          </div>
        ) : null}
        <select
          id={fieldId("time")}
          value={selectedStartsAt}
          disabled={!slotsReady || groups.length === 0}
          onChange={(event) => {
            setStartsAt(event.target.value);
            clearError("time");
          }}
          aria-invalid={timeError ? true : undefined}
          aria-describedby={describedBy(fieldId("time"), timeError)}
          className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
        >
          <option value="">{messages.timePlaceholder}</option>
          {groups.length > 1
            ? groups.map((group) => (
                <optgroup key={group.clinicId ?? "none"} label={group.clinicName ?? messages.clinicWithoutName}>
                  {group.slots.map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {slot.label}
                    </option>
                  ))}
                </optgroup>
              ))
            : groups.flatMap((group) =>
                group.slots.map((slot) => (
                  <option key={slot.startsAt} value={slot.startsAt}>
                    {slot.label}
                  </option>
                )),
              )}
        </select>
        {dateKey === "" || dayError ? <p className="mt-1 text-sm text-slate-600">{messages.timeNeedsDay}</p> : null}
        {loadingSlots ? (
          <p role="status" className="mt-1 text-sm text-slate-600">
            {messages.slotsLoading}
          </p>
        ) : null}
        <FieldError id={fieldId("time")} error={timeError} />
      </div>

      {/* خطای بدون فیلد (مثل محدودیت نرخ): باید همین‌جا کنار دکمه دیده شود، نه فقط در لاگ. */}
      {errors.form ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-base font-medium text-rose-800">
          {errors.form}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-xl bg-sky-700 px-5 text-base font-bold text-white transition hover:bg-sky-800 focus:outline-2 focus:outline-offset-2 focus:outline-sky-600 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      >
        {submitting ? messages.submitting : messages.submit}
      </button>
    </form>
  );
}
