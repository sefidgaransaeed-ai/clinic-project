"use client";

import { useState } from "react";
import { posterRows } from "../copy";
import { PauseIcon, PlayIcon } from "./icons";

// سه سبک که به نوبت تکرار می‌شوند: سرمه‌ای، آبی، حباب هلویی
const SENTENCE_STYLES = [
  "text-sm font-black text-(--site-navy) md:text-base",
  "text-sm font-black text-(--site-blue) md:text-base",
  "rounded-full rounded-ss-md bg-(--site-peach) px-3 py-1 text-sm font-bold text-(--site-navy)",
];

// تکرار هر ردیف در هر نیمه، تا ردیف کوتاه هم در صفحهٔ پهن کادر را پر کند
const COPIES = 3;
const SECONDS_PER_LETTER = 0.35;

/**
 * پوستر نوشتاری جمله‌های بیماران، داخل یک کادر.
 * هر ردیف آرام و بی‌وقفه کنار می‌رود و هر جمله در مسیرش یک بار کامل از وسط کادر می‌گذرد.
 * با نگه داشتن نشانگر یا دکمهٔ توقف می‌ایستد. اگر کاربر حرکت را در دستگاهش خاموش کرده باشد،
 * جمله‌ها ثابت و چندخطی چیده می‌شوند. صفحه‌خوان همیشه فهرست ثابت را می‌خواند.
 */
export function SentencePoster() {
  const [paused, setPaused] = useState(false);
  const sentences = posterRows.flat();

  return (
    <div className="mx-auto mt-8 max-w-6xl px-4 md:mt-10">
      <div className="overflow-hidden rounded-[2rem] border-s-4 border-(--site-orange) bg-(--site-grey-soft) py-6 md:py-8">
        <ul className="sr-only motion-reduce:not-sr-only motion-reduce:flex motion-reduce:flex-wrap motion-reduce:items-center motion-reduce:justify-center motion-reduce:gap-x-5 motion-reduce:gap-y-3 motion-reduce:px-5 md:motion-reduce:px-10">
          {sentences.map((sentence, index) => (
            <li key={sentence} className={SENTENCE_STYLES[index % SENTENCE_STYLES.length]}>
              «{sentence}»
            </li>
          ))}
        </ul>

        <div
          aria-hidden="true"
          className="group/poster flex flex-col gap-4 [mask-image:linear-gradient(to_left,transparent,#000_8%,#000_92%,transparent)] motion-reduce:hidden"
        >
          {posterRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex w-max items-center animate-[site-marquee_linear_infinite] group-hover/poster:[animation-play-state:paused] data-paused:[animation-play-state:paused]"
              data-paused={paused || undefined}
              style={{
                animationDirection: rowIndex % 2 ? "reverse" : "normal",
                // مدت حرکت به طول ردیف بستگی دارد تا سرعت همهٔ ردیف‌ها یکی و آرام باشد
                animationDuration: `${row.join("").length * COPIES * SECONDS_PER_LETTER}s`,
              }}
            >
              {/* دو نیمهٔ یکسان پشت سر هم تا حرکت بی‌درز تکرار شود؛ هر نیمه از عرض کادر پهن‌تر است */}
              {Array.from({ length: COPIES * 2 }, (_, copy) =>
                row.map((sentence, index) => (
                  <span
                    key={`${copy}-${index}`}
                    className={`me-6 shrink-0 whitespace-nowrap ${
                      SENTENCE_STYLES[(rowIndex + index) % SENTENCE_STYLES.length]
                    }`}
                  >
                    «{sentence}»
                  </span>
                )),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-end motion-reduce:hidden">
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-(--site-muted) transition-colors hover:text-(--site-navy) focus-visible:outline-2 focus-visible:outline-(--site-blue)"
        >
          {paused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
          {paused ? "حرکت جمله‌ها" : "توقف حرکت"}
        </button>
      </div>
    </div>
  );
}
