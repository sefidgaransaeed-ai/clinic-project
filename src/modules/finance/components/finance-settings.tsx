"use client";

import { useId, useState, type ReactNode } from "react";
import { optionNameError, type FinanceOptions } from "../data";
import type { Option } from "../types";
import { MethodIcon } from "./method-icon";
import { card, field, fieldError, primaryButton, smallButton } from "./styles";

/**
 * تنظیم بیمه‌ها و روش‌های پرداخت — فقط پزشک.
 * حذف نداریم: پرداخت‌های قبلی به همین ردیف‌ها اشاره می‌کنند و با حذف، گزارش گذشته خراب می‌شد.
 * به‌جایش خاموش‌کردن: مورد خاموش در فرم‌های تازه نمی‌آید ولی در سوابق و گزارش‌ها می‌ماند.
 *
 * هر بیمه یک دفترچهٔ درمان است و هر روش پرداخت یک برچسب، مثل برچسب جعبهٔ دارو.
 * تغییرها فعلاً فقط در همین صفحه نگه داشته می‌شوند؛ در کار p3-06 به پایگاه داده می‌روند.
 */
export function FinanceSettings({ initial }: { initial: FinanceOptions }) {
  const [methods, setMethods] = useState(initial.paymentMethods);
  const [insurances, setInsurances] = useState(initial.insuranceTypes);

  return (
    <div className="finance-theme mx-auto flex w-full max-w-6xl flex-col gap-6">
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <OptionList
          title="نوع بیمه‌ها"
          noun="بیمه"
          options={insurances}
          onChange={setInsurances}
          idPrefix="ins"
          variant="booklets"
        />
        <OptionList
          title="روش‌های پرداخت"
          noun="روش"
          options={methods}
          onChange={setMethods}
          idPrefix="method"
          variant="labels"
        />
      </div>
    </div>
  );
}

type Controls = (option: Option, onDark?: boolean) => ReactNode;

function OptionList({
  title,
  noun,
  options,
  onChange,
  idPrefix,
  variant,
}: {
  title: string;
  /** «بیمه» یا «روش»، برای متن دکمه‌ها */
  noun: string;
  options: Option[];
  onChange: (options: Option[]) => void;
  idPrefix: string;
  /** دفترچه برای بیمه‌ها، برچسب برای روش‌ها */
  variant: "booklets" | "labels";
}) {
  const id = useId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  const toggle = (option: Option) => {
    onChange(options.map((item) => (item.id === option.id ? { ...item, isActive: !item.isActive } : item)));
    setMessage(
      option.isActive
        ? `«${option.name}» خاموش شد. در فرم‌های تازه دیده نمی‌شود.`
        : `«${option.name}» دوباره روشن شد.`,
    );
  };

  const controls: Controls = (option, onDark = false) => (
    <div className="flex flex-wrap items-center justify-between gap-2 whitespace-nowrap">
      <button
        type="button"
        onClick={() => setEditingId(option.id)}
        className={
          onDark
            ? "-ms-2 inline-flex h-9 cursor-pointer items-center rounded-lg px-2 text-sm font-bold text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            : smallButton
        }
        aria-label={`تغییر نام ${option.name}`}
      >
        تغییر نام
      </button>
      <Switch option={option} onToggle={() => toggle(option)} onDark={onDark} />
    </div>
  );

  // رنگ جلد دفترچه‌ها به نوبت، فقط بین بیمه‌های روشن
  const activeIds = options.filter((option) => option.isActive).map((option) => option.id);

  const items = options.map((option) => {
    if (editingId === option.id) {
      return (
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
      );
    }
    if (variant === "booklets") {
      const color = BOOKLET_COLORS[activeIds.indexOf(option.id) % BOOKLET_COLORS.length] ?? "";
      return <Booklet key={option.id} option={option} color={color} controls={controls} />;
    }
    return <MethodLabel key={option.id} option={option} controls={controls} />;
  });

  return (
    <section className={card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-black text-(--fin-navy)">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-(--fin-muted)">
        {activeIds.length.toLocaleString("fa-IR")} روشن از {options.length.toLocaleString("fa-IR")}
      </p>

      <ul
        className={`mt-5 grid gap-4 ${variant === "booklets" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}
      >
        {items}
        {adding ? (
          <AddRow
            noun={noun}
            options={options}
            onAdd={(name) => {
              onChange([...options, { id: `${idPrefix}-${Date.now()}`, name, isActive: true }]);
              setAdding(false);
              setMessage(`«${name}» اضافه شد.`);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--fin-grey) font-bold text-(--fin-navy) transition-colors hover:border-(--fin-navy)/40 hover:bg-(--fin-grey-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fin-blue) ${
                variant === "booklets" ? "h-full min-h-60 flex-col" : "h-16"
              }`}
            >
              <span aria-hidden="true" className="text-3xl leading-none font-black">
                +
              </span>
              {noun} تازه
            </button>
          </li>
        )}
      </ul>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-(--fin-green) empty:hidden">
        {message}
      </p>
    </section>
  );
}

// رنگ جلد دفترچه‌ها؛ نوشتهٔ سفید روی همه تضاد کافی دارد
const BOOKLET_COLORS = [
  "bg-(--fin-navy)",
  "bg-(--fin-blue)",
  "bg-[linear-gradient(160deg,#a95f09,#7a440a)]",
];

/** نشان به‌علاوهٔ سرمه‌ای روی دایره */
function Emblem({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`grid size-11 place-items-center rounded-full ${className}`}>
      <svg viewBox="0 0 24 24" className="size-5.5">
        <path d="M12 5v14M5 12h14" stroke="var(--fin-navy)" strokeWidth={4} strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * هر بیمه یک دفترچهٔ درمان: جلد رنگی، عطف تیره در سمت راست، نشان نارنجی و نام بیمه.
 * بیمهٔ خاموش دفترچهٔ خاکستری با مهر «خاموش» است.
 */
function Booklet({ option, color, controls }: { option: Option; color: string; controls: Controls }) {
  const on = option.isActive;
  // بیمهٔ «آزاد» دفترچه ندارد؛ فقط نوشتهٔ بالای جلدش فرق می‌کند
  const free = option.name.includes("آزاد");
  return (
    <li
      className={`relative flex min-h-60 flex-col justify-between gap-3 overflow-hidden rounded-tl-md rounded-tr-2xl rounded-br-2xl rounded-bl-md py-4 ps-6 pe-4 ${
        on
          ? `${color} text-white shadow-[0_18px_30px_-22px_rgba(38,34,97,0.8)]`
          : "bg-[#d9dadd] text-[#5f6062]"
      }`}
    >
      {/* عطف دفترچه */}
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-3.5 bg-black/20" />
      <span aria-hidden="true" className="absolute inset-y-0 right-3.5 w-0.5 bg-white/20" />

      <div>
        <p className={`text-xs font-bold ${on ? "text-white/75" : ""}`}>
          {free ? "بدون دفترچه" : "دفترچهٔ درمان"}
        </p>
        <Emblem
          className={`mt-2 ${on ? (free ? "bg-(--fin-peach)" : "bg-(--fin-orange)") : "bg-[#bfc0c4]"}`}
        />
      </div>

      {!on && (
        <span
          aria-hidden="true"
          className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-md border-2 border-[#8e8f93] px-2.5 font-black"
        >
          خاموش
        </span>
      )}

      <p className={`text-xl leading-snug font-black ${on ? "" : "line-through decoration-[#8e8f93]/60"}`}>
        {option.name}
        {!on && <span className="sr-only">، خاموش</span>}
      </p>

      {controls(option, on)}
    </li>
  );
}

/** هر روش پرداخت یک برچسب، مثل برچسب جعبهٔ دارو: نوار نارنجی کنار، آیکون و نام */
function MethodLabel({ option, controls }: { option: Option; controls: Controls }) {
  const on = option.isActive;
  return (
    <li
      className={`relative grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border border-(--fin-grey) py-3 ps-5 pe-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] ${
        on ? "bg-white" : "bg-(--fin-grey-soft)"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 w-1.5 ${on ? "bg-(--fin-orange)" : "bg-(--fin-grey)"}`}
      />
      <span
        aria-hidden="true"
        className={`flex size-16 items-center justify-center rounded-xl ${on ? "bg-(--fin-peach) text-(--fin-navy)" : "bg-(--fin-grey) text-(--fin-muted) grayscale"}`}
      >
        <MethodIcon name={option.name} className="size-11" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-(--fin-muted)">روش پرداخت</p>
        <p
          className={`truncate text-lg font-black ${on ? "text-(--fin-navy)" : "text-(--fin-muted) line-through decoration-(--fin-muted)/40"}`}
        >
          {option.name}
          {!on && <span className="ms-2 text-xs font-normal no-underline">خاموش</span>}
        </p>
      </div>
      <div className="col-span-full sm:col-span-1">{controls(option)}</div>
    </li>
  );
}

function Switch({
  option,
  onToggle,
  onDark,
}: {
  option: Option;
  onToggle: () => void;
  onDark: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={option.isActive}
      aria-label={`${option.name} روشن باشد`}
      onClick={onToggle}
      className={`group relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 aria-checked:bg-(--fin-orange) ${
        onDark ? "bg-white/25 focus-visible:outline-white" : "bg-[#c9cacd] focus-visible:outline-(--fin-blue)"
      }`}
    >
      {/* پنل راست‌چین است: دکمهٔ روشن به سمت چپ می‌رود */}
      <span className="absolute start-1 top-1 size-5 rounded-full bg-white shadow transition-transform group-aria-checked:-translate-x-5" />
    </button>
  );
}

/** فرم نام؛ هم برای افزودن و هم برای تغییر نام */
function NameForm({
  label,
  initial,
  error,
  setError,
  submitText,
  onSubmit,
  onCancel,
  placeholder,
}: {
  label: string;
  initial: string;
  error: string;
  setError: (error: string) => void;
  submitText: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const id = useId();
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-bold text-(--fin-navy)">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`${id}-name`}
          autoFocus
          className={`${field} min-w-40 flex-1`}
          value={name}
          maxLength={60}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
          }}
        />
        <button type="submit" className={`${primaryButton} shrink-0`}>
          {submitText}
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
  );
}

function AddRow({
  noun,
  options,
  onAdd,
  onCancel,
}: {
  noun: string;
  options: Option[];
  onAdd: (name: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <li className="col-span-full rounded-2xl border border-(--fin-blue)/40 bg-white p-4">
      <NameForm
        label={`${noun} تازه`}
        initial=""
        error={error}
        setError={setError}
        submitText="اضافه کن"
        placeholder={noun === "بیمه" ? "مثلاً بیمهٔ تکمیلی" : "مثلاً نقدی"}
        onCancel={onCancel}
        onSubmit={(name) => {
          const problem = optionNameError(name, options);
          if (problem) {
            setError(problem);
            return;
          }
          onAdd(name.trim().replace(/\s+/g, " "));
        }}
      />
    </li>
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
  const [error, setError] = useState("");
  return (
    <li className="col-span-full rounded-2xl border border-(--fin-blue)/40 bg-white p-4">
      <NameForm
        label={`نام تازهٔ ${option.name}`}
        initial={option.name}
        error={error}
        setError={setError}
        submitText="ذخیره"
        onCancel={onCancel}
        onSubmit={(name) => {
          const problem = optionNameError(name, options, option.id);
          if (problem) {
            setError(problem);
            return;
          }
          onSave(name.trim().replace(/\s+/g, " "));
        }}
      />
    </li>
  );
}
