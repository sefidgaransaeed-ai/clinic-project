"use client";

import { useId } from "react";
import { amountInWords, formatAmount, parseAmount } from "../money";
import { field, fieldError, fieldHint, label } from "./styles";

/**
 * کادر مبلغ: هنگام تایپ سه‌رقم‌سه‌رقم جدا می‌شود و رقم فارسی هم می‌پذیرد.
 * مقدار بیرونی همیشه عدد صحیح تومان است، نه متن (CLAUDE.md بخش ۴).
 */
export function MoneyInput({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (amountToman: number | null) => void;
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className={label}>
        مبلغ
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          dir="ltr"
          autoComplete="off"
          placeholder="۰"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hintId}
          // عدد راست‌چین و واژهٔ «تومان» سمت چپ کادر؛ کادر ltr است، پس جهت‌ها فیزیکی‌اند
          className={`${field} pr-3 pl-16 text-right text-lg font-bold`}
          value={value ? formatAmount(value) : ""}
          onChange={(event) => onChange(parseAmount(event.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-(--fin-muted)">
          تومان
        </span>
      </div>
      {error ? (
        <p id={errorId} className={fieldError}>
          {error}
        </p>
      ) : (
        // مثل روی چک، مبلغ به حروف هم نوشته می‌شود تا صفر کم یا زیاد پیش از ثبت دیده شود
        <p id={hintId} className={value ? "mt-2 border-s-2 border-(--fin-orange) ps-2.5 text-sm font-bold text-(--fin-navy)" : fieldHint}>
          {value ? (
            <>
              <span className="font-normal text-(--fin-muted)">به حروف: </span>
              {amountInWords(value)}
            </>
          ) : (
            "به تومان و بدون اعشار."
          )}
        </p>
      )}
    </div>
  );
}
