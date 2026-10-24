"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type CSSProperties, type FormEvent, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  checkManualPatient,
  checkManualSlot,
  confirmRequestedAppointment,
  createManualAppointment,
  autoConfirmRequestedAppointment,
  getAllRequests,
  getAppointmentSlots,
  getAppointmentsSnapshot,
  getApprovedRequests,
  getCalendarAppointments,
  getCancelledRequests,
  getClosureForDate,
  getClinicWorkingDays,
  getDayAppointments,
  getFreeStartTimes,
  getPatientFieldErrors,
  getRequestedAppointments,
  getSelectableStatuses,
  initializeMockAppointments,
  isAppointmentStatusLocked,
  PAST_EDIT_LOCKED_MESSAGE,
  rejectRequestedAppointment,
  restoreRejectedRequest,
  searchAllAppointments,
  searchPatients,
  subscribeToAppointments,
  updateAppointmentStatus,
  type ManualPatientCheck,
  type PatientFieldErrors,
} from "./data";
import {
  addDays,
  appointmentDateKey,
  formatAppointmentTime,
  formatGregorianDayLabel,
  formatJalaliDayLabel,
  formatJalaliShortDate,
  formatJalaliWeek,
  getTehranDateKey,
  getWeekDates,
  getWeekStart,
  getWeekday,
} from "./date";
import { getOfficialMobile, getOfficialName, getSiteGivenDetails } from "./requester";
import { hasSearchQuery } from "./search";
import { getSlotCoverage, MANUAL_DURATION_OPTIONS, type SlotCoverage } from "./slots";
import type {
  AppointmentSource,
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

/**
 * رنگ‌های برند (راهنمای برند) به‌علاوهٔ دو رنگ ملایم وضعیت که راهنما ندارد: سبز برای «انجام شد»
 * و قرمز برای «غایب» و خطاها. یک‌بار روی `<main>` پنل تعریف می‌شوند؛ دیالوگ‌ها داخل همان `<main>`
 * رندر می‌شوند و ارث می‌برند. نارنجی فقط تزئین است: هرگز متن و هرگز زیر متن سفید.
 */
const brandVariables = {
  "--brand-navy": "#262261",
  "--brand-orange": "#F8941D",
  "--brand-blue": "#404099",
  "--brand-gray": "#E6E7E8",
  "--brand-light": "#F4F4F5",
  "--brand-peach": "#FDE5C8",
  "--brand-ink": "#2B2B2E",
  "--brand-muted": "#5F6062",
  "--status-done-bg": "#E3F1E7",
  "--status-done-text": "#1B5E34",
  "--status-bad-bg": "#FBE4E4",
  "--status-bad-text": "#8F1D1D",
} as CSSProperties;

const statusStyles: Record<AppointmentStatus, string> = {
  requested: "border-(--brand-orange) bg-(--brand-peach) text-(--brand-navy)",
  confirmed: "border-(--brand-blue) bg-(--brand-light) text-(--brand-blue)",
  arrived: "border-(--brand-blue) bg-(--brand-blue) text-white",
  done: "border-current/30 bg-(--status-done-bg) text-(--status-done-text)",
  no_show: "border-current/30 bg-(--status-bad-bg) text-(--status-bad-text)",
  cancelled: "border-(--brand-muted)/40 bg-(--brand-light) text-(--brand-muted)",
};

const sourceLabels: Record<AppointmentSource, string> = {
  panel: "ثبت دستی",
  site: "درخواست از سایت",
};

const durationLabels: Record<(typeof MANUAL_DURATION_OPTIONS)[number], string> = {
  15: "۱۵ دقیقه",
  30: "۳۰ دقیقه",
  45: "۴۵ دقیقه",
  60: "۶۰ دقیقه",
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

/** `label` فقط وقتی داده می‌شود که برچسب نمایشی با نام وضعیت فرق دارد (مثل «ردشده» برای درخواستِ ردشده)؛ رنگ از وضعیت می‌آید. */
function StatusBadge({ status, label }: { status: AppointmentStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {label ?? statusLabels[status]}
    </span>
  );
}

/**
 * نام و موبایلی که فرد در سایت نوشته، فقط وقتی با مراجعِ وصل‌شده فرق دارد: خطی ریز و کم‌تأکید.
 * متن ساده است (نه جمع‌شونده)، تا داخل لینکِ نتیجهٔ جست‌وجو هم بنشیند.
 */
function SiteGivenDetails({ appointment }: { appointment: AppointmentWithPatient }) {
  const given = getSiteGivenDetails(appointment);
  if (!given) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-(--brand-muted)">
      نام و موبایلِ ثبت‌شده در سایت: {given.name} · <span dir="ltr">{given.mobile}</span>
    </p>
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
    <main dir="rtl" style={brandVariables} className="min-h-screen bg-white px-4 py-6 text-right text-(--brand-ink) sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="relative overflow-hidden rounded-3xl bg-(--brand-navy) px-5 py-6 text-white shadow-sm sm:px-8">
          <p className="text-base font-medium text-(--brand-peach)">پنل نوبت‌های مطب</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-base leading-6 text-(--brand-gray)">{description}</p>
            </div>
            <span className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-base font-medium text-(--brand-gray)">
              دادهٔ ساختگی · نسخهٔ نمایشی
            </span>
          </div>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-(--brand-orange)" />
        </header>

        <nav aria-label="بخش‌های نوبت" className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-(--brand-gray)">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-center text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) ${
                  active ? "bg-(--brand-navy) text-white shadow-[inset_0_-3px_0_var(--brand-orange)]" : "text-(--brand-ink) hover:bg-(--brand-light)"
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

function Notice({ message, ok = true }: { message: string; ok?: boolean }) {
  if (!message) {
    return null;
  }

  return (
    <p
      role={ok ? undefined : "alert"}
      aria-live={ok ? "polite" : undefined}
      className={`mb-4 rounded-xl border px-4 py-3 text-base font-medium ${
        ok ? "border-(--brand-peach) bg-(--brand-peach) text-(--brand-navy)" : "border-(--status-bad-text)/30 bg-(--status-bad-bg) text-(--status-bad-text)"
      }`}
    >
      {message}
    </p>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-(--brand-muted) bg-(--brand-light) px-6 py-12 text-center shadow-sm">
      <h2 className="font-bold text-(--brand-ink)">{title}</h2>
      <p className="mt-2 text-base leading-6 text-(--brand-muted)">{description}</p>
    </div>
  );
}

const dayDescription = "تا ۷ روز پس از نوبت می‌توانید وضعیت را تغییر دهید.";

/** فقط تاریخ ISO معتبر (مثل ۲۰۲۶-۱۰-۲۲) پذیرفته می‌شود؛ هر چیز دیگر یعنی «امروز». */
function isDateKey(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

export function TodayAppointmentsView() {
  return (
    <Suspense
      fallback={
        <PanelShell title="نوبت‌های امروز" description={dayDescription}>
          <EmptyState title="در حال آماده‌سازی فهرست" description="نوبت‌های امروز در حال بارگذاری است." />
        </PanelShell>
      }
    >
      <DayAppointmentsView />
    </Suspense>
  );
}

/** فهرست نوبت‌های یک روز: پیش‌فرض امروز، یا روز `?date=` و برجسته‌کردن نوبت `?appointment=`. */
function DayAppointmentsView() {
  const snapshot = useAppointmentStore();
  const today = useClinicToday();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const highlightId = searchParams.get("appointment");
  const explicitDate = isDateKey(requestedDate) ? requestedDate : null;
  const dateKey = explicitDate ?? today;
  const isToday = explicitDate === null || explicitDate === today;
  const appointments = dateKey ? getDayAppointments(snapshot, dateKey) : [];
  const highlightFound = appointments.some((appointment) => appointment.id === highlightId);
  const [notice, setNotice] = useState({ message: "", ok: true });
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = hasSearchQuery(searchQuery);
  const searchResults = useMemo(() => searchAllAppointments(snapshot, searchQuery), [snapshot, searchQuery]);

  useEffect(() => {
    if (highlightFound) {
      document.getElementById(`appointment-${highlightId}`)?.scrollIntoView({ block: "center" });
    }
  }, [highlightFound, highlightId]);

  function changeStatus(appointment: AppointmentWithPatient, status: AppointmentStatus) {
    const result = updateAppointmentStatus(appointment.id, status);
    setNotice({
      ok: result.ok,
      message: result.ok
        ? `وضعیت نوبت ${getOfficialName(appointment)} به «${statusLabels[status]}» تغییر کرد.`
        : result.message,
    });
  }

  return (
    <PanelShell title={isToday ? "نوبت‌های امروز" : "نوبت‌های این روز"} description={dayDescription}>
      <AppointmentSearchBox value={searchQuery} onChange={setSearchQuery} />
      {isSearching ? <AppointmentSearchResults results={searchResults} onSelect={() => setSearchQuery("")} /> : null}

      <section aria-labelledby="today-heading" hidden={isSearching}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-(--brand-blue)">{dateKey ? formatJalaliShortDate(dateKey) : "در حال آماده‌سازی تاریخ…"}</p>
            <h2 id="today-heading" className="mt-1 text-xl font-bold text-(--brand-navy)">
              {appointments.length} نوبت در برنامه
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isToday ? null : (
              <Link
                href="/panel/today"
                className="inline-flex min-h-11 items-center rounded-xl border border-(--brand-muted) bg-white px-3 text-sm font-bold text-(--brand-ink) transition-colors hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)"
              >
                بازگشت به امروز
              </Link>
            )}
            <span className="rounded-full bg-(--brand-light) px-3 py-1.5 text-xs font-bold text-(--brand-ink)">هر بازه: ۱۵ دقیقه</span>
          </div>
        </div>

        <Notice message={notice.message} ok={notice.ok} />

        {appointments.length === 0 ? (
          <EmptyState
            title={isToday ? "نوبتی برای امروز ثبت نشده است" : "نوبتی برای این روز ثبت نشده است"}
            description="پس از ثبت یا تأیید نوبت، فهرست روز در همین بخش دیده می‌شود."
          />
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const isLinked = appointment.patient_id !== null;
              const isLocked = isAppointmentStatusLocked(appointment);
              const lockedMessageId = `status-locked-${appointment.id}`;
              return (
                <article
                  key={appointment.id}
                  id={`appointment-${appointment.id}`}
                  className={`rounded-2xl bg-(--brand-gray) p-4 shadow-sm sm:p-5 ${
                    appointment.id === highlightId ? "ring-2 ring-(--brand-navy)" : "ring-1 ring-(--brand-gray)"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-16 rounded-xl bg-(--brand-light) px-2 py-2 text-center text-sm font-bold text-(--brand-ink)">
                        {formatAppointmentTime(appointment.starts_at)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-bold text-(--brand-navy)">{getOfficialName(appointment)}</h3>
                          <StatusBadge status={appointment.status} />
                        </div>
                        <p className="mt-1 text-sm text-(--brand-muted)" dir="ltr">
                          {getOfficialMobile(appointment)}
                        </p>
                        <SiteGivenDetails appointment={appointment} />
                        {appointment.note ? <p className="mt-2 text-sm text-(--brand-muted)">{appointment.note}</p> : null}
                      </div>
                    </div>

                    {isLinked ? (
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div
                          role="group"
                          aria-label={`وضعیت نوبت ${getOfficialName(appointment)}`}
                          aria-describedby={isLocked ? lockedMessageId : undefined}
                          className="flex flex-wrap gap-2 sm:justify-end"
                        >
                          {getSelectableStatuses().map((status) => {
                            const current = appointment.status === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={current}
                                disabled={isLocked}
                                onClick={() => {
                                  if (!current) {
                                    changeStatus(appointment, status);
                                  }
                                }}
                                className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) ${
                                  current
                                    ? "cursor-default border-(--brand-navy) bg-(--brand-navy) text-white"
                                    : isLocked
                                      ? "border-(--brand-muted) bg-white text-(--brand-ink) opacity-50"
                                      : "border-(--brand-muted) bg-white text-(--brand-ink) hover:border-(--brand-blue) hover:bg-(--brand-light)"
                                } ${isLocked ? "cursor-not-allowed" : ""}`}
                              >
                                {statusLabels[status]}
                              </button>
                            );
                          })}
                        </div>
                        {isLocked ? (
                          <p id={lockedMessageId} className="max-w-md text-sm leading-6 text-(--brand-muted)">
                            {PAST_EDIT_LOCKED_MESSAGE}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <Link
                        href="/panel/requests"
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-(--brand-blue) bg-white px-3 text-sm font-bold text-(--brand-blue) transition-colors hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)"
                      >
                        بررسی در «درخواست‌ها»
                      </Link>
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

const requestsDescription = "پیش از تأیید، هر درخواست باید به یک مراجع وصل شود.";

export function RequestsAppointmentsView() {
  return (
    <Suspense
      fallback={
        <PanelShell title="درخواست‌های نوبت" description={requestsDescription}>
          <EmptyState title="در حال آماده‌سازی فهرست" description="درخواست‌ها در حال بارگذاری است." />
        </PanelShell>
      }
    >
      <RequestsView />
    </Suspense>
  );
}

/** فهرست درخواست‌ها؛ با `?appointment=` همان درخواست را برجسته می‌کند (مقصد نتیجه‌های جست‌وجو). */
function RequestsView() {
  const snapshot = useAppointmentStore();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("appointment");
  const pendingRequests = getRequestedAppointments(snapshot);
  const approvedRequests = getApprovedRequests(snapshot);
  const cancelledRequests = getCancelledRequests(snapshot);
  const allRequests = getAllRequests(snapshot);
  const highlightFound = allRequests.some((appointment) => appointment.id === highlightId);
  const [filter, setFilter] = useState<"all" | "requested" | "confirmed" | "cancelled">("all");
  const [notice, setNotice] = useState("");
  const [cardError, setCardError] = useState<{ id: string; message: string } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AppointmentWithPatient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = hasSearchQuery(searchQuery);
  const searchResults = useMemo(() => searchAllAppointments(snapshot, searchQuery), [snapshot, searchQuery]);

  const requests = {
    all: allRequests,
    requested: pendingRequests,
    confirmed: approvedRequests,
    cancelled: cancelledRequests,
  }[filter];
  const filters = [
    { value: "all", label: "همه", count: allRequests.length },
    { value: "requested", label: "در انتظار", count: pendingRequests.length },
    { value: "confirmed", label: "تأییدشده", count: approvedRequests.length },
    { value: "cancelled", label: "ردشده", count: cancelledRequests.length },
  ] as const;
  const emptyState =
    filter === "cancelled"
      ? { title: "درخواست ردشده‌ای وجود ندارد", description: "درخواست‌هایی که رد کنید اینجا می‌مانند و می‌توانید آن‌ها را برگردانید." }
      : filter === "confirmed"
        ? { title: "درخواست تأییدشده‌ای وجود ندارد", description: "درخواست‌هایی که تأیید کنید اینجا می‌مانند." }
        : { title: "درخواستی در انتظار نیست", description: "درخواست‌های ثبت‌شده از سایت در این بخش نمایش داده می‌شوند." };

  useEffect(() => {
    if (highlightFound) {
      document.getElementById(`request-${highlightId}`)?.scrollIntoView({ block: "center" });
    }
  }, [highlightFound, highlightId]);

  function rejectRequest(appointment: AppointmentWithPatient) {
    const result = rejectRequestedAppointment(appointment.id);
    setCardError(null);
    setNotice(
      result.ok
        ? `درخواست ${appointment.requester_name} رد شد و به بخش «ردشده» رفت؛ از همان‌جا قابل بازگرداندن است.`
        : result.message,
    );
  }

  function restoreRequest(appointmentId: string) {
    const result = restoreRejectedRequest(appointmentId);
    if (!result.ok) {
      // خطا کنار خودِ کارت نشان داده می‌شود، چون بالای فهرست ممکن است از دید بیرون باشد.
      setCardError({ id: appointmentId, message: result.message });
      setNotice("");
      return;
    }
    setCardError(null);
    setNotice(result.message);
  }

  function confirmRequest(appointment: AppointmentWithPatient) {
    const result = autoConfirmRequestedAppointment(appointment.id);
    if (result.slotTaken) {
      // ساعت پر است: درخواست در انتظار می‌ماند و انتخاب مراجع کمکی نمی‌کند.
      setCardError({ id: appointment.id, message: result.message });
      setNotice("");
      return;
    }
    setCardError(null);
    setNotice(result.message);
    if (!result.ok) {
      setSelectedRequest(appointment);
    }
  }

  return (
    <PanelShell title="درخواست‌های نوبت" description={requestsDescription}>
      <AppointmentSearchBox value={searchQuery} onChange={setSearchQuery} />
      {isSearching ? <AppointmentSearchResults results={searchResults} onSelect={() => setSearchQuery("")} /> : null}

      <section aria-labelledby="requests-heading" hidden={isSearching}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-(--brand-blue)">در انتظار بررسی منشی</p>
            <h2 id="requests-heading" className="mt-1 text-xl font-bold text-(--brand-navy)">
              {pendingRequests.length} درخواست جدید
            </h2>
          </div>
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
                className={`min-h-11 rounded-full px-4 text-sm font-bold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) ${
                  active ? "bg-(--brand-navy) text-white ring-(--brand-navy)" : "bg-white text-(--brand-ink) ring-(--brand-muted) hover:bg-(--brand-light)"
                }`}
              >
                {item.label} ({item.count})
              </button>
            );
          })}
        </div>

        <Notice message={notice} />

        {requests.length === 0 ? (
          <EmptyState title={emptyState.title} description={emptyState.description} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((appointment) => (
              <article
                key={appointment.id}
                id={`request-${appointment.id}`}
                className={`rounded-2xl p-5 ${appointment.id === highlightId ? "ring-2 ring-(--brand-navy)" : "ring-1 ring-(--brand-gray)"} ${appointment.status === "cancelled" ? "bg-(--brand-light)" : "bg-(--brand-gray) shadow-sm"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-(--brand-navy)">{getOfficialName(appointment)}</h3>
                    <p className="mt-1 text-sm text-(--brand-muted)" dir="ltr">
                      {getOfficialMobile(appointment)}
                    </p>
                    <SiteGivenDetails appointment={appointment} />
                  </div>
                  {/* درخواستِ جدید دکمهٔ تأیید و رد دارد و برچسب نمی‌خواهد؛ نشان فقط برای درخواست‌های تصمیم‌گرفته‌شده است. */}
                  {appointment.status === "requested" ? null : (
                    <StatusBadge status={appointment.status} label={appointment.status === "cancelled" && appointment.patient_id === null ? "ردشده" : undefined} />
                  )}
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-(--brand-light) p-3 text-sm">
                  <div>
                    <dt className="text-(--brand-muted)">{appointment.status === "requested" ? "زمان پیشنهادی" : "ساعت نوبت"}</dt>
                    <dd className="mt-1 font-bold text-(--brand-ink)">{formatAppointmentTime(appointment.starts_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-(--brand-muted)">{appointment.status === "requested" ? "تاریخ" : "روز نوبت"}</dt>
                    <dd className="mt-1 font-bold text-(--brand-ink)">{formatJalaliShortDate(appointmentDateKey(appointment.starts_at))}</dd>
                  </div>
                  {appointment.patient ? (
                    <div className="col-span-2">
                      <dt className="text-(--brand-muted)">مراجع وصل‌شده</dt>
                      <dd className="mt-1 font-bold text-(--brand-ink)">{appointment.patient.full_name}</dd>
                    </div>
                  ) : null}
                </dl>
                {cardError?.id === appointment.id ? (
                  <p role="alert" className="mt-5 rounded-xl bg-(--status-bad-bg) px-3 py-2 text-sm font-medium text-(--status-bad-text)">
                    {cardError.message}
                  </p>
                ) : null}
                {appointment.status === "cancelled" && appointment.patient_id === null ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => restoreRequest(appointment.id)}
                      className="min-h-11 w-full rounded-xl border border-(--brand-blue) bg-white px-3 text-sm font-bold text-(--brand-blue) transition-colors hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)"
                    >
                      بازگرداندن
                    </button>
                  </div>
                ) : appointment.status !== "requested" ? (
                  <div className="mt-5">
                    <Link
                      href={`/panel/today?date=${appointmentDateKey(appointment.starts_at)}&appointment=${appointment.id}`}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-(--brand-blue) bg-white px-3 text-sm font-bold text-(--brand-blue) transition-colors hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)"
                    >
                      رفتن به نوبت
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => confirmRequest(appointment)}
                      className="min-h-11 rounded-xl bg-(--brand-navy) px-3 text-sm font-bold text-white transition-colors hover:bg-(--brand-blue) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)"
                    >
                      تأیید درخواست
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectRequest(appointment)}
                      className="min-h-11 rounded-xl border border-(--status-bad-text)/30 bg-white px-3 text-sm font-bold text-(--status-bad-text) transition-colors hover:bg-(--status-bad-bg) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--status-bad-text)"
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
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [newPatient, setNewPatient] = useState<NewPatientInput>({
    full_name: appointment.requester_name,
    mobile: appointment.requester_mobile,
    national_id: "",
  });
  const matches = useMemo(() => searchPatients(snapshot, query), [query, snapshot]);

  function changeNewPatient(next: NewPatientInput, field: keyof NewPatientInput) {
    setNewPatient(next);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

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
    if (mode === "new") {
      const errors = getPatientFieldErrors(newPatient);
      if (Object.keys(errors).length > 0) {
        setError("");
        setFieldErrors(errors);
        focusFirstInvalidField(errors, "new-patient");
        return;
      }
    }
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
    <div className="fixed inset-0 z-50 flex items-end bg-(--brand-navy)/50 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="confirm-request-title" role="dialog" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-(--brand-blue)">تأیید درخواست</p>
            <h2 id="confirm-request-title" className="mt-1 text-xl font-bold text-(--brand-navy)">{appointment.requester_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن پنجره" className="min-h-11 min-w-11 rounded-xl border border-(--brand-gray) text-lg font-bold text-(--brand-muted) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)">
            ×
          </button>
        </div>

        <form className="mt-6" onSubmit={submit} noValidate>
          <fieldset>
            <legend className="text-sm font-bold text-(--brand-ink)">انتخاب مراجع</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("existing")} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) ${mode === "existing" ? "border-(--brand-navy) bg-(--brand-navy) text-white" : "border-(--brand-muted) text-(--brand-ink)"}`}>
                مراجع موجود
              </button>
              <button type="button" onClick={() => setMode("new")} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) ${mode === "new" ? "border-(--brand-navy) bg-(--brand-navy) text-white" : "border-(--brand-muted) text-(--brand-ink)"}`}>
                ثبت مراجع جدید
              </button>
            </div>
          </fieldset>

          {mode === "existing" ? (
            <div className="mt-5">
              <label htmlFor="patient-search" className="text-sm font-bold text-(--brand-ink)">جست‌وجو با نام، موبایل یا کد ملی</label>
              <input id="patient-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام، موبایل یا کد ملی" className="mt-2 min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white px-3 text-sm outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)" />
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {matches.map((patient) => (
                  <label key={patient.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${selectedPatientId === patient.id ? "border-(--brand-navy) bg-(--brand-light)" : "border-(--brand-gray) hover:border-(--brand-muted)"}`}>
                    <span>
                      <span className="block text-sm font-bold text-(--brand-navy)">{patient.full_name}</span>
                      <span className="mt-1 block text-xs text-(--brand-muted)" dir="ltr">{patient.mobile} · {patient.national_id}</span>
                    </span>
                    <input type="radio" name="patient" value={patient.id} checked={selectedPatientId === patient.id} onChange={() => setSelectedPatientId(patient.id)} className="h-4 w-4 accent-(--brand-navy)" />
                  </label>
                ))}
                {matches.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-(--brand-muted) px-3 py-4 text-center text-sm text-(--brand-muted)">
                    مراجعی با این مشخصات پیدا نشد. «ثبت مراجع جدید» را بزنید.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <Field label="نام و نام خانوادگی" id="new-patient-name" value={newPatient.full_name} onChange={(value) => changeNewPatient({ ...newPatient, full_name: value }, "full_name")} error={fieldErrors.full_name} autoFocus />
              <Field label="شمارهٔ موبایل (۱۱ رقم، شروع با ۰۹)" id="new-patient-mobile" value={newPatient.mobile} onChange={(value) => changeNewPatient({ ...newPatient, mobile: value }, "mobile")} error={fieldErrors.mobile} inputMode="numeric" />
              <Field label="کد ملی (۱۰ رقم)" id="new-patient-national-id" value={newPatient.national_id} onChange={(value) => changeNewPatient({ ...newPatient, national_id: value }, "national_id")} error={fieldErrors.national_id} inputMode="numeric" />
            </div>
          )}

          {error ? <p role="alert" className="mt-4 rounded-xl bg-(--status-bad-bg) px-3 py-2 text-sm font-medium text-(--status-bad-text)">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-bold text-(--brand-muted) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)">انصراف</button>
            <button type="submit" className="min-h-11 rounded-xl bg-(--brand-navy) px-4 text-sm font-bold text-white hover:bg-(--brand-blue) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)">تأیید و ثبت نوبت</button>
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
  error,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric";
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-bold text-(--brand-ink)">
        {label}
        <input id={id} required autoFocus={autoFocus} value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className="mt-2 min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white px-3 text-base font-normal outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)" />
      </label>
      {error ? <p id={`${id}-error`} className="mt-2 rounded-xl bg-(--status-bad-bg) px-3 py-2 text-base font-medium text-(--status-bad-text)">{error}</p> : null}
    </div>
  );
}

const patientFieldIdSuffixes: Record<keyof NewPatientInput, string> = {
  full_name: "name",
  mobile: "mobile",
  national_id: "national-id",
};

/** پس از ثبت ناموفق، نشانگر را به اولین فیلد دارای خطا می‌برد؛ شناسهٔ فیلدها `${idPrefix}-name|mobile|national-id` است. */
function focusFirstInvalidField(errors: PatientFieldErrors, idPrefix: string) {
  const field = (["full_name", "mobile", "national_id"] as const).find((name) => errors[name]);
  if (field) {
    document.getElementById(`${idPrefix}-${patientFieldIdSuffixes[field]}`)?.focus();
  }
}

/** جعبهٔ جست‌وجوی مشترکِ «تقویم هفتگی» و «درخواست‌ها»؛ ذره‌بین نشانهٔ کار جعبه است و × فقط وقتی متنی هست دیده می‌شود. */
function AppointmentSearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    onChange("");
    // دکمهٔ × با خالی‌شدن متن ناپدید می‌شود؛ نشانگر به جعبه برمی‌گردد تا کاربر صفحه‌کلید گم نشود.
    inputRef.current?.focus();
  }

  return (
    <div role="search" className="relative mb-4">
      <label htmlFor="appointment-search" className="sr-only">جست‌وجو در همهٔ نوبت‌ها</label>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-(--brand-muted)">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        id="appointment-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="جستجو: نام، موبایل یا کد ملی"
        autoComplete="off"
        enterKeyHint="search"
        className="min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white ps-11 pe-11 text-base outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy) [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button type="button" onClick={clear} aria-label="پاک کردن" className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-xl text-(--brand-muted) hover:text-(--brand-navy) focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--brand-navy)">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/** درخواستِ هنوز وصل‌نشده (در انتظار یا ردشده) در «درخواست‌ها» دیده می‌شود، بقیه در فهرست روزِ خودشان. */
function appointmentSearchHref(appointment: AppointmentWithPatient) {
  if (appointment.patient_id === null) {
    return `/panel/requests?appointment=${appointment.id}`;
  }
  return `/panel/today?date=${appointmentDateKey(appointment.starts_at)}&appointment=${appointment.id}`;
}

/** نتیجه‌ای که در همین صفحه باز می‌شود و فقط پارامترهای نشانی عوض می‌شوند، نه خودِ صفحه. */
function opensOnCurrentPage(appointment: AppointmentWithPatient, pathname: string) {
  return appointmentSearchHref(appointment).startsWith(`${pathname}?`);
}

/** `onSelect` فقط برای نتیجه‌ای صدا زده می‌شود که در همین صفحه باز می‌شود؛ جست‌وجو با آن بسته می‌شود تا کارتِ برجسته دیده شود. */
function AppointmentSearchResults({ results, onSelect }: { results: AppointmentWithPatient[]; onSelect?: () => void }) {
  const pathname = usePathname();

  if (results.length === 0) {
    return (
      <div role="status">
        <EmptyState title="مراجعی یا نوبتی با این مشخصات پیدا نشد." description="املای نام یا ارقام را بررسی کنید." />
      </div>
    );
  }

  return (
    <section aria-labelledby="search-results-heading">
      <div className="mb-3">
        <h2 id="search-results-heading" aria-live="polite" className="text-xl font-bold text-(--brand-navy)">
          {results.length} نوبت پیدا شد
        </h2>
        <p className="mt-1 text-sm text-(--brand-muted)">جدیدترین نوبت اول. روی هر مورد بزنید تا در همان روز یا در «درخواست‌ها» باز شود.</p>
      </div>
      <ul className="space-y-3">
        {results.map((appointment) => (
          <li key={appointment.id}>
            <Link
              href={appointmentSearchHref(appointment)}
              onClick={opensOnCurrentPage(appointment, pathname) ? onSelect : undefined}
              className="flex flex-col gap-3 rounded-2xl bg-(--brand-gray) p-4 shadow-sm ring-1 ring-(--brand-gray) transition-colors hover:ring-(--brand-blue) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy) sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-(--brand-navy)">{getOfficialName(appointment)}</span>
                  <StatusBadge status={appointment.status} />
                  <span className="inline-flex items-center rounded-full border border-(--brand-gray) bg-(--brand-light) px-2.5 py-1 text-xs font-bold text-(--brand-ink)">
                    {sourceLabels[appointment.source]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-(--brand-muted)" dir="ltr">
                  {getOfficialMobile(appointment)}
                </p>
                <SiteGivenDetails appointment={appointment} />
              </div>
              <p className="text-sm font-medium text-(--brand-ink)">
                {formatJalaliShortDate(appointmentDateKey(appointment.starts_at))}، ساعت {formatAppointmentTime(appointment.starts_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WeeklyAppointmentsView() {
  const snapshot = useAppointmentStore();
  const today = useClinicToday();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMobileDate, setSelectedMobileDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ dateKey: string; time: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = hasSearchQuery(searchQuery);
  const searchResults = useMemo(() => searchAllAppointments(snapshot, searchQuery), [snapshot, searchQuery]);

  const weekStart = today ? addDays(getWeekStart(today), weekOffset * 7) : null;

  if (!weekStart) {
    return (
      <PanelShell title="تقویم هفتگی" description="روزهای کاری مطب در بازه‌های ۱۵ دقیقه‌ای نمایش داده می‌شوند؛ روی بازهٔ باز برای ثبت نوبت دستی بزنید.">
        <EmptyState title="در حال آماده‌سازی تقویم" description="تقویم در حال بارگذاری است." />
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
  const columns = weekDates.map((dateKey) => ({ dateKey, open: openWorkingDateKeys.includes(dateKey) }));

  function moveWeek(amount: number) {
    setWeekOffset((currentOffset) => currentOffset + amount);
    setSelectedMobileDate(null);
  }

  return (
    <PanelShell title="تقویم هفتگی" description="روزهای کاری مطب در بازه‌های ۱۵ دقیقه‌ای نمایش داده می‌شوند؛ روی بازهٔ باز برای ثبت نوبت دستی بزنید.">
      <AppointmentSearchBox value={searchQuery} onChange={setSearchQuery} />
      {isSearching ? <AppointmentSearchResults results={searchResults} /> : null}

      <section aria-labelledby="calendar-heading" hidden={isSearching}>
        <div className="flex flex-col gap-4 rounded-2xl bg-(--brand-gray) p-4 shadow-sm ring-1 ring-(--brand-gray) sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-base font-medium text-(--brand-blue)">هفتهٔ انتخاب‌شده</p>
            <h2 id="calendar-heading" className="mt-1 text-xl font-bold text-(--brand-navy)">{formatJalaliWeek(weekStart)}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => moveWeek(-1)} className="min-h-11 rounded-xl border border-(--brand-muted) px-4 text-base font-bold text-(--brand-ink) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)">هفتهٔ قبل</button>
            <button type="button" onClick={() => moveWeek(1)} className="min-h-11 rounded-xl bg-(--brand-navy) px-4 text-base font-bold text-white hover:bg-(--brand-blue) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-navy)">هفتهٔ بعد</button>
          </div>
        </div>

        <Notice message={notice} />

        {mobileDate ? (
          <div className="mt-4 grid gap-3 md:hidden">
            <label htmlFor="mobile-calendar-day" className="text-base font-bold text-(--brand-ink)">روز کاری</label>
            <select id="mobile-calendar-day" value={mobileDate} onChange={(event) => setSelectedMobileDate(event.target.value)} className="min-h-11 rounded-xl border border-(--brand-muted) bg-white px-3 text-base font-bold focus:outline-2 focus:outline-offset-2 focus:outline-(--brand-navy)">
              {openWorkingDateKeys.map((dateKey) => <option key={dateKey} value={dateKey}>{formatJalaliShortDate(dateKey)}</option>)}
            </select>
            <ScheduleDay dateKey={mobileDate} slots={slots} appointments={calendarAppointments} selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />
          </div>
        ) : null}

        <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-(--brand-gray) md:block">
          <div className="grid min-w-230" style={{ gridTemplateColumns: "5rem repeat(7, minmax(7.5rem, 1fr))" }}>
            <div className="flex items-center border-b border-l border-(--brand-gray) bg-(--brand-light) p-3 text-base font-bold text-(--brand-muted)">زمان</div>
            {columns.map(({ dateKey, open }) => {
              const closure = getClosureForDate(dateKey);
              const cellClass = "flex min-h-18 flex-col items-center justify-center gap-0.5 border-b border-l border-(--brand-gray) p-2 text-center text-base font-bold leading-6";
              const dates = (
                <>
                  <span>{formatJalaliDayLabel(dateKey)}</span>
                  <span lang="en" dir="ltr" className="text-sm font-medium leading-5">{formatGregorianDayLabel(dateKey)}</span>
                </>
              );

              if (!open) {
                return (
                  <div key={dateKey} className={`${cellClass} text-(--brand-muted) ${closure ? "bg-(--brand-gray)" : "bg-(--brand-light)"}`}>
                    {dates}
                    <span>{closure ? "تعطیل" : "غیرکاری"}</span>
                  </div>
                );
              }

              const selected = dateKey === mobileDate;
              return (
                <button
                  key={dateKey}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedMobileDate(dateKey)}
                  className={`${cellClass} transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${selected ? "bg-(--brand-navy) text-white focus-visible:outline-white" : "bg-(--brand-light) text-(--brand-navy) hover:bg-(--brand-gray) focus-visible:outline-(--brand-navy)"}`}
                >
                  {dates}
                </button>
              );
            })}
            {mobileDate
              ? slots.map((time) => (
                  <CalendarRow key={time} time={time} columns={columns} appointments={calendarAppointments} selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />
                ))
              : null}
          </div>
        </div>

        {mobileDate ? null : (
          <EmptyState title="این هفته روز کاری ندارد" description="برای دیدن هفتهٔ دیگر از دکمه‌های بالا استفاده کنید." />
        )}
      </section>

      {selectedSlot ? <ManualAppointmentDialog slot={selectedSlot} snapshot={snapshot} onClose={() => setSelectedSlot(null)} onComplete={(message) => { setSelectedSlot(null); setNotice(message); }} /> : null}
    </PanelShell>
  );
}

function CalendarRow({
  time,
  columns,
  appointments,
  selectedSlot,
  onSelectSlot,
}: {
  time: string;
  columns: { dateKey: string; open: boolean }[];
  appointments: AppointmentWithPatient[];
  selectedSlot: { dateKey: string; time: string } | null;
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
}) {
  return (
    <>
      <div className="border-b border-l border-(--brand-gray) bg-(--brand-light) px-3 py-2 text-center text-base font-bold text-(--brand-muted)" dir="ltr">{time}</div>
      {columns.map(({ dateKey, open }) => {
        if (!open) {
          return <div key={dateKey} aria-hidden="true" className="border-b border-l border-(--brand-gray) bg-(--brand-light)" />;
        }
        const coverage = getSlotCoverage(appointments, dateKey, time);
        const selected = selectedSlot?.dateKey === dateKey && selectedSlot.time === time;
        return <CalendarSlot key={dateKey} dateKey={dateKey} time={time} coverage={coverage} selected={selected} onSelectSlot={onSelectSlot} />;
      })}
    </>
  );
}

function ScheduleDay({
  dateKey,
  slots,
  appointments,
  selectedSlot,
  onSelectSlot,
}: {
  dateKey: string;
  slots: string[];
  appointments: AppointmentWithPatient[];
  selectedSlot: { dateKey: string; time: string } | null;
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-(--brand-gray)">
      {slots.map((time) => {
        const coverage = getSlotCoverage(appointments, dateKey, time);
        return (
          <div key={time} className="flex min-h-14 items-stretch border-b border-(--brand-gray) last:border-b-0">
            <span className="flex w-20 items-center justify-center bg-(--brand-light) text-base font-bold text-(--brand-muted)" dir="ltr">{time}</span>
            <CalendarSlot dateKey={dateKey} time={time} coverage={coverage} selected={selectedSlot?.dateKey === dateKey && selectedSlot.time === time} onSelectSlot={onSelectSlot} mobile />
          </div>
        );
      })}
    </div>
  );
}

function CalendarSlot({
  dateKey,
  time,
  coverage,
  selected,
  onSelectSlot,
  mobile = false,
}: {
  dateKey: string;
  time: string;
  coverage: SlotCoverage<AppointmentWithPatient>[];
  selected: boolean;
  onSelectSlot: (slot: { dateKey: string; time: string }) => void;
  mobile?: boolean;
}) {
  // هیچ نوبتی از تقویم پنهان نمی‌شود: اگر چند نوبت یک ساعت را گرفته باشند، همه زیر هم دیده می‌شوند.
  // نوبت بلندتر از ۱۵ دقیقه در خانهٔ اول نام را نشان می‌دهد و در خانه‌های بعدی نشانهٔ «ادامه».
  if (coverage.length > 0) {
    return (
      <div className={`${mobile ? "flex-1" : "border-b border-l border-(--brand-gray)"} flex flex-col justify-center gap-1 bg-(--brand-gray) p-1`}>
        {coverage.map(({ appointment, isFirstCell }) =>
          isFirstCell ? (
            <div key={appointment.id} className="w-full rounded-lg border border-(--brand-blue) bg-white px-2 py-1.5 text-center text-base font-bold text-(--brand-navy)">{getOfficialName(appointment)}</div>
          ) : (
            <div key={appointment.id} className="w-full rounded-lg border border-dashed border-(--brand-blue) px-2 py-1.5 text-center text-base font-medium text-(--brand-blue)">
              ادامهٔ نوبت<span className="sr-only"> {getOfficialName(appointment)}</span>
            </div>
          ),
        )}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => onSelectSlot({ dateKey, time })} aria-label={`ثبت نوبت دستی در ${formatJalaliShortDate(dateKey)} ساعت ${time}`} className={`${mobile ? "flex-1" : "border-b border-l border-(--brand-gray)"} min-h-12 text-base font-medium transition focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${selected ? "bg-(--brand-navy) font-bold text-white focus-visible:outline-white" : "bg-white text-(--brand-muted) hover:bg-(--brand-light) hover:text-(--brand-navy) focus-visible:outline-(--brand-navy)"}`}>
      باز
    </button>
  );
}

function ManualAppointmentDialog({
  slot,
  snapshot,
  onClose,
  onComplete,
}: {
  slot: { dateKey: string; time: string };
  snapshot: AppointmentSnapshot;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const [patient, setPatient] = useState<NewPatientInput>({ full_name: "", mobile: "", national_id: "" });
  // ساعت شروع به‌طور پیش‌فرض همان خانه‌ای است که منشی روی آن زده است.
  const [time, setTime] = useState(slot.time);
  const [durationMinutes, setDurationMinutes] = useState<number>(MANUAL_DURATION_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [suggestion, setSuggestion] = useState<Exclude<ManualPatientCheck, { kind: "invalid" | "new" }> | null>(null);
  const freeTimes = useMemo(() => getFreeStartTimes(snapshot, slot.dateKey), [snapshot, slot.dateKey]);

  function changePatient(next: NewPatientInput, field: keyof NewPatientInput) {
    setPatient(next);
    setError("");
    setSuggestion(null);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function book(patientId?: string) {
    const result = createManualAppointment({ dateKey: slot.dateKey, time, durationMinutes, note, patient, patientId });
    if (!result.ok) {
      setError(result.message);
      setSuggestion(null);
      return;
    }
    onComplete(result.message);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // زمان و مدت پیش از بررسی مراجع سنجیده می‌شود تا خطای زمان به مرحلهٔ «مراجع مشابه» نرسد.
    const slotCheck = checkManualSlot({ dateKey: slot.dateKey, time, durationMinutes });
    const check = checkManualPatient(patient);
    if (check.kind === "invalid") {
      setError(slotCheck.ok ? "" : slotCheck.message);
      setFieldErrors(check.errors);
      setSuggestion(null);
      focusFirstInvalidField(check.errors, "manual-patient");
      return;
    }
    if (!slotCheck.ok) {
      setError(slotCheck.message);
      setSuggestion(null);
      return;
    }
    if (check.kind === "new") {
      book();
      return;
    }
    setError("");
    setSuggestion(check);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-(--brand-navy)/50 sm:items-center sm:justify-center sm:p-6" role="presentation">
      <section aria-modal="true" aria-labelledby="manual-appointment-title" role="dialog" className="max-h-full w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-medium text-emerald-800">ثبت نوبت دستی</p>
            <h2 id="manual-appointment-title" className="mt-1 text-xl font-bold text-(--brand-navy)">{formatJalaliShortDate(slot.dateKey)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن پنجره" className="min-h-11 min-w-11 rounded-xl border border-(--brand-gray) text-lg font-bold text-(--brand-muted) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">×</button>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={submit} noValidate>
          <Field label="نام و نام خانوادگی" id="manual-patient-name" value={patient.full_name} onChange={(value) => changePatient({ ...patient, full_name: value }, "full_name")} error={fieldErrors.full_name} autoFocus />
          <Field label="شمارهٔ موبایل (۱۱ رقم، شروع با ۰۹)" id="manual-patient-mobile" value={patient.mobile} onChange={(value) => changePatient({ ...patient, mobile: value }, "mobile")} error={fieldErrors.mobile} inputMode="numeric" />
          <Field label="کد ملی (۱۰ رقم)" id="manual-patient-national-id" value={patient.national_id} onChange={(value) => changePatient({ ...patient, national_id: value }, "national_id")} error={fieldErrors.national_id} inputMode="numeric" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="manual-appointment-time" className="block text-base font-bold text-(--brand-ink)">
              ساعت شروع
              <select id="manual-appointment-time" value={time} onChange={(event) => { setTime(event.target.value); setError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white px-3 text-base font-normal outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)">
                {freeTimes.map((freeTime) => <option key={freeTime} value={freeTime}>{freeTime}</option>)}
              </select>
            </label>
            <label htmlFor="manual-appointment-duration" className="block text-base font-bold text-(--brand-ink)">
              مدت نوبت
              <select id="manual-appointment-duration" value={durationMinutes} onChange={(event) => { setDurationMinutes(Number(event.target.value)); setError(""); }} className="mt-2 min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white px-3 text-base font-normal outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)">
                {MANUAL_DURATION_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{durationLabels[minutes]}</option>)}
              </select>
            </label>
          </div>
          <div>
            <label htmlFor="manual-appointment-note" className="block text-base font-bold text-(--brand-ink)">
              توضیح (اختیاری)
              <textarea id="manual-appointment-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} aria-describedby="manual-appointment-note-hint" className="mt-2 w-full rounded-xl border border-(--brand-muted) bg-white px-3 py-2 text-base font-normal outline-none transition focus:border-(--brand-navy) focus:ring-2 focus:ring-(--brand-navy)" />
            </label>
            <p id="manual-appointment-note-hint" className="mt-1 text-sm text-(--brand-muted)">توضیح اداری، مثلاً هماهنگی یا همراه</p>
          </div>
          {error ? <p role="alert" className="rounded-xl bg-(--status-bad-bg) px-3 py-2 text-base font-medium text-(--status-bad-text)">{error}</p> : null}
          {suggestion?.kind === "same_national_id" ? (
            <div role="alert" className="rounded-xl border border-(--brand-peach) bg-(--brand-peach) px-4 py-3 text-base text-(--brand-navy)">
              <p className="font-bold">این مراجع قبلاً ثبت شده است.</p>
              <p className="mt-1">{suggestion.patient.full_name} · <span dir="ltr">{suggestion.patient.mobile}</span></p>
              <p className="mt-1">می‌توانید نوبت را برای همین مراجع ثبت کنید، یا کد ملی را اصلاح کنید.</p>
              <button type="button" onClick={() => book(suggestion.patient.id)} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-base font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                ثبت نوبت برای همین مراجع
              </button>
            </div>
          ) : null}
          {suggestion?.kind === "similar" ? (
            <div role="alert" className="rounded-xl border border-(--brand-peach) bg-(--brand-peach) px-4 py-3 text-base text-(--brand-navy)">
              <p className="font-bold">مراجع مشابهی ثبت شده است.</p>
              <p className="mt-1">اگر یکی از این‌هاست، انتخابش کنید. در غیر این صورت «ثبت به‌عنوان مراجع جدید» را بزنید.</p>
              <ul className="mt-3 grid gap-2">
                {suggestion.candidates.slice(0, 5).map((candidate) => (
                  <li key={candidate.id}>
                    <button type="button" onClick={() => book(candidate.id)} className="min-h-11 w-full rounded-xl border border-(--brand-muted) bg-white px-3 py-2 text-right text-base font-bold text-(--brand-ink) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                      {candidate.full_name} · <span dir="ltr">{candidate.mobile}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => book()} className="mt-3 min-h-11 w-full rounded-xl border border-emerald-700 bg-white px-4 text-base font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                ثبت به‌عنوان مراجع جدید
              </button>
            </div>
          ) : null}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-base font-bold text-(--brand-muted) hover:bg-(--brand-light) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">انصراف</button>
            <button type="submit" className="min-h-11 rounded-xl bg-emerald-700 px-4 text-base font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">ثبت نوبت</button>
          </div>
        </form>
      </section>
    </div>
  );
}
