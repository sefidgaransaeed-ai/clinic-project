"use client";

import { useId, useState } from "react";
import { optionNameError, type FinanceOptions } from "../data";
import type { Option } from "../types";
import { card, field, fieldError, primaryButton, smallButton } from "./styles";

/**
 * تنظیم بیمه‌ها و روش‌های پرداخت — فقط پزشک.
 * حذف نداریم: پرداخت‌های قبلی به همین ردیف‌ها اشاره می‌کنند و با حذف، گزارش گذشته خراب می‌شد.
 * به‌جایش خاموش‌کردن: مورد خاموش در فرم‌های تازه نمی‌آید ولی در سوابق و گزارش‌ها می‌ماند.
 *
 * تغییرها فعلاً فقط در همین صفحه نگه داشته می‌شوند؛ در کار p3-06 به پایگاه داده می‌روند.
 */
export function FinanceSettings({ initial }: { initial: FinanceOptions }) {
  const [methods, setMethods] = useState(initial.paymentMethods);
  const [insurances, setInsurances] = useState(initial.insuranceTypes);

  return (
    <div className="finance-theme mx-auto flex w-full max-w-5xl flex-col gap-6">
      <p className="rounded-2xl border-2 border-dashed border-(--fin-orange) bg-(--fin-peach)/40 p-4 text-sm text-(--fin-navy)">
        <span className="font-bold">حالت آزمایشی.</span> داده‌ها ساختگی‌اند و تغییرها با بارگذاری
        دوبارهٔ صفحه پاک می‌شوند.
      </p>

      <header>
        <h1 className="text-2xl font-black text-(--fin-navy)">بیمه‌ها و روش‌های پرداخت</h1>
        <p className="mt-1 max-w-2xl text-(--fin-muted)">
          مورد تازه اضافه کنید، نامش را درست کنید یا خاموشش کنید. مورد خاموش در فرم‌های تازه دیده
          نمی‌شود، ولی در پرداخت‌ها و گزارش‌های قبلی می‌ماند.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <OptionList
          title="نوع بیمه‌ها"
          noun="بیمه"
          options={insurances}
          onChange={setInsurances}
          idPrefix="ins"
        />
        <OptionList
          title="روش‌های پرداخت"
          noun="روش"
          options={methods}
          onChange={setMethods}
          idPrefix="method"
        />
      </div>
    </div>
  );
}

function OptionList({
  title,
  noun,
  options,
  onChange,
  idPrefix,
}: {
  title: string;
  /** «بیمه» یا «روش»، برای متن دکمه‌ها */
  noun: string;
  options: Option[];
  onChange: (options: Option[]) => void;
  idPrefix: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const add = () => {
    const problem = optionNameError(draft, options);
    if (problem) {
      setError(problem);
      return;
    }
    const name = draft.trim().replace(/\s+/g, " ");
    onChange([...options, { id: `${idPrefix}-${Date.now()}`, name, isActive: true }]);
    setDraft("");
    setError("");
    setMessage(`«${name}» اضافه شد.`);
  };

  const toggle = (option: Option) => {
    onChange(options.map((item) => (item.id === option.id ? { ...item, isActive: !item.isActive } : item)));
    setMessage(
      option.isActive
        ? `«${option.name}» خاموش شد. در فرم‌های تازه دیده نمی‌شود.`
        : `«${option.name}» دوباره روشن شد.`,
    );
  };

  const active = options.filter((option) => option.isActive).length;

  return (
    <section className={card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-black text-(--fin-navy)">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-(--fin-muted)">
        {active.toLocaleString("fa-IR")} روشن از {options.length.toLocaleString("fa-IR")}
      </p>

      <ul className="mt-4 flex flex-col">
        {options.map((option) =>
          editingId === option.id ? (
            <RenameRow
              key={option.id}
              option={option}
              options={options}
              onSave={(name) => {
                onChange(options.map((item) => (item.id === option.id ? { ...item, name } : item)));
                setEditingId(null);
                setMessage(`نام به «${name}» عوض شد. پرداخت‌های قبلی هم با نام تازه دیده می‌شوند.`);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <li
              key={option.id}
              className="flex items-center gap-3 border-t border-(--fin-grey) py-3 first:border-t-0"
            >
              {/* مربع گوشه‌تیز نارنجی برای روشن، قاب خالی برای خاموش؛ وضعیت با نوشته هم گفته می‌شود */}
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-[2px] ${option.isActive ? "bg-(--fin-orange)" : "border-2 border-(--fin-grey)"}`}
              />
              <span className={`min-w-0 flex-1 font-bold ${option.isActive ? "text-(--fin-navy)" : "text-(--fin-muted) line-through decoration-(--fin-muted)/40"}`}>
                {option.name}
                {!option.isActive && <span className="ms-2 text-xs font-normal no-underline">خاموش</span>}
              </span>
              <button
                type="button"
                onClick={() => setEditingId(option.id)}
                className={smallButton}
                aria-label={`تغییر نام ${option.name}`}
              >
                تغییر نام
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={option.isActive}
                aria-label={`${option.name} روشن باشد`}
                onClick={() => toggle(option)}
                className="group relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-(--fin-grey) transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-blue) aria-checked:bg-(--fin-navy)"
              >
                {/* پنل راست‌چین است: دکمهٔ روشن به سمت چپ می‌رود */}
                <span className="absolute start-1 top-1 size-5 rounded-full bg-white shadow transition-transform group-aria-checked:-translate-x-5" />
              </button>
            </li>
          ),
        )}
      </ul>

      <form
        className="mt-4 border-t border-(--fin-grey) pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label htmlFor={`${id}-new`} className="mb-1.5 block text-sm font-bold text-(--fin-navy)">
          {noun} تازه
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-new`}
            className={field}
            value={draft}
            maxLength={60}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
            placeholder={noun === "بیمه" ? "مثلاً بیمهٔ تکمیلی" : "مثلاً نقدی"}
          />
          <button type="submit" className={`${primaryButton} shrink-0`}>
            اضافه کن
          </button>
        </div>
        {error && (
          <p id={`${id}-error`} role="alert" className={fieldError}>
            {error}
          </p>
        )}
      </form>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-(--fin-green) empty:hidden">
        {message}
      </p>
    </section>
  );
}

function RenameRow({
  option,
  options,
  onSave,
  onCancel,
}: {
  option: Option;
  options: Option[];
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(option.name);
  const [error, setError] = useState("");

  return (
    <li className="border-t border-(--fin-grey) py-3 first:border-t-0">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const problem = optionNameError(name, options, option.id);
          if (problem) {
            setError(problem);
            return;
          }
          onSave(name.trim().replace(/\s+/g, " "));
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <label htmlFor={`${id}-name`} className="sr-only">
          نام تازهٔ {option.name}
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-name`}
            autoFocus
            className={field}
            value={name}
            maxLength={60}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          <button type="submit" className={`${primaryButton} shrink-0`}>
            ذخیره
          </button>
          <button type="button" onClick={onCancel} className={`${smallButton} h-11 shrink-0`}>
            انصراف
          </button>
        </div>
        {error && (
          <p id={`${id}-error`} role="alert" className={fieldError}>
            {error}
          </p>
        )}
      </form>
    </li>
  );
}
