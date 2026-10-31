"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BirthDateField,
  EmptyState,
  Field,
  GenderSelect,
  Notice,
  PanelShell,
  StatusBadge,
} from "@/modules/appointments/appointments-ui";
import {
  appointmentDateKey,
  calculateAge,
  formatAppointmentTime,
  formatJalaliLongDate,
  formatJalaliShortDate,
  getTehranDateKey,
} from "@/modules/appointments/date";
import { GENDER_OPTIONS } from "@/modules/appointments/patient-validation";
import type { Patient, PatientFormInput } from "@/modules/appointments/types";
import {
  addPatient,
  EMPTY_PATIENT_FORM,
  getPatientAppointments,
  getPatientById,
  getPatientsSnapshot,
  getPatientsVersion,
  hasPatientQuery,
  INSURANCE_TYPE_NAMES,
  initializePatients,
  listPatients,
  patientToFormInput,
  subscribeToPatients,
  updatePatient,
  type PatientFormErrors,
} from "./data";

/** رقم فارسی بدون جداکنندهٔ هزارگان؛ «۱۲۰» نه «۱٬۲۰۰». */
const persianNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });

const listDescription = "مراجعان را با نام، شماره یا کد ملی پیدا کنید و اطلاعاتشان را ببینید.";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";

/**
 * انبار ساختگی نوبت‌ها فقط پس از سوار شدن صفحه در مرورگر ساخته می‌شود؛ تا آن موقع `ready` نادرست است
 * و صفحه «در حال آماده‌سازی» نشان می‌دهد، نه «مراجع پیدا نشد».
 */
function usePatientStore() {
  const snapshot = useSyncExternalStore(subscribeToPatients, getPatientsSnapshot, getPatientsSnapshot);
  const version = useSyncExternalStore(subscribeToPatients, getPatientsVersion, () => 0);

  useEffect(() => {
    initializePatients(getTehranDateKey(new Date()));
  }, []);

  return { snapshot, ready: version > 0 };
}

/**
 * با cacheComponents صفحه‌ای که کاربر ترک می‌کند حذف نمی‌شود، با `<Activity>` پنهان می‌شود و state آن می‌ماند.
 * برای همین فرم ثبت پس از انصراف، خطا یا ثبت موفق با مقدار و خطای قبلی دوباره باز می‌شد.
 * تمیزکاری `useLayoutEffect` هنگام پنهان‌شدن اجرا می‌شود؛ کلیدی که برمی‌گرداند با هر پنهان‌شدن عوض می‌شود
 * و فرمِ دارای آن کلید از نو ساخته می‌شود.
 */
function useFreshFormKey() {
  const [formKey, setFormKey] = useState(0);

  useLayoutEffect(() => () => setFormKey((current) => current + 1), []);

  return formKey;
}

function PatientSearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    onChange("");
    // دکمهٔ × با خالی‌شدن متن ناپدید می‌شود؛ نشانگر به جعبه برمی‌گردد تا کاربر صفحه‌کلید گم نشود.
    inputRef.current?.focus();
  }

  return (
    <div role="search" className="relative min-w-0 flex-1">
      <label htmlFor="patient-search" className="sr-only">جست‌وجوی مراجع با نام، شماره یا کد ملی</label>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-slate-500">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        id="patient-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="جستجو: نام، شماره یا کد ملی"
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white ps-11 pe-11 text-base outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button type="button" onClick={clear} aria-label="پاک کردن" className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function PatientsListView() {
  const { snapshot, ready } = usePatientStore();
  const [query, setQuery] = useState("");
  const patients = useMemo(() => listPatients(snapshot, query), [snapshot, query]);
  const isSearching = hasPatientQuery(query);

  return (
    <PanelShell title="مراجعان" description={listDescription}>
      {!ready ? (
        <EmptyState title="در حال آماده‌سازی فهرست" description="مراجعان در حال بارگذاری‌اند." />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PatientSearchBox value={query} onChange={setQuery} />
            <Link
              href="/panel/patients/new"
              className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 text-base font-bold text-white transition-colors hover:bg-sky-800 ${focusRing}`}
            >
              ثبت مراجع جدید
            </Link>
          </div>

          <p role="status" aria-live="polite" className="mb-3 text-base font-medium text-slate-700">
            {isSearching
              ? `${persianNumber.format(patients.length)} مراجع پیدا شد`
              : `${persianNumber.format(patients.length)} مراجع ثبت شده است`}
          </p>

          {patients.length === 0 ? (
            <EmptyState
              title={isSearching ? "مراجعی با این مشخصات پیدا نشد." : "هنوز مراجعی ثبت نشده است."}
              description={
                isSearching
                  ? "املای نام و ارقام شماره یا کد ملی را بررسی کنید، یا مراجع تازه ثبت کنید."
                  : "با دکمهٔ «ثبت مراجع جدید» اولین مراجع را اضافه کنید."
              }
            />
          ) : (
            <ul className="space-y-3">
              {patients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/panel/patients/${patient.id}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors hover:ring-sky-400 sm:p-5 ${focusRing}`}
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-bold text-slate-900">{patient.full_name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>شمارهٔ شخصی مراجع: {patient.mobile ? <span dir="ltr">{patient.mobile}</span> : "ثبت نشده"}</span>
                        <span>کد ملی: <span dir="ltr">{patient.national_id}</span></span>
                      </span>
                    </div>
                    <span aria-hidden="true" className="text-xl text-slate-400">‹</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelShell>
  );
}

/** ترتیب فیلدها در فرم؛ شناسهٔ هر فیلد `${idPrefix}-${پسوند}` است. */
const FORM_FIELD_ID_SUFFIXES: Record<keyof PatientFormInput, string> = {
  full_name: "name",
  mobile: "mobile",
  national_id: "national-id",
  birth_date: "birth-date",
  gender: "gender",
  insurance_type_name: "insurance",
};

/** نشانگر را به اولین فیلد دارای خطا می‌برد تا کاربر صفحه‌کلید و صفحه‌خوان بداند کجا را اصلاح کند. */
function focusFirstInvalidField(errors: PatientFormErrors, idPrefix: string) {
  const field = (Object.keys(FORM_FIELD_ID_SUFFIXES) as (keyof PatientFormInput)[]).find((name) => errors[name]);
  if (field) {
    document.getElementById(`${idPrefix}-${FORM_FIELD_ID_SUFFIXES[field]}`)?.focus();
  }
}

/**
 * فرم مشترک ثبت و ویرایش مراجع. با `patientId` ویرایش است و بدون آن ثبت مراجع تازه.
 * اعتبارسنجی با خودِ `addPatient` و `updatePatient` است؛ اینجا فقط خطای هر فیلد کنار همان فیلد نشان داده می‌شود.
 */
function PatientForm({
  idPrefix,
  title,
  initial,
  patientId,
  submitLabel,
  onSaved,
  onCancel,
}: {
  idPrefix: string;
  title: string;
  initial: PatientFormInput;
  patientId?: string;
  submitLabel: string;
  onSaved: (patient: Patient, message: string) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PatientFormInput>(initial);
  const [fieldErrors, setFieldErrors] = useState<PatientFormErrors>({});
  const [formError, setFormError] = useState("");

  function change<K extends keyof PatientFormInput>(field: K, value: PatientFormInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = patientId ? updatePatient(patientId, values) : addPatient(values);
    if (!result.ok) {
      setFormError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      focusFirstInvalidField(result.fieldErrors ?? {}, idPrefix);
      return;
    }
    onSaved(result.patient, result.message);
  }

  const insuranceId = `${idPrefix}-${FORM_FIELD_ID_SUFFIXES.insurance_type_name}`;
  const insuranceError = fieldErrors.insurance_type_name;

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>

      <div className="mt-5 grid gap-4">
        <Field label="نام و نام خانوادگی" id={`${idPrefix}-name`} value={values.full_name} onChange={(value) => change("full_name", value)} error={fieldErrors.full_name} autoFocus />
        <Field label="شمارهٔ شخصی مراجع (اختیاری؛ ۱۱ رقم، شروع با ۰۹)" id={`${idPrefix}-mobile`} value={values.mobile} onChange={(value) => change("mobile", value)} error={fieldErrors.mobile} inputMode="numeric" optional />
        <Field
          label="کد ملی (۱۰ رقم)"
          id={`${idPrefix}-national-id`}
          value={values.national_id}
          onChange={(value) => change("national_id", value)}
          error={fieldErrors.national_id}
          hint={patientId ? "کد ملی هویت مراجع است؛ فقط برای اصلاح اشتباه تایپی عوضش کنید." : undefined}
          inputMode="numeric"
        />
        <BirthDateField id={`${idPrefix}-birth-date`} value={values.birth_date} onChange={(value) => change("birth_date", value)} error={fieldErrors.birth_date} />
        <GenderSelect id={`${idPrefix}-gender`} value={values.gender} onChange={(value) => change("gender", value)} error={fieldErrors.gender} />
        <div>
          <label htmlFor={insuranceId} className="block text-base font-bold text-slate-800">
            نوع بیمه
            <select
              id={insuranceId}
              value={values.insurance_type_name}
              onChange={(event) => change("insurance_type_name", event.target.value)}
              aria-invalid={insuranceError ? true : undefined}
              aria-describedby={insuranceError ? `${insuranceId}-error` : undefined}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            >
              {INSURANCE_TYPE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {insuranceError ? <p id={`${insuranceId}-error`} className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-base font-medium text-rose-800">{insuranceError}</p> : null}
        </div>
      </div>

      {formError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-base font-medium text-rose-800">{formError}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={`min-h-11 rounded-xl px-4 text-base font-bold text-slate-600 hover:bg-slate-100 ${focusRing}`}>انصراف</button>
        <button type="submit" className={`min-h-11 rounded-xl bg-sky-700 px-4 text-base font-bold text-white hover:bg-sky-800 ${focusRing}`}>{submitLabel}</button>
      </div>
    </form>
  );
}

function BackToListLink() {
  return (
    <Link
      href="/panel/patients"
      className={`mb-4 inline-flex min-h-11 items-center rounded-xl px-2 text-base font-bold text-sky-800 hover:bg-sky-50 ${focusRing}`}
    >
      ← بازگشت به فهرست مراجعان
    </Link>
  );
}

export function NewPatientView() {
  const { ready } = usePatientStore();
  const router = useRouter();
  const formKey = useFreshFormKey();

  return (
    <PanelShell title="ثبت مراجع جدید" description="نام و کد ملی لازم است؛ بقیهٔ اطلاعات را اگر دارید وارد کنید.">
      <BackToListLink />
      {ready ? (
        <PatientForm
          key={formKey}
          idPrefix="new-patient"
          title="اطلاعات مراجع تازه"
          initial={EMPTY_PATIENT_FORM}
          submitLabel="ثبت مراجع"
          onSaved={(patient) => router.push(`/panel/patients/${patient.id}`)}
          onCancel={() => router.push("/panel/patients")}
        />
      ) : (
        <EmptyState title="در حال آماده‌سازی" description="فرم در حال بارگذاری است." />
      )}
    </PanelShell>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 text-base font-bold text-slate-900">{children}</dd>
    </div>
  );
}

const NOT_RECORDED = "ثبت نشده";

export function PatientDetailView({ patientId }: { patientId: string }) {
  const { snapshot, ready } = usePatientStore();
  const patient = ready ? getPatientById(snapshot, patientId) : null;
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // صفحه ترک شود، پنهان می‌شود و state می‌ماند (cacheComponents)؛ با بازگشت، نه فرمِ نیمه‌ویرایش و نه پیام ذخیره می‌ماند.
  useLayoutEffect(
    () => () => {
      wasEditing.current = false;
      setEditing(false);
      setNotice("");
    },
    [],
  );

  // با بسته‌شدن فرم دکمهٔ «ویرایش» دوباره پیدا می‌شود؛ نشانگر به آن برمی‌گردد تا کاربر صفحه‌کلید گم نشود.
  useEffect(() => {
    if (wasEditing.current && !editing) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  if (!ready) {
    return (
      <PanelShell title="مراجع" description="اطلاعات و نوبت‌های این مراجع.">
        <EmptyState title="در حال آماده‌سازی" description="اطلاعات مراجع در حال بارگذاری است." />
      </PanelShell>
    );
  }

  if (!patient) {
    return (
      <PanelShell title="مراجع پیدا نشد" description="این نشانی به مراجعی در فهرست وصل نیست.">
        <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="font-bold text-slate-800">مراجعی با این نشانی پیدا نشد.</h2>
          <p className="mt-2 text-base leading-6 text-slate-500">
            شاید نشانی را اشتباه وارد کرده باشید. به فهرست برگردید و مراجع را دوباره جست‌وجو کنید.
          </p>
          <Link
            href="/panel/patients"
            className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-700 px-4 text-base font-bold text-white transition-colors hover:bg-sky-800 ${focusRing}`}
          >
            بازگشت به فهرست مراجعان
          </Link>
        </div>
      </PanelShell>
    );
  }

  const todayKey = getTehranDateKey(new Date());
  const genderLabel = GENDER_OPTIONS.find((option) => option.value === patient.gender)?.label;
  const appointments = getPatientAppointments(snapshot, patient.id);

  return (
    <PanelShell title={patient.full_name} description="اطلاعات این مراجع و نوبت‌هایش.">
      <BackToListLink />
      <Notice message={notice} />

      {editing ? (
        <PatientForm
          idPrefix="edit-patient"
          title="ویرایش اطلاعات مراجع"
          patientId={patient.id}
          initial={patientToFormInput(patient)}
          submitLabel="ذخیره تغییرات"
          onSaved={(_saved, message) => {
            setNotice(message);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <section aria-labelledby="patient-info-heading" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="patient-info-heading" className="text-xl font-black text-slate-900">اطلاعات مراجع</h2>
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => {
                setNotice("");
                setEditing(true);
              }}
              className={`min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-700 transition-colors hover:bg-slate-50 ${focusRing}`}
            >
              ویرایش اطلاعات
            </button>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoItem label="نام و نام خانوادگی">{patient.full_name}</InfoItem>
            <InfoItem label="شمارهٔ شخصی مراجع">{patient.mobile ? <span dir="ltr">{patient.mobile}</span> : NOT_RECORDED}</InfoItem>
            <InfoItem label="کد ملی"><span dir="ltr">{patient.national_id}</span></InfoItem>
            <InfoItem label="تاریخ تولد">
              {patient.birth_date
                ? `${formatJalaliLongDate(patient.birth_date)} (سن: ${persianNumber.format(calculateAge(patient.birth_date, todayKey))} سال)`
                : NOT_RECORDED}
            </InfoItem>
            <InfoItem label="جنس">{genderLabel ?? NOT_RECORDED}</InfoItem>
            <InfoItem label="نوع بیمه">{patient.insurance_type_name}</InfoItem>
          </dl>
        </section>
      )}

      <section aria-labelledby="patient-appointments-heading" className="mt-6">
        <h2 id="patient-appointments-heading" className="mb-3 text-xl font-black text-slate-900">نوبت‌های این مراجع</h2>
        {appointments.length === 0 ? (
          <EmptyState title="هنوز نوبتی ثبت نشده است." description="نوبت‌هایی که برای این مراجع تأیید یا ثبت شوند اینجا دیده می‌شوند." />
        ) : (
          <ul className="space-y-3">
            {appointments.map((appointment) => {
              const dateKey = appointmentDateKey(appointment.starts_at);
              return (
                <li key={appointment.id}>
                  <Link
                    href={`/panel/today?date=${dateKey}&appointment=${appointment.id}`}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-colors hover:ring-sky-400 ${focusRing}`}
                  >
                    <span className="text-base font-medium text-slate-800">
                      {formatJalaliShortDate(dateKey)}، ساعت {formatAppointmentTime(appointment.starts_at)}
                    </span>
                    <StatusBadge status={appointment.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PanelShell>
  );
}
