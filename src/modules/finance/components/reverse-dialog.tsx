"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { formatJalaliDateTime } from "../dates";
import type { Payment } from "../types";
import { dangerButton, field, fieldError, label, secondaryButton } from "./styles";
import { Toman } from "./toman";

/**
 * پنجرهٔ تأیید «ثبت معکوس». علت اجباری است و در توضیح ردیف معکوس ذخیره می‌شود.
 * از <dialog> خود مرورگر استفاده شده تا تمرکز و کلید Escape درست کار کنند.
 */
export function ReverseDialog({
  payment,
  patientName,
  methodName,
  onConfirm,
  onClose,
}: {
  payment: Payment | null;
  patientName: string;
  methodName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (payment && !dialog.open) dialog.showModal();
    if (!payment && dialog.open) dialog.close();
  }, [payment]);

  const close = () => {
    setReason("");
    setError("");
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("علت را کوتاه بنویسید؛ در سابقهٔ پرداخت می‌ماند.");
      return;
    }
    onConfirm(reason);
    setReason("");
    setError("");
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby={`${id}-title`}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl p-0 text-(--fin-ink) backdrop:bg-(--fin-navy)/40"
    >
      {payment && (
        <form onSubmit={submit} className="p-6">
          <h2 id={`${id}-title`} className="text-lg font-black text-(--fin-navy)">
            ثبت معکوس
          </h2>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-(--fin-grey-soft) p-4 text-sm">
            <dt className="text-(--fin-muted)">مراجع</dt>
            <dd className="font-bold">{patientName}</dd>
            <dt className="text-(--fin-muted)">مبلغ</dt>
            <dd className="font-bold">
              <Toman amount={payment.amountToman} />
            </dd>
            <dt className="text-(--fin-muted)">روش</dt>
            <dd>{methodName}</dd>
            <dt className="text-(--fin-muted)">زمان پرداخت</dt>
            <dd>{formatJalaliDateTime(payment.paidAt)}</dd>
          </dl>

          <p className="mt-4 text-sm">
            یک ردیف تازه با مبلغ <strong>منفی</strong> و <strong>همان تاریخ پرداخت</strong> ثبت
            می‌شود. پرداخت اصلی پاک یا ویرایش نمی‌شود و این کار را نمی‌شود برگرداند.
          </p>

          <label htmlFor={`${id}-reason`} className={`${label} mt-4`}>
            علت
          </label>
          <textarea
            id={`${id}-reason`}
            rows={2}
            maxLength={300}
            autoFocus
            placeholder="مثلاً: مبلغ اشتباه وارد شده بود"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${field} h-auto py-2`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {error && (
            <p id={`${id}-error`} className={fieldError}>
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={close}>
              انصراف
            </button>
            <button type="submit" className={dangerButton}>
              ثبت معکوس
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
