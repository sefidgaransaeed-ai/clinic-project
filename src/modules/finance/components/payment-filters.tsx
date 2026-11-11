"use client";

import { useId, useState } from "react";
import { presetRange, type PaymentFilters, type RangePreset } from "../data";
import { parseJalaliDate } from "../dates";
import type { Option, Patient } from "../types";
import { field, fieldError, label, pillButton } from "./styles";

const PRESETS: { value: RangePreset | "custom"; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "today", label: "امروز" },
  { value: "week", label: "این هفته" },
  { value: "month", label: "این ماه" },
  { value: "lastMonth", label: "ماه قبل" },
  { value: "custom", label: "بازهٔ دلخواه" },
];

/**
 * فیلترهای فهرست پرداخت‌ها — فقط برای پزشک.
 * منشی بازهٔ تاریخ ندارد، چون فقط پرداخت‌های امروز را می‌بیند (تصمیم H-4).
 */
export function PaymentFiltersBar({
  filters,
  onChange,
  paymentMethods,
  patients,
  now,
}: {
  filters: PaymentFilters;
  onChange: (filters: PaymentFilters) => void;
  paymentMethods: Option[];
  patients: Patient[];
  now: Date;
}) {
  const id = useId();
  const [preset, setPreset] = useState<RangePreset | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangeError, setRangeError] = useState("");

  const choosePreset = (value: RangePreset | "custom") => {
    setPreset(value);
    setRangeError("");
    if (value !== "custom") onChange({ ...filters, range: presetRange(value, now) });
  };

  const applyCustom = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    const fromKey = parseJalaliDate(nextFrom);
    const toKey = parseJalaliDate(nextTo);
    if (!fromKey || !toKey) {
      setRangeError(nextFrom && nextTo ? "تاریخ‌ها را به شکل ۱۴۰۵/۰۸/۰۶ بنویسید." : "");
      return;
    }
    if (fromKey > toKey) {
      setRangeError("«از» باید پیش از «تا» باشد.");
      return;
    }
    setRangeError("");
    onChange({ ...filters, range: { from: fromKey, to: toKey } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="بازهٔ تاریخ" className="flex flex-wrap gap-1.5">
        {PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={preset === item.value}
            onClick={() => choosePreset(item.value)}
            className={pillButton}
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-from`} className={label}>
                از
              </label>
              <input
                id={`${id}-from`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="۱۴۰۵/۰۸/۰۱"
                aria-invalid={Boolean(rangeError)}
                className={`${field} text-right`}
                value={from}
                onChange={(event) => applyCustom(event.target.value, to)}
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className={label}>
                تا
              </label>
              <input
                id={`${id}-to`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="۱۴۰۵/۰۸/۳۰"
                aria-invalid={Boolean(rangeError)}
                className={`${field} text-right`}
                value={to}
                onChange={(event) => applyCustom(from, event.target.value)}
              />
            </div>
          </div>
          {rangeError && (
            <p role="alert" className={fieldError}>
              {rangeError}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-method`} className={label}>
            روش پرداخت
          </label>
          <select
            id={`${id}-method`}
            className={field}
            value={filters.paymentMethodId ?? ""}
            onChange={(event) => onChange({ ...filters, paymentMethodId: event.target.value || null })}
          >
            <option value="">همهٔ روش‌ها</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-patient`} className={label}>
            مراجع
          </label>
          <select
            id={`${id}-patient`}
            className={field}
            value={filters.patientId ?? ""}
            onChange={(event) => onChange({ ...filters, patientId: event.target.value || null })}
          >
            <option value="">همهٔ مراجعان</option>
            {[...patients]
              .sort((a, b) => a.fullName.localeCompare(b.fullName, "fa"))
              .map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}
