"use client";

import Image from "next/image";
import { useId, useState, useTransition, type ReactNode } from "react";
import { saveSiteSettings } from "../actions";
import { toPersianDigits } from "../format";
import {
  cleanDraft,
  countChanges,
  LIMITS,
  missingForName,
  validateDraft,
  type EditableKey,
  type SettingsDraft,
  type SettingsErrors,
} from "../settings-rules";
import { InstagramIcon, PhoneIcon, WhatsAppIcon } from "./icons";
import { SettingsFaq } from "./settings-faq";
import { SettingsPreview, type PreviewTarget } from "./settings-preview";

const errorText = "text-xs font-bold text-[#b42318]";

/**
 * صفحهٔ «تنظیمات سایت» (کار p3-13): تابلوی مطب، کارت ویزیت، پلاک دو مطب، برگهٔ متن معرفی و
 * بروشور پرسش‌ها، با گوشی‌ای کنارش که سایت را پیش از ذخیره نشان می‌دهد.
 * همه‌چیز با یک دکمهٔ «ذخیره» نوشته می‌شود و سایت همان لحظه تازه می‌شود.
 */
export function SiteSettings({
  initial,
  hours,
  defaultLogo,
}: {
  initial: SettingsDraft;
  /** ساعت‌های کاری، فقط برای نمایش روی تابلو */
  hours: { clinic: string; days: string; hours: string }[];
  defaultLogo: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [pending, startTransition] = useTransition();

  const changes = countChanges(saved, draft);
  const missing = missingForName(draft.siteInfo);

  const setInfo = (key: EditableKey, value: string) => {
    setDraft((current) => ({ ...current, siteInfo: { ...current.siteInfo, [key]: value } }));
    setMessage(null);
  };
  const setClinic = (id: string, field: "name" | "address" | "directions", value: string) => {
    setDraft((current) => ({
      ...current,
      clinics: current.clinics.map((clinic) => (clinic.id === id ? { ...clinic, [field]: value } : clinic)),
    }));
    setMessage(null);
  };

  const save = () => {
    // همان قاعده‌های سرور، پیش از فرستادن، تا پیام کنار خانه بیاید
    const localErrors = validateDraft(cleanDraft(draft));
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) {
      setMessage({ ok: false, text: "چند خانه ایراد دارد؛ کنار هر کدام نوشته شده." });
      return;
    }
    startTransition(async () => {
      const result = await saveSiteSettings(draft);
      if (result.ok) {
        setSaved(result.saved);
        setDraft(result.saved);
        setErrors({});
      } else {
        setErrors(result.errors);
      }
      setMessage({ ok: result.ok, text: result.message });
    });
  };

  const undo = () => {
    setDraft(saved);
    setErrors({});
    setMessage(null);
  };

  const focusOn = (next: PreviewTarget) => () => setTarget(next);

  return (
    <div className="site-theme mx-auto w-full max-w-7xl bg-transparent">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-(--site-navy) md:text-3xl">تنظیمات سایت</h1>
          <p className="text-(--site-muted)">
            هر چه این‌جا عوض کنید، با «ذخیره» همان لحظه در سایت دیده می‌شود. گوشی کنار صفحه پیش از
            ذخیره نشانش می‌دهد.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20.5rem]">
        <div className="min-w-0" onBlur={() => setTarget(null)}>
          {/* ۱ — تابلوی مطب */}
          <SectionTitle number={1} title="تابلوی مطب" hint="روی خود تابلو بنویسید" />
          <div className="site-wall relative rounded-[1.75rem] px-4 pt-12 pb-6 sm:px-6.5">
            <Board draft={draft} errors={errors} hours={hours} setInfo={setInfo} onFocus={focusOn("identity")} />
            {missing.length > 0 && (
              <p className="mx-auto mt-3.5 flex max-w-[38.75rem] gap-2.5 rounded-2xl border border-[#f6c789] bg-[#fff4e6] px-3.5 py-2.5 text-sm text-(--site-navy)">
                <span aria-hidden="true">⚠</span>
                <span>
                  <b className="text-[#a95f09]">نام دکتر در سایت دیده نمی‌شود.</b> طبق قانون، نام فقط همراه
                  عنوان تخصص و شمارهٔ نظام پزشکی می‌آید. {missing.join(" و ")} را بنویسید.
                </span>
              </p>
            )}
          </div>

          {/* ۲ — کارت ویزیت */}
          <SectionTitle number={2} title="کارت ویزیت" hint="خانهٔ خالی یعنی دکمه‌اش در سایت نمی‌آید" />
          <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card title="راه‌های تماس" className="md:-rotate-[0.8deg]">
              <CardField
                icon={<PhoneIcon className="size-4.5" />}
                label="تلفن هماهنگی و نوبت"
                value={draft.siteInfo.phone}
                error={errors.phone}
                dir="ltr"
                inputMode="tel"
                placeholder="خالی است، پس دکمهٔ نوبت در سایت نیست"
                onChange={(value) => setInfo("phone", value)}
                onFocus={focusOn("phone")}
              />
              <CardField
                icon={<WhatsAppIcon className="size-4.5" />}
                label="لینک واتس‌اپ"
                value={draft.siteInfo.whatsapp_url}
                error={errors.whatsapp_url}
                dir="ltr"
                placeholder="خالی است، پس دکمه‌اش در سایت نیست"
                onChange={(value) => setInfo("whatsapp_url", value)}
                onFocus={focusOn("whatsapp")}
              />
              <CardField
                icon={<InstagramIcon className="size-4.5" />}
                label="لینک اینستاگرام"
                value={draft.siteInfo.instagram_url}
                error={errors.instagram_url}
                dir="ltr"
                placeholder="خالی است، پس دکمه‌اش در سایت نیست"
                onChange={(value) => setInfo("instagram_url", value)}
                onFocus={focusOn("instagram")}
              />
            </Card>
            <Card title="لوگو" className="md:rotate-1">
              <div className="flex items-center gap-3 py-1.5">
                <Image
                  src={cleanDraft(draft).siteInfo.logo_url || defaultLogo}
                  alt="لوگوی فعلی"
                  width={56}
                  height={56}
                  unoptimized
                  className="size-14 shrink-0 rounded-2xl bg-white object-contain p-1 ring-1 ring-(--site-grey)"
                />
                <p className="text-sm text-(--site-muted)">
                  {draft.siteInfo.logo_url ? "لوگو از نشانی زیر می‌آید." : "لوگوی فعلی، فایل خود سایت است."}
                </p>
              </div>
              <CardField
                label="نشانی لوگوی تازه (اختیاری)"
                value={draft.siteInfo.logo_url}
                error={errors.logo_url}
                dir="ltr"
                placeholder="https://…"
                onChange={(value) => setInfo("logo_url", value)}
                onFocus={focusOn("logo")}
              />
            </Card>
          </div>

          {/* ۳ — پلاک دو مطب */}
          <SectionTitle number={3} title="پلاک مطب‌ها" />
          <div className="grid gap-5 md:grid-cols-2">
            {draft.clinics.map((clinic, index) => (
              <Plate
                key={clinic.id}
                number={index + 1}
                clinic={clinic}
                errors={errors}
                onChange={(field, value) => setClinic(clinic.id, field, value)}
                onFocus={focusOn("clinics")}
              />
            ))}
          </div>

          {/* ۴ — متن معرفی */}
          <SectionTitle number={4} title="متن معرفی پزشک" hint="برای صفحهٔ «دربارهٔ دکتر»" />
          <AboutSheet
            value={draft.siteInfo.about_text}
            error={errors.about_text}
            onChange={(value) => setInfo("about_text", value)}
            onFocus={focusOn("about")}
          />

          {/* ۵ — پرسش‌ها */}
          <SectionTitle
            number={5}
            title="بروشور پرسش‌های پرتکرار"
            hint="همین پرسش‌ها در سایت، چت‌بات و ربات دیده می‌شوند"
          />
          <SettingsFaq
            items={draft.faqItems}
            errors={errors}
            onChange={(faqItems) => {
              setDraft((current) => ({ ...current, faqItems }));
              setMessage(null);
            }}
            onFocus={focusOn("faq")}
          />

          {/* نوار ذخیره */}
          <div className="sticky bottom-4 z-10 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-(--site-navy) px-4.5 py-3 text-white shadow-[0_20px_40px_-20px_rgba(38,34,97,0.7)]">
            <p role="status" className="text-sm">
              {message ? (
                <span className={message.ok ? "font-bold" : "font-bold text-[#ffd2c9]"}>{message.text}</span>
              ) : changes > 0 ? (
                <>
                  <b>{toPersianDigits(String(changes))} تغییر ذخیره نشده</b>
                  <span className="text-white/75"> · بعد از ذخیره، سایت همان لحظه تازه می‌شود</span>
                </>
              ) : (
                <span className="text-white/75">همهٔ تغییرها ذخیره شده‌اند.</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {changes > 0 && !pending && (
                <button
                  type="button"
                  onClick={undo}
                  className="cursor-pointer rounded-xl px-3 py-2 text-sm font-bold text-white/85 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                >
                  برگرداندن تغییرها
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={pending || changes === 0}
                className="cursor-pointer rounded-xl bg-(--site-orange) px-5.5 py-2 font-black text-(--site-navy) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-50"
              >
                {pending ? "در حال ذخیره…" : "ذخیره"}
              </button>
            </div>
          </div>
        </div>

        {/* در گوشی، پیش‌نمایش بعد از فرم می‌آید تا فرم پایین نرود */}
        <aside aria-label="پیش‌نمایش سایت" className="lg:sticky lg:top-5">
          <SettingsPreview draft={draft} target={target} defaultLogo={defaultLogo} />
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <h2 className="mt-7.5 mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-black text-(--site-navy) first:mt-0">
      <span className="grid size-7 place-items-center rounded-[0.6rem] bg-(--site-navy) text-sm text-(--site-orange)">
        {toPersianDigits(String(number))}
      </span>
      {title}
      {hint && <small className="text-sm font-normal text-(--site-muted)">{hint}</small>}
    </h2>
  );
}

/** تابلوی سردر مطب؛ نام و تخصص و شماره روی خود تابلو نوشته می‌شوند */
function Board({
  draft,
  errors,
  hours,
  setInfo,
  onFocus,
}: {
  draft: SettingsDraft;
  errors: SettingsErrors;
  hours: { clinic: string; days: string; hours: string }[];
  setInfo: (key: EditableKey, value: string) => void;
  onFocus: () => void;
}) {
  const id = useId();
  const boardInput =
    "border-0 border-b-[1.5px] border-dashed border-transparent bg-transparent px-1 text-center outline-none placeholder:text-white/45 hover:border-white/35 focus:border-(--site-orange) focus:bg-white/5";
  const fieldErrors = (["doctor_name", "specialty_title", "doctor_focus", "medical_council_number"] as const)
    .map((key) => errors[key])
    .filter(Boolean);

  return (
    <div
      className="site-board relative mx-auto max-w-[38.75rem] rounded-[0.6rem] px-6 pt-7.5 pb-6 text-center text-white sm:px-8.5"
      onFocus={onFocus}
    >
      <span
        aria-hidden="true"
        className="site-board-light absolute -top-10 left-1/2 h-7.5 w-40 -translate-x-1/2 rounded-t-md rounded-b-2xl bg-linear-to-b from-[#55576a] to-[#2f3040]"
      />
      {["top-4 right-4", "top-4 left-4", "bottom-4 right-4", "bottom-4 left-4"].map((place) => (
        <span key={place} aria-hidden="true" className={`site-screw ${place}`} />
      ))}

      <input
        aria-label="نام پزشک"
        value={draft.siteInfo.doctor_name}
        maxLength={LIMITS.shortText}
        placeholder="نام پزشک"
        onChange={(event) => setInfo("doctor_name", event.target.value)}
        className={`${boardInput} w-full text-2xl font-black text-white sm:text-[2rem]`}
      />
      <span aria-hidden="true" className="mx-auto mt-1.5 mb-2.5 block h-1.25 w-30 rounded-sm bg-(--site-orange)" />
      <input
        aria-label="عنوان تخصص"
        value={draft.siteInfo.specialty_title}
        maxLength={LIMITS.shortText}
        placeholder="عنوان تخصص"
        onChange={(event) => setInfo("specialty_title", event.target.value)}
        className={`${boardInput} w-full text-lg font-bold text-white`}
      />
      <input
        aria-label="حوزهٔ تخصصی (اختیاری)"
        value={draft.siteInfo.doctor_focus}
        maxLength={LIMITS.shortText}
        placeholder="حوزهٔ تخصصی (اختیاری)"
        onChange={(event) => setInfo("doctor_focus", event.target.value)}
        className={`${boardInput} w-full text-[0.95rem] font-extrabold text-(--site-orange)`}
      />
      <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/80">
        <label htmlFor={`${id}-council`} className="whitespace-nowrap">
          شمارهٔ نظام پزشکی
        </label>
        <input
          id={`${id}-council`}
          value={toPersianDigits(draft.siteInfo.medical_council_number)}
          inputMode="numeric"
          placeholder="شماره"
          onChange={(event) => setInfo("medical_council_number", event.target.value)}
          className={`${boardInput} w-30 text-[0.95rem] font-extrabold text-white`}
        />
      </div>

      {hours.length > 0 && (
        <p className="mt-3.5 border-t border-white/20 pt-2.5 text-[0.8rem] text-white/75">
          {hours.map((row, index) => (
            <span key={`${row.clinic} ${row.days}`} className="block sm:inline">
              {index > 0 && <span className="hidden sm:inline"> · </span>}
              <b className="text-white">{row.clinic}:</b> {row.days} {row.hours}
            </span>
          ))}
        </p>
      )}
      {fieldErrors.length > 0 && (
        <p className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#b42318]">
          {fieldErrors.join(" ")}
        </p>
      )}
      <p className="sr-only">ساعت‌های کاری از تنظیمات نوبت‌دهی می‌آیند و این‌جا فقط نشان داده می‌شوند.</p>
    </div>
  );
}

function Card({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative rounded-2xl bg-white py-4 ps-4.5 pe-5.5 shadow-[0_22px_40px_-26px_rgba(38,34,97,0.6)] ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-2 rounded-e-2xl bg-(--site-orange)" />
      <h3 className="mb-1.5 text-sm font-extrabold text-(--site-muted)">{title}</h3>
      {children}
    </div>
  );
}

function CardField({
  icon,
  label,
  value,
  error,
  dir,
  inputMode,
  placeholder,
  onChange,
  onFocus,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  error?: string;
  dir?: "ltr";
  inputMode?: "tel";
  placeholder?: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2.5 border-b border-dashed border-(--site-grey) py-1.5 last:border-b-0">
      {icon && (
        <span aria-hidden="true" className="grid size-8.5 shrink-0 place-items-center rounded-[0.6rem] bg-(--site-peach) text-(--site-navy)">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[0.7rem] text-(--site-muted)">
          {label}
        </label>
        <input
          id={id}
          value={value}
          dir={dir}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-md bg-transparent px-1 py-0.5 text-end font-bold text-(--site-navy) outline-none placeholder:text-start placeholder:font-normal placeholder:text-[#a3a4ad] focus:bg-(--site-grey-soft) focus:ring-2 focus:ring-(--site-orange)"
        />
        {error && (
          <span id={`${id}-error`} className={`block ${errorText}`}>
            {error}
          </span>
        )}
      </span>
    </div>
  );
}

/** پلاک یک مطب: نام، نشانی و راه رسیدن */
function Plate({
  number,
  clinic,
  errors,
  onChange,
  onFocus,
}: {
  number: number;
  clinic: SettingsDraft["clinics"][number];
  errors: SettingsErrors;
  onChange: (field: "name" | "address" | "directions", value: string) => void;
  onFocus: () => void;
}) {
  const at = (field: string) => errors[`clinic:${clinic.id}:${field}`];
  const field =
    "w-full resize-none rounded-md bg-transparent px-1 py-0.5 text-(--site-navy) outline-none placeholder:text-[#a3a4ad] focus:bg-white focus:ring-2 focus:ring-(--site-orange)";
  const problems = [at("name"), at("address"), at("directions")].filter(Boolean);

  return (
    <div
      className="relative rounded-2xl bg-linear-160 from-[#fbfbfd] to-[#e6e8f0] px-4.5 pt-4.5 pb-3 shadow-[0_0_0_1px_#d6d8e2,0_18px_30px_-22px_rgba(38,34,97,0.6)]"
      onFocus={onFocus}
    >
      <span className="absolute -top-3 right-4 rounded-lg bg-(--site-blue) px-2.5 text-xs font-black text-white">
        مطب {toPersianDigits(String(number))}
      </span>
      <input
        aria-label={`نام مطب ${toPersianDigits(String(number))}`}
        value={clinic.name}
        maxLength={LIMITS.clinicName}
        onChange={(event) => onChange("name", event.target.value)}
        aria-invalid={Boolean(at("name"))}
        className={`${field} text-[1.05rem] font-black`}
      />
      <textarea
        aria-label={`نشانی مطب ${toPersianDigits(String(number))}`}
        rows={2}
        value={clinic.address}
        maxLength={LIMITS.address}
        onChange={(event) => onChange("address", event.target.value)}
        aria-invalid={Boolean(at("address"))}
        className={`${field} text-sm`}
      />
      <input
        aria-label={`راه رسیدن به مطب ${toPersianDigits(String(number))} (اختیاری)`}
        value={clinic.directions}
        maxLength={LIMITS.address}
        placeholder="راه رسیدن (اختیاری)"
        onChange={(event) => onChange("directions", event.target.value)}
        className={`${field} text-[0.8rem] text-(--site-muted)`}
      />
      {problems.length > 0 && <p className={errorText}>{problems.join(" ")}</p>}
    </div>
  );
}

/** برگهٔ خط‌دار متن معرفی؛ خالی یعنی متن تأییدشدهٔ برندگاید در صفحهٔ «دربارهٔ دکتر» */
function AboutSheet({
  value,
  error,
  onChange,
  onFocus,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const id = useId();
  return (
    <div className="site-lined-sheet rounded-md px-6 py-4.5 shadow-[0_1px_0_#eadfce,0_24px_40px_-30px_rgba(38,34,97,0.6)]">
      <label htmlFor={id} className="sr-only">
        متن معرفی پزشک
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={LIMITS.aboutText}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder="تا وقتی خالی است، متن تأییدشدهٔ برندگاید در صفحهٔ «دربارهٔ دکتر» می‌آید."
        aria-describedby={`${id}-hint`}
        className="min-h-34 w-full resize-y bg-transparent leading-[34px] outline-none placeholder:text-(--site-muted)"
      />
      <p id={`${id}-hint`} className="text-xs text-(--site-muted)">
        هر پاراگراف را با یک خط خالی جدا کنید. اگر نامتان را می‌نویسید، عنوان تخصص و شمارهٔ نظام پزشکی
        را هم کنارش بنویسید.
      </p>
      {error && <p className={errorText}>{error}</p>}
    </div>
  );
}
