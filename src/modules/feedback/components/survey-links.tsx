"use client";

import { useState, useTransition } from "react";
import { createSurveyLink } from "../actions";
import type { DateStamp } from "../rules";
import { PaperCard, Stamp } from "./paper";

export type LinkRow = { appointmentId: string; patientName: string; time: string; stamp: DateStamp };

type Made = { url: string; copied: boolean };

const button =
  "inline-flex h-10 cursor-pointer items-center rounded-xl px-3.5 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue) disabled:cursor-default disabled:opacity-50";

/**
 * لینک‌های نظرسنجی، برای پزشک و منشی: هر نوبت انجام‌شده‌ای که هنوز لینک ندارد یک کارت کاغذی
 * با مهر روز نوبت است. «ساختن و کپی لینک» لینک یک‌بارمصرف را می‌سازد و کپی می‌کند.
 *
 * done_appointments_without_survey نوبتی را که لینک دارد دیگر برنمی‌گرداند؛ پس کارت ساخته‌شده
 * تا آخر همین بار در صفحه می‌ماند تا لینک گم نشود.
 */
export function SurveyLinks({ rows }: { rows: LinkRow[] }) {
  const [made, setMade] = useState<Record<string, Made>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const copy = async (appointmentId: string, url: string) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // اگر مرورگر اجازهٔ کپی نداد، لینک در کادر دیده می‌شود تا با دست کپی شود
    }
    setMade((current) => ({ ...current, [appointmentId]: { url, copied } }));
  };

  const make = (appointmentId: string) => {
    const existing = made[appointmentId];
    if (existing) {
      void copy(appointmentId, existing.url);
      return;
    }
    setBusy(appointmentId);
    setErrors((current) => ({ ...current, [appointmentId]: "" }));
    startTransition(async () => {
      const result = await createSurveyLink(appointmentId);
      if (result.ok) await copy(appointmentId, result.url);
      else setErrors((current) => ({ ...current, [appointmentId]: result.message }));
      setBusy(null);
    });
  };

  return (
    <div className="site-theme mx-auto w-full max-w-6xl bg-transparent">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-(--site-navy) md:text-3xl">لینک‌های نظرسنجی</h1>
          <p className="text-(--site-muted)">نوبت‌های انجام‌شدهٔ هفتهٔ اخیر که هنوز لینک ندارند.</p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
        <div>
          {rows.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-[#d8cfbf] p-6 text-center text-(--site-muted)">
              همهٔ نوبت‌های انجام‌شدهٔ هفتهٔ اخیر لینک دارند.
            </p>
          ) : (
            <ul className="grid gap-4.5 md:grid-cols-2">
              {rows.map((row) => {
                const done = made[row.appointmentId];
                const error = errors[row.appointmentId];
                return (
                  <li key={row.appointmentId}>
                    <PaperCard tone={done ? "green" : "orange"} className="min-h-36 px-5 pt-4.5 pb-4">
                      {done ? (
                        <Stamp top="لینک" middle="✓" bottom="ساخته شد" tone="green" size="md" className="absolute top-3 left-3.5" />
                      ) : (
                        <Stamp top={row.stamp.weekday} middle={row.stamp.day} bottom={row.stamp.month} size="md" className="absolute top-3 left-3.5" />
                      )}
                      <p className="pe-22 text-[1.05rem] font-black text-(--site-navy)">{row.patientName}</p>
                      <p className="mb-3.5 pe-22 text-sm text-(--site-muted)">
                        نوبت {row.stamp.weekday} {row.stamp.day} {row.stamp.month}، ساعت {row.time}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {done ? (
                          <>
                            <span role="status" className="text-sm font-black text-[#1f7a4d]">
                              {done.copied ? "✓ کپی شد" : "لینک ساخته شد؛ از کادر زیر کپی کنید"}
                            </span>
                            <button
                              type="button"
                              onClick={() => make(row.appointmentId)}
                              className={`${button} bg-white text-(--site-navy) ring-[1.5px] ring-(--site-navy)/25 ring-inset`}
                            >
                              کپی دوباره
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => make(row.appointmentId)}
                            disabled={busy === row.appointmentId}
                            aria-label={`ساختن و کپی لینک نظرسنجی برای ${row.patientName}`}
                            className={`${button} bg-(--site-orange) text-(--site-navy)`}
                          >
                            {busy === row.appointmentId ? "در حال ساختن…" : "ساختن و کپی لینک"}
                          </button>
                        )}
                      </div>

                      {done && (
                        <div className="mt-3 border-t border-dashed border-(--site-grey) pt-2.5">
                          <input
                            readOnly
                            value={done.url}
                            dir="ltr"
                            aria-label={`لینک نظرسنجی ${row.patientName}`}
                            onFocus={(event) => event.target.select()}
                            className="w-full rounded-lg bg-(--site-grey-soft) px-2.5 py-1.5 text-left text-[0.8rem] font-bold text-(--site-navy) outline-none focus:ring-2 focus:ring-(--site-orange)"
                          />
                          <p className="mt-1.5 text-xs text-(--site-muted)">
                            این کارت دفعهٔ بعد در فهرست نیست. لینک را همین حالا بفرستید.
                          </p>
                        </div>
                      )}
                      {error && (
                        <p role="alert" className="mt-2 text-sm font-bold text-[#b42318]">
                          {error}
                        </p>
                      )}
                    </PaperCard>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[1.1rem] bg-(--site-grey-soft) p-4 text-sm">
            <h2 className="mb-1.5 font-black text-(--site-navy)">چطور بفرستم؟</h2>
            <ol className="list-[persian] ps-4.5 text-(--site-muted)">
              <li>روی «ساختن و کپی لینک» بزنید.</li>
              <li>لینک را در پیامک یا واتس‌اپ برای مراجع بفرستید.</li>
            </ol>
          </div>
          <div className="rounded-[1.1rem] bg-(--site-grey-soft) p-4 text-sm">
            <h2 className="mb-1.5 font-black text-(--site-navy)">نتیجه‌ها کجاست؟</h2>
            <p className="text-(--site-muted)">
              نتیجهٔ نظرسنجی‌ها را فقط پزشک در صفحهٔ «بازخوردها» می‌بیند. هر لینک یک ماه کار می‌کند و
              فقط یک بار.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
