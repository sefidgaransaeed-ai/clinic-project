"use client";
import { type KeyboardEvent, useState } from "react";
import type { Patient } from "./types";

/**
 * فیلد نام با فهرست پیشنهادِ مراجع‌های ثبت‌شده، فقط برای پنل. خودش جست‌وجو نمی‌کند؛
 * پیشنهادها را فراخواننده می‌دهد. روی الگوی combobox (فهرست بازشونده) ساخته شده تا با صفحه‌کلید و صفحه‌خوان کار کند.
 */
export function PatientNameCombobox({
  id,
  label,
  hint,
  value,
  onChange,
  suggestions,
  onPick,
  error,
  autoFocus = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: Patient[];
  onPick: (patient: Patient) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  // با Escape فهرست تا تایپ بعدی بسته می‌ماند.
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listId = `${id}-listbox`;
  const open = focused && !dismissed && suggestions.length > 0;
  const active = activeIndex < suggestions.length ? activeIndex : -1;
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setDismissed(true);
      setActiveIndex(-1);
      return;
    }
    if (suggestions.length === 0) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setDismissed(false);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(active === -1 ? (step === 1 ? 0 : suggestions.length - 1) : (active + step + suggestions.length) % suggestions.length);
      return;
    }
    // Enter فقط وقتی ردیفی با جهت‌نما انتخاب شده مراجع را برمی‌دارد؛ وگرنه فرم مثل همیشه ثبت می‌شود.
    if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      onPick(suggestions[active]);
    }
  }

  return (
    <div>
      <div className="relative">
        <label htmlFor={id} className="block text-base font-bold text-slate-800">
          {label}
          <input
            id={id}
            required
            autoFocus={autoFocus}
            autoComplete="off"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setDismissed(false);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-normal outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        {open ? (
          // mouseDown را می‌گیریم تا کلیک روی ردیف، نشانگر را از فیلد نبرد و فهرست پیش از انتخاب بسته نشود.
          <ul id={listId} role="listbox" aria-label="مراجع‌های ثبت‌شده" onMouseDown={(event) => event.preventDefault()} className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((patient, index) => (
              <li
                key={patient.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                onClick={() => onPick(patient)}
                className={`min-h-11 cursor-pointer border-b border-slate-100 px-3 py-2 last:border-b-0 ${index === active ? "bg-sky-100" : "hover:bg-sky-50"}`}
              >
                <span className="block text-base font-bold text-slate-900">{patient.full_name}</span>
                <span className="mt-0.5 block text-right text-sm text-slate-600" dir="ltr">
                  {patient.national_id}{patient.mobile ? ` · ${patient.mobile}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {open ? `${suggestions.length.toLocaleString("fa-IR")} مراجع پیشنهاد شد. با جهت‌نماهای بالا و پایین انتخاب کنید.` : ""}
      </p>
      {hint ? <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-base font-medium text-rose-800">{error}</p> : null}
    </div>
  );
}
