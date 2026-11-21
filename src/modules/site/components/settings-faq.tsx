"use client";

import { useId, useState } from "react";
import { toPersianDigits } from "../format";
import { cleanKeywords, LIMITS, type FaqDraft, type SettingsErrors } from "../settings-rules";

const smallButton =
  "grid h-7 w-8 cursor-pointer place-items-center rounded-lg border border-(--site-navy)/20 bg-white text-[0.7rem] text-(--site-navy) focus-visible:outline-2 focus-visible:outline-(--site-blue) disabled:cursor-default disabled:opacity-30";

const textField =
  "w-full rounded-xl border-[1.5px] border-(--site-grey) bg-(--site-grey-soft) px-3 py-2 outline-none focus:border-(--site-orange) focus:bg-white";

/**
 * «بروشور راهنمای بیمار»: هر پرسش یک خانه با شماره، پیکان جابه‌جایی، کلید روشن و خاموش و
 * کلیدواژه‌ها. حذف نداریم (H-5 و قاعدهٔ کلی «حذف برای هیچ نقشی»)؛ پرسش خاموش در سایت و چت‌بات
 * نمی‌آید ولی سر جایش می‌ماند.
 */
export function SettingsFaq({
  items,
  errors,
  onChange,
  onFocus,
}: {
  items: FaqDraft[];
  errors: SettingsErrors;
  onChange: (items: FaqDraft[]) => void;
  onFocus: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  const update = (key: string, patch: Partial<FaqDraft>) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const move = (index: number, step: -1 | 1) => {
    const next = [...items];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
    onFocus();
  };

  const addQuestion = () => {
    const key = `new-${newCount + 1}`;
    setNewCount(newCount + 1);
    onChange([...items, { id: null, key, question: "", answer: "", keywords: [], isActive: true }]);
    setEditing(key);
    onFocus();
  };

  const activeCount = items.filter((item) => item.isActive).length;

  return (
    <div className="rounded-3xl bg-white px-4 pt-2 pb-3.5 shadow-[0_30px_60px_-44px_rgba(38,34,97,0.6)] sm:px-5.5">
      <p className="sr-only" aria-live="polite">
        {toPersianDigits(String(activeCount))} پرسش روشن و {toPersianDigits(String(items.length - activeCount))} پرسش خاموش
      </p>
      <ol className="grid md:grid-cols-2">
        {items.map((item, index) => (
          <FaqFold
            key={item.key}
            item={item}
            index={index}
            last={index === items.length - 1}
            errors={errors}
            editing={editing === item.key || Boolean(errorFor(errors, item.key))}
            onEdit={(open) => setEditing(open ? item.key : null)}
            onUpdate={(patch) => {
              update(item.key, patch);
              onFocus();
            }}
            onMove={(step) => move(index, step)}
            onFocus={onFocus}
          />
        ))}
        <li className="grid min-h-40 place-items-center border-t border-dashed border-[#cfd0dc] p-4 md:nth-[2n]:border-s md:nth-2:border-t-0">
          <button
            type="button"
            onClick={addQuestion}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-(--site-blue)/45 px-5.5 py-4 font-black text-(--site-blue) focus-visible:outline-2 focus-visible:outline-(--site-blue)"
          >
            + پرسش تازه
          </button>
        </li>
      </ol>
    </div>
  );
}

const errorFor = (errors: SettingsErrors, key: string) =>
  errors[`faq:${key}:question`] ?? errors[`faq:${key}:answer`] ?? errors[`faq:${key}:keywords`];

function FaqFold({
  item,
  index,
  last,
  errors,
  editing,
  onEdit,
  onUpdate,
  onMove,
  onFocus,
}: {
  item: FaqDraft;
  index: number;
  last: boolean;
  errors: SettingsErrors;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onUpdate: (patch: Partial<FaqDraft>) => void;
  onMove: (step: -1 | 1) => void;
  onFocus: () => void;
}) {
  const id = useId();
  const [keyword, setKeyword] = useState("");
  const number = toPersianDigits(String(index + 1));
  const label = item.question || `پرسش ${number}`;
  const at = (field: string) => errors[`faq:${item.key}:${field}`];

  const addKeyword = () => {
    const next = cleanKeywords([...item.keywords, ...keyword.split(/[،,]/)]);
    if (next.length !== item.keywords.length) onUpdate({ keywords: next });
    setKeyword("");
  };

  return (
    <li
      className={`relative border-t border-dashed border-[#cfd0dc] p-4 first:border-t-0 md:nth-2:border-t-0 md:nth-[2n]:border-s ${
        item.isActive ? "" : "bg-(--site-grey-soft)/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-7.5 place-items-center rounded-full bg-(--site-navy) text-sm font-black text-(--site-orange)">
          {number}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              aria-label={`«${label}» یکی بالاتر`}
              className={smallButton}
            >
              ▲
            </button>
            <button
              type="button"
              disabled={last}
              onClick={() => onMove(1)}
              aria-label={`«${label}» یکی پایین‌تر`}
              className={smallButton}
            >
              ▼
            </button>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={item.isActive}
            aria-label={`«${label}» در سایت دیده شود`}
            onClick={() => onUpdate({ isActive: !item.isActive })}
            className="relative h-6.5 w-11.5 shrink-0 cursor-pointer rounded-full bg-[#c9cad0] transition-colors after:absolute after:top-0.75 after:right-0.75 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-[right] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue) aria-checked:bg-(--site-orange) aria-checked:after:right-5.75"
          />
        </span>
      </div>

      {!item.isActive && (
        <span
          aria-hidden="true"
          className="absolute top-16 left-5 -rotate-12 rounded-lg border-2 border-[#9a9ba5] bg-white px-2 text-sm font-black text-[#9a9ba5]"
        >
          خاموش
        </span>
      )}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2.5" onFocus={onFocus}>
          <label htmlFor={`${id}-q`} className="text-xs font-extrabold text-(--site-navy)">
            پرسش
          </label>
          <input
            id={`${id}-q`}
            value={item.question}
            maxLength={LIMITS.question}
            onChange={(event) => onUpdate({ question: event.target.value })}
            aria-invalid={Boolean(at("question"))}
            aria-describedby={at("question") ? `${id}-qe` : undefined}
            className={textField}
          />
          {at("question") && (
            <p id={`${id}-qe`} className="text-xs font-bold text-[#b42318]">
              {at("question")}
            </p>
          )}
          <label htmlFor={`${id}-a`} className="text-xs font-extrabold text-(--site-navy)">
            پاسخ
          </label>
          <textarea
            id={`${id}-a`}
            rows={4}
            value={item.answer}
            maxLength={LIMITS.answer}
            onChange={(event) => onUpdate({ answer: event.target.value })}
            aria-invalid={Boolean(at("answer"))}
            aria-describedby={at("answer") ? `${id}-ae` : undefined}
            className={textField}
          />
          {at("answer") && (
            <p id={`${id}-ae`} className="text-xs font-bold text-[#b42318]">
              {at("answer")}
            </p>
          )}
          {!at("question") && !at("answer") && (
            <button
              type="button"
              onClick={() => onEdit(false)}
              className="cursor-pointer self-start text-sm font-extrabold text-(--site-blue) hover:underline"
            >
              بستن
            </button>
          )}
        </div>
      ) : (
        <div className={item.isActive ? "" : "opacity-45"}>
          <p className="mt-2.5 mb-1 font-black text-(--site-navy)">{item.question}</p>
          <p className="line-clamp-3 text-sm whitespace-pre-line text-(--site-muted)">{item.answer}</p>
        </div>
      )}

      {/* کلیدواژه‌ها: چت‌بات و ربات پرسش را با این‌ها پیدا می‌کنند (H-5) */}
      <div className={`mt-2.5 flex flex-wrap items-center gap-1.5 ${item.isActive ? "" : "opacity-45"}`}>
        {item.keywords.map((word) => (
          <span
            key={word}
            className="inline-flex items-center gap-1 rounded-full bg-(--site-peach) ps-2.5 pe-1 text-xs font-extrabold text-(--site-navy)"
          >
            {word}
            <button
              type="button"
              aria-label={`برداشتن کلیدواژهٔ «${word}»`}
              onClick={() => onUpdate({ keywords: item.keywords.filter((other) => other !== word) })}
              className="grid size-4.5 cursor-pointer place-items-center rounded-full text-(--site-navy)/70 hover:bg-white focus-visible:outline-2 focus-visible:outline-(--site-blue)"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={keyword}
          maxLength={LIMITS.keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addKeyword();
            }
          }}
          onBlur={addKeyword}
          onFocus={onFocus}
          placeholder="+ کلیدواژه"
          aria-label={`کلیدواژهٔ تازه برای «${label}»`}
          className="w-24 rounded-full border-[1.5px] border-dashed border-(--site-navy)/35 bg-transparent px-2.5 text-xs font-bold outline-none placeholder:text-(--site-muted) focus:w-32 focus:border-solid focus:border-(--site-orange)"
        />
      </div>
      {at("keywords") && <p className="mt-1 text-xs font-bold text-[#b42318]">{at("keywords")}</p>}
      {item.isActive && item.keywords.length === 0 && (
        <p className="mt-1 text-xs text-[#a95f09]">بدون کلیدواژه، چت‌بات این پرسش را پیدا نمی‌کند.</p>
      )}

      {!editing && (
        <button
          type="button"
          onClick={() => onEdit(true)}
          className="mt-2 cursor-pointer text-sm font-extrabold text-(--site-blue) hover:underline focus-visible:outline-2 focus-visible:outline-(--site-blue)"
        >
          ویرایش پرسش و پاسخ
        </button>
      )}
    </li>
  );
}
