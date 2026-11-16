"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { toPersianDigits } from "@/lib/format";
import { submitSurvey } from "../actions";
import { COMMENT_MAX, SCORE_WORDS, type DateStamp } from "../rules";
import { PaperCard, Stamp } from "./paper";

const STAR_PATH = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

const homeButton =
  "mt-5 inline-flex h-11 items-center rounded-xl border-[1.5px] border-(--site-navy) px-4 font-extrabold text-(--site-navy) hover:bg-(--site-navy) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue)";

/**
 * «کارت پس از ویزیت»: مراجع با پنج ستاره و یک متن اختیاری نظرش را می‌دهد. فقط تاریخ نوبت
 * روی کارت است، نه نام یا اطلاعات دیگر (get_survey هم چیزی جز زمان نوبت نمی‌دهد).
 */
export function SurveyCard({ token, stamp }: { token: string; stamp: DateStamp }) {
  const id = useId();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"form" | "saved" | "closed">("form");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const stars = useRef<(HTMLButtonElement | null)[]>([]);

  const send = () => {
    setMessage("");
    startTransition(async () => {
      const result = await submitSurvey(token, score, comment);
      if (result.outcome === "saved") setState("saved");
      else if (result.outcome === "closed") setState("closed");
      else if (result.outcome === "invalid") setMessage(result.message);
      else setMessage("الان نظر ثبت نشد. چند دقیقهٔ دیگر دوباره «ثبت نظر» را بزنید.");
    });
  };

  // گروه ستاره‌ها مثل radio: پیکان‌ها امتیاز را عوض می‌کنند (در راست‌چین، پیکان چپ یعنی بیشتر)
  const onStarKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Math.min(5, Math.max(1, (score || 1) + (score ? step : 0)));
    setScore(next);
    stars.current[next - 1]?.focus();
  };

  if (state === "saved") {
    return (
      <PaperCard tone="green" className="px-5 pt-11 pb-6 text-center">
        <Stamp top="ثبت شد" middle="✓" bottom={`${stamp.day} ${stamp.month}`} tone="green" className="absolute -top-3 left-3.5" />
        <span className="mx-auto mb-3.5 grid size-21 place-items-center rounded-full bg-[#e6f4ec] text-[#1f7a4d]">
          <svg viewBox="0 0 24 24" className="size-10.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="text-xl font-black text-(--site-navy)">ممنون که وقت گذاشتید</h1>
        <p role="status" className="mx-auto mt-1.5 max-w-xs text-(--site-muted)">
          نظر شما ثبت شد و به دست پزشک می‌رسد.
        </p>
        <p className="mt-2.5 flex justify-center gap-1" aria-label={`امتیاز شما: ${toPersianDigits(score)} از ۵`}>
          {[1, 2, 3, 4, 5].map((value) => (
            <svg key={value} viewBox="0 0 24 24" className={`size-5 ${value <= score ? "fill-(--site-orange)" : "fill-[#d9dae1]"}`} aria-hidden="true">
              <path d={STAR_PATH} />
            </svg>
          ))}
        </p>
        <Link href="/" className={homeButton}>
          رفتن به صفحهٔ اول سایت
        </Link>
      </PaperCard>
    );
  }

  if (state === "closed") return <SurveyClosed />;

  const words = score ? `${toPersianDigits(score)} از ۵ — ${SCORE_WORDS[score]}` : "";

  return (
    <PaperCard className="px-4.5 pt-5.5 pb-4.5">
      <Stamp top="نوبت" middle={`${stamp.day} ${stamp.month}`} bottom={stamp.year} className="absolute -top-3.5 left-3.5" />
      <h1 className="pe-24 text-xl leading-normal font-black text-(--site-navy)">نوبت شما چطور گذشت؟</h1>
      <p className="pe-24 text-sm text-(--site-muted)">
        نوبت {stamp.weekday} {stamp.day} {stamp.month}. چند ثانیه بیشتر وقت نمی‌گیرد.
      </p>

      <div role="radiogroup" aria-labelledby={`${id}-scale`} className="mt-5 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => {
          const on = value <= score;
          return (
            <button
              key={value}
              ref={(element) => {
                stars.current[value - 1] = element;
              }}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${toPersianDigits(value)} از ۵ — ${SCORE_WORDS[value]}`}
              tabIndex={value === (score || 1) ? 0 : -1}
              onClick={() => setScore(value)}
              onKeyDown={onStarKey}
              className={`grid h-13 flex-1 cursor-pointer place-items-center rounded-2xl transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue) active:scale-95 ${
                on ? "bg-[#fff7ec] ring-[1.5px] ring-[#f6c789]" : "bg-white ring-[1.5px] ring-(--site-grey)"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={`size-7.5 transition-colors ${
                  on ? "fill-(--site-orange) stroke-(--site-orange)" : "fill-none stroke-[#b9bac4]"
                }`}
                strokeWidth={1.6}
              >
                <path d={STAR_PATH} />
              </svg>
            </button>
          );
        })}
      </div>
      <p id={`${id}-scale`} className="mt-1.5 flex justify-between text-[0.7rem] text-(--site-muted)">
        <span>خیلی ناراضی</span>
        <span className="sr-only">امتیاز از ۱ تا ۵</span>
        <span>خیلی راضی</span>
      </p>
      <p aria-live="polite" className="mt-1.5 min-h-6 text-center font-black text-(--site-navy)">
        {words}
      </p>

      <label htmlFor={`${id}-comment`} className="mt-2.5 block text-sm font-extrabold text-(--site-navy)">
        اگر خواستید، چند کلمه بنویسید <span className="font-normal text-(--site-muted)">(اختیاری)</span>
      </label>
      <textarea
        id={`${id}-comment`}
        value={comment}
        maxLength={COMMENT_MAX}
        onChange={(event) => setComment(event.target.value)}
        placeholder="مثلاً دربارهٔ زمان انتظار یا توضیح‌هایی که گرفتید"
        rows={3}
        className="mt-1 w-full resize-none rounded-2xl border-[1.5px] border-(--site-grey) bg-white px-3 py-2.5 outline-none focus:border-(--site-orange)"
      />
      <p className="text-end text-[0.7rem] text-(--site-muted)" aria-hidden="true">
        {toPersianDigits(comment.length)} / {toPersianDigits(COMMENT_MAX)}
      </p>

      {message && (
        <p role="alert" className="mt-2 text-sm font-bold text-[#b42318]">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={!score || pending}
        className="mt-3 h-12 w-full cursor-pointer rounded-2xl bg-(--site-orange) text-base font-black text-(--site-navy) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--site-blue) disabled:cursor-default disabled:opacity-45"
      >
        {pending ? "در حال ثبت…" : "ثبت نظر"}
      </button>
      {!score && <p className="mt-1.5 text-center text-xs text-(--site-muted)">اول یکی از ستاره‌ها را بزنید.</p>}

      <p className="mt-3 flex gap-1.5 text-xs text-(--site-muted)">
        <span aria-hidden="true">🔒</span>
        <span>
          نظر شما را فقط پزشک می‌بیند. اگر از نوبتتان راضی نبودید، ممکن است مطب برای پیگیری با شما
          تماس بگیرد.
        </span>
      </p>
    </PaperCard>
  );
}

/** لینک نامعتبر، پاسخ‌داده یا کهنه؛ پایگاه داده این سه را از هم جدا نمی‌کند */
export function SurveyClosed() {
  return (
    <PaperCard className="px-5 pt-8 pb-6 text-center">
      <span className="mx-auto mb-3.5 grid size-21 place-items-center rounded-full bg-(--site-grey-soft) text-(--site-muted)">
        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 15l6-6M10 6.5l1.4-1.4a4.2 4.2 0 0 1 6 6L16 12.5M14 17.5l-1.4 1.4a4.2 4.2 0 0 1-6-6L8 11.5" />
        </svg>
      </span>
      <h1 className="text-xl font-black text-(--site-navy)">این لینک دیگر کار نمی‌کند</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-(--site-muted)">
        شاید نظرتان را قبلاً ثبت کرده‌اید، یا بیش از یک ماه از ساختن لینک گذشته است. هر لینک فقط یک
        بار کار می‌کند.
      </p>
      <Link href="/" className={homeButton}>
        رفتن به صفحهٔ اول سایت
      </Link>
    </PaperCard>
  );
}

/** پایگاه داده در دسترس نیست؛ لینک شاید سالم باشد */
export function SurveyUnavailable() {
  return (
    <PaperCard className="px-5 pt-8 pb-6 text-center">
      <h1 className="text-xl font-black text-(--site-navy)">الان نمی‌شود نظر ثبت کرد</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-(--site-muted)">
        مشکل از لینک شما نیست. چند دقیقهٔ دیگر همین صفحه را دوباره باز کنید.
      </p>
    </PaperCard>
  );
}
