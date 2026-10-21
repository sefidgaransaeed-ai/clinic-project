"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  confirmRequestedAppointment,
  createManualAppointment,
  autoConfirmRequestedAppointment,
  getAllowedStatusTransitions,
  getAppointmentSlots,
  getAppointmentsSnapshot,
  getCalendarAppointments,
  getClosureForDate,
  getClinicWorkingDays,
  getRejectedRequests,
  getRequestedAppointments,
  getTodayAppointments,
  initializeMockAppointments,
  rejectRequestedAppointment,
  restoreRejectedRequest,
  searchPatients,
  subscribeToAppointments,
  updateAppointmentStatus,
} from "./data";
import {
  addDays,
  appointmentDateKey,
  appointmentLocalTime,
  formatAppointmentTime,
  formatJalaliShortDate,
  formatJalaliWeek,
  getTehranDateKey,
  getWeekDates,
  getWeekStart,
  getWeekday,
} from "./date";
import type {
  AppointmentStatus,
  AppointmentWithPatient,
  AppointmentSnapshot,
  NewPatientInput,
} from "./types";

const statusLabels: Record<AppointmentStatus, string> = {
  requested: "درخواست جدید",
  confirmed: "تأییدشده",
  arrived: "حاضر شد",
  done: "انجام شد",
  no_show: "غایب",
  cancelled: "لغوشده",
};

const statusStyles: Record<AppointmentStatus, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-sky-200 bg-sky-50 text-sky-800",
  arrived: "border-violet-200 bg-violet-50 text-violet-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  no_show: "border-rose-200 bg-rose-50 text-rose-800",
  cancelled: "border-slate-200 bg-slate-100 text-slate-700",
};

function useAppointmentStore() {
  const snapshot = useSyncExternalStore(
    subscribeToAppointments,
    getAppointmentsSnapshot,
    getAppointmentsSnapshot,
  );

  useEffect(() => {
    initializeMockAppointments(getTehranDateKey(new Date()));
  }, []);

  return snapshot;
}

function useClinicToday() {
  return useSyncExternalStore(
    () => () => undefined,
    () => getTehranDateKey(new Date()),
    () => null,
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function PanelShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { href: "/panel/today", label: "نوبت‌های امروز" },
    { href: "/panel/requests", label: "درخواست‌ها" },
    { href: "/panel/appointments", label: "تقویم هفتگی" },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 text-right text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-slate-900 px-5 py-6 text-white shadow-sm sm:px-8">
          <p className="text-sm font-medium text-sky-200">پنل نوبت‌های مطب</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{description}</p>
            </div>
            <span className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
              دادهٔ ساختگی · نسخهٔ نمایشی
            </span>
          </div>
        </header>

        <nav aria-label="بخش‌های نوبت" className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-center text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:text-sm ${
                  active ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function Notice({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <p aria-live="polite" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
      {message}
    </p>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <h2 className="font-bold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export function TodayAppointmentsView() {
  const snapshot = useAppointmentStore();
  const today = useClinicToday();
  const appointments = today ? getTodayAppointments(snapshot, today) : [];
  const [notice, setNotice] = useState("");

  function changeStatus(appointmentId: string, status: AppointmentStatus) {
    const result = updateAppointmentStatus(appointmentId, status);
    setNotice(result.message);
  }

  return (
    <PanelShell title="نوبت‌های امروز" description="فهرست نوبت‌ها به‌ترتیب ساعت و دکمه‌های تغییر وضعیت فقط بر پایهٔ چرخهٔ مجاز.">
      <section aria-labelledby="today-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-sky-800">{today ? formatJalaliShortDate(today) : "در حال آماده‌سازی تاریخ…"}</p>
            <h2 id="today-heading" className="mt-1 text-xl font-black text-slate-900">
              {appointments.length} نوبت در برنامه
            </h2>
          </div>
          <span className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">هر بازه: ۱۵ دقیقه</span>
        </div>

        <Notice message={notice} />

        {appointments.length === 0 ? (
          <EmptyState title="نوبتی برای امروز ثبت نشده است" description="پس از ثبت یا تأیید نوبت، فهرست امروز در همین بخش دیده می‌شود." />
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const actions = getAllowedStatusTransitions(appointment.status);
              return (
                <article key={appointment.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-16 rounded-xl bg-slate-100 px-2 py-2 text-center text-sm font-black text-slate-800">
                        {formatAppointmentTime(appointment.starts_at)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-slate-900">{appointment.requester_name}</h3>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600" dir="ltr">
                          {appointment.requester_mobile}
                        </p>
                        {appointment.note ? <p className="mt-2 text-sm text-slate-500">{appointment.note}</p> : null}
                      </div>
                    </div>

                    {actions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {actions.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => changeStatus(appointment.id, status)}
                            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-slate-500">تغییر وضعیت دیگری ندارد</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PanelShell>
  );
}

export function RequestsAppointmentsView() {
  const snapshot = useAppointmentStore();
  const pendingRequests = getRequestedAppointments(snapshot);
  const rejectedRequests = getRejectedRequests(snapshot);
  const [filter, setFilter] = useState<"all" | "requested" | "cancelled">("all");
  const [notice, setNotice] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AppointmentWithPatient | null>(null);

  const requests =
    filter === "requested"
      ? pendingRequests
      : filter === "cancelled"
        ? rejectedRequests
        : [...pendingRequests, ...rejectedRequests];
  const filters = [
    { value: "all", label: "همه", count: pendingRequests.length + rejectedRequests.length },
    { value: "requested", label: "در انتظار", count: pendingRequests.length },
    { value: "cancelled", label: "لغوشده", count: rejectedRequests.length },
  ] as const;

  function rejectRequest(appointmentId: string) {
    const result = rejectRequestedAppointment(appointmentId);
    setNotice(result.ok ? "درخواست رد شد و به وضعیت لغوشده رفت؛ در بخش «لغوشده» قابل بازگرداندن است." : result.message);
  }

  function restoreRequest(appointmentId: string) {
    setNotice(restoreRejectedRequest(appointmentId).message);
  }

  return (
    <PanelShell title="درخواست‌های نوبت" description="هر درخواست سایت پیش از قطعی‌شدن باید به یک مراجع موجود وصل یا با مراجع جدید ثبت شود.">
      <section aria-labelledby="requests-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-800">در انتظار بررسی منشی</p>
            <h2 id="requests-heading" className="mt-1 text-xl font-black text-slate-900">
              {pendingRequests.length} درخواست جدید
            </h2>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">تأیید، نوبت را قطعی می‌کند</span>
        </div>

        <div role="group" aria-label="فیلتر درخواست‌ها" className="mb-4 flex flex-wrap gap-2">
          {filters.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.value)}
                className={`min-h-11 rounded-full px-4 text-sm font-bold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                  active ? "bg-sky-700 text-white ring-sky-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {item.label} ({item.count})
              </button>
            );
          })}
        </div>

        <Notice message={notice} />

        {requests.length === 0 ? (
          <EmptyState
            title={filter === "cancelled" ? "درخواست لغوشده‌ای وجود ندارد" : "درخواست بازی وجود ندارد"}
            description={filter === "cancelled" ? "درخواست‌هایی که رد کنید اینجا می‌مانند و می‌توانید برشان گردانید." : "درخواست‌های ثبت‌شده از سایت در این بخش نمایش داده می‌شوند."}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((appointment) => (
              <article
                key={appointment.id}
                className={`rounded-2xl p-5 ring-1 ring-slate-200 ${appointment.status === "cancelled" ? "bg-slate-100" : "bg-white shadow-sm"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{appointment.requester_name}</h3>
                    <p className="mt-1 text-sm text-slate-600" dir="ltr">
                      {appointment.requester_mobile}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <dt className="text-slate-500">زمان پیشنهادی</dt>
                    <dd className="mt-1 font-bold text-slate-800">{formatAppointmentTime(appointment.starts_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">تاریخ</dt>
                    <dd className="mt-1 font-bold text-slate-800">{formatJalaliShortDate(appointmentDateKey(appointment.starts_at))}</dd>
                  </div>
                </dl>
                {appointment.status === "cancelled" ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => restoreRequest(appointment.id)}
                      className="min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                    >
                      بازگرداندن
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { const result = autoConfirmRequestedAppointment(appointment.id); setNotice(result.message); if (!result.ok) setSelectedRequest(appointment); }}
                      className="min-h-11 rounded-xl bg-sky-700 px-3 text-sm font-bold text-white transition-colors hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                    >
                      تأیید درخواست
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectRequest(appointment.id)}
                      className="min-h-11 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                    >
                      رد درخواست
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedRequest ? (
        <ConfirmRequestDialog
          appointment={selectedRequest}
          snapshot={snapshot}
          onClose={() => setSelectedRequest(null)}
          onComplete={(message) => {
            setSelectedRequest(null);
            setNotice(message);
          }}
        />
      ) : null}
    </PanelShell>
  );
}

function ConfirmRequestDialog({
  appointment,
  snapshot,
  onClose,
  onComplete,
}: {
  appointment: AppointmentWithPatient;
  snapshot: AppointmentSnapshot;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [error, setError] = useState("");
  const [newPatient, setNewPatient] = useState<NewPatientInput>({
    full_name: appointment.requester_name,
    mobile: appointment.requester_mobile,
    national_id: "",
  });
  const matches = useMemo(() => searchPatients(snapshot, query), [query, snapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = confirmRequestedAppointment(
      appointment.id,
      mode === "existing" ? { patientId: selectedPatientId } : { newPatient },
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onComplete(result.message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="confirm-request-title" role="dialog" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-sky-800">تأیید درخواست</p>
            <h2 id="confirm-request-title" className="mt-1 text-xl font-black text-slate-900">{appointment.requester_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن پنجره" className="min-h-11 min-w-11 rounded-xl border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            ×
          </button>
        </div>

        <form className="mt-6" onSubmit={submit}>
          <fieldset>
            <legend className="text-sm font-bold text-slate-800">انتخاب مراجع</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("existing")} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${mode === "existing" ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 text-slate-700"}`}>
                مراجع موجود
              </button>
              <button type="button" onClick={() => setMode("new")} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${mode === "new" ? "border-sky-700 bg-sky-700 text-white" : "border-slate-200 text-slate-700"}`}>
                ثبت مراجع جدید
              </button>
            </div>
          </fieldset>

          {mode === "existing" ? (
            <div className="mt-5">
              <label htmlFor="patient-search" className="text-sm font-bold text-slate-800">جست‌وجو با موبایل یا کد ملی</label>
              <input id="patient-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام، موبایل یا کد ملی" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {matches.map((patient) => (
                  <label key={patient.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${selectedPatientId === patient.id ? "border-sky-600 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{patient.full_name}</span>
                      <span className="mt-1 block text-xs text-slate-500" dir="ltr">{patient.mobile} · {patient.national_id}</span>
                    </span>
                    <input type="radio" name="patient" value={patient.id} checked={selectedPatientId === patient.id} onChange={() => setSelectedPatientId(patient.id)} className="h-4 w-4 accent-sky-700" />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <Field label="نام و نام خانوادگی" id="new-patient-name" value={newPatient.full_name} onChange={(value) => setNewPatient({ ...newPatient, full_name: value })} autoFocus />
              <Field label="شمارهٔ موبایل" id="new-patient-mobile" value={newPatient.mobile} onChange={(value) => setNewPatient({ ...newPatient, mobile: value })} inputMode="numeric" />
              <Field label="کد ملی" id="new-patient-national-id" value={newPatient.national_id} onChange={(value) => setNewPatient({ ...newPatient, national_id: value })} inputMode="numeric" />
            </div>
          )}

          {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">انصراف</button>
            <button type="submit" className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">تأیید و ثبت نوبت</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  inputMode,
  autoFocus = false,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  autoFocus?: boolean;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-bold text-slate-800">
      {label}
      <input id={id} required autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100" />
    </label>
  );
}

export function WeeklyAppointmentsView() {
  const snapshot = useAppointmentStore();
  const today = useClinicToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMobileDate, setSelectedMobileDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ dateKey: string; time: string } | null>(null);
  const [notice, setNotice] = useState("");

  const weekStart = today ? addDays(getWeekStart(today), weekOffset * 7) : null;

  if (!weekStart) {
    return (
      <PanelShell title="تقویم هفتگی" description="روزهای کاری مطب در بازه‌های ۱۵ دقیقه‌ای نمایش داده می‌شوند؛ روی بازهٔ خالی برای ثبت نوبت دستی بزنید.">
        <EmptyState title="در حال آماده‌سازی تقویم" description="تقویم هفته بر اساس منطقهٔ زمانی تهران آماده می‌شود." />
      </PanelShell>
    );
  }

  const weekDates = getWeekDates(weekStart);
  const workingDays = getClinicWorkingDays();
  const workingDateKeys = weekDates.filter((dateKey) => workingDays.some((day) => day.weekday === getWeekday(dateKey)));
  const openWorkingDateKeys = workingDateKeys.filter((dateKey) => !getClosureForDate(dateKey));
  const calendarAppointments = getCalendarAppointments(snapshot, weekStart);
  const slots = getAppointmentSlots();
  const mobileDate = openWorkingDateKeys.find((dateKey) => dateKey === selectedMobileDate) ?? openWorkingDateKeys[0];

  function moveWeek(amount: number) {
    setWeekOffset((currentOffset) => currentOffset + amount);
    setSelectedMobileDate(null);
  }

  return (
    <PanelShell title="تقویم هفتگی" description="روزهای کاری مطب در بازه‌های ۱۵ دقیقه‌ای نمایش داده می‌شوند؛ روی بازهٔ خالی برای ثبت نوبت دستی بزنید.">
      <section aria-labelledby="calendar-heading">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium text-sky-800">هفتهٔ انتخاب‌شده</p>
            <h2 id="calendar-heading" className="mt-1 text-xl font-black text-slate-900">{formatJalaliWeek(weekStart)}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => moveWeek(-1)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">هفتهٔ قبل</button>
            <button type="button" onClick={() => moveWeek(1)} className="min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-bold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">هفتهٔ بعد</button>
          </div>
        </div>

        <Notice message={notice} />

        <div className="mt-4 grid grid-cols-7 gap-1 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {weekDates.map((dateKey) => {
            const closure = getClosureForDate(dateKey);
            const isWorkingDay = workingDays.some((day) => day.weekday === getWeekday(dateKey));
            return (
              <div key={dateKey} className={`min-h-18 rounded-xl p-2 text-center text-xs ${closure ? "bg-slate-200 text-slate-500" : isWorkingDay ? "bg-sky-50 text-sky-900" : "bg-slate-50 text-slate-500"}`}>
                <p className="font-bold">{formatJalaliShortDate(dateKey).split("،")[0]}</p>
                <p className="mt-1 leading-4">{formatJalaliShortDate(dateKey).replace(/.*،\s*/, "")}</p>
                {closure ? <span className="mt-1 block text-[10px] font-bold">تعطیل</span> : null}
              </div>
            );
          })}
        </div>

        {!mobileDate ? (
          <EmptyState title="این هفته روز کاری بازی ندارد" description="برای دیدن هفتهٔ دیگر از دکمه‌های بالا استفاده کنید." />
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:hidden">
              <label htmlFor="mobile-calendar-day" className="text-sm font-bold text-slate-800">روز کاری</label>
              <select id="mobile-calendar-day" value={mobileDate} onChange={(event) => setSelectedMobileDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold focus:outline-2 focus:outline-offset-2 focus:outline-sky-600">
                {openWorkingDateKeys.map((dateKey) => <option key={dateKey} value={dateKey}>{formatJalaliShortDate(dateKey)}</option>)}
              </select>
              <ScheduleDay dateKey={mobileDate} slots={slots} appointments={calendarAppointments} onSelectSlot={setSelectedSlot} />
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
              <div className="grid" style={{ gridTemplateColumns: `5rem repeat(${openWorkingDateKeys.length}, minmax(0, 1fr))` }}>
                <div className="border-b border-l border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-500">زمان</div>
                {openWorkingDateKeys.map((dateKey) => <div key={dateKey} className="border-b border-l border-slate-200 bg-slate-50 p-3 text-center text-sm font-black text-slate-800">{formatJalaliShortDate(dateKey)}</div>)}
                {slots.map((time) => (
                  <CalendarRow key={time} time={time} dateKeys={openWorkingDateKeys} appointments={calendarAppointments} onSelectSlot={setSelectedSlot} />
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {selectedSlot ? <ManualAppointmentDialog slot={selectedSlot} onClose={() => setSelectedSlot(null)} onComplete={(message) => { setSelectedSlot(null); setNotice(message); }} /> : null}
    </PanelShell>
  );
}

function CalendarRow({
  time,
  dateKeys,
  appointments,
  onSelectSlot,
}: {
  time: string;
  dateKeys: string[];
  appointments: AppointmentWithPatient[];
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
}) {
  return (
    <>
      <div className="border-b border-l border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-500" dir="ltr">{time}</div>
      {dateKeys.map((dateKey) => {
        const appointment = appointments.find((item) => appointmentDateKey(item.starts_at) === dateKey && appointmentLocalTime(item.starts_at) === time);
        return <CalendarSlot key={dateKey} dateKey={dateKey} time={time} appointment={appointment} onSelectSlot={onSelectSlot} />;
      })}
    </>
  );
}

function ScheduleDay({
  dateKey,
  slots,
  appointments,
  onSelectSlot,
}: {
  dateKey: string;
  slots: string[];
  appointments: AppointmentWithPatient[];
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {slots.map((time) => {
        const appointment = appointments.find((item) => appointmentDateKey(item.starts_at) === dateKey && appointmentLocalTime(item.starts_at) === time);
        return (
          <div key={time} className="flex min-h-14 items-stretch border-b border-slate-100 last:border-b-0">
            <span className="flex w-20 items-center justify-center bg-slate-50 text-xs font-bold text-slate-500" dir="ltr">{time}</span>
            <CalendarSlot dateKey={dateKey} time={time} appointment={appointment} onSelectSlot={onSelectSlot} mobile />
          </div>
        );
      })}
    </div>
  );
}

function CalendarSlot({
  dateKey,
  time,
  appointment,
  onSelectSlot,
  mobile = false,
}: {
  dateKey: string;
  time: string;
  appointment: AppointmentWithPatient | undefined;
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
  mobile?: boolean;
}) {
  if (appointment) {
    return (
      <div className={`${mobile ? "flex-1" : "border-b border-l border-slate-100"} flex items-center bg-sky-50 p-1`}>
        <div className="w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-center text-xs font-bold text-sky-900">{appointment.requester_name}</div>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => onSelectSlot({ dateKey, time })} aria-label={`ثبت نوبت دستی در ${formatJalaliShortDate(dateKey)} ساعت ${time}`} className={`${mobile ? "flex-1" : "border-b border-l border-slate-100"} min-h-12 bg-white text-xs font-medium text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600`}>
      باز
    </button>
  );
}

function ManualAppointmentDialog({
  slot,
  onClose,
  onComplete,
}: {
  slot: { dateKey: string; time: string };
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [patient, setPatient] = useState<NewPatientInput>({ full_name: "", mobile: "", national_id: "" });
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createManualAppointment({ dateKey: slot.dateKey, time: slot.time, patient });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onComplete(result.message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="manual-appointment-title" role="dialog" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-800">ثبت نوبت دستی</p>
            <h2 id="manual-appointment-title" className="mt-1 text-xl font-black text-slate-900">{formatJalaliShortDate(slot.dateKey)}، ساعت {slot.time}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن پنجره" className="min-h-11 min-w-11 rounded-xl border border-slate-200 text-lg font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">×</button>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <Field label="نام و نام خانوادگی" id="manual-patient-name" value={patient.full_name} onChange={(value) => setPatient({ ...patient, full_name: value })} autoFocus />
          <Field label="شمارهٔ موبایل" id="manual-patient-mobile" value={patient.mobile} onChange={(value) => setPatient({ ...patient, mobile: value })} inputMode="numeric" />
          <Field label="کد ملی" id="manual-patient-national-id" value={patient.national_id} onChange={(value) => setPatient({ ...patient, national_id: value })} inputMode="numeric" />
          {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p> : null}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">انصراف</button>
            <button type="submit" className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">ثبت نوبت</button>
          </div>
        </form>
      </section>
    </div>
  );
}
