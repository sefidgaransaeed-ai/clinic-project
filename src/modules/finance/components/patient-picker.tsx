"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { toLatinDigits, toPersianDigits } from "../dates";
import type { Patient } from "../types";
import { field, fieldError, label } from "./styles";

/**
 * انتخاب مراجع با جست‌وجوی نام یا شماره.
 * موقت است: وقتی کامپوننت PatientPicker خانم مریم آماده شد، همان جایگزین این می‌شود.
 * الگوی combobox در ARIA: با فلش بالا و پایین حرکت، با Enter انتخاب، با Escape بسته می‌شود.
 */
export function PatientPicker({
  patients,
  value,
  onChange,
  error,
}: {
  patients: Patient[];
  value: string | null;
  onChange: (patientId: string | null) => void;
  error?: string;
}) {
  const id = useId();
  const selected = patients.find((patient) => patient.id === value) ?? null;
  const [query, setQuery] = useState(selected?.fullName ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const needle = toLatinDigits(query.trim());
    if (!needle) return patients;
    return patients.filter(
      (patient) => patient.fullName.includes(needle) || patient.mobile?.includes(needle),
    );
  }, [patients, query]);

  const choose = (patient: Patient) => {
    onChange(patient.id);
    setQuery(patient.fullName);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  const errorId = `${id}-error`;

  return (
    <div className="relative">
      <label htmlFor={id} className={label}>
        مراجع
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        placeholder="نام یا شمارهٔ مراجع را بنویسید"
        className={field}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          if (selected) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-(--fin-grey) bg-white p-1 shadow-[0_16px_40px_-20px_rgba(38,34,97,0.45)]"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-(--fin-muted)">
              مراجعی با این نام یا شماره پیدا نشد.
            </li>
          ) : (
            matches.map((patient, index) => (
              <li
                key={patient.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={patient.id === value}
                // mousedown تا پیش از بسته شدن فهرست در blur اجرا شود
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(patient);
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  index === active ? "bg-(--fin-grey-soft)" : ""
                } ${patient.id === value ? "font-bold text-(--fin-navy)" : ""}`}
              >
                <span>{patient.fullName}</span>
                <span dir="ltr" className="text-(--fin-muted)">
                  {patient.mobile ? toPersianDigits(patient.mobile) : "بدون شماره"}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      {error && (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
