import { DB_READ_FAILED_MESSAGE } from "./db-errors";
import { listClinics, listWorkingHours } from "./data";
import { WORKING_HOURS_MESSAGES } from "./validation";
import { groupByWeekday } from "./weekdays";
import { CreateWorkingHoursForm, WorkingHoursRow } from "./working-hours-ui";

/**
 * نمای ساعت کاری هفته (کامپوننت سروری): هفت کارت از شنبه تا جمعه.
 *
 * مطبِ هر روز اگر بازهٔ فعال دارد فقط متن است (از همان بازه‌ها مشتق شده)؛ روزی که بازهٔ فعال ندارد
 * (بی‌ردیف یا فقط غیرفعال) در فرم افزودن یک فهرست مطب برای انتخاب دارد.
 * خواندن از کلاینت کاربرِ واردشده است، پس RLS اعمال می‌شود؛ قفل نقش هم در صفحه و در هر action است.
 */

const alertClass = "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300";

export async function ScheduleView() {
  const [hours, clinics] = await Promise.all([listWorkingHours(), listClinics()]);

  if (!hours.ok || !clinics.ok) {
    return (
      <p role="alert" className={alertClass}>
        {!hours.ok ? hours.message : !clinics.ok ? clinics.message : DB_READ_FAILED_MESSAGE}
      </p>
    );
  }

  const groups = groupByWeekday(hours.value);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <section
          key={group.weekday}
          aria-labelledby={`weekday-${group.weekday}`}
          className="min-w-0 space-y-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <div className="space-y-1">
            <h3 id={`weekday-${group.weekday}`} className="text-sm font-bold">
              {group.name}
            </h3>
            {group.clinic ? (
              <p className="text-xs opacity-70">مطب: {group.clinic.name ?? "نامشخص"}</p>
            ) : null}
          </div>

          {group.isClinicInconsistent ? (
            <p role="alert" className={alertClass}>
              {WORKING_HOURS_MESSAGES.clinicInconsistent}
            </p>
          ) : null}

          {group.rows.length > 0 ? (
            <ul className="space-y-3">
              {group.rows.map((row) => (
                <WorkingHoursRow key={row.id} row={row} />
              ))}
            </ul>
          ) : (
            <p className="text-xs opacity-60">برای این روز بازهٔ کاری ثبت نشده است.</p>
          )}

          {group.isClinicInconsistent ? null : (
            <div className="space-y-2 border-t border-black/10 pt-4 dark:border-white/15">
              <h4 className="text-xs font-bold">افزودن بازهٔ تازه</h4>
              <CreateWorkingHoursForm
                weekday={group.weekday}
                weekdayName={group.name}
                clinics={group.needsClinicChoice ? clinics.value : undefined}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
